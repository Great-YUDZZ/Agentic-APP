import React from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar } from './components/layout/Sidebar';
import { ChatContainer } from './components/chatbot/ChatContainer';
import { AgentWorkspace } from './components/agent/AgentWorkspace';
import { BuildStudio } from './components/build/BuildStudio';
import { SettingsModal } from './components/settings/SettingsModal';
import { TerminalPanel } from './components/terminal/TerminalPanel';
import { SkillsModal } from './components/skills/SkillsModal';
import { LocalSkillImportModal } from './components/skills/LocalSkillImportModal';
import { CodeReviewModal } from './components/build/CodeReviewModal';
import { PendingApprovalsModal } from './components/vault/PendingApprovalsModal';
import { TrashFolderModal } from './components/vault/TrashFolderModal';
import { VaultAuditModal } from './components/vault/VaultAuditModal';
import { GraphViewModal } from './components/vault/GraphViewModal';
import { ToastFeedback } from './components/common/ToastFeedback';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useStore } from './store/useStore';
import { applyTheme } from './utils/theme';

export const App: React.FC = () => {
  const {
    currentMode,
    settings,
    setSettingsOpen,
    toggleBuildSubMode,
    loadApiKeysFromDb,
    loadSessionsFromDb,
  } = useStore();

  React.useEffect(() => {
    applyTheme(settings.theme, settings.contrast, settings.darkPreset);
  }, [settings.theme, settings.contrast, settings.darkPreset]);

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }
      if (e.ctrlKey && e.key === 'Tab' && currentMode === 'build') {
        e.preventDefault();
        toggleBuildSubMode();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [setSettingsOpen, toggleBuildSubMode, currentMode]);

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

          {/* Resizable Bottom Terminal Panel (Disabled & Unmounted in Chatbot Mode) */}
          {currentMode !== 'chatbot' && <TerminalPanel />}
        </div>

        {/* Global Floating Modals */}
        <SkillsModal />
        <LocalSkillImportModal />
        <CodeReviewModal />
        <SettingsModal />
        <PendingApprovalsModal />
        <TrashFolderModal />
        <VaultAuditModal />
        <GraphViewModal />
        <ToastFeedback />
      </div>
    </ErrorBoundary>
  );
};

export default App;
