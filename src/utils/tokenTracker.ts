// Utilitas pelacakan, ekstraksi, dan estimasi token penggunaan multi-provider
// Mendukung OpenAI, Gemini, Claude, Ollama, DeepSeek, dan model lokal lainnya

export interface ExtractedStreamUsage {
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

export interface RecordUsageParams {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  requestId?: string;
  sessionId?: string;
  agentRole?: string;
  isLocal?: boolean;
  status?: string;
}

// Generate UUID sederhana jika crypto.randomUUID tersedia atau fallback
export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'req-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
}

// Ekstraksi angka token resmi (Ground Truth) dari potongan objek JSON respon model
export function extractStreamUsage(parsed: unknown): ExtractedStreamUsage | null {
  if (!parsed || typeof parsed !== 'object') return null;

  const obj = parsed as Record<string, unknown>;

  // 1. Standar OpenAI / DeepSeek: format { usage: { prompt_tokens, completion_tokens, ... } }
  if (obj.usage && typeof obj.usage === 'object') {
    const u = obj.usage as Record<string, unknown>;
    const prompt = typeof u.prompt_tokens === 'number' ? u.prompt_tokens : undefined;
    const completion = typeof u.completion_tokens === 'number' ? u.completion_tokens : undefined;
    
    // Cache token detection
    const promptDetails = (u.prompt_tokens_details && typeof u.prompt_tokens_details === 'object')
      ? (u.prompt_tokens_details as Record<string, unknown>)
      : null;

    const cached = typeof u.cached_tokens === 'number'
      ? u.cached_tokens
      : typeof promptDetails?.cached_tokens === 'number'
      ? promptDetails.cached_tokens
      : typeof u.prompt_cache_hit_tokens === 'number'
      ? u.prompt_cache_hit_tokens
      : 0;

    const cacheCreation = typeof promptDetails?.cache_creation_tokens === 'number'
      ? promptDetails.cache_creation_tokens
      : typeof u.prompt_cache_miss_tokens === 'number'
      ? u.prompt_cache_miss_tokens
      : 0;

    if (prompt !== undefined || completion !== undefined) {
      return {
        promptTokens: prompt,
        completionTokens: completion,
        cachedTokens: cached,
        cacheCreationTokens: cacheCreation,
        cacheReadTokens: cached,
      };
    }
  }

  // 2. Format Ollama Native pada potongan penutup { done: true, prompt_eval_count, eval_count }
  if (
    typeof obj.prompt_eval_count === 'number' ||
    typeof obj.eval_count === 'number'
  ) {
    return {
      promptTokens: typeof obj.prompt_eval_count === 'number' ? obj.prompt_eval_count : 0,
      completionTokens: typeof obj.eval_count === 'number' ? obj.eval_count : 0,
      cachedTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    };
  }

  // 3. Format Google Gemini Native { usageMetadata: { promptTokenCount, candidatesTokenCount, ... } }
  if (obj.usageMetadata && typeof obj.usageMetadata === 'object') {
    const um = obj.usageMetadata as Record<string, unknown>;
    const prompt = typeof um.promptTokenCount === 'number' ? um.promptTokenCount : undefined;
    const completion = typeof um.candidatesTokenCount === 'number' ? um.candidatesTokenCount : undefined;
    const cached = typeof um.cachedContentTokenCount === 'number' ? um.cachedContentTokenCount : 0;

    if (prompt !== undefined || completion !== undefined) {
      return {
        promptTokens: prompt,
        completionTokens: completion,
        cachedTokens: cached,
        cacheCreationTokens: 0,
        cacheReadTokens: cached,
      };
    }
  }

  // 4. Format Anthropic Claude SSE Event
  if (obj.type === 'message_start' && obj.message && typeof obj.message === 'object') {
    const msg = obj.message as Record<string, unknown>;
    if (msg.usage && typeof msg.usage === 'object') {
      const u = msg.usage as Record<string, unknown>;
      return {
        promptTokens: typeof u.input_tokens === 'number' ? u.input_tokens : undefined,
        completionTokens: typeof u.output_tokens === 'number' ? u.output_tokens : undefined,
        cachedTokens: typeof u.cache_read_input_tokens === 'number' ? u.cache_read_input_tokens : 0,
        cacheCreationTokens: typeof u.cache_creation_input_tokens === 'number' ? u.cache_creation_input_tokens : 0,
        cacheReadTokens: typeof u.cache_read_input_tokens === 'number' ? u.cache_read_input_tokens : 0,
      };
    }
  }

  if (obj.type === 'message_delta' && obj.usage && typeof obj.usage === 'object') {
    const u = obj.usage as Record<string, unknown>;
    if (typeof u.output_tokens === 'number') {
      return {
        completionTokens: u.output_tokens,
      };
    }
  }

  return null;
}

