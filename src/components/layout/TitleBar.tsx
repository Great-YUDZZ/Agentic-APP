import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Bot, Layers, Terminal } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { AppMode } from '../../types';

const MODES: { id: AppMode; label: string; icon: React.ElementType }[] = [
  { id: 'chatbot', label: 'Chat', icon: MessageSquare },
  { id: 'agent', label: 'Agent', icon: Bot },
  { id: 'build', label: 'Studio (Build)', icon: Layers },
];

export const TitleBar: React.FC = () => {
  const {
    currentMode,
    setMode,
    emergencyStopped,
    setEmergencyStopped,
    isTerminalOpen,
    setTerminalOpen,
    addToast,
    addLog,
  } = useStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
        triggerEmergencyStop();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setTerminalOpen(!isTerminalOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [emergencyStopped, isTerminalOpen]);

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

      {/* Center: Flat Segmented Capsule Pill Switcher (Exact 50% Horizontal Center) */}
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

      {/* Right: Terminal Panel Toggle Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTerminalOpen(!isTerminalOpen)}
          title={isTerminalOpen ? 'Tutup Terminal [Ctrl+`]' : 'Buka Terminal [Ctrl+`]'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-colors border ${
            isTerminalOpen
              ? 'bg-[#2b2b2b] text-emerald-400 border-emerald-500/40 shadow-sm'
              : 'bg-[#212121] text-[#8e8e8e] hover:text-[#ececec] border-[#303030] hover:bg-[#2b2b2b]'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Terminal</span>
        </button>
      </div>
    </header>
  );
};

export default TitleBar;
