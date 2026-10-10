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
            ipc::send_chat_message,
            ipc::start_build_session,
            ipc::get_build_agents,
            ipc::get_recent_logs,
            ipc::trigger_emergency_stop,
            ipc::resolve_tool_clearance,
            ipc::execute_sandbox_tool,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
