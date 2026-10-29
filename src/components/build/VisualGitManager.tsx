import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  RefreshCw,
  Plus,
  Minus,
  RotateCcw,
  UploadCloud,
  DownloadCloud,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Check,
  FolderGit2,
  Trash2,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { GitStatusResponse, GitFileItem } from '../../types';
import {
  getGitStatus,
  getGitDiff,
  stageGitFile,
  stageAllGit,
  unstageGitFile,
  unstageAllGit,
  discardGitFile,
  commitGit,
  pushGit,
  pullGit,
  fetchGit,
  listGitBranches,
  checkoutGitBranch,
  createGitBranch,
  generateAiCommitMessage,
} from '../../utils/gitService';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { EmptyState } from '../common/EmptyState';

export const VisualGitManager: React.FC = () => {
  const { addToast, selectedModel, availableModels, apiKeys } = useStore();

  const [gitStatus, setGitStatus] = useState<GitStatusResponse | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<GitFileItem | null>(null);
  const [fileDiff, setFileDiff] = useState<string>('');
  const [commitMessage, setCommitMessage] = useState<string>('');

  // Loading states
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
  const [isLoadingDiff, setIsLoadingDiff] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Accordion open states
  const [stagedOpen, setStagedOpen] = useState<boolean>(true);
  const [unstagedOpen, setUnstagedOpen] = useState<boolean>(true);
  const [untrackedOpen, setUntrackedOpen] = useState<boolean>(true);

  // Branch switcher dropdown
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState<boolean>(false);
  const [newBranchInput, setNewBranchInput] = useState<string>('');
  const [isCreatingBranch, setIsCreatingBranch] = useState<boolean>(false);

  // Refresh status and branch list
  const refreshStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const [statusRes, branchList] = await Promise.all([
        getGitStatus(),
        listGitBranches().catch(() => []),
      ]);
      setGitStatus(statusRes);
      setBranches(branchList);

      // If selected file is no longer changed, reset selection
      if (selectedFile) {
        const stillExists =
          statusRes.staged_files.some((f) => f.path === selectedFile.path) ||
          statusRes.unstaged_files.some((f) => f.path === selectedFile.path) ||
          statusRes.untracked_files.some((f) => f.path === selectedFile.path);
        if (!stillExists) {
          setSelectedFile(null);
          setFileDiff('');
        }
      }
    } catch (err: any) {
      addToast('error', `Gagal memuat status Git: ${err?.message || err}`, 5000);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [addToast, selectedFile]);

  // Initial load
  useEffect(() => {
    refreshStatus();
  }, []);

  // Fetch diff when selected file changes
  const loadDiff = useCallback(
    async (file: GitFileItem) => {
      setSelectedFile(file);
      setIsLoadingDiff(true);
      try {
        const diff = await getGitDiff(file.path, file.is_staged);
        setFileDiff(diff);
      } catch (err: any) {
        addToast('error', `Gagal membaca diff: ${err?.message || err}`, 4000);
        setFileDiff('');
      } finally {
        setIsLoadingDiff(false);
      }
    },
    [addToast]
  );

  // Auto-select first changed file if none selected
  useEffect(() => {
    if (!selectedFile && gitStatus) {
      const first =
        gitStatus.staged_files[0] ||
        gitStatus.unstaged_files[0] ||
        gitStatus.untracked_files[0];
      if (first) {
        loadDiff(first);
      }
    }
  }, [gitStatus, selectedFile, loadDiff]);

  // Stage single file
  const handleStageFile = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    try {
      await stageGitFile(path);
      addToast('success', `File di-stage: ${path}`, 2000);
      await refreshStatus();
      if (selectedFile?.path === path) {
        loadDiff({ ...selectedFile, is_staged: true });
      }
    } catch (err: any) {
      addToast('error', `Gagal men-stage file: ${err?.message || err}`, 4000);
    }
  };

  // Stage all
  const handleStageAll = async () => {
    try {
      await stageAllGit();
      addToast('success', 'Semua perubahan berhasil di-stage', 2500);
      await refreshStatus();
    } catch (err: any) {
      addToast('error', `Gagal men-stage semua file: ${err?.message || err}`, 4000);
    }
  };

  // Unstage single file
  const handleUnstageFile = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    try {
      await unstageGitFile(path);
      addToast('success', `File di-unstage: ${path}`, 2000);
      await refreshStatus();
      if (selectedFile?.path === path) {
        loadDiff({ ...selectedFile, is_staged: false });
      }
    } catch (err: any) {
      addToast('error', `Gagal men-unstage file: ${err?.message || err}`, 4000);
    }
  };

  // Unstage all
  const handleUnstageAll = async () => {
    try {
      await unstageAllGit();
      addToast('success', 'Semua file di-unstage', 2500);
      await refreshStatus();
    } catch (err: any) {
      addToast('error', `Gagal men-unstage file: ${err?.message || err}`, 4000);
    }
  };

  // Discard single file changes
  const handleDiscardFile = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin membuang semua perubahan pada '${path}'? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmed) return;

    try {
      await discardGitFile(path);
      addToast('success', `Perubahan dibatalkan: ${path}`, 2500);
      await refreshStatus();
    } catch (err: any) {
      addToast('error', `Gagal membuang perubahan: ${err?.message || err}`, 4000);
    }
  };

  // Commit
  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      addToast('error', 'Masukkan pesan commit terlebih dahulu', 3000);
      return;
    }

    setIsCommitting(true);
    try {
      await commitGit(commitMessage.trim());
      addToast('success', 'Commit berhasil dibuat', 3000);
      setCommitMessage('');
      await refreshStatus();
    } catch (err: any) {
      addToast('error', `Gagal membuat commit: ${err?.message || err}`, 5000);
    } finally {
      setIsCommitting(false);
    }
  };

  // AI Commit Message Generator
  const handleGenerateAiCommit = async () => {
    setIsGeneratingAi(true);
    try {
      // First try to get staged diff
      let diffForAi = await getGitDiff(undefined, true);
      // If staged diff is empty, fallback to unstaged diff
      if (!diffForAi.trim()) {
        diffForAi = await getGitDiff(undefined, false);
      }

      if (!diffForAi.trim()) {
        addToast('error', 'Tidak ada perubahan berkas untuk dianalisis oleh AI', 3000);
        return;
      }

      const generated = await generateAiCommitMessage(
        diffForAi,
        selectedModel,
        availableModels,
        apiKeys
      );

      if (generated) {
        setCommitMessage(generated);
        addToast('success', 'Pesan commit berhasil dibuat oleh AI', 3000);
      }
    } catch (err: any) {
      addToast('error', `AI generator error: ${err?.message || err}`, 5000);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Remote Sync Actions: Push, Pull, Fetch
  const handlePush = async () => {
    setIsSyncing(true);
    try {
      await pushGit();
      addToast('success', 'Push ke remote repository berhasil', 3000);
      await refreshStatus();
    } catch (err: any) {
      addToast('error', `Gagal melakukan push: ${err?.message || err}`, 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePull = async () => {
    setIsSyncing(true);
    try {
      await pullGit();
      addToast('success', 'Pull dari remote repository berhasil', 3000);
      await refreshStatus();
    } catch (err: any) {
      addToast('error', `Gagal melakukan pull: ${err?.message || err}`, 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFetch = async () => {
    setIsSyncing(true);
    try {
      await fetchGit();
      addToast('success', 'Fetch remote berhasil', 2500);
      await refreshStatus();
    } catch (err: any) {
      addToast('error', `Gagal melakukan fetch: ${err?.message || err}`, 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Branch Switch / Create
  const handleCheckoutBranch = async (branch: string) => {
    setIsBranchMenuOpen(false);
    try {
      await checkoutGitBranch(branch);
      addToast('success', `Berpindah ke branch '${branch}'`, 2500);
      await refreshStatus();
    } catch (err: any) {
      addToast('error', `Gagal berpindah branch: ${err?.message || err}`, 4000);
    }
  };

  const handleCreateBranch = async () => {
    const cleanName = newBranchInput.trim();
    if (!cleanName) return;

    try {
      await createGitBranch(cleanName);
      addToast('success', `Branch baru '${cleanName}' berhasil dibuat dan diaktifkan`, 3000);
      setNewBranchInput('');
      setIsCreatingBranch(false);
      setIsBranchMenuOpen(false);
      await refreshStatus();
    } catch (err: any) {
      addToast('error', `Gagal membuat branch: ${err?.message || err}`, 4000);
    }
  };

  // Badge renderer for file statuses
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'modified':
        return (
          <span className="w-4 h-4 rounded text-[10px] font-bold font-mono bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            M
          </span>
        );
      case 'added':
        return (
          <span className="w-4 h-4 rounded text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            A
          </span>
        );
      case 'deleted':
        return (
          <span className="w-4 h-4 rounded text-[10px] font-bold font-mono bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
            D
          </span>
        );
      case 'renamed':
        return (
          <span className="w-4 h-4 rounded text-[10px] font-bold font-mono bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
            R
          </span>
        );
      default:
        return (
          <span className="w-4 h-4 rounded text-[10px] font-bold font-mono bg-[#404040] text-[#b4b4b4] flex items-center justify-center shrink-0">
            U
          </span>
        );
    }
  };

  // Parsed diff lines renderer
  const formattedDiffLines = useMemo(() => {
    if (!fileDiff) return [];
    return fileDiff.split('\n');
  }, [fileDiff]);

  // If not a git repository
  if (!isLoadingStatus && gitStatus && !gitStatus.is_git_repo) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#212121]">
        <EmptyState
          icon={FolderGit2}
          title="Bukan Repositori Git"
          description="Direktori workspace aktif saat ini belum diinisialisasi sebagai repositori Git."
          actionLabel="Muat Ulang Status"
          onAction={refreshStatus}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full bg-[#212121] text-[#ececec] overflow-hidden select-none">
      {/* ======================================================== */}
      {/* Left Column: Repository Status, Sync, Commit, File Lists */}
      {/* ======================================================== */}
      <div className="w-80 border-r border-[#262626] bg-[#171717] flex flex-col h-full shrink-0">
        {/* Header: Branch Selector & Sync */}
        <div className="p-3 border-b border-[#262626] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#707070]">
              Source Control
            </span>
            <button
              onClick={refreshStatus}
              disabled={isLoadingStatus}
              title="Refresh Git Status"
              className="p-1 rounded-md text-[#707070] hover:text-[#ececec] hover:bg-[#262626] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Branch Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#212121] hover:bg-[#282828] border border-[#303030] text-xs font-medium text-[#ececec] transition-colors"
            >
              <div className="flex items-center gap-2 truncate">
                <GitBranch className="w-3.5 h-3.5 text-[#b4b4b4] shrink-0" />
                <span className="truncate">{gitStatus?.current_branch || 'main'}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#707070] shrink-0" />
            </button>

            {isBranchMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-full rounded-2xl bg-[#262626] border border-[#383838] p-1.5 z-50 shadow-2xl space-y-1">
                <div className="px-2 py-1 text-[11px] font-semibold text-[#707070] uppercase">
                  Daftar Cabang
                </div>
                <div className="max-h-40 overflow-y-auto space-y-0.5 custom-scrollbar">
                  {branches.map((b) => (
                    <button
                      key={b}
                      onClick={() => handleCheckoutBranch(b)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        b === gitStatus?.current_branch
                          ? 'bg-[#2f2f2f] text-white border border-[#404040]'
                          : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-[#ececec]'
                      }`}
                    >
                      <span className="truncate">{b}</span>
                      {b === gitStatus?.current_branch && (
                        <Check className="w-3.5 h-3.5 text-white shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="pt-1 border-t border-[#383838]">
                  {isCreatingBranch ? (
                    <div className="p-1 space-y-1.5">
                      <input
                        type="text"
                        placeholder="Nama branch baru..."
                        value={newBranchInput}
                        onChange={(e) => setNewBranchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateBranch()}
                        autoFocus
                        className="w-full px-2 py-1 rounded-lg bg-[#171717] border border-[#404040] text-xs text-[#ececec] focus:outline-none focus:border-[#707070]"
                      />
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setIsCreatingBranch(false)}
                          className="px-2 py-1 rounded text-[11px] text-[#707070] hover:text-[#ececec]"
                        >
                          Batal
                        </button>
                        <button
                          onClick={handleCreateBranch}
                          disabled={!newBranchInput.trim()}
                          className="px-2.5 py-1 rounded bg-[#ececec] text-black text-[11px] font-medium disabled:opacity-50"
                        >
                          Buat
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsCreatingBranch(true)}
                      className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-[#b4b4b4] hover:bg-[#212121] hover:text-white transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Buat Branch Baru</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sync Status & Remote Buttons */}
          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            <div className="flex items-center gap-2 text-xs text-[#707070] font-mono">
              <span title="Commits ahead of remote" className="flex items-center gap-0.5">
                ↑{gitStatus?.ahead || 0}
              </span>
              <span title="Commits behind remote" className="flex items-center gap-0.5">
                ↓{gitStatus?.behind || 0}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleFetch}
                disabled={isSyncing}
                title="Fetch dari remote"
                className="px-2 py-1 rounded-lg bg-[#212121] hover:bg-[#282828] border border-[#303030] text-[11px] font-medium text-[#b4b4b4] hover:text-[#ececec] transition-colors"
              >
                Fetch
              </button>
              <button
                onClick={handlePull}
                disabled={isSyncing}
                title="Pull perubahan dari remote"
                className="p-1.5 rounded-lg bg-[#212121] hover:bg-[#282828] border border-[#303030] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handlePush}
                disabled={isSyncing}
                title="Push commit ke remote"
                className="p-1.5 rounded-lg bg-[#212121] hover:bg-[#282828] border border-[#303030] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
              >
                <UploadCloud className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Commit Input Box */}
        <div className="p-3 border-b border-[#262626] space-y-2">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleCommit();
              }
            }}
            placeholder="Pesan commit (Ctrl+Enter untuk commit)..."
            rows={3}
            className="w-full p-2.5 rounded-xl bg-[#212121] border border-[#303030] text-xs text-[#ececec] placeholder-[#707070] resize-none focus:outline-none focus:border-[#4f4f4f] transition-colors font-mono"
          />

          <div className="flex items-center justify-between gap-1.5">
            <button
              onClick={handleGenerateAiCommit}
              disabled={isGeneratingAi}
              title="Buat pesan commit otomatis menggunakan AI"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#262626] hover:bg-[#2f2f2f] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isGeneratingAi ? 'animate-spin' : ''}`} />
              <span>{isGeneratingAi ? 'Menganalisis...' : 'Generate AI'}</span>
            </button>

            <button
              onClick={handleCommit}
              disabled={isCommitting || !commitMessage.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-black text-xs font-semibold transition-colors disabled:opacity-40 disabled:hover:bg-[#ececec]"
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span>{isCommitting ? 'Commit...' : 'Commit'}</span>
            </button>
          </div>
        </div>

        {/* File Tree Lists (Accordion) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
          {isLoadingStatus ? (
            <div className="p-3 space-y-2">
              <LoadingSkeleton count={4} />
            </div>
          ) : (
            <>
              {/* 1. Staged Changes */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-[#707070] uppercase">
                  <button
                    onClick={() => setStagedOpen(!stagedOpen)}
                    className="flex items-center gap-1 hover:text-[#ececec]"
                  >
                    {stagedOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span>Staged Changes</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#262626] text-[10px] text-[#b4b4b4]">
                      {gitStatus?.staged_files.length || 0}
                    </span>
                  </button>

                  {gitStatus && gitStatus.staged_files.length > 0 && (
                    <button
                      onClick={handleUnstageAll}
                      title="Unstage semua file"
                      className="p-1 rounded text-[#707070] hover:text-[#ececec] hover:bg-[#262626]"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {stagedOpen && gitStatus && gitStatus.staged_files.length > 0 && (
                  <div className="space-y-0.5">
                    {gitStatus.staged_files.map((file) => {
                      const isSelected = selectedFile?.path === file.path && selectedFile.is_staged;
                      return (
                        <div
                          key={`staged-${file.path}`}
                          onClick={() => loadDiff(file)}
                          className={`group flex items-center justify-between px-2 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#2f2f2f] text-white'
                              : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-[#ececec]'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {renderStatusBadge(file.status)}
                            <span className="truncate">{file.path}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleUnstageFile(e, file.path)}
                              title="Unstage perubahan file ini"
                              className="p-1 rounded text-[#707070] hover:text-[#ececec] hover:bg-[#383838]"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Changes (Unstaged) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-[#707070] uppercase">
                  <button
                    onClick={() => setUnstagedOpen(!unstagedOpen)}
                    className="flex items-center gap-1 hover:text-[#ececec]"
                  >
                    {unstagedOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span>Changes</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#262626] text-[10px] text-[#b4b4b4]">
                      {gitStatus?.unstaged_files.length || 0}
                    </span>
                  </button>

                  {gitStatus && gitStatus.unstaged_files.length > 0 && (
                    <button
                      onClick={handleStageAll}
                      title="Stage semua perubahan"
                      className="p-1 rounded text-[#707070] hover:text-[#ececec] hover:bg-[#262626]"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {unstagedOpen && gitStatus && gitStatus.unstaged_files.length > 0 && (
                  <div className="space-y-0.5">
                    {gitStatus.unstaged_files.map((file) => {
                      const isSelected = selectedFile?.path === file.path && !selectedFile.is_staged;
                      return (
                        <div
                          key={`unstaged-${file.path}`}
                          onClick={() => loadDiff(file)}
                          className={`group flex items-center justify-between px-2 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#2f2f2f] text-white'
                              : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-[#ececec]'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {renderStatusBadge(file.status)}
                            <span className="truncate">{file.path}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleDiscardFile(e, file.path)}
                              title="Discard perubahan"
                              className="p-1 rounded text-[#707070] hover:text-rose-400 hover:bg-[#383838]"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleStageFile(e, file.path)}
                              title="Stage perubahan file ini"
                              className="p-1 rounded text-[#707070] hover:text-[#ececec] hover:bg-[#383838]"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Untracked Files */}
              {gitStatus && gitStatus.untracked_files.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-[#707070] uppercase">
                    <button
                      onClick={() => setUntrackedOpen(!untrackedOpen)}
                      className="flex items-center gap-1 hover:text-[#ececec]"
                    >
                      {untrackedOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span>Untracked</span>
                      <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#262626] text-[10px] text-[#b4b4b4]">
                        {gitStatus.untracked_files.length}
                      </span>
                    </button>
                    <button
                      onClick={handleStageAll}
                      title="Stage semua berkas untracked"
                      className="p-1 rounded text-[#707070] hover:text-[#ececec] hover:bg-[#262626]"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {untrackedOpen && (
                    <div className="space-y-0.5">
                      {gitStatus.untracked_files.map((file) => {
                        const isSelected = selectedFile?.path === file.path;
                        return (
                          <div
                            key={`untracked-${file.path}`}
                            onClick={() => loadDiff(file)}
                            className={`group flex items-center justify-between px-2 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[#2f2f2f] text-white'
                                : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-[#ececec]'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {renderStatusBadge(file.status)}
                              <span className="truncate">{file.path}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => handleDiscardFile(e, file.path)}
                                title="Hapus berkas untracked ini"
                                className="p-1 rounded text-[#707070] hover:text-rose-400 hover:bg-[#383838]"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => handleStageFile(e, file.path)}
                                title="Stage berkas ini"
                                className="p-1 rounded text-[#707070] hover:text-[#ececec] hover:bg-[#383838]"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Working tree clean state */}
              {gitStatus &&
                gitStatus.staged_files.length === 0 &&
                gitStatus.unstaged_files.length === 0 &&
                gitStatus.untracked_files.length === 0 && (
                  <div className="p-6 text-center text-xs text-[#707070]">
                    <Check className="w-6 h-6 mx-auto mb-2 text-[#ececec]/80" />
                    <p className="font-medium text-[#b4b4b4]">Working Tree Clean</p>
                    <p className="mt-1">Tidak ada perubahan file yang belum di-commit.</p>
                  </div>
                )}
            </>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* Right Column: Visual Diff Viewer                          */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col h-full bg-[#212121] overflow-hidden">
        {selectedFile ? (
          <>
            {/* Header: File path, Status Badge, Quick Actions */}
            <div className="h-11 px-4 border-b border-[#262626] bg-[#1a1a1a] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 truncate">
                {renderStatusBadge(selectedFile.status)}
                <span className="text-xs font-mono font-medium text-[#ececec] truncate">
                  {selectedFile.path}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#262626] text-[#707070]">
                  {selectedFile.is_staged ? 'Staged' : 'Unstaged'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {selectedFile.is_staged ? (
                  <button
                    onClick={(e) => handleUnstageFile(e, selectedFile.path)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#262626] hover:bg-[#303030] text-xs font-medium text-[#ececec] transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                    <span>Unstage</span>
                  </button>
                ) : (
                  <button
                    onClick={(e) => handleStageFile(e, selectedFile.path)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#262626] hover:bg-[#303030] text-xs font-medium text-[#ececec] transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Stage</span>
                  </button>
                )}
              </div>
            </div>

            {/* Diff content view */}
            <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-[#1c1c1c]">
              {isLoadingDiff ? (
                <div className="p-4 space-y-2">
                  <LoadingSkeleton count={8} />
                </div>
              ) : formattedDiffLines.length > 0 ? (
                <div className="font-mono text-xs leading-relaxed">
                  {formattedDiffLines.map((line, idx) => {
                    const isAddition = line.startsWith('+') && !line.startsWith('+++');
                    const isDeletion = line.startsWith('-') && !line.startsWith('---');
                    const isChunkHeader = line.startsWith('@@');

                    let bgClass = '';
                    let textClass = 'text-[#b4b4b4]';

                    if (isAddition) {
                      bgClass = 'bg-[#10b98115]';
                      textClass = 'text-[#34d399]';
                    } else if (isDeletion) {
                      bgClass = 'bg-[#ef444415]';
                      textClass = 'text-[#f87171]';
                    } else if (isChunkHeader) {
                      bgClass = 'bg-[#2a2a2a] my-1 rounded';
                      textClass = 'text-[#9ca3af] font-semibold';
                    }

                    return (
                      <div
                        key={idx}
                        className={`flex items-start px-2 py-0.5 rounded-sm ${bgClass}`}
                      >
                        <span className="w-10 text-right pr-3 select-none text-[#555] shrink-0 text-[11px]">
                          {idx + 1}
                        </span>
                        <span className={`whitespace-pre-wrap break-all ${textClass}`}>
                          {line}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-[#707070]">
                  Tidak ada perbedaan isi berkas yang dapat ditampilkan.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <EmptyState
              icon={GitPullRequest}
              title="Pilih Berkas untuk Melihat Perubahan"
              description="Pilih salah satu berkas di kolom kiri untuk melihat perbandingan baris demi baris secara visual."
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualGitManager;
