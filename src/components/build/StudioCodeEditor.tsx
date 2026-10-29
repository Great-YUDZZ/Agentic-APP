import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  FileCode,
  X,
  Code2,
  FolderOpen,
} from 'lucide-react';
import Prism from 'prismjs';
// Base, Markup & Web
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';

// Systems & Backend
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-dart';
import 'prismjs/components/prism-scala';
import 'prismjs/components/prism-zig';
import 'prismjs/components/prism-lua';
import 'prismjs/components/prism-r';
import 'prismjs/components/prism-elixir';
import 'prismjs/components/prism-erlang';
import 'prismjs/components/prism-haskell';

// Templating & Modern Web
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-less';
import 'prismjs/components/prism-graphql';
import 'prismjs/components/prism-wasm';
import 'prismjs/components/prism-solidity';

// Shell, DevOps & Config
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-powershell';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-nginx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-ini';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-diff';
import { useStore } from '../../store/useStore';
import { EditorFindReplace } from './EditorFindReplace';

const EXTENSION_MAP: Record<string, string> = {
  // Web & JavaScript Ecosystem
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  html: 'markup',
  htm: 'markup',
  xhtml: 'markup',
  xml: 'markup',
  svg: 'markup',
  vue: 'markup',
  svelte: 'markup',
  astro: 'markup',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',

  // Systems & Compiled Languages
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hh: 'cpp',
  cs: 'csharp',
  rs: 'rust',
  go: 'go',
  zig: 'zig',
  wasm: 'wasm',

  // JVM & Mobile
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  scala: 'scala',
  dart: 'dart',
  swift: 'swift',

  // Dynamic & Scripting
  py: 'python',
  pyw: 'python',
  rb: 'ruby',
  php: 'php',
  phtml: 'php',
  lua: 'lua',
  r: 'r',
  sol: 'solidity',

  // Functional
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hrl: 'erlang',
  hs: 'haskell',
  lhs: 'haskell',

  // Shell & DevOps
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  ps1: 'powershell',
  psm1: 'powershell',
  dockerfile: 'docker',
  containerfile: 'docker',
  nginx: 'nginx',

  // Data, Query & Config
  json: 'json',
  json5: 'json',
  jsonc: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  conf: 'ini',
  cfg: 'ini',
  env: 'ini',
  properties: 'ini',
  sql: 'sql',
  mysql: 'sql',
  pgsql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',

  // Documentation & VCS
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown',
  diff: 'diff',
  patch: 'diff',
};

