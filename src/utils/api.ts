import { ModelOption } from '../types';

/**
 * Utility helper untuk mem-parsing response dari berbagai proxy LLM lokal
 * yang mengembalikan JSON tunggal, JSON dengan trailing 'data: [DONE]',
 * ataupun streaming SSE chunk (data: { ... }\n\ndata: { ... }).
 */
export function parseRobustJson<T = any>(rawText: string): T {
  const trimmed = rawText.trim();

  // 1. Cek jika output adalah format Server-Sent Events (SSE) data stream
  if (trimmed.startsWith('data:') || trimmed.includes('\ndata:')) {
    const lines = trimmed.split('\n');
    let fullContent = '';
    let fullReasoning = '';
    let totalTokens = 0;
    let modelName = '';
    let parsedAnyChunk = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith('data:')) continue;

      const dataPayload = trimmedLine.replace(/^data:\s*/, '').trim();
      if (!dataPayload || dataPayload === '[DONE]') continue;

      try {
        const chunk = JSON.parse(dataPayload);
        parsedAnyChunk = true;
        if (chunk.model) modelName = chunk.model;
        if (chunk.usage?.total_tokens) totalTokens = chunk.usage.total_tokens;

        const delta = chunk.choices?.[0]?.delta;
        if (delta) {
          if (delta.content) fullContent += delta.content;
          const r = delta.reasoning_content || delta.reasoning || delta.thought || delta.thinking;
          if (r) fullReasoning += r;
        } else {
          const msg = chunk.choices?.[0]?.message;
          if (msg?.content) fullContent += msg.content;
          const r = msg?.reasoning_content || msg?.reasoning || msg?.thought || msg?.thinking;
          if (r) fullReasoning += r;
        }
      } catch {
        // Skip malformed chunk
      }
    }

    if (parsedAnyChunk) {
      return {
        model: modelName,
        choices: [
          {
            message: {
              role: 'assistant',
              content: fullContent,
              reasoning_content: fullReasoning || undefined,
            },
          },
        ],
        usage: totalTokens ? { total_tokens: totalTokens } : undefined,
      } as unknown as T;
    }
  }

  // 2. Normal JSON / JSON with trailing data: [DONE]
  const cleaned = rawText.replace(/data:\s*\[DONE\][\s\S]*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Fallback: temukan batas kurung kurawal pertama dan terakhir
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const extracted = cleaned.substring(firstBrace, lastBrace + 1);
      return JSON.parse(extracted);
    }
    throw err;
  }
}

/**
 * Resolves the base URL for API requests.
 * When running in the browser (non-Tauri) and connecting to the default local endpoint
 * (localhost:20128 or empty), route through '/api/proxy' so that Vite forwards the request
 * server-side, preventing all browser CORS restrictions and missing CORS headers on errors.
 */
export function getApiBaseUrl(customBaseUrl?: string): string {
  const isTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);
  const url = customBaseUrl?.trim() || 'http://localhost:20128/v1';

  if (!isTauri && (url.includes('localhost:20128') || url.includes('127.0.0.1:20128'))) {
    return '/api/proxy';
  }
  return url.replace(/\/+$/, '');
}

export function getChatEndpoint(customBaseUrl?: string): string {
  const base = getApiBaseUrl(customBaseUrl);
  return `${base}/chat/completions`;
}

export function getModelsEndpoint(customBaseUrl?: string): string {
  const base = getApiBaseUrl(customBaseUrl);
  return `${base}/models`;
}

export function isLocalBaseUrl(url?: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('0.0.0.0') ||
    lower.includes('192.168.') ||
    lower.includes('10.')
  );
}

/**
 * Resolves the appropriate base URL and API Key for a selected model
 * across multiple custom endpoints, LM Studio, and standard providers.
 */
