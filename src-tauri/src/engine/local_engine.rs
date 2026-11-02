use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use serde::{Deserialize, Serialize};
use tauri::Emitter;

pub const OLLAMA_DOWNLOAD_URL: &str =
    "https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64.tar.zst";
pub const DEFAULT_LOCAL_MODEL_SOURCE: &str = "hf.co/bartowski/LFM3-1.7B-GGUF:Q4_K_M";
pub const DEFAULT_LOCAL_MODEL_NAME: &str = "lfm3:1.7b";

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct LocalEngineStatus {
    pub is_running: bool,
    pub has_model: bool,
    pub status: String, // "idle" | "starting" | "downloading_binary" | "downloading_model" | "ready" | "error"
    pub progress: f32,
    pub message: String,
}

static ENGINE_STATE: Mutex<Option<LocalEngineStatus>> = Mutex::new(None);
static IS_INITIALIZING: AtomicBool = AtomicBool::new(false);
static CHILD_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

pub fn get_engine_status() -> LocalEngineStatus {
    if let Ok(guard) = ENGINE_STATE.lock() {
        if let Some(s) = &*guard {
            return s.clone();
        }
    }
    LocalEngineStatus {
        is_running: false,
        has_model: false,
        status: "idle".to_string(),
        progress: 0.0,
        message: "Mesin lokal belum dimulai".to_string(),
    }
}

pub fn update_engine_status(
    status: LocalEngineStatus,
    app_handle: Option<&tauri::AppHandle>,
) {
    if let Ok(mut guard) = ENGINE_STATE.lock() {
        *guard = Some(status.clone());
    }
    if let Some(app) = app_handle {
        let _ = app.emit("local-engine-status-changed", &status);
    }
}

fn get_app_data_folder() -> PathBuf {
    let is_beta = std::env::var("AGENTIC_BETA").unwrap_or_default() == "1"
        || std::env::current_exe()
            .map(|p| p.to_string_lossy().to_lowercase().contains("beta"))
            .unwrap_or(false);
    let folder = if is_beta { "agentic_native_hub_beta" } else { "agentic_native_hub" };
    dirs::data_dir().unwrap_or_else(|| PathBuf::from(".")).join(folder)
}

fn get_ollama_binary_path() -> PathBuf {
    get_app_data_folder().join("bin").join("ollama")
}

pub async fn check_ollama_http_running() -> bool {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(800))
        .build();
    if let Ok(c) = client {
        if let Ok(resp) = c.get("http://127.0.0.1:11434/").send().await {
            return resp.status().is_success();
        }
    }
    false
}

