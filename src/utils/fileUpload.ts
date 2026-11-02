import { AttachedFile } from '../types';

const TEXT_FILE_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'yaml', 'yml', 'toml', 'ini', 'csv', 'tsv',
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'mts', 'cts',
  'py', 'rs', 'go', 'c', 'cpp', 'cc', 'h', 'hpp', 'cs', 'java', 'kt', 'kts',
  'rb', 'php', 'sh', 'bash', 'zsh', 'sql', 'html', 'htm', 'xml', 'svg',
  'css', 'scss', 'sass', 'less', 'lua', 'dart', 'swift', 'zig', 'r', 'dockerfile',
  'log', 'env', 'conf', 'config', 'vue', 'svelte', 'tex',
]);

const BINARY_EXTENSIONS_NO_TEXT = new Set([
  'zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'iso', 'bin', 'exe', 'dll', 'so',
  'dylib', 'dmg', 'pkg', 'deb', 'rpm', 'apk', 'jar', 'class', 'o', 'obj',
  'mp3', 'wav', 'ogg', 'mp4', 'mkv', 'avi', 'mov', 'flv', 'wasm',
]);

export const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
};

/**
 * Mengonversi data URL base64 atau string base64 murni ke Uint8Array.
 */
export function base64ToUint8Array(base64String: string): Uint8Array {
  const base64Clean = base64String.includes(',') ? base64String.split(',')[1] : base64String;
  const binaryString = atob(base64Clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Dekompresi data mentah deflate-raw menggunakan DecompressionStream bawaan Web browser.
 */
async function decompressDeflateRaw(compressedBytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(compressedBytes);
  writer.close();
  const response = new Response(ds.readable);
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Ekstraktor berkas ZIP sederhana tanpa dependensi luar berbasis Central Directory.
 * Mencari berkas spesifik di dalam arsip ZIP dan mengembalikan teks XML yang didekompresi.
 */
async function extractZipEntry(buffer: ArrayBuffer | Uint8Array, targetEntryName: string): Promise<string | null> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Cari End of Central Directory (EOCD) dengan memindai dari akhir berkas
  let eocdOffset = -1;
  const maxSearch = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= maxSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    return null;
  }

  const numEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  let currentCdOffset = cdOffset;
  for (let i = 0; i < numEntries; i++) {
    if (currentCdOffset + 46 > bytes.length) break;
    if (view.getUint32(currentCdOffset, true) !== 0x02014b50) break;

    const method = view.getUint16(currentCdOffset + 10, true);
    const compressedSize = view.getUint32(currentCdOffset + 20, true);
    const fileNameLen = view.getUint16(currentCdOffset + 28, true);
    const extraLen = view.getUint16(currentCdOffset + 30, true);
    const commentLen = view.getUint16(currentCdOffset + 32, true);
    const localHeaderOffset = view.getUint32(currentCdOffset + 42, true);

    const fileNameBytes = bytes.subarray(currentCdOffset + 46, currentCdOffset + 46 + fileNameLen);
    const fileName = new TextDecoder().decode(fileNameBytes);

    if (fileName === targetEntryName) {
      if (localHeaderOffset + 30 > bytes.length) return null;
      const localFileNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataOffset = localHeaderOffset + 30 + localFileNameLen + localExtraLen;

      if (dataOffset + compressedSize > bytes.length) return null;
      const rawData = bytes.subarray(dataOffset, dataOffset + compressedSize);

      if (method === 0) {
        return new TextDecoder().decode(rawData);
      } else if (method === 8) {
        const decompressed = await decompressDeflateRaw(rawData);
        return new TextDecoder().decode(decompressed);
      }
      return null;
    }

    currentCdOffset += 46 + fileNameLen + extraLen + commentLen;
  }

  return null;
}

/**
 * Membersihkan entitas XML dan tag khusus Word.
 */
function cleanXmlString(xml: string): string {
  return xml
    .replace(/<w:tab(?:\s[^>]*)?\/>/g, '\t')
    .replace(/<w:br(?:\s[^>]*)?\/>/g, '\n')
    .replace(/<w:cr(?:\s[^>]*)?\/>/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Ekstraktor teks dokumen Word (.docx) murni berbasis Web Standards.
 * Mengambil teks paragraf, daftar, dan tabel dari word/document.xml.
 */
export async function extractDocxText(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  try {
    const documentXml = await extractZipEntry(buffer, 'word/document.xml');
    if (!documentXml) {
      return '[Dokumen Word (.docx) tidak memuat berkas teks document.xml yang dapat dibaca]';
    }

    const lines: string[] = [];

    // Parse tabel Word (<w:tbl>) menjadi baris tabel terformat
    const processedXml = documentXml.replace(/<w:tbl(?:\s[^>]*)?>([\s\S]*?)<\/w:tbl>/g, (_match, tblBody) => {
      const tableRows: string[] = [];
      const trRegex = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
      let trMatch;
      while ((trMatch = trRegex.exec(tblBody)) !== null) {
        const trBody = trMatch[1];
        const cells: string[] = [];
        const tcRegex = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
        let tcMatch;
        while ((tcMatch = tcRegex.exec(trBody)) !== null) {
          const tcBody = tcMatch[1];
          let cellText = '';
          const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
          let tMatch;
          while ((tMatch = tRegex.exec(tcBody)) !== null) {
            cellText += tMatch[1];
          }
          cells.push(cleanXmlString(cellText.trim()));
        }
        if (cells.length > 0 && cells.some((c) => c.length > 0)) {
          tableRows.push(`| ${cells.join(' | ')} |`);
        }
      }
      return tableRows.length > 0 ? `\n\n${tableRows.join('\n')}\n\n` : '';
    });

    // Parse seluruh paragraf (<w:p>)
    const pRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(processedXml)) !== null) {
      const pBody = pMatch[1];
      let pText = '';
      const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
      let tMatch;
      while ((tMatch = tRegex.exec(pBody)) !== null) {
        pText += tMatch[1];
      }
      const cleaned = cleanXmlString(pText.trim());
      if (cleaned) {
        lines.push(cleaned);
      }
    }

    const result = lines.join('\n\n').trim();
    return result || '[Dokumen Word kosong atau tidak memuat teks]';
  } catch (err) {
    console.error('Gagal mengekstrak teks docx:', err);
    return `[Gagal membaca dokumen Word (.docx): ${err instanceof Error ? err.message : String(err)}]`;
  }
}

/**
 * Ekstraktor teks spreadsheet Excel (.xlsx) murni.
 * Mengambil kumpulan string bersama dari xl/sharedStrings.xml.
 */
export async function extractXlsxText(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  try {
    const sharedXml = await extractZipEntry(buffer, 'xl/sharedStrings.xml');
    if (!sharedXml) {
      return '[Berkas Excel (.xlsx) tidak memuat string bersama yang dapat diekstraksi]';
    }

    const values: string[] = [];
    const tRegex = /<t(?:\s[^>]*)?>([^<]*)<\/t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(sharedXml)) !== null) {
      const text = cleanXmlString(tMatch[1].trim());
      if (text) {
        values.push(text);
      }
    }

    return values.length > 0
      ? values.join(' | ')
      : '[Berkas Excel kosong]';
  } catch (err) {
    return `[Gagal membaca berkas Excel (.xlsx): ${err instanceof Error ? err.message : String(err)}]`;
  }
}

