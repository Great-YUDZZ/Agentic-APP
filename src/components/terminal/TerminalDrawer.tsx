import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal as TerminalIcon,
  X,
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

export const TerminalDrawer: React.FC = () => {
  const {
    isTerminalOpen,
    setTerminalOpen,
    terminalTabs,
    activeTerminalTabId,
    setActiveTerminalTabId,
    addTerminalTab,
    closeTerminalTab,
    clearTerminalLogs,
    runTerminalCommand,
    setSkillsModalOpen,
    workspaceProjectRoot,
  } = useStore();

  const [inputCmd, setInputCmd] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTab =
    terminalTabs.find((t) => t.id === activeTerminalTabId) || terminalTabs[0];
  const activePath = activeTab?.cwd || workspaceProjectRoot;
  const currentFolderName = activePath ? activePath.split('/').filter(Boolean).pop() || 'workspace' : 'workspace';

  // Auto-scroll when new logs arrive
  useEffect(() => {
    if (isTerminalOpen) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab?.logs, isTerminalOpen]);

  // Focus input when opened or active tab changes
  useEffect(() => {
    if (isTerminalOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isTerminalOpen, activeTerminalTabId]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cmd = inputCmd.trim();
    if (!cmd || isExecuting) return;

    if (cmd === '/skills') {
      setSkillsModalOpen(true);
      setInputCmd('');
      return;
    }

    setHistory((prev) => [cmd, ...prev]);
    setHistoryIndex(-1);
    setInputCmd('');
    setIsExecuting(true);

    try {
      await runTerminalCommand(cmd, activeTab.id);
    } finally {
      setIsExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInputCmd(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputCmd(history[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputCmd('');
      }
    }
  };

  if (!isTerminalOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 250, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 250, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
        className={`fixed bottom-0 left-0 right-0 z-40 bg-[#171717] border-t border-[#303030] flex flex-col font-mono ${
          isMaximized ? 'h-[80vh]' : 'h-80'
        }`}
      >
        {/* Header Bar */}
        <div className="h-10 bg-[#171717] border-b border-[#262626] px-3 flex items-center justify-between select-none shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-[#b4b4b4] font-sans font-semibold mr-2 border-r border-[#303030]">
              <TerminalIcon className="w-3.5 h-3.5 text-[#ececec]" />
              <span>Shell</span>
            </div>

            {terminalTabs.map((tab) => {
              const isActive = tab.id === activeTerminalTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTerminalTabId(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-[#2f2f2f] text-white border border-[#383838] font-medium'
                      : 'text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#212121]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ececec]" />
                  <span>{tab.title}</span>
                  {terminalTabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTerminalTab(tab.id);
                      }}
                      className="p-0.5 rounded hover:bg-[#383838] text-[#707070] hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              onClick={addTerminalTab}
              title="Buka Tab Terminal Baru"
              className="p-1 rounded-lg hover:bg-[#212121] text-[#b4b4b4] hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSkillsModalOpen(true)}
              title="Buka Skills Manager"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[#b4b4b4] hover:text-white hover:bg-[#212121] transition-colors"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline font-sans">Skills</span>
            </button>

            <button
              onClick={() => clearTerminalLogs(activeTab?.id)}
              title="Bersihkan Log"
              className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-white hover:bg-[#212121] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'Restore Ukuran' : 'Maksimalkan Terminal'}
              className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-white hover:bg-[#212121] transition-colors"
            >
              {isMaximized ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={() => setTerminalOpen(false)}
              title="Tutup Terminal [Ctrl+`]"
              className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-white hover:bg-[#212121] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Console Log Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 text-xs leading-relaxed select-text font-mono text-[#ececec] bg-[#171717]">
          {activeTab?.logs.map((log) => {
            if (log.type === 'stdin') {
              return (
                <div key={log.id} className="flex items-center gap-2 text-white">
                  <span className="text-[#ececec] font-bold">$</span>
                  <span className="font-semibold">{log.content}</span>
                  <span className="text-[10px] text-[#707070] ml-auto">
                    {log.timestamp}
                  </span>
                </div>
              );
            }
            if (log.type === 'stderr') {
              return (
                <pre
                  key={log.id}
                  className="text-red-400 bg-red-950/20 p-2.5 rounded-lg border border-red-900/30 whitespace-pre-wrap break-all"
                >
                  {log.content}
                </pre>
              );
            }
            if (log.type === 'system') {
              return (
                <div
                  key={log.id}
                  className="text-[#b4b4b4] bg-[#212121] p-2.5 rounded-lg border border-[#303030] whitespace-pre-wrap break-all"
                >
                  {log.content}
                </div>
              );
            }
            return (
              <pre
                key={log.id}
                className="text-[#ececec] whitespace-pre-wrap break-all font-mono"
              >
                {log.content}
              </pre>
            );
          })}

          {isExecuting && (
            <div className="flex items-center gap-2 text-amber-400 animate-pulse py-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Menjalankan perintah bash...</span>
            </div>
          )}

          <div ref={logsEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSubmit}
          className="h-11 bg-[#212121] border-t border-[#303030] px-3 flex items-center gap-2 shrink-0"
        >
          <div className="flex items-center gap-1.5 text-xs text-[#ececec] font-mono select-none">
            <span>agentic:~/{currentFolderName}</span>
            <span className="font-bold">$</span>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={inputCmd}
            onChange={(e) => setInputCmd(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            placeholder="Ketik perintah bash..."
            className="flex-1 bg-transparent text-xs text-[#ececec] font-mono outline-none placeholder-[#707070]"
          />

          <button
            type="submit"
            disabled={!inputCmd.trim() || isExecuting}
            className="p-1.5 rounded-lg bg-[#ececec] text-black hover:bg-white disabled:opacity-30 disabled:bg-[#404040] disabled:text-[#707070] transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </motion.div>
    </AnimatePresence>
  );
};

export default TerminalDrawer;
