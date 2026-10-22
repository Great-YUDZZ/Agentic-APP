import { ModelOption, ChatMessage } from '../types';
import { injectSystemDesignRules } from './api';

/**
 * Estimasi jumlah token dari sebuah teks.
 * Rata-rata 1 token setara dengan ~3.8 hingga 4 karakter untuk teks campuran (Inggris & Indonesia).
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.8);
}

/**
 * Mendapatkan batas kapasitas context window dari model yang dipilih.
 * Jika metadata model tidak mencantumkan context_length, gunakan default yang aman.
 */
export function getModelContextLimit(modelId: string, availableModels: ModelOption[]): number {
  const found = availableModels.find((m) => m.id === modelId);
  if (found?.context_length && found.context_length > 0) {
    return found.context_length;
  }

  const lower = modelId.toLowerCase();
  if (lower.includes('1m') || lower.includes('gemini-1.5') || lower.includes('gemini-2.5') || lower.includes('gemini-3')) {
    return 128000;
  }
  if (lower.includes('claude-3') || lower.includes('claude-sonnet') || lower.includes('claude-opus')) {
    return 100000;
  }
  if (lower.includes('gpt-4o') || lower.includes('gpt-4-turbo')) {
    return 128000;
  }
  if (lower.includes('32k')) {
    return 32768;
  }
  if (lower.includes('16k')) {
    return 16384;
  }
  if (lower.includes('8k')) {
    return 8192;
  }

  // Standar fallback aman untuk model lokal / kustom
  return 16384;
}

export interface PreparedContextResult {
  messages: Array<{ role: string; content: string }>;
  isCompressed: boolean;
  usagePercent: number;
  totalTokens: number;
  prunedCount: number;
}

/**
 * Mempersiapkan array pesan dengan strategi Sliding Window berbasis token:
 * 1. Menjaga System Design Rules tetap ada di urutan pertama.
 * 2. Pesan terbaru diprioritaskan terlebih dahulu (reverse traversal).
 * 3. Jika total token melebihi 75% dari batas konteks, pesan lama dipotong dari payload
 *    dan ditandai dengan status isCompressed = true.
 */
export function preparePrunedContextMessages(
  historyMessages: ChatMessage[],
  newUserMessage: string,
  modelId: string,
  availableModels: ModelOption[]
): PreparedContextResult {
  const contextLimit = getModelContextLimit(modelId, availableModels);
  
  // Alokasikan batas aman input (misalnya 75% dari total context window untuk memberi ruang output)
  const maxInputTokenBudget = Math.floor(contextLimit * 0.75);

  const newMsgToken = estimateTokenCount(newUserMessage);
  let accumulatedTokens = newMsgToken;
  const retainedMessages: Array<{ role: string; content: string }> = [];
  let prunedCount = 0;

  // Lakukan iterasi mundur dari pesan riwayat paling akhir ke paling awal
  for (let i = historyMessages.length - 1; i >= 0; i--) {
    const msg = historyMessages[i];
    if (msg.role === 'system') continue;

    const msgTokens = msg.token_count || estimateTokenCount(msg.content);
    if (accumulatedTokens + msgTokens <= maxInputTokenBudget) {
      accumulatedTokens += msgTokens;
      retainedMessages.unshift({
        role: msg.role,
        content: msg.content,
      });
    } else {
      prunedCount++;
    }
  }

  // Tambahkan pesan user saat ini di bagian akhir
  retainedMessages.push({
    role: 'user',
    content: newUserMessage,
  });

  const isCompressed = prunedCount > 0;
  const usagePercent = Math.min(100, Math.round((accumulatedTokens / contextLimit) * 100));

  // Sisipkan System Design Rules
  const finalMessages = injectSystemDesignRules(retainedMessages);

  return {
    messages: finalMessages,
    isCompressed,
    usagePercent,
    totalTokens: accumulatedTokens,
    prunedCount,
  };
}

/**
 * Menghitung metrik telemetri penggunaan konteks dan token secara real-time.
 */
export function calculateSessionTelemetry(
  historyMessages: ChatMessage[],
  draftInput: string,
  modelId: string,
  availableModels: ModelOption[],
  lastLatency?: { ttftMs: number | null; totalLatencyMs: number | null }
) {
  const contextLimit = getModelContextLimit(modelId, availableModels);

  let inputTokens = 0;
  let outputTokens = 0;

  for (const msg of historyMessages) {
    const tokens = msg.token_count || estimateTokenCount(msg.content);
    if (msg.role === 'assistant') {
      outputTokens += tokens;
    } else {
      inputTokens += tokens;
    }
  }

  // Tambahkan perkiraan token dari input draf yang sedang diketik
  const draftTokens = estimateTokenCount(draftInput);
  inputTokens += draftTokens;

  const totalSessionTokens = inputTokens + outputTokens;
  const usagePercent = Math.min(100, Math.round((totalSessionTokens / contextLimit) * 100));

  return {
    inputTokens,
    outputTokens,
    totalSessionTokens,
    contextLimit,
    usagePercent,
    ttftMs: lastLatency?.ttftMs ?? null,
    totalLatencyMs: lastLatency?.totalLatencyMs ?? null,
  };
}
