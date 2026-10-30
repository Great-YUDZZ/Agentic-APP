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
import { VaultWorkspace } from './components/vault/VaultWorkspace';
import { ToastFeedback } from './components/common/ToastFeedback';
import { UpdateReadyToast } from './components/common/UpdateReadyToast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { SidecarViewer } from './components/canvas/SidecarViewer';
import { QuickOpenModal } from './components/build/QuickOpenModal';
import { GlobalSearchModal } from './components/build/GlobalSearchModal';
import { useStore } from './store/useStore';
import { applyTheme } from './utils/theme';
import { checkAndDownloadUpdateSilently, type UpdateInfo } from './utils/updater';

export const App: React.FC = () => {
  const [availableUpdate, setAvailableUpdate] = React.useState<UpdateInfo | null>(null);
  const {
    currentMode,
    settings,
    setSettingsOpen,
    toggleBuildSubMode,
    loadApiKeysFromDb,
    loadSessionsFromDb,
    fetchMcpServers,
    fetchMcpTools,
    isVaultPageOpen,
    isSidecarOpen,
    toggleSidecar,
    setQuickOpenModalOpen,
    setGlobalSearchModalOpen,
    refreshWorktrees,
    initHookTelemetryListener,
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
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setQuickOpenModalOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setGlobalSearchModalOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        toggleSidecar();
      }
      if (e.ctrlKey && e.key === 'Tab' && currentMode === 'build') {
        e.preventDefault();
        toggleBuildSubMode();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [setSettingsOpen, toggleBuildSubMode, toggleSidecar, setQuickOpenModalOpen, setGlobalSearchModalOpen, currentMode]);

  React.useEffect(() => {
    loadApiKeysFromDb();
    loadSessionsFromDb();
    fetchMcpServers();
    fetchMcpTools();
    refreshWorktrees();
    initHookTelemetryListener();
    checkAndDownloadUpdateSilently((info) => {
      setAvailableUpdate(info);
    });
  }, [loadApiKeysFromDb, loadSessionsFromDb, fetchMcpServers, fetchMcpTools, refreshWorktrees, initHookTelemetryListener]);

  return (
    <ErrorBoundary fallbackTitle="Agentic Native Hub Workspace Error">
      <div className="h-screen w-screen flex bg-[#212121] text-[#ececec] font-sans overflow-hidden">
        {/* Full-Height Modern Sidebar on the Left */}
        <Sidebar />

        {/* Central Workspace Column (TitleBar + Active Mode Canvas + Bottom Terminal) */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-[#212121]">
          {/* TitleBar with mode switchers, brand logo, & perfectly centered pill */}
          <TitleBar />

          <main className="flex-1 flex flex-col overflow-hidden relative bg-[#212121]">
            <ErrorBoundary fallbackTitle="Mode View Encountered an Error">
              {isVaultPageOpen ? (
                <VaultWorkspace />
              ) : (
                <div className="flex-1 flex h-full overflow-hidden relative">
                  <div key={currentMode} className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
                    {currentMode === 'chatbot' && <ChatContainer />}
                    {currentMode === 'agent' && <AgentWorkspace />}
                    {currentMode === 'build' && <BuildStudio />}
                  </div>
                  {(currentMode === 'chatbot' || currentMode === 'agent') && isSidecarOpen && (
                    <SidecarViewer />
                  )}
                </div>
              )}
            </ErrorBoundary>
          </main>

          {/* Resizable Bottom Terminal Panel (Disabled & Unmounted in Chatbot Mode or Vault Page) */}
          {currentMode !== 'chatbot' && !isVaultPageOpen && <TerminalPanel />}
        </div>

        {/* Global Floating Modals */}
        <QuickOpenModal />
        <GlobalSearchModal />
        <SkillsModal />
        <LocalSkillImportModal />
        <CodeReviewModal />
        <SettingsModal />
        <PendingApprovalsModal />
        <TrashFolderModal />
        <VaultAuditModal />
        <GraphViewModal />
        <ToastFeedback />
        {availableUpdate && (
          <UpdateReadyToast
            version={availableUpdate.version}
            onDismiss={() => setAvailableUpdate(null)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
