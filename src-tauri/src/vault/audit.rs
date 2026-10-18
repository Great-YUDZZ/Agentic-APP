use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: String,
    pub timestamp: i64,
    pub agent_id: String,
    pub action: String,
    pub note_title: String,
    pub previous_content: Option<String>,
    pub diff_summary: Option<String>,
}

pub struct AuditLog {
    log_path: PathBuf,
}

impl AuditLog {
    pub fn new(vault_root: &Path) -> Self {
        Self {
            log_path: vault_root.join(".audit.jsonl"),
        }
    }

    pub fn set_vault_root(&mut self, vault_root: &Path) {
        self.log_path = vault_root.join(".audit.jsonl");
    }

    pub fn append(&self, entry: AuditEntry) {
        if let Some(parent) = self.log_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_path)
        {
            if let Ok(json) = serde_json::to_string(&entry) {
                let _ = writeln!(file, "{}", json);
            }
        }
    }

    pub fn get_entries(&self, limit: usize) -> Vec<AuditEntry> {
        if !self.log_path.exists() {
            return Vec::new();
        }
        let file = match std::fs::File::open(&self.log_path) {
            Ok(f) => f,
            Err(_) => return Vec::new(),
        };

        let reader = BufReader::new(file);
        let mut entries = Vec::new();
        for line in reader.lines().map_while(Result::ok) {
            if let Ok(entry) = serde_json::from_str::<AuditEntry>(&line) {
                entries.push(entry);
            }
        }

        entries.reverse();
        if entries.len() > limit {
            entries.truncate(limit);
        }
        entries
    }
}
