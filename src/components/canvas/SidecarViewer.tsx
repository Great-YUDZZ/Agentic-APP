import React, { useState, useEffect, useCallback } from 'react';
import { SidecarHeader } from './SidecarHeader';
import { CodeCanvasEditor } from './CodeCanvasEditor';
import { PreviewCanvas } from './PreviewCanvas';
import { AiRevisionBar } from './AiRevisionBar';
import { useStore } from '../../store/useStore';
import { Folder, Check, X, FileCode } from 'lucide-react';

interface SidecarViewerProps {
  onSendRevision?: (prompt: string) => void;
}

export const SidecarViewer: React.FC<SidecarViewerProps> = ({ onSendRevision }) => {
  const {
    artifacts,
    activeArtifactId,
    sidecarWidth,
    setSidecarWidth,
    sidecarTab,
    saveArtifactToWorkspace,
    workspaceProjectRoot,
    addToast,
    addQueuedMessage,
    isStreaming,
    isWorking,
  } = useStore();

  const [isResizing, setIsResizing] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [savePath, setSavePath] = useState('');

  const activeArtifact = artifacts.find((a) => a.id === activeArtifactId) || artifacts[0];

  // Draggable resizer logic
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setSidecarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, setSidecarWidth]);

  // Open Save Modal with suggested path
  const handleOpenSaveModal = () => {
    if (!activeArtifact) return;
    const defaultExt =
      activeArtifact.language === 'markdown'
        ? 'md'
        : activeArtifact.language === 'typescript'
        ? 'ts'
        : activeArtifact.language === 'javascript'
        ? 'js'
        : activeArtifact.language === 'python'
        ? 'py'
        : activeArtifact.language === 'rust'
        ? 'rs'
        : activeArtifact.language === 'html'
        ? 'html'
        : activeArtifact.language === 'css'
        ? 'css'
        : activeArtifact.language === 'json'
        ? 'json'
        : 'txt';

    const cleanTitle = activeArtifact.title.includes('.')
      ? activeArtifact.title
      : `${activeArtifact.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.${defaultExt}`;

    setSavePath(cleanTitle);
    setIsSaveModalOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!activeArtifact || !savePath.trim()) return;
    const ok = await saveArtifactToWorkspace(activeArtifact.id, savePath.trim());
    if (ok) {
      setIsSaveModalOpen(false);
    }
  };

  const handleSendRevision = (userPrompt: string) => {
    if (!activeArtifact) return;
    const fullPrompt = `[Revisi Artefak: "${activeArtifact.title}"]\n${userPrompt}\n\nKode sumber acuan (v${activeArtifact.versions.length}):\n\`\`\`${activeArtifact.language}\n${activeArtifact.content}\n\`\`\``;

    if (onSendRevision) {
      onSendRevision(fullPrompt);
    } else {
      addQueuedMessage(fullPrompt);
      addToast('info', 'Permintaan revisi artefak dimasukkan ke antrean percakapan.');
    }
  };

  if (!activeArtifact) {
    return null;
  }

  return (
    <aside
      style={{ width: `${sidecarWidth}px` }}
      className="h-full flex flex-row bg-[#1e1e1e] border-l border-[#303030] relative z-20 shrink-0 select-none overflow-hidden"
    >
      {/* Draggable Resize Handle on Left Border */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1.5 h-full -ml-0.5 cursor-col-resize hover:bg-[#4f4f4f] active:bg-[#606060] transition-colors shrink-0 z-30"
        title="Geser untuk mengubah ukuran panel canvas"
      />

      {/* Main Canvas Body Column */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-[#1e1e1e]">
        {/* Top Header */}
        <SidecarHeader
          artifact={activeArtifact}
          onSaveToWorkspace={handleOpenSaveModal}
        />

        {/* Canvas Content Area (Code vs Preview) */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {sidecarTab === 'preview' ? (
            <PreviewCanvas artifact={activeArtifact} />
          ) : (
            <CodeCanvasEditor artifact={activeArtifact} />
          )}
        </div>

        {/* Bottom AI Revision Bar */}
        <AiRevisionBar
          artifact={activeArtifact}
          onSendRevision={handleSendRevision}
          isGenerating={isStreaming || isWorking}
        />
      </div>

      {/* Save to Workspace Modal Dialog */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#262626] border border-[#383838] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#303030] pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#ececec]" />
                <h3 className="text-sm font-semibold text-[#ececec]">
                  Simpan Artefak ke Workspace
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[#303030] text-[#707070] hover:text-[#ececec]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[#b4b4b4] block">
                Jalur Berkas Relatif (di dalam workspace root):
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1e1e1e] border border-[#383838]">
                <Folder className="w-4 h-4 text-[#707070] shrink-0" />
                <input
                  type="text"
                  value={savePath}
                  onChange={(e) => setSavePath(e.target.value)}
                  placeholder="src/components/MyComponent.tsx"
                  className="bg-transparent text-xs text-[#ececec] font-mono outline-none flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmSave();
                    if (e.key === 'Escape') setIsSaveModalOpen(false);
                  }}
                />
              </div>
              <p className="text-[11px] text-[#707070]">
                Workspace:{' '}
                <span className="font-mono text-[#b4b4b4]">
                  {workspaceProjectRoot || '/media/yudz/FLASHDISK/Agentic'}
                </span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#303030]">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-[#383838] hover:bg-[#303030] text-xs font-medium text-[#b4b4b4] hover:text-[#ececec] transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ececec] hover:bg-[#ffffff] text-xs font-semibold text-[#171717] transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan Berkas</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
