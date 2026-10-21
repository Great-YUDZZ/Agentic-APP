pub mod downloader;

use std::path::PathBuf;
use std::sync::Mutex;
use anyhow::{anyhow, Context};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

struct ContextCache {
    fast: Option<(PathBuf, WhisperContext)>,
    precise: Option<(PathBuf, WhisperContext)>,
}

/// Static cache for WhisperContext to avoid reloading models on every transcription
static CACHED_CONTEXTS: Mutex<Option<ContextCache>> = Mutex::new(None);

/// Invalidate cached WhisperContexts (called after new model download)
pub fn invalidate_cached_context() {
    if let Ok(mut guard) = CACHED_CONTEXTS.lock() {
        *guard = None;
    }
}

/// Validate model integrity and auto-repair if truncated or oversized
fn validate_and_repair_model(path: &PathBuf) -> bool {
    if !path.exists() {
        return false;
    }
    let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if fname.contains("small") {
        if let Ok(meta) = std::fs::metadata(path) {
            let len = meta.len();
            if len == downloader::EXPECTED_MODEL_SIZE {
                return true;
            }
            if len > downloader::EXPECTED_MODEL_SIZE {
                // Auto-repair: truncate extra bytes appended by curl resume
                if let Ok(file) = std::fs::OpenOptions::new().write(true).open(path) {
                    let _ = file.set_len(downloader::EXPECTED_MODEL_SIZE);
                    return true;
                }
            }
            // If less than expected, model is incomplete/corrupt
            return false;
        }
        return false;
    }
    if fname.contains("tiny") {
        if let Ok(meta) = std::fs::metadata(path) {
            // Tiny model is ~77MB
            return meta.len() >= 70_000_000;
        }
        return false;
    }
    true
}

/// Look up model path from well-known local locations, supporting preference for fast (tiny) or precise (small-q5_1)
pub fn find_model_path_with_preference(prefer_fast: bool) -> Option<PathBuf> {
    if let Ok(env_path) = std::env::var("WHISPER_MODEL_PATH") {
        let p = PathBuf::from(env_path);
        if validate_and_repair_model(&p) {
            return Some(p);
        }
    }

    if prefer_fast {
        // Check system data directory for tiny model first
        if let Some(data_dir) = dirs::data_dir() {
            let tiny_path = data_dir.join("agentic_native_hub/models/ggml-tiny.bin");
            if validate_and_repair_model(&tiny_path) {
                return Some(tiny_path);
            }
        }
        let tiny_candidates = [
            PathBuf::from("models/ggml-tiny.bin"),
            PathBuf::from("../models/ggml-tiny.bin"),
            PathBuf::from("/home/yudz/Agentic/models/ggml-tiny.bin"),
            PathBuf::from("/media/yudz/FLASHDISK/Agentic/models/ggml-tiny.bin"),
        ];
        for candidate in &tiny_candidates {
            if validate_and_repair_model(candidate) {
                return Some(candidate.clone());
            }
        }
    }

    // Prioritize high-accuracy small-q5_1, then tiny fallback
    if let Some(data_dir) = dirs::data_dir() {
        let small_path = data_dir.join("agentic_native_hub/models/ggml-small-q5_1.bin");
        if validate_and_repair_model(&small_path) {
            return Some(small_path);
        }
        let tiny_path = data_dir.join("agentic_native_hub/models/ggml-tiny.bin");
        if validate_and_repair_model(&tiny_path) {
            return Some(tiny_path);
        }
    }

    let candidates = [
        PathBuf::from("models/ggml-small-q5_1.bin"),
        PathBuf::from("../models/ggml-small-q5_1.bin"),
        PathBuf::from("/home/yudz/Agentic/models/ggml-small-q5_1.bin"),
        PathBuf::from("/media/yudz/FLASHDISK/Agentic/models/ggml-small-q5_1.bin"),
        PathBuf::from("models/ggml-tiny.bin"),
        PathBuf::from("../models/ggml-tiny.bin"),
        PathBuf::from("/home/yudz/Agentic/models/ggml-tiny.bin"),
        PathBuf::from("/media/yudz/FLASHDISK/Agentic/models/ggml-tiny.bin"),
    ];

    for candidate in &candidates {
        if validate_and_repair_model(candidate) {
            return Some(candidate.clone());
        }
    }

    None
}

