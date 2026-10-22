import React, { useState, useEffect, useRef } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { Artifact } from '../../types';
import { useStore } from '../../store/useStore';

interface CodeCanvasEditorProps {
  artifact: Artifact;
}

export const CodeCanvasEditor: React.FC<CodeCanvasEditorProps> = ({ artifact }) => {
  const { updateArtifactContent, addToast } = useStore();
  const [draft, setDraft] = useState(artifact.content);
  const [isDirty, setIsDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Sync draft when artifact content changes externally (e.g. version switch)
  useEffect(() => {
    setDraft(artifact.content);
    setIsDirty(false);
  }, [artifact.content, artifact.id, artifact.currentVersionIndex]);

  const lines = draft.split('\n');

  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setDraft(nextVal);
    setIsDirty(nextVal !== artifact.content);
  };

  const handleSaveDraft = () => {
    if (!isDirty) return;
    updateArtifactContent(artifact.id, draft, 'user', 'Perubahan manual operator');
    setIsDirty(false);
    addToast('success', 'Perubahan berhasil disimpan sebagai versi baru.');
  };

  const handleRevert = () => {
    setDraft(artifact.content);
    setIsDirty(false);
    addToast('info', 'Perubahan lokal dibatalkan.');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#171717] overflow-hidden relative font-mono text-xs">
      {/* Dirty Draft Bar if Modified by Operator */}
      {isDirty && (
        <div className="h-9 px-4 bg-[#262626] border-b border-[#383838] flex items-center justify-between text-xs shrink-0 select-none">
          <div className="flex items-center gap-2 text-[#b4b4b4]">
            <span className="w-2 h-2 rounded-full bg-[#ececec] animate-pulse" />
            <span>Terdapat perubahan lokal yang belum disimpan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRevert}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#212121] hover:bg-[#282828] text-[#b4b4b4] hover:text-[#ececec] border border-[#383838] transition-colors text-[11px]"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Batalkan</span>
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#ececec] hover:bg-[#ffffff] text-[#171717] font-semibold transition-colors text-[11px]"
            >
              <Save className="w-3 h-3" />
              <span>Simpan Versi</span>
            </button>
          </div>
        </div>
      )}

      {/* Editor Main Canvas: Line Numbers + Textarea */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Line Numbers Gutter */}
        <div
          ref={lineNumbersRef}
          className="w-12 py-3 bg-[#1e1e1e] border-r border-[#303030] text-right pr-3 select-none text-[#707070] overflow-hidden leading-relaxed shrink-0 select-none font-mono"
        >
          {lines.map((_, i) => (
            <div key={i} className="h-5">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea Editor */}
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={handleChange}
          onScroll={handleScroll}
          spellCheck={false}
          className="flex-1 h-full p-3 bg-transparent text-[#ececec] leading-relaxed resize-none outline-none overflow-y-auto selection:bg-[#383838] selection:text-[#ffffff] font-mono tab-4"
          style={{
            lineHeight: '20px',
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );
};
