use crate::db::{ApiKeyRecord, ChatMessage, ChatSession, Database};
use crate::engine::orchestrator::{AgentOrchestrator, SubAgentState};
use crate::engine::tools::{ToolCallRequest, ToolCallResult, ToolRunner};
use crate::providers::{
    ChatMessagePayload, ClaudeProvider, DeepSeekProvider, GeminiProvider, OllamaProvider,
    OpenAiProvider, ProviderClient,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

pub struct AppState {
    pub db: Database,
    pub orchestrator: Arc<AgentOrchestrator>,
    pub tool_runner: ToolRunner,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatSendResult {
    pub user_message: ChatMessage,
    pub assistant_message: ChatMessage,
}

#[tauri::command]
pub async fn save_api_key(
    state: State<'_, AppState>,
    provider: String,
    api_key: String,
    base_url: Option<String>,
) -> Result<String, String> {
    let record = ApiKeyRecord {
        provider,
        api_key,
        base_url,
        is_active: true,
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    state
        .db
        .save_api_key(&record)
        .map_err(|e| e.to_string())?;
    Ok("Key saved successfully".to_string())
}

#[tauri::command]
pub async fn get_api_keys(state: State<'_, AppState>) -> Result<Vec<ApiKeyRecord>, String> {
    state.db.get_api_keys().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_api_key(state: State<'_, AppState>, provider: String) -> Result<String, String> {
    state
        .db
        .delete_api_key(&provider)
        .map_err(|e| e.to_string())?;
    Ok("Key removed".to_string())
}

#[tauri::command]
pub async fn test_provider(
    provider: String,
    api_key: String,
    base_url: Option<String>,
    model: Option<String>,
) -> Result<u128, String> {
    match provider.as_str() {
        "gemini" => {
            let client = GeminiProvider::new(api_key, model);
            client.test_connection().await.map_err(|e| e.to_string())
        }
        "claude" | "anthropic" => {
            let client = ClaudeProvider::new(api_key, base_url, model);
            client.test_connection().await.map_err(|e| e.to_string())
        }
        "deepseek" => {
            let client = DeepSeekProvider::new(api_key, base_url, model);
            client.test_connection().await.map_err(|e| e.to_string())
        }
        "ollama" => {
            let client = OllamaProvider::new(base_url, model);
            client.test_connection().await.map_err(|e| e.to_string())
        }
        _ => {
            let client = OpenAiProvider::new(api_key, base_url, model);
            client.test_connection().await.map_err(|e| e.to_string())
        }
    }
}

#[tauri::command]
pub async fn create_chat_session(
    state: State<'_, AppState>,
    title: String,
    model: String,
    provider: String,
) -> Result<ChatSession, String> {
    let session = ChatSession {
        id: Uuid::new_v4().to_string(),
        title,
        model,
        provider,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    state
        .db
        .save_chat_session(&session)
        .map_err(|e| e.to_string())?;
    Ok(session)
}

#[tauri::command]
pub async fn get_chat_sessions(state: State<'_, AppState>) -> Result<Vec<ChatSession>, String> {
    state.db.get_chat_sessions().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_chat_messages(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<ChatMessage>, String> {
    state
        .db
        .get_chat_messages(&session_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_chat_message(
    state: State<'_, AppState>,
    session_id: String,
    content: String,
    model: String,
    provider: String,
) -> Result<ChatSendResult, String> {
    // 1. Save user message
    let user_msg = ChatMessage {
        id: Uuid::new_v4().to_string(),
        session_id: session_id.clone(),
        role: "user".to_string(),
        content: content.clone(),
        reasoning: None,
        token_count: None,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    state.db.save_chat_message(&user_msg).map_err(|e| e.to_string())?;

    // 2. Fetch API key from DB
    let keys = state.db.get_api_keys().map_err(|e| e.to_string())?;
    let key_record = keys.into_iter().find(|k| k.provider == provider);

    // 3. Prepare client & prompt
    let api_key = key_record.as_ref().map(|k| k.api_key.clone()).unwrap_or_default();
    let base_url = key_record.and_then(|k| k.base_url);

    let messages_history = state
        .db
        .get_chat_messages(&session_id)
        .map_err(|e| e.to_string())?;

    let payload: Vec<ChatMessagePayload> = messages_history
        .into_iter()
        .map(|m| ChatMessagePayload {
            role: m.role,
            content: m.content,
        })
        .collect();

    let sys_prompt = Some("You are an autonomous AI coding assistant in Agentic Native Hub.".to_string());

    let response = match provider.as_str() {
        "gemini" => {
            let client = GeminiProvider::new(api_key, Some(model.clone()));
            client.send_chat(payload, sys_prompt).await
        }
        "claude" | "anthropic" => {
            let client = ClaudeProvider::new(api_key, base_url, Some(model.clone()));
            client.send_chat(payload, sys_prompt).await
        }
        "deepseek" => {
            let client = DeepSeekProvider::new(api_key, base_url, Some(model.clone()));
            client.send_chat(payload, sys_prompt).await
        }
        "ollama" => {
            let client = OllamaProvider::new(base_url, Some(model.clone()));
            client.send_chat(payload, sys_prompt).await
        }
        _ => {
            let client = OpenAiProvider::new(api_key, base_url, Some(model.clone()));
            client.send_chat(payload, sys_prompt).await
        }
    };

    let response = response.map_err(|e| e.to_string())?;

    // 4. Save assistant response
    let assistant_msg = ChatMessage {
        id: Uuid::new_v4().to_string(),
        session_id,
        role: "assistant".to_string(),
        content: response.content,
        reasoning: response.reasoning,
        token_count: response.output_tokens,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    state.db.save_chat_message(&assistant_msg).map_err(|e| e.to_string())?;

    Ok(ChatSendResult {
        user_message: user_msg,
        assistant_message: assistant_msg,
    })
}

#[tauri::command]
pub async fn start_build_session(
    state: State<'_, AppState>,
    goal: String,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();

    // Spawn Lead Architect
    let orch = state.orchestrator.clone();
    orch.spawn_agent_job(
        session_id.clone(),
        Uuid::new_v4().to_string(),
        "Lead Architect".to_string(),
        "Supervisor".to_string(),
        "T-01".to_string(),
        goal.clone(),
    ).await;

    // Spawn Coder Subagent
    let orch = state.orchestrator.clone();
    orch.spawn_agent_job(
        session_id.clone(),
        Uuid::new_v4().to_string(),
        "Coder Subagent #1".to_string(),
        "Implementation".to_string(),
        "T-02".to_string(),
        format!("Implement components for: {}", goal),
    ).await;

    // Spawn Reviewer Subagent
    let orch = state.orchestrator.clone();
    orch.spawn_agent_job(
        session_id.clone(),
        Uuid::new_v4().to_string(),
        "Reviewer Subagent #2".to_string(),
        "Verification & Linting".to_string(),
        "T-03".to_string(),
        "Review security & correctness".to_string(),
    ).await;

    Ok(session_id)
}

#[tauri::command]
pub async fn get_build_agents(state: State<'_, AppState>) -> Result<Vec<SubAgentState>, String> {
    Ok(state.orchestrator.get_agents().await)
}

#[tauri::command]
pub async fn get_recent_logs(state: State<'_, AppState>) -> Result<Vec<crate::db::AgentLog>, String> {
    state.db.get_recent_logs(50).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trigger_emergency_stop(state: State<'_, AppState>) -> Result<String, String> {
    state.orchestrator.trigger_emergency_stop().await;
    Ok("Emergency stop initiated".to_string())
}

#[tauri::command]
pub async fn resolve_tool_clearance(
    state: State<'_, AppState>,
    request_id: String,
    approved: bool,
) -> Result<String, String> {
    state.orchestrator.resolve_tool_clearance(&request_id, approved).await;
    Ok("Resolved".to_string())
}

#[tauri::command]
pub async fn execute_sandbox_tool(
    state: State<'_, AppState>,
    tool_name: String,
    parameters: serde_json::Value,
) -> Result<ToolCallResult, String> {
    let req = ToolCallRequest {
        id: Uuid::new_v4().to_string(),
        tool_name,
        parameters,
        requires_clearance: false,
        risk_level: "Low".to_string(),
    };
    Ok(state.tool_runner.execute_tool(&req).await)
}
