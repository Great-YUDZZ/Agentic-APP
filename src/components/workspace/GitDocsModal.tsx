import React from 'react';
import { X, BookOpen, ShieldCheck, FolderGit2, GitBranch, Terminal } from 'lucide-react';

interface GitDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitDocsModal: React.FC<GitDocsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-[#212121] border border-[#383838] rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-xs select-none max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2e2e2e]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#ececec]" />
            <h3 className="text-sm font-semibold text-[#ececec]">
              Panduan Git & Manajemen Workspace
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#707070] hover:text-[#ececec] hover:bg-[#2c2c2c] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 text-[#b4b4b4] leading-relaxed">
          <div className="p-3.5 rounded-xl bg-[#171717] border border-[#2e2e2e] space-y-1.5">
            <div className="flex items-center gap-2 text-[#ececec] font-medium">
              <FolderGit2 className="w-4 h-4 text-sky-400" />
              <span>1. Membuka Folder Proyek (Open Folder)</span>
            </div>
            <p className="text-[11px] text-[#8e8e8e]">
              Gunakan tombol "Open Folder" untuk memilih direktori proyek yang ada di komputer Anda.
              Setelah folder dibuka, pohon berkas (Worktree) akan langsung aktif dan seluruh berkas proyek dapat dibaca, diedit, serta dicari langsung dari Studio.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#171717] border border-[#2e2e2e] space-y-1.5">
            <div className="flex items-center gap-2 text-[#ececec] font-medium">
              <GitBranch className="w-4 h-4 text-emerald-400" />
              <span>2. Kloning Repositori Git (Clone Repository)</span>
            </div>
            <p className="text-[11px] text-[#8e8e8e]">
              Tombol "Clone Repository" memungkinkan Anda menduplikasi repositori Git remote (GitHub, GitLab, Bitbucket) ke folder lokal dan langsung membukanya di Studio secara otomatis.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#171717] border border-[#2e2e2e] space-y-1.5">
            <div className="flex items-center gap-2 text-[#ececec] font-medium">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>3. Keamanan Sandbox & Confinement</span>
            </div>
            <p className="text-[11px] text-[#8e8e8e]">
              Aplikasi menerapkan isolasi ketat (*sandbox path confinement*). Saat tidak ada sesi aktif atau belum ada folder proyek yang dibuka, Worktree tidak akan memuat direktori internal aplikasi demi melindungi data dan mencegah akses tanpa otorisasi.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#171717] border border-[#2e2e2e] space-y-1.5">
            <div className="flex items-center gap-2 text-[#ececec] font-medium">
              <Terminal className="w-4 h-4 text-purple-400" />
              <span>4. Source Control & Visual Git</span>
            </div>
            <p className="text-[11px] text-[#8e8e8e]">
              Di Mode Build Studio, Anda dapat memanfaatkan tab Visual Git untuk melihat perubahan diff per baris, melakukan staging, membuat branch baru, serta menghasilkan pesan commit ringkas berbantuan AI.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-end border-t border-[#2e2e2e]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#ececec] hover:bg-white text-[#171717] font-medium transition-colors"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
};