pub async fn check_model_exists(model_name: &str) -> bool {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build();
    if let Ok(c) = client {
        if let Ok(resp) = c.get("http://127.0.0.1:11434/api/tags").send().await {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(models) = json.get("models").and_then(|m| m.as_array()) {
                    for m in models {
                        if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                            if name == model_name || name.starts_with(model_name) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
    }
    false
}

fn find_or_install_binary(app_handle: Option<&tauri::AppHandle>) -> Result<PathBuf, String> {
    let local_bin = get_ollama_binary_path();
    if local_bin.exists() {
        return Ok(local_bin);
    }

    // Coba periksa apakah ollama terpasang di PATH sistem
    if let Ok(output) = Command::new("which").arg("ollama").output() {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() {
                return Ok(PathBuf::from(path_str));
            }
        }
    }

    // Unduh archive portable user-space
    update_engine_status(
        LocalEngineStatus {
            is_running: false,
            has_model: false,
            status: "downloading_binary".to_string(),
            progress: 10.0,
            message: "Menyiapkan mesin runtime lokal...".to_string(),
        },
        app_handle,
    );

    let base_folder = get_app_data_folder();
    let bin_dir = base_folder.join("bin");
    let lib_dir = base_folder.join("lib");
    let _ = std::fs::create_dir_all(&bin_dir);
    let _ = std::fs::create_dir_all(&lib_dir);

    let temp_archive = base_folder.join("ollama.tar.zst");

    // Unduh via curl dengan resume
    let mut curl_cmd = Command::new("curl");
    curl_cmd
        .arg("-sL")
        .arg("-f")
        .arg("-o")
        .arg(&temp_archive)
        .arg(OLLAMA_DOWNLOAD_URL);

    let curl_status = curl_cmd.status().map_err(|e| format!("Gagal mengunduh binary Ollama: {}", e))?;
    if !curl_status.success() {
        let _ = std::fs::remove_file(&temp_archive);
        return Err("Download binary Ollama gagal".to_string());
    }

    // Ekstrak archive
    let mut tar_cmd = Command::new("tar");
    tar_cmd
        .arg("--zstd")
        .arg("-xf")
        .arg(&temp_archive)
        .arg("-C")
        .arg(&base_folder);

    let tar_status = tar_cmd.status().map_err(|e| format!("Gagal mengekstrak binary Ollama: {}", e))?;
    let _ = std::fs::remove_file(&temp_archive);

    if !tar_status.success() {
        return Err("Ekstraksi binary Ollama gagal".to_string());
    }

    if local_bin.exists() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(meta) = std::fs::metadata(&local_bin) {
                let mut perms = meta.permissions();
                perms.set_mode(0o755);
                let _ = std::fs::set_permissions(&local_bin, perms);
            }
        }
        Ok(local_bin)
    } else {
        Err("Binary Ollama tidak ditemukan setelah ekstraksi".to_string())
    }
}

fn spawn_ollama_serve(bin_path: &PathBuf) -> Result<(), String> {
    let mut cmd = Command::new(bin_path);
    cmd.arg("serve");
    cmd.env("OLLAMA_ORIGINS", "*");
    cmd.env("OLLAMA_HOST", "127.0.0.1:11434");
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());

    let child = cmd.spawn().map_err(|e| format!("Gagal menjalankan ollama serve: {}", e))?;
    if let Ok(mut lock) = CHILD_PROCESS.lock() {
        *lock = Some(child);
    }
    Ok(())
}

fn pull_and_alias_model(app_handle: Option<&tauri::AppHandle>) -> Result<(), String> {
    update_engine_status(
        LocalEngineStatus {
            is_running: true,
            has_model: false,
            status: "downloading_model".to_string(),
            progress: 0.0,
            message: "Mengunduh model LFM3 1.7B di background...".to_string(),
        },
        app_handle,
    );

    let body = serde_json::json!({
        "name": DEFAULT_LOCAL_MODEL_SOURCE,
        "stream": true
    });
    let body_str = serde_json::to_string(&body).map_err(|e| e.to_string())?;

    let mut curl_cmd = Command::new("curl");
    curl_cmd
        .arg("-sN")
        .arg("-X")
        .arg("POST")
        .arg("http://127.0.0.1:11434/api/pull")
        .arg("-H")
        .arg("Content-Type: application/json")
        .arg("-d")
        .arg(&body_str)
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    let mut child = curl_cmd.spawn().map_err(|e| format!("Gagal memicu curl pull: {}", e))?;
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line_text) = line {
                let trimmed = line_text.trim();
                if trimmed.is_empty() {
                    continue;
                }

                if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
                    let status_str = val.get("status").and_then(|s| s.as_str()).unwrap_or("");
                    let total = val.get("total").and_then(|t| t.as_u64()).unwrap_or(0);
                    let completed = val.get("completed").and_then(|c| c.as_u64()).unwrap_or(0);

                    let progress = if total > 0 {
                        ((completed as f64 / total as f64) * 100.0) as f32
                    } else {
                        0.0
                    };

                    update_engine_status(
                        LocalEngineStatus {
                            is_running: true,
                            has_model: false,
                            status: "downloading_model".to_string(),
                            progress,
                            message: if !status_str.is_empty() {
                                format!("Mengunduh model lokal... ({:.0}%)", progress)
                            } else {
                                "Mengunduh model lokal di background...".to_string()
                            },
                        },
                        app_handle,
                    );
                }
            }
        }
    }
    let _ = child.wait();

    // Alias model ke lfm3:1.7b via /api/copy
    let copy_body = serde_json::json!({
        "source": DEFAULT_LOCAL_MODEL_SOURCE,
        "destination": DEFAULT_LOCAL_MODEL_NAME
    });
    if let Ok(copy_str) = serde_json::to_string(&copy_body) {
        let mut copy_cmd = Command::new("curl");
        copy_cmd
            .arg("-s")
            .arg("-X")
            .arg("POST")
            .arg("http://127.0.0.1:11434/api/copy")
            .arg("-H")
            .arg("Content-Type: application/json")
            .arg("-d")
            .arg(&copy_str);
        let _ = copy_cmd.output();
    }

    Ok(())
}

