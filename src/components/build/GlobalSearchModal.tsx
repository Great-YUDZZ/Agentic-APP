import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  FileCode,
  FileText,
  File,
  Braces,
  X,
  ExternalLink,
  ArrowUpDown,
  Loader2,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { TextSearchMatch, FileNode } from '../../types';

// Ekstraksi seluruh file berkas dari hierarki pohon workspace
const findFileNodeByPath = (nodes: FileNode[], relativePath: string): FileNode | null => {
  for (const item of nodes) {
    if (!item.is_dir && item.relative_path === relativePath) {
      return item;
    }
    if (item.is_dir && item.children) {
      const found = findFileNodeByPath(item.children, relativePath);
      if (found) return found;
    }
  }
  return null;
};

// Ikon representasi ekstensi berkas
const getFileIcon = (ext: string) => {
  const lower = ext.toLowerCase();
  switch (lower) {
    case 'rs':
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'go':
    case 'c':
    case 'cpp':
    case 'sh':
    case 'html':
    case 'css':
      return <FileCode className="w-4 h-4 text-[#a0a0a0] shrink-0" />;
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
      return <Braces className="w-4 h-4 text-[#a0a0a0] shrink-0" />;
    case 'md':
    case 'txt':
      return <FileText className="w-4 h-4 text-[#a0a0a0] shrink-0" />;
    default:
      return <File className="w-4 h-4 text-[#808080] shrink-0" />;
  }
};

// Komponen penyorot substring teks hasil pencarian
const HighlightSearchSnippet: React.FC<{
  text: string;
  matchStart: number;
  matchEnd: number;
}> = ({ text, matchStart, matchEnd }) => {
  if (matchStart < 0 || matchEnd <= matchStart || matchStart >= text.length) {
    return <span>{text}</span>;
  }

  const before = text.slice(0, matchStart);
  const matched = text.slice(matchStart, matchEnd);
  const after = text.slice(matchEnd);

  return (
    <span>
      {before}
      <mark className="bg-amber-400/40 text-amber-200 rounded-xs px-0.5 font-semibold">
        {matched}
      </mark>
      {after}
    </span>
  );
};

