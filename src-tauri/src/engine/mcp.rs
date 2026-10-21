use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    pub id: String,
    pub name: String,
    pub transport: String, // "stdio" | "sse"
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default = "default_true")]
    pub is_active: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolInfo {
    pub server_id: String,
    pub server_name: String,
    pub original_name: String,
    pub namespaced_name: String, // Format: mcp__<server_name>__<original_name>
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerStatus {
    pub id: String,
    pub name: String,
    pub is_connected: bool,
    pub tools_count: usize,
    pub error_message: Option<String>,
}

/// Parsing format konfigurasi standar claude_desktop_config.json / mcp.json
pub fn parse_mcp_servers_json(json_str: &str) -> Result<Vec<McpServerConfig>, String> {
    let parsed: serde_json::Value =
        serde_json::from_str(json_str).map_err(|e| format!("Format JSON tidak valid: {}", e))?;

    let servers_obj = if let Some(obj) = parsed.get("mcpServers").and_then(|v| v.as_object()) {
        obj
    } else if let Some(obj) = parsed.as_object() {
        obj
    } else {
        return Err("Objek mcpServers tidak ditemukan dalam JSON".to_string());
    };

    let mut result = Vec::new();

    for (name, val) in servers_obj {
        let clean_name = name.trim().to_string();
        if clean_name.is_empty() {
            continue;
        }

        let id = format!("mcp-{}", uuid::Uuid::new_v4().to_string().chars().take(8).collect::<String>());

        // Deteksi transport: jika memiliki properti url -> sse, selain itu stdio
        let url = val.get("url").and_then(|u| u.as_str()).map(|s| s.to_string());
        let transport = if url.is_some() {
            "sse".to_string()
        } else {
            "stdio".to_string()
        };

        let command = val.get("command").and_then(|c| c.as_str()).map(|s| s.to_string());

        let args = if let Some(arr) = val.get("args").and_then(|a| a.as_array()) {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        } else {
            Vec::new()
        };

        let mut env = HashMap::new();
        if let Some(env_obj) = val.get("env").and_then(|e| e.as_object()) {
            for (k, v) in env_obj {
                if let Some(s) = v.as_str() {
                    env.insert(k.clone(), s.to_string());
                }
            }
        }

        result.push(McpServerConfig {
            id,
            name: clean_name,
            transport,
            command,
            args,
            env,
            url,
            is_active: true,
        });
    }

    Ok(result)
}

/// Normalisasi nama server dan tool untuk namespace yang aman (hanya huruf, angka, underscore)
pub fn format_namespaced_tool_name(server_name: &str, tool_name: &str) -> String {
    let safe_server: String = server_name
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect();
    let safe_tool: String = tool_name
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect();
    format!("mcp__{}__{}", safe_server, safe_tool)
}

/// Mengurai namespace tool kembali ke nama server dan nama tool asli
pub fn parse_namespaced_tool_name(namespaced_name: &str) -> Option<(String, String)> {
    if !namespaced_name.starts_with("mcp__") {
        return None;
    }
    let parts: Vec<&str> = namespaced_name.split("__").collect();
    if parts.len() >= 3 {
        let server = parts[1].to_string();
        let tool = parts[2..].join("__");
        Some((server, tool))
    } else {
        None
    }
}

/// Manajer Terpusat MCP Client
#[derive(Clone)]
pub struct McpClientManager {
    servers: Arc<RwLock<Vec<McpServerConfig>>>,
    active_tools: Arc<RwLock<Vec<McpToolInfo>>>,
    statuses: Arc<RwLock<HashMap<String, McpServerStatus>>>,
    storage_path: PathBuf,
}

impl McpClientManager {
    pub fn new() -> Self {
        let storage_path = Self::resolve_storage_path();
        let instance = Self {
            servers: Arc::new(RwLock::new(Vec::new())),
            active_tools: Arc::new(RwLock::new(Vec::new())),
            statuses: Arc::new(RwLock::new(HashMap::new())),
            storage_path,
        };
        instance.load_persisted_servers();
        instance
    }

    fn resolve_storage_path() -> PathBuf {
        if let Some(data_dir) = dirs::data_dir() {
            let app_dir = data_dir.join("agentic_native_hub");
            let _ = std::fs::create_dir_all(&app_dir);
            app_dir.join("mcp_servers.json")
        } else {
            PathBuf::from("mcp_servers.json")
        }
    }

    fn load_persisted_servers(&self) {
        if self.storage_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&self.storage_path) {
                if let Ok(servers) = serde_json::from_str::<Vec<McpServerConfig>>(&content) {
                    if let Ok(mut lock) = self.servers.try_write() {
                        *lock = servers;
                    }
                }
            }
        }
    }

    pub fn save_persisted_servers(&self) {
        if let Ok(lock) = self.servers.try_read() {
            if let Ok(json_str) = serde_json::to_string_pretty(&*lock) {
                let _ = std::fs::write(&self.storage_path, json_str);
            }
        }
    }

    pub async fn list_servers(&self) -> Vec<McpServerConfig> {
        self.servers.read().await.clone()
    }

    pub async fn list_active_tools(&self) -> Vec<McpToolInfo> {
        self.active_tools.read().await.clone()
    }

    pub async fn get_server_statuses(&self) -> Vec<McpServerStatus> {
        self.statuses.read().await.values().cloned().collect()
    }

    pub async fn save_server(&self, config: McpServerConfig) -> Result<(), String> {
        {
            let mut lock = self.servers.write().await;
            if let Some(idx) = lock.iter().position(|s| s.id == config.id) {
                lock[idx] = config.clone();
            } else {
                lock.push(config.clone());
            }
        }
        self.save_persisted_servers();

        if config.is_active {
            let _ = self.connect_server(&config.id).await;
        } else {
            self.remove_server_tools(&config.id).await;
        }
        Ok(())
    }

    pub async fn delete_server(&self, server_id: &str) -> Result<(), String> {
        {
            let mut lock = self.servers.write().await;
            lock.retain(|s| s.id != server_id);
        }
        self.save_persisted_servers();
        self.remove_server_tools(server_id).await;
        Ok(())
    }

    pub async fn toggle_server(&self, server_id: &str, is_active: bool) -> Result<(), String> {
        {
            let mut lock = self.servers.write().await;
            if let Some(s) = lock.iter_mut().find(|s| s.id == server_id) {
                s.is_active = is_active;
            }
        }
        self.save_persisted_servers();

        if is_active {
            let _ = self.connect_server(server_id).await;
        } else {
            self.remove_server_tools(server_id).await;
        }
        Ok(())
    }

    pub async fn import_json_config(&self, json_str: &str) -> Result<usize, String> {
        let parsed_servers = parse_mcp_servers_json(json_str)?;
        let count = parsed_servers.len();

        for s in parsed_servers {
            let _ = self.save_server(s).await;
        }
        Ok(count)
    }

    async fn remove_server_tools(&self, server_id: &str) {
        let mut lock = self.active_tools.write().await;
        lock.retain(|t| t.server_id != server_id);

        let mut st_lock = self.statuses.write().await;
        st_lock.remove(server_id);
    }

    /// Menghubungkan secara otomatis seluruh server MCP yang aktif
    pub async fn auto_connect_all(&self) {
        let active_servers: Vec<String> = {
            let lock = self.servers.read().await;
            lock.iter()
                .filter(|s| s.is_active)
                .map(|s| s.id.clone())
                .collect()
        };

        for id in active_servers {
            let _ = self.connect_server(&id).await;
        }
    }

    /// Melakukan handshake JSON-RPC ke MCP server dan mengambil daftar tool (tools/list)
    pub async fn connect_server(&self, server_id: &str) -> Result<Vec<McpToolInfo>, String> {
        let config = {
            let lock = self.servers.read().await;
            lock.iter().find(|s| s.id == server_id).cloned()
        };

        let config = match config {
            Some(c) => c,
            None => return Err(format!("Server dengan ID '{}' tidak ditemukan", server_id)),
        };

        if !config.is_active {
            self.remove_server_tools(server_id).await;
            return Ok(Vec::new());
        }

        let tools_res = if config.transport == "stdio" {
            Self::discover_tools_stdio(&config).await
        } else if config.transport == "sse" {
            Self::discover_tools_sse(&config).await
        } else {
            Err(format!("Transport '{}' tidak didukung", config.transport))
        };

        match tools_res {
            Ok(tools) => {
                // Perbarui active_tools
                {
                    let mut lock = self.active_tools.write().await;
                    lock.retain(|t| t.server_id != server_id);
                    lock.extend(tools.clone());
                }

                // Perbarui status
                {
                    let mut st_lock = self.statuses.write().await;
                    st_lock.insert(
                        server_id.to_string(),
                        McpServerStatus {
                            id: server_id.to_string(),
                            name: config.name.clone(),
                            is_connected: true,
                            tools_count: tools.len(),
                            error_message: None,
                        },
                    );
                }
                Ok(tools)
            }
            Err(e) => {
                let err_msg = e.clone();
                {
                    let mut st_lock = self.statuses.write().await;
                    st_lock.insert(
                        server_id.to_string(),
                        McpServerStatus {
                            id: server_id.to_string(),
                            name: config.name.clone(),
                            is_connected: false,
                            tools_count: 0,
                            error_message: Some(err_msg),
                        },
                    );
                }
                Err(e)
            }
        }
    }

    /// Discover tools via stdio child process
    async fn discover_tools_stdio(config: &McpServerConfig) -> Result<Vec<McpToolInfo>, String> {
        let cmd_str = config
            .command
            .as_deref()
            .ok_or_else(|| "Command tidak didefinisikan untuk transport stdio".to_string())?;

        let mut child_cmd = Command::new(cmd_str);
        child_cmd.args(&config.args);

        for (k, v) in &config.env {
            child_cmd.env(k, v);
        }

        #[cfg(target_os = "windows")]
        {
            child_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        child_cmd.stdin(std::process::Stdio::piped());
        child_cmd.stdout(std::process::Stdio::piped());
        child_cmd.stderr(std::process::Stdio::piped());

        let mut child = child_cmd
            .spawn()
            .map_err(|e| format!("Gagal menjalankan proses '{}': {}", cmd_str, e))?;

        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Gagal membuka stdin proses MCP".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Gagal membuka stdout proses MCP".to_string())?;
        let mut reader = BufReader::new(stdout);

        // 1. Kirim pesan initialize
        let init_req = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "agentic-native-hub",
                    "version": "0.1.0"
                }
            }
        });

        let mut init_line = serde_json::to_string(&init_req).unwrap();
        init_line.push('\n');
        stdin
            .write_all(init_line.as_bytes())
            .await
            .map_err(|e| format!("Gagal mengirim initialize ke MCP: {}", e))?;
        stdin.flush().await.map_err(|e| format!("Gagal flush stdin: {}", e))?;

        // Baca respons initialize (dengan timeout 10 detik)
        let mut response_line = String::new();
        tokio::time::timeout(std::time::Duration::from_secs(10), reader.read_line(&mut response_line))
            .await
            .map_err(|_| "Batas waktu (timeout) 10 detik terlampaui saat menunggu respons initialize MCP".to_string())?
            .map_err(|e| format!("Gagal membaca respons initialize: {}", e))?;

        // 2. Kirim notifikasi initialized
        let notif = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        });
        let mut notif_line = serde_json::to_string(&notif).unwrap();
        notif_line.push('\n');
        let _ = stdin.write_all(notif_line.as_bytes()).await;
        let _ = stdin.flush().await;

        // 3. Kirim request tools/list
        let tools_req = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        });
        let mut tools_line = serde_json::to_string(&tools_req).unwrap();
        tools_line.push('\n');
        stdin
            .write_all(tools_line.as_bytes())
            .await
            .map_err(|e| format!("Gagal mengirim tools/list ke MCP: {}", e))?;
        stdin.flush().await.map_err(|e| format!("Gagal flush stdin: {}", e))?;

        // Baca respons tools/list
        let mut tools_resp_line = String::new();
        tokio::time::timeout(std::time::Duration::from_secs(10), reader.read_line(&mut tools_resp_line))
            .await
            .map_err(|_| "Timeout menunggu daftar tools dari MCP".to_string())?
            .map_err(|e| format!("Gagal membaca respons tools/list: {}", e))?;

        // Matikan child process setelah discovery selesai
        let _ = child.kill().await;

        let parsed_tools: serde_json::Value = serde_json::from_str(&tools_resp_line)
            .map_err(|e| format!("Gagal parsing JSON tools/list: {}. Respons: {}", e, tools_resp_line))?;

        let mut discovered = Vec::new();

        if let Some(tools_arr) = parsed_tools["result"]["tools"].as_array() {
            for t in tools_arr {
                let original_name = t["name"].as_str().unwrap_or("").to_string();
                if original_name.is_empty() {
                    continue;
                }

                let desc = t["description"].as_str().unwrap_or("").to_string();
                let schema = t["inputSchema"].clone();
                let namespaced_name = format_namespaced_tool_name(&config.name, &original_name);

                discovered.push(McpToolInfo {
                    server_id: config.id.clone(),
                    server_name: config.name.clone(),
                    original_name,
                    namespaced_name,
                    description: desc,
                    input_schema: schema,
                });
            }
        }

        Ok(discovered)
    }

    /// Discover tools via HTTP / SSE endpoint
    async fn discover_tools_sse(config: &McpServerConfig) -> Result<Vec<McpToolInfo>, String> {
        let url = config
            .url
            .as_deref()
            .ok_or_else(|| "URL tidak didefinisikan untuk transport sse".to_string())?;

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| format!("Gagal membuat HTTP client: {}", e))?;

        // Kirim request tools/list JSON-RPC ke endpoint HTTP MCP
        let req_payload = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list",
            "params": {}
        });

        let res = client
            .post(url)
            .json(&req_payload)
            .send()
            .await
            .map_err(|e| format!("Gagal menghubungi server SSE di '{}': {}", url, e))?;

        let json_body: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("Gagal membaca JSON dari server SSE: {}", e))?;

        let mut discovered = Vec::new();

        if let Some(tools_arr) = json_body["result"]["tools"].as_array() {
            for t in tools_arr {
                let original_name = t["name"].as_str().unwrap_or("").to_string();
                if original_name.is_empty() {
                    continue;
                }
                let desc = t["description"].as_str().unwrap_or("").to_string();
                let schema = t["inputSchema"].clone();
                let namespaced_name = format_namespaced_tool_name(&config.name, &original_name);

                discovered.push(McpToolInfo {
                    server_id: config.id.clone(),
                    server_name: config.name.clone(),
                    original_name,
                    namespaced_name,
                    description: desc,
                    input_schema: schema,
                });
            }
        }

        Ok(discovered)
    }

    /// Eksekusi pemanggilan tool MCP (tools/call)
    pub async fn call_tool(
        &self,
        namespaced_name: &str,
        arguments: serde_json::Value,
    ) -> Result<String, String> {
        // Cari tool di active_tools
        let tool_info = {
            let lock = self.active_tools.read().await;
            lock.iter()
                .find(|t| t.namespaced_name == namespaced_name)
                .cloned()
        };

        let tool_info = match tool_info {
            Some(t) => t,
            None => {
                return Err(format!(
                    "Tool MCP '{}' tidak ditemukan atau server sedang nonaktif",
                    namespaced_name
                ))
            }
        };

        // Ambil config server
        let server_config = {
            let lock = self.servers.read().await;
            lock.iter().find(|s| s.id == tool_info.server_id).cloned()
        };

        let server_config = match server_config {
            Some(s) => s,
            None => return Err(format!("Server MCP '{}' tidak ditemukan", tool_info.server_name)),
        };

        if server_config.transport == "stdio" {
            Self::execute_call_stdio(&server_config, &tool_info.original_name, arguments).await
        } else if server_config.transport == "sse" {
            Self::execute_call_sse(&server_config, &tool_info.original_name, arguments).await
        } else {
            Err(format!("Transport '{}' tidak didukung", server_config.transport))
        }
    }

    async fn execute_call_stdio(
        config: &McpServerConfig,
        tool_name: &str,
        arguments: serde_json::Value,
    ) -> Result<String, String> {
        let cmd_str = config
            .command
            .as_deref()
            .ok_or_else(|| "Command tidak didefinisikan".to_string())?;

        let mut child_cmd = Command::new(cmd_str);
        child_cmd.args(&config.args);

        for (k, v) in &config.env {
            child_cmd.env(k, v);
        }

        #[cfg(target_os = "windows")]
        {
            child_cmd.creation_flags(0x08000000);
        }

        child_cmd.stdin(std::process::Stdio::piped());
        child_cmd.stdout(std::process::Stdio::piped());
        child_cmd.stderr(std::process::Stdio::piped());

        let mut child = child_cmd
            .spawn()
            .map_err(|e| format!("Gagal menjalankan proses '{}': {}", cmd_str, e))?;

        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Gagal membuka stdin".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Gagal membuka stdout".to_string())?;
        let mut reader = BufReader::new(stdout);

        // 1. Initialize
        let init_req = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "agentic-native-hub",
                    "version": "0.1.0"
                }
            }
        });
        let mut line = serde_json::to_string(&init_req).unwrap();
        line.push('\n');
        let _ = stdin.write_all(line.as_bytes()).await;
        let _ = stdin.flush().await;

        let mut init_resp = String::new();
        let _ = reader.read_line(&mut init_resp).await;

        // 2. Initialized notif
        let notif = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        });
        let mut n_line = serde_json::to_string(&notif).unwrap();
        n_line.push('\n');
        let _ = stdin.write_all(n_line.as_bytes()).await;
        let _ = stdin.flush().await;

        // 3. tools/call
        let call_req = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        });
        let mut call_line = serde_json::to_string(&call_req).unwrap();
        call_line.push('\n');
        stdin
            .write_all(call_line.as_bytes())
            .await
            .map_err(|e| format!("Gagal mengirim tools/call: {}", e))?;
        stdin.flush().await.map_err(|e| format!("Gagal flush: {}", e))?;

        let mut call_resp_line = String::new();
        tokio::time::timeout(std::time::Duration::from_secs(30), reader.read_line(&mut call_resp_line))
            .await
            .map_err(|_| "Batas waktu 30 detik terlampaui saat eksekusi tool MCP".to_string())?
            .map_err(|e| format!("Gagal membaca respons tools/call: {}", e))?;

        let _ = child.kill().await;

        let parsed: serde_json::Value = serde_json::from_str(&call_resp_line)
            .map_err(|e| format!("Gagal parsing JSON output tool: {}. Raw: {}", e, call_resp_line))?;

        if let Some(err) = parsed.get("error") {
            return Err(format!("Error dari MCP server: {}", err));
        }

        // Ambil isi content
        if let Some(content_arr) = parsed["result"]["content"].as_array() {
            let texts: Vec<String> = content_arr
                .iter()
                .filter_map(|c| c["text"].as_str().map(|s| s.to_string()))
                .collect();
            Ok(texts.join("\n"))
        } else if let Some(res_val) = parsed.get("result") {
            Ok(serde_json::to_string_pretty(res_val).unwrap_or_default())
        } else {
            Ok(call_resp_line)
        }
    }

    async fn execute_call_sse(
        config: &McpServerConfig,
        tool_name: &str,
        arguments: serde_json::Value,
    ) -> Result<String, String> {
        let url = config
            .url
            .as_deref()
            .ok_or_else(|| "URL tidak didefinisikan".to_string())?;

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| format!("Gagal membuat HTTP client: {}", e))?;

        let call_req = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        });

        let res = client
            .post(url)
            .json(&call_req)
            .send()
            .await
            .map_err(|e| format!("Gagal mengirim tools/call ke SSE server: {}", e))?;

        let json_body: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("Gagal membaca JSON dari SSE server: {}", e))?;

        if let Some(err) = json_body.get("error") {
            return Err(format!("Error dari MCP server: {}", err));
        }

        if let Some(content_arr) = json_body["result"]["content"].as_array() {
            let texts: Vec<String> = content_arr
                .iter()
                .filter_map(|c| c["text"].as_str().map(|s| s.to_string()))
                .collect();
            Ok(texts.join("\n"))
        } else {
            Ok(serde_json::to_string_pretty(&json_body).unwrap_or_default())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mcp_format_and_parse_namespace() {
        let ns = format_namespaced_tool_name("sqlite-db", "query_rows");
        assert_eq!(ns, "mcp__sqlite_db__query_rows");

        let parsed = parse_namespaced_tool_name(&ns);
        assert_eq!(parsed, Some(("sqlite_db".to_string(), "query_rows".to_string())));
    }

    #[test]
    fn test_parse_claude_desktop_json_config() {
        let sample = r#"{
            "mcpServers": {
                "sqlite": {
                    "command": "uvx",
                    "args": ["mcp-server-sqlite", "--db-path", "test.db"]
                },
                "remote_fetch": {
                    "url": "http://localhost:8080/sse"
                }
            }
        }"#;

        let parsed = parse_mcp_servers_json(sample).unwrap();
        assert_eq!(parsed.len(), 2);

        let sqlite = parsed.iter().find(|s| s.name == "sqlite").unwrap();
        assert_eq!(sqlite.transport, "stdio");
        assert_eq!(sqlite.command, Some("uvx".to_string()));
        assert_eq!(sqlite.args.len(), 3);

        let remote = parsed.iter().find(|s| s.name == "remote_fetch").unwrap();
        assert_eq!(remote.transport, "sse");
        assert_eq!(remote.url, Some("http://localhost:8080/sse".to_string()));
    }

    #[test]
    fn test_mcp_manager_crud_and_import() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        rt.block_on(async {
            let storage_path = std::env::temp_dir().join(format!("mcp_test_{}.json", uuid::Uuid::new_v4()));
            let manager = McpClientManager {
                servers: Arc::new(RwLock::new(Vec::new())),
                active_tools: Arc::new(RwLock::new(Vec::new())),
                statuses: Arc::new(RwLock::new(HashMap::new())),
                storage_path: storage_path.clone(),
            };

            // 1. Save server
            let cfg = McpServerConfig {
                id: "test-server-1".to_string(),
                name: "test_srv".to_string(),
                transport: "stdio".to_string(),
                command: Some("echo".to_string()),
                args: vec!["hello".to_string()],
                env: HashMap::new(),
                url: None,
                is_active: false,
            };
            let save_res = manager.save_server(cfg.clone()).await;
            assert!(save_res.is_ok());

            let list = manager.list_servers().await;
            assert_eq!(list.len(), 1);
            assert_eq!(list[0].id, "test-server-1");

            // 2. Toggle server
            let toggle_res = manager.toggle_server("test-server-1", false).await;
            assert!(toggle_res.is_ok());

            // 3. Import JSON config
            let json_data = r#"{
                "mcpServers": {
                    "imported_1": { "command": "npx", "args": ["-y", "pkg"] },
                    "imported_2": { "url": "http://127.0.0.1:3000/sse" }
                }
            }"#;
            let parsed = parse_mcp_servers_json(json_data).unwrap();
            for mut s in parsed {
                s.is_active = false;
                let _ = manager.save_server(s).await;
            }

            let updated_list = manager.list_servers().await;
            assert_eq!(updated_list.len(), 3);

            // 4. Delete server
            let del_res = manager.delete_server("test-server-1").await;
            assert!(del_res.is_ok());
            let final_list = manager.list_servers().await;
            assert_eq!(final_list.len(), 2);

            let _ = std::fs::remove_file(storage_path);
        });
    }
}