/**
 * Ekstraktor teks sederhana untuk berkas PDF (.pdf) dari stream teks BT/ET.
 * Mencegah binary freeze jika file PDF dilampirkan.
 */
export function extractPdfTextSafe(buffer: ArrayBuffer | Uint8Array): string {
  try {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const rawString = new TextDecoder('latin1').decode(bytes);

    const textChunks: string[] = [];
    // Cari stream teks PDF antara BT (Begin Text) dan ET (End Text)
    const btRegex = /BT[\s\S]*?ET/g;
    let btMatch;
    while ((btMatch = btRegex.exec(rawString)) !== null) {
      const stream = btMatch[0];
      // Cari teks di dalam kurung: (Teks) Tj atau [(Teks)] TJ
      const tjRegex = /\(([^)]+)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(stream)) !== null) {
        const text = tjMatch[1].trim();
        if (text) textChunks.push(text);
      }
    }

    if (textChunks.length > 0) {
      return textChunks.join(' ').replace(/\s{2,}/g, ' ').trim();
    }
    return '[Dokumen PDF: teks biner tidak dapat diurai secara langsung tanpa OCR]';
  } catch (err) {
    return '[Dokumen PDF: gagal mengurai konten teks]';
  }
}

/**
 * Membersihkan teks dari karakter kontrol biner atau null byte.
 */