/// Look up model path from well-known local locations, prioritizing high-accuracy small-q5_1
pub fn find_model_path() -> Option<PathBuf> {
    find_model_path_with_preference(false)
}

/// Returns offline speech status including download progress
pub fn get_offline_speech_status() -> serde_json::Value {
    let dl_progress = downloader::get_download_progress();

    if let Some(path) = find_model_path() {
        let metadata = std::fs::metadata(&path).ok();
        let size_bytes = metadata.map(|m| m.len()).unwrap_or(0);
        let model_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("ggml-small-q5_1.bin")
            .to_string();

        serde_json::json!({
            "available": true,
            "path": path.to_string_lossy(),
            "size_bytes": size_bytes,
            "model_name": model_name,
            "is_small_model": model_name.contains("small"),
            "download_status": dl_progress.status,
            "download_percent": dl_progress.percent,
            "download_error": dl_progress.error,
        })
    } else {
        serde_json::json!({
            "available": false,
            "path": null,
            "size_bytes": 0,
            "model_name": "ggml-small-q5_1.bin",
            "is_small_model": false,
            "download_status": dl_progress.status,
            "download_percent": dl_progress.percent,
            "download_error": dl_progress.error,
        })
    }
}

/// Decode WAV audio bytes to 16kHz mono f32 samples
pub fn decode_wav_to_16khz_mono(wav_bytes: &[u8]) -> anyhow::Result<Vec<f32>> {
    let cursor = std::io::Cursor::new(wav_bytes);
    let mut reader = hound::WavReader::new(cursor).context("Gagal membaca data WAV")?;
    let spec = reader.spec();

    let channels = spec.channels as usize;
    let sample_rate = spec.sample_rate;

    let raw_samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Int => {
            let max_val = match spec.bits_per_sample {
                16 => i16::MAX as f32,
                24 => 8388607.0,
                32 => i32::MAX as f32,
                8 => i8::MAX as f32,
                other => return Err(anyhow!("Format bit WAV {} tidak didukung", other)),
            };
            reader
                .samples::<i32>()
                .filter_map(Result::ok)
                .map(|s| (s as f32) / max_val)
                .collect()
        }
        hound::SampleFormat::Float => {
            reader.samples::<f32>().filter_map(Result::ok).collect()
        }
    };

    if raw_samples.is_empty() {
        return Err(anyhow!("Data audio kosong"));
    }

    // Downmix to mono if multi-channel
    let mono_samples: Vec<f32> = if channels > 1 {
        raw_samples
            .chunks_exact(channels)
            .map(|frame| frame.iter().sum::<f32>() / (channels as f32))
            .collect()
    } else {
        raw_samples
    };

    // Resample to 16000 Hz if needed
    if sample_rate == 16000 {
        Ok(mono_samples)
    } else {
        let ratio = 16000.0 / (sample_rate as f32);
        let target_len = ((mono_samples.len() as f32) * ratio) as usize;
        let mut resampled = Vec::with_capacity(target_len);

        for i in 0..target_len {
            let src_idx = (i as f32) / ratio;
            let idx0 = src_idx.floor() as usize;
            let idx1 = (idx0 + 1).min(mono_samples.len() - 1);
            let fract = src_idx - (idx0 as f32);

            let s0 = mono_samples.get(idx0).copied().unwrap_or(0.0);
            let s1 = mono_samples.get(idx1).copied().unwrap_or(0.0);
            resampled.push(s0 + fract * (s1 - s0));
        }

        Ok(resampled)
    }
}

