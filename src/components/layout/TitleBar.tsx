import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Bot,
  Layers,
  Terminal,
  Users,
  CheckSquare,
  FileDiff,
  ChevronDown,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { AppMode, StudioTab } from '../../types';

const MODES: { id: AppMode; label: string; icon: React.ElementType }[] = [
  { id: 'chatbot', label: 'Chat', icon: MessageSquare },
  { id: 'agent', label: 'Agent', icon: Bot },
  { id: 'build', label: 'Studio (Build)', icon: Layers },
];

const STUDIO_TABS: { id: StudioTab; label: string; icon: React.ElementType }[] = [
  { id: 'discussion', label: 'Diskusi', icon: Users },
  { id: 'hierarchy', label: 'Hierarki', icon: Layers },
  { id: 'kanban', label: 'Kanban', icon: CheckSquare },
  { id: 'diff', label: 'Diff', icon: FileDiff },
];

export const TitleBar: React.FC = () => {
  const {
    currentMode,
    setMode,
    emergencyStopped,
    setEmergencyStopped,
    isTerminalOpen,
    setTerminalOpen,
    activeStudioTab,
    setActiveStudioTab,
    addToast,
    addLog,
    pendingDeleteRequests,
    isVaultPageOpen,
    setIsVaultPageOpen,
    setActiveVaultTab,
  } = useStore();

  const [isStudioMenuOpen, setIsStudioMenuOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
        triggerEmergencyStop();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        // Mode chat tidak memiliki akses terminal
        if (currentMode !== 'chatbot') {
          setTerminalOpen(!isTerminalOpen);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [emergencyStopped, isTerminalOpen, currentMode]);

  const triggerEmergencyStop = () => {
    const nextState = !emergencyStopped;
    setEmergencyStopped(nextState);
    if (nextState) {
      addToast('error', 'Semua eksekusi dihentikan oleh operator.');
      addLog({
        id: `stop-${Date.now()}`,
        agent_name: 'System',
        level: 'FAIL',
        message: 'SIGINT: Operator menghentikan tugas yang sedang berjalan.',
        timestamp: new Date().toLocaleTimeString(),
      });
    } else {
      addToast('info', 'Sistem kembali aktif.');
      addLog({
        id: `resume-${Date.now()}`,
        agent_name: 'System',
        level: 'INFO',
        message: 'Melanjutkan loop eksekusi tugas.',
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  return (
    <header className="relative h-12 w-full bg-[#171717] border-b border-[#262626] px-4 flex items-center justify-between select-none z-30 shrink-0">
      {/* Left: Clean Brand Logo & App Title (No Traffic Lights) */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 text-xs font-semibold text-[#ececec] tracking-tight hover:opacity-90 transition-opacity">
          <img
            src="/logo.png"
            alt="Agentic Logo"
            className="w-5 h-5 rounded-md object-contain"
          />
          <span className="font-semibold tracking-tight">Agentic Native Hub</span>
        </div>
      </div>

      {/* Center: Flat Segmented Capsule Pill Switcher (Exact 50% Horizontal Center, hidden in Vault) */}
      {!isVaultPageOpen && (
        <div
          style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}
          className="flex items-center gap-1 bg-[#212121] p-1 rounded-full border border-[#303030] z-10"
        >
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const isActive = currentMode === mode.id;

            return (
              <button
                key={mode.id}
                onClick={() => setMode(mode.id)}
                className={`relative flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  isActive ? 'text-[#ececec]' : 'text-[#b4b4b4] hover:text-[#ececec]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeModeIndicator"
                    className="absolute inset-0 bg-[#2f2f2f] border border-[#383838] rounded-full -z-0"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">{mode.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Right Controls: Studio Tab Dropdown (in Build Mode) or Terminal Toggle (in Agent Mode) */}
      <div className="flex items-center gap-2">
        {!isVaultPageOpen && currentMode === 'build' ? (
          <div className="relative">
            <button
              onClick={() => setIsStudioMenuOpen(!isStudioMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#212121] hover:bg-[#282828] border border-[#303030] text-xs font-medium text-[#ececec] transition-colors"
              title="Pilih Tampilan Studio"
            >
              {(() => {
                const cur = STUDIO_TABS.find((t) => t.id === activeStudioTab) || STUDIO_TABS[0];
                const CurIcon = cur.icon;
                return (
                  <>
                    <CurIcon className="w-3.5 h-3.5 text-[#ececec]" />
                    <span>{cur.label}</span>
                    <ChevronDown className="w-3 h-3 text-[#707070] transition-transform" />
                  </>
                );
              })()}
            </button>

            {/* Dropdown Menu Popover */}
            {isStudioMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-2xl bg-[#262626] border border-[#383838] p-1.5 z-50 shadow-2xl space-y-1">
                {STUDIO_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isCur = activeStudioTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveStudioTab(tab.id);
                        setIsStudioMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        isCur
                          ? 'bg-[#2f2f2f] text-white border border-[#404040]'
                          : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-[#ececec]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </div>
                      {isCur && <Check className="w-3.5 h-3.5 text-[#ececec]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : !isVaultPageOpen && currentMode === 'agent' ? (
          <button
            onClick={() => setTerminalOpen(!isTerminalOpen)}
            title={isTerminalOpen ? 'Tutup Terminal [Ctrl+`]' : 'Buka Terminal [Ctrl+`]'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-colors border ${
              isTerminalOpen
                ? 'bg-[#2b2b2b] text-[#ececec] border-[#4f4f4f] shadow-sm'
                : 'bg-[#212121] text-[#8e8e8e] hover:text-[#ececec] border-[#303030] hover:bg-[#2b2b2b]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Terminal</span>
          </button>
        ) : null}

        {/* Global Vault Pending Approvals Button */}
        {pendingDeleteRequests.length > 0 && !isVaultPageOpen && (
          <button
            type="button"
            onClick={() => {
              setIsVaultPageOpen(true);
              setActiveVaultTab('approvals');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#212121] hover:bg-[#262626] border border-[#383838] text-[#ececec] text-xs font-medium transition-colors"
            title={`${pendingDeleteRequests.length} permintaan penghapusan note menunggu persetujuan Anda`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[#b4b4b4]" />
            <span className="hidden sm:inline">Approval</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#2f2f2f] border border-[#383838] text-[#ececec]">
              {pendingDeleteRequests.length}
            </span>
          </button>
        )}
      </div>
    </header>
  );
};

export default TitleBar;
