import React, { useState } from 'react';
import {
  Save,
  Trash2,
  Plus,
  Search,
  Download,
  Upload,
  Brain,
  Edit2,
  Check,
  X,
  Copy,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { MemoryItem } from '../../types';

export const YourAITab: React.FC = () => {
  const { settings, updateSettings, addToast } = useStore();

  const [instructions, setInstructions] = useState<string>(
    settings.customInstructions || ''
  );
  const [isSaved, setIsSaved] = useState(false);

  // Modal State
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [memorySearch, setMemorySearch] = useState('');
  const [newMemoryText, setNewMemoryText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [importText, setImportText] = useState('');

  const memories: MemoryItem[] = settings.memories || [];

  // Simpan instruksi custom
  const handleSaveInstructions = () => {
    updateSettings({ customInstructions: instructions });
    setIsSaved(true);
    addToast('success', 'Instruksi kustom AI berhasil disimpan.');
    setTimeout(() => setIsSaved(false), 2000);
  };

  // Toggle Memory dari Chat
  const handleToggleMemoryEnabled = () => {
    const nextVal = !settings.memoryEnabled;
    updateSettings({ memoryEnabled: nextVal });
    addToast('info', `Memori percakapan ${nextVal ? 'diaktifkan' : 'dinonaktifkan'}.`);
  };

  // Toggle Topik Sensitif
  const handleToggleSensitive = () => {
    const nextVal = !settings.sensitiveTopicsEnabled;
    updateSettings({ sensitiveTopicsEnabled: nextVal });
    addToast(
      'info',
      `Penyimpanan topik sensitif ${nextVal ? 'diizinkan' : 'dibatasi'}.`
    );
  };

  // Tambah memori manual
  const handleAddMemory = () => {
    if (!newMemoryText.trim()) return;
    const newItem: MemoryItem = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      content: newMemoryText.trim(),
      createdAt: new Date().toISOString(),
      category: 'preference',
    };
    const updated = [newItem, ...memories];
    updateSettings({ memories: updated });
    setNewMemoryText('');
    addToast('success', 'Memori baru berhasil ditambahkan.');
  };

  // Hapus satu memori
  const handleDeleteMemory = (id: string) => {
    const updated = memories.filter((m) => m.id !== id);
    updateSettings({ memories: updated });
    addToast('info', 'Memori telah dihapus.');
  };

  // Simpan edit memori
  const handleSaveEdit = (id: string) => {
    if (!editingText.trim()) return;
    const updated = memories.map((m) =>
      m.id === id ? { ...m, content: editingText.trim() } : m
    );
    updateSettings({ memories: updated });
    setEditingId(null);
    setEditingText('');
    addToast('success', 'Memori berhasil diperbarui.');
  };

  // Ekspor Memori ke file Markdown
  const handleExportMemory = () => {
    if (memories.length === 0) {
      addToast('info', 'Belum ada memori untuk diekspor.');
      return;
    }

    const lines = [
      '# Agentic AI Memories',
      '',
      `Diekspor pada: ${new Date().toLocaleString()}`,
      `Total memori: ${memories.length}`,
      '',
      '## Daftar Memori',
      '',
    ];

    memories.forEach((m, idx) => {
      lines.push(`${idx + 1}. ${m.content} *(Dibuat: ${new Date(m.createdAt).toLocaleDateString()})*`);
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agentic-memories-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast('success', 'Berkas memori berhasil diekspor.');
  };

  // Impor Memori
  const handleImportSubmit = () => {
    if (!importText.trim()) return;

    // Pisahkan per baris atau JSON
    let parsedCount = 0;
    const newItems: MemoryItem[] = [];

    try {
      if (importText.trim().startsWith('[') || importText.trim().startsWith('{')) {
        const json = JSON.parse(importText);
        const arr = Array.isArray(json) ? json : [json];
        for (const item of arr) {
          const content = typeof item === 'string' ? item : item.content || item.text || item.memory;
          if (content && typeof content === 'string') {
            newItems.push({
              id: `mem_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              content: content.trim(),
              createdAt: new Date().toISOString(),
              category: 'general',
            });
            parsedCount++;
          }
        }
      }
    } catch {
      // Fallback: parse baris per baris
      const lines = importText.split('\n');
      for (const line of lines) {
        const clean = line.replace(/^[-*0-9.)\s]+/, '').trim();
        if (clean.length > 5) {
          newItems.push({
            id: `mem_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            content: clean,
            createdAt: new Date().toISOString(),
            category: 'general',
          });
          parsedCount++;
        }
      }
    }

    if (newItems.length > 0) {
      updateSettings({ memories: [...newItems, ...memories] });
      addToast('success', `${parsedCount} memori berhasil diimpor.`);
      setImportText('');
      setIsImportModalOpen(false);
    } else {
      addToast('warning', 'Format teks tidak dikenali atau kosong.');
    }
  };

  // Filter memori di modal
  const filteredMemories = memories.filter((m) =>
    m.content.toLowerCase().includes(memorySearch.toLowerCase())
  );

  const sampleTemplate = `# ROLE & IDENTITY
You are an expert Coding Mentor and Technical Architect. Your goal is to guide the user in learning software engineering, clean code principles, and problem-solving across any programming language or stack. You do not just write code; you teach how to think like a senior developer.

# CORE METHODOLOGY (STEP-BY-STEP LEARNING)
Whenever the user asks for coding help, bug fixes, or new feature development, follow this structured process:
1. Explain the underlying architecture and trade-offs.
2. Provide modular, production-grade code without bloat.
3. Verify test coverage and edge cases.`;

  return (
    <div className="space-y-6">
      {/* 1. SEKSI INSTRUCTIONS */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-[#ececec]">Instructions</h3>
            <p className="text-xs text-[#707070] mt-0.5">
              Agentic will keep these in mind for this and any of your chats within configured guidelines.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInstructions(sampleTemplate)}
              className="px-2.5 py-1 text-[11px] rounded-lg bg-[#282828] hover:bg-[#333333] border border-[#383838] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
              title="Isi dengan template arsitek & koding"
            >
              Gunakan Template
            </button>
            <button
              type="button"
              onClick={handleSaveInstructions}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                isSaved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#ececec] text-[#171717] hover:bg-white'
              }`}
            >
              {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSaved ? 'Tersimpan' : 'Simpan'}</span>
            </button>
          </div>
        </div>

        <div className="relative rounded-2xl bg-[#262626] border border-[#383838] p-3 focus-within:border-[#4f4f4f] transition-colors">
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={8}
            placeholder={sampleTemplate}
            className="w-full bg-transparent text-xs text-[#ececec] placeholder-[#707070] resize-y outline-none font-mono leading-relaxed"
          />
          <div className="flex items-center justify-between pt-2 border-t border-[#303030] text-[10px] text-[#707070]">
            <span>Mendukung format Markdown untuk penataan peran dan metodologi</span>
            <span>{instructions.length} karakter</span>
          </div>
        </div>
      </div>

      {/* 2. SEKSI MEMORY */}
      <div>
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-[#ececec]">Memory</h3>
          <p className="text-xs text-[#707070] mt-0.5">
            Kelola ingatan jangka panjang dan preferensi yang diingat AI dalam sesi percakapan.
          </p>
        </div>

        <div className="rounded-2xl bg-[#262626] border border-[#383838] divide-y divide-[#303030]">
          {/* Item 1: Generate memory from chats */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-[#ececec]">
                Generate memory from chats
              </div>
              <div className="text-[11px] text-[#707070] mt-0.5">
                Izinkan Agentic menyimpan konteks dan preferensi penting secara otomatis dari percakapan.
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleMemoryEnabled}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.memoryEnabled ? 'bg-blue-600' : 'bg-[#383838]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                  settings.memoryEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Item 2: Include sensitive topics in memory */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-[#ececec]">
                Include sensitive topics in memory
              </div>
              <div className="text-[11px] text-[#707070] mt-0.5">
                Izinkan Agentic menyimpan rincian topik sensitif seperti preferensi kesehatan pribadi atau keyakinan.
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleSensitive}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.sensitiveTopicsEnabled ? 'bg-blue-600' : 'bg-[#383838]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                  settings.sensitiveTopicsEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Item 3: Your memory */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#ececec]">Your memory</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#303030] text-[#ececec]">
                  {memories.length}
                </span>
              </div>
              <div className="text-[11px] text-[#707070] mt-0.5">
                Lihat, tambah, edit, atau hapus entri fakta yang tersimpan di memori.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsManageModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[#333333] hover:bg-[#3d3d3d] border border-[#444444] text-xs font-medium text-[#ececec] transition-colors"
            >
              Manage
            </button>
          </div>

          {/* Item 4: Import memory from other AI providers */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-[#ececec]">
                Import memory from other AI providers
              </div>
              <div className="text-[11px] text-[#707070] mt-0.5">
                Bawa konteks relevan dari akun Claude, ChatGPT, atau model lain ke dalam Agentic.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[#333333] hover:bg-[#3d3d3d] border border-[#444444] text-xs font-medium text-[#ececec] transition-colors"
            >
              Start import
            </button>
          </div>

          {/* Item 5: Export memory */}
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-[#ececec]">Export memory</div>
              <div className="text-[11px] text-[#707070] mt-0.5">
                Unduh seluruh rekaman memori Anda sebagai berkas Markdown (.md).
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportMemory}
              className="px-3 py-1.5 rounded-xl bg-[#333333] hover:bg-[#3d3d3d] border border-[#444444] text-xs font-medium text-[#ececec] transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-[#b4b4b4]" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: MANAGE MEMORY */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-[#212121] border border-[#383838] shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            {/* Header Modal */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2e2e]">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#ececec]" />
                <h4 className="text-sm font-semibold text-[#ececec]">Kelola Memori AI</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="p-1 rounded-lg text-[#707070] hover:text-[#ececec] hover:bg-[#282828] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input Tambah Memori Baru */}
            <div className="p-4 border-b border-[#2e2e2e] bg-[#262626]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMemoryText}
                  onChange={(e) => setNewMemoryText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddMemory();
                  }}
                  placeholder="Tambahkan memori baru (misal: 'User lebih suka TypeScript ketimbang JavaScript murni')..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[#1e1e1e] border border-[#383838] text-xs text-[#ececec] placeholder-[#707070] outline-none focus:border-[#4f4f4f]"
                />
                <button
                  type="button"
                  onClick={handleAddMemory}
                  disabled={!newMemoryText.trim()}
                  className="px-3 py-1.5 rounded-xl bg-[#ececec] text-[#171717] hover:bg-white text-xs font-semibold transition-colors disabled:opacity-40 flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>

            {/* Search Filter */}
            <div className="px-4 py-2 border-b border-[#2e2e2e] bg-[#212121] flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#707070]" />
              <input
                type="text"
                value={memorySearch}
                onChange={(e) => setMemorySearch(e.target.value)}
                placeholder="Cari dalam memori..."
                className="w-full bg-transparent text-xs text-[#ececec] placeholder-[#707070] outline-none"
              />
              {memorySearch && (
                <button
                  type="button"
                  onClick={() => setMemorySearch('')}
                  className="text-xs text-[#707070] hover:text-[#ececec]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Daftar Memori */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredMemories.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#707070]">
                  {memorySearch
                    ? 'Tidak ada memori yang cocok dengan pencarian.'
                    : 'Belum ada memori yang tersimpan. Tambahkan manual di atas atau biarkan AI mengingat dari percakapan.'}
                </div>
              ) : (
                filteredMemories.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-[#282828] border border-[#333333] flex items-start justify-between gap-3 text-xs"
                  >
                    {editingId === m.id ? (
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(m.id);
                          }}
                          className="flex-1 px-2.5 py-1 rounded-lg bg-[#1e1e1e] border border-[#4f4f4f] text-xs text-[#ececec] outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(m.id)}
                          className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-500"
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditingText('');
                          }}
                          className="px-2 py-1 rounded-lg bg-[#383838] text-[#ececec] text-xs hover:bg-[#444444]"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <p className="text-[#ececec] leading-relaxed">{m.content}</p>
                          <span className="text-[10px] text-[#707070] mt-1 block">
                            {new Date(m.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(m.id);
                              setEditingText(m.content);
                            }}
                            className="p-1 rounded text-[#707070] hover:text-[#ececec] hover:bg-[#333333] transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMemory(m.id)}
                            className="p-1 rounded text-[#707070] hover:text-rose-400 hover:bg-[#333333] transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-5 py-3 border-t border-[#2e2e2e] bg-[#1a1a1a] flex items-center justify-between text-xs text-[#707070]">
              <span>Total: {memories.length} memori tersimpan</span>
              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="px-3 py-1 rounded-lg bg-[#282828] hover:bg-[#333333] border border-[#383838] text-[#ececec]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: IMPORT MEMORY */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-[#212121] border border-[#383838] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2e2e]">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#ececec]" />
                <h4 className="text-sm font-semibold text-[#ececec]">Impor Memori dari AI Lain</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded-lg text-[#707070] hover:text-[#ececec] hover:bg-[#282828] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div className="p-3 rounded-xl bg-[#282828] border border-[#333333] text-xs text-[#b4b4b4] space-y-2">
                <span className="font-semibold text-[#ececec] block">
                  Petunjuk Pengambilan Memori dari ChatGPT / Claude:
                </span>
                <p>
                  Ketikkan prompt berikut di ChatGPT atau Claude Anda:
                </p>
                <div className="p-2 rounded-lg bg-[#1a1a1a] border border-[#383838] text-[11px] font-mono text-[#ececec] flex items-center justify-between">
                  <span>
                    "Tolong buatkan daftar poin lengkap dari semua memori, fakta pribadi, dan preferensi kerja saya yang kamu ingat."
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        'Tolong buatkan daftar poin lengkap dari semua memori, fakta pribadi, dan preferensi kerja saya yang kamu ingat.'
                      );
                      addToast('success', 'Prompt berhasil disalin ke clipboard.');
                    }}
                    className="p-1 rounded hover:bg-[#282828] text-[#707070] hover:text-[#ececec] ml-2"
                    title="Salin prompt"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#ececec] block mb-1">
                  Tempelkan Teks Hasil Memori:
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={6}
                  placeholder={`- User adalah software architect yang fokus pada clean code\n- User menyukai tema gelap pekat\n- User menggunakan Linux Fedora...`}
                  className="w-full p-3 rounded-xl bg-[#1e1e1e] border border-[#383838] text-xs text-[#ececec] placeholder-[#707070] outline-none focus:border-[#4f4f4f] font-mono resize-y"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[#2e2e2e] bg-[#1a1a1a] flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-[#282828] hover:bg-[#333333] border border-[#383838] text-[#ececec]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleImportSubmit}
                disabled={!importText.trim()}
                className="px-4 py-1.5 rounded-lg bg-[#ececec] text-[#171717] hover:bg-white font-semibold transition-colors disabled:opacity-40"
              >
                Impor Memori
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
