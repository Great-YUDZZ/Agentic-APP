use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallRequest {
    pub id: String,
    pub tool_name: String,
    pub parameters: serde_json::Value,
    pub requires_clearance: bool,
    pub risk_level: String, // Low, Medium, High
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallResult {
    pub id: String,
    pub success: bool,
    pub output: String,
    pub execution_time_ms: u128,
}

use std::sync::{Arc, RwLock};

#[derive(Clone)]
pub struct ToolRunner {
    workspace_root: Arc<RwLock<PathBuf>>,
    mcp_manager: Arc<RwLock<Option<Arc<crate::engine::mcp::McpClientManager>>>>,
}

pub fn normalize_path(path: &Path) -> PathBuf {
    let mut components = Vec::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if let Some(c) = components.last() {
                    if matches!(c, Component::Normal(_)) {
                        components.pop();
                        continue;
                    }
                }
                components.push(component);
            }
            c => components.push(c),
        }
    }
    components.into_iter().collect()
}

impl ToolRunner {
    pub fn new(workspace_root: PathBuf) -> Self {
        Self {
            workspace_root: Arc::new(RwLock::new(workspace_root)),
            mcp_manager: Arc::new(RwLock::new(None)),
        }
    }

    pub fn set_mcp_manager(&self, manager: Arc<crate::engine::mcp::McpClientManager>) {
        if let Ok(mut lock) = self.mcp_manager.write() {
            *lock = Some(manager);
        }
    }

    pub fn workspace_root(&self) -> PathBuf {
        self.workspace_root.read().unwrap().clone()
    }

    pub fn set_workspace_root(&self, new_root: PathBuf) {
        if let Ok(mut lock) = self.workspace_root.write() {
            *lock = new_root;
        }
    }

    pub fn sanitize_path(&self, requested: &str, allow_external: bool) -> anyhow::Result<PathBuf> {
        let current_ws = self.workspace_root();
        let raw = Path::new(requested);
        let candidate = if raw.is_absolute() {
            raw.to_path_buf()
        } else {
            current_ws.join(raw)
        };

        // 1. Lexical normalization (resolve '.' and '..' without requiring file existence)
        let normalized = normalize_path(&candidate);
        let workspace = normalize_path(&current_ws);

        // 2. Strict path confinement check if allow_external is false
        if !allow_external && !normalized.starts_with(&workspace) {
            return Err(anyhow::anyhow!(
                "Security confinement violation: Path '{}' is outside workspace '{}'",
                requested,
                current_ws.display()
            ));
        }

        // 2b. If allow_external is true, still prevent access to dangerous system virtual filesystems
        if allow_external {
            let str_norm = normalized.to_string_lossy();
            if str_norm.starts_with("/dev") || str_norm.starts_with("/proc") || str_norm.starts_with("/sys") {
                return Err(anyhow::anyhow!(
                    "Security restriction: Access to system device or kernel virtual paths '{}' is blocked",
                    str_norm
                ));
            }
        }

        // 3. Symlink escape check for existing paths
        if normalized.exists() {
            let canonical = normalized.canonicalize()?;
            if !allow_external {
                let canonical_ws = current_ws
                    .canonicalize()
                    .unwrap_or_else(|_| workspace);
                if !canonical.starts_with(&canonical_ws) {
                    return Err(anyhow::anyhow!(
                        "Security confinement violation: Symlink target '{}' escapes workspace '{}'",
                        canonical.display(),
                        canonical_ws.display()
                    ));
                }
            } else {
                let str_canonical = canonical.to_string_lossy();
                if str_canonical.starts_with("/dev") || str_canonical.starts_with("/proc") || str_canonical.starts_with("/sys") {
                    return Err(anyhow::anyhow!(
                        "Security restriction: Symlink target '{}' points to restricted system paths",
                        str_canonical
                    ));
                }
            }
            return Ok(canonical);
        }

        Ok(normalized)
    }

