// Offline Voice Input and Audio Recording Utilities
// Encodes microphone input into standard 16-bit mono WAV and communicates with native Whisper IPC

import { useState, useRef, useEffect, useCallback } from 'react';

export interface OfflineSpeechStatus {
  available: boolean;
  path: string | null;
  size_bytes: number;
  model_name: string;
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
      model_name: 'ggml-tiny.bin',
    };
  }
}

/**
 * Call native Rust IPC to transcribe WAV audio bytes using offline Whisper
 */
export async function transcribeOfflineAudio(
  audioBytes: Uint8Array,
  language?: 'id' | 'en' | 'auto'
): Promise<string> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const langParam = language === 'auto' || !language ? null : language;
    const result = await invoke<string>('transcribe_offline_audio', {
      audioBytes: Array.from(audioBytes),
      language: langParam,
    });
    return result.trim();
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error('Offline transcription error:', msg);
    throw new Error(msg);
  }
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

/**
 * React hook for voice recording state, elapsed timer, and offline transcription
 */
export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<RawAudioRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recorderRef.current) {
        recorderRef.current.cancel();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || isTranscribing) return;
    const recorder = new RawAudioRecorder();
    await recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
    setDuration(0);

    timerRef.current = window.setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  }, [isRecording, isTranscribing]);

  const stopRecording = useCallback(
    async (language?: 'id' | 'en' | 'auto'): Promise<string> => {
      if (!recorderRef.current || !isRecording) {
        return '';
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setIsRecording(false);
      setIsTranscribing(true);

      try {
        const wavBytes = await recorderRef.current.stop();
        recorderRef.current = null;
        const text = await transcribeOfflineAudio(wavBytes, language);
        return text;
      } finally {
        setIsTranscribing(false);
        setDuration(0);
      }
    },
    [isRecording]
  );

  const cancelRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current) {
      recorderRef.current.cancel();
      recorderRef.current = null;
    }
    setIsRecording(false);
    setIsTranscribing(false);
    setDuration(0);
  }, []);

  return {
    isRecording,
    isTranscribing,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
