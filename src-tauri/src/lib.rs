pub mod db;
pub mod engine;
pub mod ipc;
pub mod providers;

use db::Database;
use engine::orchestrator::AgentOrchestrator;
use engine::tools::ToolRunner;
use ipc::AppState;
use std::path::PathBuf;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let home = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let db_path = home.join("agentic_native_hub").join("agentic_hub.db");

    let db = Database::new(db_path).unwrap_or_else(|_| {
        Database::new_in_memory().expect("Failed to initialize fallback database")
    });

    let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let tool_runner = ToolRunner::new(current_dir);
    let orchestrator = Arc::new(AgentOrchestrator::new(db.clone(), tool_runner.clone()));

    let app_state = AppState {
        db,
        orchestrator,
        tool_runner,
        active_terminal_processes: Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
        pty_sessions: Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
    };

    tauri::Builder::<tauri::Wry>::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            ipc::save_api_key,
            ipc::get_api_keys,
            ipc::delete_api_key,
            ipc::test_provider,
            ipc::create_chat_session,
            ipc::get_chat_sessions,
            ipc::get_chat_messages,
            ipc::save_chat_message,
            ipc::delete_chat_session,
            ipc::update_chat_session_title,
            ipc::send_chat_message,
            ipc::start_build_session,
            ipc::get_build_agents,
            ipc::get_recent_logs,
            ipc::trigger_emergency_stop,
            ipc::resolve_tool_clearance,
            ipc::execute_sandbox_tool,
            ipc::pick_workspace_directory,
            ipc::set_workspace_directory,
            ipc::run_terminal_command_stream,
            ipc::kill_terminal_command,
            ipc::init_terminal_pty,
            ipc::terminal_pty_write,
            ipc::terminal_pty_resize,
            ipc::close_terminal_pty,
            ipc::set_prevent_sleep,
            ipc::send_desktop_notification,
            ipc::get_system_theme,
            ipc::pick_local_directory,
            ipc::scan_local_skills_directory,
            ipc::copy_skill_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
