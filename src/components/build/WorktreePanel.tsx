import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  GitBranch,
  Terminal,
  Plus,
  RefreshCw,
  Trash2,
  GitMerge,
  FileDiff,
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  Radio,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { WorktreeSession } from '../../types';

export const WorktreePanel: React.FC = () => {
  const {
    worktrees,
    hookCoords,
    refreshWorktrees,
    createWorktreeForTask,
    removeWorktree,
    mergeWorktree,
    openTerminalForWorktree,
    installedCliAgents,
    setActiveStudioTab,
    addToast,
  } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [taskIdInput, setTaskIdInput] = useState('');
  const [taskTitleInput, setTaskTitleInput] = useState('');
  const [branchInput, setBranchInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('claude');
  const [mergeTargetBranch, setMergeTargetBranch] = useState<string | null>(null);
  const [deleteTargetWorktree, setDeleteTargetWorktree] = useState<WorktreeSession | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    refreshWorktrees().finally(() => setIsLoading(false));
  }, [refreshWorktrees]);

  const handleTaskIdChange = (val: string) => {
    setTaskIdInput(val);
    const slug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '-');
    if (slug) {
      setBranchInput(`feature/${slug}`);
    } else {
      setBranchInput('');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskIdInput.trim() || !branchInput.trim()) {
      addToast('error', 'Task ID dan Nama Cabang wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const wt = await createWorktreeForTask(
        taskIdInput.trim(),
        taskTitleInput.trim() || taskIdInput.trim(),
        branchInput.trim(),
        selectedAgent
      );
      if (wt) {
        setIsCreateModalOpen(false);
        setTaskIdInput('');
        setTaskTitleInput('');
        setBranchInput('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmMerge = async () => {
    if (!mergeTargetBranch) return;
    setIsSubmitting(true);
    try {
      await mergeWorktree(mergeTargetBranch);
      setMergeTargetBranch(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetWorktree) return;
    setIsSubmitting(true);
    try {
      await removeWorktree(deleteTargetWorktree.path);
      setDeleteTargetWorktree(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isolatedWorktrees = worktrees.filter((w) => w.id !== 'main-root');
  const rootWorktree = worktrees.find((w) => w.id === 'main-root');

  return (
    <div className="flex-1 flex flex-col h-full bg-[#212121] text-[#ececec] overflow-hidden select-none">
      {/* Top Action Bar */}
      <div className="h-14 border-b border-[#303030] bg-[#1e1e1e] px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] border border-[#383838] flex items-center justify-center text-[#ececec]">
            <FolderGit2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#ececec]">Git Worktrees (Isolasi Agen)</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#282828] text-[#a0a0a0] border border-[#383838]">
                {isolatedWorktrees.length} Cabang Aktif
              </span>
            </div>
            <p className="text-[11px] text-[#707070]">
              Setiap agen bekerja di cabang terpisah dalam .agentic/worktrees/ tanpa konflik lock git.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hookCoords ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#242424] border border-[#383838] text-[11px] text-[#a0a0a0]">
              <span className="w-2 h-2 rounded-full bg-[#10a37f] animate-pulse" />
              <span>Hook Loopback: 127.0.0.1:{hookCoords.port}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#242424] border border-[#383838] text-[11px] text-[#707070]">
              <Radio className="w-3 h-3 text-[#707070]" />
              <span>Hook Server Menunggu</span>
            </div>
          )}

          <button
            onClick={() => {
              setIsLoading(true);
              refreshWorktrees().finally(() => setIsLoading(false));
            }}
            disabled={isLoading}
            className="h-8 px-3 rounded-lg bg-[#2a2a2a] hover:bg-[#333333] border border-[#383838] text-[#ececec] text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Muat ulang daftar worktree"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="h-8 px-3.5 rounded-lg bg-[#ececec] hover:bg-white text-[#171717] text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Worktree Baru</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Workspace Root Card */}
        {rootWorktree && (
          <div className="rounded-xl border border-[#303030] bg-[#262626] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#1e1e1e] border border-[#383838] flex items-center justify-center text-[#10a37f]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#ececec]">Cabang Utama (Workspace Root)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#1f2d24] text-[#10a37f] border border-[#10a37f]/30">
                    HEAD: {rootWorktree.branch_name}
                  </span>
                </div>
                <p className="text-[11px] text-[#707070] font-mono mt-0.5">{rootWorktree.path}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveStudioTab('git')}
                className="h-8 px-3 rounded-lg bg-[#2f2f2f] hover:bg-[#383838] border border-[#383838] text-xs text-[#ececec] flex items-center gap-1.5 transition-colors"
              >
                <GitBranch className="w-3.5 h-3.5 text-[#10a37f]" />
                <span>Git Control</span>
              </button>
            </div>
          </div>
        )}

        {/* Worktree Cards Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#a0a0a0] uppercase tracking-wider">
              Worktrees Agen Paralel
            </h3>
            <span className="text-[11px] text-[#707070]">
              Total: {isolatedWorktrees.length} terdaftar
            </span>
          </div>

          {isLoading ? (
            /* Loading Skeleton */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[#303030] bg-[#2a2a2a] p-5 space-y-3 animate-pulse"
                >
                  <div className="h-4 bg-[#383838] rounded w-2/3" />
                  <div className="h-3 bg-[#383838] rounded w-1/2" />
                  <div className="h-8 bg-[#383838] rounded mt-4" />
                </div>
              ))}
            </div>
          ) : isolatedWorktrees.length === 0 ? (
            /* Empty State */
            <div className="rounded-xl border border-dashed border-[#383838] bg-[#262626]/50 p-10 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-xl bg-[#2f2f2f] border border-[#383838] flex items-center justify-center text-[#707070] mb-3">
                <FolderGit2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-[#ececec] mb-1">Belum Ada Worktree Agen</h4>
              <p className="text-xs text-[#707070] max-w-sm mb-4">
                Buat worktree baru untuk mendelegasikan tugas khusus ke agen CLI seperti Claude Code atau Google Antigravity tanpa mengganggu kode di cabang utama.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="h-8 px-4 rounded-lg bg-[#ececec] hover:bg-white text-[#171717] text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Worktree Pertama</span>
              </button>
            </div>
          ) : (
            /* Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isolatedWorktrees.map((wt) => (
                <div
                  key={wt.id}
                  className="rounded-xl border border-[#303030] bg-[#2a2a2a] hover:border-[#404040] p-4 flex flex-col justify-between transition-colors shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#10a37f]" />
                        <h4 className="text-sm font-semibold text-[#ececec] line-clamp-1">
                          {wt.task_title || wt.task_id}
                        </h4>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1f2d24] text-[#10a37f] border border-[#10a37f]/30 font-medium">
                        Aktif
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1e1e1e] border border-[#383838] text-[11px] text-[#a0a0a0] font-mono">
                        <GitBranch className="w-3 h-3 text-[#10a37f]" />
                        <span>{wt.branch_name}</span>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1e1e1e] border border-[#383838] text-[11px] text-[#a0a0a0]">
                        <Terminal className="w-3 h-3 text-[#a0a0a0]" />
                        <span>Agen: {wt.assigned_agent}</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-[#707070] font-mono line-clamp-1 mb-4 bg-[#1f1f1f] px-2 py-1 rounded border border-[#2b2b2b]">
                      {wt.path}
                    </p>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#333333]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openTerminalForWorktree(wt)}
                        className="h-8 px-3 rounded-lg bg-[#333333] hover:bg-[#3d3d3d] border border-[#404040] text-xs font-medium text-[#ececec] flex items-center gap-1.5 transition-colors"
                        title="Buka terminal langsung di folder worktree ini"
                      >
                        <Terminal className="w-3.5 h-3.5 text-[#10a37f]" />
                        <span>Terminal</span>
                      </button>

                      <button
                        onClick={() => setActiveStudioTab('diff')}
                        className="h-8 px-3 rounded-lg bg-[#2a2a2a] hover:bg-[#333333] border border-[#383838] text-xs font-medium text-[#a0a0a0] hover:text-[#ececec] flex items-center gap-1.5 transition-colors"
                        title="Tinjau perubahan file pada worktree ini"
                      >
                        <FileDiff className="w-3.5 h-3.5" />
                        <span>Review Diff</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setMergeTargetBranch(wt.branch_name)}
                        className="h-8 px-2.5 rounded-lg bg-[#2a2a2a] hover:bg-[#333333] border border-[#383838] text-xs font-medium text-[#10a37f] flex items-center gap-1 transition-colors"
                        title="Gabungkan (merge) cabang ini ke repositori utama"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        <span>Merge</span>
                      </button>

                      <button
                        onClick={() => setDeleteTargetWorktree(wt)}
                        className="h-8 w-8 rounded-lg bg-[#2a2a2a] hover:bg-[#3d2424] border border-[#383838] text-[#a0a0a0] hover:text-[#ef4444] flex items-center justify-center transition-colors"
                        title="Hapus worktree ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Buat Worktree Baru */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-[#262626] border border-[#383838] rounded-2xl shadow-xl overflow-hidden">
            <div className="h-12 border-b border-[#303030] px-5 flex items-center justify-between bg-[#222222]">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-[#10a37f]" />
                <h3 className="text-sm font-semibold text-[#ececec]">Buat Git Worktree Baru</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-[#333333] flex items-center justify-center text-[#a0a0a0] hover:text-[#ececec]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#b4b4b4] mb-1">
                  Task ID / Slug
                </label>
                <input
                  type="text"
                  placeholder="misal: auth-jwt atau payment-gateway"
                  value={taskIdInput}
                  onChange={(e) => handleTaskIdChange(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[#1e1e1e] border border-[#383838] text-xs text-[#ececec] focus:outline-none focus:border-[#4f4f4f]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#b4b4b4] mb-1">
                  Judul Task (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="misal: Implementasi autentikasi JWT"
                  value={taskTitleInput}
                  onChange={(e) => setTaskTitleInput(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[#1e1e1e] border border-[#383838] text-xs text-[#ececec] focus:outline-none focus:border-[#4f4f4f]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#b4b4b4] mb-1">
                  Nama Cabang Git
                </label>
                <input
                  type="text"
                  placeholder="feature/auth-jwt"
                  value={branchInput}
                  onChange={(e) => setBranchInput(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[#1e1e1e] border border-[#383838] text-xs text-[#ececec] font-mono focus:outline-none focus:border-[#4f4f4f]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#b4b4b4] mb-1">
                  Tugaskan ke Agen CLI
                </label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[#1e1e1e] border border-[#383838] text-xs text-[#ececec] focus:outline-none focus:border-[#4f4f4f]"
                >
                  {installedCliAgents.length > 0 ? (
                    installedCliAgents.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.name} ({ag.binary_name})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="claude">Claude Code (claude)</option>
                      <option value="antigravity">Google Antigravity (agy)</option>
                      <option value="gemini">Gemini CLI (gemini)</option>
                      <option value="opencode">OpenCode Interpreter (opencode)</option>
                      <option value="aider">Aider CLI (aider)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="h-8 px-3 rounded-lg bg-[#2f2f2f] hover:bg-[#383838] text-xs text-[#b4b4b4] hover:text-[#ececec] transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-8 px-4 rounded-lg bg-[#ececec] hover:bg-white text-[#171717] text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Buat Worktree</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Merge */}
      {mergeTargetBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm bg-[#262626] border border-[#383838] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-[#10a37f]">
              <GitMerge className="w-5 h-5" />
              <h3 className="text-sm font-semibold text-[#ececec]">Konfirmasi Merge Cabang</h3>
            </div>
            <p className="text-xs text-[#b4b4b4] leading-relaxed">
              Anda akan menggabungkan cabang <span className="font-mono text-[#ececec] font-bold">'{mergeTargetBranch}'</span> ke dalam repositori utama. Lanjutkan?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setMergeTargetBranch(null)}
                className="h-8 px-3 rounded-lg bg-[#2f2f2f] hover:bg-[#383838] text-xs text-[#b4b4b4] hover:text-[#ececec] transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmMerge}
                disabled={isSubmitting}
                className="h-8 px-4 rounded-lg bg-[#10a37f] hover:bg-[#0e8d6e] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Merge ke Main</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Hapus */}
      {deleteTargetWorktree && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm bg-[#262626] border border-[#383838] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-[#ef4444]">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-sm font-semibold text-[#ececec]">Hapus Git Worktree?</h3>
            </div>
            <p className="text-xs text-[#b4b4b4] leading-relaxed">
              Direktori worktree di <span className="font-mono text-[#ececec]">{deleteTargetWorktree.path}</span> akan dihapus dan dibersihkan dari git metadata. Pastikan semua perubahan sudah di-commit atau di-merge.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTargetWorktree(null)}
                className="h-8 px-3 rounded-lg bg-[#2f2f2f] hover:bg-[#383838] text-xs text-[#b4b4b4] hover:text-[#ececec] transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="h-8 px-4 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Hapus Worktree</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
