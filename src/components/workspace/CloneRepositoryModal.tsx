import React, { useState } from 'react';
import { X, GitFork, FolderOpen, Loader2 } from 'lucide-react';
import { gitClone } from '../../utils/gitService';
import { useStore } from '../../store/useStore';

interface CloneRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (targetPath: string) => void;
}

export const CloneRepositoryModal: React.FC<CloneRepositoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { addToast } = useStore();
  const [repoUrl, setRepoUrl] = useState('');
  const [parentDir, setParentDir] = useState('/home/yudz');
  const [folderName, setFolderName] = useState('');
  const [isCloning, setIsCloning] = useState(false);

  if (!isOpen) return null;

  const handleUrlChange = (val: string) => {
    setRepoUrl(val);
    const cleaned = val.trim().replace(/\/+$/, '');
    const segments = cleaned.split('/');
    const lastSeg = segments[segments.length - 1] || '';
    const suggestedName = lastSeg.replace(/\.git$/i, '');
    if (suggestedName && !folderName) {
      setFolderName(suggestedName);
    }
  };

  const handleBrowseParent = async () => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const chosen = await invoke<string | null>('pick_local_directory');
        if (chosen) {
          setParentDir(chosen);
        }
      }
    } catch (err: any) {
      addToast('error', `Gagal memilih folder: ${err}`);
    }
  };

  const handleCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) {
      addToast('error', 'URL repositori tidak boleh kosong.');
      return;
    }
    const finalFolderName = folderName.trim() || 'cloned-repo';
    const targetDir = `${parentDir.replace(/\/+$/, '')}/${finalFolderName}`;

    setIsCloning(true);
    try {
      await gitClone(repoUrl.trim(), targetDir);
      addToast('success', `Repositori berhasil di-clone ke: ${targetDir}`);
      onSuccess(targetDir);
    } catch (err: any) {
      addToast('error', `Gagal mengkloning repositori: ${err.message || err}`);
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-[#212121] border border-[#383838] rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-xs select-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2e2e2e]">
          <div className="flex items-center gap-2">
            <GitFork className="w-4 h-4 text-[#ececec]" />
            <h3 className="text-sm font-semibold text-[#ececec]">Clone Repository</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isCloning}
            className="p-1 rounded-lg text-[#707070] hover:text-[#ececec] hover:bg-[#2c2c2c] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCloneSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-medium text-[#b4b4b4] mb-1.5">
              URL Repositori Git
            </label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://github.com/pembuat/proyek.git"
              required
              disabled={isCloning}
              className="w-full bg-[#171717] border border-[#383838] rounded-xl px-3 py-2 text-[#ececec] placeholder-[#707070] outline-none focus:border-[#4f4f4f] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#b4b4b4] mb-1.5">
              Folder Induk Tujuan
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={parentDir}
                onChange={(e) => setParentDir(e.target.value)}
                required
                disabled={isCloning}
                className="flex-1 bg-[#171717] border border-[#383838] rounded-xl px-3 py-2 text-[#ececec] outline-none focus:border-[#4f4f4f] transition-colors truncate"
              />
              <button
                type="button"
                onClick={handleBrowseParent}
                disabled={isCloning}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#2a2a2a] hover:bg-[#333333] border border-[#383838] text-[#ececec] rounded-xl font-medium transition-colors shrink-0"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Pilih</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#b4b4b4] mb-1.5">
              Nama Folder Proyek
            </label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="nama-proyek"
              required
              disabled={isCloning}
              className="w-full bg-[#171717] border border-[#383838] rounded-xl px-3 py-2 text-[#ececec] placeholder-[#707070] outline-none focus:border-[#4f4f4f] transition-colors"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#2e2e2e]">
            <button
              type="button"
              onClick={onClose}
              disabled={isCloning}
              className="px-4 py-2 rounded-xl bg-[#2a2a2a] hover:bg-[#333333] text-[#b4b4b4] hover:text-[#ececec] transition-colors font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isCloning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ececec] hover:bg-white text-[#171717] font-medium transition-colors disabled:opacity-50"
            >
              {isCloning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengkloning...</span>
                </>
              ) : (
                <span>Clone & Buka Proyek</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
