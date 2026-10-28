use crate::db::{ApiKeyRecord, ChatMessage, ChatSession, Database};
use crate::engine::orchestrator::{AgentOrchestrator, SubAgentState};
use crate::engine::tools::{ToolCallRequest, ToolCallResult, ToolRunner};
use crate::providers::{
    ChatMessagePayload, ClaudeProvider, DeepSeekProvider, GeminiProvider, OllamaProvider,
    OpenAiProvider, ProviderClient,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::io::Write;

pub struct PtySession {
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
}

pub struct AppState {
    pub db: Database,
    pub orchestrator: Arc<AgentOrchestrator>,
    pub tool_runner: ToolRunner,
    pub active_terminal_processes: Arc<Mutex<HashMap<String, u32>>>,
    pub pty_sessions: Arc<Mutex<HashMap<String, PtySession>>>,
    pub vault: Arc<crate::vault::VaultState>,
    pub mcp_manager: Arc<crate::engine::mcp::McpClientManager>,
    pub terminal_orchestrator: Arc<crate::engine::terminal_orchestration::TerminalOrchestratorState>,
    pub hook_server: Arc<crate::engine::hook_server::AgentHookServer>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct TerminalStreamData {
    pub tab_id: String,
    pub line: String,
    pub is_stderr: bool,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct TerminalStreamDone {
    pub tab_id: String,
    pub exit_code: i32,
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
    id: Option<String>,
    title: String,
    model: String,
    provider: String,
    mode: Option<String>,
) -> Result<ChatSession, String> {
    let session = ChatSession {
        id: id.unwrap_or_else(|| Uuid::new_v4().to_string()),
        title,
        model,
        provider,
        mode,
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
pub async fn save_chat_message(
    state: State<'_, AppState>,
    message: ChatMessage,
) -> Result<(), String> {
    state.db.save_chat_message(&message).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_chat_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    state.db.delete_chat_session(&session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_chat_session_title(
    state: State<'_, AppState>,
    session_id: String,
    title: String,
) -> Result<(), String> {
    state.db.update_chat_session_title(&session_id, &title).map_err(|e| e.to_string())
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

#[tauri::command]
pub async fn set_workspace_directory(
    state: State<'_, AppState>,
    path: String,
) -> Result<String, String> {
    let p = std::path::PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("Direktori '{}' tidak ditemukan di sistem.", path));
    }
    state.tool_runner.set_workspace_root(p);
    Ok(path)
}

#[tauri::command]
pub async fn pick_workspace_directory(
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    let tool_runner = state.tool_runner.clone();
    tokio::task::spawn_blocking(move || {
        #[cfg(target_os = "linux")]
        {
            // Coba gunakan zenity terlebih dahulu
            let output = std::process::Command::new("zenity")
                .args(["--file-selection", "--directory", "--title=Pilih Direktori Proyek"])
                .output();

            if let Ok(out) = output {
                if out.status.success() {
                    let path_str = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if !path_str.is_empty() {
                        let pb = std::path::PathBuf::from(&path_str);
                        tool_runner.set_workspace_root(pb);
                        return Ok(Some(path_str));
                    }
                }
                return Ok(None);
            }

            // Fallback kdialog untuk lingkungan KDE
            let kdialog_output = std::process::Command::new("kdialog")
                .args(["--getexistingdirectory", "--title", "Pilih Direktori Proyek"])
                .output();

            if let Ok(out) = kdialog_output {
                if out.status.success() {
                    let path_str = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if !path_str.is_empty() {
                        let pb = std::path::PathBuf::from(&path_str);
                        tool_runner.set_workspace_root(pb);
                        return Ok(Some(path_str));
                    }
                }
            }

            Ok(None)
        }

        #[cfg(target_os = "windows")]
        {
            let script = r#"
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Pilih Direktori Proyek untuk Agentic Hub"
$dialog.ShowNewFolderButton = $true
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $dialog.SelectedPath
}
"#;
            let output = std::process::Command::new("powershell")
                .args(["-NoProfile", "-Command", script])
                .output();

            if let Ok(out) = output {
                if out.status.success() {
                    let path_str = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if !path_str.is_empty() {
                        let pb = std::path::PathBuf::from(&path_str);
                        tool_runner.set_workspace_root(pb);
                        return Ok(Some(path_str));
                    }
                }
            }
            Ok(None)
        }

        #[cfg(not(any(target_os = "linux", target_os = "windows")))]
        {
            Ok(None)
        }
    })
    .await
    .map_err(|e| format!("Failed to spawn dialog thread: {}", e))?
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub size: u64,
    pub extension: String,
    pub children: Option<Vec<FileNode>>,
}

fn build_file_tree_recursive(
    dir_path: &std::path::Path,
    workspace_root: &std::path::Path,
    current_depth: usize,
    max_depth: usize,
) -> Vec<FileNode> {
    if current_depth > max_depth {
        return Vec::new();
    }

    let mut nodes = Vec::new();
    let entries = match std::fs::read_dir(dir_path) {
        Ok(e) => e,
        Err(_) => return nodes,
    };

    let mut dir_entries = Vec::new();
    for entry in entries.flatten() {
        dir_entries.push(entry);
    }

    // Urutkan: direktori lebih dulu (alfabetis), kemudian berkas (alfabetis)
    dir_entries.sort_by(|a, b| {
        let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
        if a_is_dir == b_is_dir {
            a.file_name().cmp(&b.file_name())
        } else if a_is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    for entry in dir_entries {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if crate::engine::codebase_rag::should_skip_dir(&name) {
            continue;
        }

        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let relative_path = path
            .strip_prefix(workspace_root)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string();

        let (size, ext, children) = if is_dir {
            let child_nodes =
                build_file_tree_recursive(&path, workspace_root, current_depth + 1, max_depth);
            (0, String::new(), Some(child_nodes))
        } else {
            let meta_size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            let extension = path
                .extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            (meta_size, extension, None)
        };

        nodes.push(FileNode {
            name,
            path: path.to_string_lossy().to_string(),
            relative_path,
            is_dir,
            size,
            extension: ext,
            children,
        });
    }

    nodes
}

pub fn is_system_root_or_home(path: &std::path::Path) -> bool {
    let path_str = path.to_string_lossy();
    if path_str == "/" || path_str.is_empty() {
        return true;
    }
    if let Ok(home) = std::env::var("HOME") {
        if path_str == home || path == std::path::Path::new(&home) {
            return true;
        }
    }
    #[cfg(target_os = "windows")]
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        if path_str == userprofile || path == std::path::Path::new(&userprofile) {
            return true;
        }
    }
    false
}

#[tauri::command]
pub async fn get_workspace_directory(state: State<'_, AppState>) -> Result<String, String> {
    let ws = state.tool_runner.workspace_root();
    if is_system_root_or_home(&ws) {
        return Ok(String::new());
    }
    Ok(ws.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn read_workspace_file(
    state: State<'_, AppState>,
    relative_path: String,
) -> Result<String, String> {
    let sanitized = state
        .tool_runner
        .sanitize_path(&relative_path, false)
        .map_err(|e| e.to_string())?;

    if !sanitized.exists() {
        return Err(format!("Berkas '{}' tidak ditemukan.", relative_path));
    }

    std::fs::read_to_string(&sanitized)
        .map_err(|e| format!("Gagal membaca berkas '{}': {}", relative_path, e))
}

#[tauri::command]
pub async fn get_workspace_file_tree(
    state: State<'_, AppState>,
    max_depth: Option<usize>,
) -> Result<Vec<FileNode>, String> {
    let ws = state.tool_runner.workspace_root();
    let depth = max_depth.unwrap_or(6);

    tokio::task::spawn_blocking(move || {
        if !ws.exists() || is_system_root_or_home(&ws) {
            return Ok(Vec::new());
        }
        let tree = build_file_tree_recursive(&ws, &ws, 1, depth);
        Ok(tree)
    })
    .await
    .map_err(|e| format!("Gagal memindai pohon berkas workspace: {}", e))?
}

#[tauri::command]
pub async fn create_workspace_file(
    state: State<'_, AppState>,
    relative_path: String,
    is_dir: bool,
) -> Result<(), String> {
    let sanitized = state
        .tool_runner
        .sanitize_path(&relative_path, false)
        .map_err(|e| e.to_string())?;

    if sanitized.exists() {
        return Err(format!("Jalur '{}' sudah ada.", relative_path));
    }

    if is_dir {
        std::fs::create_dir_all(&sanitized)
            .map_err(|e| format!("Gagal membuat direktori '{}': {}", relative_path, e))?;
    } else {
        if let Some(parent) = sanitized.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Gagal membuat direktori induk: {}", e))?;
        }
        std::fs::write(&sanitized, b"")
            .map_err(|e| format!("Gagal membuat berkas '{}': {}", relative_path, e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn write_workspace_file(
    state: State<'_, AppState>,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    let sanitized = state
        .tool_runner
        .sanitize_path(&relative_path, false)
        .map_err(|e| e.to_string())?;

    if let Some(parent) = sanitized.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Gagal menyiapkan direktori induk: {}", e))?;
    }

    std::fs::write(&sanitized, content)
        .map_err(|e| format!("Gagal menyimpan berkas '{}': {}", relative_path, e))?;

    Ok(())
}

#[tauri::command]
pub async fn rename_workspace_file(
    state: State<'_, AppState>,
    old_relative_path: String,
    new_relative_path: String,
) -> Result<(), String> {
    let old_sanitized = state
        .tool_runner
        .sanitize_path(&old_relative_path, false)
        .map_err(|e| e.to_string())?;
    let new_sanitized = state
        .tool_runner
        .sanitize_path(&new_relative_path, false)
        .map_err(|e| e.to_string())?;

    if !old_sanitized.exists() {
        return Err(format!("Berkas sumber '{}' tidak ditemukan.", old_relative_path));
    }
    if new_sanitized.exists() {
        return Err(format!("Berkas target '{}' sudah ada.", new_relative_path));
    }

    if let Some(parent) = new_sanitized.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Gagal membuat direktori induk: {}", e))?;
    }

    std::fs::rename(&old_sanitized, &new_sanitized)
        .map_err(|e| format!("Gagal mengubah nama berkas: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_workspace_file(
    state: State<'_, AppState>,
    relative_path: String,
) -> Result<(), String> {
    let sanitized = state
        .tool_runner
        .sanitize_path(&relative_path, false)
        .map_err(|e| e.to_string())?;

    if !sanitized.exists() {
        return Err(format!("Berkas '{}' tidak ditemukan.", relative_path));
    }

    if sanitized.is_dir() {
        std::fs::remove_dir_all(&sanitized)
            .map_err(|e| format!("Gagal menghapus direktori '{}': {}", relative_path, e))?;
    } else {
        std::fs::remove_file(&sanitized)
            .map_err(|e| format!("Gagal menghapus berkas '{}': {}", relative_path, e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn reveal_in_file_manager(
    state: State<'_, AppState>,
    relative_path: Option<String>,
) -> Result<(), String> {
    let target = if let Some(rel) = relative_path {
        state
            .tool_runner
            .sanitize_path(&rel, false)
            .map_err(|e| e.to_string())?
    } else {
        state.tool_runner.workspace_root()
    };

    #[cfg(target_os = "linux")]
    {
        let to_open = if target.is_file() {
            target.parent().unwrap_or(&target).to_path_buf()
        } else {
            target
        };
        let _ = std::process::Command::new("xdg-open")
            .arg(&to_open)
            .spawn();
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        if target.is_file() {
            let _ = std::process::Command::new("explorer")
                .arg(format!("/select,\"{}\"", target.display()))
                .spawn();
        } else {
            let _ = std::process::Command::new("explorer")
                .arg(&target)
                .spawn();
        }
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("-R")
            .arg(&target)
            .spawn();
        Ok(())
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        Ok(())
    }
}

#[tauri::command]
pub async fn query_codebase_context(
    state: State<'_, AppState>,
    query: String,
    max_chunks: Option<usize>,
) -> Result<Vec<crate::engine::codebase_rag::CodeChunkMatch>, String> {
    let ws = state.tool_runner.workspace_root();
    let top_k = max_chunks.unwrap_or(4).min(10);

    tokio::task::spawn_blocking(move || {
        if !ws.exists() || is_system_root_or_home(&ws) {
            return Ok(Vec::new());
        }
        let chunks = crate::engine::codebase_rag::scan_workspace_chunks(&ws, 500);
        let matches = crate::engine::codebase_rag::search_chunks(&query, &chunks, top_k);
        Ok(matches)
    })
    .await
    .map_err(|e| format!("Gagal memproses pencarian codebase RAG: {}", e))?
}

#[tauri::command]
pub async fn search_workspace_text(
    state: State<'_, AppState>,
    query: String,
    case_sensitive: Option<bool>,
    whole_word: Option<bool>,
    max_results: Option<usize>,
) -> Result<Vec<crate::engine::codebase_rag::TextSearchMatch>, String> {
    let ws = state.tool_runner.workspace_root();
    let case_sens = case_sensitive.unwrap_or(false);
    let whole_w = whole_word.unwrap_or(false);
    let limit = max_results.unwrap_or(300).min(1000);

    tokio::task::spawn_blocking(move || {
        if !ws.exists() || is_system_root_or_home(&ws) {
            return Ok(Vec::new());
        }
        let matches = crate::engine::codebase_rag::search_workspace_text_files(
            &ws,
            &query,
            case_sens,
            whole_w,
            limit,
        );
        Ok(matches)
    })
    .await
    .map_err(|e| format!("Gagal memproses pencarian teks global: {}", e))?
}

#[tauri::command]
pub async fn save_exported_file_dialog(
    default_filename: String,
    content: String,
) -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(move || {
        let selected_path: Option<String> = {
            #[cfg(target_os = "linux")]
            {
                let mut path = None;
                // Coba zenity --file-selection --save
                let zenity_res = std::process::Command::new("zenity")
                    .args([
                        "--file-selection",
                        "--save",
                        "--confirm-overwrite",
                        &format!("--filename={}", default_filename),
                        "--file-filter=Markdown (*.md) | *.md",
                        "--file-filter=Semua Berkas | *",
                        "--title=Simpan Berkas Ekspor",
                    ])
                    .output();

                if let Ok(out) = zenity_res {
                    if out.status.success() {
                        let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
                        if !p.is_empty() {
                            path = Some(p);
                        }
                    }
                }

                // Fallback kdialog untuk KDE
                if path.is_none() {
                    let kdialog_res = std::process::Command::new("kdialog")
                        .args([
                            "--getsavefilename",
                            &default_filename,
                            "*.md | Markdown (*.md)",
                            "--title",
                            "Simpan Berkas Ekspor",
                        ])
                        .output();

                    if let Ok(out) = kdialog_res {
                        if out.status.success() {
                            let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
                            if !p.is_empty() {
                                path = Some(p);
                            }
                        }
                    }
                }
                path
            }

            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                let script = format!(
                    r#"
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.SaveFileDialog
$dialog.Title = "Simpan Berkas Ekspor"
$dialog.Filter = "Markdown (*.md)|*.md|Semua Berkas (*.*)|*.*"
$dialog.FileName = "{}"
$dialog.OverwritePrompt = $true
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{
    Write-Output $dialog.SelectedPath
}}
"#,
                    default_filename.replace('"', "`\"")
                );

                let mut cmd = std::process::Command::new("powershell");
                cmd.args(["-NoProfile", "-Command", &script]);
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                let output = cmd.output();

                if let Ok(out) = output {
                    if out.status.success() {
                        let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
                        if !p.is_empty() {
                            Some(p)
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            }

            #[cfg(not(any(target_os = "linux", target_os = "windows")))]
            {
                None
            }
        };

        if let Some(target_file) = selected_path {
            let mut final_path = std::path::PathBuf::from(&target_file);
            if final_path.extension().is_none() {
                final_path.set_extension("md");
            }
            std::fs::write(&final_path, content.as_bytes())
                .map_err(|e| format!("Gagal menulis berkas ekspor: {}", e))?;
            Ok(Some(final_path.to_string_lossy().to_string()))
        } else {
            Ok(None)
        }
    })
    .await
    .map_err(|e| format!("Gagal menjalankan dialog simpan berkas: {}", e))?
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PickedNativeFile {
    pub id: String,
    pub name: String,
    pub size: u64,
    #[serde(rename = "type")]
    pub file_type: String,
    pub content: String,
    #[serde(rename = "isImage")]
    pub is_image: bool,
}

pub fn encode_base64_simple(bytes: &[u8]) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        out.push(CHARSET[(b0 >> 2) as usize] as char);
        out.push(CHARSET[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);

        if chunk.len() > 1 {
            out.push(CHARSET[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            out.push('=');
        }

        if chunk.len() > 2 {
            out.push(CHARSET[(b2 & 0x3f) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

pub fn read_picked_files_to_payload(paths: Vec<String>) -> Vec<PickedNativeFile> {
    let mut results = Vec::new();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    for (idx, path_str) in paths.into_iter().enumerate() {
        let path = std::path::Path::new(&path_str);
        if !path.is_file() {
            continue;
        }

        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unnamed_file".to_string());

        let size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);

        let ext = path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        let is_image = matches!(
            ext.as_str(),
            "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "ico"
        );

        let mime = match ext.as_str() {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "svg" => "image/svg+xml",
            "bmp" => "image/bmp",
            "ico" => "image/x-icon",
            "json" => "application/json",
            "js" => "application/javascript",
            "ts" | "tsx" => "application/typescript",
            "html" | "htm" => "text/html",
            "css" => "text/css",
            "md" | "markdown" => "text/markdown",
            "txt" => "text/plain",
            "rs" => "text/rust",
            "py" => "text/python",
            "sh" | "bash" => "text/x-shellscript",
            "sql" => "text/sql",
            "yaml" | "yml" => "text/yaml",
            _ => {
                if is_image {
                    "image/png"
                } else {
                    "text/plain"
                }
            }
        };

        let content = if size > 30 * 1024 * 1024 {
            format!(
                "[Peringatan: Berkas \"{}\" berukuran {:.1} MB, melebihi batas aman 30 MB. Lampirkan berkas yang lebih ringkas.]",
                name,
                size as f64 / (1024.0 * 1024.0)
            )
        } else if is_image {
            match std::fs::read(path) {
                Ok(bytes) => format!("data:{};base64,{}", mime, encode_base64_simple(&bytes)),
                Err(_) => String::new(),
            }
        } else {
            // Coba baca sebagai teks UTF-8
            match std::fs::read_to_string(path) {
                Ok(text) => text,
                Err(_) => {
                    // Fallback berkas biner ke Base64 dataURL
                    match std::fs::read(path) {
                        Ok(bytes) => {
                            let binary_mime = if ext == "pdf" {
                                "application/pdf"
                            } else {
                                "application/octet-stream"
                            };
                            format!("data:{};base64,{}", binary_mime, encode_base64_simple(&bytes))
                        }
                        Err(_) => String::new(),
                    }
                }
            }
        };

        results.push(PickedNativeFile {
            id: format!("file-{}-{}-{}", now, idx, Uuid::new_v4().simple()),
            name,
            size,
            file_type: mime.to_string(),
            content,
            is_image,
        });
    }

    results
}

#[tauri::command]
pub async fn pick_files_native() -> Result<Vec<PickedNativeFile>, String> {
    tokio::task::spawn_blocking(move || {
        let selected_paths: Vec<String> = {
            #[cfg(target_os = "linux")]
            {
                let mut paths = Vec::new();
                // 1. Coba zenity --file-selection --multiple --separator="|"
                let zenity_res = std::process::Command::new("zenity")
                    .args([
                        "--file-selection",
                        "--multiple",
                        "--separator=|",
                        "--file-filter=Semua Berkas | *",
                        "--file-filter=Dokumen & Kode | *.txt *.md *.json *.py *.rs *.ts *.tsx *.js *.html *.css *.yaml *.yml *.sh *.sql",
                        "--file-filter=Gambar | *.png *.jpg *.jpeg *.gif *.webp *.svg",
                        "--title=Pilih Berkas untuk Dilampirkan",
                    ])
                    .output();

                if let Ok(out) = zenity_res {
                    if out.status.success() {
                        let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
                        if !stdout.is_empty() {
                            for p in stdout.split('|') {
                                let trimmed = p.trim();
                                if !trimmed.is_empty() {
                                    paths.push(trimmed.to_string());
                                }
                            }
                            return Ok(read_picked_files_to_payload(paths));
                        }
                    }
                    return Ok(Vec::new());
                }

                // 2. Fallback kdialog untuk lingkungan KDE
                let kdialog_res = std::process::Command::new("kdialog")
                    .args([
                        "--getopenfilename",
                        "--multiple",
                        "--separate-output",
                        ".",
                        "*",
                    ])
                    .output();

                if let Ok(out) = kdialog_res {
                    if out.status.success() {
                        let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
                        if !stdout.is_empty() {
                            for line in stdout.lines() {
                                let trimmed = line.trim();
                                if !trimmed.is_empty() {
                                    paths.push(trimmed.to_string());
                                }
                            }
                            return Ok(read_picked_files_to_payload(paths));
                        }
                    }
                    return Ok(Vec::new());
                }

                paths
            }

            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                let script = r#"
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Multiselect = $true
$dialog.Title = "Pilih Berkas untuk Dilampirkan"
$dialog.Filter = "Semua Berkas (*.*)|*.*|Dokumen & Kode (*.txt;*.md;*.json;*.py;*.rs;*.ts;*.js)|*.txt;*.md;*.json;*.py;*.rs;*.ts;*.js|Gambar (*.png;*.jpg;*.jpeg;*.gif;*.webp)|*.png;*.jpg;*.jpeg;*.gif;*.webp"
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    $dialog.FileNames | ForEach-Object { Write-Output $_ }
}
"#;
                let mut cmd = std::process::Command::new("powershell");
                cmd.args(["-NoProfile", "-Command", script]);
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                let mut paths = Vec::new();
                if let Ok(out) = cmd.output() {
                    if out.status.success() {
                        let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
                        for line in stdout.lines() {
                            let trimmed = line.trim();
                            if !trimmed.is_empty() {
                                paths.push(trimmed.to_string());
                            }
                        }
                    }
                }
                paths
            }

            #[cfg(not(any(target_os = "linux", target_os = "windows")))]
            {
                Vec::new()
            }
        };

        Ok(read_picked_files_to_payload(selected_paths))
    })
    .await
    .map_err(|e| format!("Gagal menjalankan dialog pemilih berkas: {}", e))?
}

#[tauri::command]
pub async fn perform_web_search(
    query: String,
    max_chars: Option<usize>,
) -> Result<String, String> {
    crate::engine::web_search::execute_all_in_one_search(&query, max_chars).await
}

#[tauri::command]
pub async fn run_terminal_command_stream(
    app: AppHandle,
    state: State<'_, AppState>,
    tab_id: String,
    command: String,
) -> Result<(), String> {
    let ws = state.tool_runner.workspace_root();
    let processes = state.active_terminal_processes.clone();
    let tab_id_for_task = tab_id.clone();

    let mut child = Command::new("bash")
        .arg("-c")
        .arg(&command)
        .current_dir(&ws)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Gagal menjalankan proses bash: {}", e))?;

    let pid = child.id();
    {
        let mut lock = processes.lock().unwrap();
        lock.insert(tab_id.clone(), pid);
    }

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Stream stdout realtime per baris
    let app_stdout = app.clone();
    let tab_id_stdout = tab_id.clone();
    if let Some(pipe) = stdout {
        std::thread::spawn(move || {
            let reader = BufReader::new(pipe);
            for line_res in reader.lines() {
                if let Ok(line) = line_res {
                    app_stdout
                        .emit(
                            "terminal-stream-data",
                            TerminalStreamData {
                                tab_id: tab_id_stdout.clone(),
                                line,
                                is_stderr: false,
                            },
                        )
                        .ok();
                }
            }
        });
    }

    // Stream stderr realtime per baris
    let app_stderr = app.clone();
    let tab_id_stderr = tab_id.clone();
    if let Some(pipe) = stderr {
        std::thread::spawn(move || {
            let reader = BufReader::new(pipe);
            for line_res in reader.lines() {
                if let Ok(line) = line_res {
                    app_stderr
                        .emit(
                            "terminal-stream-data",
                            TerminalStreamData {
                                tab_id: tab_id_stderr.clone(),
                                line,
                                is_stderr: true,
                            },
                        )
                        .ok();
                }
            }
        });
    }

    // Async task menunggu proses selesai
    tokio::task::spawn_blocking(move || {
        let status_res = child.wait();
        let exit_code = match status_res {
            Ok(status) => status.code().unwrap_or(0),
            Err(_) => -1,
        };

        {
            let mut lock = processes.lock().unwrap();
            lock.remove(&tab_id_for_task);
        }

        app.emit(
            "terminal-stream-done",
            TerminalStreamDone {
                tab_id: tab_id_for_task,
                exit_code,
            },
        )
        .ok();
    });

    Ok(())
}

#[tauri::command]
pub async fn kill_terminal_command(
    state: State<'_, AppState>,
    tab_id: String,
) -> Result<bool, String> {
    let pid_opt = {
        let lock = state.active_terminal_processes.lock().unwrap();
        lock.get(&tab_id).copied()
    };

    if let Some(pid) = pid_opt {
        #[cfg(unix)]
        {
            let _ = Command::new("kill")
                .arg("-TERM")
                .arg(pid.to_string())
                .output();
        }
        #[cfg(windows)]
        {
            let _ = Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .output();
        }

        let mut lock = state.active_terminal_processes.lock().unwrap();
        lock.remove(&tab_id);
        return Ok(true);
    }

    Ok(false)
}

#[derive(Clone, Serialize, Deserialize)]
pub struct TerminalPtyData {
    pub tab_id: String,
    pub data: String,
}

#[tauri::command]
pub async fn init_terminal_pty(
    app: AppHandle,
    state: State<'_, AppState>,
    tab_id: String,
    rows: u16,
    cols: u16,
    cwd: Option<String>,
) -> Result<(), String> {
    // 1. Cek apakah sesi PTY sudah aktif untuk tab_id ini (idempotent)
    {
        let sessions = state.pty_sessions.lock().unwrap();
        if let Some(session) = sessions.get(&tab_id) {
            // Sesi sudah berjalan, lakukan resize master jika diperlukan
            if let Ok(master) = session.master.lock() {
                let _ = master.resize(PtySize {
                    rows: rows.max(10),
                    cols: cols.max(20),
                    pixel_width: 0,
                    pixel_height: 0,
                });
            }
            return Ok(());
        }
    }

    let ws = match &cwd {
        Some(custom_dir) if !custom_dir.trim().is_empty() => {
            let p = std::path::PathBuf::from(custom_dir);
            if p.exists() {
                p
            } else {
                state.tool_runner.workspace_root()
            }
        }
        _ => state.tool_runner.workspace_root(),
    };

    let final_ws = if !ws.as_os_str().is_empty() && ws.exists() {
        ws
    } else {
        std::env::var("HOME")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("/")))
    };
    let pty_system = native_pty_system();

    let pty_pair = pty_system
        .openpty(PtySize {
            rows: rows.max(10),
            cols: cols.max(20),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Gagal inisialisasi PTY: {}", e))?;

    let default_shell = if cfg!(windows) {
        "powershell.exe".to_string()
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    };

    let mut cmd = CommandBuilder::new(default_shell.clone());
    if final_ws.exists() {
        cmd.cwd(&final_ws);
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("AGENTIC_HOOK_PORT", state.hook_server.port.to_string());
    cmd.env("AGENTIC_HOOK_TOKEN", &state.hook_server.token);
    cmd.env("AGENTIC_PANE_KEY", &tab_id);
    cmd.env("ORCA_AGENT_HOOK_PORT", state.hook_server.port.to_string());
    cmd.env("ORCA_AGENT_HOOK_TOKEN", &state.hook_server.token);
    cmd.env("ORCA_PANE_KEY", &tab_id);

    // Pastikan path CLI agent (.local/bin, .cargo/bin, .opencode/bin, dsb) tersedia di PTY
    if !cfg!(windows) {
        let current_path = std::env::var("PATH").unwrap_or_default();
        let home = std::env::var("HOME").unwrap_or_default();
        let mut extra_dirs = Vec::new();
        if !home.is_empty() {
            extra_dirs.push(format!("{}/.local/bin", home));
            extra_dirs.push(format!("{}/.cargo/bin", home));
            extra_dirs.push(format!("{}/.opencode/bin", home));
            extra_dirs.push(format!("{}/bin", home));

            let nvm_dir = std::path::PathBuf::from(&home).join(".nvm/versions/node");
            if let Ok(entries) = std::fs::read_dir(nvm_dir) {
                for entry in entries.flatten() {
                    let bin_path = entry.path().join("bin");
                    if bin_path.is_dir() {
                        extra_dirs.push(bin_path.to_string_lossy().to_string());
                    }
                }
            }
        }
        if !extra_dirs.is_empty() {
            let combined = format!("{}:{}", extra_dirs.join(":"), current_path);
            cmd.env("PATH", combined);
        }
    }

    if !cfg!(windows) && default_shell.ends_with("bash") {
        cmd.arg("-i");
    }

    let _child = pty_pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Gagal menjalankan shell di PTY: {}", e))?;

    let reader = pty_pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Gagal membuka PTY reader: {}", e))?;
    let writer = pty_pair
        .master
        .take_writer()
        .map_err(|e| format!("Gagal membuka PTY writer: {}", e))?;

    let app_clone = app.clone();
    let tab_id_clone = tab_id.clone();

    // Background thread membaca stdout PTY dan mengirim event ke frontend
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut r = reader;
        while let Ok(n) = std::io::Read::read(&mut r, &mut buf) {
            if n == 0 {
                break;
            }
            let text = String::from_utf8_lossy(&buf[..n]).to_string();
            // Emit ke channel khusus sesi
            let channel_event = format!("terminal-output-{}", tab_id_clone);
            app_clone.emit(&channel_event, text.clone()).ok();

            // Emit ke listener global kompatibilitas
            app_clone
                .emit(
                    "terminal-pty-data",
                    TerminalPtyData {
                        tab_id: tab_id_clone.clone(),
                        data: text,
                    },
                )
                .ok();
        }
    });

    {
        let mut sessions = state.pty_sessions.lock().unwrap();
        sessions.insert(
            tab_id,
            PtySession {
                writer: Arc::new(Mutex::new(writer)),
                master: Arc::new(Mutex::new(pty_pair.master)),
            },
        );
    }

    Ok(())
}

#[tauri::command]
pub async fn terminal_pty_write(
    state: State<'_, AppState>,
    tab_id: String,
    data: String,
) -> Result<(), String> {
    let writer_arc = {
        let sessions = state.pty_sessions.lock().unwrap();
        sessions.get(&tab_id).map(|s| s.writer.clone())
    };

    if let Some(writer) = writer_arc {
        let mut w = writer.lock().unwrap();
        w.write_all(data.as_bytes())
            .map_err(|e| format!("Gagal menulis data ke PTY: {}", e))?;
        w.flush()
            .map_err(|e| format!("Gagal flush PTY writer: {}", e))?;
        return Ok(());
    }

    Err(format!("Sesi PTY tidak ditemukan untuk tab {}", tab_id))
}

#[tauri::command]
pub async fn terminal_pty_resize(
    state: State<'_, AppState>,
    tab_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let master_arc = {
        let sessions = state.pty_sessions.lock().unwrap();
        sessions.get(&tab_id).map(|s| s.master.clone())
    };

    if let Some(master) = master_arc {
        let m = master.lock().unwrap();
        m.resize(PtySize {
            rows: rows.max(5),
            cols: cols.max(10),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Gagal resize PTY: {}", e))?;
        return Ok(());
    }

    Ok(())
}

#[tauri::command]
pub async fn close_terminal_pty(
    state: State<'_, AppState>,
    tab_id: String,
) -> Result<bool, String> {
    let mut sessions = state.pty_sessions.lock().unwrap();
    let removed = sessions.remove(&tab_id).is_some();
    Ok(removed)
}

static PREVENT_SLEEP_ENABLED: AtomicBool = AtomicBool::new(false);
static PREVENT_SLEEP_PROCESS: Mutex<Option<std::process::Child>> = Mutex::new(None);

#[tauri::command]
pub async fn set_prevent_sleep(enabled: bool) -> Result<(), String> {
    let mut lock = PREVENT_SLEEP_PROCESS
        .lock()
        .map_err(|e| format!("Failed to acquire sleep prevention lock: {}", e))?;

    if enabled {
        if PREVENT_SLEEP_ENABLED.load(Ordering::SeqCst) {
            if let Some(ref mut child) = *lock {
                if let Ok(None) = child.try_wait() {
                    return Ok(());
                }
            }
        }

        #[cfg(target_os = "linux")]
        {
            let spawn_result = Command::new("systemd-inhibit")
                .args([
                    "--what=idle:sleep",
                    "--who=Agentic Native Hub",
                    "--why=Prevent sleep during background execution",
                    "--mode=block",
                    "sleep",
                    "infinity",
                ])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn();

            match spawn_result {
                Ok(child) => {
                    if let Some(mut old_child) = lock.take() {
                        let _ = old_child.kill();
                        let _ = old_child.wait();
                    }
                    *lock = Some(child);
                    PREVENT_SLEEP_ENABLED.store(true, Ordering::SeqCst);
                    log::info!("Sleep prevention enabled via systemd-inhibit");
                }
                Err(e) => {
                    log::warn!(
                        "systemd-inhibit spawn failed ({}), setting fallback flag",
                        e
                    );
                    PREVENT_SLEEP_ENABLED.store(true, Ordering::SeqCst);
                }
            }
        }

        #[cfg(not(target_os = "linux"))]
        {
            PREVENT_SLEEP_ENABLED.store(true, Ordering::SeqCst);
            log::info!("Sleep prevention enabled");
        }

        Ok(())
    } else {
        if let Some(mut child) = lock.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        PREVENT_SLEEP_ENABLED.store(false, Ordering::SeqCst);
        log::info!("Sleep prevention disabled");
        Ok(())
    }
}

#[tauri::command]
pub async fn send_desktop_notification(title: String, body: String) -> Result<(), String> {
    if title.trim().is_empty() && body.trim().is_empty() {
        return Err("Notification title and body cannot both be empty".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        let status = Command::new("notify-send")
            .arg("-a")
            .arg("Agentic Native Hub")
            .arg(&title)
            .arg(&body)
            .status();

        match status {
            Ok(s) if s.success() => {
                log::info!("Desktop notification delivered: {}", title);
                Ok(())
            }
            _ => {
                let fallback_status = Command::new("notify-send")
                    .arg(&title)
                    .arg(&body)
                    .status()
                    .map_err(|e| format!("Failed to execute notify-send: {}", e))?;

                if fallback_status.success() {
                    log::info!("Desktop notification delivered via fallback: {}", title);
                    Ok(())
                } else {
                    Err(format!(
                        "notify-send exited with status code: {:?}",
                        fallback_status.code()
                    ))
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let escaped_title = title.replace('\'', "''");
        let escaped_body = body.replace('\'', "''");
        let ps_command = format!(
            "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; \
             [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null; \
             $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); \
             $text = $xml.GetElementsByTagName('text'); \
             $text[0].AppendChild($xml.CreateTextNode('{}')) | Out-Null; \
             $text[1].AppendChild($xml.CreateTextNode('{}')) | Out-Null; \
             $toast = [Windows.UI.Notifications.ToastNotification]::new($xml); \
             [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Agentic Native Hub').Show($toast);",
            escaped_title,
            escaped_body
        );

        let _ = Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_command])
            .status();

        log::info!("Windows desktop notification triggered: {}", title);
        Ok(())
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        log::info!("Desktop notification (generic platform): {} - {}", title, body);
        Ok(())
    }
}

#[tauri::command]
pub async fn get_system_theme() -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        if let Ok(output) = Command::new("gsettings")
            .args(["get", "org.gnome.desktop.interface", "color-scheme"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
            if stdout.contains("dark") {
                return Ok("dark".to_string());
            }
            if stdout.contains("default") || stdout.contains("light") {
                if let Ok(gtk_out) = Command::new("gsettings")
                    .args(["get", "org.gnome.desktop.interface", "gtk-theme"])
                    .output()
                {
                    let gtk_str = String::from_utf8_lossy(&gtk_out.stdout).to_lowercase();
                    if gtk_str.contains("dark") {
                        return Ok("dark".to_string());
                    }
                }
                return Ok("light".to_string());
            }
        }

        if let Ok(output) = Command::new("dbus-send")
            .args([
                "--print-reply=literal",
                "--dest=org.freedesktop.portal.Desktop",
                "/org/freedesktop/portal/desktop",
                "org.freedesktop.portal.Settings.Read",
                "string:org.freedesktop.appearance",
                "string:color-scheme",
            ])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains("uint32 1") {
                return Ok("dark".to_string());
            } else if stdout.contains("uint32 2") {
                return Ok("light".to_string());
            }
        }

        Ok("dark".to_string())
    }

    #[cfg(target_os = "windows")]
    {
        let output = Command::new("reg")
            .args([
                "query",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
                "/v",
                "AppsUseLightTheme",
            ])
            .output();

        if let Ok(out) = output {
            let s = String::from_utf8_lossy(&out.stdout);
            if s.contains("0x0") {
                return Ok("dark".to_string());
            } else if s.contains("0x1") {
                return Ok("light".to_string());
            }
        }
        Ok("dark".to_string())
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        Ok("dark".to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredSkillInfo {
    pub name: String,
    pub description: String,
    pub path: String,
    pub has_skill_file: bool,
    pub content_preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledSkillResult {
    pub id: String,
    pub name: String,
    pub description: String,
    pub location: String,
    pub path: String,
    pub content: String,
    pub installed_at: String,
}

fn parse_skill_metadata(dir: &std::path::Path) -> Option<DiscoveredSkillInfo> {
    let skill_files = ["SKILL.md", "skill.md", "Skill.md", "README.md"];
    let mut found_file = None;
    for fname in skill_files {
        let candidate = dir.join(fname);
        if candidate.is_file() {
            found_file = Some(candidate);
            break;
        }
    }

    let file_path = found_file?;
    let content = std::fs::read_to_string(&file_path).ok()?;

    let mut name = String::new();
    let mut description = String::new();

    // Check YAML frontmatter: between --- and ---
    let trimmed = content.trim_start();
    if trimmed.starts_with("---") {
        let rest = &trimmed[3..];
        if let Some(end_idx) = rest.find("---") {
            let frontmatter = &rest[..end_idx];
            for line in frontmatter.lines() {
                let line_trimmed = line.trim();
                if line_trimmed.to_lowercase().starts_with("name:") {
                    name = line_trimmed[5..].trim().trim_matches('"').trim_matches('\'').to_string();
                } else if line_trimmed.to_lowercase().starts_with("description:") {
                    description = line_trimmed[12..].trim().trim_matches('"').trim_matches('\'').to_string();
                }
            }
        }
    }

    // Fallback name: first markdown # Header
    if name.is_empty() {
        for line in content.lines() {
            let line_trimmed = line.trim();
            if line_trimmed.starts_with("# ") {
                name = line_trimmed[2..].trim().to_string();
                break;
            }
        }
    }

    // Fallback to directory name
    if name.is_empty() {
        if let Some(folder_name) = dir.file_name().and_then(|f| f.to_str()) {
            name = folder_name.replace('-', " ").replace('_', " ");
        } else {
            name = "Custom Local Skill".to_string();
        }
    }

    // Fallback description: first non-header non-empty line
    if description.is_empty() {
        for line in content.lines() {
            let line_trimmed = line.trim();
            if !line_trimmed.is_empty() && !line_trimmed.starts_with('#') && !line_trimmed.starts_with("---") {
                let end = line_trimmed.len().min(140);
                description = line_trimmed[..end].to_string();
                if line_trimmed.len() > 140 {
                    description.push_str("...");
                }
                break;
            }
        }
    }

    if description.is_empty() {
        description = "Instruksi skill diimpor dari direktori lokal.".to_string();
    }

    let preview = if content.len() > 300 {
        format!("{}...", &content[..300])
    } else {
        content.clone()
    };

    Some(DiscoveredSkillInfo {
        name,
        description,
        path: dir.to_string_lossy().to_string(),
        has_skill_file: true,
        content_preview: preview,
    })
}

fn copy_dir_all(src: impl AsRef<std::path::Path>, dst: impl AsRef<std::path::Path>) -> std::io::Result<()> {
    std::fs::create_dir_all(&dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            std::fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn pick_local_directory() -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(target_os = "linux")]
        {
            let output = std::process::Command::new("zenity")
                .args(["--file-selection", "--directory", "--title=Pilih Direktori Skill"])
                .output();

            if let Ok(out) = output {
                if out.status.success() {
                    let path_str = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if !path_str.is_empty() {
                        return Ok(Some(path_str));
                    }
                }
                return Ok(None);
            }

            let kdialog_output = std::process::Command::new("kdialog")
                .args(["--getexistingdirectory", "--title", "Pilih Direktori Skill"])
                .output();

            if let Ok(out) = kdialog_output {
                if out.status.success() {
                    let path_str = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if !path_str.is_empty() {
                        return Ok(Some(path_str));
                    }
                }
            }

            Ok(None)
        }

        #[cfg(not(target_os = "linux"))]
        {
            Ok(None)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn scan_local_skills_directory(
    directory_path: String,
) -> Result<Vec<DiscoveredSkillInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let p = std::path::Path::new(&directory_path);
        if !p.exists() || !p.is_dir() {
            return Err("Direktori tidak ditemukan atau bukan sebuah folder.".to_string());
        }

        let mut results = Vec::new();

        // 1. Cek apakah folder yang dipilih sendiri adalah folder skill
        if let Some(info) = parse_skill_metadata(p) {
            results.push(info);
            return Ok(results);
        }

        // 2. Jika bukan, pindai subdirektori level 1 di dalamnya
        let entries = std::fs::read_dir(p).map_err(|e| format!("Gagal membaca direktori: {}", e))?;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(info) = parse_skill_metadata(&path) {
                    results.push(info);
                }
            }
        }

        Ok(results)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn copy_skill_folder(
    state: State<'_, AppState>,
    source_path: String,
    target_location: String,
    custom_name: String,
    description: Option<String>,
) -> Result<InstalledSkillResult, String> {
    let workspace_root = state.tool_runner.workspace_root();
    tokio::task::spawn_blocking(move || {
        let src = std::path::Path::new(&source_path);
        if !src.exists() || !src.is_dir() {
            return Err(format!("Jalur sumber skill tidak valid: {}", source_path));
        }

        let safe_folder_name = custom_name
            .to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '-' })
            .collect::<String>()
            .split('-')
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join("-");

        let folder_name = if safe_folder_name.is_empty() {
            "custom-skill".to_string()
        } else {
            safe_folder_name
        };

        let target_dir = if target_location == "global" {
            let home = dirs::home_dir().ok_or_else(|| "Gagal mendapatkan home direktori pengguna.".to_string())?;
            home.join(".agentic").join("skills").join(&folder_name)
        } else {
            workspace_root.join("skills").join(&folder_name)
        };

        // Salin seluruh isi folder secara rekursif
        copy_dir_all(src, &target_dir).map_err(|e| format!("Gagal menyalin folder skill: {}", e))?;

        let skill_file_path = target_dir.join("SKILL.md");
        let desc = description.unwrap_or_else(|| "Skill lokal berhasil diimpor.".to_string());

        // Jika SKILL.md sudah ada, baca atau perbarui nama judulnya
        let final_content = if skill_file_path.exists() {
            let original_content = std::fs::read_to_string(&skill_file_path).unwrap_or_default();
            if !original_content.contains(&custom_name) {
                format!("# {}\n{}\n\n{}", custom_name, desc, original_content)
            } else {
                original_content
            }
        } else {
            format!("# {}\n{}\n\nInstruksi skill siap digunakan.", custom_name, desc)
        };

        let _ = std::fs::write(&skill_file_path, &final_content);

        let id = format!("skill-{}", chrono::Utc::now().timestamp_millis());

        Ok(InstalledSkillResult {
            id,
            name: custom_name,
            description: desc,
            location: target_location,
            path: skill_file_path.to_string_lossy().to_string(),
            content: final_content,
            installed_at: chrono::Utc::now().to_rfc3339(),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

// -------------------------------------------------------------
// Universal Context Vault Commands (Obsidian-Style)
// -------------------------------------------------------------

#[tauri::command]
pub fn get_vault_root(state: State<'_, AppState>) -> Result<String, String> {
    let root = state.vault.vault_root.read().map_err(|e| e.to_string())?;
    Ok(root.to_string_lossy().to_string())
}

#[tauri::command]
pub fn set_vault_root(
    state: State<'_, AppState>,
    app: AppHandle,
    path: String,
) -> Result<(), String> {
    let p = std::path::PathBuf::from(path);
    state.vault.set_root(p, Some(&app));
    Ok(())
}

#[tauri::command]
pub fn get_graph_snapshot(state: State<'_, AppState>) -> Result<crate::vault::GraphSnapshot, String> {
    let g = state.vault.graph.read().map_err(|e| e.to_string())?;
    Ok(g.get_snapshot())
}

#[tauri::command]
pub fn search_note_titles(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<String>, String> {
    let g = state.vault.graph.read().map_err(|e| e.to_string())?;
    let q = query.to_lowercase();
    let matches: Vec<String> = g.nodes.keys()
        .filter(|t| t.to_lowercase().contains(&q))
        .take(15)
        .cloned()
        .collect();
    Ok(matches)
}

#[tauri::command]
pub fn read_note(
    state: State<'_, AppState>,
    title: String,
) -> Result<(String, String), String> {
    let g = state.vault.graph.read().map_err(|e| e.to_string())?;
    let node = g.nodes.get(&title).ok_or("Note tidak ditemukan")?;
    let content = std::fs::read_to_string(&node.path).map_err(|e| e.to_string())?;
    let hash = crate::vault::VaultGraph::compute_hash(&content);
    Ok((content, hash))
}

#[tauri::command]
pub async fn create_note(
    state: State<'_, AppState>,
    app: AppHandle,
    agent_id: String,
    title: String,
    content: String,
) -> Result<(), String> {
    let root = state.vault.vault_root.read().map_err(|e| e.to_string())?.clone();
    let path = root.join(format!("{}.md", title));
    if path.exists() {
        return Err(format!("Note '{}' sudah ada. Gunakan edit_note jika ingin mengubahnya.", title));
    }
    std::fs::write(&path, &content).map_err(|e| e.to_string())?;

    state.vault.audit.append(crate::vault::AuditEntry {
        id: Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now().timestamp(),
        agent_id,
        action: "create".into(),
        note_title: title.clone(),
        previous_content: None,
        diff_summary: Some(format!("Dibuat dengan {} kata", content.split_whitespace().count())),
    });

    let node = crate::vault::VaultGraph::parse_note(&path);
    {
        let mut g = state.vault.graph.write().map_err(|e| e.to_string())?;
        g.upsert_note(node);
        g.index_version += 1;
    }

    let _ = app.emit("vault-index-updated", &title);
    Ok(())
}

#[tauri::command]
pub async fn edit_note(
    state: State<'_, AppState>,
    app: AppHandle,
    agent_id: String,
    title: String,
    new_content: String,
    expected_hash: String,
) -> Result<(), String> {
    let path = {
        let g = state.vault.graph.read().map_err(|e| e.to_string())?;
        g.nodes.get(&title).ok_or("Note tidak ditemukan")?.path.clone()
    };

    let lock = state.vault.locks.get_lock(&path);
    let _guard = lock.lock().await;

    let current_content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let current_hash = crate::vault::VaultGraph::compute_hash(&current_content);

    if current_hash != expected_hash {
        return Err(format!("Konflik: '{}' telah diubah pihak lain sejak terakhir dibaca. Silakan baca ulang sebelum mengedit.", title));
    }

    state.vault.audit.append(crate::vault::AuditEntry {
        id: Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now().timestamp(),
        agent_id,
        action: "edit".into(),
        note_title: title.clone(),
        previous_content: Some(current_content),
        diff_summary: Some(format!("Diperbarui menjadi {} kata", new_content.split_whitespace().count())),
    });

    std::fs::write(&path, &new_content).map_err(|e| e.to_string())?;

    let node = crate::vault::VaultGraph::parse_note(&path);
    {
        let mut g = state.vault.graph.write().map_err(|e| e.to_string())?;
        g.upsert_note(node);
        g.index_version += 1;
    }

    let _ = app.emit("vault-index-updated", &title);
    Ok(())
}

#[tauri::command]
pub fn request_delete_note(
    state: State<'_, AppState>,
    app: AppHandle,
    agent_id: String,
    note_title: String,
    reason: String,
) -> Result<String, String> {
    crate::vault::delete_requests::create_delete_request(
        &state.vault.delete_queue,
        &state.vault.graph,
        &app,
        agent_id,
        note_title,
        reason,
    )
}

#[tauri::command]
pub fn get_pending_delete_requests(
    state: State<'_, AppState>,
) -> Result<Vec<crate::vault::DeleteRequest>, String> {
    Ok(state.vault.delete_queue.list())
}

#[tauri::command]
pub async fn approve_delete_request(
    state: State<'_, AppState>,
    app: AppHandle,
    request_id: String,
) -> Result<(), String> {
    let root = state.vault.vault_root.read().map_err(|e| e.to_string())?.clone();
    crate::vault::delete_requests::execute_approve_delete(
        &state.vault.delete_queue,
        &state.vault.graph,
        &state.vault.locks,
        &state.vault.audit,
        &root,
        &app,
        &request_id,
    ).await
}

#[tauri::command]
pub fn reject_delete_request(
    state: State<'_, AppState>,
    app: AppHandle,
    request_id: String,
) -> Result<(), String> {
    crate::vault::delete_requests::execute_reject_delete(
        &state.vault.delete_queue,
        &state.vault.audit,
        &app,
        &request_id,
    )
}

#[tauri::command]
pub async fn batch_approve_delete_requests(
    state: State<'_, AppState>,
    app: AppHandle,
    request_ids: Vec<String>,
) -> Result<usize, String> {
    let root = state.vault.vault_root.read().map_err(|e| e.to_string())?.clone();
    let mut count = 0;
    for req_id in request_ids {
        if crate::vault::delete_requests::execute_approve_delete(
            &state.vault.delete_queue,
            &state.vault.graph,
            &state.vault.locks,
            &state.vault.audit,
            &root,
            &app,
            &req_id,
        ).await.is_ok() {
            count += 1;
        }
    }
    Ok(count)
}

#[tauri::command]
pub fn batch_reject_delete_requests(
    state: State<'_, AppState>,
    app: AppHandle,
    request_ids: Vec<String>,
) -> Result<usize, String> {
    let mut count = 0;
    for req_id in request_ids {
        if crate::vault::delete_requests::execute_reject_delete(
            &state.vault.delete_queue,
            &state.vault.audit,
            &app,
            &req_id,
        ).is_ok() {
            count += 1;
        }
    }
    Ok(count)
}

#[tauri::command]
pub fn list_trash_notes(state: State<'_, AppState>) -> Result<Vec<crate::vault::TrashItem>, String> {
    let root = state.vault.vault_root.read().map_err(|e| e.to_string())?.clone();
    Ok(crate::vault::trash::list_trash_items(&root))
}

#[tauri::command]
pub fn restore_trash_note(
    state: State<'_, AppState>,
    app: AppHandle,
    file_name: String,
) -> Result<String, String> {
    let root = state.vault.vault_root.read().map_err(|e| e.to_string())?.clone();
    crate::vault::trash::restore_trash_item(
        &state.vault.graph,
        &state.vault.audit,
        &root,
        &app,
        &file_name,
    )
}

#[tauri::command]
pub fn purge_trash_note(
    state: State<'_, AppState>,
    file_name: String,
) -> Result<(), String> {
    let root = state.vault.vault_root.read().map_err(|e| e.to_string())?.clone();
    crate::vault::trash::purge_trash_item(
        &state.vault.audit,
        &root,
        &file_name,
    )
}

#[tauri::command]
pub fn get_vault_audit_log(
    state: State<'_, AppState>,
    limit: usize,
) -> Result<Vec<crate::vault::AuditEntry>, String> {
    Ok(state.vault.audit.get_entries(limit))
}

#[tauri::command]
pub fn search_notes_hybrid(
    state: State<'_, AppState>,
    query: String,
    limit: usize,
) -> Result<Vec<crate::vault::ScoredSearchResult>, String> {
    Ok(crate::vault::semantic::search_notes_hybrid(
        &state.vault.graph,
        &query,
        limit,
    ))
}

#[tauri::command]
pub async fn transcribe_offline_audio(
    audio_bytes: Vec<u8>,
    language: Option<String>,
    prefer_fast: Option<bool>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        crate::voice::transcribe_audio_bytes_with_options(
            &audio_bytes,
            language.as_deref(),
            prefer_fast.unwrap_or(false),
        )
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn get_offline_speech_status() -> Result<serde_json::Value, String> {
    Ok(crate::voice::get_offline_speech_status())
}

#[tauri::command]
pub async fn trigger_voice_model_download(app: tauri::AppHandle) -> Result<(), String> {
    crate::voice::downloader::start_model_download(Some(app));
    Ok(())
}

// ==========================================
// MCP (Model Context Protocol) IPC Commands
// ==========================================

#[tauri::command]
pub async fn mcp_list_servers(
    state: State<'_, AppState>,
) -> Result<Vec<crate::engine::mcp::McpServerConfig>, String> {
    Ok(state.mcp_manager.list_servers().await)
}

#[tauri::command]
pub async fn mcp_save_server(
    state: State<'_, AppState>,
    config: crate::engine::mcp::McpServerConfig,
) -> Result<(), String> {
    state.mcp_manager.save_server(config).await
}

#[tauri::command]
pub async fn mcp_delete_server(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    state.mcp_manager.delete_server(&id).await
}

#[tauri::command]
pub async fn mcp_toggle_server(
    state: State<'_, AppState>,
    id: String,
    is_active: bool,
) -> Result<(), String> {
    state.mcp_manager.toggle_server(&id, is_active).await
}

#[tauri::command]
pub async fn mcp_import_json_config(
    state: State<'_, AppState>,
    json_str: String,
) -> Result<usize, String> {
    state.mcp_manager.import_json_config(&json_str).await
}

#[tauri::command]
pub async fn mcp_list_active_tools(
    state: State<'_, AppState>,
) -> Result<Vec<crate::engine::mcp::McpToolInfo>, String> {
    Ok(state.mcp_manager.list_active_tools().await)
}

#[tauri::command]
pub async fn mcp_call_tool(
    state: State<'_, AppState>,
    namespaced_name: String,
    arguments: serde_json::Value,
) -> Result<String, String> {
    state.mcp_manager.call_tool(&namespaced_name, arguments).await
}

#[tauri::command]
pub async fn mcp_get_server_statuses(
    state: State<'_, AppState>,
) -> Result<Vec<crate::engine::mcp::McpServerStatus>, String> {
    Ok(state.mcp_manager.get_server_statuses().await)
}

#[tauri::command]
pub async fn mcp_connect_server(
    state: State<'_, AppState>,
    id: String,
) -> Result<Vec<crate::engine::mcp::McpToolInfo>, String> {
    state.mcp_manager.connect_server(&id).await
}

// ==========================================
// Git Version Control IPC Commands
// ==========================================

#[tauri::command]
pub async fn git_status(
    state: State<'_, AppState>,
) -> Result<crate::engine::git::GitStatusResponse, String> {
    let ws = state.tool_runner.workspace_root();
    tokio::task::spawn_blocking(move || {
        crate::engine::git::get_git_status(&ws).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn git_diff(
    state: State<'_, AppState>,
    file_path: Option<String>,
    staged: Option<bool>,
) -> Result<String, String> {
    let ws = state.tool_runner.workspace_root();
    tokio::task::spawn_blocking(move || {
        crate::engine::git::get_git_diff(&ws, file_path.as_deref(), staged.unwrap_or(false))
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn git_stage(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<(), String> {
    let ws = state.tool_runner.workspace_root();
    tokio::task::spawn_blocking(move || {
        crate::engine::git::git_stage_file(&ws, &file_path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn git_stage_all(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let ws = state.tool_runner.workspace_root();
    tokio::task::spawn_blocking(move || {
        crate::engine::git::git_stage_all(&ws).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn git_unstage(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<(), String> {
    let ws = state.tool_runner.workspace_root();
    tokio::task::spawn_blocking(move || {
        crate::engine::git::git_unstage_file(&ws, &file_path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn git_unstage_all(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let ws = state.tool_runner.workspace_root();
    tokio::task::spawn_blocking(move || {
        crate::engine::git::git_unstage_all(&ws).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn git_discard(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<(), String> {
    let ws = state.tool_runner.workspace_root();
    tokio::task::spawn_blocking(move || {
        crate::engine::git::git_discard_file(&ws, &file_path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn git_commit(
    state: State<'_, AppState>,
    message: String,
) -> Result<String, String> {
    let ws = state.tool_runner.workspace_root();
    tokio::task::spawn_blocking(move || {
        crate::engine::git::git_commit(&ws, &message).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn git_push(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let ws = state.tool_runner.workspace_root();
    tokio::task::spawn_blocking(move || {
        crate::engine::git::git_push(&ws).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn git_pull(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let ws = state.tool_runner.workspace_root();
    tokio::task::spawn_blocking(move || {
        crate::engine::git::git_pull(&ws).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn git_fetch(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let ws = state.tool_runner.workspace_root();
    tokio::task::spawn_blocking(move || {
        crate::engine::git::git_fetch(&ws).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn git_branches(
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let ws = state.tool_runner.workspace_root();
    tokio::task::spawn_blocking(move || {
        crate::engine::git::git_list_branches(&ws).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn git_checkout(
    state: State<'_, AppState>,
    branch: String,
) -> Result<(), String> {
    let ws = state.tool_runner.workspace_root();
    tokio::task::spawn_blocking(move || {
        crate::engine::git::git_checkout_branch(&ws, &branch).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn git_create_branch(
    state: State<'_, AppState>,
    branch_name: String,
) -> Result<(), String> {
    let ws = state.tool_runner.workspace_root();
    tokio::task::spawn_blocking(move || {
        crate::engine::git::git_create_branch(&ws, &branch_name).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

#[tauri::command]
pub async fn git_clone(
    state: State<'_, AppState>,
    repo_url: String,
    target_dir: String,
) -> Result<String, String> {
    let target = std::path::PathBuf::from(&target_dir);
    if is_system_root_or_home(&target) {
        return Err("Tidak dapat mengkloning langsung ke direktori root sistem atau direktori home.".to_string());
    }
    let target_clone = target.clone();
    tokio::task::spawn_blocking(move || {
        crate::engine::git::git_clone_repo(&target_clone, &repo_url).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))??;

    state.tool_runner.set_workspace_root(target.clone());
    Ok(target.to_string_lossy().to_string())
}

// ==========================================
// Terminal Agent Discovery & Orchestration
// ==========================================

#[tauri::command]
pub async fn detect_installed_cli_agents() -> Result<Vec<crate::engine::agent_discovery::CliAgentMetadata>, String> {
    tokio::task::spawn_blocking(|| {
        crate::engine::agent_discovery::detect_all_cli_agents()
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))
}

#[tauri::command]
pub async fn set_orchestrator_role(
    state: State<'_, AppState>,
    role_or_agent: String,
) -> Result<(), String> {
    state.terminal_orchestrator.set_orchestrator(&role_or_agent);
    Ok(())
}

#[tauri::command]
pub async fn get_orchestrator_role(
    state: State<'_, AppState>,
) -> Result<String, String> {
    Ok(state.terminal_orchestrator.get_orchestrator())
}

#[tauri::command]
pub async fn register_terminal_worker(
    state: State<'_, AppState>,
    worker_id: String,
    agent_id: String,
    tab_id: String,
    role: String,
    task_spec: String,
) -> Result<crate::engine::terminal_orchestration::WorkerSession, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let session = crate::engine::terminal_orchestration::WorkerSession {
        worker_id,
        agent_id,
        tab_id,
        role,
        task_spec,
        status: "idle".to_string(),
        created_at: now,
    };

    state.terminal_orchestrator.register_worker(session.clone());
    Ok(session)
}

#[tauri::command]
pub async fn update_terminal_worker_status(
    state: State<'_, AppState>,
    worker_id: String,
    status: String,
) -> Result<bool, String> {
    Ok(state.terminal_orchestrator.update_worker_status(&worker_id, &status))
}

#[tauri::command]
pub async fn stop_terminal_worker(
    state: State<'_, AppState>,
    worker_id: String,
    tab_id: Option<String>,
) -> Result<(), String> {
    if let Some(w) = state.terminal_orchestrator.remove_worker(&worker_id) {
        let target_tab = tab_id.unwrap_or(w.tab_id);
        let _ = close_terminal_pty(state, target_tab).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_all_terminal_workers(
    state: State<'_, AppState>,
) -> Result<Vec<crate::engine::terminal_orchestration::WorkerSession>, String> {
    Ok(state.terminal_orchestrator.get_all_workers())
}

#[tauri::command]
pub async fn emergency_stop_all_workers(
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.terminal_orchestrator.clear_all_workers();

    let mut pty_lock = state.pty_sessions.lock().unwrap();
    pty_lock.clear();

    let mut proc_lock = state.active_terminal_processes.lock().unwrap();
    for (_, pid) in proc_lock.iter() {
        #[cfg(unix)]
        {
            let _ = std::process::Command::new("kill")
                .arg("-KILL")
                .arg(pid.to_string())
                .output();
        }
        #[cfg(windows)]
        {
            let _ = std::process::Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .output();
        }
    }
    proc_lock.clear();

    Ok(())
}

#[tauri::command]
pub async fn send_inter_agent_message(
    app: AppHandle,
    state: State<'_, AppState>,
    run_id: String,
    sender: String,
    recipient: String,
    content: String,
) -> Result<crate::engine::terminal_orchestration::InterAgentMessage, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let msg = crate::engine::terminal_orchestration::InterAgentMessage {
        id: uuid::Uuid::new_v4().to_string(),
        run_id,
        sender,
        recipient,
        content,
        timestamp: now,
    };

    state.terminal_orchestrator.send_message(msg.clone());
    let _ = app.emit("inter-agent-message", &msg);
    Ok(msg)
}

#[tauri::command]
pub async fn get_inter_agent_messages(
    state: State<'_, AppState>,
    run_id: Option<String>,
    recipient: Option<String>,
) -> Result<Vec<crate::engine::terminal_orchestration::InterAgentMessage>, String> {
    Ok(state.terminal_orchestrator.get_messages(run_id.as_deref(), recipient.as_deref()))
}

#[tauri::command]
pub async fn create_task_worktree(
    state: State<'_, AppState>,
    task_id: String,
    task_title: String,
    branch_name: String,
    assigned_agent: String,
) -> Result<crate::engine::worktree::WorktreeSessionInfo, String> {
    let repo_root = state.tool_runner.workspace_root();
    crate::engine::worktree::WorktreeManager::create_worktree(
        &repo_root,
        &task_id,
        &task_title,
        &branch_name,
        &assigned_agent,
    )
}

#[tauri::command]
pub async fn list_task_worktrees(
    state: State<'_, AppState>,
) -> Result<Vec<crate::engine::worktree::WorktreeSessionInfo>, String> {
    let repo_root = state.tool_runner.workspace_root();
    crate::engine::worktree::WorktreeManager::list_worktrees(&repo_root)
}

#[tauri::command]
pub async fn remove_task_worktree(
    state: State<'_, AppState>,
    worktree_path: String,
    force: Option<bool>,
) -> Result<(), String> {
    let repo_root = state.tool_runner.workspace_root();
    let wt_path = std::path::Path::new(&worktree_path);
    crate::engine::worktree::WorktreeManager::remove_worktree(&repo_root, wt_path, force.unwrap_or(true))
}

#[tauri::command]
pub async fn merge_task_worktree(
    state: State<'_, AppState>,
    branch_name: String,
) -> Result<String, String> {
    let repo_root = state.tool_runner.workspace_root();
    crate::engine::worktree::WorktreeManager::merge_worktree_branch(&repo_root, &branch_name)
}

#[tauri::command]
pub async fn get_hook_server_coords(
    state: State<'_, AppState>,
) -> Result<crate::engine::hook_server::HookServerCoords, String> {
    Ok(crate::engine::hook_server::HookServerCoords {
        port: state.hook_server.port,
        token: state.hook_server.token.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prevent_sleep_toggle() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        rt.block_on(async {
            let enable_res = set_prevent_sleep(true).await;
            assert!(enable_res.is_ok(), "Failed to enable prevent sleep");
            assert!(PREVENT_SLEEP_ENABLED.load(Ordering::SeqCst));

            let enable_again = set_prevent_sleep(true).await;
            assert!(enable_again.is_ok());
            assert!(PREVENT_SLEEP_ENABLED.load(Ordering::SeqCst));

            let disable_res = set_prevent_sleep(false).await;
            assert!(disable_res.is_ok(), "Failed to disable prevent sleep");
            assert!(!PREVENT_SLEEP_ENABLED.load(Ordering::SeqCst));

            let disable_again = set_prevent_sleep(false).await;
            assert!(disable_again.is_ok());
            assert!(!PREVENT_SLEEP_ENABLED.load(Ordering::SeqCst));
        });
    }

    #[test]
    fn test_send_desktop_notification_validation() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        rt.block_on(async {
            let empty_res = send_desktop_notification("".to_string(), "   ".to_string()).await;
            assert!(empty_res.is_err());

            let valid_res = send_desktop_notification(
                "Agentic Unit Test".to_string(),
                "Desktop notification test body".to_string(),
            )
            .await;
            assert!(valid_res.is_ok());
        });
    }

    #[test]
    fn test_get_system_theme() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        rt.block_on(async {
            let res = get_system_theme().await;
            assert!(res.is_ok());
            let theme = res.unwrap();
            assert!(theme == "dark" || theme == "light");
        });
    }

    #[test]
    fn test_offline_speech_status_ipc() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        rt.block_on(async {
            let res = get_offline_speech_status().await;
            assert!(res.is_ok());
            let val = res.unwrap();
            assert!(val.get("model_name").is_some());
        });
    }

    #[test]
    fn test_encode_base64_simple() {
        assert_eq!(encode_base64_simple(b""), "");
        assert_eq!(encode_base64_simple(b"f"), "Zg==");
        assert_eq!(encode_base64_simple(b"fo"), "Zm8=");
        assert_eq!(encode_base64_simple(b"foo"), "Zm9v");
        assert_eq!(encode_base64_simple(b"foob"), "Zm9vYg==");
        assert_eq!(encode_base64_simple(b"fooba"), "Zm9vYmE=");
        assert_eq!(encode_base64_simple(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn test_read_picked_files_to_payload() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_agentic_picked_file.txt");
        std::fs::write(&test_file, "Halo dunia dari file picker!").unwrap();

        let paths = vec![test_file.to_string_lossy().to_string()];
        let payloads = read_picked_files_to_payload(paths);

        assert_eq!(payloads.len(), 1);
        let first = &payloads[0];
        assert_eq!(first.name, "test_agentic_picked_file.txt");
        assert_eq!(first.file_type, "text/plain");
        assert!(!first.is_image);
        assert_eq!(first.content, "Halo dunia dari file picker!");
        assert!(first.size > 0);

        let _ = std::fs::remove_file(&test_file);
    }

    #[test]
    fn test_build_file_tree_recursive() {
        let temp_dir = std::env::temp_dir().join(format!("agentic_tree_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).unwrap();
        let sub_dir = temp_dir.join("subfolder");
        std::fs::create_dir_all(&sub_dir).unwrap();
        std::fs::write(temp_dir.join("root.txt"), "root").unwrap();
        std::fs::write(sub_dir.join("child.ts"), "const a = 1;").unwrap();

        let tree = build_file_tree_recursive(&temp_dir, &temp_dir, 1, 4);
        assert_eq!(tree.len(), 2); // subfolder and root.txt
        let folder_node = tree.iter().find(|n| n.is_dir).unwrap();
        assert_eq!(folder_node.name, "subfolder");
        assert!(folder_node.children.is_some());
        assert_eq!(folder_node.children.as_ref().unwrap().len(), 1);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_cli_agent_discovery() {
        let agents = crate::engine::agent_discovery::detect_all_cli_agents();
        assert!(!agents.is_empty(), "Known agent list should not be empty");

        // Verify known IDs exist in the manifest
        let ids: Vec<&str> = agents.iter().map(|a| a.id.as_str()).collect();
        assert!(ids.contains(&"claude"));
        assert!(ids.contains(&"agy"));
        assert!(ids.contains(&"omp"));
        assert!(ids.contains(&"opencode"));
        assert!(ids.contains(&"gemini"));
    }

    #[test]
    fn test_terminal_orchestration_state() {
        let state = crate::engine::terminal_orchestration::TerminalOrchestratorState::new();
        assert_eq!(state.get_orchestrator(), "api");

        state.set_orchestrator("claude");
        assert_eq!(state.get_orchestrator(), "claude");

        let worker = crate::engine::terminal_orchestration::WorkerSession {
            worker_id: "w-1".to_string(),
            agent_id: "agy".to_string(),
            tab_id: "tab-test".to_string(),
            role: "Coder".to_string(),
            task_spec: "Implement Rust tests".to_string(),
            status: "idle".to_string(),
            created_at: 1000,
        };

        state.register_worker(worker);
        let workers = state.get_all_workers();
        assert_eq!(workers.len(), 1);
        assert_eq!(workers[0].agent_id, "agy");

        let updated = state.update_worker_status("w-1", "working");
        assert!(updated);

        let msg = crate::engine::terminal_orchestration::InterAgentMessage {
            id: "msg-1".to_string(),
            run_id: "run-123".to_string(),
            sender: "claude".to_string(),
            recipient: "agy".to_string(),
            content: "Please write unit tests".to_string(),
            timestamp: 2000,
        };

        state.send_message(msg);
        let messages = state.get_messages(Some("run-123"), Some("agy"));
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].sender, "claude");

        state.clear_all_workers();
        assert!(state.get_all_workers().is_empty());
    }
}



