use notify::{Event, EventKind, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, Emitter};

use super::graph::VaultGraph;

pub fn start_vault_watcher(
    app: AppHandle,
    vault_root: Arc<RwLock<PathBuf>>,
    graph: Arc<RwLock<VaultGraph>>,
) {
    std::thread::spawn(move || {
        let root = match vault_root.read() {
            Ok(r) => r.clone(),
            Err(_) => return,
        };

        if !root.exists() {
            let _ = std::fs::create_dir_all(&root);
        }

        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = match notify::recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => {
                log::warn!("Failed to initialize vault file watcher: {}", e);
                return;
            }
        };

        if let Err(e) = watcher.watch(&root, RecursiveMode::Recursive) {
            log::warn!("Failed to watch vault directory {:?}: {}", root, e);
            return;
        }

        for res in rx {
            if let Ok(Event {
                kind,
                paths,
                ..
            }) = res
            {
                let mut changed = false;
                for path in paths {
                    // Abaikan folder internal .trash dan .audit.jsonl
                    let path_str = path.to_string_lossy();
                    if path_str.contains(".trash") || path_str.contains(".audit") {
                        continue;
                    }

                    if path.extension().map_or(false, |ext| ext == "md") {
                        match kind {
                            EventKind::Modify(_) | EventKind::Create(_) => {
                                if path.exists() {
                                    let node = VaultGraph::parse_note(&path);
                                    let title = node.title.clone();
                                    if let Ok(mut g) = graph.write() {
                                        g.upsert_note(node);
                                        g.index_version += 1;
                                    }
                                    let _ = app.emit("vault-index-updated", &title);
                                    changed = true;
                                }
                            }
                            EventKind::Remove(_) => {
                                let title = path
                                    .file_stem()
                                    .map(|s| s.to_string_lossy().to_string())
                                    .unwrap_or_default();
                                if !title.is_empty() {
                                    if let Ok(mut g) = graph.write() {
                                        g.remove_note(&title);
                                        g.index_version += 1;
                                    }
                                    let _ = app.emit("vault-index-updated", &title);
                                    changed = true;
                                }
                            }
                            _ => {}
                        }
                    }
                }

                if changed {
                    let _ = app.emit("vault-graph-changed", ());
                }
            }
        }
    });
}
