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
) -> Result<(), String> {
    let ws = state.tool_runner.workspace_root();
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
    cmd.cwd(ws);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
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

