import React, { useEffect, useRef, useMemo } from 'react';
import {
  FileCode,
  X,
  Save,
  Check,
  Code2,
  FolderOpen,
} from 'lucide-react';
import Prism from 'prismjs';
// Prism language grammars for comprehensive syntax highlighting
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import { useStore } from '../../store/useStore';

const EXTENSION_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  rs: 'rust',
  py: 'python',
  json: 'json',
  md: 'markdown',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  css: 'css',
  scss: 'css',
  less: 'css',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
};

const getGrammarInfo = (ext: string) => {
  const normalized = (ext || '').toLowerCase().replace(/^\./, '');
  const lang = EXTENSION_MAP[normalized] || normalized || 'typescript';
  if (Prism.languages[lang]) {
    return { grammar: Prism.languages[lang], lang };
  }
  if (Prism.languages.typescript) {
    return { grammar: Prism.languages.typescript, lang: 'typescript' };
  }
  if (Prism.languages.clike) {
    return { grammar: Prism.languages.clike, lang: 'clike' };
  }
  return { grammar: null, lang: 'text' };
};

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
  const highlightRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const activeFile = openEditorFiles.find((f) => f.path === activeEditorFilePath);

  // Keyboard shortcut Ctrl+S / Cmd+S untuk simpan
  useEffect(() => {
    const handleSaveKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveActiveEditorFile();
      }
    };

    window.addEventListener('keydown', handleSaveKeyDown);
    return () => window.removeEventListener('keydown', handleSaveKeyDown);
  }, [saveActiveEditorFile]);

  // Sinkronisasi scroll textarea dengan highlight code dan gutter nomor baris
  const handleScroll = () => {
    if (textareaRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current;
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = scrollTop;
      }
      if (highlightRef.current) {
        highlightRef.current.scrollTop = scrollTop;
        highlightRef.current.scrollLeft = scrollLeft;
      }
    }
  };

  // Dukungan tombol Tab untuk indentasi 2 spasi
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea || !activeFile) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      updateEditorFileContent(activeFile.path, newValue);

      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  };

  const { grammar, lang: targetLang } = useMemo(
    () => getGrammarInfo(activeFile?.extension || ''),
    [activeFile?.extension]
  );

  const highlightedHtml = useMemo(() => {
    if (!activeFile) return '';
    if (!grammar) {
      return (
        activeFile.content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;') + (activeFile.content.endsWith('\n') ? ' ' : '')
      );
    }
    try {
      const raw = Prism.highlight(activeFile.content, grammar, targetLang);
      return raw + (activeFile.content.endsWith('\n') ? ' ' : '');
    } catch {
      return (
        activeFile.content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;') + (activeFile.content.endsWith('\n') ? ' ' : '')
      );
    }
  }, [activeFile?.content, grammar, targetLang]);

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

  const gutterWidth = lineCount > 9999 ? 'w-16' : lineCount > 999 ? 'w-14' : 'w-12';

  const sharedEditorStyle: React.CSSProperties = {
    fontFamily: "Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', 'Courier New', monospace",
    fontSize: '12px',
    lineHeight: '22px',
    tabSize: 2,
    padding: '12px',
    margin: 0,
    border: 0,
    letterSpacing: '0px',
    whiteSpace: 'pre',
    wordWrap: 'normal',
    boxSizing: 'border-box',
  };

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

      {/* Editor Body Area: Gutter Line Numbers + Syntax Highlighted Canvas & Textarea */}
      <div className="flex-1 flex overflow-hidden bg-[#1e1e1e] relative">
        {/* Line Numbers Gutter */}
        <div
          ref={lineNumbersRef}
          className={`${gutterWidth} bg-[#181818] border-r border-[#2a2a2a] text-[#555555] text-right pr-3 select-none overflow-hidden shrink-0 font-mono`}
          style={{
            fontFamily: "Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', 'Courier New', monospace",
            fontSize: '12px',
            lineHeight: '22px',
            paddingTop: '12px',
            paddingBottom: '12px',
          }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1} style={{ height: '22px' }}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code Canvas Container with Synchronized Highlight Layer and Input Layer */}
        <div className="flex-1 h-full overflow-hidden relative bg-[#1e1e1e]">
          {/* Syntax Highlighted Code Layer (Underneath) */}
          <pre
            ref={highlightRef}
            aria-hidden="true"
            className={`absolute inset-0 bg-transparent pointer-events-none overflow-hidden select-none language-${targetLang}`}
            style={{
              ...sharedEditorStyle,
              color: '#d4d4d4',
            }}
          >
            <code
              className={`language-${targetLang}`}
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          </pre>

          {/* Interactive Textarea Input (On Top) */}
          <textarea
            ref={textareaRef}
            value={activeFile.content}
            onChange={(e) => updateEditorFileContent(activeFile.path, e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="absolute inset-0 bg-transparent text-transparent caret-[#ffffff] resize-none outline-none overflow-auto select-text selection:bg-[#264f78]/60"
            style={{
              ...sharedEditorStyle,
              caretColor: '#ffffff',
            }}
          />
        </div>
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
          <span className="uppercase text-[#aaaaaa] font-semibold">{targetLang}</span>
          <span className={activeFile.isDirty ? 'text-amber-400 font-medium' : 'text-emerald-400'}>
            {activeFile.isDirty ? 'Belum disimpan' : 'Sinkron'}
          </span>
        </div>
      </div>
    </div>
  );
};
