import React, { useState, useMemo } from 'react';
import {
  FileDiff,
  Check,
  X,
  FileCode,
  CheckCircle2,
  XCircle,
  Columns,
  AlignJustify,
  Bot,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DiffFile } from '../../types';
import { computeUnifiedDiff, computeSplitDiff } from '../../utils/diffComputer';

export const DiffViewer: React.FC = () => {
  const { diffFiles, acceptDiff, rejectDiff, addToast } = useStore();
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');

  const currentFile: DiffFile | undefined = diffFiles[selectedFileIndex];

  const handleAccept = (filename: string) => {
    acceptDiff(filename);
    addToast('success', `Perubahan diterima: ${filename.split('/').pop()}`);
  };

  const handleReject = (filename: string) => {
    rejectDiff(filename);
    addToast('info', `Perubahan ditolak: ${filename.split('/').pop()}`);
  };

  const unifiedDiff = useMemo(() => {
    if (!currentFile) return [];
    return computeUnifiedDiff(currentFile.oldContent, currentFile.newContent);
  }, [currentFile]);

  const splitDiff = useMemo(() => {
    if (!currentFile) return [];
    return computeSplitDiff(currentFile.oldContent, currentFile.newContent);
  }, [currentFile]);

  if (!currentFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-[#707070] select-none bg-[#212121]">
        <FileDiff className="w-12 h-12 mb-3 opacity-40 text-[#b4b4b4]" />
        <h3 className="text-sm font-semibold text-[#ececec] mb-1">
          Tidak Ada Peninjauan Diff
        </h3>
        <p className="text-xs text-[#707070] max-w-sm">
          Belum ada modifikasi berkas yang diusulkan oleh agen tim. Sesi coding otonom akan menghasilkan usulan perubahan di sini.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#212121] font-mono text-xs select-none">
      {/* File Selector & Controls Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#171717] border-b border-[#262626] shrink-0 gap-4">
        {/* File Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 flex-1">
          {diffFiles.map((file, idx) => (
            <button
              key={file.filename}
              onClick={() => setSelectedFileIndex(idx)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-colors shrink-0 ${
                selectedFileIndex === idx
                  ? 'bg-[#2f2f2f] border-[#383838] text-[#ececec] font-medium'
                  : 'bg-[#212121] border-[#303030] text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#282828]'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-[#b4b4b4]" />
              <span className="truncate max-w-[170px]">{file.filename.split('/').pop()}</span>
              {file.status === 'accepted' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#ececec] shrink-0" />
              )}
              {file.status === 'rejected' && (
                <XCircle className="w-3.5 h-3.5 text-[#8e8e8e] shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Right Toolbar: View Mode, Agent Badge, Stats & Accept/Reject */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Agent Proposer Badge */}
          {currentFile.agentName && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#212121] border border-[#303030] text-[11px] text-[#ececec]">
              <Bot className="w-3.5 h-3.5 text-[#b4b4b4]" />
              <span className="text-[#707070]">Diubah oleh:</span>
              <span className="font-medium text-[#ececec]">{currentFile.agentName}</span>
            </div>
          )}

          {/* View Mode Toggle: Unified vs Split */}
          <div className="flex items-center p-0.5 bg-[#212121] rounded-lg border border-[#303030]">
            <button
              type="button"
              onClick={() => setViewMode('unified')}
              title="Tampilan Terpadu (Unified Diff)"
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                viewMode === 'unified'
                  ? 'bg-[#2f2f2f] text-[#ececec] border border-[#383838]'
                  : 'text-[#707070] hover:text-[#b4b4b4]'
              }`}
            >
              <AlignJustify className="w-3 h-3" />
              <span className="hidden sm:inline">Unified</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              title="Tampilan Berdampingan (Split Diff)"
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                viewMode === 'split'
                  ? 'bg-[#2f2f2f] text-[#ececec] border border-[#383838]'
                  : 'text-[#707070] hover:text-[#b4b4b4]'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span className="hidden sm:inline">Split</span>
            </button>
          </div>

          {/* Stats Badges */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span
              className="text-[#4ade80] bg-[#123824] px-2 py-0.5 rounded-md border border-[#1b5e3b] font-mono font-medium"
              title="Baris Ditambahkan"
            >
              +{currentFile.additions}
            </span>
            <span
              className="text-[#f87171] bg-[#3b1219] px-2 py-0.5 rounded-md border border-[#641b25] font-mono font-medium"
              title="Baris Dihapus"
            >
              -{currentFile.deletions}
            </span>
          </div>

          {/* Status / Actions */}
          {currentFile.status === 'pending' ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleReject(currentFile.filename)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#3b1219] hover:bg-[#521721] text-[#fca5a5] border border-[#641b25] text-xs font-medium transition-colors"
                title="Tolak perubahan berkas ini"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tolak</span>
              </button>
              <button
                onClick={() => handleAccept(currentFile.filename)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-[#171717] font-semibold text-xs transition-colors"
                title="Terapkan perubahan berkas ini"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Terima</span>
              </button>
            </div>
          ) : (
            <span
              className={`px-3 py-1 rounded-xl text-xs font-semibold border ${
                currentFile.status === 'accepted'
                  ? 'bg-[#123824] text-[#4ade80] border-[#1b5e3b]'
                  : 'bg-[#3b1219] text-[#f87171] border-[#641b25]'
              }`}
            >
              {currentFile.status === 'accepted' ? 'DITERIMA' : 'DITOLAK'}
            </span>
          )}
        </div>
      </div>

      {/* Diff Content View Area */}
      <div className="flex-1 overflow-hidden bg-[#171717] flex flex-col">
        {/* Header Jalur Berkas */}
        <div className="px-4 py-2 bg-[#212121] border-b border-[#262626] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#707070]">Berkas:</span>
            <span className="font-semibold text-[#ececec]">{currentFile.filename}</span>
          </div>
          <span className="text-[11px] text-[#707070]">
            {viewMode === 'unified' ? 'Tampilan Terpadu (Unified)' : 'Tampilan Terpisah (Split)'}
          </span>
        </div>

        {/* View Mode 1: Unified Diff */}
        {viewMode === 'unified' && (
          <div className="flex-1 overflow-y-auto select-text font-mono text-[11px] leading-relaxed">
            {unifiedDiff.map((line, idx) => {
              const isAdded = line.type === 'added';
              const isDeleted = line.type === 'deleted';

              return (
                <div
                  key={idx}
                  className={`flex items-start px-2 py-0.5 border-l-2 transition-colors ${
                    isAdded
                      ? 'bg-[#123824] text-[#86efac] border-[#22c55e]'
                      : isDeleted
                      ? 'bg-[#3f161c] text-[#fca5a5] border-[#ef4444]'
                      : 'text-[#b4b4b4] border-transparent hover:bg-[#212121]'
                  }`}
                >
                  {/* Nomor Baris Lama */}
                  <span className="w-10 text-right select-none text-[#555555] pr-2 shrink-0">
                    {line.oldLineNumber || ''}
                  </span>
                  {/* Nomor Baris Baru */}
                  <span className="w-10 text-right select-none text-[#555555] pr-3 shrink-0">
                    {line.newLineNumber || ''}
                  </span>
                  {/* Penanda Prefiks (+ / - / spasi) */}
                  <span
                    className={`w-4 select-none font-bold shrink-0 ${
                      isAdded
                        ? 'text-[#4ade80]'
                        : isDeleted
                        ? 'text-[#f87171]'
                        : 'text-[#555555]'
                    }`}
                  >
                    {line.prefix}
                  </span>
                  {/* Konten Teks Baris Kode */}
                  <span className="whitespace-pre flex-1">{line.text}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* View Mode 2: Split Diff (Side-by-Side) */}
        {viewMode === 'split' && (
          <div className="flex-1 grid grid-cols-2 overflow-hidden divide-x divide-[#2e2e2e]">
            {/* Kolom Kiri: Baseline (Original) */}
            <div className="flex flex-col overflow-hidden">
              <div className="px-3 py-1.5 bg-[#1f1f1f] border-b border-[#2e2e2e] text-[11px] text-[#707070] flex items-center justify-between">
                <span>SEBELUM PERUBAHAN (BASELINE)</span>
              </div>
              <div className="flex-1 overflow-y-auto select-text font-mono text-[11px] leading-relaxed">
                {splitDiff.map((row, idx) => {
                  const left = row.left;
                  const isDeleted = left?.type === 'deleted';

                  return (
                    <div
                      key={idx}
                      className={`flex items-start px-2 py-0.5 border-l-2 ${
                        isDeleted
                          ? 'bg-[#3f161c] text-[#fca5a5] border-[#ef4444]'
                          : left
                          ? 'text-[#b4b4b4] border-transparent hover:bg-[#212121]'
                          : 'bg-[#1a1a1a] text-transparent border-transparent select-none'
                      }`}
                    >
                      <span className="w-9 text-right select-none text-[#555555] pr-2 shrink-0">
                        {left?.lineNumber || ''}
                      </span>
                      <span
                        className={`w-4 select-none font-bold shrink-0 ${
                          isDeleted ? 'text-[#f87171]' : 'text-[#555555]'
                        }`}
                      >
                        {left?.prefix || ' '}
                      </span>
                      <span className="whitespace-pre flex-1">{left?.text || ' '}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Kolom Kanan: Proposed (Modifikasi Agen) */}
            <div className="flex flex-col overflow-hidden">
              <div className="px-3 py-1.5 bg-[#1f1f1f] border-b border-[#2e2e2e] text-[11px] text-[#ececec] flex items-center justify-between">
                <span>USULAN PERUBAHAN (AGENT PROPOSED)</span>
              </div>
              <div className="flex-1 overflow-y-auto select-text font-mono text-[11px] leading-relaxed">
                {splitDiff.map((row, idx) => {
                  const right = row.right;
                  const isAdded = right?.type === 'added';

                  return (
                    <div
                      key={idx}
                      className={`flex items-start px-2 py-0.5 border-l-2 ${
                        isAdded
                          ? 'bg-[#123824] text-[#86efac] border-[#22c55e]'
                          : right
                          ? 'text-[#ececec] border-transparent hover:bg-[#212121]'
                          : 'bg-[#1a1a1a] text-transparent border-transparent select-none'
                      }`}
                    >
                      <span className="w-9 text-right select-none text-[#555555] pr-2 shrink-0">
                        {right?.lineNumber || ''}
                      </span>
                      <span
                        className={`w-4 select-none font-bold shrink-0 ${
                          isAdded ? 'text-[#4ade80]' : 'text-[#555555]'
                        }`}
                      >
                        {right?.prefix || ' '}
                      </span>
                      <span className="whitespace-pre flex-1">{right?.text || ' '}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiffViewer;
