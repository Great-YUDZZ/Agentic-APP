// Git Worktree isolation manager inspired by Orca architecture.
// Confines parallel AI agent workspaces to isolated git branches.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeSessionInfo {
    pub id: String,
    pub task_id: String,
    pub task_title: String,
    pub branch_name: String,
    pub path: String,
    pub assigned_agent: String,
    pub status: String,
    pub created_at: i64,
}

pub struct WorktreeManager;

impl WorktreeManager {
    /// Pastikan direktori .agentic/worktrees terdaftar di .gitignore agar tidak terlacak git
    pub fn ensure_worktrees_ignored(repo_path: &Path) -> Result<(), String> {
        let gitignore_path = repo_path.join(".gitignore");
        let rule = ".agentic/worktrees/";

        if gitignore_path.exists() {
            let content = fs::read_to_string(&gitignore_path)
                .map_err(|e| format!("Gagal membaca .gitignore: {}", e))?;
            if !content.contains(rule) {
                let mut updated = content;
                if !updated.ends_with('\n') {
                    updated.push('\n');
                }
                updated.push_str(rule);
                updated.push('\n');
                fs::write(&gitignore_path, updated)
                    .map_err(|e| format!("Gagal memperbarui .gitignore: {}", e))?;
            }
        } else {
            fs::write(&gitignore_path, format!("{}\n", rule))
                .map_err(|e| format!("Gagal membuat .gitignore: {}", e))?;
        }

        Ok(())
    }

    /// Membuat git worktree baru secara terisolasi untuk task spesifik
    pub fn create_worktree(
        repo_path: &Path,
        task_id: &str,
        task_title: &str,
        branch_name: &str,
        assigned_agent: &str,
    ) -> Result<WorktreeSessionInfo, String> {
        if !repo_path.exists() {
            return Err("Direktori repositori tidak ditemukan.".to_string());
        }

        Self::ensure_worktrees_ignored(repo_path)?;

        let worktrees_root = repo_path.join(".agentic").join("worktrees");
        fs::create_dir_all(&worktrees_root)
            .map_err(|e| format!("Gagal membuat direktori worktrees: {}", e))?;

        let safe_task_id = task_id
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect::<String>();
        let worktree_dir = worktrees_root.join(&safe_task_id);

        if worktree_dir.exists() {
            return Err(format!(
                "Worktree untuk task '{}' sudah ada di: {}",
                task_id,
                worktree_dir.display()
            ));
        }

        let safe_branch = branch_name
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == '/' { c } else { '_' })
            .collect::<String>();

        // Cek apakah branch sudah ada
        let check_branch = Command::new("git")
            .arg("rev-parse")
            .arg("--verify")
            .arg(&safe_branch)
            .current_dir(repo_path)
            .output();

        let branch_exists = match check_branch {
            Ok(output) => output.status.success(),
            Err(_) => false,
        };

        let add_res = if branch_exists {
            Command::new("git")
                .arg("worktree")
                .arg("add")
                .arg(&worktree_dir)
                .arg(&safe_branch)
                .current_dir(repo_path)
                .output()
        } else {
            Command::new("git")
                .arg("worktree")
                .arg("add")
                .arg("-b")
                .arg(&safe_branch)
                .arg(&worktree_dir)
                .current_dir(repo_path)
                .output()
        };