/// Transcribe WAV audio bytes using offline Whisper model with options
pub fn transcribe_audio_bytes_with_options(
    wav_bytes: &[u8],
    language: Option<&str>,
    prefer_fast: bool,
) -> anyhow::Result<String> {
    let model_path = find_model_path_with_preference(prefer_fast).ok_or_else(|| {
        anyhow!("Berkas model Whisper offline tidak ditemukan di direktori models/.")
    })?;

    let pcm_data = decode_wav_to_16khz_mono(wav_bytes)?;

    let mut cache_guard = CACHED_CONTEXTS.lock().unwrap();
    let cache = cache_guard.get_or_insert_with(|| ContextCache {
        fast: None,
        precise: None,
    });

    let target_slot = if prefer_fast {
        &mut cache.fast
    } else {
        &mut cache.precise
    };

    let need_reload = match target_slot {
        Some((path, _)) => path != &model_path,
        None => true,
    };

    if need_reload {
        let model_str = model_path
            .to_str()
            .ok_or_else(|| anyhow!("Jalur model tidak valid"))?;
        let ctx = WhisperContext::new_with_params(model_str, WhisperContextParameters::default())
            .map_err(|e| anyhow!("Gagal memuat WhisperContext: {:?}", e))?;
        *target_slot = Some((model_path.clone(), ctx));
    }

    let (_, ctx) = target_slot.as_mut().unwrap();
    let mut state = ctx
        .create_state()
        .map_err(|e| anyhow!("Gagal membuat Whisper state: {:?}", e))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_translate(false);
    params.set_single_segment(prefer_fast);

    let lang_code = language.and_then(|lang| {
        let clean = lang.trim().to_lowercase();
        if clean == "auto" || clean.is_empty() {
            None
        } else if clean.starts_with("id") {
            Some("id".to_string())
        } else if clean.starts_with("en") {
            Some("en".to_string())
        } else {
            Some(clean[..clean.len().min(2)].to_string())
        }
    });

    if let Some(ref l) = lang_code {
        params.set_language(Some(l.as_str()));
    } else {
        // Default to Indonesian
        params.set_language(Some("id"));
    }

    state
        .full(params, &pcm_data)
        .map_err(|e| anyhow!("Gagal menjalankan inferensi Whisper: {:?}", e))?;

    let num_segments = state.full_n_segments();

    let mut result = String::new();
    for i in 0..num_segments {
        if let Some(segment) = state.get_segment(i) {
            let text = segment.to_string();
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                if !result.is_empty() {
                    result.push(' ');
                }
                result.push_str(trimmed);
            }
        }
    }

    Ok(result)
}

/// Transcribe WAV audio bytes using offline Whisper model (defaults to precise model)
pub fn transcribe_audio_bytes(wav_bytes: &[u8], language: Option<&str>) -> anyhow::Result<String> {
    transcribe_audio_bytes_with_options(wav_bytes, language, false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_model_path_exists() {
        let model = find_model_path();
        assert!(model.is_some(), "Model harus ditemukan di direktori models/");
    }

    #[test]
    fn test_find_model_path_fast_preference() {
        let fast_model = find_model_path_with_preference(true);
        assert!(fast_model.is_some(), "Fast model harus ditemukan jika tersedia");
    }

    #[test]
    fn test_decode_wav_synthetic() {
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 16000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut buf = std::io::Cursor::new(Vec::new());
        {
            let mut writer = hound::WavWriter::new(&mut buf, spec).unwrap();
            for i in 0..1600 {
                let sample = (3000.0 * (i as f32 * 0.05).sin()) as i16;
                writer.write_sample(sample).unwrap();
            }
            writer.finalize().unwrap();
        }

        let wav_bytes = buf.into_inner();
        let samples = decode_wav_to_16khz_mono(&wav_bytes).unwrap();
        assert_eq!(samples.len(), 1600);
        assert!(samples.iter().any(|&s| s != 0.0));
    }

    #[test]
    fn test_transcribe_audio_bytes_execution() {
        if find_model_path().is_none() {
            return;
        }

        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 16000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut buf = std::io::Cursor::new(Vec::new());
        {
            let mut writer = hound::WavWriter::new(&mut buf, spec).unwrap();
            for i in 0..8000 {
                let sample = (2000.0 * (i as f32 * 0.05).sin()) as i16;
                writer.write_sample(sample).unwrap();
            }
            writer.finalize().unwrap();
        }

        let wav_bytes = buf.into_inner();
        let res = transcribe_audio_bytes(&wav_bytes, Some("id"));
        assert!(res.is_ok(), "transcribe_audio_bytes must succeed without panic or error");
    }
}

