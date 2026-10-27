import React from 'react';
import { Columns, Rows, Square, X, Plus, Terminal as TerminalIcon, Sparkles } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { XtermView } from './XtermView';

export const MultiTerminalPane: React.FC = () => {
  const {
    terminalTabs,
    activeTerminalTabId,
    setActiveTerminalTabId,
    closeTerminalTab,
    multiTerminalSplit,
    setMultiTerminalSplit,
    setIsAgentRosterModalOpen,
    activeTerminalWorkers,
    terminateTerminalWorker,
  } = useStore();

  if (terminalTabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#181818] rounded-xl border border-[#262626]">
        <div className="p-3 rounded-2xl bg-[#222222] border border-[#333333] mb-3 text-[#ececec]">
          <TerminalIcon className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-[#ececec] mb-1">
          Tidak Ada Terminal Agen Aktif
        </h3>
        <p className="text-xs text-[#8e8e8e] max-w-sm mb-4">
          Jalankan agen terminal seperti Claude Code, Antigravity, OpenCode, atau Gemini CLI untuk memulai orkestrasi tugas bersama.
        </p>
        <button
          onClick={() => setIsAgentRosterModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[#ececec] text-[#171717] hover:bg-[#ffffff] transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Buka Roster & Jalankan Agen
        </button>
      </div>
    );
  }

  // Determine tabs to show based on split layout
  const primaryTab = terminalTabs.find((t) => t.id === activeTerminalTabId) || terminalTabs[0];
  const secondaryTab = terminalTabs.find((t) => t.id !== primaryTab.id) || terminalTabs[0];

  const getWorkerForTab = (tabId: string) => {
    return activeTerminalWorkers.find((w) => w.tab_id === tabId);
  };

  return (
    <div className="flex flex-col h-full bg-[#141414] rounded-xl border border-[#2a2a2a] overflow-hidden">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1b1b1b] border-b border-[#282828]">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-[65%] scrollbar-none">
          {terminalTabs.map((tab) => {
            const worker = getWorkerForTab(tab.id);
            const isActive = tab.id === activeTerminalTabId;

            return (
              <div
                key={tab.id}
                onClick={() => setActiveTerminalTabId(tab.id)}
                className={`group flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg cursor-pointer border transition-all ${
                  isActive
                    ? 'bg-[#262626] border-[#404040] text-[#ececec]'
                    : 'bg-[#181818] border-transparent text-[#8e8e8e] hover:text-[#b4b4b4] hover:bg-[#202020]'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    worker?.status === 'working'
                      ? 'bg-[#22c55e] animate-pulse'
                      : worker?.status === 'waiting_approval'
                      ? 'bg-[#f59e0b]'
                      : 'bg-[#707070]'
                  }`}
                />
                <span className="truncate max-w-[120px] font-medium">{tab.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (worker) {
                      terminateTerminalWorker(worker.worker_id);
                    } else {
                      closeTerminalTab(tab.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#333333] text-[#8e8e8e] hover:text-[#ececec] transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          <button
            onClick={() => setIsAgentRosterModalOpen(true)}
            title="Tambah Agen Terminal Baru"
            className="p-1.5 rounded-lg bg-[#1f1f1f] hover:bg-[#282828] text-[#8e8e8e] hover:text-[#ececec] border border-[#2e2e2e] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Layout Split Toggles */}
        <div className="flex items-center gap-1 bg-[#181818] p-1 rounded-lg border border-[#282828]">
          <button
            onClick={() => setMultiTerminalSplit('tabs')}
            title="Tampilan Tab Tunggal"
            className={`p-1.5 rounded-md transition-colors ${
              multiTerminalSplit === 'tabs'
                ? 'bg-[#2a2a2a] text-[#ececec]'
                : 'text-[#8e8e8e] hover:text-[#ececec]'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setMultiTerminalSplit('split-horizontal')}
            title="Split Berdampingan (Horizontal)"
            className={`p-1.5 rounded-md transition-colors ${
              multiTerminalSplit === 'split-horizontal'
                ? 'bg-[#2a2a2a] text-[#ececec]'
                : 'text-[#8e8e8e] hover:text-[#ececec]'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setMultiTerminalSplit('split-vertical')}
            title="Split Bertumpuk (Vertikal)"
            className={`p-1.5 rounded-md transition-colors ${
              multiTerminalSplit === 'split-vertical'
                ? 'bg-[#2a2a2a] text-[#ececec]'
                : 'text-[#8e8e8e] hover:text-[#ececec]'
            }`}
          >
            <Rows className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pane Display */}
      <div className="flex-1 min-h-0 relative">
        {multiTerminalSplit === 'tabs' && (
          <div className="w-full h-full">
            {terminalTabs.map((tab) => (
              <div
                key={tab.id}
                className={`w-full h-full ${tab.id === activeTerminalTabId ? 'block' : 'hidden'}`}
              >
                <XtermView tabId={tab.id} isActive={tab.id === activeTerminalTabId} />
              </div>
            ))}
          </div>
        )}

        {multiTerminalSplit === 'split-horizontal' && (
          <div className="grid grid-cols-2 h-full divide-x divide-[#282828]">
            <div className="flex flex-col h-full min-h-0">
              <div className="px-3 py-1 bg-[#181818] border-b border-[#262626] text-[11px] font-mono text-[#8e8e8e] flex items-center justify-between">
                <span>{primaryTab?.title || 'Terminal 1'}</span>
                <span className="text-[10px] text-[#22c55e]">Active</span>
              </div>
              <div className="flex-1 min-h-0">
                <XtermView tabId={primaryTab.id} isActive={true} />
              </div>
            </div>

            <div className="flex flex-col h-full min-h-0">
              <div className="px-3 py-1 bg-[#181818] border-b border-[#262626] text-[11px] font-mono text-[#8e8e8e] flex items-center justify-between">
                <span>{secondaryTab?.title || 'Terminal 2'}</span>
                <span className="text-[10px] text-[#b4b4b4]">Secondary</span>
              </div>
              <div className="flex-1 min-h-0">
                <XtermView tabId={secondaryTab.id} isActive={true} />
              </div>
            </div>
          </div>
        )}

        {multiTerminalSplit === 'split-vertical' && (
          <div className="grid grid-rows-2 h-full divide-y divide-[#282828]">
            <div className="flex flex-col h-full min-h-0">
              <div className="px-3 py-1 bg-[#181818] border-b border-[#262626] text-[11px] font-mono text-[#8e8e8e] flex items-center justify-between">
                <span>{primaryTab?.title || 'Terminal 1'}</span>
                <span className="text-[10px] text-[#22c55e]">Active</span>
              </div>
              <div className="flex-1 min-h-0">
                <XtermView tabId={primaryTab.id} isActive={true} />
              </div>
            </div>

            <div className="flex flex-col h-full min-h-0">
              <div className="px-3 py-1 bg-[#181818] border-b border-[#262626] text-[11px] font-mono text-[#8e8e8e] flex items-center justify-between">
                <span>{secondaryTab?.title || 'Terminal 2'}</span>
                <span className="text-[10px] text-[#b4b4b4]">Secondary</span>
              </div>
              <div className="flex-1 min-h-0">
                <XtermView tabId={secondaryTab.id} isActive={true} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
