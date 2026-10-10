use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyRecord {
    pub provider: String,
    pub api_key: String,
    pub base_url: Option<String>,
    pub is_active: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub title: String,
    pub model: String,
    pub provider: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub reasoning: Option<String>,
    pub token_count: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTask {
    pub id: String,
    pub session_id: String,
    pub title: String,
    pub status: String, // backlog, in_progress, in_review, done, failed
    pub assigned_agent: String,
    pub priority: String,
    pub progress: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentLog {
    pub id: String,
    pub agent_name: String,
    pub level: String, // INFO, EXEC, WARN, FAIL
    pub message: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolAuditRecord {
    pub id: String,
    pub tool_name: String,
    pub parameters: String,
    pub result: Option<String>,
    pub status: String, // pending, approved, rejected, executed, failed
    pub executed_at: String,
}

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let conn = Connection::open(db_path)?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.apply_migrations()?;
        Ok(db)
    }

    pub fn new_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.apply_migrations()?;
        Ok(db)
    }

    pub fn apply_migrations(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS api_keys (
                provider TEXT PRIMARY KEY,
                api_key TEXT NOT NULL,
                base_url TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                model TEXT NOT NULL,
                provider TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                reasoning TEXT,
                token_count INTEGER,
                created_at TEXT NOT NULL,
                FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS agent_tasks (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                title TEXT NOT NULL,
                status TEXT NOT NULL,
                assigned_agent TEXT NOT NULL,
                priority TEXT NOT NULL,
                progress INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS agent_logs (
                id TEXT PRIMARY KEY,
                agent_name TEXT NOT NULL,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tool_audits (
                id TEXT PRIMARY KEY,
                tool_name TEXT NOT NULL,
                parameters TEXT NOT NULL,
                result TEXT,
                status TEXT NOT NULL,
                executed_at TEXT NOT NULL
            );

            INSERT OR IGNORE INTO schema_migrations (version, applied_at)
            VALUES (1, datetime('now'));
            ",
        )?;
        Ok(())
    }

    // API Keys
    pub fn save_api_key(&self, record: &ApiKeyRecord) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO api_keys (provider, api_key, base_url, is_active, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                record.provider,
                record.api_key,
                record.base_url,
                record.is_active,
                record.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn get_api_keys(&self) -> Result<Vec<ApiKeyRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT provider, api_key, base_url, is_active, updated_at FROM api_keys")?;
        let rows = stmt.query_map(params![], |row| {
            Ok(ApiKeyRecord {
                provider: row.get(0)?,
                api_key: row.get(1)?,
                base_url: row.get(2)?,
                is_active: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;
        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn delete_api_key(&self, provider: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM api_keys WHERE provider = ?1", params![provider])?;
        Ok(())
    }

    // Sessions & Messages
    pub fn save_chat_session(&self, session: &ChatSession) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO chat_sessions (id, title, model, provider, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                session.id,
                session.title,
                session.model,
                session.provider,
                session.created_at,
                session.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn get_chat_sessions(&self) -> Result<Vec<ChatSession>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, title, model, provider, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC")?;
        let rows = stmt.query_map(params![], |row| {
            Ok(ChatSession {
                id: row.get(0)?,
                title: row.get(1)?,
                model: row.get(2)?,
                provider: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;
        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn save_chat_message(&self, message: &ChatMessage) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO chat_messages (id, session_id, role, content, reasoning, token_count, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                message.id,
                message.session_id,
                message.role,
                message.content,
                message.reasoning,
                message.token_count,
                message.created_at
            ],
        )?;
        Ok(())
    }

    pub fn get_chat_messages(&self, session_id: &str) -> Result<Vec<ChatMessage>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, session_id, role, content, reasoning, token_count, created_at FROM chat_messages WHERE session_id = ?1 ORDER BY created_at ASC")?;
        let rows = stmt.query_map(params![session_id], |row| {
            Ok(ChatMessage {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                reasoning: row.get(4)?,
                token_count: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;
        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    // Tasks & Logs
    pub fn save_agent_task(&self, task: &AgentTask) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO agent_tasks (id, session_id, title, status, assigned_agent, priority, progress, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                task.id,
                task.session_id,
                task.title,
                task.status,
                task.assigned_agent,
                task.priority,
                task.progress,
                task.created_at,
                task.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn get_agent_tasks(&self, session_id: &str) -> Result<Vec<AgentTask>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, session_id, title, status, assigned_agent, priority, progress, created_at, updated_at FROM agent_tasks WHERE session_id = ?1 ORDER BY created_at ASC")?;
        let rows = stmt.query_map(params![session_id], |row| {
            Ok(AgentTask {
                id: row.get(0)?,
                session_id: row.get(1)?,
                title: row.get(2)?,
                status: row.get(3)?,
                assigned_agent: row.get(4)?,
                priority: row.get(5)?,
                progress: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;
        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn save_agent_log(&self, log: &AgentLog) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO agent_logs (id, agent_name, level, message, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![log.id, log.agent_name, log.level, log.message, log.timestamp],
        )?;
        Ok(())
    }

    pub fn get_recent_logs(&self, limit: usize) -> Result<Vec<AgentLog>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, agent_name, level, message, timestamp FROM agent_logs ORDER BY timestamp DESC LIMIT ?1")?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(AgentLog {
                id: row.get(0)?,
                agent_name: row.get(1)?,
                level: row.get(2)?,
                message: row.get(3)?,
                timestamp: row.get(4)?,
            })
        })?;
        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        list.reverse();
        Ok(list)
    }

    // Tool Audits
    pub fn save_tool_audit(&self, audit: &ToolAuditRecord) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO tool_audits (id, tool_name, parameters, result, status, executed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                audit.id,
                audit.tool_name,
                audit.parameters,
                audit.result,
                audit.status,
                audit.executed_at
            ],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sqlite_api_key_crud() {
        let db = Database::new_in_memory().expect("Failed to create in-memory db");
        let record = ApiKeyRecord {
            provider: "gemini".to_string(),
            api_key: "ai-secret-key-123".to_string(),
            base_url: Some("https://example.com".to_string()),
            is_active: true,
            updated_at: "2026-10-10T12:00:00Z".to_string(),
        };

        // 1. Create / Save
        db.save_api_key(&record).expect("Failed to save api key");

        // 2. Read
        let keys = db.get_api_keys().expect("Failed to get api keys");
        assert_eq!(keys.len(), 1);
        assert_eq!(keys[0].provider, "gemini");
        assert_eq!(keys[0].api_key, "ai-secret-key-123");
        assert_eq!(keys[0].base_url, Some("https://example.com".to_string()));
        assert!(keys[0].is_active);

        // 3. Delete
        db.delete_api_key("gemini").expect("Failed to delete key");
        let keys_after = db.get_api_keys().expect("Failed to get api keys after delete");
        assert!(keys_after.is_empty());
    }

    #[test]
    fn test_sqlite_sessions_and_messages_crud() {
        let db = Database::new_in_memory().expect("Failed to create in-memory db");
        let session = ChatSession {
            id: "sess-100".to_string(),
            title: "Autonomous Agent Task".to_string(),
            model: "gemini-2.5-flash".to_string(),
            provider: "gemini".to_string(),
            created_at: "2026-10-10T10:00:00Z".to_string(),
            updated_at: "2026-10-10T10:00:00Z".to_string(),
        };

        db.save_chat_session(&session).expect("Failed to save session");
        let sessions = db.get_chat_sessions().expect("Failed to query sessions");
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, "sess-100");
        assert_eq!(sessions[0].title, "Autonomous Agent Task");

        let msg1 = ChatMessage {
            id: "msg-1".to_string(),
            session_id: "sess-100".to_string(),
            role: "user".to_string(),
            content: "Write a high-performance Rust orchestrator".to_string(),
            reasoning: None,
            token_count: Some(15),
            created_at: "2026-10-10T10:01:00Z".to_string(),
        };
        let msg2 = ChatMessage {
            id: "msg-2".to_string(),
            session_id: "sess-100".to_string(),
            role: "assistant".to_string(),
            content: "Here is the implementation...".to_string(),
            reasoning: Some("Thinking through Tokio orchestration".to_string()),
            token_count: Some(120),
            created_at: "2026-10-10T10:02:00Z".to_string(),
        };

        db.save_chat_message(&msg1).expect("Failed to save msg1");
        db.save_chat_message(&msg2).expect("Failed to save msg2");

        let messages = db.get_chat_messages("sess-100").expect("Failed to get messages");
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "user");
        assert_eq!(messages[0].token_count, Some(15));
        assert_eq!(messages[1].role, "assistant");
        assert_eq!(messages[1].reasoning, Some("Thinking through Tokio orchestration".to_string()));
    }

    #[test]
    fn test_sqlite_agent_tasks_crud() {
        let db = Database::new_in_memory().expect("Failed to create in-memory db");
        let task = AgentTask {
            id: "task-01".to_string(),
            session_id: "sess-100".to_string(),
            title: "Build Rust engine".to_string(),
            status: "in_progress".to_string(),
            assigned_agent: "Lead Architect".to_string(),
            priority: "High".to_string(),
            progress: 50,
            created_at: "2026-10-10T10:00:00Z".to_string(),
            updated_at: "2026-10-10T10:10:00Z".to_string(),
        };

        db.save_agent_task(&task).expect("Failed to save task");
        let tasks = db.get_agent_tasks("sess-100").expect("Failed to fetch tasks");
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].id, "task-01");
        assert_eq!(tasks[0].progress, 50);

        // Update task
        let mut updated = task.clone();
        updated.status = "done".to_string();
        updated.progress = 100;
        db.save_agent_task(&updated).expect("Failed to update task");

        let tasks_after = db.get_agent_tasks("sess-100").expect("Failed to fetch updated tasks");
        assert_eq!(tasks_after.len(), 1);
        assert_eq!(tasks_after[0].status, "done");
        assert_eq!(tasks_after[0].progress, 100);
    }

    #[test]
    fn test_sqlite_agent_logs_crud() {
        let db = Database::new_in_memory().expect("Failed to create in-memory db");
        for i in 1..=5 {
            let log = AgentLog {
                id: format!("log-{}", i),
                agent_name: "Coder Subagent".to_string(),
                level: "INFO".to_string(),
                message: format!("Executing step {}", i),
                timestamp: format!("2026-10-10T10:0{}:00Z", i),
            };
            db.save_agent_log(&log).expect("Failed to save log");
        }

        let logs = db.get_recent_logs(3).expect("Failed to get recent logs");
        assert_eq!(logs.len(), 3);
        assert_eq!(logs[2].message, "Executing step 5");
    }

    #[test]
    fn test_sqlite_tool_audits_crud() {
        let db = Database::new_in_memory().expect("Failed to create in-memory db");
        let audit = ToolAuditRecord {
            id: "audit-1".to_string(),
            tool_name: "write_file".to_string(),
            parameters: r#"{"path":"src/main.rs"}"#.to_string(),
            result: Some("success".to_string()),
            status: "approved".to_string(),
            executed_at: "2026-10-10T10:00:00Z".to_string(),
        };

        db.save_tool_audit(&audit).expect("Failed to save tool audit");
    }
}
