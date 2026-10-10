import { AttachedFile } from '../types';

/**
 * Membaca FileList dari HTML file picker menjadi array AttachedFile
 */
export async function processSelectedFiles(
  fileList: FileList | null,
  maxSizeMB: number = 5
): Promise<{ files: AttachedFile[]; error?: string }> {
  if (!fileList || fileList.length === 0) return { files: [] };

  const attached: AttachedFile[] = [];
  const maxBytes = maxSizeMB * 1024 * 1024;

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (file.size > maxBytes) {
      return {
        files: attached,
        error: `File "${file.name}" melebihi batas ukuran maksimal ${maxSizeMB}MB.`,
      };
    }

    const isImage = file.type.startsWith('image/');

    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        if (isImage) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
        reader.onload = () => resolve(reader.result as string || '');
        reader.onerror = () => reject(new Error(`Gagal membaca file ${file.name}`));
      });

      attached.push({
        id: `file-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        size: file.size,
        type: file.type || 'text/plain',
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
 * Menggabungkan teks input instruksi pengguna dengan isi seluruh file terlampir
 */
export function formatAttachedPrompt(userText: string, attachedFiles: AttachedFile[]): string {
  if (attachedFiles.length === 0) return userText;

  let formatted = userText.trim();
  formatted += '\n\n=== LAMPIRAN FILE DARI DIREKTORI PENGGUNA ===\n';

  for (const f of attachedFiles) {
    if (f.isImage) {
      formatted += `\n[Lampiran Gambar: ${f.name} (${(f.size / 1024).toFixed(1)} KB)]\n`;
    } else {
      formatted += `\n--- Mulai File: ${f.name} ---\n${f.content}\n--- Akhir File: ${f.name} ---\n`;
    }
  }

  formatted += '=== AKHIR LAMPIRAN FILE ===';
  return formatted;
}
