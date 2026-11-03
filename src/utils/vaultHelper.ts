import { ScoredSearchResult } from '../types';

/**
 * Utilitas komunikasi dan manajemen catatan dua arah (bidirectional linking) ke Context Vault
 */

export interface VaultNoteSavePayload {
  title: string;
  summary: string;
  tags: string[];
  relatedNoteTitles: string[];
  agentId?: string;
}

export interface VaultSaveResult {
  success: boolean;
  title: string;
  connectedCount: number;
  message: string;
}

/**
 * Mencari catatan relevan di Context Vault menggunakan pencarian semantik hybrid
 */
export async function searchVaultNotes(query: string, limit: number = 5): Promise<ScoredSearchResult[]> {
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  if (!isTauri) {
    return [];
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const results = await invoke<ScoredSearchResult[]>('search_notes_hybrid', {
      query,
      limit,
    });
    return results || [];
  } catch (err) {
    console.warn('Gagal mencari catatan di Context Vault:', err);
    return [];
  }
}

/**
 * Menyusun format Markdown baku catatan Context Vault dengan tags dan wikilinks
 */
export function formatVaultNoteContent(
  title: string,
  summary: string,
  tags: string[],
  relatedNoteTitles: string[]
): string {
  const cleanTags = tags
    .map((t) => t.trim().replace(/^#/, ''))
    .filter(Boolean)
    .map((t) => `#${t}`)
    .join(' ');

  let content = `# ${title.trim()}\n\n`;

  if (cleanTags) {
    content += `Tags: ${cleanTags}\n\n`;
  }

  content += `## Ringkasan Konteks\n${summary.trim()}\n\n`;

  if (relatedNoteTitles && relatedNoteTitles.length > 0) {
    content += `## Catatan Terkait\n`;
    for (const rel of relatedNoteTitles) {
      const cleanRel = rel.trim();
      if (cleanRel) {
        content += `- [[${cleanRel}]]\n`;
      }
    }
  }

  return content;
}

/**
 * Menyimpan catatan baru ke Context Vault dan otomatis menyisipkan tautan balik ke catatan lama
 */
export async function saveContextToVaultWithBidirectionalLinks(
  payload: VaultNoteSavePayload
): Promise<VaultSaveResult> {
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  if (!isTauri) {
    return {
      success: true,
      title: payload.title,
      connectedCount: payload.relatedNoteTitles.length,
      message: 'Mode Web Preview: Catatan berhasil disimulasikan.',
    };
  }

  const { invoke } = await import('@tauri-apps/api/core');
  const agentId = payload.agentId || 'chat_assistant';
  const cleanTitle = payload.title.trim().replace(/[\\/:*?"<>|]/g, '-');

  // 1. Susun konten markdown terstruktur
  const markdownContent = formatVaultNoteContent(
    cleanTitle,
    payload.summary,
    payload.tags,
    payload.relatedNoteTitles
  );

  // 2. Buat catatan baru di Vault
  try {
    await invoke('create_note', {
      agentId,
      title: cleanTitle,
      content: markdownContent,
    });
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    return {
      success: false,
      title: cleanTitle,
      connectedCount: 0,
      message: `Gagal membuat catatan baru: ${errMsg}`,
    };
  }

  // 3. Tautkan balik secara otomatis ke setiap catatan lama yang relevan
  let connectedCount = 0;
  for (const targetTitle of payload.relatedNoteTitles) {
    const cleanTarget = targetTitle.trim();
    if (!cleanTarget || cleanTarget === cleanTitle) continue;

    try {
      await invoke('append_vault_backlink', {
        agentId,
        targetTitle: cleanTarget,
        newNoteTitle: cleanTitle,
      });
      connectedCount++;
    } catch (err) {
      console.warn(`Gagal menambahkan tautan balik ke '${cleanTarget}':`, err);
    }
  }

  return {
    success: true,
    title: cleanTitle,
    connectedCount,
    message: `Catatan '${cleanTitle}' berhasil disimpan ke Context Vault dan terhubung dengan ${connectedCount} catatan terkait.`,
  };
}