export const GlobalSearchModal: React.FC = () => {
  const {
    isGlobalSearchModalOpen,
    setGlobalSearchModalOpen,
    searchWorkspaceText,
    workspaceFiles,
    openFileInStudioEditor,
  } = useStore();

  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TextSearchMatch[]>([]);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);

  // File Preview State
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewFilePath, setPreviewFilePath] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  // Fokuskan input saat modal dibuka
  useEffect(() => {
    if (isGlobalSearchModalOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isGlobalSearchModalOpen]);

  // Eksekusi pencarian teks dengan debounce
  useEffect(() => {
    if (!isGlobalSearchModalOpen) return;

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      setSelectedMatchIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const matches = await searchWorkspaceText(query, caseSensitive, wholeWord, 300);
        setSearchResults(matches);
        setSelectedMatchIndex(0);
      } catch (err) {
        console.error('Error executing global search:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, caseSensitive, wholeWord, isGlobalSearchModalOpen, searchWorkspaceText]);

  // Kelompokkan hasil pencarian berdasarkan relative_path
  const groupedResults = useMemo(() => {
    const groups: { [key: string]: TextSearchMatch[] } = {};
    searchResults.forEach((m) => {
      if (!groups[m.relative_path]) {
        groups[m.relative_path] = [];
      }
      groups[m.relative_path].push(m);
    });
    return Object.entries(groups).map(([path, matches]) => ({
      path,
      fileName: matches[0]?.file_name || path.split('/').pop() || path,
      matches,
    }));
  }, [searchResults]);

  const activeMatch = searchResults[selectedMatchIndex] || null;

  // Muat preview berkas saat item match terpilih berubah
  useEffect(() => {
    if (!activeMatch) {
      setPreviewContent('');
      setPreviewFilePath('');
      return;
    }

    if (activeMatch.relative_path === previewFilePath) {
      // Berkas sudah dimuat, cukup scroll ke line
      return;
    }

    let isMounted = true;
    setIsLoadingPreview(true);

    const loadContent = async () => {
      let content = '';
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          content = await invoke<string>('read_workspace_file', {
            relativePath: activeMatch.relative_path,
          });
        } catch (err) {
          content = `// Gagal memuat pratinjau berkas: ${err}`;
        }
      } else {
        content = `// Pratinjau mode web: ${activeMatch.relative_path}\n${activeMatch.line_content}\n`;
      }

      if (isMounted) {
        setPreviewContent(content);
        setPreviewFilePath(activeMatch.relative_path);
        setIsLoadingPreview(false);
      }
    };

    loadContent();
    return () => {
      isMounted = false;
    };
  }, [activeMatch, previewFilePath]);

  // Gulir line aktif di preview canvas ke tengah layar
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    }
  }, [selectedMatchIndex, previewContent]);

  if (!isGlobalSearchModalOpen) return null;

  // Buka berkas di editor utama
  const handleOpenInEditor = (match: TextSearchMatch) => {
    const node = findFileNodeByPath(workspaceFiles, match.relative_path);
    if (node) {
      openFileInStudioEditor(node);
    } else {
      // Fallback create virtual node
      const ext = match.file_name.split('.').pop() || '';
      openFileInStudioEditor({
        name: match.file_name,
        path: match.relative_path,
        relative_path: match.relative_path,
        is_dir: false,
        size: 0,
        extension: ext,
      });
    }
    setGlobalSearchModalOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setGlobalSearchModalOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (searchResults.length > 0) {
        setSelectedMatchIndex((prev) => (prev + 1) % searchResults.length);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (searchResults.length > 0) {
        setSelectedMatchIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeMatch) {
        handleOpenInEditor(activeMatch);
      }
    }
  };

  const previewLines = previewContent ? previewContent.split('\n') : [];

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-[2px] animate-in fade-in duration-150"
      onClick={() => setGlobalSearchModalOpen(false)}
    >
      <div
        className="w-full max-w-5xl h-[650px] max-h-[90vh] bg-[#212121] border border-[#383838] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header Bilah Pencarian */}
        <div className="flex items-center px-4 py-3 bg-[#262626] border-b border-[#303030] gap-3">
          <Search className="w-4 h-4 text-[#909090] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari teks di seluruh project... (Ctrl+Shift+F)"
            className="flex-1 bg-transparent text-sm text-[#ececec] placeholder-[#707070] outline-none"
          />

          {/* Opsi Filter Aa & WholeWord */}
          <div className="flex items-center gap-1 bg-[#1e1e1e] p-0.5 rounded-lg border border-[#383838]">
            <button
              type="button"
              onClick={() => setCaseSensitive(!caseSensitive)}
              className={`px-2 py-0.5 text-xs rounded font-mono transition-colors ${
                caseSensitive
                  ? 'bg-[#383838] text-[#ececec] font-semibold'
                  : 'text-[#707070] hover:text-[#ececec]'
              }`}
              title="Cocokkan Huruf Besar/Kecil (Case Sensitive)"
            >
              Aa
            </button>
            <button
              type="button"
              onClick={() => setWholeWord(!wholeWord)}
              className={`px-2 py-0.5 text-xs rounded font-mono transition-colors ${
                wholeWord
                  ? 'bg-[#383838] text-[#ececec] font-semibold'
                  : 'text-[#707070] hover:text-[#ececec]'
              }`}
              title="Seluruh Kata Utuh (Whole Word)"
            >
              \b
            </button>
          </div>

          {/* Status Counter */}
          <div className="text-xs text-[#808080] shrink-0 min-w-[120px] text-right">
            {isSearching ? (
              <span className="flex items-center justify-end gap-1.5 text-amber-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Mencari...</span>
              </span>
            ) : query.trim() ? (
              <span>
                {searchResults.length} hasil ({groupedResults.length} berkas)
              </span>
            ) : (
              <span>Ketik kata kunci</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setGlobalSearchModalOpen(false)}
            className="p-1 rounded-md text-[#707070] hover:text-[#ececec] hover:bg-[#333333] transition-colors shrink-0"
            title="Tutup (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Badan Utama: 2 Kolom (Hasil & Pratinjau Kode) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Kolom Kiri: Daftar Berkas & Hasil Kecocokan (40%) */}
          <div className="w-5/12 border-r border-[#303030] flex flex-col overflow-y-auto bg-[#232323] select-none">
            {searchResults.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-[#707070]">
                {query.trim() ? (
                  isSearching ? (
                    <span className="text-[#888888]">Memindai berkas project...</span>
                  ) : (
                    <span>Tidak ada kecocokan ditemukan untuk '{query}'.</span>
                  )
                ) : (
                  <span>Ketik teks pada bilah di atas untuk mencari di seluruh berkas project.</span>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#2a2a2a] py-1">
                {groupedResults.map((group) => {
                  const ext = group.fileName.split('.').pop() || '';
                  return (
                    <div key={group.path} className="py-1">
                      {/* Header Berkas */}
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#282828] text-xs font-medium text-[#ececec]">
                        {getFileIcon(ext)}
                        <span className="truncate flex-1" title={group.path}>
                          {group.fileName}
                          <span className="ml-1.5 text-[10px] text-[#707070] font-normal">
                            {group.path}
                          </span>
                        </span>
                        <span className="text-[10px] bg-[#333333] text-[#a0a0a0] px-1.5 py-0.2 rounded-full font-mono">
                          {group.matches.length}
                        </span>
                      </div>

                      {/* Baris Kecocokan dalam Berkas */}
                      <div className="divide-y divide-[#262626]">
                        {group.matches.map((m) => {
                          const globalIdx = searchResults.indexOf(m);
                          const isSelected = globalIdx === selectedMatchIndex;
                          const trimmed = m.line_content.trim();
                          const leadingSpaces = m.line_content.length - m.line_content.trimStart().length;
                          const adjustedStart = Math.max(0, m.match_start - leadingSpaces);
                          const adjustedEnd = Math.max(0, m.match_end - leadingSpaces);

                          return (
                            <div
                              key={`${m.relative_path}-${m.line_number}-${m.match_start}`}
                              onClick={() => setSelectedMatchIndex(globalIdx)}
                              onDoubleClick={() => handleOpenInEditor(m)}
                              className={`flex items-start gap-2 px-4 py-2 text-xs cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-[#2f2f2f] text-[#ececec] border-l-2 border-[#ececec]'
                                  : 'hover:bg-[#282828] text-[#9a9a9a]'
                              }`}
                            >
                              <span className="font-mono text-[11px] text-[#606060] shrink-0 w-8 text-right">
                                {m.line_number}:
                              </span>
                              <div className="font-mono text-[11px] truncate flex-1 leading-relaxed">
                                <HighlightSearchSnippet
                                  text={trimmed}
                                  matchStart={adjustedStart}
                                  matchEnd={adjustedEnd}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Kolom Kanan: Pratinjau Kode (60%) */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
            {activeMatch ? (
              <>
                {/* Header Bilah Pratinjau */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#252525] border-b border-[#303030]">
                  <div className="flex items-center gap-2 text-xs truncate">
                    <span className="font-medium text-[#ececec]">{activeMatch.file_name}</span>
                    <span className="text-[#707070]">({activeMatch.relative_path})</span>
                    <span className="bg-[#333333] px-2 py-0.5 rounded text-[11px] text-amber-300 font-mono">
                      Baris {activeMatch.line_number}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenInEditor(activeMatch)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#2f2f2f] hover:bg-[#383838] text-[#ececec] text-xs font-medium border border-[#383838] transition-colors"
                  >
                    <span>Buka di Editor</span>
                    <ExternalLink className="w-3 h-3 text-[#909090]" />
                  </button>
                </div>

                {/* Kanvas Pratinjau Berkas */}
                <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-[22px] bg-[#1e1e1e] select-text">
                  {isLoadingPreview ? (
                    <div className="py-20 text-center text-xs text-[#707070]">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#909090]" />
                      <span>Memuat pratinjau berkas...</span>
                    </div>
                  ) : (
                    previewLines.map((line, idx) => {
                      const lineNum = idx + 1;
                      const isTargetLine = lineNum === activeMatch.line_number;

                      return (
                        <div
                          key={lineNum}
                          ref={isTargetLine ? activeLineRef : null}
                          className={`flex items-start px-2 py-0.5 rounded-sm ${
                            isTargetLine
                              ? 'bg-amber-400/15 border-l-2 border-amber-400 text-[#ffffff]'
                              : 'text-[#a8a8a8]'
                          }`}
                        >
                          <span
                            className={`shrink-0 w-10 select-none text-right pr-4 ${
                              isTargetLine ? 'text-amber-300 font-bold' : 'text-[#555555]'
                            }`}
                          >
                            {lineNum}
                          </span>
                          <span className="whitespace-pre overflow-x-auto flex-1">{line || ' '}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-xs text-[#606060] p-6 text-center">
                <span>Pilih salah satu hasil di panel kiri untuk melihat pratinjau kode.</span>
              </div>
            )}
          </div>
        </div>

        {/* Bilah Navigasi Bawah */}
        <div className="px-4 py-2 bg-[#1a1a1a] border-t border-[#2e2e2e] flex items-center justify-between text-[11px] text-[#707070]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-[#909090]" />
              <span>Navigasi panah</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[#282828] border border-[#383838] text-[9px] text-[#a0a0a0]">
                ENTER
              </kbd>
              <span>Buka di Editor</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[#282828] border border-[#383838] text-[9px] text-[#a0a0a0]">
                ESC
              </kbd>
              <span>Tutup</span>
            </span>
          </div>

          <div>
            <span>Global Search Suite</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchModal;