// Estimasi token berbasis keseluruhan payload (bukan hanya teks yang diketik)
// Menghitung: System Prompt + Seluruh History Pesan + Konten File Lampiran + Skema Tools + Injected Memories
export function estimatePayloadTokens(params: {
  systemPrompt?: string;
  messages?: Array<{ role?: string; content?: string }>;
  tools?: unknown[];
  extraContext?: string;
}): number {
  let totalChars = 0;
  let messageFramingTokens = 0;

  // 1. System Prompt
  if (params.systemPrompt) {
    totalChars += params.systemPrompt.length;
    messageFramingTokens += 4;
  }

  // 2. Extra Context (Injected memory, web search results, dynamic context)
  if (params.extraContext) {
    totalChars += params.extraContext.length;
  }

  // 3. Seluruh Riwayat Pesan (Termasuk lampiran berkas yang disisipkan ke content)
  if (Array.isArray(params.messages)) {
    for (const msg of params.messages) {
      if (msg.content) {
        totalChars += msg.content.length;
      }
      // Setiap pesan OpenAI/ChatML membutuhkan overhead framing (~4 token per giliran)
      messageFramingTokens += 4;
    }
  }

  // 4. Skema dan Definisi Tools yang aktif
  if (Array.isArray(params.tools) && params.tools.length > 0) {
    try {
      const toolsJson = JSON.stringify(params.tools);
      totalChars += toolsJson.length;
      messageFramingTokens += 10;
    } catch {
      totalChars += 200 * params.tools.length;
    }
  }

  // Rasio rata-rata token ke karakter:
  // Bahasa Inggris / kode pemrograman: ~3.8 - 4 karakter per token
  // Bahasa Indonesia / karakter multibyte: ~2 - 3 karakter per token
  // Rata-rata tertimbang: 3.5 karakter per token
  const contentTokens = Math.ceil(totalChars / 3.5);
  return Math.max(1, contentTokens + messageFramingTokens);
}

// Estimasi token output dari teks yang dihasilkan
export function estimateOutputTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 3.5));
}

// Fungsi seragam untuk merekam konsumsi token ke database SQLite melalui Tauri IPC
export async function recordUnifiedTokenUsage(params: RecordUsageParams): Promise<void> {
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  if (!isTauri) return;

  const reqId = params.requestId || generateRequestId();

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('record_token_usage', {
      provider: params.provider || 'unknown',
      model: params.model || 'unknown',
      promptTokens: Math.max(0, Math.round(params.promptTokens)),
      completionTokens: Math.max(0, Math.round(params.completionTokens)),
      cachedTokens: params.cachedTokens ? Math.max(0, Math.round(params.cachedTokens)) : 0,
      status: params.status || 'ok',
      requestId: reqId,
      sessionId: params.sessionId || null,
      agentRole: params.agentRole || null,
      cacheCreationTokens: params.cacheCreationTokens ? Math.max(0, Math.round(params.cacheCreationTokens)) : 0,
      cacheReadTokens: params.cacheReadTokens ? Math.max(0, Math.round(params.cacheReadTokens)) : 0,
      isLocal: params.isLocal ?? false,
    });
  } catch (err) {
    console.warn('Gagal mencatat pemakaian token ke database:', err);
  }
}
