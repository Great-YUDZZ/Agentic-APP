import React from 'react';
import { MultiAgentDiscussion } from './MultiAgentDiscussion';
import { AgentHierarchyTree } from './AgentHierarchyTree';
import { TaskKanban } from './TaskKanban';
import { DiffViewer } from './DiffViewer';
import { VisualGitManager } from './VisualGitManager';
import { StudioCodeEditor } from './StudioCodeEditor';
import { MultiTerminalPane } from '../terminal/MultiTerminalPane';
import { WorktreePanel } from './WorktreePanel';
import { AgentRosterModal } from './AgentRosterModal';
import { useStore } from '../../store/useStore';

export const BuildStudio: React.FC = () => {
  const { activeStudioTab } = useStore();

  return (
    <div key={activeStudioTab} className="flex-1 flex flex-col h-full bg-[#212121] overflow-hidden relative">
      {activeStudioTab === 'discussion' && <MultiAgentDiscussion />}
      {activeStudioTab === 'editor' && <StudioCodeEditor />}
      {activeStudioTab === 'hierarchy' && <AgentHierarchyTree />}
      {activeStudioTab === 'terminals' && <MultiTerminalPane />}
      {activeStudioTab === 'worktrees' && <WorktreePanel />}
      {activeStudioTab === 'kanban' && <TaskKanban />}
      {activeStudioTab === 'diff' && <DiffViewer />}
      {activeStudioTab === 'git' && <VisualGitManager />}
      <AgentRosterModal />
    </div>
  );
};

export default BuildStudio;
