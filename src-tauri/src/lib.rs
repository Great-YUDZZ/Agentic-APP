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
use tauri::Emitter;
use vault::VaultState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        // Cegah glitch ghosting, buffer tearing, dan tumpang tindih repaint pada WebKitGTK Linux Wayland
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    let home = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let is_beta = std::env::var("AGENTIC_BETA").unwrap_or_default() == "1"
        || std::env::current_exe()
            .map(|p| p.to_string_lossy().to_lowercase().contains("beta"))
            .unwrap_or(false);
    let app_dir_name = if is_beta { "agentic_native_hub_beta" } else { "agentic_native_hub" };
    let db_name = if is_beta { "agentic_hub_beta.db" } else { "agentic_hub.db" };
    let db_path = home.join(app_dir_name).join(db_name);

    let db = Database::new(db_path).unwrap_or_else(|_| {
        Database::new_in_memory().expect("Failed to initialize fallback database")
    });

    let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    // Jangan default ke direktori aplikasi demi keamanan data dan isolasi sesi
    let tool_runner = ToolRunner::new(PathBuf::from(""));
    let mcp_manager = Arc::new(engine::mcp::McpClientManager::new());
    tool_runner.set_mcp_manager(mcp_manager.clone());
    let orchestrator = Arc::new(AgentOrchestrator::new(db.clone(), tool_runner.clone()));

    let vault_dir = current_dir.join("vault");
    let vault = Arc::new(VaultState::new(vault_dir.clone()));
    vault.set_root(vault_dir, None);

    let hook_server = tauri::async_runtime::block_on(async {
        engine::hook_server::AgentHookServer::start().await
    }).expect("Failed to initialize loopback AgentHookServer");

    let app_state = AppState {
        db,
        orchestrator,
        tool_runner,
        active_terminal_processes: Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
        pty_sessions: Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
        vault: vault.clone(),
        mcp_manager: mcp_manager.clone(),
        terminal_orchestrator: Arc::new(engine::terminal_orchestration::TerminalOrchestratorState::new()),
        hook_server: hook_server.clone(),
    };

    let v_state = vault.clone();
    let mcp_runner = mcp_manager.clone();
    let hook_server_events = hook_server.clone();

    tauri::Builder::<tauri::Wry>::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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

            // Teruskan telemetri loopback hook server agen CLI ke frontend
            let app_hook_handle = app.handle().clone();
            let mut hook_rx = hook_server_events.event_sender.subscribe();
            tauri::async_runtime::spawn(async move {
                while let Ok(payload) = hook_rx.recv().await {
                    let _ = app_hook_handle.emit("agent-telemetry-event", &payload);
                }
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
            ipc::git_clone,
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
            ipc::detect_installed_cli_agents,
            ipc::set_orchestrator_role,
            ipc::get_orchestrator_role,
            ipc::register_terminal_worker,
            ipc::update_terminal_worker_status,
            ipc::stop_terminal_worker,
            ipc::get_all_terminal_workers,
            ipc::emergency_stop_all_workers,
            ipc::send_inter_agent_message,
            ipc::get_inter_agent_messages,
            ipc::create_task_worktree,
            ipc::list_task_worktrees,
            ipc::remove_task_worktree,
            ipc::merge_task_worktree,
            ipc::get_hook_server_coords,
            ipc::relaunch_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