        match add_res {
            Ok(output) => {
                if !output.status.success() {
                    let err = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("Gagal membuat git worktree: {}", err));
                }
            }
            Err(e) => return Err(format!("Gagal mengeksekusi git worktree: {}", e)),
        }

        let now = chrono::Utc::now().timestamp_millis();
        Ok(WorktreeSessionInfo {
            id: format!("wt-{}", safe_task_id),
            task_id: task_id.to_string(),
            task_title: task_title.to_string(),
            branch_name: safe_branch,
            path: worktree_dir.to_string_lossy().to_string(),
            assigned_agent: assigned_agent.to_string(),
            status: "active".to_string(),
            created_at: now,
        })
    }

    /// Mendapatkan daftar worktree yang terdaftar pada git repository
    pub fn list_worktrees(repo_path: &Path) -> Result<Vec<WorktreeSessionInfo>, String> {
        let output = Command::new("git")
            .arg("worktree")
            .arg("list")
            .arg("--porcelain")
            .current_dir(repo_path)
            .output()
            .map_err(|e| format!("Gagal menjalankan git worktree list: {}", e))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Git worktree list error: {}", err));
        }

        let text = String::from_utf8_lossy(&output.stdout);
        let mut results = Vec::new();

        let mut cur_path = String::new();
        let mut cur_branch = String::new();

        for line in text.lines() {
            if line.starts_with("worktree ") {
                cur_path = line.trim_start_matches("worktree ").trim().to_string();
            } else if line.starts_with("branch ") {
                let full_branch = line.trim_start_matches("branch ").trim();
                cur_branch = full_branch
                    .trim_start_matches("refs/heads/")
                    .to_string();
            } else if line.is_empty() {
                if !cur_path.is_empty() {
                    let is_agentic_worktree = cur_path.contains(".agentic/worktrees/");
                    let folder_name = Path::new(&cur_path)
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "main".to_string());

                    results.push(WorktreeSessionInfo {
                        id: if is_agentic_worktree {
                            format!("wt-{}", folder_name)
                        } else {
                            "main-root".to_string()
                        },
                        task_id: folder_name.clone(),
                        task_title: cur_branch.clone(),
                        branch_name: if cur_branch.is_empty() { "HEAD".to_string() } else { cur_branch.clone() },
                        path: cur_path.clone(),
                        assigned_agent: "local".to_string(),
                        status: "active".to_string(),
                        created_at: chrono::Utc::now().timestamp_millis(),
                    });
                }
                cur_path.clear();
                cur_branch.clear();
            }
        }

        if !cur_path.is_empty() {
            let is_agentic_worktree = cur_path.contains(".agentic/worktrees/");
            let folder_name = Path::new(&cur_path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "main".to_string());

            results.push(WorktreeSessionInfo {
                id: if is_agentic_worktree {
                    format!("wt-{}", folder_name)
                } else {
                    "main-root".to_string()
                },
                task_id: folder_name.clone(),
                task_title: cur_branch.clone(),
                branch_name: if cur_branch.is_empty() { "HEAD".to_string() } else { cur_branch },
                path: cur_path,
                assigned_agent: "local".to_string(),
                status: "active".to_string(),
                created_at: chrono::Utc::now().timestamp_millis(),
            });
        }

        Ok(results)
    }

    /// Menghapus git worktree dan membersihkan metadata git
    pub fn remove_worktree(repo_path: &Path, worktree_path: &Path, force: bool) -> Result<(), String> {
        let mut cmd = Command::new("git");
        cmd.arg("worktree").arg("remove");
        if force {
            cmd.arg("--force");
        }
        cmd.arg(worktree_path);
        cmd.current_dir(repo_path);

        let output = cmd.output().map_err(|e| format!("Gagal menghapus worktree: {}", e))?;
        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            // Jika git remove gagal karena direktori sudah hilang, kita prune
            let _ = Command::new("git")
                .arg("worktree")
                .arg("prune")
                .current_dir(repo_path)
                .output();
            if worktree_path.exists() && force {
                let _ = fs::remove_dir_all(worktree_path);
            }
            return Err(format!("Gagal menghapus worktree via git: {}", err));
        }

        let _ = Command::new("git")
            .arg("worktree")
            .arg("prune")
            .current_dir(repo_path)
            .output();

        Ok(())
    }

    /// Menggabungkan (merge) cabang worktree ke cabang utama repositori
    pub fn merge_worktree_branch(repo_path: &Path, branch_name: &str) -> Result<String, String> {
        let output = Command::new("git")
            .arg("merge")
            .arg("--no-ff")
            .arg("-m")
            .arg(format!("Merge branch '{}' from Agentic Worktree", branch_name))
            .arg(branch_name)
            .current_dir(repo_path)
            .output()
            .map_err(|e| format!("Gagal menjalankan git merge: {}", e))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            let out = String::from_utf8_lossy(&output.stdout);
            return Err(format!("Merge conflict atau error: {}\n{}", out, err));
        }

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(stdout)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_worktree_create_and_remove_lifecycle() {
        let temp_dir = env::temp_dir().join(format!("agentic_wt_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).expect("Gagal membuat temp dir");

        // Init git repo
        let init_out = Command::new("git")
            .arg("init")
            .current_dir(&temp_dir)
            .output()
            .expect("Git init failed");
        assert!(init_out.status.success());

        // Config git user
        let _ = Command::new("git")
            .arg("config")
            .arg("user.name")
            .arg("Agentic Tester")
            .current_dir(&temp_dir)
            .output();
        let _ = Command::new("git")
            .arg("config")
            .arg("user.email")
            .arg("test@agentic.local")
            .current_dir(&temp_dir)
            .output();

        // Create initial commit
        fs::write(temp_dir.join("README.md"), "# Test Project\n").unwrap();
        let _ = Command::new("git").arg("add").arg(".").current_dir(&temp_dir).output();
        let commit_out = Command::new("git")
            .arg("commit")
            .arg("-m")
            .arg("Initial commit")
            .current_dir(&temp_dir)
            .output()
            .expect("Commit failed");
        assert!(commit_out.status.success());

        // Create worktree
        let wt_info = WorktreeManager::create_worktree(
            &temp_dir,
            "task-auth",
            "Implement Auth",
            "feat/auth",
            "claude",
        )
        .expect("Worktree creation failed");

        assert_eq!(wt_info.branch_name, "feat/auth");
        assert!(Path::new(&wt_info.path).exists());

        // List worktrees
        let list = WorktreeManager::list_worktrees(&temp_dir).expect("List worktrees failed");
        assert!(list.iter().any(|w| w.branch_name == "feat/auth"));

        // Remove worktree
        WorktreeManager::remove_worktree(&temp_dir, Path::new(&wt_info.path), true)
            .expect("Remove worktree failed");

        assert!(!Path::new(&wt_info.path).exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
