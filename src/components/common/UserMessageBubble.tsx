import React, { useState, useMemo } from 'react';
import { FileText, Image as ImageIcon, FileCode, File, ChevronDown, ChevronUp } from 'lucide-react';
import { parseUserMessageContent, ParsedUserMessageAttachment } from '../../utils/fileUpload';

interface UserMessageBubbleProps {
  content: string;
  className?: string;
}

export const UserMessageBubble: React.FC<UserMessageBubbleProps> = ({
  content,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const { userPrompt, attachments } = useMemo(
    () => parseUserMessageContent(content),
    [content]
  );

  const getFileIcon = (att: ParsedUserMessageAttachment) => {
    if (att.isImage) return <ImageIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'html', 'css', 'json'].includes(att.lang)) {
      return <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
    if (['docx', 'doc', 'pdf', 'txt', 'md'].includes(att.lang)) {
      return <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
    return <File className="w-3.5 h-3.5 text-[#b4b4b4] shrink-0" />;
  };

  const hasReadableContent = attachments.some(
    (a) => a.content && a.content.trim().length > 0 && !a.isImage
  );

  return (
    <div
      className={`p-3.5 px-4 rounded-2xl bg-[#2f2f2f] border border-[#383838] text-[#ececec] select-text space-y-2.5 ${className}`}
    >
      {/* Teks Prompt Pengguna Utama */}
      {userPrompt && (
        <p className="text-sm whitespace-pre-wrap leading-relaxed select-text font-sans">
          {userPrompt}
        </p>
      )}

      {/* Daftar Kapsul Lampiran Berkas */}
      {attachments.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-[#383838]">
          <div className="flex flex-wrap gap-1.5 items-center">
            {attachments.map((att, idx) => (
              <div
                key={`${att.name}-${idx}`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#212121] border border-[#383838] text-xs text-[#ececec] max-w-full"
                title={`${att.name} (${att.sizeKb})`}
              >
                {getFileIcon(att)}
                <span className="font-medium truncate max-w-[200px] text-xs">
                  {att.name}
                </span>
                <span className="text-[10px] text-[#707070] font-mono shrink-0">
                  {att.sizeKb}
                </span>
              </div>
            ))}

            {/* Tombol Toggle Pratinjau Teks Lampiran */}
            {hasReadableContent && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#262626] hover:bg-[#303030] border border-[#383838] text-[11px] text-[#b4b4b4] hover:text-[#ececec] transition-colors cursor-pointer shrink-0 ml-auto"
              >
                <span>{isExpanded ? 'Tutup Isi Lampiran' : 'Lihat Isi Lampiran'}</span>
                {isExpanded ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            )}
          </div>

          {/* Kontainer Isi Teks Lampiran yang Dapat Dilipat */}
          {isExpanded && hasReadableContent && (
            <div className="space-y-2 pt-1">
              {attachments
                .filter((a) => a.content && a.content.trim().length > 0 && !a.isImage)
                .map((att, idx) => (
                  <div
                    key={`preview-${att.name}-${idx}`}
                    className="p-3 rounded-xl bg-[#1e1e1e] border border-[#383838] space-y-1.5 text-left"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#707070] font-mono pb-1 border-b border-[#2d2d2d]">
                      <span className="text-[#b4b4b4] font-medium">{att.name}</span>
                      <span>Format: {att.lang.toUpperCase()}</span>
                    </div>
                    <pre className="text-xs font-mono text-[#d4d4d4] max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text p-1">
                      {att.content}
                    </pre>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
