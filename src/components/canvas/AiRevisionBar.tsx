import React, { useState } from 'react';
import { ArrowUp, Sparkles } from 'lucide-react';
import { Artifact } from '../../types';

interface AiRevisionBarProps {
  artifact: Artifact;
  onSendRevision: (prompt: string) => void;
  isGenerating?: boolean;
}

const QUICK_ACTIONS = [
  'Tambahkan Penanganan Error',
  'Refaktor Lebih Modular',
  'Optimalkan Kinerja',
  'Tambahkan Tipe & Dokumentasi',
];

export const AiRevisionBar: React.FC<AiRevisionBarProps> = ({
  artifact,
  onSendRevision,
  isGenerating = false,
}) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onSendRevision(prompt.trim());
    setPrompt('');
  };

  const handleQuickClick = (action: string) => {
    if (isGenerating) return;
    onSendRevision(action);
  };

  return (
    <div className="p-3 bg-[#1e1e1e] border-t border-[#303030] flex flex-col gap-2 shrink-0 select-none">
      {/* Quick Action Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <Sparkles className="w-3 h-3 text-[#b4b4b4] shrink-0" />
        {QUICK_ACTIONS.map((action, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isGenerating}
            onClick={() => handleQuickClick(action)}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#262626] hover:bg-[#303030] text-[#b4b4b4] hover:text-[#ececec] border border-[#383838] transition-colors shrink-0 disabled:opacity-50"
          >
            {action}
          </button>
        ))}
      </div>

      {/* Revision Prompt Input Bar */}
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isGenerating}
          placeholder={`Minta AI merevisi artefak "${artifact.title}"...`}
          className="w-full h-9 pl-3 pr-9 rounded-xl bg-[#262626] border border-[#383838] text-xs text-[#ececec] placeholder:text-[#707070] outline-none focus:border-[#4f4f4f] transition-colors"
        />
        <button
          type="submit"
          disabled={!prompt.trim() || isGenerating}
          title="Kirim instruksi revisi"
          className="absolute right-1.5 w-6 h-6 rounded-lg bg-[#ececec] disabled:bg-[#383838] text-[#171717] disabled:text-[#707070] flex items-center justify-center transition-colors"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