export function resolveEndpointForModel(
  modelId: string,
  availableModels: Array<{ id: string; endpoint_id?: string; provider?: string; endpoint_name?: string; is_local?: boolean }>,
  apiKeys: Array<{ provider: string; name?: string; api_key: string; base_url?: string; is_active: boolean }>
): { baseUrl: string; apiKey: string; provider: string } {
  const matchedModel = availableModels.find((m) => m.id === modelId);
  const endpointId = matchedModel?.endpoint_id || matchedModel?.provider;

  // 1. Penanganan model lokal LM Studio (Zero-API Key)
  if (endpointId === 'lmstudio' || matchedModel?.provider === 'lmstudio') {
    const customLmKey = apiKeys.find(
      (k) =>
        k.is_active &&
        (k.base_url?.includes(':1234') || k.name?.toLowerCase().includes('lm studio'))
    );
    return {
      baseUrl: customLmKey?.base_url || 'http://localhost:1234/v1',
      apiKey: customLmKey?.api_key?.trim() || 'lm-studio',
      provider: customLmKey?.name?.trim() || 'LM Studio',
    };
  }

  // 2. Penanganan model lokal Ollama (Zero-API Key)
  if (
    endpointId === 'ollama' ||
    matchedModel?.provider === 'ollama' ||
    modelId.startsWith('lfm3') ||
    modelId.startsWith('ollama/')
  ) {
    const ollamaKey = apiKeys.find((k) => k.provider === 'ollama' && k.is_active);
    return {
      baseUrl: ollamaKey?.base_url || 'http://localhost:11434/v1',
      apiKey: ollamaKey?.api_key || 'ollama',
      provider: 'ollama',
    };
  }

  if (endpointId) {
    const matchedKey = apiKeys.find((k) => k.provider === endpointId && k.is_active);
    if (matchedKey && (matchedKey.api_key.trim() || isLocalBaseUrl(matchedKey.base_url) || matchedKey.provider.startsWith('custom'))) {
      return {
        baseUrl: matchedKey.base_url || 'http://localhost:1234/v1',
        apiKey: matchedKey.api_key.trim() || 'local',
        provider: matchedKey.name?.trim() || matchedKey.provider,
      };
    }
  }

  // Fallback ke endpoint custom pertama yang aktif (termasuk endpoint lokal tanpa API key)
  const firstActiveCustom = apiKeys.find(
    (k) =>
      (k.provider === 'custom' || k.provider.startsWith('custom_')) &&
      k.is_active &&
      (k.api_key.trim().length > 0 || (k.base_url && k.base_url.trim().length > 0))
  );
  if (firstActiveCustom) {
    return {
      baseUrl: firstActiveCustom.base_url || 'http://localhost:1234/v1',
      apiKey: firstActiveCustom.api_key.trim() || 'local',
      provider: firstActiveCustom.name?.trim() || firstActiveCustom.provider,
    };
  }

  // Fallback default ke LM Studio lokal jika aktif
  return {
    baseUrl: 'http://localhost:1234/v1',
    apiKey: 'lm-studio',
    provider: 'LM Studio',
  };
}

/**
 * Extracts and formats user-friendly error messages from API gateway and model provider responses.
 */
