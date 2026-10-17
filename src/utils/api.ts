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
          if (delta.reasoning_content) fullReasoning += delta.reasoning_content;
        } else {
          const msg = chunk.choices?.[0]?.message;
          if (msg?.content) fullContent += msg.content;
          if (msg?.reasoning_content) fullReasoning += msg.reasoning_content;
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

/**
 * Resolves the appropriate base URL and API Key for a selected model
 * across multiple custom endpoints and standard providers.
 */
export function resolveEndpointForModel(
  modelId: string,
  availableModels: Array<{ id: string; endpoint_id?: string; provider?: string }>,
  apiKeys: Array<{ provider: string; api_key: string; base_url?: string; is_active: boolean }>
): { baseUrl: string; apiKey: string; provider: string } {
  const matchedModel = availableModels.find((m) => m.id === modelId);
  const endpointId = matchedModel?.endpoint_id || matchedModel?.provider;

  if (endpointId) {
    const matchedKey = apiKeys.find((k) => k.provider === endpointId && k.is_active);
    if (matchedKey && matchedKey.api_key.trim()) {
      return {
        baseUrl: matchedKey.base_url || 'http://localhost:20128/v1',
        apiKey: matchedKey.api_key,
        provider: matchedKey.provider,
      };
    }
  }

  // Fallback ke endpoint custom pertama yang aktif
  const firstActiveCustom = apiKeys.find(
    (k) => (k.provider === 'custom' || k.provider.startsWith('custom_')) && k.is_active && k.api_key.trim().length > 0
  );
  if (firstActiveCustom) {
    return {
      baseUrl: firstActiveCustom.base_url || 'http://localhost:20128/v1',
      apiKey: firstActiveCustom.api_key,
      provider: firstActiveCustom.provider,
    };
  }

  // Fallback default
  const defaultKey = apiKeys.find((k) => k.provider === 'custom');
  return {
    baseUrl: defaultKey?.base_url || 'http://localhost:20128/v1',
    apiKey: defaultKey?.api_key || '',
    provider: 'custom',
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

  // 6. Generic Error
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
export function getModelCategory(id: string): 'gemini' | 'openrouter' | 'claude' | 'other' {
  if (id.startsWith('ag/gemini') || id.startsWith('gc/gemini') || id.toLowerCase().includes('gemini')) return 'gemini';
  if (id.startsWith('openrouter/')) return 'openrouter';
  if (id.toLowerCase().includes('claude')) return 'claude';
  return 'other';
}

/**
 * Master UI/UX & Flat Design System Directives (ChatGPT Style)
 * Diinjeksikan otomatis ke seluruh sesi AI (Chatbot, Single Agent, Multi-Agent Squad)
 * agar setiap pembuatan kode UI, komponen, atau styling secara otomatis mematuhi aturan baku.
 */
export const SYSTEM_DESIGN_RULES = `
[MASTER DESIGN RULE: FLAT MINIMALISM (CHATGPT-STYLE)]
Setiap kali Anda membuat, merevisi, atau menyarankan kode frontend / UI, Anda WAJIB mematuhi panduan baku Flat Design berikut:
1. True Solid Surfaces (Anti-Slop):
   - Background utama: #212121
   - Sidebar / deep surface: #171717
   - Card / Input dock / Surface: #2f2f2f
   - Hover / Secondary: #262626 atau #383838
   - Dilarang keras menggunakan gradien warna-warni murah (seperti gradien ungu-biru slop) dan dilarang full-screen backdrop-blur.
2. Kontras & Border Halus:
   - Teks utama: #ececec, teks sekunder: #b4b4b4, placeholder: #707070.
   - Border halus 1px: #303030 atau #383838, focus border: #4f4f4f.
   - Jangan menggunakan bayangan tebal/shadow-2xl berlebihan. Kedalaman visual murni dibangun lewat kontras solid surface dan border 1px.
3. Ergonomi & Tata Letak:
   - Input dock chat selalu diletakkan di bagian bawah (fixed bottom dock) dengan radius rounded-3xl.
   - Berikan kelonggaran ruang kanvas percakapan (breathing room), hindari elemen berulang/redundan di header.
   - Tombol-tombol aksi di dalam kapsul chat memiliki tinggi seragam (h-8 / 32px) dengan radius rounded-full.
4. Kualitas Kode:
   - Gunakan React 19 + TypeScript yang ketat tanpa unused imports.
   - Terapkan 4 Boundary States (Loading Skeleton, Empty State, Error Boundary, Success Toast).
`;

/**
 * Helper untuk menyisipkan System Design Rules ke dalam payload pesan percakapan
 */
export function injectSystemDesignRules(
  messages: Array<{ role: string; content: string }>
): Array<{ role: string; content: string }> {
  // Jika pesan pertama sudah bertindak sebagai system message, tambahkan rule ke dalamnya
  const existingSystemIndex = messages.findIndex((m) => m.role === 'system');

  if (existingSystemIndex !== -1) {
    const updated = [...messages];
    if (!updated[existingSystemIndex].content.includes('[MASTER DESIGN RULE: FLAT MINIMALISM')) {
      updated[existingSystemIndex] = {
        ...updated[existingSystemIndex],
        content: `${updated[existingSystemIndex].content}\n\n${SYSTEM_DESIGN_RULES}`,
      };
    }
    return updated;
  }

  // Jika belum ada system message, sisipkan di posisi paling awal
  return [{ role: 'system', content: SYSTEM_DESIGN_RULES }, ...messages];
}

