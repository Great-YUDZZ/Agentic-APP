// Offline Voice Input and Audio Recording Utilities
// Encodes microphone input into standard 16-bit mono WAV and communicates with native Whisper IPC

import { useState, useRef, useEffect, useCallback } from 'react';

export interface OfflineSpeechStatus {
  available: boolean;
  path: string | null;
  size_bytes: number;
  model_name: string;
  is_small_model?: boolean;
  download_status?: 'idle' | 'downloading' | 'completed' | 'failed';
  download_percent?: number;
  download_error?: string | null;
}

export interface VoiceDownloadProgressEvent {
  status: 'idle' | 'downloading' | 'completed' | 'failed';
  downloaded_bytes: number;
  total_bytes: number;
  percent: number;
  error?: string | null;
}

/**
 * Encode raw Float32 mono samples to standard 16-bit PCM WAV bytes
 */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 for Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit PCM samples with clamping
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

/**
 * Call native Rust IPC to get offline Whisper status
 */
export async function getOfflineSpeechStatus(): Promise<OfflineSpeechStatus> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<OfflineSpeechStatus>('get_offline_speech_status');
  } catch (err) {
    console.warn('Failed to get offline speech status:', err);
    return {
      available: false,
      path: null,
      size_bytes: 0,
      model_name: 'ggml-small-q5_1.bin',
      is_small_model: false,
      download_status: 'idle',
      download_percent: 0,
    };
  }
}

/**
 * Trigger background download of high-accuracy model
 */
export async function triggerVoiceModelDownload(): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('trigger_voice_model_download');
  } catch (err) {
    console.warn('Failed to trigger model download:', err);
  }
}

/**
 * Call native Rust IPC to transcribe WAV audio bytes using offline Whisper
 */
export async function transcribeOfflineAudio(
  audioBytes: Uint8Array,
  language?: 'id' | 'en' | 'auto',
  preferFast?: boolean
): Promise<string> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const langParam = language === 'auto' || !language ? null : language;
    const result = await invoke<string>('transcribe_offline_audio', {
      audioBytes: Array.from(audioBytes),
      language: langParam,
      preferFast: preferFast ?? false,
    });
    return result.trim();
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error('Offline transcription error:', msg);
    throw new Error(msg);
  }
}

/**
 * Check if Web Speech API is supported in the current environment
 */
export function isWebSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const SpeechClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return !!SpeechClass;
}

/**
 * Low-level Audio Recorder manager using AudioContext & ScriptProcessor
 */
export class RawAudioRecorder {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private chunks: Float32Array[] = [];
  private sampleRate: number = 16000;
  private startTime: number = 0;

  public async start(): Promise<void> {
    this.chunks = [];
    this.startTime = Date.now();

    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    try {
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      this.sampleRate = this.audioContext.sampleRate || 16000;
    } catch {
      this.audioContext = new AudioContextClass();
      this.sampleRate = this.audioContext.sampleRate || 44100;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('API perekaman audio tidak didukung di lingkungan ini.');
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });
    } catch {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event: AudioProcessingEvent) => {
      const channelData = event.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(channelData));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  /**
   * Get an encoded WAV snapshot of recorded audio so far without stopping the recorder
   */
  public getRecordedWavSoFar(): Uint8Array | null {
    if (this.chunks.length === 0) return null;
    let totalLength = 0;
    for (const chunk of this.chunks) {
      totalLength += chunk.length;
    }
    // Need at least 0.5s of audio to be meaningful
    if (totalLength < this.sampleRate * 0.5) return null;

    const flatSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      flatSamples.set(chunk, offset);
      offset += chunk.length;
    }

    return encodeWav(flatSamples, this.sampleRate);
  }

  public async stop(): Promise<Uint8Array> {
    const elapsed = Date.now() - this.startTime;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.chunks.length === 0 || elapsed < 300) {
      throw new Error('Rekaman audio terlalu pendek.');
    }

    let totalLength = 0;
    for (const chunk of this.chunks) {
      totalLength += chunk.length;
    }

    const flatSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      flatSamples.set(chunk, offset);
      offset += chunk.length;
    }

    return encodeWav(flatSamples, this.sampleRate);
  }

  public cancel(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.chunks = [];
  }
}

export interface StartRecordingOptions {
  language?: 'id' | 'en' | 'auto';
  onInterimText?: (text: string) => void;
}

/**
 * React hook for voice recording state, streaming interim transcription, and final processing
 */
