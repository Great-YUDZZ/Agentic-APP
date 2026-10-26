import React, { useEffect, useRef } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronRight,
  X,
  Replace,
  ReplaceAll,
} from 'lucide-react';

interface EditorFindReplaceProps {
  isOpen: boolean;
  isReplaceMode: boolean;
  onClose: () => void;
  onToggleReplaceMode: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  replaceTerm: string;
  setReplaceTerm: (term: string) => void;
  matchIndex: number;
  totalMatches: number;
  onNext: () => void;
  onPrev: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  caseSensitive: boolean;
  setCaseSensitive: (val: boolean) => void;
  wholeWord: boolean;
  setWholeWord: (val: boolean) => void;
}

export const EditorFindReplace: React.FC<EditorFindReplaceProps> = ({
  isOpen,
  isReplaceMode,
  onClose,
  onToggleReplaceMode,
  searchTerm,
  setSearchTerm,
  replaceTerm,
  setReplaceTerm,
  matchIndex,
  totalMatches,
  onNext,
  onPrev,
  onReplace,
  onReplaceAll,
  caseSensitive,
  setCaseSensitive,
  wholeWord,
  setWholeWord,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Fokuskan input saat widget terbuka
  useEffect(() => {
    if (isOpen) {
      if (isReplaceMode && replaceInputRef.current && document.activeElement === searchInputRef.current) {
        // Tetap di search jika sedang mengetik search
      } else {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
  }, [isOpen, isReplaceMode]);

  if (!isOpen) return null;

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onPrev();
      } else {
        onNext();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleReplaceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onReplace();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="absolute top-2 right-4 z-30 bg-[#252525] border border-[#383838] rounded-xl shadow-2xl p-2 font-sans select-none animate-in fade-in zoom-in-95 duration-100 min-w-[340px]">
      {/* Baris 1: Pencarian (Find) */}
      <div className="flex items-center gap-1.5">
        {/* Toggle Mode Replace */}
        <button
          type="button"
          onClick={onToggleReplaceMode}
          title={isReplaceMode ? 'Sembunyikan panel ganti' : 'Tampilkan panel ganti (Ctrl + H)'}
          className={`p-1 rounded text-[#888888] hover:text-[#ececec] hover:bg-[#333333] transition-transform ${
            isReplaceMode ? 'rotate-90 text-[#ececec]' : ''
          }`}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Input Pencarian */}
        <div className="relative flex-1">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Cari..."
            className="w-full bg-[#181818] border border-[#383838] focus:border-[#555555] text-xs text-[#ececec] rounded-lg px-2.5 py-1.5 outline-none font-mono placeholder-[#666666]"
          />
        </div>

        {/* Indikator Jumlah Kecocokan */}
        <div className="text-[11px] font-mono text-[#888888] px-1 whitespace-nowrap min-w-[48px] text-center">
          {totalMatches > 0
            ? `${matchIndex + 1}/${totalMatches}`
            : searchTerm
            ? '0/0'
            : ''}
        </div>

        {/* Tombol Opsi: Case Sensitive (Aa) */}
        <button
          type="button"
          onClick={() => setCaseSensitive(!caseSensitive)}
          title="Cocokkan Huruf Besar/Kecil (Case Sensitive)"
          className={`px-1.5 py-0.5 rounded text-xs font-semibold font-mono border transition-colors ${
            caseSensitive
              ? 'bg-[#383838] text-[#ececec] border-[#555555]'
              : 'text-[#777777] border-transparent hover:text-[#cccccc] hover:bg-[#2f2f2f]'
          }`}
        >
          Aa
        </button>

        {/* Tombol Opsi: Whole Word (\b) */}
        <button
          type="button"
          onClick={() => setWholeWord(!wholeWord)}
          title="Kata Utuh Saja (Whole Word)"
          className={`px-1.5 py-0.5 rounded text-xs font-semibold font-mono border transition-colors ${
            wholeWord
              ? 'bg-[#383838] text-[#ececec] border-[#555555]'
              : 'text-[#777777] border-transparent hover:text-[#cccccc] hover:bg-[#2f2f2f]'
          }`}
        >
          \b
        </button>

        {/* Tombol Sebelumnya & Berikutnya */}
        <div className="flex items-center gap-0.5 border-l border-[#333333] pl-1">
          <button
            type="button"
            onClick={onPrev}
            disabled={totalMatches === 0}
            title="Kecocokan Sebelumnya (Shift + Enter)"
            className="p-1 rounded text-[#888888] hover:text-[#ececec] hover:bg-[#333333] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={totalMatches === 0}
            title="Kecocokan Berikutnya (Enter)"
            className="p-1 rounded text-[#888888] hover:text-[#ececec] hover:bg-[#333333] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tombol Tutup (X) */}
        <button
          type="button"
          onClick={onClose}
          title="Tutup (Esc)"
          className="p-1 rounded text-[#888888] hover:text-[#ececec] hover:bg-[#333333] transition-colors ml-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Baris 2: Penggantian (Replace) jika mode Replace aktif */}
      {isReplaceMode && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#333333] pl-6">
          {/* Input Teks Pengganti */}
          <div className="relative flex-1">
            <input
              ref={replaceInputRef}
              type="text"
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              onKeyDown={handleReplaceKeyDown}
              placeholder="Ganti dengan..."
              className="w-full bg-[#181818] border border-[#383838] focus:border-[#555555] text-xs text-[#ececec] rounded-lg px-2.5 py-1.5 outline-none font-mono placeholder-[#666666]"
            />
          </div>

          {/* Tombol Ganti Satu Kecocokan */}
          <button
            type="button"
            onClick={onReplace}
            disabled={totalMatches === 0}
            title="Ganti kecocokan aktif"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2f2f2f] hover:bg-[#383838] text-[#ececec] border border-[#383838] text-xs font-medium transition-colors disabled:opacity-30 disabled:hover:bg-[#2f2f2f]"
          >
            <Replace className="w-3 h-3" />
            <span>Ganti</span>
          </button>

          {/* Tombol Ganti Semua Kecocokan */}
          <button
            type="button"
            onClick={onReplaceAll}
            disabled={totalMatches === 0}
            title="Ganti semua kecocokan dalam berkas"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2f2f2f] hover:bg-[#383838] text-[#ececec] border border-[#383838] text-xs font-medium transition-colors disabled:opacity-30 disabled:hover:bg-[#2f2f2f]"
          >
            <ReplaceAll className="w-3 h-3" />
            <span>Semua</span>
          </button>
        </div>
      )}
    </div>
  );
};
