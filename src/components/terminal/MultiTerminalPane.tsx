import React, { useEffect, useState, useRef } from 'react';
import {
  Columns,
  Rows,
  Square,
  LayoutGrid,
  PanelRight,
  Terminal,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { TilingRenderer } from './TilingRenderer';
import { TerminalInspectorPanel } from './TerminalInspectorPanel';
import { TerminalPaneNode } from '../../types';
import { AgentQuickLauncherPopover } from './AgentQuickLauncherPopover';

export const MultiTerminalPane: React.FC = () => {
  const {
    tilingLayout,
    maximizedPaneId,
    isTerminalInspectorOpen,
    setIsTerminalInspectorOpen,
    ensureTilingInitialized,
    applyPresetLayout,
    refreshInstalledCliAgents,
    activeTerminalWorkers,
    draggingItem,
    dragPreviewPos,
  } = useStore();

  useEffect(() => {
    ensureTilingInitialized();
    refreshInstalledCliAgents();
  }, [ensureTilingInitialized, refreshInstalledCliAgents]);

  const [isTopLauncherOpen, setIsTopLauncherOpen] = useState(false);
  const topAddBtnRef = useRef<HTMLButtonElement>(null);

  const getFirstPaneId = (node: any): string => {
    if (!node) return 'pane-root';
    if (node.type === 'pane') return node.data.id;
    return getFirstPaneId(node.data.first) || getFirstPaneId(node.data.second) || 'pane-root';
  };

  // Find maximized pane if any
  const findMaximizedPane = (node: any, targetId: string): TerminalPaneNode | null => {
    if (!node) return null;
    if (node.type === 'pane') {
      return node.data.id === targetId ? node.data : null;
    }
    return findMaximizedPane(node.data.first, targetId) || findMaximizedPane(node.data.second, targetId);
  };

  const maximizedPane = maximizedPaneId && tilingLayout
    ? findMaximizedPane(tilingLayout, maximizedPaneId)
    : null;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1a1a1a] text-[#ececec] overflow-hidden select-none">
      {/* Top Controls Bar */}
      <div className="h-11 px-4 bg-[#212121] border-b border-[#2e2e2e] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#2a2a2a] border border-[#383838] flex items-center justify-center text-[#ececec]">
              <Terminal className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-[#ececec]">Orca Tiling Terminal Studio</span>
          </div>

          <div className="h-4 w-[1px] bg-[#333333]" />

          {/* Quick Layout Presets */}
          <div className="flex items-center gap-1 bg-[#1a1a1a] p-0.5 rounded-lg border border-[#2e2e2e]">
            <button
              onClick={() => applyPresetLayout('single')}
              title="Tata Letak Tunggal (1 Panel)"
              className="p-1 rounded hover:bg-[#282828] text-[#8e8e8e] hover:text-[#ececec] transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => applyPresetLayout('split-horizontal')}
              title="Split 2 Kolom (Berdampingan)"
              className="p-1 rounded hover:bg-[#282828] text-[#8e8e8e] hover:text-[#ececec] transition-colors"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => applyPresetLayout('split-vertical')}
              title="Split 2 Baris (Bertumpuk)"
              className="p-1 rounded hover:bg-[#282828] text-[#8e8e8e] hover:text-[#ececec] transition-colors"
            >
              <Rows className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => applyPresetLayout('grid-2x2')}
              title="Grid 2x2 (4 Terminal Paralel ala Orca)"
              className="p-1 rounded hover:bg-[#282828] text-[#10a37f] hover:text-white transition-colors"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action Tambah Agen */}
          <div>
            <button
              ref={topAddBtnRef}
              onClick={() => setIsTopLauncherOpen(!isTopLauncherOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#252525] hover:bg-[#303030] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors"
              title="Buka agen CLI baru atau terminal"
            >
              <Plus className="w-3.5 h-3.5 text-[#10a37f]" />
              <span>Tambah Agen</span>
            </button>

            {isTopLauncherOpen && (
              <AgentQuickLauncherPopover
                paneId={getFirstPaneId(tilingLayout)}
                triggerRect={topAddBtnRef.current?.getBoundingClientRect()}
                onClose={() => setIsTopLauncherOpen(false)}
              />
            )}
          </div>
        </div>

        {/* Right Info & Inspector Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#8e8e8e]">
            <span className="px-2 py-0.5 rounded bg-[#252525] border border-[#303030] text-[#ececec] text-[11px]">
              {activeTerminalWorkers.length} Agen Aktif
            </span>
          </div>

          <button
            onClick={() => setIsTerminalInspectorOpen(!isTerminalInspectorOpen)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isTerminalInspectorOpen
                ? 'bg-[#2a2a2a] border-[#404040] text-[#10a37f]'
                : 'bg-[#212121] border-[#333333] text-[#8e8e8e] hover:text-[#ececec]'
            }`}
            title="Toggle Panel Samping Agen"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Studio Body: Tiling Canvas + Right Inspector */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <div className="flex-1 p-2 overflow-hidden min-w-0 min-h-0 relative">
          {maximizedPane ? (
            /* Render Maximized Single Pane */
            <div className="w-full h-full">
              <TilingRenderer node={{ type: 'pane', data: maximizedPane }} />
            </div>
          ) : tilingLayout ? (
            /* Render Recursive Tiling Tree */
            <TilingRenderer node={tilingLayout} />
          ) : (
            /* Fallback Loading */
            <div className="w-full h-full flex items-center justify-center text-xs text-[#707070] gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#10a37f]" />
              <span>Menyiapkan Terminal Studio...</span>
            </div>
          )}
        </div>

        {/* Collapsible Right Inspector Panel */}
        {isTerminalInspectorOpen && <TerminalInspectorPanel />}
      </div>

      {/* Floating Drag Chip Preview following cursor */}
      {draggingItem && dragPreviewPos && (
        <div
          style={{
            position: 'fixed',
            left: dragPreviewPos.x + 14,
            top: dragPreviewPos.y + 14,
            zIndex: 999999,
            pointerEvents: 'none',
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141414]/95 border border-[#3b82f6] shadow-2xl text-xs text-[#ececec] font-medium select-none animate-in fade-in duration-75"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
          <span className="max-w-[150px] truncate">{draggingItem.title}</span>
        </div>
      )}
    </div>
  );
};

export default MultiTerminalPane;