export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [interimText, setInterimText] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<VoiceDownloadProgressEvent | null>(null);

  const recorderRef = useRef<RawAudioRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunkTickerRef = useRef<number | null>(null);
  const isChunkProcessingRef = useRef(false);
  const speechRecognitionRef = useRef<any>(null);
  const webSpeechFinalTextRef = useRef('');
  const interimCallbackRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import('@tauri-apps/api/event')
      .then(({ listen }) => {
        listen<VoiceDownloadProgressEvent>('voice-model-download-progress', (event) => {
          setDownloadProgress(event.payload);
        })
          .then((u) => {
            unlisten = u;
          })
          .catch(() => {});
      })
      .catch(() => {});

    return () => {
      if (unlisten) unlisten();
      if (timerRef.current) clearInterval(timerRef.current);
      if (chunkTickerRef.current) clearInterval(chunkTickerRef.current);
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch {}
      }
      if (recorderRef.current) {
        recorderRef.current.cancel();
      }
    };
  }, []);

  const startWhisperChunkTicker = (targetLang: 'id' | 'en' | 'auto') => {
    if (chunkTickerRef.current) return;

    // Process interim chunk every 1500ms using fast tiny model
    chunkTickerRef.current = window.setInterval(async () => {
      if (!recorderRef.current || isChunkProcessingRef.current) return;
      const wavSnapshot = recorderRef.current.getRecordedWavSoFar();
      if (!wavSnapshot) return;

      isChunkProcessingRef.current = true;
      try {
        const partial = await transcribeOfflineAudio(wavSnapshot, targetLang, true);
        if (partial && recorderRef.current) {
          setInterimText(partial);
          if (interimCallbackRef.current) {
            interimCallbackRef.current(partial);
          }
        }
      } catch {
        // Silently skip interim chunk error to keep recording smooth
      } finally {
        isChunkProcessingRef.current = false;
      }
    }, 1500);
  };

  const startRecording = useCallback(
    async (options?: StartRecordingOptions | ((text: string) => void)) => {
      if (isRecording || isTranscribing) return;

      const opts: StartRecordingOptions =
        typeof options === 'function' ? { onInterimText: options } : options || {};
      const targetLang = opts.language || 'id';

      interimCallbackRef.current = opts.onInterimText || null;
      setInterimText('');
      webSpeechFinalTextRef.current = '';

      // 1. Start raw audio recorder for guaranteed local recording
      const recorder = new RawAudioRecorder();
      await recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
      setDuration(0);

      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // 2. Attempt Web Speech API for millisecond live interim stream
      let webSpeechStarted = false;
      if (isWebSpeechSupported()) {
        try {
          const SpeechClass =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          const recognition = new SpeechClass();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = targetLang === 'en' ? 'en-US' : 'id-ID';

          recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const res = event.results[i];
              if (res.isFinal) {
                final += res[0].transcript;
              } else {
                interim += res[0].transcript;
              }
            }
            if (final) {
              webSpeechFinalTextRef.current = (
                webSpeechFinalTextRef.current + ' ' + final
              ).trim();
            }
            const activePreview = (
              webSpeechFinalTextRef.current + ' ' + interim
            ).trim();
            if (activePreview) {
              setInterimText(activePreview);
              if (interimCallbackRef.current) {
                interimCallbackRef.current(activePreview);
              }
            }
          };

          recognition.onerror = (e: any) => {
            // Fallback to offline Whisper chunk streaming
            console.warn('Web Speech API error, falling back to offline Whisper streaming:', e?.error);
            try {
              recognition.abort();
            } catch {}
            speechRecognitionRef.current = null;
            startWhisperChunkTicker(targetLang);
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
          webSpeechStarted = true;
        } catch (e) {
          console.warn('Could not start Web Speech API, using offline chunk streaming:', e);
          speechRecognitionRef.current = null;
        }
      }

      // If Web Speech API is not supported or failed to start, start Whisper chunk ticker immediately
      if (!webSpeechStarted) {
        startWhisperChunkTicker(targetLang);
      }
    },
    [isRecording, isTranscribing]
  );

  const stopRecording = useCallback(
    async (language?: 'id' | 'en' | 'auto'): Promise<string> => {
      if (!recorderRef.current || !isRecording) {
        return '';
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (chunkTickerRef.current) {
        clearInterval(chunkTickerRef.current);
        chunkTickerRef.current = null;
      }

      // Stop Web Speech API if running
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
        speechRecognitionRef.current = null;
      }

      setIsRecording(false);
      setIsTranscribing(true);

      try {
        const wavBytes = await recorderRef.current.stop();
        recorderRef.current = null;

        // If Web Speech captured good final text, prioritize it
        const webSpeechResult = webSpeechFinalTextRef.current.trim();
        if (webSpeechResult && webSpeechResult.split(/\s+/).length >= 2) {
          setInterimText('');
          return webSpeechResult;
        }

        // Run final high-accuracy transcription with Small model
        const text = await transcribeOfflineAudio(wavBytes, language, false);
        setInterimText('');
        return text;
      } finally {
        setIsTranscribing(false);
        setDuration(0);
        isChunkProcessingRef.current = false;
        interimCallbackRef.current = null;
      }
    },
    [isRecording]
  );

  const cancelRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (chunkTickerRef.current) {
      clearInterval(chunkTickerRef.current);
      chunkTickerRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch {}
      speechRecognitionRef.current = null;
    }
    if (recorderRef.current) {
      recorderRef.current.cancel();
      recorderRef.current = null;
    }
    setIsRecording(false);
    setIsTranscribing(false);
    setDuration(0);
    setInterimText('');
    isChunkProcessingRef.current = false;
    interimCallbackRef.current = null;
  }, []);

  return {
    isRecording,
    isTranscribing,
    duration,
    interimText,
    downloadProgress,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
