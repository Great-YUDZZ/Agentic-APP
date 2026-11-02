export interface TTSOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
}

export function stripMarkdown(markdown: string): string {
  if (!markdown) return "";

  return markdown
    // Hapus code blocks
    .replace(/```[\s\S]*?```/g, "")
    // Hapus inline code
    .replace(/`([^`]+)`/g, "$1")
    // Hapus images
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, "")
    // Ganti links dengan teks link saja
    .replace(/\[([^\]]+)\]\(([^)]*)\)/g, "$1")
    // Hapus header tanda pagar
    .replace(/^#{1,6}\s+/gm, "")
    // Hapus blockquotes
    .replace(/^>\s+/gm, "")
    // Hapus bullet points / numbering
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Hapus bold & italic markers
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    // Hapus horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Hapus baris kosong berlebihan
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .trim();
}

type StateListener = (state: { isSpeaking: boolean; speakingId: string | null }) => void;

export class TextToSpeechManager {
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isCurrentlySpeaking: boolean = false;
  private currentSpeakingId: string | null = null;
  private listeners: Set<StateListener> = new Set();

  public isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getSpeakingState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getSpeakingState();
    this.listeners.forEach((l) => l(state));
  }

  public getVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      if (!this.isSupported()) {
        resolve([]);
        return;
      }

      let voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices);
        return;
      }

      const onVoicesChanged = () => {
        voices = window.speechSynthesis.getVoices();
        window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
        resolve(voices);
      };

      window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
      setTimeout(() => {
        resolve(window.speechSynthesis.getVoices());
      }, 500);
    });
  }

  public speak(
    id: string,
    rawText: string,
    options: TTSOptions = {}
  ): void {
    if (!this.isSupported()) {
      options.onError?.(new Error("Web Speech API tidak didukung di lingkungan ini"));
      return;
    }

    this.stop();

    const cleanText = stripMarkdown(rawText);
    if (!cleanText.trim()) {
      options.onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (options.voice) {
      const match = voices.find((v) => v.voiceURI === options.voice || v.name === options.voice);
      if (match) {
        utterance.voice = match;
      }
    } else if (options.lang) {
      const match = voices.find((v) => v.lang.startsWith(options.lang!));
      if (match) {
        utterance.voice = match;
      }
    }

    utterance.onstart = () => {
      this.isCurrentlySpeaking = true;
      this.currentSpeakingId = id;
      this.notify();
      options.onStart?.();
    };

    utterance.onend = () => {
      this.isCurrentlySpeaking = false;
      this.currentSpeakingId = null;
      this.currentUtterance = null;
      this.notify();
      options.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.isCurrentlySpeaking = false;
      this.currentSpeakingId = null;
      this.currentUtterance = null;
      this.notify();
      options.onError?.(e);
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  public stop(): void {
    if (!this.isSupported()) return;
    window.speechSynthesis.cancel();
    this.isCurrentlySpeaking = false;
    this.currentSpeakingId = null;
    this.currentUtterance = null;
    this.notify();
  }

  public pause(): void {
    if (!this.isSupported()) return;
    window.speechSynthesis.pause();
    this.notify();
  }

  public resume(): void {
    if (!this.isSupported()) return;
    window.speechSynthesis.resume();
    this.notify();
  }

  public getSpeakingState(): { isSpeaking: boolean; speakingId: string | null } {
    return {
      isSpeaking: this.isCurrentlySpeaking && (this.isSupported() ? window.speechSynthesis.speaking : false),
      speakingId: this.currentSpeakingId,
    };
  }

  public getCurrentUtterance(): SpeechSynthesisUtterance | null {
    return this.currentUtterance;
  }
}

export const ttsManager = new TextToSpeechManager();
