import React from 'react';
import {
  X,
  Radio,
  StopCircle,
  ExternalLink,
  Bot,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

export const TerminalInspectorPanel: React.FC = () => {
  const {
    activeTerminalWorkers,
    terminateTerminalWorker,
    hookCoords,
    setIsTerminalInspectorOpen,
    setActiveTerminalTabId,
  } = useStore();

  return (
    <div className="w-64 border-l border-[#2e2e2e] bg-[#1a1a1a] flex flex-col h-full flex-shrink-0 select-none">
      {/* Inspector Header */}
      <div className="h-10 px-3 border-b border-[#2e2e2e] flex items-center justify-between bg-[#1f1f1f]">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#10a37f]" />
          <span className="text-xs font-semibold text-[#ececec]">Agen & Sesi Aktif</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#2a2a2a] text-[#a0a0a0] border border-[#383838]">
            {activeTerminalWorkers.length}
          </span>
        </div>
        <button
          onClick={() => setIsTerminalInspectorOpen(false)}
          className="p-1 rounded hover:bg-[#2a2a2a] text-[#8e8e8e] hover:text-[#ececec] transition-colors"
          title="Tutup Panel Samping"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Workers List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {activeTerminalWorkers.length === 0 ? (
          <div className="p-4 text-center text-xs text-[#707070] rounded-lg border border-dashed border-[#333333] my-4">
            Belum ada agen CLI yang berjalan di panel terminal.
          </div>
        ) : (
          activeTerminalWorkers.map((worker) => (
            <div
              key={worker.worker_id}
              className="p-2.5 rounded-lg bg-[#222222] border border-[#333333] hover:border-[#404040] transition-colors space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      worker.status === 'working'
                        ? 'bg-[#10a37f] animate-pulse'
                        : worker.status === 'waiting_approval'
                        ? 'bg-[#f59e0b]'
                        : 'bg-[#707070]'
                    }`}
                  />
                  <span className="text-xs font-medium text-[#ececec] capitalize">
                    {worker.agent_id}
                  </span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e1e1e] text-[#a0a0a0] border border-[#2e2e2e]">
                  {worker.status}
                </span>
              </div>

              <div className="text-[10px] text-[#707070] font-mono truncate">
                Tab: {worker.tab_id}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[#2a2a2a]">
                <button
                  onClick={() => setActiveTerminalTabId(worker.tab_id)}
                  className="text-[11px] text-[#10a37f] hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Fokus Tab</span>
                </button>
                <button
                  onClick={() => terminateTerminalWorker(worker.worker_id)}
                  className="text-[11px] text-[#ef4444] hover:underline flex items-center gap-1"
                  title="Hentikan agen ini"
                >
                  <StopCircle className="w-3 h-3" />
                  <span>Hentikan</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Telemetry Status Footer */}
      <div className="p-2.5 border-t border-[#2e2e2e] bg-[#1d1d1d] text-[11px] text-[#8e8e8e] space-y-1">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[#b4b4b4]">
            <Radio className="w-3 h-3 text-[#10a37f]" />
            <span>Loopback Webhook</span>
          </span>
          <span className="text-[10px] text-[#10a37f] font-mono">
            {hookCoords ? `127.0.0.1:${hookCoords.port}` : 'Aktif'}
          </span>
        </div>
        <p className="text-[10px] text-[#666666] leading-tight">
          Menerima telemetri tool.call dan approval dari CLI secara otomatis.
        </p>
      </div>
    </div>
  );
};
