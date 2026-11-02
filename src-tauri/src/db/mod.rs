use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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
    pub mode: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageRecord {
    pub id: i64,
    pub timestamp: String,
    pub provider: String,
    pub model: String,
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub cached_tokens: i64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModelUsageSummary {
    pub requests: i64,
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub cached_tokens: i64,
    pub total_tokens: i64,
    pub raw_model: String,
    pub provider: String,
    pub last_used: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProviderUsageSummary {
    pub requests: i64,
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub cached_tokens: i64,
    pub total_tokens: i64,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UsageStatsResult {
    pub total_requests: i64,
    pub total_prompt_tokens: i64,
    pub total_completion_tokens: i64,
    pub total_cached_tokens: i64,
    pub total_tokens: i64,
    pub by_model: HashMap<String, ModelUsageSummary>,
    pub by_provider: HashMap<String, ProviderUsageSummary>,
    pub recent_requests: Vec<UsageRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageChartPoint {
    pub label: String,
    pub tokens: i64,
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub cached_tokens: i64,
    pub requests: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DailyRollupData {
    pub requests: i64,
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub cached_tokens: i64,
    pub by_provider: HashMap<String, ProviderUsageSummary>,
    pub by_model: HashMap<String, ModelUsageSummary>,
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
                mode TEXT DEFAULT 'chatbot',
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

            CREATE TABLE IF NOT EXISTS usage_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                prompt_tokens INTEGER NOT NULL DEFAULT 0,
                completion_tokens INTEGER NOT NULL DEFAULT 0,
                cached_tokens INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'ok'
            );

            CREATE INDEX IF NOT EXISTS idx_usage_history_ts ON usage_history(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_usage_history_model ON usage_history(model);

            CREATE TABLE IF NOT EXISTS usage_daily (
                date_key TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            INSERT OR IGNORE INTO schema_migrations (version, applied_at)
            VALUES (1, datetime('now'));
            ",
        )?;

        // Migrasi aman jika kolom mode belum ada di tabel chat_sessions lama
        conn.execute(
            "ALTER TABLE chat_sessions ADD COLUMN mode TEXT DEFAULT 'chatbot'",
            params![],
        ).ok();

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
            "INSERT OR REPLACE INTO chat_sessions (id, title, model, provider, mode, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                session.id,
                session.title,
                session.model,
                session.provider,
                session.mode.as_deref().unwrap_or("chatbot"),
                session.created_at,
                session.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn get_chat_sessions(&self) -> Result<Vec<ChatSession>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, title, model, provider, mode, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC")?;
        let rows = stmt.query_map(params![], |row| {
            Ok(ChatSession {
                id: row.get(0)?,
                title: row.get(1)?,
                model: row.get(2)?,
                provider: row.get(3)?,
                mode: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
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

    pub fn delete_chat_session(&self, session_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM chat_messages WHERE session_id = ?1", params![session_id])?;
        conn.execute("DELETE FROM chat_sessions WHERE id = ?1", params![session_id])?;
        Ok(())
    }

    pub fn update_chat_session_title(&self, session_id: &str, title: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE chat_sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now, session_id],
        )?;
        Ok(())
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

    // Usage & Analytics
    pub fn record_token_usage(
        &self,
        provider: &str,
        model: &str,
        prompt_tokens: i64,
        completion_tokens: i64,
        cached_tokens: i64,
        status: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now_utc = chrono::Utc::now().to_rfc3339();
        let date_key = chrono::Local::now().format("%Y-%m-%d").to_string();

        conn.execute(
            "INSERT INTO usage_history (timestamp, provider, model, prompt_tokens, completion_tokens, cached_tokens, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![now_utc, provider, model, prompt_tokens, completion_tokens, cached_tokens, status],
        )?;

        let mut check_stmt = conn.prepare("SELECT data FROM usage_daily WHERE date_key = ?1")?;
        let existing_data: Option<String> = check_stmt
            .query_map(params![date_key], |row| row.get(0))?
            .into_iter()
            .next()
            .and_then(|r| r.ok());

        let mut rollup: DailyRollupData = existing_data
            .as_deref()
            .and_then(|d| serde_json::from_str(d).ok())
            .unwrap_or_default();

        rollup.requests += 1;
        rollup.prompt_tokens += prompt_tokens;
        rollup.completion_tokens += completion_tokens;
        rollup.cached_tokens += cached_tokens;

        let prov_key = if provider.trim().is_empty() { "unknown" } else { provider.trim() };
        let prov_entry = rollup.by_provider.entry(prov_key.to_string()).or_default();
        prov_entry.requests += 1;
        prov_entry.prompt_tokens += prompt_tokens;
        prov_entry.completion_tokens += completion_tokens;
        prov_entry.cached_tokens += cached_tokens;
        prov_entry.total_tokens += prompt_tokens + completion_tokens;
        prov_entry.provider = prov_key.to_string();

        let model_key = if !provider.trim().is_empty() {
            format!("{}|{}", model.trim(), prov_key)
        } else {
            model.trim().to_string()
        };
        let m_entry = rollup.by_model.entry(model_key).or_default();
        m_entry.requests += 1;
        m_entry.prompt_tokens += prompt_tokens;
        m_entry.completion_tokens += completion_tokens;
        m_entry.cached_tokens += cached_tokens;
        m_entry.total_tokens += prompt_tokens + completion_tokens;
        m_entry.raw_model = model.trim().to_string();
        m_entry.provider = prov_key.to_string();
        m_entry.last_used = now_utc;

        if let Ok(serialized) = serde_json::to_string(&rollup) {
            conn.execute(
                "INSERT OR REPLACE INTO usage_daily (date_key, data) VALUES (?1, ?2)",
                params![date_key, serialized],
            )?;
        }

        Ok(())
    }

    pub fn get_usage_statistics(&self, period: &str) -> Result<UsageStatsResult> {
        let conn = self.conn.lock().unwrap();
        let mut stats = UsageStatsResult::default();

        let normalized_period = period.to_lowercase();
        let use_daily_summary = normalized_period != "24h" && normalized_period != "today";

        if use_daily_summary {
            let cutoff_date: Option<String> = match normalized_period.as_str() {
                "7d" => Some((chrono::Local::now() - chrono::Duration::days(6)).format("%Y-%m-%d").to_string()),
                "30d" => Some((chrono::Local::now() - chrono::Duration::days(29)).format("%Y-%m-%d").to_string()),
                "60d" => Some((chrono::Local::now() - chrono::Duration::days(59)).format("%Y-%m-%d").to_string()),
                _ => None,
            };

            let mut day_rows: Vec<(String, String)> = Vec::new();
            if let Some(cutoff) = cutoff_date {
                let mut stmt = conn.prepare("SELECT date_key, data FROM usage_daily WHERE date_key >= ?1 ORDER BY date_key ASC")?;
                let rows = stmt.query_map(params![cutoff], |row| Ok((row.get(0)?, row.get(1)?)))?;
                for r in rows {
                    if let Ok(val) = r { day_rows.push(val); }
                }
            } else {
                let mut stmt = conn.prepare("SELECT date_key, data FROM usage_daily ORDER BY date_key ASC")?;
                let rows = stmt.query_map(params![], |row| Ok((row.get(0)?, row.get(1)?)))?;
                for r in rows {
                    if let Ok(val) = r { day_rows.push(val); }
                }
            }

            for (_date_key, json_str) in day_rows {
                if let Ok(day) = serde_json::from_str::<DailyRollupData>(&json_str) {
                    stats.total_requests += day.requests;
                    stats.total_prompt_tokens += day.prompt_tokens;
                    stats.total_completion_tokens += day.completion_tokens;
                    stats.total_cached_tokens += day.cached_tokens;

                    for (p_key, p_val) in day.by_provider {
                        let p = stats.by_provider.entry(p_key.clone()).or_default();
                        p.requests += p_val.requests;
                        p.prompt_tokens += p_val.prompt_tokens;
                        p.completion_tokens += p_val.completion_tokens;
                        p.cached_tokens += p_val.cached_tokens;
                        p.total_tokens += p_val.total_tokens;
                        p.provider = p_key;
                    }

                    for (m_key, m_val) in day.by_model {
                        let m = stats.by_model.entry(m_key).or_default();
                        m.requests += m_val.requests;
                        m.prompt_tokens += m_val.prompt_tokens;
                        m.completion_tokens += m_val.completion_tokens;
                        m.cached_tokens += m_val.cached_tokens;
                        m.total_tokens += m_val.total_tokens;
                        m.raw_model = m_val.raw_model;
                        m.provider = m_val.provider;
                        if m.last_used.is_empty() || m_val.last_used > m.last_used {
                            m.last_used = m_val.last_used;
                        }
                    }
                }
            }
        } else if normalized_period == "today" {
            let today_key = chrono::Local::now().format("%Y-%m-%d").to_string();
            let mut today_stmt = conn.prepare("SELECT data FROM usage_daily WHERE date_key = ?1")?;
            let json_str: Option<String> = today_stmt
                .query_map(params![today_key], |row| row.get(0))?
                .into_iter()
                .next()
                .and_then(|r| r.ok());

            if let Some(ref json) = json_str {
                if let Ok(day) = serde_json::from_str::<DailyRollupData>(json) {
                    stats.total_requests = day.requests;
                    stats.total_prompt_tokens = day.prompt_tokens;
                    stats.total_completion_tokens = day.completion_tokens;
                    stats.total_cached_tokens = day.cached_tokens;
                    stats.by_provider = day.by_provider;
                    stats.by_model = day.by_model;
                }
            }
        } else {
            // "24h"
            let since = (chrono::Utc::now() - chrono::Duration::hours(24)).to_rfc3339();
            let mut stmt = conn.prepare(
                "SELECT id, timestamp, provider, model, prompt_tokens, completion_tokens, cached_tokens, status
                 FROM usage_history WHERE timestamp >= ?1 ORDER BY id ASC",
            )?;
            let rows = stmt.query_map(params![since], |row| {
                Ok(UsageRecord {
                    id: row.get(0)?,
                    timestamp: row.get(1)?,
                    provider: row.get(2)?,
                    model: row.get(3)?,
                    prompt_tokens: row.get(4)?,
                    completion_tokens: row.get(5)?,
                    cached_tokens: row.get(6)?,
                    status: row.get(7)?,
                })
            })?;

            for r in rows {
                if let Ok(rec) = r {
                    stats.total_requests += 1;
                    stats.total_prompt_tokens += rec.prompt_tokens;
                    stats.total_completion_tokens += rec.completion_tokens;
                    stats.total_cached_tokens += rec.cached_tokens;

                    let prov_key = if rec.provider.trim().is_empty() { "unknown" } else { rec.provider.trim() };
                    let p = stats.by_provider.entry(prov_key.to_string()).or_default();
                    p.requests += 1;
                    p.prompt_tokens += rec.prompt_tokens;
                    p.completion_tokens += rec.completion_tokens;
                    p.cached_tokens += rec.cached_tokens;
                    p.total_tokens += rec.prompt_tokens + rec.completion_tokens;
                    p.provider = prov_key.to_string();

                    let model_key = if !rec.provider.trim().is_empty() {
                        format!("{}|{}", rec.model.trim(), prov_key)
                    } else {
                        rec.model.trim().to_string()
                    };
                    let m = stats.by_model.entry(model_key).or_default();
                    m.requests += 1;
                    m.prompt_tokens += rec.prompt_tokens;
                    m.completion_tokens += rec.completion_tokens;
                    m.cached_tokens += rec.cached_tokens;
                    m.total_tokens += rec.prompt_tokens + rec.completion_tokens;
                    m.raw_model = rec.model.clone();
                    m.provider = prov_key.to_string();
                    if m.last_used.is_empty() || rec.timestamp > m.last_used {
                        m.last_used = rec.timestamp.clone();
                    }
                }
            }
        }

        stats.total_tokens = stats.total_prompt_tokens + stats.total_completion_tokens;

        let mut rec_stmt = conn.prepare(
            "SELECT id, timestamp, provider, model, prompt_tokens, completion_tokens, cached_tokens, status
             FROM usage_history ORDER BY id DESC LIMIT 20",
        )?;
        let rec_rows = rec_stmt.query_map(params![], |row| {
            Ok(UsageRecord {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                provider: row.get(2)?,
                model: row.get(3)?,
                prompt_tokens: row.get(4)?,
                completion_tokens: row.get(5)?,
                cached_tokens: row.get(6)?,
                status: row.get(7)?,
            })
        })?;

        for r in rec_rows {
            if let Ok(rec) = r {
                stats.recent_requests.push(rec);
            }
        }

        Ok(stats)
    }

    pub fn get_usage_chart_points(&self, period: &str) -> Result<Vec<UsageChartPoint>> {
        let conn = self.conn.lock().unwrap();
        let normalized = period.to_lowercase();

        if normalized == "today" {
            let today_local = chrono::Local::now().date_naive();
            let mut points: Vec<UsageChartPoint> = (0..24)
                .map(|hour| UsageChartPoint {
                    label: format!("{:02}:00", hour),
                    tokens: 0,
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    cached_tokens: 0,
                    requests: 0,
                })
                .collect();

            let today_prefix = today_local.format("%Y-%m-%d").to_string();
            let mut stmt = conn.prepare(
                "SELECT timestamp, prompt_tokens, completion_tokens, cached_tokens
                 FROM usage_history WHERE timestamp LIKE ?1",
            )?;
            let rows = stmt.query_map(params![format!("{}%", today_prefix)], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                ))
            })?;

            for r in rows {
                if let Ok((ts, p_tok, c_tok, ca_tok)) = r {
                    if let Ok(parsed_dt) = chrono::DateTime::parse_from_rfc3339(&ts) {
                        let local_dt = parsed_dt.with_timezone(&chrono::Local);
                        let hour = local_dt.format("%H").to_string().parse::<usize>().unwrap_or(0);
                        if hour < points.len() {
                            points[hour].requests += 1;
                            points[hour].prompt_tokens += p_tok;
                            points[hour].completion_tokens += c_tok;
                            points[hour].cached_tokens += ca_tok;
                            points[hour].tokens += p_tok + c_tok;
                        }
                    }
                }
            }

            Ok(points)
        } else if normalized == "24h" {
            let now_local = chrono::Local::now();
            let mut points: Vec<(chrono::DateTime<chrono::Local>, UsageChartPoint)> = Vec::new();
            for i in (0..24).rev() {
                let dt = now_local - chrono::Duration::hours(i);
                points.push((
                    dt,
                    UsageChartPoint {
                        label: dt.format("%H:00").to_string(),
                        tokens: 0,
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        cached_tokens: 0,
                        requests: 0,
                    },
                ));
            }

            let since = (chrono::Utc::now() - chrono::Duration::hours(24)).to_rfc3339();
            let mut stmt = conn.prepare(
                "SELECT timestamp, prompt_tokens, completion_tokens, cached_tokens
                 FROM usage_history WHERE timestamp >= ?1",
            )?;
            let rows = stmt.query_map(params![since], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                ))
            })?;

            for r in rows {
                if let Ok((ts, p_tok, c_tok, ca_tok)) = r {
                    if let Ok(parsed_dt) = chrono::DateTime::parse_from_rfc3339(&ts) {
                        let local_dt = parsed_dt.with_timezone(&chrono::Local);
                        let match_key = local_dt.format("%Y-%m-%d %H").to_string();
                        for (bucket_dt, pt) in points.iter_mut() {
                            if bucket_dt.format("%Y-%m-%d %H").to_string() == match_key {
                                pt.requests += 1;
                                pt.prompt_tokens += p_tok;
                                pt.completion_tokens += c_tok;
                                pt.cached_tokens += ca_tok;
                                pt.tokens += p_tok + c_tok;
                                break;
                            }
                        }
                    }
                }
            }

            Ok(points.into_iter().map(|(_, pt)| pt).collect())
        } else {
            let num_days = match normalized.as_str() {
                "30d" => 30,
                "60d" => 60,
                "all" => 90,
                _ => 7,
            };

            let today_local = chrono::Local::now().date_naive();
            let mut points_map: HashMap<String, UsageChartPoint> = HashMap::new();
            let mut date_keys: Vec<String> = Vec::new();

            for i in (0..num_days).rev() {
                let d = today_local - chrono::Duration::days(i);
                let key = d.format("%Y-%m-%d").to_string();
                let label = d.format("%b %d").to_string();
                date_keys.push(key.clone());
                points_map.insert(
                    key,
                    UsageChartPoint {
                        label,
                        tokens: 0,
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        cached_tokens: 0,
                        requests: 0,
                    },
                );
            }

            let start_date = date_keys.first().cloned().unwrap_or_default();
            let mut stmt = conn.prepare(
                "SELECT date_key, data FROM usage_daily WHERE date_key >= ?1 ORDER BY date_key ASC",
            )?;
            let rows = stmt.query_map(params![start_date], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?;

            for r in rows {
                if let Ok((date_key, json_str)) = r {
                    if let Ok(day) = serde_json::from_str::<DailyRollupData>(&json_str) {
                        if let Some(pt) = points_map.get_mut(&date_key) {
                            pt.requests = day.requests;
                            pt.prompt_tokens = day.prompt_tokens;
                            pt.completion_tokens = day.completion_tokens;
                            pt.cached_tokens = day.cached_tokens;
                            pt.tokens = day.prompt_tokens + day.completion_tokens;
                        }
                    }
                }
            }

            let result = date_keys
                .into_iter()
                .filter_map(|k| points_map.remove(&k))
                .collect();

            Ok(result)
        }
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
            mode: Some("agent".to_string()),
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

    #[test]
    fn test_sqlite_usage_tracking_and_analytics() {
        let db = Database::new_in_memory().expect("Failed to create in-memory db");

        // Record 2 usage entries
        db.record_token_usage("gemini", "gemini-2.5-flash", 800, 150, 50, "ok")
            .expect("Failed to record usage 1");
        db.record_token_usage("ollama", "lfm3:1.7b", 400, 80, 0, "ok")
            .expect("Failed to record usage 2");

        let stats_today = db.get_usage_statistics("today").expect("Failed to get today stats");
        assert_eq!(stats_today.total_requests, 2);
        assert_eq!(stats_today.total_prompt_tokens, 1200);
        assert_eq!(stats_today.total_completion_tokens, 230);
        assert_eq!(stats_today.total_cached_tokens, 50);
        assert_eq!(stats_today.total_tokens, 1430);
        assert_eq!(stats_today.recent_requests.len(), 2);
        assert!(stats_today.by_provider.contains_key("gemini"));
        assert!(stats_today.by_provider.contains_key("ollama"));

        let chart_points = db.get_usage_chart_points("7d").expect("Failed to get chart points");
        assert_eq!(chart_points.len(), 7);
        let today_point = chart_points.last().unwrap();
        assert_eq!(today_point.requests, 2);
        assert_eq!(today_point.tokens, 1430);
    }
}
