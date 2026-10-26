use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitFileItem {
    pub path: String,
    pub status: String, // "modified" | "added" | "deleted" | "renamed" | "untracked"
    pub is_staged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatusResponse {
    pub is_git_repo: bool,
    pub current_branch: String,
    pub upstream_branch: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub staged_files: Vec<GitFileItem>,
    pub unstaged_files: Vec<GitFileItem>,
    pub untracked_files: Vec<GitFileItem>,
}

/// Helper to execute a git command in the given workspace directory
fn run_git_cmd(workspace: &Path, args: &[&str]) -> Result<String> {
    let output = Command::new("git")
        .current_dir(workspace)
        .args(args)
        .output()
        .map_err(|e| anyhow!("Failed to execute git command {:?}: {}", args, e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let out_msg = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let full_msg = if !err_msg.is_empty() {
            err_msg
        } else if !out_msg.is_empty() {
            out_msg
        } else {
            format!("Git command failed with exit code: {:?}", output.status.code())
        };
        return Err(anyhow!("{}", full_msg));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Parse git status and branch information
pub fn get_git_status(workspace: &Path) -> Result<GitStatusResponse> {
    // Check if repository exists
    let is_inside = Command::new("git")
        .current_dir(workspace)
        .args(["rev-parse", "--is-inside-work-tree"])
        .output();

    if is_inside.is_err() || !is_inside.as_ref().unwrap().status.success() {
        return Ok(GitStatusResponse {
            is_git_repo: false,
            current_branch: String::new(),
            upstream_branch: None,
            ahead: 0,
            behind: 0,
            staged_files: Vec::new(),
            unstaged_files: Vec::new(),
            untracked_files: Vec::new(),
        });
    }

    let status_out = run_git_cmd(workspace, &["status", "--porcelain=v1", "-b"])?;

    let mut current_branch = String::from("main");
    let mut upstream_branch = None;
    let mut ahead = 0u32;
    let mut behind = 0u32;

    let mut staged_files = Vec::new();
    let mut unstaged_files = Vec::new();
    let mut untracked_files = Vec::new();

    for line in status_out.lines() {
        if line.starts_with("##") {
            // Header line: e.g. ## main...origin/main [ahead 1, behind 2] or ## No commits yet on main
            let header = line.trim_start_matches("##").trim();
            if header.starts_with("No commits yet on ") {
                current_branch = header.trim_start_matches("No commits yet on ").trim().to_string();
            } else if header.starts_with("Initial commit on ") {
                current_branch = header.trim_start_matches("Initial commit on ").trim().to_string();
            } else if let Some(space_pos) = header.find(' ') {
                let branch_part = &header[..space_pos];
                let tracking_part = &header[space_pos..];

                if let Some(dots) = branch_part.find("...") {
                    current_branch = branch_part[..dots].to_string();
                    upstream_branch = Some(branch_part[dots + 3..].to_string());
                } else {
                    current_branch = branch_part.to_string();
                }

                // Parse [ahead X, behind Y]
                if let Some(open) = tracking_part.find('[') {
                    if let Some(close) = tracking_part.find(']') {
                        let bracket_content = &tracking_part[open + 1..close];
                        for seg in bracket_content.split(',') {
                            let s = seg.trim();
                            if s.starts_with("ahead") {
                                if let Some(n_str) = s.strip_prefix("ahead ") {
                                    ahead = n_str.parse::<u32>().unwrap_or(0);
                                }
                            } else if s.starts_with("behind") {
                                if let Some(n_str) = s.strip_prefix("behind ") {
                                    behind = n_str.parse::<u32>().unwrap_or(0);
                                }
                            }
                        }
                    }
                }
            } else if let Some(dots) = header.find("...") {
                current_branch = header[..dots].to_string();
                upstream_branch = Some(header[dots + 3..].to_string());
            } else {
                current_branch = header.to_string();
            }
            continue;
        }

        if line.len() < 3 {
            continue;
        }

        let staged_code = line.chars().next().unwrap_or(' ');
        let unstaged_code = line.chars().nth(1).unwrap_or(' ');
        let raw_path = line[3..].trim().to_string();
        let path = if raw_path.contains(" -> ") {
            raw_path.split(" -> ").last().unwrap_or(&raw_path).to_string()
        } else {
            raw_path
        };

        // Untracked
        if staged_code == '?' && unstaged_code == '?' {
            untracked_files.push(GitFileItem {
                path,
                status: "untracked".to_string(),
                is_staged: false,
            });
            continue;
        }

        // Staged status
        if staged_code != ' ' && staged_code != '?' {
            let status = match staged_code {
                'M' => "modified",
                'A' => "added",
                'D' => "deleted",
                'R' => "renamed",
                _ => "modified",
            };
            staged_files.push(GitFileItem {
                path: path.clone(),
                status: status.to_string(),
                is_staged: true,
            });
        }

        // Unstaged status
        if unstaged_code != ' ' && unstaged_code != '?' {
            let status = match unstaged_code {
                'M' => "modified",
                'D' => "deleted",
                _ => "modified",
            };
            unstaged_files.push(GitFileItem {
                path,
                status: status.to_string(),
                is_staged: false,
            });
        }
    }

    Ok(GitStatusResponse {
        is_git_repo: true,
        current_branch,
        upstream_branch,
        ahead,
        behind,
        staged_files,
        unstaged_files,
        untracked_files,
    })
}

/// Get git diff for a specific file or the entire repository
pub fn get_git_diff(workspace: &Path, file_path: Option<&str>, staged: bool) -> Result<String> {
    let mut args = vec!["diff"];
    if staged {
        args.push("--cached");
    }

    if let Some(fp) = file_path {
        args.push("--");
        args.push(fp);
    }

    let diff_out = run_git_cmd(workspace, &args)?;

    // If unstaged diff is empty and a file_path is given, it might be an untracked file
    if diff_out.trim().is_empty() && !staged {
        if let Some(fp) = file_path {
            let target_file = workspace.join(fp);
            if target_file.is_file() {
                // Generate a synthetic unified diff for untracked file
                let content = std::fs::read_to_string(&target_file).unwrap_or_default();
                let lines_count = content.lines().count();
                let mut synth = format!("--- /dev/null\n+++ b/{}\n@@ -0,0 +1,{} @@\n", fp, lines_count.max(1));
                for line in content.lines() {
                    synth.push('+');
                    synth.push_str(line);
                    synth.push('\n');
                }
                return Ok(synth);
            }
        }
    }

    Ok(diff_out)
}

/// Stage a specific file
pub fn git_stage_file(workspace: &Path, file_path: &str) -> Result<()> {
    run_git_cmd(workspace, &["add", "--", file_path])?;
    Ok(())
}

/// Stage all changes
pub fn git_stage_all(workspace: &Path) -> Result<()> {
    run_git_cmd(workspace, &["add", "-A"])?;
    Ok(())
}

/// Unstage a specific file
pub fn git_unstage_file(workspace: &Path, file_path: &str) -> Result<()> {
    // Try restore --staged first, fallback to reset HEAD --
    if run_git_cmd(workspace, &["restore", "--staged", "--", file_path]).is_err() {
        run_git_cmd(workspace, &["reset", "HEAD", "--", file_path])?;
    }
    Ok(())
}

/// Unstage all changes
pub fn git_unstage_all(workspace: &Path) -> Result<()> {
    if run_git_cmd(workspace, &["restore", "--staged", "."]).is_err() {
        run_git_cmd(workspace, &["reset", "HEAD"])?;
    }
    Ok(())
}

/// Discard changes in a file
pub fn git_discard_file(workspace: &Path, file_path: &str) -> Result<()> {
    let target = workspace.join(file_path);

    // If file is untracked, remove it from disk
    let is_tracked = Command::new("git")
        .current_dir(workspace)
        .args(["ls-files", "--error-unmatch", "--", file_path])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !is_tracked {
        if target.is_file() {
            std::fs::remove_file(&target).map_err(|e| anyhow!("Failed to remove untracked file: {}", e))?;
        } else if target.is_dir() {
            std::fs::remove_dir_all(&target).map_err(|e| anyhow!("Failed to remove untracked dir: {}", e))?;
        }
        return Ok(());
    }

    // If tracked, unstage if needed then restore worktree
    let _ = run_git_cmd(workspace, &["restore", "--staged", "--", file_path]);
    run_git_cmd(workspace, &["restore", "--", file_path])?;
    Ok(())
}

/// Create a git commit with the given message
pub fn git_commit(workspace: &Path, message: &str) -> Result<String> {
    if message.trim().is_empty() {
        return Err(anyhow!("Commit message cannot be empty"));
    }
    run_git_cmd(workspace, &["commit", "-m", message])
}

/// Push commits to remote
pub fn git_push(workspace: &Path) -> Result<String> {
    run_git_cmd(workspace, &["push"])
}

/// Pull commits from remote
pub fn git_pull(workspace: &Path) -> Result<String> {
    run_git_cmd(workspace, &["pull"])
}

/// Fetch from remote
pub fn git_fetch(workspace: &Path) -> Result<String> {
    run_git_cmd(workspace, &["fetch"])
}

/// List local branches
pub fn git_list_branches(workspace: &Path) -> Result<Vec<String>> {
    let out = run_git_cmd(workspace, &["branch", "--list", "--no-color"])?;
    let mut branches = Vec::new();

    for line in out.lines() {
        let clean = line.trim_start_matches('*').trim();
        if !clean.is_empty() {
            branches.push(clean.to_string());
        }
    }

    Ok(branches)
}

/// Checkout an existing branch
pub fn git_checkout_branch(workspace: &Path, branch: &str) -> Result<()> {
    run_git_cmd(workspace, &["checkout", branch])?;
    Ok(())
}

/// Create and checkout a new branch
pub fn git_create_branch(workspace: &Path, branch_name: &str) -> Result<()> {
    run_git_cmd(workspace, &["checkout", "-b", branch_name])?;
    Ok(())
}

/// Clone a git repository into the specified directory
pub fn git_clone_repo(target_dir: &Path, repo_url: &str) -> Result<String> {
    if let Some(parent) = target_dir.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)?;
        }
    }
    let output = Command::new("git")
        .args(["clone", repo_url, target_dir.to_str().unwrap_or("")])
        .output()
        .map_err(|e| anyhow!("Failed to execute git clone: {}", e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(anyhow!("Git clone failed: {}", err_msg));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_git_status_on_temp_repo() {
        let temp_dir = std::env::temp_dir().join(format!("agentic_git_test_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&temp_dir);

        // Run git init
        let init = Command::new("git")
            .current_dir(&temp_dir)
            .args(["init", "-b", "main"])
            .output();

        if let Ok(out) = init {
            if out.status.success() {
                // Configure dummy author for committing
                let _ = Command::new("git")
                    .current_dir(&temp_dir)
                    .args(["config", "user.name", "Test User"])
                    .output();
                let _ = Command::new("git")
                    .current_dir(&temp_dir)
                    .args(["config", "user.email", "test@example.com"])
                    .output();

                let status = get_git_status(&temp_dir);
                assert!(status.is_ok());
                let res = status.unwrap();
                assert!(res.is_git_repo);
                assert_eq!(res.current_branch, "main");

                // Create a test file
                let test_file = temp_dir.join("test.txt");
                std::fs::write(&test_file, "hello git\n").unwrap();

                let status_after = get_git_status(&temp_dir).unwrap();
                assert_eq!(status_after.untracked_files.len(), 1);
                assert_eq!(status_after.untracked_files[0].path, "test.txt");

                // Test staging
                let stage_res = git_stage_file(&temp_dir, "test.txt");
                assert!(stage_res.is_ok());

                let status_staged = get_git_status(&temp_dir).unwrap();
                assert_eq!(status_staged.staged_files.len(), 1);
                assert_eq!(status_staged.staged_files[0].status, "added");

                // Test diff
                let diff_res = get_git_diff(&temp_dir, Some("test.txt"), true);
                assert!(diff_res.is_ok());
                assert!(diff_res.unwrap().contains("+hello git"));

                // Test commit
                let commit_res = git_commit(&temp_dir, "feat: test commit");
                assert!(commit_res.is_ok());

                let status_committed = get_git_status(&temp_dir).unwrap();
                assert!(status_committed.staged_files.is_empty());
                assert!(status_committed.unstaged_files.is_empty());
            }
        }

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_git_status_non_repo() {
        let temp_non_repo = std::env::temp_dir().join(format!("agentic_non_git_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&temp_non_repo);

        let status = get_git_status(&temp_non_repo).unwrap();
        assert!(!status.is_git_repo);

        let _ = std::fs::remove_dir_all(&temp_non_repo);
    }

    #[test]
    fn test_git_clone_local_repo() {
        let origin_dir = std::env::temp_dir().join(format!("agentic_git_origin_{}", uuid::Uuid::new_v4()));
        let clone_dir = std::env::temp_dir().join(format!("agentic_git_cloned_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&origin_dir);

        let init = Command::new("git")
            .current_dir(&origin_dir)
            .args(["init", "-b", "main"])
            .output();

        if let Ok(out) = init {
            if out.status.success() {
                let _ = Command::new("git")
                    .current_dir(&origin_dir)
                    .args(["config", "user.name", "Test User"])
                    .output();
                let _ = Command::new("git")
                    .current_dir(&origin_dir)
                    .args(["config", "user.email", "test@example.com"])
                    .output();
                let _ = std::fs::write(origin_dir.join("sample.txt"), "hello clone");
                let _ = Command::new("git")
                    .current_dir(&origin_dir)
                    .args(["add", "sample.txt"])
                    .output();
                let _ = Command::new("git")
                    .current_dir(&origin_dir)
                    .args(["commit", "-m", "init"])
                    .output();

                let res = git_clone_repo(&clone_dir, origin_dir.to_str().unwrap());
                assert!(res.is_ok());
                assert!(clone_dir.join("sample.txt").exists());
            }
        }

        let _ = std::fs::remove_dir_all(&origin_dir);
        let _ = std::fs::remove_dir_all(&clone_dir);
    }
}
