import React, { useEffect, useRef } from 'react';
import {
  FileCode,
  X,
  Save,
  Check,
  Code2,
  FolderOpen,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

export const StudioCodeEditor: React.FC = () => {
  const {
    openEditorFiles,
    activeEditorFilePath,
    setActiveEditorFile,
    closeEditorFile,
    updateEditorFileContent,
    saveActiveEditorFile,
    pickAndSetWorkspaceRoot,
  } = useStore();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const activeFile = openEditorFiles.find((f) => f.path === activeEditorFilePath);

  // Keyboard shortcut Ctrl+S / Cmd+S untuk simpan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveActiveEditorFile();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveActiveEditorFile]);

  // Sinkronisasi scroll textarea dengan gutter nomor baris
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  if (!activeFile || openEditorFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-[#707070] select-none bg-[#212121]">
        <Code2 className="w-12 h-12 mb-3 opacity-40 text-[#b4b4b4]" />
        <h3 className="text-sm font-semibold text-[#ececec] mb-1">
          Tidak Ada Berkas Terbuka
        </h3>
        <p className="text-xs text-[#707070] max-w-sm mb-4">
          Pilih berkas dari Pohon Berkas di bilah sisi kiri untuk membaca atau mengedit kode secara langsung di Studio.
        </p>
        <button
          onClick={() => pickAndSetWorkspaceRoot()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#2f2f2f] hover:bg-[#383838] text-[#ececec] border border-[#383838] text-xs font-medium transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Buka Folder Project</span>
        </button>
      </div>
    );
  }

  const lines = activeFile.content.split('\n');
  const lineCount = lines.length;

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] font-mono text-xs select-none">
      {/* Tab Bar Berkas Terbuka */}
      <div className="flex items-center justify-between px-2 bg-[#171717] border-b border-[#262626] shrink-0 gap-2 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-0 py-1.5 overflow-x-auto">
          {openEditorFiles.map((file) => {
            const isActive = file.path === activeFile.path;
            return (
              <div
                key={file.path}
                onClick={() => setActiveEditorFile(file.path)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors shrink-0 ${
                  isActive
                    ? 'bg-[#2a2a2a] border-[#383838] text-[#ececec] font-medium'
                    : 'bg-[#1f1f1f] border-transparent text-[#909090] hover:text-[#ececec] hover:bg-[#262626]'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-[#888888]" />
                <span className="truncate max-w-[150px]">{file.name}</span>
                {file.isDirty ? (
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Ada perubahan belum disimpan" />
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeEditorFile(file.path);
                  }}
                  className="p-0.5 rounded hover:bg-[#383838] text-[#707070] hover:text-[#ececec] transition-colors"
                  title="Tutup tab"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Action Button: Simpan */}
        <div className="flex items-center gap-2 shrink-0 py-1.5 pr-2">
          <button
            onClick={() => saveActiveEditorFile()}
            disabled={!activeFile.isDirty}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              activeFile.isDirty
                ? 'bg-[#ececec] hover:bg-white text-[#171717] cursor-pointer'
                : 'bg-[#282828] text-[#666666] border border-[#333333] cursor-not-allowed'
            }`}
            title="Simpan berkas (Ctrl + S)"
          >
            {activeFile.isDirty ? (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Simpan</span>
                <span className="text-[10px] text-[#555555] font-normal hidden sm:inline">Ctrl+S</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tersimpan</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor Body Area: Gutter Line Numbers + Editable Textarea */}
      <div className="flex-1 flex overflow-hidden bg-[#1e1e1e] relative">
        {/* Line Numbers Gutter */}
        <div
          ref={lineNumbersRef}
          className="w-12 py-3 bg-[#181818] border-r border-[#2a2a2a] text-[#555555] text-right pr-2.5 font-mono text-xs select-none overflow-hidden shrink-0 leading-6"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1}>{i + 1}</div>
          ))}
        </div>

        {/* Code Input Textarea */}
        <textarea
          ref={textareaRef}
          value={activeFile.content}
          onChange={(e) => updateEditorFileContent(activeFile.path, e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          className="flex-1 h-full p-3 bg-transparent text-[#ececec] font-mono text-xs leading-6 resize-none outline-none overflow-auto select-text whitespace-pre tab-4"
          style={{ tabSize: 2 }}
        />
      </div>

      {/* Status Bar Bawah */}
      <div className="px-3 py-1 bg-[#171717] border-t border-[#262626] flex items-center justify-between text-[11px] text-[#707070] shrink-0 font-mono">
        <div className="flex items-center gap-2 truncate max-w-[60%]">
          <span className="text-[#888888]">Jalur:</span>
          <span className="text-[#ececec] truncate">{activeFile.path}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span>{lineCount} baris</span>
          <span>{activeFile.content.length} karakter</span>
          <span className="uppercase text-[#aaaaaa] font-semibold">{activeFile.extension || 'TEXT'}</span>
          <span className={activeFile.isDirty ? 'text-amber-400 font-medium' : 'text-emerald-400'}>
            {activeFile.isDirty ? 'Belum disimpan' : 'Sinkron'}
          </span>
        </div>
      </div>
    </div>
  );
};
