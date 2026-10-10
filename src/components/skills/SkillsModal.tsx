import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  Download,
  FolderPlus,
  Trash2,
  HardDrive,
  FolderGit2,
  Check,
  Search,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

// Curated Skill Catalog to Install with 1 Click
const SKILL_CATALOG = [
  {
    name: 'Git Workflow & Conventional Commits',
    description: 'Menstandarisasi commit message, branching strategy, dan rebase hygiene.',
    content: `# Git Hygiene Skill\nFollow conventional commits: feat:, fix:, docs:, refactor:, test:. Ensure rebase without messy merge commits.`,
  },
  {
    name: 'Security Sandbox Checker',
    description: 'Verifikasi sanitasi path, deteksi symlink traversal, dan isolasi memori.',
    content: `# Security Sandbox Skill\nStrictly check canonical path prefixes. Prevent parent traversal (../). Verify read-only permissions where applicable.`,
  },
  {
    name: 'SQLite Indexing & Query Optimizer',
    description: 'Optimasi skema database SQLite, indexing b-tree, dan WAL mode configuration.',
    content: `# SQLite Optimizer Skill\nAlways enable WAL mode (PRAGMA journal_mode=WAL). Create covering indexes for foreign key joins.`,
  },
  {
    name: 'Tauri 2.0 Native IPC Bridge',
    description: 'Panduan pola IPC asinkron Tauri 2.0, state management, dan error handling.',
    content: `# Tauri 2.0 IPC Bridge Skill\nWrap commands with async Result<T, String>. Use Tauri state managed Arc references safely across threads.`,
  },
];