export function formatApiErrorMessage(
  status: number,
  responseText: string,
  modelName?: string
): string {
  let rawMessage = '';

  try {
    const parsed = JSON.parse(responseText);
    rawMessage = parsed.error?.message || parsed.message || parsed.error || '';
  } catch {
    rawMessage = responseText.trim();
  }

  // Check if rawMessage has nested JSON error (common in 9router wrappers)
  if (rawMessage.includes('"message":') || rawMessage.includes('"error":')) {
    try {
      const match = rawMessage.match(/\{[\s\S]*\}/);
      if (match) {
        const nested = JSON.parse(match[0]);
        if (nested.error?.message) {
          rawMessage = `${nested.error.message}`;
        } else if (nested.message) {
          rawMessage = `${nested.message}`;
        }
      }
    } catch {
      // Keep rawMessage as is
    }
  }

  const modelLabel = modelName ? `"${modelName}"` : 'yang dipilih';

  // 1. 404 Not Found / Requested entity was not found
  if (
    status === 404 ||
    rawMessage.toLowerCase().includes('requested entity was not found') ||
    rawMessage.toLowerCase().includes('not found') ||
    rawMessage.toLowerCase().includes('does not exist')
  ) {
    return `Model ${modelLabel} tidak ditemukan atau belum tersedia di server upstream (HTTP 404).\n\n` +
      `Keterangan server: \`${rawMessage || 'Entity Not Found'}\`\n\n` +
      `**Rekomendasi Model yang Aktif:**\n` +
      `• **Gemini (Aktif)**: \`ag/gemini-3.6-flash-high\` atau \`ag/gemini-3-flash\`\n` +
      `• **Claude (Aktif)**: \`ag/claude-sonnet-4-6\` atau \`claude-code\`\n` +
      `• **OpenRouter (Aktif)**: \`openrouter/openrouter/free\` atau \`openrouter/nvidia/nemotron-3.5-lightning:free\``;
  }

  // 2. 403 Forbidden / Subscription Tier
  if (
    status === 403 ||
    rawMessage.toLowerCase().includes('subscription') ||
    rawMessage.toLowerCase().includes('forbidden') ||
    rawMessage.toLowerCase().includes('access denied')
  ) {
    return `Akses ke model ${modelLabel} ditolak oleh provider (HTTP 403 Forbidden).\n\n` +
      `Keterangan server: \`${rawMessage}\`\n\n` +
      `Paket/langganan API Anda belum mendukung model ini. Silakan beralih ke model lain yang aktif seperti \`ag/gemini-3.6-flash-high\` atau \`openrouter/openrouter/free\`.`;
  }

  // 3. 429 Rate Limit / Quota Exceeded
  if (
    status === 429 ||
    rawMessage.toLowerCase().includes('rate limit') ||
    rawMessage.toLowerCase().includes('quota') ||
    rawMessage.toLowerCase().includes('too many requests')
  ) {
    return `Batas frekuensi atau kuota permintaan (Rate Limit) tercapai untuk model ${modelLabel} (HTTP 429).\n\n` +
      `Keterangan: \`${rawMessage}\`\n\n` +
      `Silakan tunggu beberapa detik atau gunakan model alternatif.`;
  }

  // 4. 401 Unauthorized
  if (
    status === 401 ||
    rawMessage.toLowerCase().includes('unauthorized') ||
    rawMessage.toLowerCase().includes('invalid api key')
  ) {
    return `Autentikasi gagal (HTTP 401 Unauthorized). Kunci API (API Key) tidak valid atau kedaluwarsa. Periksa pengaturan API Key di menu Pengaturan.`;
  }

  // 5. 504 Gateway Timeout / 502 Bad Gateway
  if (status === 504 || status === 502) {
    return `Server lokal atau upstream tidak merespons (HTTP ${status}). Pastikan server di localhost:20128 aktif dan stabil.`;
  }

  // 6. Penanganan Model Lokal Ollama (Zero API Key)
  const isLocalModel =
    modelName &&
    (modelName.startsWith('lfm3') ||
      modelName.includes('ollama') ||
      modelName.includes(':1.7b') ||
      modelName.includes(':2b'));

  if (isLocalModel) {
    return `Model lokal "${modelName}" sedang diinisialisasi atau diunduh di background oleh aplikasi. Silakan tunggu beberapa saat hingga proses penyiapan selesai, lalu coba kirim pesan Anda kembali.`;
  }

  // 7. Generic Error
  return `Kendala Gateway API (${status}): ${rawMessage || 'Terjadi kesalahan saat memproses permintaan.'}`;
}

/**
 * Cek apakah model termasuk model yang terverifikasi aktif pada 9router lokal
 */
export function isModelActive(id: string): boolean {
  if (
    id === 'ag/gemini-2.5-flash' ||
    id.startsWith('ag/gemini-3.6-') ||
    id === 'ag/gemini-3-flash' ||
    id === 'ag/gemini-3-flash-agent' ||
    id === 'ag/gemini-pro-agent' ||
    id.startsWith('ag/gemini-3.5-') ||
    id === 'ag/gemini-3.1-pro-low'
  ) {
    return true;
  }
  if (id === 'ag/claude-sonnet-4-6' || id === 'ag/claude-opus-4-6-thinking' || id === 'claude-code') {
    return true;
  }
  if (
    id === 'openrouter/openrouter/free' ||
    id.includes('nemotron-3.5-lightning') ||
    id.includes('nemotron-3-ultra') ||
    id.includes('nemotron-3-super') ||
    id.includes('dots-3-note') ||
    id.includes('lyria-3-pro') ||
    id.includes('north-mini-code')
  ) {
    return true;
  }
  if (id === 'mistral/codestral-latest') {
    return true;
  }
  return false;
}

/**
 * Cek apakah model diketahui memiliki kendala upstream (404 not found, 403 tier, dll)
 */
export function isModelUnavailable(id: string): boolean {
  if (id.startsWith('ag/gemini-3.7-')) return true; // Upstream 404 entity not found
  if (id.startsWith('kimi/')) return true; // Upstream 403 subscription required
  if (id.startsWith('nvidia/')) return true; // Upstream 410 gone
  if (id.startsWith('gc/')) return true; // Upstream timeout
  return false;
}

/**
 * Kategori provider model untuk filtering tab di UI
 */