    pub async fn execute_tool(&self, request: &ToolCallRequest) -> ToolCallResult {
        let start = std::time::Instant::now();
        let tool_name = request.tool_name.as_str();
        let allow_external = request.parameters["allow_external"].as_bool().unwrap_or(false);

        let res = match tool_name {
            "read_file" => {
                let path_str = request.parameters["path"].as_str().unwrap_or("");
                match self.read_file(path_str, allow_external).await {
                    Ok(content) => Ok(content),
                    Err(e) => Err(format!("Error reading file: {}", e)),
                }
            }
            "write_file" => {
                let path_str = request.parameters["path"].as_str().unwrap_or("");
                let content = request.parameters["content"].as_str().unwrap_or("");
                match self.write_file(path_str, content, allow_external).await {
                    Ok(msg) => Ok(msg),
                    Err(e) => Err(format!("Error writing file: {}", e)),
                }
            }
            "list_dir" => {
                let path_str = request.parameters["path"].as_str().unwrap_or(".");
                match self.list_dir(path_str, allow_external).await {
                    Ok(list) => Ok(list),
                    Err(e) => Err(format!("Error listing directory: {}", e)),
                }
            }
            "execute_command" => {
                let cmd_str = request.parameters["command"].as_str().unwrap_or("");
                let working_dir = request.parameters["working_dir"].as_str();
                match self.execute_command(cmd_str, working_dir, allow_external).await {
                    Ok(out) => Ok(out),
                    Err(e) => Err(format!("Error executing command: {}", e)),
                }
            }
            "web_fetch" => {
                let url_str = request.parameters["url"].as_str().unwrap_or("");
                match self.web_fetch(url_str).await {
                    Ok(body) => Ok(body),
                    Err(e) => Err(format!("Error fetching url: {}", e)),
                }
            }
            "web_search" => {
                let query_str = request.parameters["query"].as_str().unwrap_or("");
                let max_chars = request.parameters["max_chars"].as_u64().map(|n| n as usize);
                match crate::engine::web_search::execute_all_in_one_search(query_str, max_chars).await {
                    Ok(res) => Ok(res),
                    Err(e) => Err(format!("Error performing web search: {}", e)),
                }
            }
            _ => {
                if tool_name.starts_with("mcp__") {
                    let mgr_opt = {
                        self.mcp_manager.read().ok().and_then(|lock| lock.clone())
                    };
                    if let Some(mgr) = mgr_opt {
                        match mgr.call_tool(tool_name, request.parameters.clone()).await {
                            Ok(out) => Ok(out),
                            Err(e) => Err(format!("Error calling MCP tool '{}': {}", tool_name, e)),
                        }
                    } else {
                        Err(format!("MCP client manager tidak aktif untuk tool: {}", tool_name))
                    }
                } else {
                    Err(format!("Unknown tool: {}", tool_name))
                }
            }
        };

        let elapsed = start.elapsed().as_millis();
        match res {
            Ok(output) => ToolCallResult {
                id: request.id.clone(),
                success: true,
                output,
                execution_time_ms: elapsed,
            },
            Err(output) => ToolCallResult {
                id: request.id.clone(),
                success: false,
                output,
                execution_time_ms: elapsed,
            },
        }
    }

    async fn read_file(&self, path_str: &str, allow_external: bool) -> anyhow::Result<String> {
        let safe_path = self.sanitize_path(path_str, allow_external)?;
        let content = tokio::fs::read_to_string(&safe_path).await?;
        Ok(content)
    }

    async fn write_file(&self, path_str: &str, content: &str, allow_external: bool) -> anyhow::Result<String> {
        let safe_path = self.sanitize_path(path_str, allow_external)?;

        if let Some(parent) = safe_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        tokio::fs::write(&safe_path, content).await?;
        Ok(format!(
            "Successfully wrote {} bytes to {}",
            content.len(),
            safe_path.display()
        ))
    }

    async fn list_dir(&self, path_str: &str, allow_external: bool) -> anyhow::Result<String> {
        let safe_path = self.sanitize_path(path_str, allow_external)?;
        let mut entries = tokio::fs::read_dir(&safe_path).await?;
        let mut results = Vec::new();

        while let Some(entry) = entries.next_entry().await? {
            let meta = entry.metadata().await?;
            let file_type = if meta.is_dir() { "DIR" } else { "FILE" };
            results.push(format!("{} - {}", file_type, entry.file_name().to_string_lossy()));
        }

        Ok(results.join("\n"))
    }

    async fn execute_command(&self, command: &str, working_dir: Option<&str>, allow_external: bool) -> anyhow::Result<String> {
        let mut cmd_str = command.trim().to_string();
        let ws = if let Some(dir) = working_dir {
            self.sanitize_path(dir, allow_external)?
        } else {
            self.workspace_root()
        };

        // Di Linux, perintah ping berjalan selamanya jika tanpa flag -c.
        // Otomatis tambahkan -c 4 jika user mengetik ping tanpa argumen hitungan.
        if cmd_str.starts_with("ping ") && !cmd_str.contains(" -c ") && !cmd_str.contains(" -c") {
            cmd_str = format!("{} -c 4", cmd_str);
        }

        tokio::task::spawn_blocking(move || -> anyhow::Result<String> {
            // Bungkus dengan timeout 15 detik untuk mencegah hang pada perintah interaktif
            let wrapped_cmd = format!("timeout 15s bash -c {:?}", cmd_str);
            let mut cmd = std::process::Command::new("bash");
            cmd.arg("-c")
                .arg(&wrapped_cmd)
                .current_dir(&ws);

            let output = cmd.output()?;
            let stdout_str = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr_str = String::from_utf8_lossy(&output.stderr).to_string();

            let mut out = String::new();
            if !stdout_str.is_empty() {
                out.push_str(&stdout_str);
            }
            if !stderr_str.is_empty() {
                if !out.is_empty() {
                    out.push('\n');
                }
                out.push_str(&stderr_str);
            }
            if output.status.code() == Some(124) {
                if !out.is_empty() {
                    out.push('\n');
                }
                out.push_str("[Proses dihentikan: batas waktu 15 detik tercapai]");
            }
            Ok(out)
        })
        .await?
    }

