import React, { useState } from 'react';
import {
  Code,
  Eye,
  Copy,
  Check,
  Download,
  X,
  History,
  Edit2,
  ChevronDown,
} from 'lucide-react';
import { Artifact } from '../../types';
import { useStore } from '../../store/useStore';

interface SidecarHeaderProps {
  artifact: Artifact;
  onSaveToWorkspace: () => void;
}

export const SidecarHeader: React.FC<SidecarHeaderProps> = ({
  artifact,
  onSaveToWorkspace,
}) => {
  const {
    closeSidecar,
    sidecarTab,
    setSidecarTab,
    setArtifactVersion,
    addToast,
  } = useStore();

  const [copied, setCopied] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(artifact.title);
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);

  const isPreviewable = ['html', 'svg', 'mermaid', 'markdown'].includes(
    artifact.language.toLowerCase()
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    addToast('success', 'Kode berhasil disalin ke clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTitleSubmit = () => {
    if (titleInput.trim()) {
      useStore.setState((s) => ({
        artifacts: s.artifacts.map((a) =>
          a.id === artifact.id ? { ...a, title: titleInput.trim() } : a
        ),
      }));
    }
    setIsEditingTitle(false);
  };

  const currentVer = artifact.versions[artifact.currentVersionIndex] || {
    version: artifact.versions.length,
    author: 'ai',
  };

  return (
    <div className="flex flex-col border-b border-[#303030] bg-[#1e1e1e] select-none">
      {/* Top Bar: Title, Badges, Actions */}
      <div className="h-12 px-4 flex items-center justify-between gap-3">
        {/* Left: Title & Language Pill */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isEditingTitle ? (
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') {
                  setTitleInput(artifact.title);
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
              className="bg-[#262626] border border-[#383838] px-2 py-0.5 rounded text-xs text-[#ececec] font-medium outline-none focus:border-[#4f4f4f] w-48"
            />
          ) : (
            <div className="flex items-center gap-1.5 min-w-0 group cursor-pointer" onClick={() => setIsEditingTitle(true)}>
              <span className="text-xs font-semibold text-[#ececec] truncate max-w-[200px]" title={artifact.title}>
                {artifact.title}
              </span>
              <Edit2 className="w-3 h-3 text-[#707070] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          )}

          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#282828] text-[#b4b4b4] border border-[#383838] shrink-0">
            {artifact.language}
          </span>

          {/* Version Selector Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#262626] hover:bg-[#303030] text-[#ececec] border border-[#383838] transition-colors"
            >
              <History className="w-3 h-3 text-[#b4b4b4]" />
              <span>v{currentVer.version}</span>
              <span className="text-[9px] text-[#707070]">
                ({currentVer.author === 'user' ? 'Operator' : 'AI'})
              </span>
              <ChevronDown className="w-2.5 h-2.5 text-[#707070]" />
            </button>

            {isVersionDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 w-52 rounded-xl bg-[#262626] border border-[#383838] shadow-lg py-1 z-50">
                <div className="px-3 py-1 text-[10px] text-[#707070] uppercase font-semibold border-b border-[#303030]">
                  Riwayat Revisi
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {artifact.versions.map((v, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setArtifactVersion(artifact.id, idx);
                        setIsVersionDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-[#303030] transition-colors ${
                        idx === artifact.currentVersionIndex
                          ? 'text-[#ececec] font-semibold bg-[#2f2f2f]'
                          : 'text-[#b4b4b4]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span>v{v.version}</span>
                        <span className="text-[10px] text-[#707070] truncate">
                          {v.author === 'user' ? 'Edit Manual' : 'Revisi AI'}
                        </span>
                      </div>
                      <span className="text-[9px] text-[#707070]">
                        {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Tab Switcher & Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Tab Switcher if Previewable */}
          {isPreviewable && (
            <div className="flex items-center p-0.5 rounded-lg bg-[#262626] border border-[#383838]">
              <button
                type="button"
                onClick={() => setSidecarTab('code')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  sidecarTab === 'code'
                    ? 'bg-[#333333] text-[#ececec] shadow-sm'
                    : 'text-[#b4b4b4] hover:text-[#ececec]'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Kode</span>
              </button>
              <button
                type="button"
                onClick={() => setSidecarTab('preview')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  sidecarTab === 'preview'
                    ? 'bg-[#333333] text-[#ececec] shadow-sm'
                    : 'text-[#b4b4b4] hover:text-[#ececec]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Pratinjau</span>
              </button>
            </div>
          )}

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            title="Salin isi kode ke papan klip"
            className="p-1.5 rounded-lg hover:bg-[#282828] text-[#b4b4b4] hover:text-[#ececec] transition-colors border border-transparent hover:border-[#383838]"
          >
            {copied ? <Check className="w-4 h-4 text-[#ececec]" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Save to Workspace Button */}
          <button
            type="button"
            onClick={onSaveToWorkspace}
            title="Simpan berkas ini ke direktori workspace"
            className="p-1.5 rounded-lg hover:bg-[#282828] text-[#b4b4b4] hover:text-[#ececec] transition-colors border border-transparent hover:border-[#383838]"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={closeSidecar}
            title="Tutup panel Canvas"
            className="p-1.5 rounded-lg hover:bg-[#282828] text-[#b4b4b4] hover:text-[#ececec] transition-colors border border-transparent hover:border-[#383838]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
