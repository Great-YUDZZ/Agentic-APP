import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCode,
  Check,
  X,
  Copy,
  FolderDown,
  Columns,
  AlignJustify,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { extractCodeReviewItems } from '../../utils/codeExtractor';
import { CodeReviewItem } from '../../types';

export const CodeReviewModal: React.FC = () => {
  const {
    isCodeReviewModalOpen,
    setCodeReviewModalOpen,
    buildDiscussion,
    codeReviewItems,
    setCodeReviewItems,
    updateCodeReviewItemStatus,
    applyCodeReviewItem,
    addToast,
  } = useStore();

  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto-extract code blocks whenever modal opens or discussion updates
  useEffect(() => {
    if (isCodeReviewModalOpen) {
      const extracted = extractCodeReviewItems(
        buildDiscussion.messages,
        codeReviewItems
      );
      setCodeReviewItems(extracted);
      if (selectedItemIndex >= extracted.length) {
        setSelectedItemIndex(0);
      }
    }
  }, [isCodeReviewModalOpen, buildDiscussion.messages]);

  if (!isCodeReviewModalOpen) return null;

  const currentItem: CodeReviewItem | undefined =
    codeReviewItems[selectedItemIndex];

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    addToast('info', 'Kode berhasil disalin ke clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const lines = currentItem ? currentItem.content.split('\n') : [];
  const lineCount = lines.length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          className="bg-[#171717] border border-[#303030] w-full max-w-5xl h-[88vh] rounded-2xl overflow-hidden flex flex-col font-sans"
        >
          {/* Header Bar */}
          <div className="px-5 py-3.5 bg-[#171717] border-b border-[#262626] flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#212121] text-[#ececec] border border-[#303030]">
                <FileCode className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-[#ececec] tracking-tight">
                    Review Code Hasil Agent
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#212121] text-[#b4b4b4] border border-[#303030]">
                    {codeReviewItems.length} File / Snippet
                  </span>
                </div>
                <p className="text-[11px] text-[#b4b4b4] mt-0.5">
                  Verifikasi dan terapkan perubahan kode yang dihasilkan tim agen
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-[#212121] p-0.5 rounded-lg border border-[#303030] text-xs">
                <button
                  onClick={() => setViewMode('split')}
                  title="Tampilan Split (Side-by-Side)"
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === 'split'
                      ? 'bg-[#2f2f2f] text-white'
                      : 'text-[#707070] hover:text-white'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('unified')}
                  title="Tampilan Unified (Single Column)"
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === 'unified'
                      ? 'bg-[#2f2f2f] text-white'
                      : 'text-[#707070] hover:text-white'
                  }`}
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setCodeReviewModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-[#212121] text-[#b4b4b4] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Subheader: File Tabs & Item Actions */}
          <div className="px-5 py-2.5 bg-[#171717] border-b border-[#262626] flex items-center justify-between shrink-0 gap-3 overflow-x-auto">
            {/* Horizontal File Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {codeReviewItems.map((item, idx) => {
                const isSelected = selectedItemIndex === idx;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItemIndex(idx)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono transition-colors shrink-0 ${
                      isSelected
                        ? 'bg-[#2f2f2f] text-white border border-[#383838] font-medium'
                        : 'bg-[#212121] text-[#b4b4b4] hover:text-white border border-[#303030]'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.avatarColor }}
                    />
                    <span className="truncate max-w-[170px]">
                      {item.filename.split('/').pop()}
                    </span>
                    {item.status === 'accepted' && (
                      <span className="text-[9px] px-1 rounded bg-[#2f2f2f] text-[#ececec] border border-[#383838]">
                        applied
                      </span>
                    )}
                    {item.status === 'rejected' && (
                      <span className="text-[9px] px-1 rounded bg-[#242424] text-[#b4b4b4] border border-[#383838]">
                        rejected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Actions for currently selected item */}
            {currentItem && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleCopy(currentItem.content, currentItem.id)}
                  title="Salin Isi Kode"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#212121] hover:bg-[#282828] border border-[#303030] text-xs text-[#b4b4b4] hover:text-white transition-colors"
                >
                  {copiedId === currentItem.id ? (
                    <Check className="w-3.5 h-3.5 text-[#ececec]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>Salin</span>
                </button>

                <button
                  onClick={() => updateCodeReviewItemStatus(currentItem.id, 'rejected')}
                  title="Tolak perubahan ini"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Tolak</span>
                </button>

                <button
                  onClick={() => applyCodeReviewItem(currentItem)}
                  title="Terapkan kode ke workspace"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-black text-xs font-medium transition-colors"
                >
                  <FolderDown className="w-3.5 h-3.5" />
                  <span>Terapkan ke File</span>
                </button>
              </div>
            )}
          </div>

          {/* Main Diff / Code Body */}
          <div className="flex-1 overflow-hidden flex flex-col bg-[#171717]">
            {!currentItem ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#707070]">
                <FileCode className="w-12 h-12 mb-3 opacity-30 text-[#ececec]" />
                <p className="text-sm font-medium text-[#b4b4b4]">
                  Belum ada blok kode yang dihasilkan oleh tim agen.
                </p>
                <p className="text-xs text-[#707070] mt-1 max-w-md">
                  Mulai jalankan giliran diskusi di Team Collab. Setiap blok kode markdown
                  yang ditulis oleh agen akan otomatis diekstrak ke sini untuk Anda review.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Author Agent Info Bar */}
                <div className="px-5 py-2 bg-[#212121] border-b border-[#303030] flex items-center justify-between text-xs text-[#b4b4b4] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-[#ececec] font-semibold flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: currentItem.avatarColor }}
                      />
                      {currentItem.filename}
                    </span>
                    <span className="text-[#707070]">•</span>
                    <span>Dibuat oleh:</span>
                    <span className="text-[#ececec] font-sans font-medium">
                      {currentItem.agentName}
                    </span>
                    <span className="text-[10px] text-[#707070]">
                      ({currentItem.agentRole})
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[#ececec] bg-[#2f2f2f] px-2 py-0.5 rounded border border-[#383838] text-[10px]">
                      +{lineCount} baris
                    </span>
                    <span className="text-[10px] text-[#707070]">
                      {currentItem.timestamp}
                    </span>
                  </div>
                </div>

                {/* Diff Viewer Canvas */}
                <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed select-text bg-[#171717]">
                  {viewMode === 'split' ? (
                    <div className="grid grid-cols-2 min-h-full divide-x divide-[#303030]">
                      {/* Left: Original / Baseline */}
                      <div className="p-4 bg-[#171717]">
                        <div className="sticky top-0 pb-1.5 mb-2 border-b border-[#303030] text-[#707070] text-[10px] uppercase font-semibold flex items-center justify-between bg-[#171717] z-10">
                          <span>Original File (Baseline)</span>
                          <span className="text-[#707070]">0 lines modified</span>
                        </div>
                        <div className="text-[#707070] italic py-8 text-center text-xs">
                          (Berkas baru atau belum ada versi sebelumnya di stage)
                        </div>
                      </div>

                      {/* Right: Staged Changes by Agent */}
                      <div className="p-4 bg-[#171717]">
                        <div className="sticky top-0 pb-1.5 mb-2 border-b border-[#303030] text-[#707070] text-[10px] uppercase font-semibold flex items-center justify-between bg-[#171717] z-10">
                          <span className="text-[#ececec]">
                            Staged Changes ({currentItem.language})
                          </span>
                          <span className="text-[#b4b4b4] font-mono">
                            +{lineCount} lines
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {lines.map((line, i) => (
                            <div
                              key={i}
                              className="flex gap-3 hover:bg-[#262626] px-1.5 py-0.5 rounded transition-colors group"
                            >
                              <span className="text-[#707070] select-none w-7 text-right shrink-0 font-mono">
                                {i + 1}
                              </span>
                              <span className="text-[#ececec] select-none font-bold shrink-0">
                                +
                              </span>
                              <span className="text-[#ececec] whitespace-pre font-mono">
                                {line}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Unified View */
                    <div className="p-4 bg-[#171717] min-h-full">
                      <div className="sticky top-0 pb-1.5 mb-3 border-b border-[#303030] text-[#707070] text-[10px] uppercase font-semibold flex items-center justify-between bg-[#171717] z-10">
                        <span className="text-[#ececec]">
                          Unified Changes ({currentItem.filename})
                        </span>
                        <span className="text-[#b4b4b4] font-mono">+{lineCount} lines</span>
                      </div>
                      <div className="space-y-0.5">
                        {lines.map((line, i) => (
                          <div
                            key={i}
                            className="flex gap-3 hover:bg-[#262626] px-1.5 py-0.5 rounded transition-colors bg-[#212121]"
                          >
                            <span className="text-[#707070] select-none w-7 text-right shrink-0 font-mono">
                              {i + 1}
                            </span>
                            <span className="text-[#ececec] select-none font-bold shrink-0">
                              +
                            </span>
                            <span className="text-[#ececec] whitespace-pre font-mono">
                              {line}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CodeReviewModal;
