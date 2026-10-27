use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CliAgentMetadata {
    pub id: String,
    pub name: String,
    pub binary_name: String,
    pub path: Option<String>,
    pub version: Option<String>,
    pub is_installed: bool,
    pub default_args: Vec<String>,
    pub custom_env: HashMap<String, String>,
    pub supports_mcp: bool,
    pub is_custom: bool,
}

struct KnownAgentDefinition {
    id: &'static str,
    name: &'static str,
    binary_name: &'static str,
    version_arg: &'static str,
    supports_mcp: bool,
    extra_dirs: &'static [&'static str],
}

const KNOWN_AGENTS: &[KnownAgentDefinition] = &[
    KnownAgentDefinition {
        id: "claude",
        name: "Claude Code",
        binary_name: "claude",
        version_arg: "--version",
        supports_mcp: true,
        extra_dirs: &[".local/bin", ".npm-global/bin"],
    },
    KnownAgentDefinition {
        id: "agy",
        name: "Google Antigravity",
        binary_name: "agy",
        version_arg: "--version",
        supports_mcp: true,
        extra_dirs: &[".local/bin", ".cargo/bin"],
    },
    KnownAgentDefinition {
        id: "omp",
        name: "Oh My Phi (omp)",
        binary_name: "omp",
        version_arg: "--version",
        supports_mcp: true,
        extra_dirs: &[".local/bin", ".cargo/bin"],
    },
    KnownAgentDefinition {
        id: "opencode",
        name: "OpenCode",
        binary_name: "opencode",
        version_arg: "--version",
        supports_mcp: true,
        extra_dirs: &[".opencode/bin", ".local/bin"],
    },
    KnownAgentDefinition {
        id: "gemini",
        name: "Gemini CLI",
        binary_name: "gemini",
        version_arg: "--version",
        supports_mcp: true,
        extra_dirs: &[".local/bin", ".nvm/versions/node"],
    },
    KnownAgentDefinition {
        id: "codex",
        name: "Codex CLI",
        binary_name: "codex",
        version_arg: "--version",
        supports_mcp: true,
        extra_dirs: &[".local/bin", ".cargo/bin"],
    },
    KnownAgentDefinition {
        id: "aider",
        name: "Aider AI",
        binary_name: "aider",
        version_arg: "--version",
        supports_mcp: false,
        extra_dirs: &[".local/bin"],
    },
    KnownAgentDefinition {
        id: "goose",
        name: "Block Goose",
        binary_name: "goose",
        version_arg: "--version",
        supports_mcp: true,
        extra_dirs: &[".local/bin", ".cargo/bin"],
    },
    KnownAgentDefinition {
        id: "cursor",
        name: "Cursor CLI",
        binary_name: "cursor",
        version_arg: "--version",
        supports_mcp: true,
        extra_dirs: &[".local/bin"],
    },
    KnownAgentDefinition {
        id: "devin",
        name: "Devin CLI",
        binary_name: "devin",
        version_arg: "--version",
        supports_mcp: true,
        extra_dirs: &[".local/bin"],
    },
];

pub fn find_binary_in_path_or_dirs(binary_name: &str, extra_dirs: &[&str]) -> Option<PathBuf> {
    // 1. Check system PATH first
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let candidate = dir.join(binary_name);
            if candidate.is_file() && is_executable(&candidate) {
                return Some(candidate);
            }
        }
    }

    // 2. Check user home relative directories
    if let Some(home) = dirs::home_dir() {
        for sub_dir in extra_dirs {
            let candidate_dir = home.join(sub_dir);
            if candidate_dir.exists() {
                // Handle potential node version directories (like .nvm/versions/node/v.../bin)
                if sub_dir.contains("nvm") {
                    if let Ok(entries) = std::fs::read_dir(&candidate_dir) {
                        for entry in entries.flatten() {
                            let nvm_bin = entry.path().join("bin").join(binary_name);
                            if nvm_bin.is_file() && is_executable(&nvm_bin) {
                                return Some(nvm_bin);
                            }
                        }
                    }
                }

                let direct = candidate_dir.join(binary_name);
                if direct.is_file() && is_executable(&direct) {
                    return Some(direct);
                }
            }
        }
    }

    None
}

#[cfg(unix)]
fn is_executable(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    if let Ok(metadata) = path.metadata() {
        metadata.permissions().mode() & 0o111 != 0
    } else {
        false
    }
}

#[cfg(not(unix))]
fn is_executable(path: &Path) -> bool {
    path.exists()
}

pub fn query_binary_version(binary_path: &Path, arg: &str) -> Option<String> {
    let mut cmd = Command::new(binary_path);
    cmd.arg(arg);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    // Execute with a lightweight child wait loop to ensure quick response
    let mut child = cmd.spawn().ok()?;
    let start = std::time::Instant::now();
    let timeout = Duration::from_millis(1500);

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if status.success() {
                    let output = child.wait_with_output().ok()?;
                    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    let line = stdout.lines().next().unwrap_or("").trim().to_string();
                    if !line.is_empty() {
                        return Some(line);
                    }
                    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                    let err_line = stderr.lines().next().unwrap_or("").trim().to_string();
                    if !err_line.is_empty() {
                        return Some(err_line);
                    }
                }
                return None;
            }
            Ok(None) => {
                if start.elapsed() > timeout {
                    let _ = child.kill();
                    return None;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(_) => return None,
        }
    }
}

pub fn detect_all_cli_agents() -> Vec<CliAgentMetadata> {
    let mut results = Vec::new();

    for def in KNOWN_AGENTS {
        let path = find_binary_in_path_or_dirs(def.binary_name, def.extra_dirs);
        let is_installed = path.is_some();
        let version = path
            .as_ref()
            .and_then(|p| query_binary_version(p, def.version_arg));

        results.push(CliAgentMetadata {
            id: def.id.to_string(),
            name: def.name.to_string(),
            binary_name: def.binary_name.to_string(),
            path: path.map(|p| p.to_string_lossy().to_string()),
            version,
            is_installed,
            default_args: Vec::new(),
            custom_env: HashMap::new(),
            supports_mcp: def.supports_mcp,
            is_custom: false,
        });
    }

    results
}
