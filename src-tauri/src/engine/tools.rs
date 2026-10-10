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

#[derive(Clone)]
pub struct ToolRunner {
    workspace_root: PathBuf,
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
        Self { workspace_root }
    }

    pub fn workspace_root(&self) -> &Path {
        &self.workspace_root
    }

    pub fn sanitize_path(&self, requested: &str) -> anyhow::Result<PathBuf> {
        let raw = Path::new(requested);
        let candidate = if raw.is_absolute() {
            raw.to_path_buf()
        } else {
            self.workspace_root.join(raw)
        };

        // 1. Lexical normalization (resolve '.' and '..' without requiring file existence)
        let normalized = normalize_path(&candidate);
        let workspace = normalize_path(&self.workspace_root);

        // 2. Strict path confinement check
        if !normalized.starts_with(&workspace) {
            return Err(anyhow::anyhow!(
                "Security confinement violation: Path '{}' is outside workspace '{}'",
                requested,
                self.workspace_root.display()
            ));
        }

        // 3. Symlink escape check for existing paths
        if normalized.exists() {
            let canonical = normalized.canonicalize()?;
            let canonical_ws = self
                .workspace_root
                .canonicalize()
                .unwrap_or_else(|_| workspace);
            if !canonical.starts_with(&canonical_ws) {
                return Err(anyhow::anyhow!(
                    "Security confinement violation: Symlink target '{}' escapes workspace '{}'",
                    canonical.display(),
                    canonical_ws.display()
                ));
            }
            return Ok(canonical);
        }

        Ok(normalized)
    }

    pub async fn execute_tool(&self, request: &ToolCallRequest) -> ToolCallResult {
        let start = std::time::Instant::now();
        let tool_name = request.tool_name.as_str();

        let res = match tool_name {
            "read_file" => {
                let path_str = request.parameters["path"].as_str().unwrap_or("");
                match self.read_file(path_str).await {
                    Ok(content) => Ok(content),
                    Err(e) => Err(format!("Error reading file: {}", e)),
                }
            }
            "write_file" => {
                let path_str = request.parameters["path"].as_str().unwrap_or("");
                let content = request.parameters["content"].as_str().unwrap_or("");
                match self.write_file(path_str, content).await {
                    Ok(msg) => Ok(msg),
                    Err(e) => Err(format!("Error writing file: {}", e)),
                }
            }
            "list_dir" => {
                let path_str = request.parameters["path"].as_str().unwrap_or(".");
                match self.list_dir(path_str).await {
                    Ok(list) => Ok(list),
                    Err(e) => Err(format!("Error listing directory: {}", e)),
                }
            }
            "execute_command" => {
                let cmd_str = request.parameters["command"].as_str().unwrap_or("");
                match self.execute_command(cmd_str).await {
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
            _ => Err(format!("Unknown tool: {}", tool_name)),
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

    async fn read_file(&self, path_str: &str) -> anyhow::Result<String> {
        let safe_path = self.sanitize_path(path_str)?;
        let content = tokio::fs::read_to_string(&safe_path).await?;
        Ok(content)
    }

    async fn write_file(&self, path_str: &str, content: &str) -> anyhow::Result<String> {
        let safe_path = self.sanitize_path(path_str)?;

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

    async fn list_dir(&self, path_str: &str) -> anyhow::Result<String> {
        let safe_path = self.sanitize_path(path_str)?;
        let mut entries = tokio::fs::read_dir(&safe_path).await?;
        let mut results = Vec::new();

        while let Some(entry) = entries.next_entry().await? {
            let meta = entry.metadata().await?;
            let file_type = if meta.is_dir() { "DIR" } else { "FILE" };
            results.push(format!("{} - {}", file_type, entry.file_name().to_string_lossy()));
        }

        Ok(results.join("\n"))
    }

    async fn execute_command(&self, command: &str) -> anyhow::Result<String> {
        let cmd_str = command.to_string();
        let ws = self.workspace_root.clone();

        tokio::task::spawn_blocking(move || -> anyhow::Result<String> {
            let mut cmd = std::process::Command::new("bash");
            cmd.arg("-c")
                .arg(&cmd_str)
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
                out.push_str(&format!("STDERR: {}", stderr_str));
            }
            out.push_str(&format!("\n[Exit status: {}]", output.status));
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
        let res1 = runner.sanitize_path("../etc/passwd");
        assert!(res1.is_err(), "Must block ../etc/passwd");
        let err1 = res1.unwrap_err().to_string();
        assert!(err1.contains("Security confinement violation"));

        // Deep traversal
        let res2 = runner.sanitize_path("../../../../../etc/shadow");
        assert!(res2.is_err(), "Must block deep parent traversal");

        // Absolute path outside workspace
        let res3 = runner.sanitize_path("/etc/passwd");
        assert!(res3.is_err(), "Must block absolute path outside workspace");

        let res4 = runner.sanitize_path("/var/log/syslog");
        assert!(res4.is_err(), "Must block absolute path to /var/log");
    }

    #[test]
    fn test_sanitize_path_confines_within_workspace() {
        let workspace = PathBuf::from("/media/yudz/FLASHDISK/Agentic");
        let runner = ToolRunner::new(workspace.clone());

        // Relative path inside workspace
        let res1 = runner.sanitize_path("src/main.rs").expect("Valid relative path");
        assert_eq!(res1, workspace.join("src/main.rs"));

        // Relative with .
        let res2 = runner.sanitize_path("./src/lib.rs").expect("Valid ./ path");
        assert_eq!(res2, workspace.join("src/lib.rs"));

        // Inner .. that remains inside workspace
        let res3 = runner.sanitize_path("src/../Cargo.toml").expect("Valid inner ..");
        assert_eq!(res3, workspace.join("Cargo.toml"));

        // Absolute path inside workspace
        let res4 = runner
            .sanitize_path("/media/yudz/FLASHDISK/Agentic/src/db/mod.rs")
            .expect("Valid absolute path within workspace");
        assert_eq!(res4, workspace.join("src/db/mod.rs"));
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
