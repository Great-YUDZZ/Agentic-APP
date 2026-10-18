pub mod audit;
pub mod delete_requests;
pub mod graph;
pub mod lock_manager;
pub mod semantic;
pub mod trash;
pub mod watcher;

use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, Emitter};

pub use audit::{AuditEntry, AuditLog};
pub use delete_requests::{DeleteRequest, DeleteRequestQueue};
pub use graph::{GraphSnapshot, NoteNode, VaultGraph};
pub use lock_manager::LockManager;
pub use semantic::ScoredSearchResult;
pub use trash::TrashItem;

#[derive(Clone)]
pub struct VaultState {
    pub graph: Arc<RwLock<VaultGraph>>,
    pub locks: Arc<LockManager>,
    pub audit: Arc<AuditLog>,
    pub delete_queue: Arc<DeleteRequestQueue>,
    pub vault_root: Arc<RwLock<PathBuf>>,
}

impl VaultState {
    pub fn new(root: PathBuf) -> Self {
        let audit = Arc::new(AuditLog::new(&root));
        let graph = Arc::new(RwLock::new(VaultGraph::new()));
        let locks = Arc::new(LockManager::new());
        let delete_queue = Arc::new(DeleteRequestQueue::new());
        let vault_root = Arc::new(RwLock::new(root));

        Self {
            graph,
            locks,
            audit,
            delete_queue,
            vault_root,
        }
    }

    pub fn set_root(&self, new_root: PathBuf, app: Option<&AppHandle>) {
        if let Ok(mut r) = self.vault_root.write() {
            *r = new_root.clone();
        }
        // Scan initial notes
        let mut new_graph = VaultGraph::new();
        if new_root.exists() {
            if let Ok(entries) = std::fs::read_dir(&new_root) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() && path.extension().map_or(false, |ext| ext == "md") {
                        let node = VaultGraph::parse_note(&path);
                        new_graph.upsert_note(node);
                    }
                }
            }
        }
        if let Ok(mut g) = self.graph.write() {
            *g = new_graph;
            g.index_version += 1;
        }

        if let Some(handle) = app {
            let _ = handle.emit("vault-index-updated", "all");
        }
    }
}
