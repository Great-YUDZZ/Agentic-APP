use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::audit::{AuditEntry, AuditLog};
use super::graph::VaultGraph;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashItem {
    pub file_name: String,
    pub original_title: String,
    pub deleted_at: i64,
    pub size_bytes: u64,
}

pub fn list_trash_items(vault_root: &PathBuf) -> Vec<TrashItem> {
    let trash_dir = vault_root.join(".trash");
    if !trash_dir.exists() {
        return Vec::new();
    }

    let mut items = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&trash_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |ext| ext == "md") {
                let file_name = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();

                let stem = path
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();

                let (original_title, deleted_at) = if let Some(idx) = stem.rfind("__") {
                    let title = stem[..idx].to_string();
                    let ts = stem[idx + 2..].parse::<i64>().unwrap_or(0);
                    (title, ts)
                } else {
                    (stem, 0)
                };

                let size_bytes = path.metadata().map(|m| m.len()).unwrap_or(0);

                items.push(TrashItem {
                    file_name,
                    original_title,
                    deleted_at,
                    size_bytes,
                });
            }
        }
    }

    items.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at));
    items
}

pub fn restore_trash_item(
    graph: &RwLock<VaultGraph>,
    audit: &AuditLog,
    vault_root: &PathBuf,
    app: &AppHandle,
    file_name: &str,
) -> Result<String, String> {
    let trash_path = vault_root.join(".trash").join(file_name);
    if !trash_path.exists() {
        return Err("Berkas di tempat sampah tidak ditemukan".to_string());
    }

    let stem = trash_path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let original_title = if let Some(idx) = stem.rfind("__") {
        stem[..idx].to_string()
    } else {
        stem
    };

    // Resolusi benturan nama: cari nama yang belum ada
    let mut target_title = original_title.clone();
    let mut target_path = vault_root.join(format!("{}.md", target_title));
    let mut counter = 1;

    while target_path.exists() {
        target_title = if counter == 1 {
            format!("{} (Restored)", original_title)
        } else {
            format!("{} (Restored {})", original_title, counter)
        };
        target_path = vault_root.join(format!("{}.md", target_title));
        counter += 1;
    }

    std::fs::rename(&trash_path, &target_path).map_err(|e| e.to_string())?;

    audit.append(AuditEntry {
        id: Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now().timestamp(),
        agent_id: "user".to_string(),
        action: format!("restore note ke {}", target_title),
        note_title: target_title.clone(),
        previous_content: None,
        diff_summary: Some(format!("Dipulihkan dari {}", file_name)),
    });

    let node = VaultGraph::parse_note(&target_path);
    {
        let mut g = graph.write().unwrap();
        g.upsert_note(node);
        g.index_version += 1;
    }

    let _ = app.emit("vault-index-updated", &target_title);
    Ok(target_title)
}

pub fn purge_trash_item(
    audit: &AuditLog,
    vault_root: &PathBuf,
    file_name: &str,
) -> Result<(), String> {
    let trash_path = vault_root.join(".trash").join(file_name);
    if !trash_path.exists() {
        return Err("Berkas di tempat sampah tidak ditemukan".to_string());
    }

    std::fs::remove_file(&trash_path).map_err(|e| e.to_string())?;

    audit.append(AuditEntry {
        id: Uuid::new_v4().to_string(),
        timestamp: chrono::Utc::now().timestamp(),
        agent_id: "user".to_string(),
        action: "permanent purge".to_string(),
        note_title: file_name.to_string(),
        previous_content: None,
        diff_summary: Some("Dihapus permanen dari tempat sampah".to_string()),
    });

    Ok(())
}

pub fn run_auto_purge_worker(
    audit: Arc<AuditLog>,
    vault_root: Arc<RwLock<PathBuf>>,
    retention_days: u64,
) {
    if retention_days == 0 {
        return; // Auto-purge nonaktif
    }

    let root = match vault_root.read() {
        Ok(r) => r.clone(),
        Err(_) => return,
    };

    let trash_dir = root.join(".trash");
    if !trash_dir.exists() {
        return;
    }

    let cutoff_timestamp = chrono::Utc::now().timestamp() - (retention_days as i64 * 86400);

    if let Ok(entries) = std::fs::read_dir(&trash_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let stem = path
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();

                let deleted_at = if let Some(idx) = stem.rfind("__") {
                    stem[idx + 2..].parse::<i64>().unwrap_or(0)
                } else {
                    path.metadata()
                        .and_then(|m| m.modified())
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs() as i64)
                        .unwrap_or(0)
                };

                if deleted_at > 0 && deleted_at < cutoff_timestamp {
                    let file_name = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    if std::fs::remove_file(&path).is_ok() {
                        audit.append(AuditEntry {
                            id: Uuid::new_v4().to_string(),
                            timestamp: chrono::Utc::now().timestamp(),
                            agent_id: "system".to_string(),
                            action: "auto_purge".to_string(),
                            note_title: file_name,
                            previous_content: None,
                            diff_summary: Some(format!(
                                "Dibersihkan otomatis setelah {} hari retensi",
                                retention_days
                            )),
                        });
                    }
                }
            }
        }
    }
}
