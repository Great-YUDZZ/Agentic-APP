import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  FileCode,
  FileText,
  File,
  Braces,
  X,
  CornerDownLeft,
  ArrowUpDown,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { FileNode } from '../../types';

// Ekstraksi seluruh file berkas dari hierarki pohon workspace
const flattenFileNodes = (nodes: FileNode[]): FileNode[] => {
  const result: FileNode[] = [];
  const traverse = (list: FileNode[]) => {
    for (const item of list) {
      if (item.is_dir) {
        if (item.children && item.children.length > 0) {
          traverse(item.children);
        }
      } else {
        result.push(item);
      }
    }
  };
  traverse(nodes);
  return result;
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
    case 'doc':
      return <FileText className="w-4 h-4 text-[#a0a0a0] shrink-0" />;
    default:
      return <File className="w-4 h-4 text-[#808080] shrink-0" />;
  }
};

// Format ukuran berkas ke satuan terdekat
const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Penyorot kecocokan substring teks
const HighlightMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query.trim()) return <span>{text}</span>;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-amber-400/30 text-amber-200 rounded-xs px-0.5 font-semibold">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

export const QuickOpenModal: React.FC = () => {
  const {
    isQuickOpenModalOpen,
    setQuickOpenModalOpen,
    workspaceFiles,
    openFileInStudioEditor,
  } = useStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  // Seluruh berkas dalam kondisi datar
  const allFiles = useMemo(() => {
    return flattenFileNodes(workspaceFiles);
  }, [workspaceFiles]);

  // Penyaringan berkas dengan skor relevansi
  const filteredFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return allFiles.slice(0, 50);
    }

    return allFiles
      .filter((f) => {
        const nameMatch = f.name.toLowerCase().includes(q);
        const pathMatch = f.relative_path.toLowerCase().includes(q);
        return nameMatch || pathMatch;
      })
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        // Exact name match
        if (aName === q && bName !== q) return -1;
        if (bName === q && aName !== q) return 1;
        // Starts with query
        const aStarts = aName.startsWith(q);
        const bStarts = bName.startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;
        return a.relative_path.localeCompare(b.relative_path);
      })
      .slice(0, 100);
  }, [allFiles, query]);

  // Reset indeks seleksi saat query berubah
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Fokuskan input saat modal dibuka
  useEffect(() => {
    if (isQuickOpenModalOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isQuickOpenModalOpen]);

  // Gulir otomatis item aktif ke dalam tampilan
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  if (!isQuickOpenModalOpen) return null;

  const handleOpenSelected = (file: FileNode) => {
    openFileInStudioEditor(file);
    setQuickOpenModalOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setQuickOpenModalOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredFiles.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filteredFiles.length);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredFiles.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + filteredFiles.length) % filteredFiles.length);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredFiles.length > 0 && filteredFiles[selectedIndex]) {
        handleOpenSelected(filteredFiles[selectedIndex]);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-20 px-4 animate-in fade-in duration-150 backdrop-blur-[2px]"
      onClick={() => setQuickOpenModalOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-[#212121] border border-[#383838] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Kolom Input Pencarian */}
        <div className="flex items-center px-4 py-3 bg-[#262626] border-b border-[#303030] gap-3">
          <Search className="w-4 h-4 text-[#909090] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari berkas berdasarkan nama atau direktori... (Ctrl+P)"
            className="flex-1 bg-transparent text-sm text-[#ececec] placeholder-[#707070] outline-none"
          />
          <button
            type="button"
            onClick={() => setQuickOpenModalOpen(false)}
            className="p-1 rounded-md text-[#707070] hover:text-[#ececec] hover:bg-[#333333] transition-colors"
            title="Tutup (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Daftar Hasil Berkas */}
        <div
          ref={listRef}
          className="max-h-96 overflow-y-auto divide-y divide-[#262626] py-1 select-none"
        >
          {filteredFiles.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#808080]">
              {allFiles.length === 0
                ? 'Belum ada berkas di workspace project saat ini.'
                : `Tidak ada berkas yang cocok dengan '${query}'.`}
            </div>
          ) : (
            filteredFiles.map((file, idx) => {
              const isSelected = idx === selectedIndex;
              const pathParts = file.relative_path.split('/');
              const dirPath = pathParts.slice(0, -1).join('/');

              return (
                <div
                  key={file.relative_path}
                  ref={isSelected ? activeItemRef : null}
                  onClick={() => handleOpenSelected(file)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-4 py-2.5 text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#2b2b2b] text-[#ececec] border-l-2 border-[#ececec]'
                      : 'hover:bg-[#262626] text-[#b4b4b4]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                    {getFileIcon(file.extension)}
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-[#ececec]">
                        <HighlightMatch text={file.name} query={query} />
                      </span>
                      {dirPath && (
                        <span className="ml-2 text-[11px] text-[#707070] truncate">
                          <HighlightMatch text={dirPath} query={query} />
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-[#666666]">
                      {formatFileSize(file.size)}
                    </span>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[10px] text-[#909090] bg-[#333333] px-1.5 py-0.5 rounded border border-[#444444]">
                        <span>Buka</span>
                        <CornerDownLeft className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
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
              <span>Buka berkas</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[#282828] border border-[#383838] text-[9px] text-[#a0a0a0]">
                ESC
              </kbd>
              <span>Tutup</span>
            </span>
          </div>

          <div>
            <span>
              {filteredFiles.length} dari {allFiles.length} berkas
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickOpenModal;
