import React from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar } from './components/layout/Sidebar';
import { ChatContainer } from './components/chatbot/ChatContainer';
import { AgentWorkspace } from './components/agent/AgentWorkspace';
import { BuildStudio } from './components/build/BuildStudio';
import { SettingsModal } from './components/settings/SettingsModal';
import { TerminalPanel } from './components/terminal/TerminalPanel';
import { SkillsModal } from './components/skills/SkillsModal';
import { CodeReviewModal } from './components/build/CodeReviewModal';
import { ToastFeedback } from './components/common/ToastFeedback';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useStore } from './store/useStore';

export const App: React.FC = () => {
  const { currentMode, loadApiKeysFromDb, loadSessionsFromDb } = useStore();

  React.useEffect(() => {
    loadApiKeysFromDb();
    loadSessionsFromDb();
  }, [loadApiKeysFromDb, loadSessionsFromDb]);

  return (
    <ErrorBoundary fallbackTitle="Agentic Native Hub Workspace Error">
      <div className="h-screen w-screen flex bg-[#212121] text-[#ececec] font-sans overflow-hidden select-none">
        {/* Full-Height Modern Sidebar on the Left */}
        <Sidebar />

        {/* Central Workspace Column (TitleBar + Active Mode Canvas + Bottom Terminal) */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-[#212121]">
          {/* TitleBar with mode switchers, brand logo, & perfectly centered pill */}
          <TitleBar />

          <main className="flex-1 flex flex-col overflow-hidden relative bg-[#212121]">
            <ErrorBoundary fallbackTitle="Mode View Encountered an Error">
              {currentMode === 'chatbot' && <ChatContainer />}
              {currentMode === 'agent' && <AgentWorkspace />}
              {currentMode === 'build' && <BuildStudio />}
            </ErrorBoundary>
          </main>

          {/* Resizable Bottom Terminal Panel */}
          <TerminalPanel />
        </div>

        {/* Global Floating Modals */}
        <SkillsModal />
        <CodeReviewModal />
        <SettingsModal />
        <ToastFeedback />
      </div>
    </ErrorBoundary>
  );
};

export default App;