export function getModelCategory(
  id: string,
  modelObj?: { is_local?: boolean; provider?: string; endpoint_name?: string }
): 'gemini' | 'openrouter' | 'claude' | 'local' | 'other' {
  if (
    modelObj?.is_local ||
    modelObj?.provider === 'lmstudio' ||
    modelObj?.provider === 'ollama' ||
    modelObj?.endpoint_name?.toLowerCase().includes('lm studio') ||
    modelObj?.endpoint_name?.toLowerCase().includes('lokal')
  ) {
    return 'local';
  }
  const lower = id.toLowerCase();
  if (
    lower.startsWith('lfm3') ||
    lower.startsWith('ollama') ||
    lower.includes(':1.7b') ||
    lower.includes(':2b') ||
    lower.includes('liquidai') ||
    lower.includes('gguf')
  ) {
    return 'local';
  }
  if (id.startsWith('ag/gemini') || id.startsWith('gc/gemini') || lower.includes('gemini')) return 'gemini';
  if (id.startsWith('openrouter/')) return 'openrouter';
  if (lower.includes('claude')) return 'claude';
  return 'other';
}

/**
 * Cek apakah model mendukung input multimodal (gambar / vision / visual reasoning)
 */
export function isVisionCapableModel(modelId: string): boolean {
  if (!modelId) return false;
  const lower = modelId.toLowerCase();
  return (
    lower.includes('vl') ||
    lower.includes('vision') ||
    lower.includes('omni') ||
    lower.includes('llava') ||
    lower.includes('gemini') ||
    lower.includes('claude') ||
    lower.includes('gpt-4o') ||
    lower.includes('pixtral') ||
    lower.includes('minicpm-v')
  );
}

/**
 * Daftar preset model lokal keluarga Liquid AI LFM3 (hanya jika diaktifkan eksplisit)
 */
export const DEFAULT_LOCAL_LFM3_MODELS: ModelOption[] = [];

/**
 * Memeriksa endpoint LM Studio lokal (port default 1234) untuk menemukan model yang sedang aktif tanpa API key
 */
export async function probeLocalLmStudioModels(baseUrl = 'http://localhost:1234/v1'): Promise<ModelOption[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const modelsUrl = cleanBase.endsWith('/v1') ? `${cleanBase}/models` : `${cleanBase}/v1/models`;

    const res = await fetch(modelsUrl, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];

    const json = await res.json();
    const rawList = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
    if (rawList.length === 0) return [];

    return rawList
      .filter((m: any) => m && m.id && !String(m.id).toLowerCase().includes('embedding'))
      .map((m: any) => ({
        id: m.id,
        name: m.id,
        provider: 'lmstudio',
        endpoint_id: 'lmstudio',
        endpoint_name: 'Lokal (LM Studio)',
        context_length: m.context_length || m.max_context_length || 32768,
        is_local: true,
        capabilities: {
          vision: isVisionCapableModel(m.id),
        },
      }));
  } catch {
    return [];
  }
}

/**
 * Memeriksa endpoint Ollama lokal untuk menemukan model-model yang telah terinstal
 */
export async function probeLocalOllamaModels(baseUrl = 'http://localhost:11434'): Promise<ModelOption[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanBase}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];

    const json = await res.json();
    if (!json.models || !Array.isArray(json.models)) return [];

    return json.models.map((m: any) => ({
      id: m.name || m.model,
      name: m.name ? `${m.name} (Lokal)` : m.model,
      provider: 'ollama',
      endpoint_id: 'ollama',
      endpoint_name: 'Lokal (Ollama)',
      context_length: m.details?.context_length || 131072,
      is_local: true,
      capabilities: {
        vision: isVisionCapableModel(m.name || m.model),
      },
    }));
  } catch {
    return [];
  }
}

/**
 * Master Conversational Persona & System Instructions
 * Mengarahkan seluruh model AI agar selalu berkomunikasi dengan bahasa Indonesia yang natural,
 * hangat, mudah dipahami manusia, terstruktur rapi, dan bebas dari gaya telegrafik atau notasi mesin.
 */
