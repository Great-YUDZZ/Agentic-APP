import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Search,
  Sparkles,
  FolderGit2,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

interface AgentQuickLauncherPopoverProps {
  paneId: string;
  onClose: () => void;
}

export const AgentQuickLauncherPopover: React.FC<AgentQuickLauncherPopoverProps> = ({
  paneId,
  onClose,
}) => {
  const {
    installedCliAgents,
    spawnAgentInPane,
    addTabToPane,
    createWorktreeForTask,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [useWorktree, setUseWorktree] = useState(false);
  const [worktreeSlug, setWorktreeSlug] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Standard fallback agents if none detected yet
  const defaultAgentCatalog = [
    { id: 'claude', name: 'Claude Code', binary_name: 'claude', description: 'Anthropic Agentic Coding Harness' },
    { id: 'antigravity', name: 'Google Antigravity', binary_name: 'agy', description: 'Gemini DeepMind Agent Runtime' },
    { id: 'opencode', name: 'OpenCode Interpreter', binary_name: 'opencode', description: 'Open Source AI Terminal Agent' },
    { id: 'gemini', name: 'Gemini CLI', binary_name: 'gemini', description: 'Google Developer AI CLI' },
    { id: 'aider', name: 'Aider CLI', binary_name: 'aider', description: 'AI Pair Programming in Terminal' },
  ];

  const agentList = installedCliAgents.length > 0 ? installedCliAgents : defaultAgentCatalog;

  const filteredAgents = agentList.filter((ag) =>
    ag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ag.binary_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLaunchAgent = async (agentId: string, agentName: string) => {
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
    await spawnAgentInPane(paneId, agentId, customCwd);
    onClose();
  };

  const handleLaunchStandardTerminal = async () => {
    await addTabToPane(paneId, 'Terminal');
    onClose();
  };

  return (
    <div
      ref={popoverRef}
      className="absolute top-10 left-2 z-50 w-72 bg-[#262626] border border-[#383838] rounded-xl shadow-2xl overflow-hidden text-[#ececec] animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Search Input */}
      <div className="p-2 border-b border-[#333333] flex items-center gap-2 bg-[#202020]">
        <Search className="w-3.5 h-3.5 text-[#707070]" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari agen atau terminal..."
          className="w-full bg-transparent text-xs text-[#ececec] placeholder-[#707070] focus:outline-none"
        />
      </div>

      <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
        {/* Standard Shell Option */}
        <button
          onClick={handleLaunchStandardTerminal}
          className="w-full px-2.5 py-1.5 rounded-lg hover:bg-[#333333] flex items-center justify-between text-left transition-colors group"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#1e1e1e] border border-[#383838] flex items-center justify-center text-[#ececec]">
              <Terminal className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-medium text-[#ececec]">New Terminal</div>
              <div className="text-[10px] text-[#707070]">Shell bawaan sistem (Bash / PowerShell)</div>
            </div>
          </div>
          <span className="text-[10px] text-[#707070] font-mono group-hover:text-[#ececec]">Ctrl+T</span>
        </button>

        <div className="pt-1.5 pb-1 px-2 text-[10px] font-semibold text-[#707070] uppercase tracking-wider flex items-center justify-between">
          <span>Agen CLI AI</span>
          <span className="flex items-center gap-1 text-[#10a37f]">
            <Sparkles className="w-2.5 h-2.5" />
            <span>Terdeteksi</span>
          </span>
        </div>

        {filteredAgents.map((ag) => (
          <button
            key={ag.id}
            onClick={() => handleLaunchAgent(ag.id, ag.name)}
            className="w-full px-2.5 py-1.5 rounded-lg hover:bg-[#333333] flex items-center justify-between text-left transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[#1e1e1e] border border-[#383838] flex items-center justify-center text-[#10a37f]">
                <Terminal className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-medium text-[#ececec] flex items-center gap-1.5">
                  <span>{ag.name}</span>
                  <span className="text-[10px] px-1 py-0.2 rounded bg-[#1f1f1f] text-[#707070] font-mono border border-[#303030]">
                    {ag.binary_name}
                  </span>
                </div>
                <div className="text-[10px] text-[#707070] line-clamp-1">
                  {'version' in ag && ag.version ? `v${ag.version}` : ('description' in ag ? (ag as any).description : 'CLI Agent')}
                </div>
              </div>
            </div>
            <div className="w-2 h-2 rounded-full bg-[#10a37f] opacity-60 group-hover:opacity-100" />
          </button>
        ))}

        {filteredAgents.length === 0 && (
          <div className="p-3 text-center text-xs text-[#707070]">
            Tidak ada agen yang cocok dengan '{searchQuery}'
          </div>
        )}
      </div>

      {/* Worktree Isolation Toggle Footer */}
      <div className="p-2 border-t border-[#333333] bg-[#222222] text-[11px] space-y-1.5">
        <label className="flex items-center gap-2 cursor-pointer select-none text-[#b4b4b4] hover:text-[#ececec]">
          <input
            type="checkbox"
            checked={useWorktree}
            onChange={(e) => setUseWorktree(e.target.checked)}
            className="w-3.5 h-3.5 rounded bg-[#1e1e1e] border border-[#383838] text-[#10a37f] focus:ring-0"
          />
          <FolderGit2 className="w-3.5 h-3.5 text-[#10a37f]" />
          <span>Isolasi ke Cabang Worktree Baru</span>
        </label>

        {useWorktree && (
          <input
            type="text"
            value={worktreeSlug}
            onChange={(e) => setWorktreeSlug(e.target.value)}
            placeholder="Slug tugas (misal: auth-jwt)"
            className="w-full h-7 px-2 text-[11px] bg-[#1e1e1e] border border-[#383838] rounded text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#4f4f4f]"
          />
        )}
      </div>
    </div>
  );
};