const getGrammarInfo = (ext: string) => {
  const normalized = (ext || '').toLowerCase().replace(/^\./, '');
  const lang = EXTENSION_MAP[normalized] || normalized || 'clike';
  if (Prism.languages[lang]) {
    return { grammar: Prism.languages[lang], lang };
  }
  if (Prism.languages.clike) {
    return { grammar: Prism.languages.clike, lang: 'clike' };
  }
  if (Prism.languages.typescript) {
    return { grammar: Prism.languages.typescript, lang: 'typescript' };
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
    pendingTypingAnimations,
    consumePendingTypingAnimation,
  } = useStore();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const matchOverlayRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Typewriter Animation State
  const [typewriterState, setTypewriterState] = useState<{
    filePath: string;
    fullText: string;
    currentLength: number;
    agentName: string;
    avatarColor: string;
  } | null>(null);

  // State Find & Replace
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [isReplaceMode, setIsReplaceMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const activeFile = openEditorFiles.find((f) => f.path === activeEditorFilePath);

  // Pantau antrean animasi ketikan untuk berkas aktif
  useEffect(() => {
    if (!activeFile) return;
    if (pendingTypingAnimations && pendingTypingAnimations[activeFile.path]) {
      const anim = consumePendingTypingAnimation(activeFile.path);
      if (anim) {
        setTypewriterState({
          filePath: anim.filePath,
          fullText: anim.fullContent,
          currentLength: 0,
          agentName: anim.agentName,
          avatarColor: anim.avatarColor,
        });
      }
    }
  }, [activeFile?.path, pendingTypingAnimations, consumePendingTypingAnimation]);

  // Loop pengetikan cepat (huruf per huruf / kata per kata cepat, non-skippable)
  useEffect(() => {
    if (!typewriterState) return;

    const { fullText, currentLength, filePath } = typewriterState;
    if (currentLength >= fullText.length) {
      updateEditorFileContent(filePath, fullText);
      setTypewriterState(null);
      return;
    }

    const stepSize = Math.max(4, Math.ceil(fullText.length / 100));
    const timer = setTimeout(() => {
      const nextLength = Math.min(fullText.length, currentLength + stepSize);
      setTypewriterState((prev) =>
        prev ? { ...prev, currentLength: nextLength } : null
      );

      if (textareaRef.current) {
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 18);

    return () => clearTimeout(timer);
  }, [typewriterState, updateEditorFileContent]);

  // Keyboard shortcuts: Ctrl+S (Simpan), Ctrl+F (Cari), Ctrl+H (Ganti), Esc (Tutup)
  useEffect(() => {
    const handleEditorShortcuts = (e: KeyboardEvent) => {
      // Simpan: Ctrl+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveActiveEditorFile();
        return;
      }

      // Cari: Ctrl+F
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const selected = textareaRef.current
          ? textareaRef.current.value.substring(
              textareaRef.current.selectionStart,
              textareaRef.current.selectionEnd
            )
          : '';
        if (selected && !selected.includes('\n')) {
          setSearchTerm(selected);
        }
        setIsFindOpen(true);
        return;
      }

      // Ganti: Ctrl+H
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        const selected = textareaRef.current
          ? textareaRef.current.value.substring(
              textareaRef.current.selectionStart,
              textareaRef.current.selectionEnd
            )
          : '';
        if (selected && !selected.includes('\n')) {
          setSearchTerm(selected);
        }
        setIsFindOpen(true);
        setIsReplaceMode(true);
        return;
      }

      // Tutup Find: Esc
      if (e.key === 'Escape' && isFindOpen) {
        e.preventDefault();
        setIsFindOpen(false);
        textareaRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleEditorShortcuts);
    return () => window.removeEventListener('keydown', handleEditorShortcuts);
  }, [saveActiveEditorFile, isFindOpen]);

  // Sinkronisasi scroll textarea dengan highlight code, match overlay, dan gutter nomor baris
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
      if (matchOverlayRef.current) {
        matchOverlayRef.current.scrollTop = scrollTop;
        matchOverlayRef.current.scrollLeft = scrollLeft;
      }
    }
  };

  // Hitung kecocokan teks pencarian
  const matches = useMemo(() => {
    if (!searchTerm.trim() || !activeFile?.content) return [];
    const content = activeFile.content;
    try {
      const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let pattern = escaped;
      if (wholeWord) {
        pattern = `\\b${pattern}\\b`;
      }
      const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
      const results: { start: number; end: number; lineIndex: number }[] = [];
      let match: RegExpExecArray | null;
      let count = 0;
      while ((match = regex.exec(content)) !== null && count < 5000) {
        count++;
        if (match.index === regex.lastIndex) regex.lastIndex++;
        const lineIndex = content.slice(0, match.index).split('\n').length - 1;
        results.push({
          start: match.index,
          end: match.index + match[0].length,
          lineIndex,
        });
      }
      return results;
    } catch {
      return [];
    }
  }, [searchTerm, activeFile?.content, caseSensitive, wholeWord]);

  // Jaga activeMatchIndex tetap valid
  useEffect(() => {
    if (matches.length === 0) {
      setActiveMatchIndex(0);
    } else if (activeMatchIndex >= matches.length) {
      setActiveMatchIndex(0);
    }
  }, [matches.length, activeMatchIndex]);

  const jumpToMatch = (index: number) => {
    if (index < 0 || index >= matches.length || !textareaRef.current) return;
    const match = matches[index];
    const textarea = textareaRef.current;

    textarea.selectionStart = match.start;
    textarea.selectionEnd = match.end;

    const targetTop = match.lineIndex * 22;
    const currentScroll = textarea.scrollTop;
    const viewHeight = textarea.clientHeight;

    if (targetTop < currentScroll || targetTop > currentScroll + viewHeight - 44) {
      textarea.scrollTop = Math.max(0, targetTop - Math.floor(viewHeight / 3));
    }

    handleScroll();
  };

  const handleNextMatch = () => {
    if (matches.length === 0) return;
    const nextIdx = (activeMatchIndex + 1) % matches.length;
    setActiveMatchIndex(nextIdx);
    jumpToMatch(nextIdx);
  };

  const handlePrevMatch = () => {
    if (matches.length === 0) return;
    const prevIdx = (activeMatchIndex - 1 + matches.length) % matches.length;
    setActiveMatchIndex(prevIdx);
    jumpToMatch(prevIdx);
  };

  const handleReplaceCurrent = () => {
    if (!activeFile || matches.length === 0 || activeMatchIndex >= matches.length) return;
    const current = matches[activeMatchIndex];
    const oldContent = activeFile.content;
    const newContent =
      oldContent.slice(0, current.start) + replaceTerm + oldContent.slice(current.end);
    updateEditorFileContent(activeFile.path, newContent);

    requestAnimationFrame(() => {
      jumpToMatch(Math.min(activeMatchIndex, Math.max(0, matches.length - 2)));
    });
  };

  const handleReplaceAll = () => {
    if (!activeFile || matches.length === 0 || !searchTerm.trim()) return;
    const content = activeFile.content;
    try {
      const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let pattern = escaped;
      if (wholeWord) {
        pattern = `\\b${pattern}\\b`;
      }
      const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
      const newContent = content.replace(regex, replaceTerm);
      updateEditorFileContent(activeFile.path, newContent);
      setActiveMatchIndex(0);
    } catch (err) {
      console.error('Replace all error:', err);
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

  const displayContent =
    typewriterState && typewriterState.filePath === activeFile?.path
      ? typewriterState.fullText.slice(0, typewriterState.currentLength)
      : activeFile?.content || '';

  const highlightedHtml = useMemo(() => {
    if (!activeFile) return '';
    if (!grammar) {
      return (
        displayContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;') + (displayContent.endsWith('\n') ? ' ' : '')
      );
    }
    try {
      const raw = Prism.highlight(displayContent, grammar, targetLang);
      return raw + (displayContent.endsWith('\n') ? ' ' : '');
    } catch {
      return (
        displayContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;') + (displayContent.endsWith('\n') ? ' ' : '')
      );
    }
  }, [activeFile, displayContent, grammar, targetLang]);

  // Render potongan teks penyorotan kecocokan pencarian
  const matchSlices = useMemo(() => {
    if (!searchTerm.trim() || matches.length === 0 || !activeFile) return null;
    const content = activeFile.content;
    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;

    matches.forEach((m, i) => {
      if (m.start > lastIndex) {
        nodes.push(
          <span key={`text-${lastIndex}`} style={{ color: 'transparent' }}>
            {content.slice(lastIndex, m.start)}
          </span>
        );
      }
      const isCurrent = i === activeMatchIndex;
      nodes.push(
        <mark
          key={`match-${m.start}-${i}`}
          className={`rounded-xs transition-colors ${
            isCurrent
              ? 'bg-amber-400/60 ring-1 ring-amber-300'
              : 'bg-yellow-500/25'
          }`}
          style={{ color: 'transparent' }}
        >
          {content.slice(m.start, m.end)}
        </mark>
      );
      lastIndex = m.end;
    });

    if (lastIndex < content.length) {
      nodes.push(
        <span key="text-end" style={{ color: 'transparent' }}>
          {content.slice(lastIndex)}
        </span>
      );
    }

    return nodes;
  }, [activeFile?.content, matches, activeMatchIndex, searchTerm]);

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

  const lines = displayContent.split('\n');
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
      <div className="flex items-center px-2 bg-[#171717] border-b border-[#262626] shrink-0 gap-1 overflow-x-auto py-1.5">
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

        {/* Code Canvas Container with Synchronized Highlight Layer, Match Overlay and Input Layer */}
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

          {/* Search Matches Highlight Layer (Between Code and Textarea) */}
          {matchSlices && (
            <div
              ref={matchOverlayRef}
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none select-none overflow-hidden"
              style={{
                ...sharedEditorStyle,
                color: 'transparent',
              }}
            >
              {matchSlices}
            </div>
          )}

          {/* Interactive Textarea Input (On Top) */}
          <textarea
            ref={textareaRef}
            value={displayContent}
            readOnly={Boolean(typewriterState)}
            onChange={(e) => {
              if (!typewriterState) {
                updateEditorFileContent(activeFile.path, e.target.value);
              }
            }}
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

          {/* Floating Typewriter Banner */}
          {typewriterState && (
            <div className="absolute top-3 right-6 z-40 flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#282828] border border-[#383838] shadow-2xl backdrop-blur-sm animate-in fade-in duration-200 select-none">
              <div className="relative flex items-center justify-center">
                <span
                  className="w-2.5 h-2.5 rounded-full animate-ping opacity-75"
                  style={{ backgroundColor: typewriterState.avatarColor }}
                />
                <span
                  className="w-2 h-2 rounded-full absolute"
                  style={{ backgroundColor: typewriterState.avatarColor }}
                />
              </div>
              <span className="text-xs text-[#ececec] font-medium">
                {typewriterState.agentName} sedang mengetik kode...
              </span>
              <span className="text-[11px] font-mono text-[#808080]">
                {Math.round((typewriterState.currentLength / typewriterState.fullText.length) * 100)}%
              </span>
            </div>
          )}

          {/* Floating Find & Replace Widget */}
          <EditorFindReplace
            isOpen={isFindOpen}
            isReplaceMode={isReplaceMode}
            onClose={() => {
              setIsFindOpen(false);
              textareaRef.current?.focus();
            }}
            onToggleReplaceMode={() => setIsReplaceMode(!isReplaceMode)}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            replaceTerm={replaceTerm}
            setReplaceTerm={setReplaceTerm}
            matchIndex={activeMatchIndex}
            totalMatches={matches.length}
            onNext={handleNextMatch}
            onPrev={handlePrevMatch}
            onReplace={handleReplaceCurrent}
            onReplaceAll={handleReplaceAll}
            caseSensitive={caseSensitive}
            setCaseSensitive={setCaseSensitive}
            wholeWord={wholeWord}
            setWholeWord={setWholeWord}
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
          <span className={activeFile.isDirty ? 'text-[#ececec] font-medium' : 'text-[#8e8e8e]'}>
            {activeFile.isDirty ? 'Belum disimpan' : 'Sinkron'}
          </span>
        </div>
      </div>
    </div>
  );
};
