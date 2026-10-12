import React, { useState } from 'react';
import {
  FileDiff,
  Check,
  X,
  FileCode,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DiffFile } from '../../types';

export const DiffViewer: React.FC = () => {
  const { diffFiles, acceptDiff, rejectDiff, addToast } = useStore();
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  const currentFile: DiffFile | undefined = diffFiles[selectedFileIndex];

  const handleAccept = (filename: string) => {
    acceptDiff(filename);
    addToast('success', `Diterima: ${filename.split('/').pop()}`);
  };

  const handleReject = (filename: string) => {
    rejectDiff(filename);
    addToast('info', `Ditolak: ${filename.split('/').pop()}`);
  };

  if (!currentFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-[#707070] select-none bg-[#212121]">
        <FileDiff className="w-10 h-10 mb-2 opacity-40 text-[#b4b4b4]" />
        <p className="text-xs">Tidak ada file diff yang menunggu peninjauan.</p>
      </div>
    );
  }

  const oldLines = currentFile.oldContent.split('\n');
  const newLines = currentFile.newContent.split('\n');

  return (
    <div className="flex flex-col h-full bg-[#212121] font-mono text-xs select-none">
      {/* File Selector & Actions Bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#171717] border-b border-[#262626] shrink-0">
        {/* File Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {diffFiles.map((file, idx) => (
            <button
              key={file.filename}
              onClick={() => setSelectedFileIndex(idx)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-colors shrink-0 ${
                selectedFileIndex === idx
                  ? 'bg-[#2f2f2f] border-[#383838] text-[#ececec] font-medium'
                  : 'bg-[#212121] border-[#303030] text-[#b4b4b4] hover:text-[#ececec]'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span className="truncate max-w-[180px]">{file.filename.split('/').pop()}</span>
              {file.status === 'accepted' && (
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              )}
              {file.status === 'rejected' && (
                <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Diff Stats & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              +{currentFile.additions}
            </span>
            <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
              -{currentFile.deletions}
            </span>
          </div>

          {currentFile.status === 'pending' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleReject(currentFile.filename)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tolak</span>
              </button>
              <button
                onClick={() => handleAccept(currentFile.filename)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-black text-xs font-medium transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Terima</span>
              </button>
            </div>
          ) : (
            <span
              className={`px-3 py-1 rounded-xl text-xs font-medium border ${
                currentFile.status === 'accepted'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {currentFile.status.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Side-by-Side Diff Panels */}
      <div className="flex-1 grid grid-cols-2 overflow-hidden divide-x divide-[#303030] bg-[#171717]">
        {/* Left: Original File */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-4 py-2 bg-[#212121] border-b border-[#303030] text-[11px] text-[#707070] flex items-center justify-between">
            <span>ORIGINAL (BASELINE)</span>
            <span>{oldLines.length} lines</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-0.5 select-text text-[11px]">
            {oldLines.map((line, i) => (
              <div key={i} className="flex gap-4 text-[#707070] hover:bg-[#212121] px-1 rounded">
                <span className="w-8 text-right select-none text-[#555555]">{i + 1}</span>
                <span className="text-[#b4b4b4] whitespace-pre">{line}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Modified File */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-4 py-2 bg-[#212121] border-b border-[#303030] text-[11px] text-[#707070] flex items-center justify-between">
            <span className="text-emerald-400">PROPOSED CHANGES</span>
            <span>{newLines.length} lines</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-0.5 select-text text-[11px]">
            {newLines.map((line, i) => {
              const isDifferent = oldLines[i] !== line;
              return (
                <div
                  key={i}
                  className={`flex gap-4 px-1 rounded transition-colors ${
                    isDifferent
                      ? 'bg-emerald-500/10 text-emerald-200'
                      : 'text-[#ececec] hover:bg-[#212121]'
                  }`}
                >
                  <span className="w-8 text-right select-none text-[#555555]">{i + 1}</span>
                  <span className="whitespace-pre">{line}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiffViewer;