export const CHATBOT_SYSTEM_PROMPT = `Anda adalah asisten kecerdasan buatan (AI) yang cerdas, ramah, dan berwawasan luas di aplikasi Autonomous AI Native Hub.

Pedoman Komunikasi dan Bahasa:
1. Bahasa Manusiawi dan Mengalir:
   - Gunakan bahasa Indonesia yang baik, natural, luwes, dan ramah seperti manusia berbicara kepada manusia.
   - Dilarang keras menggunakan gaya telegrafik, singkatan kaku, atau format notasi mesin internal (seperti "-> skipped:", "add when butuh:", dsb).
   - Bila pengguna menyapa santai (seperti "hi", "halo"), balaslah dengan sapaan hangat, sopan, dan bersahabat.
2. Penjelasan Konsep dan Pengetahuan:
   - Jelaskan konsep yang rumit dengan bahasa yang mudah dipahami dan gunakan analogi yang relevan sebelum masuk ke rincian teknis yang mendalam.
   - Berikan penjelasan yang utuh, bernilai, dan menyenangkan untuk dibaca manusia, jangan memotong informasi secara ekstrem.
3. Kerapian Format dan Keterbacaan Output:
   - Sajikan jawaban dengan format narasi yang bersih, teratur, dan mengalir secara alami.
   - Hindari membuat tabel pipa ASCII (| ... |) yang kaku dan padat simbol kecuali bila pengguna secara eksplisit meminta tabel data.
   - Bila menyajikan daftar perbandingan atau ringkasan, gunakan kalimat paragraf yang mengalir atau daftar poin sederhana dengan tanda strip tunggal (-) yang rapi, bukan deretan simbol acak atau format yang rumit dibaca.
   - Gunakan format teks tebal (bold) secukupnya hanya untuk kata kunci penting, hindari penandaan tebal berlebihan yang membuat teks tampak berantakan.
   - Dilarang menggunakan em dash (simbol tanda pisah panjang). Gunakan tanda baca biasa seperti koma, titik dua, atau tanda hubung biasa.
   - Dilarang menyisipkan emoji di dalam teks balasan.
4. Pembuatan Antarmuka (UI/UX) dan Kode:
   - Jika pengguna meminta pembuatan kode frontend atau desain UI, patuhi prinsip Flat Design minimalis (permukaan solid #212121 / #2f2f2f, border halus 1px #383838, tanpa gradien warna-warni berlebihan, kontras teks #ececec yang jelas, dan React 19 + TypeScript yang bersih).
5. Penyelesaian Penalaran dan Perhitungan (Thinking Models):
   - Jika Anda memproses soal matematika, logika, atau tugas bertahap, batasi proses penalaran dalam pikiran (internal reasoning) dan segera tuliskan penjelasan langkah demi langkah yang lengkap beserta jawaban akhir secara langsung kepada pengguna.
   - Dilarang mengulang-ulang proses penalaran dalam pikiran tanpa menuliskan respons teks final kepada pengguna.
6. Integrasi Context Vault dan Penulisan Catatan Terhubung:
   - Jika pengguna meminta Anda mencatat, merangkum, atau menyimpan konteks percakapan ke Vault (seperti "catat ini ke vault", "simpan konteks ini ke vault", atau perintah /vault):
     Sajikan catatan berformat Markdown rapi yang terstruktur untuk Context Vault:
     a. Tentukan judul catatan yang deskriptif dan padat (tanpa ekstensi .md).
     b. Berikan tags kategori yang relevan: Tags: #kategori #topik.
     c. Tuliskan ringkasan materi atau poin keputusan inti di bawah seksi "## Ringkasan Konteks".
     d. Wajib sertakan seksi "## Catatan Terkait" yang memuat tautan konsep terkait dalam sintaks wikilink [[NamaCatatan]].
     e. Beritahukan kepada pengguna bahwa catatan ini dapat disimpan langsung dan dihubungkan secara dua arah ke Context Vault menggunakan tombol "Simpan ke Vault" di bawah pesan.`;

export const SYSTEM_DESIGN_RULES = CHATBOT_SYSTEM_PROMPT;

/**
 * Helper untuk menyisipkan System Instructions ke dalam payload pesan percakapan,
 * termasuk instruksi kustom pengguna (Your AI) dan memori aktif jika dikonfigurasi.
 */
export function injectChatbotSystemPrompt(
  messages: Array<{ role: string; content: string }>,
  customInstructions?: string,
  memories?: Array<{ content: string }>
): Array<{ role: string; content: string }> {
  let prompt = CHATBOT_SYSTEM_PROMPT;

  if (customInstructions && customInstructions.trim()) {
    prompt += `\n\n[USER CUSTOM INSTRUCTIONS]\n${customInstructions.trim()}`;
  }

  if (memories && memories.length > 0) {
    const memoryList = memories.map((m) => `- ${m.content}`).join('\n');
    prompt += `\n\n[SAVED USER MEMORIES & PREFERENCES]\n${memoryList}`;
  }

  const existingSystemIndex = messages.findIndex((m) => m.role === 'system');

  if (existingSystemIndex !== -1) {
    const updated = [...messages];
    if (!updated[existingSystemIndex].content.includes('asisten kecerdasan buatan (AI) yang cerdas, ramah')) {
      updated[existingSystemIndex] = {
        ...updated[existingSystemIndex],
        content: `${prompt}\n\n${updated[existingSystemIndex].content}`,
      };
    }
    return updated;
  }

  // Jika belum ada system message, sisipkan di posisi paling awal
  return [{ role: 'system', content: prompt }, ...messages];
}

export const injectSystemDesignRules = injectChatbotSystemPrompt;

