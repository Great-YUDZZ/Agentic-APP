import React from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar } from './components/layout/Sidebar';
import { ChatContainer } from './components/chatbot/ChatContainer';
import { AgentWorkspace } from './components/agent/AgentWorkspace';
import { BuildStudio } from './components/build/BuildStudio';
import { SettingsModal } from './components/settings/SettingsModal';
import { TerminalDrawer } from './components/terminal/TerminalDrawer';
import { SkillsModal } from './components/skills/SkillsModal';
import { CodeReviewModal } from './components/build/CodeReviewModal';
import { ProjectPickerModal } from './components/common/ProjectPickerModal';
import { ToastFeedback } from './components/common/ToastFeedback';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useStore } from './store/useStore';

export const App: React.FC = () => {
  const { currentMode } = useStore();

  return (
    <ErrorBoundary fallbackTitle="Agentic Native Hub Workspace Error">
      <div className="h-screen w-screen flex flex-col bg-[#212121] text-[#ececec] font-sans overflow-hidden select-none">
        {/* TitleBar with mode switchers, model selector, terminal & emergency stop */}
        <TitleBar />

        {/* Central Workspace: Sidebar + Mode View */}
        <div className="flex-1 flex overflow-hidden relative">
          <Sidebar />

          <main className="flex-1 flex flex-col overflow-hidden relative bg-[#212121]">
            <ErrorBoundary fallbackTitle="Mode View Encountered an Error">
              {currentMode === 'chatbot' && <ChatContainer />}
              {currentMode === 'agent' && <AgentWorkspace />}
              {currentMode === 'build' && <BuildStudio />}
            </ErrorBoundary>
          </main>
        </div>

        {/* Global Drawers & Floating Elements */}
        <TerminalDrawer />
        <SkillsModal />
        <CodeReviewModal />
        <ProjectPickerModal />
        <SettingsModal />
        <ToastFeedback />
      </div>
    </ErrorBoundary>
  );
};

export default App;
