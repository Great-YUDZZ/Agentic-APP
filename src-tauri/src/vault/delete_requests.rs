use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::RwLock;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::audit::{AuditEntry, AuditLog};
use super::graph::VaultGraph;
use super::lock_manager::LockManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteRequest {
    pub request_id: String,
    pub agent_id: String,
    pub note_title: String,
    pub reason: String,
    pub requested_at: i64,
    pub note_content_preview: String,
}

pub struct DeleteRequestQueue {
    pub pending: RwLock<HashMap<String, DeleteRequest>>,
}

impl DeleteRequestQueue {
    pub fn new() -> Self {
        Self {
            pending: RwLock::new(HashMap::new()),
        }
    }

    pub fn list(&self) -> Vec<DeleteRequest> {
        let queue = self.pending.read().unwrap();
        let mut list: Vec<DeleteRequest> = queue.values().cloned().collect();
        list.sort_by(|a, b| b.requested_at.cmp(&a.requested_at));
        list
    }
}

pub fn create_delete_request(
    queue: &DeleteRequestQueue,
    graph: &RwLock<VaultGraph>,
    app: &AppHandle,
    agent_id: String,
    note_title: String,
    reason: String,
) -> Result<String, String> {
    let preview = {
        let g = graph.read().unwrap();
        let node = g.nodes.get(&note_title).ok_or("Note tidak ditemukan")?;
        let content = std::fs::read_to_string(&node.path).unwrap_or_default();
        let preview_lines: Vec<&str> = content.lines().take(15).collect();
        preview_lines.join("\n")
    };

    let request = DeleteRequest {
        request_id: Uuid::new_v4().to_string(),
        agent_id,
        note_title,
        reason,
        requested_at: chrono::Utc::now().timestamp(),
        note_content_preview: preview,
    };

    let request_id = request.request_id.clone();
    queue
        .pending
        .write()
        .unwrap()
        .insert(request_id.clone(), request.clone());

    let _ = app.emit("delete-request-pending", &request);
    Ok(request_id)
}

pub async fn execute_approve_delete(
    queue: &DeleteRequestQueue,
    graph: &RwLock<VaultGraph>,
    locks: &LockManager,
    audit: &AuditLog,
    vault_root: &PathBuf,
    app: &AppHandle,
    request_id: &str,
) -> Result<(), String> {
    let request = queue
        .pending
        .write()
        .unwrap()
        .remove(request_id)
        .ok_or("Permintaan tidak ditemukan atau telah diproses sebelumnya")?;

    let path = {
        let g = graph.read().unwrap();
        g.nodes
            .get(&request.note_title)
            .ok_or("Note fisik tidak ditemukan di indeks")?
            .path
            .clone()
    };

    let lock = locks.get_lock(&path);
    let _guard = lock.lock().await;

    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;

    // Soft delete: pindahkan ke .trash/
    let trash_dir = vault_root.join(".trash");
    std::fs::create_dir_all(&trash_dir).map_err(|e| e.to_string())?;

    let timestamp = chrono::Utc::now().timestamp();
    let trash_filename = format!("{}__{}.md", request.note_title, timestamp);
    let trash_path = trash_dir.join(&trash_filename);
    std::fs::rename(&path, &trash_path).map_err(|e| e.to_string())?;

    audit.append(AuditEntry {
        id: Uuid::new_v4().to_string(),
        timestamp,
        agent_id: request.agent_id.clone(),
        action: format!("delete approved by user (alasan: {})", request.reason),
        note_title: request.note_title.clone(),
        previous_content: Some(content),
        diff_summary: Some(format!("Dipindahkan ke {}", trash_filename)),
    });

    {
        let mut g = graph.write().unwrap();
        g.remove_note(&request.note_title);
        g.index_version += 1;
    }

    let _ = app.emit("vault-index-updated", &request.note_title);
    let _ = app.emit("delete-request-resolved", request_id);
    Ok(())
}

pub fn execute_reject_delete(
    queue: &DeleteRequestQueue,
    audit: &AuditLog,
    app: &AppHandle,
    request_id: &str,
) -> Result<(), String> {
    let request = queue
        .pending
        .write()
        .unwrap()
        .remove(request_id)
        .ok_or("Permintaan tidak ditemukan atau telah diproses sebelumnya")?;

    audit.append(AuditEntry {
        id: Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now().timestamp(),
        agent_id: request.agent_id,
        action: "delete rejected by user".into(),
        note_title: request.note_title,
        previous_content: None,
        diff_summary: None,
    });

    let _ = app.emit("delete-request-resolved", request_id);
    Ok(())
}
