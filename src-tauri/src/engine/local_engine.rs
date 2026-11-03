use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use serde::{Deserialize, Serialize};
use tauri::Emitter;

pub const DEFAULT_LOCAL_MODEL_SOURCE: &str = "hf.co/bartowski/LFM3-1.7B-GGUF:Q4_K_M";
pub const DEFAULT_LOCAL_MODEL_NAME: &str = "lfm3:1.7b";

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct LocalEngineStatus {
    pub is_running: bool,
    pub has_model: bool,
    pub status: String, // "idle" | "ready" | "ready_no_model" | "downloading_model" | "not_installed" | "error"
    pub progress: f32,
    pub message: String,
}

static ENGINE_STATE: Mutex<Option<LocalEngineStatus>> = Mutex::new(None);
static IS_INITIALIZING: AtomicBool = AtomicBool::new(false);
static IS_DOWNLOADING_MODEL: AtomicBool = AtomicBool::new(false);
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
        message: "Mesin lokal belum diperiksa".to_string(),
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

pub async fn get_installed_models() -> Result<Vec<String>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get("http://127.0.0.1:11434/api/tags")
        .send()
        .await
        .map_err(|e| format!("Gagal menghubungi Ollama: {}", e))?;

    let json = resp
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Respon Ollama tidak valid: {}", e))?;

    let mut result = Vec::new();
    if let Some(models) = json.get("models").and_then(|m| m.as_array()) {
        for m in models {
            if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                result.push(name.to_string());
            }
        }
    }
    Ok(result)
}

fn find_system_ollama() -> Option<PathBuf> {
    if let Ok(output) = Command::new("which").arg("ollama").output() {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() {
                return Some(PathBuf::from(path_str));
            }
        }
    }
    for p in &["/usr/bin/ollama", "/usr/local/bin/ollama"] {
        let pb = PathBuf::from(p);
        if pb.exists() {
            return Some(pb);
        }
    }
    None
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

pub fn pull_and_alias_model(app_handle: Option<&tauri::AppHandle>) -> Result<(), String> {
    if IS_DOWNLOADING_MODEL.swap(true, Ordering::SeqCst) {
        return Err("Pengunduhan model lokal sedang berlangsung".to_string());
    }

    update_engine_status(
        LocalEngineStatus {
            is_running: true,
            has_model: false,
            status: "downloading_model".to_string(),
            progress: 0.0,
            message: "Mempersiapkan pengunduhan model LFM3 1.7B...".to_string(),
        },
        app_handle,
    );

    let body = serde_json::json!({
        "name": DEFAULT_LOCAL_MODEL_SOURCE,
        "stream": true
    });
    let body_str = serde_json::to_string(&body).map_err(|e| {
        IS_DOWNLOADING_MODEL.store(false, Ordering::SeqCst);
        e.to_string()
    })?;

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

    let mut child = curl_cmd.spawn().map_err(|e| {
        IS_DOWNLOADING_MODEL.store(false, Ordering::SeqCst);
        format!("Gagal memicu curl pull: {}", e)
    })?;

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
                                format!("Mengunduh model LFM3... ({:.1}%)", progress)
                            } else {
                                "Mengunduh model LFM3...".to_string()
                            },
                        },
                        app_handle,
                    );
                }
            }
        }
    }
    let _ = child.wait();

    // Buat alias nama model ke lfm3:1.7b via /api/copy
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

    IS_DOWNLOADING_MODEL.store(false, Ordering::SeqCst);

    update_engine_status(
        LocalEngineStatus {
            is_running: true,
            has_model: true,
            status: "ready".to_string(),
            progress: 100.0,
            message: "Model LFM3 1.7B berhasil diunduh dan siap digunakan".to_string(),
        },
        app_handle,
    );

    Ok(())
}

pub async fn delete_local_model_api(model_name: &str) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({ "name": model_name });

    let resp = client
        .delete("http://127.0.0.1:11434/api/delete")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gagal menghapus model via Ollama: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Gagal menghapus model. Status HTTP: {}", resp.status()));
    }

    Ok(())
}

pub fn start_background_engine(app_handle: Option<tauri::AppHandle>) {
    if IS_INITIALIZING.swap(true, Ordering::SeqCst) {
        return;
    }

    tauri::async_runtime::spawn(async move {
        let app_ref = app_handle.as_ref();

        // 1. Cek apakah Ollama sudah berjalan pada sistem
        let mut is_running = check_ollama_http_running().await;

        if !is_running {
            if let Some(sys_bin) = find_system_ollama() {
                update_engine_status(
                    LocalEngineStatus {
                        is_running: false,
                        has_model: false,
                        status: "starting".to_string(),
                        progress: 10.0,
                        message: "Menghubungkan ke Ollama sistem...".to_string(),
                    },
                    app_ref,
                );

                if let Ok(()) = spawn_ollama_serve(&sys_bin) {
                    for _ in 0..20 {
                        tokio::time::sleep(Duration::from_millis(500)).await;
                        if check_ollama_http_running().await {
                            is_running = true;
                            break;
                        }
                    }
                }
            }
        }

        if !is_running {
            IS_INITIALIZING.store(false, Ordering::SeqCst);
            update_engine_status(
                LocalEngineStatus {
                    is_running: false,
                    has_model: false,
                    status: "not_installed".to_string(),
                    progress: 0.0,
                    message: "Ollama tidak terdeteksi pada sistem. Pasang Ollama jika ingin menggunakan model lokal.".to_string(),
                },
                app_ref,
            );
            return;
        }

        // 2. Cek ketersediaan model LFM3 tanpa mengunduhnya secara otomatis
        let has_model = check_model_exists(DEFAULT_LOCAL_MODEL_NAME).await
            || check_model_exists(DEFAULT_LOCAL_MODEL_SOURCE).await;

        IS_INITIALIZING.store(false, Ordering::SeqCst);

        if has_model {
            update_engine_status(
                LocalEngineStatus {
                    is_running: true,
                    has_model: true,
                    status: "ready".to_string(),
                    progress: 100.0,
                    message: "Model lokal LFM3 siap digunakan".to_string(),
                },
                app_ref,
            );
        } else {
            update_engine_status(
                LocalEngineStatus {
                    is_running: true,
                    has_model: false,
                    status: "ready_no_model".to_string(),
                    progress: 0.0,
                    message: "Ollama aktif. Model LFM3 belum diunduh.".to_string(),
                },
                app_ref,
            );
        }
    });
}
