import React, { useState } from 'react';
import {
  Columns,
  Rows,
  Maximize2,
  Minimize2,
  Trash2,
  X,
  Plus,
} from 'lucide-react';
import { TerminalPaneNode } from '../../types';
import { useStore } from '../../store/useStore';
import { XtermView } from './XtermView';
import { AgentQuickLauncherPopover } from './AgentQuickLauncherPopover';

interface TerminalPaneCardProps {
  pane: TerminalPaneNode;
}

export const TerminalPaneCard: React.FC<TerminalPaneCardProps> = ({ pane }) => {
  const {
    terminalTabs,
    activeTerminalWorkers,
    maximizedPaneId,
    splitPane,
    closePane,
    toggleMaximizePane,
    setActiveTabInPane,
    closeTabInPane,
    terminateTerminalWorker,
  } = useStore();

  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const isMaximized = maximizedPaneId === pane.id;

  const getWorkerForTab = (tabId: string) => {
    return activeTerminalWorkers.find((w) => w.tab_id === tabId);
  };

  const handleClearTerminal = async () => {
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('terminal_pty_write', {
          tabId: pane.activeTabId,
          data: 'clear\n',
        });
      } catch (err) {
        console.error('Failed to clear terminal:', err);
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#171717] border border-[#2e2e2e] rounded-lg overflow-hidden relative shadow-sm">
      {/* Pane Header */}
      <div className="h-9 bg-[#1f1f1f] border-b border-[#2e2e2e] px-2 flex items-center justify-between flex-shrink-0 select-none">
        {/* Tabs Row */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-[65%] scrollbar-none py-1">
          {pane.tabs.map((tabId) => {
            const tab = terminalTabs.find((t) => t.id === tabId);
            const worker = getWorkerForTab(tabId);
            const isActive = tabId === pane.activeTabId;

            return (
              <div
                key={tabId}
                onClick={() => setActiveTabInPane(pane.id, tabId)}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs cursor-pointer border transition-colors ${
                  isActive
                    ? 'bg-[#2a2a2a] border-[#404040] text-[#ececec]'
                    : 'bg-[#1b1b1b] border-transparent text-[#8e8e8e] hover:text-[#b4b4b4] hover:bg-[#222222]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    worker?.status === 'working'
                      ? 'bg-[#10a37f] animate-pulse'
                      : worker?.status === 'waiting_approval'
                      ? 'bg-[#f59e0b]'
                      : 'bg-[#707070]'
                  }`}
                />
                <span className="truncate max-w-[110px] font-medium">
                  {tab?.title || 'Terminal'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (worker) {
                      terminateTerminalWorker(worker.worker_id);
                    }
                    closeTabInPane(pane.id, tabId);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#383838] text-[#8e8e8e] hover:text-[#ececec] transition-opacity ml-0.5"
                  title="Tutup tab"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* '+' Button to open Quick Launcher Popover */}
          <div className="relative">
            <button
              onClick={() => setIsLauncherOpen(!isLauncherOpen)}
              className="p-1 rounded-md bg-[#252525] hover:bg-[#303030] text-[#8e8e8e] hover:text-[#ececec] border border-[#333333] transition-colors"
              title="Buka agen atau terminal baru di panel ini"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {isLauncherOpen && (
              <AgentQuickLauncherPopover
                paneId={pane.id}
                onClose={() => setIsLauncherOpen(false)}
              />
            )}
          </div>
        </div>

        {/* Pane Controls Right */}
        <div className="flex items-center gap-0.5 text-[#8e8e8e]">
          <button
            onClick={() => splitPane(pane.id, 'horizontal')}
            className="p-1 rounded hover:bg-[#2a2a2a] hover:text-[#ececec] transition-colors"
            title="Split Kanan (Horizontal)"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => splitPane(pane.id, 'vertical')}
            className="p-1 rounded hover:bg-[#2a2a2a] hover:text-[#ececec] transition-colors"
            title="Split Bawah (Vertikal)"
          >
            <Rows className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => toggleMaximizePane(pane.id)}
            className="p-1 rounded hover:bg-[#2a2a2a] hover:text-[#ececec] transition-colors"
            title={isMaximized ? 'Pulihkan Ukuran' : 'Fokus Layar Penuh'}
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5 text-[#10a37f]" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={handleClearTerminal}
            className="p-1 rounded hover:bg-[#2a2a2a] hover:text-[#ececec] transition-colors"
            title="Bersihkan Layar Terminal (clear)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => closePane(pane.id)}
            className="p-1 rounded hover:bg-[#3d2424] hover:text-[#ef4444] transition-colors ml-0.5"
            title="Tutup Panel Ini"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pane Terminal Canvas */}
      <div className="flex-1 min-h-0 relative bg-[#121212]">
        {pane.activeTabId && (
          <XtermView tabId={pane.activeTabId} isActive={true} />
        )}
      </div>
    </div>
  );
};
