pub mod db;
pub mod engine;
pub mod ipc;
pub mod providers;
pub mod vault;
pub mod voice;

use db::Database;
use engine::orchestrator::AgentOrchestrator;
use engine::tools::ToolRunner;
use ipc::AppState;
use std::path::PathBuf;
use std::sync::Arc;
use vault::VaultState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let home = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let db_path = home.join("agentic_native_hub").join("agentic_hub.db");

    let db = Database::new(db_path).unwrap_or_else(|_| {
        Database::new_in_memory().expect("Failed to initialize fallback database")
    });

    let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let initial_root = if ipc::is_system_root_or_home(&current_dir) {
        let agentic_dir = current_dir.join("Agentic");
        if agentic_dir.is_dir() {
            agentic_dir
        } else {
            PathBuf::from("")
        }
    } else {
        current_dir.clone()
    };
    let tool_runner = ToolRunner::new(initial_root);
    let mcp_manager = Arc::new(engine::mcp::McpClientManager::new());
    tool_runner.set_mcp_manager(mcp_manager.clone());
    let orchestrator = Arc::new(AgentOrchestrator::new(db.clone(), tool_runner.clone()));

    let vault_dir = current_dir.join("vault");
    let vault = Arc::new(VaultState::new(vault_dir.clone()));
    vault.set_root(vault_dir, None);

    let app_state = AppState {
        db,
        orchestrator,
        tool_runner,
        active_terminal_processes: Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
        pty_sessions: Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
        vault: vault.clone(),
        mcp_manager: mcp_manager.clone(),
    };

    let v_state = vault.clone();
    let mcp_runner = mcp_manager.clone();

    tauri::Builder::<tauri::Wry>::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .setup(move |app| {
            vault::watcher::start_vault_watcher(
                app.handle().clone(),
                v_state.vault_root.clone(),
                v_state.graph.clone(),
            );
            // Auto purge awal untuk berkas di atas 30 hari
            vault::trash::run_auto_purge_worker(
                v_state.audit.clone(),
                v_state.vault_root.clone(),
                30,
            );

            #[cfg(target_os = "linux")]
            {
                use tauri::Manager;
                use webkit2gtk::{PermissionRequestExt, SettingsExt, WebViewExt};

                for (_label, window) in app.webview_windows() {
                    let _ = window.with_webview(|webview| {
                        let wv = webview.inner();
                        if let Some(settings) = wv.settings() {
                            settings.set_enable_media_stream(true);
                            settings.set_enable_webrtc(true);
                        }
                        wv.connect_permission_request(|_wv, req| {
                            req.allow();
                            true
                        });
                    });
                }
            }

            // Download model speech-to-text akurasi tinggi di background saat pertama kali buka
            voice::downloader::start_model_download(Some(app.handle().clone()));

            // Hubungkan server-server MCP yang aktif secara asinkron di background
            tauri::async_runtime::spawn(async move {
                mcp_runner.auto_connect_all().await;
            });

            Ok(())
        })
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
            ipc::get_vault_root,
            ipc::set_vault_root,
            ipc::get_graph_snapshot,
            ipc::search_note_titles,
            ipc::read_note,
            ipc::create_note,
            ipc::edit_note,
            ipc::request_delete_note,
            ipc::get_pending_delete_requests,
            ipc::approve_delete_request,
            ipc::reject_delete_request,
            ipc::batch_approve_delete_requests,
            ipc::batch_reject_delete_requests,
            ipc::list_trash_notes,
            ipc::restore_trash_note,
            ipc::purge_trash_note,
            ipc::get_vault_audit_log,
            ipc::search_notes_hybrid,
            ipc::transcribe_offline_audio,
            ipc::get_offline_speech_status,
            ipc::trigger_voice_model_download,
            ipc::save_exported_file_dialog,
            ipc::perform_web_search,
            ipc::mcp_list_servers,
            ipc::mcp_save_server,
            ipc::mcp_delete_server,
            ipc::mcp_toggle_server,
            ipc::mcp_import_json_config,
            ipc::mcp_list_active_tools,
            ipc::mcp_call_tool,
            ipc::mcp_get_server_statuses,
            ipc::mcp_connect_server,
            ipc::git_status,
            ipc::git_diff,
            ipc::git_stage,
            ipc::git_stage_all,
            ipc::git_unstage,
            ipc::git_unstage_all,
            ipc::git_discard,
            ipc::git_commit,
            ipc::git_push,
            ipc::git_pull,
            ipc::git_fetch,
            ipc::git_branches,
            ipc::git_checkout,
            ipc::git_create_branch,
            ipc::pick_files_native,
            ipc::get_workspace_directory,
            ipc::read_workspace_file,
            ipc::write_workspace_file,
            ipc::get_workspace_file_tree,
            ipc::create_workspace_file,
            ipc::rename_workspace_file,
            ipc::delete_workspace_file,
            ipc::reveal_in_file_manager,
            ipc::query_codebase_context,
            ipc::search_workspace_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
