import { AttachedFile } from '../types';

const TEXT_FILE_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'yaml', 'yml', 'toml', 'ini', 'csv', 'tsv',
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'mts', 'cts',
  'py', 'rs', 'go', 'c', 'cpp', 'cc', 'h', 'hpp', 'cs', 'java', 'kt', 'kts',
  'rb', 'php', 'sh', 'bash', 'zsh', 'sql', 'html', 'htm', 'xml', 'svg',
  'css', 'scss', 'sass', 'less', 'lua', 'dart', 'swift', 'zig', 'r', 'dockerfile',
]);

const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
};

/**
 * Membaca FileList dari HTML file picker atau Drag-and-Drop menjadi array AttachedFile.
 * Mendukung seluruh jenis berkas mentah (raw text atau raw dataURL / base64).
 */
export async function processSelectedFiles(
  fileList: FileList | File[] | null,
  maxSizeMB?: number
): Promise<{ files: AttachedFile[]; error?: string }> {
  if (!fileList || fileList.length === 0) return { files: [] };

  const attached: AttachedFile[] = [];
  const maxBytes = maxSizeMB && maxSizeMB > 0 ? maxSizeMB * 1024 * 1024 : Infinity;

  const filesArray = Array.from(fileList);

  for (let i = 0; i < filesArray.length; i++) {
    const file = filesArray[i];

    if (file.size > maxBytes) {
      return {
        files: attached,
        error: `File "${file.name}" melebihi batas ukuran maksimal ${maxSizeMB}MB.`,
      };
    }

    const isImage = file.type.startsWith('image/');
    const ext = getFileExtension(file.name);
    const isKnownText =
      TEXT_FILE_EXTENSIONS.has(ext) ||
      file.type.startsWith('text/') ||
      file.type === 'application/json' ||
      file.type === 'application/javascript' ||
      file.type === 'application/xml';

    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        if (isImage) {
          reader.readAsDataURL(file);
        } else if (isKnownText) {
          reader.readAsText(file);
        } else {
          // Fallback cerdas: Coba baca sebagai teks terlebih dahulu
          reader.readAsText(file);
        }

        reader.onload = () => {
          const res = reader.result;
          if (typeof res === 'string') {
            resolve(res);
          } else {
            resolve('');
          }
        };

        reader.onerror = () => {
          // Jika gagal membaca teks (misal file biner non-gambar), fallback ke DataURL
          const fallbackReader = new FileReader();
          fallbackReader.readAsDataURL(file);
          fallbackReader.onload = () => resolve((fallbackReader.result as string) || '');
          fallbackReader.onerror = () => reject(new Error(`Gagal membaca file ${file.name}`));
        };
      });

      attached.push({
        id: `file-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        size: file.size,
        type: file.type || (ext ? `application/${ext}` : 'application/octet-stream'),
        content,
        isImage,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { files: attached, error: msg };
    }
  }

  return { files: attached };
}

/**
 * Menggabungkan teks input instruksi pengguna dengan isi seluruh berkas terlampir.
 */
export function formatAttachedPrompt(userText: string, attachedFiles: AttachedFile[]): string {
  if (attachedFiles.length === 0) return userText;

  let formatted = userText.trim();
  formatted += '\n\n=== LAMPIRAN FILE DARI DIREKTORI PENGGUNA ===\n';

  for (const f of attachedFiles) {
    const ext = getFileExtension(f.name);
    const lang = ext || 'text';

    if (f.isImage) {
      formatted += `\n[Lampiran Gambar: ${f.name} (${(f.size / 1024).toFixed(1)} KB)]\n`;
    } else {
      formatted += `\n--- Mulai File: ${f.name} (${(f.size / 1024).toFixed(1)} KB) ---\n\`\`\`${lang}\n${f.content}\n\`\`\`\n--- Akhir File: ${f.name} ---\n`;
    }
  }

  formatted += '=== AKHIR LAMPIRAN FILE ===';
  return formatted;
}

/**
 * Membuka jendela dialog pemilih berkas bawaan OS secara langsung melalui Tauri IPC.
 * Memungkinkan navigasi bebas ke seluruh folder dan subdirektori sistem berkas tanpa batasan WebKit.
 */
export async function pickNativeFiles(): Promise<AttachedFile[]> {
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const files = await invoke<AttachedFile[]>('pick_files_native');
      return files || [];
    } catch (err) {
      console.error('Gagal membuka pemilih berkas bawaan OS:', err);
      throw err;
    }
  }
  return [];
}