export function sanitizeTextContent(text: string, maxChars: number = 80_000): string {
  // Hapus null bytes dan karakter kontrol biner acak kecuali newline, carriage return, dan tab
  let clean = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFD]/g, '');

  if (clean.length > maxChars) {
    clean = clean.slice(0, maxChars) + `\n\n[Catatan: Teks berkas dipotong hingga ${maxChars.toLocaleString()} karakter pertama demi keamanan konteks model.]`;
  }
  return clean;
}

/**
 * Membaca FileList dari HTML file picker atau Drag-and-Drop menjadi array AttachedFile.
 * Mendukung dokumen Office (docx, xlsx), PDF, kode sumber, dan gambar secara aman tanpa membuat freeze UI.
 */
export async function processSelectedFiles(
  fileList: FileList | File[] | null,
  maxSizeMB?: number
): Promise<{ files: AttachedFile[]; error?: string }> {
  if (!fileList || fileList.length === 0) return { files: [] };

  const attached: AttachedFile[] = [];
  const maxBytes = maxSizeMB && maxSizeMB > 0 ? maxSizeMB * 1024 * 1024 : 50 * 1024 * 1024; // Default 50MB batas aman

  const filesArray = Array.from(fileList);

  for (let i = 0; i < filesArray.length; i++) {
    const file = filesArray[i];

    if (file.size > maxBytes) {
      return {
        files: attached,
        error: `File "${file.name}" melebihi batas ukuran maksimal ${maxSizeMB || 50}MB.`,
      };
    }

    const ext = getFileExtension(file.name);
    const isImage = file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);

    try {
      let content = '';

      if (isImage) {
        // Gambar dibaca sebagai data URL untuk multimodal vision
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string) || '');
          reader.onerror = () => reject(new Error(`Gagal membaca gambar ${file.name}`));
          reader.readAsDataURL(file);
        });
      } else if (ext === 'docx') {
        // Dokumen Word: Ekstrak teks XML bersih
        const arrayBuffer = await file.arrayBuffer();
        content = await extractDocxText(arrayBuffer);
      } else if (ext === 'xlsx') {
        // Spreadsheet Excel: Ekstrak string bersama
        const arrayBuffer = await file.arrayBuffer();
        content = await extractXlsxText(arrayBuffer);
      } else if (ext === 'pdf') {
        // Dokumen PDF: Ekstrak teks aman
        const arrayBuffer = await file.arrayBuffer();
        content = extractPdfTextSafe(arrayBuffer);
      } else if (BINARY_EXTENSIONS_NO_TEXT.has(ext)) {
        // Berkas biner non-teks murni: Hindari binary dump
        content = `[Berkas Biner: ${file.name} (${(file.size / 1024).toFixed(1)} KB). Format arsip/biner ini tidak diuraikan sebagai teks.]`;
      } else if (
        TEXT_FILE_EXTENSIONS.has(ext) ||
        file.type.startsWith('text/') ||
        file.type === 'application/json' ||
        file.type === 'application/javascript' ||
        file.type === 'application/xml'
      ) {
        // Berkas teks atau kode sumber
        const rawText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string) || '');
          reader.onerror = () => reject(new Error(`Gagal membaca berkas teks ${file.name}`));
          reader.readAsText(file);
        });
        content = sanitizeTextContent(rawText);
      } else {
        // Format tidak dikenal: Coba baca sebagai teks, lalu periksa apakah memuat null bytes
        const rawText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string) || '');
          reader.onerror = () => reject(new Error(`Gagal membaca ${file.name}`));
          reader.readAsText(file);
        });

        // Deteksi biner: jika lebih dari 1% teks adalah null bytes atau unprintable, tandai biner
        let nullCount = 0;
        const sampleLen = Math.min(rawText.length, 1000);
        for (let j = 0; j < sampleLen; j++) {
          if (rawText.charCodeAt(j) === 0) nullCount++;
        }

        if (nullCount > 2) {
          content = `[Berkas Biner: ${file.name} (${(file.size / 1024).toFixed(1)} KB). Konten biner tidak diurai sebagai teks.]`;
        } else {
          content = sanitizeTextContent(rawText);
        }
      }

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
 * Menggabungkan teks prompt pengguna dengan isi berkas terlampir untuk dikirim ke LLM.
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

