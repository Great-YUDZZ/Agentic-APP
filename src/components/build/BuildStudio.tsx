import React from 'react';
import { MultiAgentDiscussion } from './MultiAgentDiscussion';
import { AgentHierarchyTree } from './AgentHierarchyTree';
import { TaskKanban } from './TaskKanban';
import { DiffViewer } from './DiffViewer';
import { VisualGitManager } from './VisualGitManager';
import { StudioCodeEditor } from './StudioCodeEditor';
import { useStore } from '../../store/useStore';

export const BuildStudio: React.FC = () => {
  const { activeStudioTab } = useStore();

  return (
    <div className="flex-1 flex flex-col h-full bg-[#212121] overflow-hidden relative">
      {activeStudioTab === 'discussion' && <MultiAgentDiscussion />}
      {activeStudioTab === 'editor' && <StudioCodeEditor />}
      {activeStudioTab === 'hierarchy' && <AgentHierarchyTree />}
      {activeStudioTab === 'kanban' && <TaskKanban />}
      {activeStudioTab === 'diff' && <DiffViewer />}
      {activeStudioTab === 'git' && <VisualGitManager />}
    </div>
  );
};

export default BuildStudio;
