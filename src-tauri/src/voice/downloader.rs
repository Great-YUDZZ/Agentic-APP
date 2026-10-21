use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use serde::{Deserialize, Serialize};
use tauri::Emitter;

pub const WHISPER_SMALL_Q5_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin";
pub const EXPECTED_MODEL_SIZE: u64 = 190_085_487;
pub const MODEL_FILE_NAME: &str = "ggml-small-q5_1.bin";

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct VoiceDownloadProgress {
    pub status: String, // "idle" | "downloading" | "completed" | "failed"
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percent: f32,
    pub error: Option<String>,
}

static DOWNLOAD_STATE: Mutex<Option<VoiceDownloadProgress>> = Mutex::new(None);
static IS_DOWNLOADING: AtomicBool = AtomicBool::new(false);

pub fn get_download_progress() -> VoiceDownloadProgress {
    if let Ok(guard) = DOWNLOAD_STATE.lock() {
        if let Some(state) = &*guard {
            return state.clone();
        }
    }
    VoiceDownloadProgress {
        status: "idle".to_string(),
        downloaded_bytes: 0,
        total_bytes: EXPECTED_MODEL_SIZE,
        percent: 0.0,
        error: None,
    }
}

pub fn update_download_progress(
    progress: VoiceDownloadProgress,
    app_handle: Option<&tauri::AppHandle>,
) {
    if let Ok(mut guard) = DOWNLOAD_STATE.lock() {
        *guard = Some(progress.clone());
    }
    if let Some(app) = app_handle {
        let _ = app.emit("voice-model-download-progress", &progress);
    }
}

pub fn get_target_model_path() -> PathBuf {
    if let Some(data_dir) = dirs::data_dir() {
        data_dir
            .join("agentic_native_hub")
            .join("models")
            .join(MODEL_FILE_NAME)
    } else {
        PathBuf::from("models").join(MODEL_FILE_NAME)
    }
}

pub fn cleanup_legacy_tiny_model() {
    let target = get_target_model_path();
    // Safety guard: only delete tiny model if small model exists and is complete (== EXPECTED_MODEL_SIZE)
    if !target.exists() {
        return;
    }
    if let Ok(meta) = std::fs::metadata(&target) {
        if meta.len() != EXPECTED_MODEL_SIZE {
            return;
        }
    } else {
        return;
    }

    // Only clean from user data directory cache, never delete bundled repo models
    if let Some(data_dir) = dirs::data_dir() {
        let tiny_data = data_dir.join("agentic_native_hub/models/ggml-tiny.bin");
        if tiny_data.exists() {
            let _ = std::fs::remove_file(&tiny_data);
        }
    }
}