export interface ParsedUserMessageAttachment {
  name: string;
  sizeKb: string;
  lang: string;
  content: string;
  isImage: boolean;
}

export interface ParsedUserMessage {
  userPrompt: string;
  attachments: ParsedUserMessageAttachment[];
}

/**
 * Mengurai string pesan pengguna (yang mungkin memuat formatAttachedPrompt)
 * menjadi teks prompt murni dan metadata lampiran berkas yang elegan.
 */
export function parseUserMessageContent(rawContent: string): ParsedUserMessage {
  const marker = '=== LAMPIRAN FILE DARI DIREKTORI PENGGUNA ===';
  const markerIndex = rawContent.indexOf(marker);

  if (markerIndex === -1) {
    return { userPrompt: rawContent, attachments: [] };
  }

  const userPrompt = rawContent.slice(0, markerIndex).trim();
  const attachmentSection = rawContent.slice(markerIndex);

  const attachments: ParsedUserMessageAttachment[] = [];

  // Match: --- Mulai File: proposal.docx (120.4 KB) ---\n```docx\n...\n```\n--- Akhir File: proposal.docx ---
  const fileRegex = /--- Mulai File:\s*([^\n(]+)\s*\(([^)]+)\)\s*---\n```([^\n]*)\n([\s\S]*?)\n```\n--- Akhir File:/g;
  let match;
  while ((match = fileRegex.exec(attachmentSection)) !== null) {
    attachments.push({
      name: match[1].trim(),
      sizeKb: match[2].trim(),
      lang: match[3].trim(),
      content: match[4].trim(),
      isImage: false,
    });
  }

  // Match: [Lampiran Gambar: photo.png (45.2 KB)]
  const imageRegex = /\[Lampiran Gambar:\s*([^\n(]+)\s*\(([^)]+)\)\]/g;
  let imgMatch;
  while ((imgMatch = imageRegex.exec(attachmentSection)) !== null) {
    attachments.push({
      name: imgMatch[1].trim(),
      sizeKb: imgMatch[2].trim(),
      lang: 'image',
      content: '',
      isImage: true,
    });
  }

  return { userPrompt, attachments };
}

/**
 * Membuka jendela dialog pemilih berkas bawaan OS melalui Tauri IPC.
 * Melakukan pascapemrosesan otomatis jika berkas yang dipilih adalah docx atau berkas biner.
 */
export async function pickNativeFiles(): Promise<AttachedFile[]> {
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const files = await invoke<AttachedFile[]>('pick_files_native');
      if (!files || files.length === 0) return [];

      // Pascapemrosesan: jika berkas berupa docx atau biner yang dikembalikan dalam bentuk Base64
      const processed: AttachedFile[] = [];
      for (const f of files) {
        const ext = getFileExtension(f.name);
        if (ext === 'docx' && f.content && f.content.startsWith('data:')) {
          try {
            const bytes = base64ToUint8Array(f.content);
            const extractedText = await extractDocxText(bytes);
            processed.push({
              ...f,
              content: extractedText,
            });
          } catch {
            processed.push(f);
          }
        } else if (ext === 'xlsx' && f.content && f.content.startsWith('data:')) {
          try {
            const bytes = base64ToUint8Array(f.content);
            const extractedText = await extractXlsxText(bytes);
            processed.push({
              ...f,
              content: extractedText,
            });
          } catch {
            processed.push(f);
          }
        } else {
          processed.push(f);
        }
      }

      return processed;
    } catch (err) {
      console.error('Gagal membuka pemilih berkas bawaan OS:', err);
      throw err;
    }
  }
  return [];
}
