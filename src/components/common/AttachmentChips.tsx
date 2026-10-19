import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, FileCode, Image as ImageIcon, X } from 'lucide-react';
import { AttachedFile } from '../../types';

interface AttachmentChipsProps {
  files: AttachedFile[];
  onRemove: (id: string) => void;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(file: AttachedFile) {
  if (file.isImage) {
    return <ImageIcon className="w-3.5 h-3.5 text-[#ececec] shrink-0" />;
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  const codeExts = ['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'json', 'html', 'css', 'scss', 'sql', 'sh', 'yaml', 'yml', 'toml'];
  if (ext && codeExts.includes(ext)) {
    return <FileCode className="w-3.5 h-3.5 text-[#ececec] shrink-0" />;
  }
  return <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
}

export const AttachmentChips: React.FC<AttachmentChipsProps> = ({
  files,
  onRemove,
  className = '',
}) => {
  if (files.length === 0) return null;

  return (
    <div className={`flex items-center gap-1.5 flex-wrap px-1 py-1.5 ${className}`}>
      <AnimatePresence initial={false}>
        {files.map((file) => (
          <motion.div
            key={file.id}
            initial={{ opacity: 0, scale: 0.85, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -4 }}
            transition={{ duration: 0.15 }}
            className="group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-[#2a2a2a] hover:bg-[#303030] border border-[#3c3c3c] text-xs text-[#ececec] transition-colors max-w-[220px] shadow-sm"
          >
            {getFileIcon(file)}
            <div className="truncate flex-1 min-w-0">
              <span className="font-mono truncate block text-[11px] font-medium leading-tight text-[#ececec]">
                {file.name}
              </span>
              <span className="text-[9px] text-[#888888] font-mono leading-none">
                {formatFileSize(file.size)}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(file.id);
              }}
              title="Hapus lampiran"
              className="w-4 h-4 rounded flex items-center justify-center text-[#888888] hover:text-white hover:bg-white/10 transition-colors ml-1 shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
