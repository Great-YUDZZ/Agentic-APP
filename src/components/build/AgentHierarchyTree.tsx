import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { SubAgentState } from '../../types';

export const AgentHierarchyTree: React.FC = () => {
  const { subagents } = useStore();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>('agent-root');

  const rootAgent = subagents.find((a) => !a.parent_id);
  const childAgents = subagents.filter((a) => a.parent_id);

  const getStatusDot = (status: SubAgentState['status']) => {
    switch (status) {
      case 'ExecutingTool':
        return 'bg-[#ececec]';
      case 'Thinking':
        return 'bg-[#ececec] animate-pulse';
      case 'WaitingClearance':
        return 'bg-amber-400';
      case 'Completed':
        return 'bg-zinc-400';
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
        {rootAgent && (
          <div className="relative z-10 flex flex-col items-center">
            {(() => {
              const isSelected = selectedAgentId === rootAgent.id;

              return (
                <div
                  onClick={() => setSelectedAgentId(rootAgent.id)}
                  className={`w-80 p-5 rounded-2xl bg-[#2f2f2f] border transition-colors cursor-pointer ${
                    isSelected ? 'border-[#ececec]' : 'border-[#383838] hover:border-[#4a4a4a]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div>
                      <h4 className="text-sm font-semibold text-[#ececec]">{rootAgent.name}</h4>
                      <span className="text-[11px] text-[#b4b4b4]">{rootAgent.role}</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#212121] border border-[#303030] text-[10px] text-[#b4b4b4]">
                      <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(rootAgent.status)}`} />
                      <span>{rootAgent.status}</span>
                    </div>
                  </div>

                  <p className="text-xs text-[#b4b4b4] line-clamp-2 mb-3">
                    {rootAgent.current_step}
                  </p>

                  {/* Clean neutral progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-[#707070]">
                      <span>Progress</span>
                      <span>{rootAgent.progress}%</span>
                    </div>
                    <div className="w-full bg-[#212121] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#ececec] h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${rootAgent.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Vertical Connector */}
            <div className="w-px h-10 bg-[#383838]" />
          </div>
        )}

        {/* Horizontal Connector Bar */}
        <div className="w-3/4 max-w-2xl h-px bg-[#383838] mb-10 relative">
          <div className="absolute left-1/2 -top-1 w-2 h-2 rounded-full bg-[#ececec] -translate-x-1" />
        </div>

        {/* 2. Subagent Worker Cards */}
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
