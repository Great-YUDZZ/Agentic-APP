import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, FolderPlus, Download, Check, FileText } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface CreateSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SKILL_CATALOG = [
  {
    name: 'Multi-Agent Orchestration',
    description: 'Koordinasi terarah sub-agen, pemecahan DAG tugas, decision gates, dan loop pengawasan.',
    content: `# Multi-Agent Orchestration Skill\nCoordinate supervised workers: threaded messages, blocking ask/reply, task dispatch, worker_done/escalation waits, task DAGs, decision gates, coordinator loops, and decomposing work across agents. Ensure architectural coherence and review subagent outputs before merging.`,
  },
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

export const CreateSkillModal: React.FC<CreateSkillModalProps> = ({ isOpen, onClose }) => {
  const { installSkill, importSkillFromText, addToast, installedSkills } = useStore();

  const [activeTab, setActiveTab] = useState<'create' | 'catalog'>('create');
  const [targetLocation, setTargetLocation] = useState<'project' | 'global'>('project');

  // Form states for manual creation
  const [skillName, setSkillName] = useState('');
  const [skillDescription, setSkillDescription] = useState('');
  const [skillContent, setSkillContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillName.trim()) {
      addToast('error', 'Nama skill tidak boleh kosong.');
      return;
    }
    if (!skillContent.trim()) {
      addToast('error', 'Instruksi Markdown (SKILL.md) tidak boleh kosong.');
      return;
    }

    try {
      setIsSubmitting(true);
      await importSkillFromText(skillName.trim(), skillContent.trim(), targetLocation);
      addToast('info', `Skill '${skillName.trim()}' berhasil dibuat dan dipasang.`);
      setSkillName('');
      setSkillDescription('');
      setSkillContent('');
      onClose();
    } catch (err) {
      addToast('error', `Gagal membuat skill: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCatalogInstall = async (item: (typeof SKILL_CATALOG)[0]) => {
    try {
      const basePath =
        targetLocation === 'project'
          ? '/home/yudz/Agentic/skills'
          : '/home/yudz/.agentic/skills';
      const folder = item.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

      await installSkill({
        name: item.name,
        description: item.description,
        location: targetLocation,
        path: `${basePath}/${folder}/SKILL.md`,
        content: item.content,
      });

      addToast('info', `Skill '${item.name}' berhasil dipasang ke ${targetLocation}.`);
    } catch (err) {
      addToast('error', `Gagal memasang skill: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-2xl bg-[#212121] border border-[#383838] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#303030]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#282828] border border-[#383838] text-[#ececec]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#ececec]">Tambah / Buat Skill Baru</h2>
                <p className="text-xs text-[#707070]">
                  Perluas keahlian agen autonomous dengan dokumen instruksi SKILL.md.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-[#2f2f2f] text-[#b4b4b4] hover:text-white transition-colors"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Sub-Tabs & Location Switcher */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-[#2a2a2a] bg-[#1a1a1a]">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 bg-[#262626] p-1 rounded-xl border border-[#383838]">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'create'
                    ? 'bg-[#383838] text-[#ececec]'
                    : 'text-[#707070] hover:text-[#ececec]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Buat Baru</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('catalog')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'catalog'
                    ? 'bg-[#383838] text-[#ececec]'
                    : 'text-[#707070] hover:text-[#ececec]'
                }`}
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Katalog Rekomendasi</span>
              </button>
            </div>

            {/* Target Location Toggle */}
            <div className="flex items-center gap-1.5 text-xs text-[#707070]">
              <span>Target:</span>
              <div className="flex items-center bg-[#262626] p-0.5 rounded-lg border border-[#383838]">
                <button
                  type="button"
                  onClick={() => setTargetLocation('project')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    targetLocation === 'project'
                      ? 'bg-[#383838] text-[#ececec]'
                      : 'text-[#707070] hover:text-[#ececec]'
                  }`}
                >
                  Proyek
                </button>
                <button
                  type="button"
                  onClick={() => setTargetLocation('global')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    targetLocation === 'global'
                      ? 'bg-[#383838] text-[#ececec]'
                      : 'text-[#707070] hover:text-[#ececec]'
                  }`}
                >
                  Global (~/.agentic)
                </button>
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {activeTab === 'create' ? (
              <form onSubmit={handleManualCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#ececec] mb-1.5">
                    Nama Skill
                  </label>
                  <input
                    type="text"
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                    placeholder="Contoh: Docker Deployment Automation"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#1e1e1e] border border-[#383838] text-xs text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#4f4f4f] transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#ececec] mb-1.5">
                    Deskripsi Singkat (Opsional)
                  </label>
                  <input
                    type="text"
                    value={skillDescription}
                    onChange={(e) => setSkillDescription(e.target.value)}
                    placeholder="Contoh: Menangani otomasi build, containerization, dan deploy..."
                    className="w-full px-3.5 py-2 rounded-xl bg-[#1e1e1e] border border-[#383838] text-xs text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#4f4f4f] transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#ececec]">
                      Instruksi Keahlian (SKILL.md)
                    </label>
                    <span className="text-[11px] text-[#707070] font-mono">Format Markdown</span>
                  </div>
                  <textarea
                    value={skillContent}
                    onChange={(e) => setSkillContent(e.target.value)}
                    placeholder="# Docker Deployment Automation\nAturan dan langkah operasional bagi agen saat mengelola kontainer..."
                    rows={8}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1e1e1e] border border-[#383838] text-xs font-mono text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#4f4f4f] transition-colors resize-none leading-relaxed"
                    required
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-[#262626] hover:bg-[#303030] text-xs text-[#b4b4b4] hover:text-[#ececec] border border-[#383838] transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-[#ececec] hover:bg-white text-xs font-medium text-[#171717] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Menyimpan...' : 'Simpan & Pasang Skill'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#707070]">
                  Pilih skill terverifikasi di bawah ini untuk dipasang langsung ke lingkungan kerja Anda dengan 1-klik:
                </p>
                <div className="space-y-2.5">
                  {SKILL_CATALOG.map((item) => {
                    const isAlreadyInstalled = installedSkills.some(
                      (s) => s.name.toLowerCase() === item.name.toLowerCase()
                    );

                    return (
                      <div
                        key={item.name}
                        className="p-3.5 rounded-2xl bg-[#282828] border border-[#383838] flex items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-[#ececec] truncate">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-[#707070] mt-0.5 line-clamp-2">
                            {item.description}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCatalogInstall(item)}
                          disabled={isAlreadyInstalled}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0 flex items-center gap-1.5 ${
                            isAlreadyInstalled
                              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-default'
                              : 'bg-[#1e1e1e] hover:bg-white hover:text-black border border-[#383838] text-[#ececec]'
                          }`}
                        >
                          {isAlreadyInstalled ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Terpasang</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>Pasang</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