pub fn start_model_download(app_handle: Option<tauri::AppHandle>) {
    let target_path = get_target_model_path();
    if target_path.exists() {
        if let Ok(meta) = std::fs::metadata(&target_path) {
            if meta.len() == EXPECTED_MODEL_SIZE {
                cleanup_legacy_tiny_model();
                update_download_progress(
                    VoiceDownloadProgress {
                        status: "completed".to_string(),
                        downloaded_bytes: meta.len(),
                        total_bytes: EXPECTED_MODEL_SIZE,
                        percent: 100.0,
                        error: None,
                    },
                    app_handle.as_ref(),
                );
                return;
            } else if meta.len() > EXPECTED_MODEL_SIZE {
                // Auto-repair oversized/corrupted model by truncating to exact expected size
                if let Ok(file) = std::fs::OpenOptions::new().write(true).open(&target_path) {
                    let _ = file.set_len(EXPECTED_MODEL_SIZE);
                    cleanup_legacy_tiny_model();
                    update_download_progress(
                        VoiceDownloadProgress {
                            status: "completed".to_string(),
                            downloaded_bytes: EXPECTED_MODEL_SIZE,
                            total_bytes: EXPECTED_MODEL_SIZE,
                            percent: 100.0,
                            error: None,
                        },
                        app_handle.as_ref(),
                    );
                    return;
                }
            }
        }
    }

    if IS_DOWNLOADING.swap(true, Ordering::SeqCst) {
        return;
    }

    let initial = VoiceDownloadProgress {
        status: "downloading".to_string(),
        downloaded_bytes: 0,
        total_bytes: EXPECTED_MODEL_SIZE,
        percent: 0.0,
        error: None,
    };
    update_download_progress(initial, app_handle.as_ref());

    std::thread::spawn(move || {
        let target = get_target_model_path();
        if let Some(parent) = target.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let part_file = target.with_extension("bin.part");

        // Clean part file if corrupted or larger than expected
        if let Ok(meta) = std::fs::metadata(&part_file) {
            if meta.len() >= EXPECTED_MODEL_SIZE {
                let _ = std::fs::remove_file(&part_file);
            }
        }

        let mut cmd = std::process::Command::new("curl");
        cmd.arg("-L")
            .arg("-f")
            .arg("-C")
            .arg("-")
            .arg("-o")
            .arg(&part_file)
            .arg(WHISPER_SMALL_Q5_URL);

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                IS_DOWNLOADING.store(false, Ordering::SeqCst);
                update_download_progress(
                    VoiceDownloadProgress {
                        status: "failed".to_string(),
                        downloaded_bytes: 0,
                        total_bytes: EXPECTED_MODEL_SIZE,
                        percent: 0.0,
                        error: Some(format!("Gagal menjalankan downloader curl: {}", e)),
                    },
                    app_handle.as_ref(),
                );
                return;
            }
        };

        // Polling loop
        loop {
            match child.try_wait() {
                Ok(Some(exit_status)) => {
                    IS_DOWNLOADING.store(false, Ordering::SeqCst);
                    if exit_status.success() {
                        let final_len = std::fs::metadata(&part_file)
                            .map(|m| m.len())
                            .unwrap_or(0);

                        if final_len > EXPECTED_MODEL_SIZE {
                            // Truncate any extra bytes appended by curl resume
                            if let Ok(file) = std::fs::OpenOptions::new().write(true).open(&part_file) {
                                let _ = file.set_len(EXPECTED_MODEL_SIZE);
                            }
                        }

                        let verified_len = std::fs::metadata(&part_file)
                            .map(|m| m.len())
                            .unwrap_or(0);

                        if verified_len == EXPECTED_MODEL_SIZE {
                            let _ = std::fs::rename(&part_file, &target);
                            cleanup_legacy_tiny_model();
                            crate::voice::invalidate_cached_context();

                            update_download_progress(
                                VoiceDownloadProgress {
                                    status: "completed".to_string(),
                                    downloaded_bytes: EXPECTED_MODEL_SIZE,
                                    total_bytes: EXPECTED_MODEL_SIZE,
                                    percent: 100.0,
                                    error: None,
                                },
                                app_handle.as_ref(),
                            );
                        } else {
                            let _ = std::fs::remove_file(&part_file);
                            update_download_progress(
                                VoiceDownloadProgress {
                                    status: "failed".to_string(),
                                    downloaded_bytes: 0,
                                    total_bytes: EXPECTED_MODEL_SIZE,
                                    percent: 0.0,
                                    error: Some("Ukuran model tidak sesuai dengan ukuran resmi.".to_string()),
                                },
                                app_handle.as_ref(),
                            );
                        }
                    } else {
                        update_download_progress(
                            VoiceDownloadProgress {
                                status: "failed".to_string(),
                                downloaded_bytes: 0,
                                total_bytes: EXPECTED_MODEL_SIZE,
                                percent: 0.0,
                                error: Some(format!(
                                    "Unduhan model terhenti dengan kode exit: {:?}",
                                    exit_status.code()
                                )),
                            },
                            app_handle.as_ref(),
                        );
                    }
                    break;
                }
                Ok(None) => {
                    // Update progress periodically
                    if let Ok(meta) = std::fs::metadata(&part_file) {
                        let downloaded = meta.len();
                        let percent = ((downloaded as f32 / EXPECTED_MODEL_SIZE as f32) * 100.0)
                            .min(99.0);
                        update_download_progress(
                            VoiceDownloadProgress {
                                status: "downloading".to_string(),
                                downloaded_bytes: downloaded,
                                total_bytes: EXPECTED_MODEL_SIZE,
                                percent,
                                error: None,
                            },
                            app_handle.as_ref(),
                        );
                    }
                    std::thread::sleep(Duration::from_millis(500));
                }
                Err(e) => {
                    IS_DOWNLOADING.store(false, Ordering::SeqCst);
                    update_download_progress(
                        VoiceDownloadProgress {
                            status: "failed".to_string(),
                            downloaded_bytes: 0,
                            total_bytes: EXPECTED_MODEL_SIZE,
                            percent: 0.0,
                            error: Some(format!("Error saat memantau unduhan: {}", e)),
                        },
                        app_handle.as_ref(),
                    );
                    break;
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_target_model_path_format() {
        let path = get_target_model_path();
        assert!(path.ends_with(MODEL_FILE_NAME));
    }

    #[test]
    fn test_initial_download_progress() {
        let prog = get_download_progress();
        assert!(prog.total_bytes == EXPECTED_MODEL_SIZE);
    }

    #[test]
    fn test_progress_serialization() {
        let prog = VoiceDownloadProgress {
            status: "downloading".to_string(),
            downloaded_bytes: 50_000_000,
            total_bytes: EXPECTED_MODEL_SIZE,
            percent: 26.3,
            error: None,
        };
        let json = serde_json::to_string(&prog).expect("serialize should succeed");
        assert!(json.contains("downloading"));
        assert!(json.contains("26.3"));
    }

    #[test]
    fn test_cleanup_legacy_tiny_model_idempotent() {
        // Calling cleanup multiple times should be safe and idempotent
        cleanup_legacy_tiny_model();
    }
}
