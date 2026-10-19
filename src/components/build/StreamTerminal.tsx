import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Trash2,
  Copy,
  Check,
  ArrowDown,
  Search,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { AgentLog } from '../../types';

export const StreamTerminal: React.FC = () => {
  const { logs, clearLogs, addToast } = useStore();
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | AgentLog['level']>('ALL');
  const [copied, setCopied] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = levelFilter === 'ALL' || log.level === levelFilter;
    const matchesSearch =
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.agent_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level}] [${l.agent_name}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    addToast('info', 'Logs copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const getBadgeStyle = (level: AgentLog['level']) => {
    switch (level) {
      case 'EXEC':
        return 'bg-[#282828] text-[#ececec] border-[#383838]';
      case 'WARN':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'FAIL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-[#282828] text-[#b4b4b4] border-[#383838]';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#171717] font-mono text-xs select-none">
      {/* Controls Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#171717] border-b border-[#262626] shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#ececec]" />
          <span className="font-medium text-[#ececec]">Live Stream</span>
          <span className="text-[10px] text-[#707070]">({filteredLogs.length})</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Level Filter Pills */}
          <div className="flex items-center gap-1 bg-[#212121] border border-[#303030] rounded-lg p-0.5 text-[10px]">
            {(['ALL', 'INFO', 'EXEC', 'WARN', 'FAIL'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  levelFilter === lvl
                    ? 'bg-[#2f2f2f] text-white font-medium border border-[#383838]'
                    : 'text-[#b4b4b4] hover:text-[#ececec]'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-3 h-3 text-[#707070] absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Cari log..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-28 focus:w-36 transition-all pl-7 pr-2.5 py-1 bg-[#212121] border border-[#303030] rounded-lg text-[11px] text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#404040]"
            />
          </div>

          {/* Auto Scroll */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded-lg border transition-colors ${
              autoScroll
                ? 'bg-[#26262e] border-[#3e3e4c] text-[#f4f4f7]'
                : 'bg-[#1c1c22] border-[#2c2c36] text-[#686877]'
            }`}
            title="Auto-scroll"
          >
            <ArrowDown className="w-3 h-3" />
          </button>

          {/* Copy */}
          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded-lg bg-[#1c1c22] hover:bg-[#26262e] border border-[#2c2c36] text-[#9494a3] hover:text-[#f4f4f7] transition-colors"
            title="Copy logs"
          >
            {copied ? <Check className="w-3 h-3 text-[#ececec]" /> : <Copy className="w-3 h-3" />}
          </button>

          {/* Clear */}
          <button
            onClick={clearLogs}
            className="p-1.5 rounded-lg bg-[#1c1c22] hover:bg-[#26262e] border border-[#2c2c36] text-[#9494a3] hover:text-red-400 transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Logs Output */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 text-[#f4f4f7]">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#686877] italic">
            No log events to display
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2.5 py-0.5 px-2 rounded-lg hover:bg-[#18181d] transition-colors"
            >
              <span className="text-[#686877] shrink-0 text-[11px]">{log.timestamp}</span>

              <span
                className={`text-[9px] px-1.5 py-0.2 rounded border font-medium shrink-0 ${getBadgeStyle(
                  log.level
                )}`}
              >
                {log.level}
              </span>

              <span className="text-[#9494a3] font-medium shrink-0 text-[11px]">
                {log.agent_name}:
              </span>

              <span className="text-[#e2e2ea] break-all flex-1 text-[11px]">
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};

export default StreamTerminal;