    async fn web_fetch(&self, url: &str) -> anyhow::Result<String> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()?;
        let res = client.get(url).send().await?;
        let text = res.text().await?;
        let truncated = if text.len() > 10000 {
            format!("{}...\n[Truncated to 10k chars]", &text[..10000])
        } else {
            text
        };
        Ok(truncated)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_path_blocks_traversal() {
        let workspace = PathBuf::from("/media/yudz/FLASHDISK/Agentic");
        let runner = ToolRunner::new(workspace.clone());

        // Attempt traversal with ..
        let res1 = runner.sanitize_path("../etc/passwd", false);
        assert!(res1.is_err(), "Must block ../etc/passwd");
        let err1 = res1.unwrap_err().to_string();
        assert!(err1.contains("Security confinement violation"));

        // Deep traversal
        let res2 = runner.sanitize_path("../../../../../etc/shadow", false);
        assert!(res2.is_err(), "Must block deep parent traversal");

        // Absolute path outside workspace
        let res3 = runner.sanitize_path("/etc/passwd", false);
        assert!(res3.is_err(), "Must block absolute path outside workspace");

        let res4 = runner.sanitize_path("/var/log/syslog", false);
        assert!(res4.is_err(), "Must block absolute path to /var/log");
    }

    #[test]
    fn test_sanitize_path_confines_within_workspace() {
        let workspace = PathBuf::from("/media/yudz/FLASHDISK/Agentic");
        let runner = ToolRunner::new(workspace.clone());

        // Relative path inside workspace
        let res1 = runner.sanitize_path("src/main.rs", false).expect("Valid relative path");
        assert_eq!(res1, workspace.join("src/main.rs"));

        // Relative with .
        let res2 = runner.sanitize_path("./src/lib.rs", false).expect("Valid ./ path");
        assert_eq!(res2, workspace.join("src/lib.rs"));

        // Inner .. that remains inside workspace
        let res3 = runner.sanitize_path("src/../Cargo.toml", false).expect("Valid inner ..");
        assert_eq!(res3, workspace.join("Cargo.toml"));

        // Absolute path inside workspace
        let res4 = runner
            .sanitize_path("/media/yudz/FLASHDISK/Agentic/src/db/mod.rs", false)
            .expect("Valid absolute path within workspace");
        assert_eq!(res4, workspace.join("src/db/mod.rs"));
    }

    #[test]
    fn test_sanitize_path_allow_external() {
        let workspace = PathBuf::from("/media/yudz/FLASHDISK/Agentic");
        let runner = ToolRunner::new(workspace.clone());

        // External temp directory is allowed when allow_external is true
        let temp_file = std::env::temp_dir().join("agentic_external_test.txt");
        let res1 = runner.sanitize_path(&temp_file.to_string_lossy(), true);
        assert!(res1.is_ok(), "External path should be allowed with allow_external: true");

        // Dangerous virtual system paths are still blocked even with allow_external
        let res_proc = runner.sanitize_path("/proc/cpuinfo", true);
        assert!(res_proc.is_err(), "Must block /proc even if allow_external is true");

        let res_dev = runner.sanitize_path("/dev/null", true);
        assert!(res_dev.is_err(), "Must block /dev even if allow_external is true");
    }

    #[test]
    fn test_tool_runner_read_write() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(async {
            let temp_dir = std::env::temp_dir().join(format!("agentic_test_{}", uuid::Uuid::new_v4()));
            std::fs::create_dir_all(&temp_dir).unwrap();
            let runner = ToolRunner::new(temp_dir.clone());

        let write_req = ToolCallRequest {
            id: "t-write".to_string(),
            tool_name: "write_file".to_string(),
            parameters: serde_json::json!({
                "path": "test_output.txt",
                "content": "Hello Autonomous Native Hub!"
            }),
            requires_clearance: false,
            risk_level: "Low".to_string(),
        };

        let write_res = runner.execute_tool(&write_req).await;
        assert!(write_res.success);

        let read_req = ToolCallRequest {
            id: "t-read".to_string(),
            tool_name: "read_file".to_string(),
            parameters: serde_json::json!({
                "path": "test_output.txt"
            }),
            requires_clearance: false,
            risk_level: "Low".to_string(),
        };

        let read_res = runner.execute_tool(&read_req).await;
        assert!(read_res.success);
        assert_eq!(read_res.output, "Hello Autonomous Native Hub!");

        // Traversal write attempt should fail
        let bad_write_req = ToolCallRequest {
            id: "t-bad".to_string(),
            tool_name: "write_file".to_string(),
            parameters: serde_json::json!({
                "path": "../escape.txt",
                "content": "Malicious payload"
            }),
            requires_clearance: false,
            risk_level: "High".to_string(),
        };
        let bad_res = runner.execute_tool(&bad_write_req).await;
        assert!(!bad_res.success);
        assert!(bad_res.output.contains("Security confinement violation"));

        std::fs::remove_dir_all(&temp_dir).ok();
        });
    }
}
