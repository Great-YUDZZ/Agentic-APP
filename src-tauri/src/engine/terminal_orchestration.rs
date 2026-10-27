use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkerSession {
    pub worker_id: String,
    pub agent_id: String,
    pub tab_id: String,
    pub role: String,
    pub task_spec: String,
    pub status: String, // "idle", "working", "waiting_approval", "done", "error"
    pub created_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InterAgentMessage {
    pub id: String,
    pub run_id: String,
    pub sender: String,
    pub recipient: String, // "all" or specific worker_id / role
    pub content: String,
    pub timestamp: i64,
}

#[derive(Clone, Default)]
pub struct TerminalOrchestratorState {
    pub workers: Arc<Mutex<HashMap<String, WorkerSession>>>,
    pub messages: Arc<Mutex<Vec<InterAgentMessage>>>,
    pub orchestrator_role: Arc<Mutex<String>>, // "api" or agent_id (e.g. "claude", "agy")
}

impl TerminalOrchestratorState {
    pub fn new() -> Self {
        Self {
            workers: Arc::new(Mutex::new(HashMap::new())),
            messages: Arc::new(Mutex::new(Vec::new())),
            orchestrator_role: Arc::new(Mutex::new("api".to_string())),
        }
    }

    pub fn set_orchestrator(&self, role_or_agent: &str) {
        let mut lock = self.orchestrator_role.lock().unwrap();
        *lock = role_or_agent.to_string();
    }

    pub fn get_orchestrator(&self) -> String {
        let lock = self.orchestrator_role.lock().unwrap();
        lock.clone()
    }

    pub fn register_worker(&self, session: WorkerSession) {
        let mut lock = self.workers.lock().unwrap();
        lock.insert(session.worker_id.clone(), session);
    }

    pub fn update_worker_status(&self, worker_id: &str, status: &str) -> bool {
        let mut lock = self.workers.lock().unwrap();
        if let Some(worker) = lock.get_mut(worker_id) {
            worker.status = status.to_string();
            true
        } else {
            false
        }
    }

    pub fn remove_worker(&self, worker_id: &str) -> Option<WorkerSession> {
        let mut lock = self.workers.lock().unwrap();
        lock.remove(worker_id)
    }

    pub fn clear_all_workers(&self) {
        let mut lock = self.workers.lock().unwrap();
        lock.clear();
    }

    pub fn get_all_workers(&self) -> Vec<WorkerSession> {
        let lock = self.workers.lock().unwrap();
        lock.values().cloned().collect()
    }

    pub fn send_message(&self, msg: InterAgentMessage) {
        let mut lock = self.messages.lock().unwrap();
        lock.push(msg);
    }

    pub fn get_messages(
        &self,
        run_id: Option<&str>,
        recipient: Option<&str>,
    ) -> Vec<InterAgentMessage> {
        let lock = self.messages.lock().unwrap();
        lock.iter()
            .filter(|m| {
                if let Some(r) = run_id {
                    if m.run_id != r {
                        return false;
                    }
                }
                if let Some(rec) = recipient {
                    if m.recipient != "all" && m.recipient != rec {
                        return false;
                    }
                }
                true
            })
            .cloned()
            .collect()
    }

    pub fn clear_messages(&self) {
        let mut lock = self.messages.lock().unwrap();
        lock.clear();
    }
}
