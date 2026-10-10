use crate::db::{AgentLog, Database};
use crate::engine::tools::ToolRunner;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgentStatus {
    Idle,
    Thinking,
    ExecutingTool,
    WaitingClearance,
    Completed,
    Failed,
    Terminated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubAgentState {
    pub id: String,
    pub name: String,
    pub role: String,
    pub status: AgentStatus,
    pub current_step: String,
    pub progress: u8,
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestratorEvent {
    pub event_type: String, // "agent_updated", "task_updated", "log_emitted", "clearance_required"
    pub payload: serde_json::Value,
}

pub struct AgentOrchestrator {
    db: Database,
    #[allow(dead_code)]
    tool_runner: ToolRunner,
    active_agents: Arc<Mutex<HashMap<String, SubAgentState>>>,
    global_cancel_token: CancellationToken,
    event_sender: broadcast::Sender<OrchestratorEvent>,
    pending_approvals: Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<bool>>>>,
}

impl AgentOrchestrator {
    pub fn new(db: Database, tool_runner: ToolRunner) -> Self {
        let (tx, _rx) = broadcast::channel(100);
        Self {
            db,
            tool_runner,
            active_agents: Arc::new(Mutex::new(HashMap::new())),
            global_cancel_token: CancellationToken::new(),
            event_sender: tx,
            pending_approvals: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<OrchestratorEvent> {
        self.event_sender.subscribe()
    }

    pub fn is_cancelled(&self) -> bool {
        self.global_cancel_token.is_cancelled()
    }

    pub async fn emit_log(&self, agent_name: &str, level: &str, message: &str) {
        let log = AgentLog {
            id: Uuid::new_v4().to_string(),
            agent_name: agent_name.to_string(),
            level: level.to_string(),
            message: message.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };
        self.db.save_agent_log(&log).ok();
        self.event_sender
            .send(OrchestratorEvent {
                event_type: "log_emitted".to_string(),
                payload: serde_json::to_value(&log).unwrap_or_default(),
            })
            .ok();
    }

    pub async fn trigger_emergency_stop(&self) {
        self.global_cancel_token.cancel();
        self.emit_log(
            "SYSTEM",
            "FAIL",
            "EMERGENCY STOP TRIGGERED! Cancelling all running agents.",
        )
        .await;

        let mut agents = self.active_agents.lock().await;
        for (_, agent) in agents.iter_mut() {
            agent.status = AgentStatus::Terminated;
            agent.current_step = "Terminated by emergency stop".to_string();
        }

        self.event_sender
            .send(OrchestratorEvent {
                event_type: "emergency_stop".to_string(),
                payload: serde_json::json!({ "status": "terminated" }),
            })
            .ok();
    }

    pub async fn resolve_tool_clearance(&self, request_id: &str, approved: bool) {
        let mut approvals = self.pending_approvals.lock().await;
        if let Some(tx) = approvals.remove(request_id) {
            tx.send(approved).ok();
        }
    }

    pub async fn spawn_agent_job(
        self: Arc<Self>,
        _session_id: String,
        agent_id: String,
        name: String,
        role: String,
        task_id: String,
        goal: String,
    ) {
        let token = self.global_cancel_token.child_token();
        let orchestrator = self.clone();

        tokio::spawn(async move {
            {
                let mut agents = orchestrator.active_agents.lock().await;
                agents.insert(
                    agent_id.clone(),
                    SubAgentState {
                        id: agent_id.clone(),
                        name: name.clone(),
                        role: role.clone(),
                        status: if token.is_cancelled() {
                            AgentStatus::Terminated
                        } else {
                            AgentStatus::Thinking
                        },
                        current_step: format!("Analyzing goal: {}", goal),
                        progress: 10,
                        parent_id: None,
                    },
                );
            }

            if token.is_cancelled() {
                return;
            }

            orchestrator
                .emit_log(&name, "INFO", &format!("Agent initialized. Goal: {}", goal))
                .await;

            // Step loop with cancellation awareness using tokio::time::timeout
            let step1_res = tokio::time::timeout(tokio::time::Duration::from_millis(500), token.cancelled()).await;
            if step1_res.is_ok() || token.is_cancelled() {
                let mut agents = orchestrator.active_agents.lock().await;
                if let Some(a) = agents.get_mut(&agent_id) {
                    a.status = AgentStatus::Terminated;
                    a.current_step = "Terminated by emergency stop".to_string();
                }
                orchestrator.emit_log(&name, "WARN", "Task cancelled by user emergency stop.").await;
                return;
            }

            // Step 1: Thinking -> ExecutingTool
            {
                let mut agents = orchestrator.active_agents.lock().await;
                if let Some(a) = agents.get_mut(&agent_id) {
                    if a.status != AgentStatus::Terminated {
                        a.status = AgentStatus::ExecutingTool;
                        a.current_step = "Inspecting workspace and preparing files".to_string();
                        a.progress = 50;
                    }
                }
            }
            orchestrator.emit_log(&name, "EXEC", "Reading project manifest and structure").await;

            // Step 2: Tool execution -> Completion
            let step2_res = tokio::time::timeout(tokio::time::Duration::from_millis(500), token.cancelled()).await;
            if step2_res.is_ok() || token.is_cancelled() {
                let mut agents = orchestrator.active_agents.lock().await;
                if let Some(a) = agents.get_mut(&agent_id) {
                    a.status = AgentStatus::Terminated;
                    a.current_step = "Terminated by emergency stop".to_string();
                }
                orchestrator.emit_log(&name, "WARN", "Task aborted during execution.").await;
                return;
            }

            {
                let mut agents = orchestrator.active_agents.lock().await;
                if let Some(a) = agents.get_mut(&agent_id) {
                    if a.status != AgentStatus::Terminated {
                        a.status = AgentStatus::Completed;
                        a.current_step = "Goal successfully completed".to_string();
                        a.progress = 100;
                    }
                }
            }
            orchestrator.emit_log(&name, "INFO", &format!("Task {} completed successfully.", task_id)).await;
        });
    }

    pub async fn get_agents(&self) -> Vec<SubAgentState> {
        let agents = self.active_agents.lock().await;
        agents.values().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_global_cancel_token_emergency_stop() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(async {
            let db = Database::new_in_memory().expect("Failed to create in-memory db");
            let runner = ToolRunner::new(PathBuf::from("/tmp"));
            let orchestrator = Arc::new(AgentOrchestrator::new(db, runner));

            assert!(!orchestrator.is_cancelled());

            // Spawn subagent 1
            orchestrator
                .clone()
                .spawn_agent_job(
                    "session-1".to_string(),
                    "agent-01".to_string(),
                    "Coder Subagent #1".to_string(),
                    "Implementation".to_string(),
                    "task-01".to_string(),
                    "Build feature A".to_string(),
                )
                .await;

            // Spawn subagent 2
            orchestrator
                .clone()
                .spawn_agent_job(
                    "session-1".to_string(),
                    "agent-02".to_string(),
                    "Reviewer Subagent #2".to_string(),
                    "Verification".to_string(),
                    "task-02".to_string(),
                    "Verify security".to_string(),
                )
                .await;

            // Small pause to allow tasks to start
            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

            let active = orchestrator.get_agents().await;
            assert_eq!(active.len(), 2);
            assert!(!matches!(active[0].status, AgentStatus::Terminated));

            // Trigger Emergency Stop
            orchestrator.trigger_emergency_stop().await;

            assert!(orchestrator.is_cancelled());

            // Verify all subagents are terminated
            let agents_after = orchestrator.get_agents().await;
            assert_eq!(agents_after.len(), 2);
            for agent in agents_after {
                assert_eq!(
                    agent.status,
                    AgentStatus::Terminated,
                    "Agent {} must be terminated after emergency stop",
                    agent.name
                );
            }
        });
    }

    #[test]
    fn test_orchestrator_broadcast_events() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(async {
            let db = Database::new_in_memory().expect("Failed to create in-memory db");
            let runner = ToolRunner::new(PathBuf::from("/tmp"));
            let orchestrator = AgentOrchestrator::new(db, runner);

            let mut rx = orchestrator.subscribe();

            orchestrator
                .emit_log("TestAgent", "INFO", "Broadcast event verification")
                .await;

            let event = rx.recv().await.expect("Failed to receive event");
            assert_eq!(event.event_type, "log_emitted");
            assert_eq!(event.payload["agent_name"], "TestAgent");
            assert_eq!(event.payload["message"], "Broadcast event verification");
        });
    }
}
