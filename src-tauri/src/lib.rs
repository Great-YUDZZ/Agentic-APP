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
    let tool_runner = ToolRunner::new(current_dir.clone());
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
    };

    let v_state = vault.clone();

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
