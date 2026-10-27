import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Terminal,
  Search,
  Sparkles,
  FolderGit2,
  Columns,
  Rows,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

interface AgentQuickLauncherPopoverProps {
  paneId: string;
  triggerRect?: DOMRect | null;
  onClose: () => void;
}

export const AgentQuickLauncherPopover: React.FC<AgentQuickLauncherPopoverProps> = ({
  paneId,
  triggerRect,
  onClose,
}) => {
  const {
    installedCliAgents,
    spawnAgentInPane,
    addTabToPane,
    splitPane,
    createWorktreeForTask,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [useWorktree, setUseWorktree] = useState(false);
  const [worktreeSlug, setWorktreeSlug] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 60,
    left: 60,
  });

  useEffect(() => {
    if (triggerRect) {
      const popoverWidth = 330;
      const popoverHeight = 410;
      let left = triggerRect.left;
      let top = triggerRect.bottom + 6;

      if (left + popoverWidth > window.innerWidth - 12) {
        left = window.innerWidth - popoverWidth - 12;
      }
      if (left < 12) left = 12;

      if (top + popoverHeight > window.innerHeight - 12) {
        top = Math.max(12, triggerRect.top - popoverHeight - 6);
      }

      setCoords({ top, left });
    } else {
      // Pusatkan jika tidak ada trigger rect
      setCoords({
        top: Math.max(60, Math.round(window.innerHeight / 2 - 200)),
        left: Math.max(20, Math.round(window.innerWidth / 2 - 165)),
      });
    }
  }, [triggerRect]);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Fallback katalog jika pendeteksian awal masih berlangsung
  const defaultAgentCatalog = [
    { id: 'claude', name: 'Claude Code', binary_name: 'claude', description: 'Anthropic Agentic Coding Harness' },
    { id: 'agy', name: 'Google Antigravity', binary_name: 'agy', description: 'Gemini DeepMind Agent Runtime' },
    { id: 'opencode', name: 'OpenCode Interpreter', binary_name: 'opencode', description: 'Open Source AI Terminal Agent' },
    { id: 'gemini', name: 'Gemini CLI', binary_name: 'gemini', description: 'Google Developer AI CLI' },
    { id: 'aider', name: 'Aider CLI', binary_name: 'aider', description: 'AI Pair Programming in Terminal' },
  ];

  const agentList = installedCliAgents.length > 0 ? installedCliAgents : defaultAgentCatalog;

  const filteredAgents = agentList.filter((ag) =>
    ag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ag.binary_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLaunchAgent = async (
    agentId: string,
    agentName: string,
    placement: 'tab' | 'split-right' | 'split-down' = 'tab'
  ) => {
    let customCwd: string | undefined = undefined;
    if (useWorktree && worktreeSlug.trim()) {
      const slug = worktreeSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const wt = await createWorktreeForTask(
        slug,
        `Task ${agentName}: ${slug}`,
        `feature/${slug}`,
        agentId
      );
      if (wt) {
        customCwd = wt.path;
      }
    }
    await spawnAgentInPane(paneId, agentId, customCwd, placement);
    onClose();
  };

  const handleLaunchStandardTerminal = async (
    placement: 'tab' | 'split-right' | 'split-down' = 'tab'
  ) => {
    if (placement === 'split-right') {
      const newTabId = await addTabToPane(paneId, 'Terminal');
      await splitPane(paneId, 'horizontal', newTabId);
    } else if (placement === 'split-down') {
      const newTabId = await addTabToPane(paneId, 'Terminal');
      await splitPane(paneId, 'vertical', newTabId);
    } else {
      await addTabToPane(paneId, 'Terminal');
    }
    onClose();
  };

  return createPortal(
    <>
      {/* Backdrop transparan untuk menangkap klik luar */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[99998] bg-black/25"
      />

      {/* Popover Floating Window */}
      <div
        ref={popoverRef}
        style={{
          position: 'fixed',
          top: coords.top,
          left: coords.left,
          zIndex: 99999,
        }}
        className="w-[330px] bg-[#212121] border border-[#383838] rounded-xl shadow-2xl overflow-hidden text-[#ececec] font-sans animate-in fade-in zoom-in-95 duration-100"
      >
        {/* Search Input Bar */}
        <div className="p-2 border-b border-[#2e2e2e] flex items-center gap-2 bg-[#1b1b1b]">
          <Search className="w-3.5 h-3.5 text-[#707070] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari agen atau terminal..."
            className="w-full bg-transparent text-xs text-[#ececec] placeholder-[#707070] focus:outline-none"
          />
          <span className="text-[10px] text-[#707070] font-mono px-1 py-0.5 rounded bg-[#262626] border border-[#333333]">
            Esc
          </span>
        </div>

        {/* Action List Scroll Container */}
        <div className="max-h-72 overflow-y-auto p-1.5 space-y-1 scrollbar-none">
          {/* Shell Standar Row */}
          <div className="group flex items-center justify-between p-1.5 rounded-lg hover:bg-[#2a2a2a] border border-transparent hover:border-[#383838] transition-colors">
            <div
              onClick={() => handleLaunchStandardTerminal('tab')}
              className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
            >
              <div className="w-7 h-7 rounded-md bg-[#1a1a1a] border border-[#333333] flex items-center justify-center text-[#ececec] flex-shrink-0">
                <Terminal className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <div className="text-xs font-medium text-[#ececec]">New Terminal</div>
                <div className="text-[10px] text-[#707070] truncate">Shell sistem default (Bash)</div>
              </div>
            </div>

            {/* Placement Quick Split Buttons */}
            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 pl-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLaunchStandardTerminal('split-right');
                }}
                className="p-1 rounded hover:bg-[#383838] text-[#8e8e8e] hover:text-[#ececec] transition-colors"
                title="Buka di Panel Baru (Split Kanan)"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLaunchStandardTerminal('split-down');
                }}
                className="p-1 rounded hover:bg-[#383838] text-[#8e8e8e] hover:text-[#ececec] transition-colors"
                title="Buka di Panel Baru (Split Bawah)"
              >
                <Rows className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Header Agen CLI AI */}
          <div className="pt-2 pb-1 px-2 text-[10px] font-semibold text-[#707070] uppercase tracking-wider flex items-center justify-between">
            <span>Agen CLI AI</span>
            <span className="flex items-center gap-1 text-[#10a37f]">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Terdeteksi</span>
            </span>
          </div>

          {/* Agen CLI Items */}
          {filteredAgents.map((ag) => (
            <div
              key={ag.id}
                className="group flex items-center justify-between p-1.5 rounded-lg hover:bg-[#2a2a2a] border border-transparent hover:border-[#383838] transition-colors"
              >
                <div
                  onClick={() => handleLaunchAgent(ag.id, ag.name, 'tab')}
                  className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-md bg-[#1a1a1a] border border-[#333333] flex items-center justify-center text-[#10a37f] flex-shrink-0">
                    <Terminal className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-medium text-[#ececec] flex items-center gap-1.5">
                      <span className="truncate">{ag.name}</span>
                      <span className="text-[10px] px-1 py-0.2 rounded bg-[#171717] text-[#8e8e8e] font-mono border border-[#303030]">
                        {ag.binary_name}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#707070] truncate">
                      {'version' in ag && ag.version ? `v${ag.version}` : ('description' in ag ? (ag as any).description : 'CLI Agent')}
                    </div>
                  </div>
                </div>

                {/* Placement Buttons */}
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 pl-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLaunchAgent(ag.id, ag.name, 'split-right');
                    }}
                    className="p-1 rounded hover:bg-[#383838] text-[#8e8e8e] hover:text-[#ececec] transition-colors"
                    title="Buka di Panel Baru (Split Kanan)"
                  >
                    <Columns className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLaunchAgent(ag.id, ag.name, 'split-down');
                    }}
                    className="p-1 rounded hover:bg-[#383838] text-[#8e8e8e] hover:text-[#ececec] transition-colors"
                    title="Buka di Panel Baru (Split Bawah)"
                  >
                    <Rows className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
          ))}

          {filteredAgents.length === 0 && (
            <div className="p-3 text-center text-xs text-[#707070]">
              Tidak ada agen yang cocok dengan query '{searchQuery}'
            </div>
          )}
        </div>

        {/* Worktree Isolation Toggle Footer */}
        <div className="p-2 border-t border-[#2e2e2e] bg-[#1a1a1a] text-[11px] space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer select-none text-[#b4b4b4] hover:text-[#ececec]">
            <input
              type="checkbox"
              checked={useWorktree}
              onChange={(e) => setUseWorktree(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-[#171717] border border-[#383838] text-[#10a37f] focus:ring-0"
            />
            <FolderGit2 className="w-3.5 h-3.5 text-[#10a37f]" />
            <span>Isolasi ke Cabang Worktree Baru</span>
          </label>

          {useWorktree && (
            <input
              type="text"
              value={worktreeSlug}
              onChange={(e) => setWorktreeSlug(e.target.value)}
              placeholder="Slug tugas (contoh: auth-jwt)"
              className="w-full h-7 px-2 text-[11px] bg-[#141414] border border-[#383838] rounded text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#4f4f4f]"
            />
          )}
        </div>
      </div>
    </>,
    document.body
  );
};