pub fn start_background_engine(app_handle: Option<tauri::AppHandle>) {
    if IS_INITIALIZING.swap(true, Ordering::SeqCst) {
        return;
    }

    tauri::async_runtime::spawn(async move {
        let app_ref = app_handle.as_ref();

        // 1. Cek apakah Ollama sudah berjalan
        let mut is_running = check_ollama_http_running().await;

        if !is_running {
            update_engine_status(
                LocalEngineStatus {
                    is_running: false,
                    has_model: false,
                    status: "starting".to_string(),
                    progress: 5.0,
                    message: "Menyiapkan engine lokal...".to_string(),
                },
                app_ref,
            );

            match find_or_install_binary(app_ref) {
                Ok(bin_path) => {
                    if let Err(e) = spawn_ollama_serve(&bin_path) {
                        IS_INITIALIZING.store(false, Ordering::SeqCst);
                        update_engine_status(
                            LocalEngineStatus {
                                is_running: false,
                                has_model: false,
                                status: "error".to_string(),
                                progress: 0.0,
                                message: e,
                            },
                            app_ref,
                        );
                        return;
                    }

                    // Tunggu hingga HTTP port merespons (maks 15 detik)
                    for _ in 0..30 {
                        tokio::time::sleep(Duration::from_millis(500)).await;
                        if check_ollama_http_running().await {
                            is_running = true;
                            break;
                        }
                    }
                }
                Err(e) => {
                    IS_INITIALIZING.store(false, Ordering::SeqCst);
                    update_engine_status(
                        LocalEngineStatus {
                            is_running: false,
                            has_model: false,
                            status: "error".to_string(),
                            progress: 0.0,
                            message: e,
                        },
                        app_ref,
                    );
                    return;
                }
            }
        }

        if !is_running {
            IS_INITIALIZING.store(false, Ordering::SeqCst);
            update_engine_status(
                LocalEngineStatus {
                    is_running: false,
                    has_model: false,
                    status: "error".to_string(),
                    progress: 0.0,
                    message: "Port engine lokal 11434 tidak merespons".to_string(),
                },
                app_ref,
            );
            return;
        }

        // 2. Cek apakah model lfm3:1.7b sudah tersedia
        let has_model = check_model_exists(DEFAULT_LOCAL_MODEL_NAME).await
            || check_model_exists(DEFAULT_LOCAL_MODEL_SOURCE).await;

        if !has_model {
            if let Err(e) = pull_and_alias_model(app_ref) {
                IS_INITIALIZING.store(false, Ordering::SeqCst);
                update_engine_status(
                    LocalEngineStatus {
                        is_running: true,
                        has_model: false,
                        status: "error".to_string(),
                        progress: 0.0,
                        message: e,
                    },
                    app_ref,
                );
                return;
            }
        }

        IS_INITIALIZING.store(false, Ordering::SeqCst);
        update_engine_status(
            LocalEngineStatus {
                is_running: true,
                has_model: true,
                status: "ready".to_string(),
                progress: 100.0,
                message: "Model lokal siap digunakan".to_string(),
            },
            app_ref,
        );
    });
}