export const SkillsModal: React.FC = () => {
  const {
    isSkillsModalOpen,
    setSkillsModalOpen,
    installedSkills,
    installSkill,
    uninstallSkill,
    importSkillFromText,
    addToast,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'installed' | 'catalog' | 'import'>('installed');
  const [selectedLocation, setSelectedLocation] = useState<'project' | 'global'>('project');
  const [searchQuery, setSearchQuery] = useState('');

  // Import Form State
  const [importName, setImportName] = useState('');
  const [importContent, setImportContent] = useState('');

  if (!isSkillsModalOpen) return null;

  const filteredInstalled = installedSkills.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCatalogInstall = async (item: (typeof SKILL_CATALOG)[0]) => {
    const basePath =
      selectedLocation === 'project'
        ? '/home/yudz/Agentic/skills'
        : '/home/yudz/.agentic/skills';
    const folder = item.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    await installSkill({
      name: item.name,
      description: item.description,
      location: selectedLocation,
      path: `${basePath}/${folder}/SKILL.md`,
      content: item.content,
    });
  };

  const handleCustomImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importName.trim() || !importContent.trim()) {
      addToast('error', 'Nama dan konten skill wajib diisi.');
      return;
    }

    await importSkillFromText(importName.trim(), importContent.trim(), selectedLocation);
    setImportName('');
    setImportContent('');
    setActiveTab('installed');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="bg-[#171717] border border-[#303030] w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#262626] flex items-center justify-between bg-[#171717]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#212121] border border-[#303030] text-amber-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#ececec]">Skills Hub & Manager</h2>
                <p className="text-xs text-[#b4b4b4]">
                  Pasang & kelola instruksi kemampuan untuk subagent otonom
                </p>
              </div>
            </div>

            <button
              onClick={() => setSkillsModalOpen(false)}
              className="p-1.5 rounded-xl hover:bg-[#212121] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Bar & Target Location Picker */}
          <div className="px-5 py-3 border-b border-[#262626] bg-[#171717] flex flex-wrap items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-[#212121] p-1 rounded-xl border border-[#303030]">
              <button
                onClick={() => setActiveTab('installed')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'installed'
                    ? 'bg-[#2f2f2f] text-[#ececec] border border-[#383838]'
                    : 'text-[#b4b4b4] hover:text-[#ececec]'
                }`}
              >
                Terpasang ({installedSkills.length})
              </button>
              <button
                onClick={() => setActiveTab('catalog')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'catalog'
                    ? 'bg-[#2f2f2f] text-[#ececec] border border-[#383838]'
                    : 'text-[#b4b4b4] hover:text-[#ececec]'
                }`}
              >
                Katalog Rekomendasi
              </button>
              <button
                onClick={() => setActiveTab('import')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === 'import'
                    ? 'bg-[#2f2f2f] text-[#ececec] border border-[#383838]'
                    : 'text-[#b4b4b4] hover:text-[#ececec]'
                }`}
              >
                Impor / Tambah Baru
              </button>
            </div>

            {/* Target Location Toggle (Project vs Global) */}
            <div className="flex items-center gap-1.5 text-xs text-[#b4b4b4]">
              <span className="text-[11px]">Lokasi Simpan:</span>
              <div className="flex items-center bg-[#212121] rounded-lg p-0.5 border border-[#303030]">
                <button
                  onClick={() => setSelectedLocation('project')}
                  title="Simpan di /home/yudz/Agentic/skills/"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    selectedLocation === 'project'
                      ? 'bg-[#2f2f2f] text-[#ececec] border border-[#383838]'
                      : 'text-[#707070] hover:text-[#ececec]'
                  }`}
                >
                  <FolderGit2 className="w-3 h-3 text-[#ececec]" />
                  <span>Project</span>
                </button>
                <button
                  onClick={() => setSelectedLocation('global')}
                  title="Simpan di ~/.agentic/skills/"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    selectedLocation === 'global'
                      ? 'bg-[#2f2f2f] text-[#ececec] border border-[#383838]'
                      : 'text-[#707070] hover:text-[#ececec]'
                  }`}
                >
                  <HardDrive className="w-3 h-3 text-emerald-400" />
                  <span>Global</span>
                </button>
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 bg-[#171717]">
            {activeTab === 'installed' && (
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari skill terpasang..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#212121] border border-[#303030] text-xs text-[#ececec] placeholder-[#707070] outline-none focus:border-[#404040]"
                  />
                </div>

                {filteredInstalled.length === 0 ? (
                  <div className="text-center py-10 text-[#707070]">
                    <p className="text-xs">Belum ada skill yang sesuai kriteria.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {filteredInstalled.map((skill) => (
                      <div
                        key={skill.id}
                        className="p-3.5 rounded-xl bg-[#212121] border border-[#303030] flex items-start justify-between gap-3 hover:border-[#383838] transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#ececec]">
                              {skill.name}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                                skill.location === 'project'
                                  ? 'bg-[#2f2f2f] text-[#ececec] border border-[#383838]'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}
                            >
                              {skill.location}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#b4b4b4] mt-1 leading-relaxed">
                            {skill.description}
                          </p>
                          <p className="text-[10px] font-mono text-[#707070] mt-1.5 truncate">
                            {skill.path}
                          </p>
                        </div>

                        <button
                          onClick={() => uninstallSkill(skill.id)}
                          title="Hapus skill ini"
                          className="p-1.5 rounded-lg text-[#707070] hover:text-red-400 hover:bg-[#2a2a2a] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'catalog' && (
              <div className="space-y-3">
                <p className="text-xs text-[#b4b4b4]">
                  Pilih skill di bawah untuk langsung dipasang ke direktori yang dipilih:
                </p>

                <div className="grid grid-cols-1 gap-2.5">
                  {SKILL_CATALOG.map((cat, idx) => {
                    const isAlreadyInstalled = installedSkills.some((s) => s.name === cat.name);

                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-[#212121] border border-[#303030] flex items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-semibold text-[#ececec]">{cat.name}</h4>
                          <p className="text-[11px] text-[#b4b4b4] mt-0.5 leading-relaxed">
                            {cat.description}
                          </p>
                        </div>

                        {isAlreadyInstalled ? (
                          <div className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-mono">
                            <Check className="w-3 h-3" />
                            <span>Terpasang</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCatalogInstall(cat)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-black text-xs font-medium transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Pasang</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'import' && (
              <form onSubmit={handleCustomImport} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#b4b4b4] mb-1">
                    Nama Skill
                  </label>
                  <input
                    type="text"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    placeholder="Misal: Python Data Science & Pandas"
                    className="w-full px-3 py-1.5 rounded-xl bg-[#212121] border border-[#303030] text-xs text-[#ececec] placeholder-[#707070] outline-none focus:border-[#404040]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#b4b4b4] mb-1">
                    Isi Instruksi Markdown (SKILL.md)
                  </label>
                  <textarea
                    rows={6}
                    value={importContent}
                    onChange={(e) => setImportContent(e.target.value)}
                    placeholder="# Panduan Skill&#10;&#10;Instruksi mendalam tentang cara agent mengeksekusi tugas khusus ini..."
                    className="w-full px-3 py-2 rounded-xl bg-[#212121] border border-[#303030] text-xs text-[#ececec] placeholder-[#707070] font-mono outline-none focus:border-[#404040] resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ececec] hover:bg-white text-black text-xs font-medium transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Simpan Skill ke {selectedLocation === 'project' ? 'Project' : 'Global'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SkillsModal;
