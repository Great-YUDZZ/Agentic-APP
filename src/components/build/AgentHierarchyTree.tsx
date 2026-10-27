import React, { useState } from 'react';
import { Info, Terminal } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { SubAgentState, TerminalWorkerSession } from '../../types';

export const AgentHierarchyTree: React.FC = () => {
  const {
    subagents,
    orchestratorConfig,
    installedCliAgents,
    activeTerminalWorkers,
    setActiveStudioTab,
  } = useStore();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>('agent-root');

  const rootAgent = subagents.find((a) => !a.parent_id);
  const childAgents = subagents.filter((a) => a.parent_id);

  // Resolved orchestrator metadata
  const isTerminalOrchestrator = orchestratorConfig?.type === 'terminal';
  const matchedCliOrchestrator = isTerminalOrchestrator
    ? installedCliAgents.find((a) => a.id === orchestratorConfig?.agentId)
    : null;

  const rootTitle = isTerminalOrchestrator
    ? (matchedCliOrchestrator?.name || orchestratorConfig?.agentId || 'Terminal Orchestrator')
    : (rootAgent?.name || 'Lead Architect');

  const rootRole = isTerminalOrchestrator
    ? `Orchestrator Mandiri (CLI: ${matchedCliOrchestrator?.binary_name || 'Terminal'})`
    : (orchestratorConfig?.modelId ? `Lead Architect (${orchestratorConfig.modelId})` : (rootAgent?.role || 'Lead Architect'));

  const rootStep = isTerminalOrchestrator
    ? 'Memimpin orkestrasi dan dispatch task melalui Terminal PTY Bridge'
    : (rootAgent?.current_step || 'Mengoordinasikan dekomposisi task dan review kode');

  const getStatusDot = (status: SubAgentState['status'] | string) => {
    switch (status) {
      case 'ExecutingTool':
      case 'working':
        return 'bg-[#ececec] animate-pulse';
      case 'Thinking':
        return 'bg-[#ececec] animate-pulse';
      case 'WaitingClearance':
      case 'waiting_approval':
        return 'bg-amber-400';
      case 'Completed':
      case 'done':
        return 'bg-zinc-400';
      case 'error':
        return 'bg-red-400';
      default:
        return 'bg-zinc-600';
    }
  };

  const selectedAgent = subagents.find((a) => a.id === selectedAgentId);

  return (
    <div className="flex flex-col h-full bg-[#212121] p-6 overflow-y-auto select-none">
      {/* Visual Canvas Container */}
      <div className="flex-1 flex flex-col items-center justify-center py-6 relative max-w-5xl mx-auto w-full">
        {/* 1. Root Supervisor Node */}
        <div className="relative z-10 flex flex-col items-center">
          <div
            onClick={() => setSelectedAgentId(rootAgent?.id || 'agent-root')}
            className={`w-88 p-5 rounded-2xl bg-[#2f2f2f] border transition-colors cursor-pointer ${
              selectedAgentId === (rootAgent?.id || 'agent-root')
                ? 'border-[#ececec]'
                : 'border-[#383838] hover:border-[#4a4a4a]'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <h4 className="text-sm font-semibold text-[#ececec]">{rootTitle}</h4>
                <span className="text-[11px] text-[#b4b4b4]">{rootRole}</span>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#212121] border border-[#303030] text-[10px] text-[#b4b4b4]">
                <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(rootAgent?.status || 'Thinking')}`} />
                <span>{isTerminalOrchestrator ? 'Terminal Active' : (rootAgent?.status || 'Active')}</span>
              </div>
            </div>

            <p className="text-xs text-[#b4b4b4] line-clamp-2 mb-3">
              {rootStep}
            </p>

            {/* Clean neutral progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[#707070]">
                <span>Progress Orkestrasi</span>
                <span>{rootAgent?.progress ?? 100}%</span>
              </div>
              <div className="w-full bg-[#212121] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[#ececec] h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${rootAgent?.progress ?? 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Vertical Connector */}
          <div className="w-px h-10 bg-[#383838]" />
        </div>

        {/* Horizontal Connector Bar */}
        <div className="w-3/4 max-w-2xl h-px bg-[#383838] mb-10 relative">
          <div className="absolute left-1/2 -top-1 w-2 h-2 rounded-full bg-[#ececec] -translate-x-1" />
        </div>

        {/* 2. Subagent & Terminal Worker Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full relative z-10">
          {childAgents.map((agent) => {
            const isSelected = selectedAgentId === agent.id;

            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`p-5 rounded-2xl bg-[#2f2f2f] border transition-colors cursor-pointer ${
                  isSelected ? 'border-[#ececec]' : 'border-[#383838] hover:border-[#4a4a4a]'
                }`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div>
                    <h4 className="text-xs font-semibold text-[#ececec]">{agent.name}</h4>
                    <span className="text-[10px] text-[#b4b4b4]">{agent.role}</span>
                  </div>

                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#212121] border border-[#303030] text-[10px] text-[#b4b4b4]">
                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(agent.status)}`} />
                    <span>{agent.status}</span>
                  </div>
                </div>

                <p className="text-xs text-[#b4b4b4] line-clamp-2 h-8 mb-3">
                  {agent.current_step}
                </p>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-[#707070]">
                    <span>Progress</span>
                    <span>{agent.progress}%</span>
                  </div>
                  <div className="w-full bg-[#212121] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#ececec] h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${agent.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Active Terminal Worker Nodes */}
          {activeTerminalWorkers.map((worker: TerminalWorkerSession) => {
            const matchedCli = installedCliAgents.find((a) => a.id === worker.agent_id);
            return (
              <div
                key={worker.worker_id}
                className="p-5 rounded-2xl bg-[#2f2f2f] border border-[#383838] hover:border-[#4a4a4a] transition-colors"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div>
                    <h4 className="text-xs font-semibold text-[#ececec]">
                      {matchedCli?.name || worker.agent_id}
                    </h4>
                    <span className="text-[10px] text-[#b4b4b4]">{worker.role}</span>
                  </div>

                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#212121] border border-[#303030] text-[10px] text-[#b4b4b4]">
                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(worker.status)}`} />
                    <span className="capitalize">{worker.status}</span>
                  </div>
                </div>

                <p className="text-xs text-[#b4b4b4] line-clamp-2 h-8 mb-3">
                  {worker.task_spec || 'Terminal worker aktif siap menerima instruksi'}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-[#383838]">
                  <span className="text-[10px] font-mono text-[#707070]">ID: {worker.tab_id}</span>
                  <button
                    type="button"
                    onClick={() => setActiveStudioTab('terminals')}
                    className="flex items-center gap-1 text-[11px] text-[#ececec] hover:text-white px-2 py-1 rounded-md bg-[#212121] hover:bg-[#282828] border border-[#303030]"
                  >
                    <Terminal className="w-3 h-3 text-[#b4b4b4]" />
                    <span>Buka Terminal</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Agent Details Pill */}
      {selectedAgent && (
        <div className="mt-4 p-3.5 rounded-2xl bg-[#2f2f2f] border border-[#383838] flex items-center justify-between text-xs max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-[#b4b4b4] shrink-0" />
            <div>
              <span className="font-semibold text-[#ececec]">{selectedAgent.name}</span>
              <span className="text-[#b4b4b4] ml-2">({selectedAgent.role})</span>
              <span className="text-[#707070] ml-2">: {selectedAgent.current_step}</span>
            </div>
          </div>

          <div className="text-[11px] font-mono text-[#ececec] bg-[#212121] px-3 py-1 rounded-full border border-[#303030]">
            Load: {selectedAgent.progress}%
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentHierarchyTree;
