export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required?: string[];
    };
  };
}

export const AGENT_AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Membaca isi berkas teks dari jalur berkas yang ditentukan (relatif terhadap workspace atau jalur absolut).',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Jalur berkas yang akan dibaca (misal: "src/main.rs" atau "/path/to/file.txt")',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Menulis atau menimpa konten berkas teks secara lengkap ke jalur yang ditentukan.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Jalur berkas tujuan (misal: "src/components/NewComponent.tsx")',
          },
          content: {
            type: 'string',
            description: 'Isi teks lengkap yang akan ditulis ke berkas',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'Melihat daftar berkas dan direktori pada folder tertentu.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Jalur folder yang akan dilihat (default: "." untuk root workspace)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_command',
      description: 'Menjalankan perintah bash di dalam workspace atau direktori yang diizinkan (misal: kompilasi, tes, instalasi paket).',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Perintah shell bash untuk dieksekusi',
          },
          working_dir: {
            type: 'string',
            description: 'Direktori kerja eksekusi (opsional, default: root workspace)',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Mengambil konten teks atau data dari URL HTTP/HTTPS.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'Alamat URL web lengkap (contoh: "https://api.github.com/...")',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Mencari informasi aktual di internet dan otomatis membaca intisari teks dari halaman web teratas.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Kata kunci pencarian yang spesifik (misal: "tauri 2.0 tray icon release")',
          },
          max_chars: {
            type: 'number',
            description: 'Batas maksimal karakter konten teks halaman teratas yang dibaca (default: 4000)',
          },
        },
        required: ['query'],
      },
    },
  },
];

export function isPathExternal(targetPath: string, workspaceRoot: string): boolean {
  if (!targetPath || !workspaceRoot) return false;
  const cleanTarget = targetPath.trim().replace(/\/+/g, '/');
  const cleanWs = workspaceRoot.trim().replace(/\/+/g, '/').replace(/\/$/, '');

  // Jika jalur relatif dengan '../' yang melompat keluar
  if (cleanTarget.startsWith('../') || cleanTarget.includes('/../')) {
    return true;
  }

  // Jika jalur absolut
  if (cleanTarget.startsWith('/')) {
    return !cleanTarget.startsWith(cleanWs);
  }

  return false;
}
