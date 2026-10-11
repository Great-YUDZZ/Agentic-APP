import React, { useEffect } from 'react';
import {
  Plus,
  Maximize2,
  Minimize2,
  X,
  Terminal as TerminalIcon,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { XtermView } from './XtermView';

export const TerminalPanel: React.FC = () => {
  const {
    isTerminalOpen,
    setTerminalOpen,
    terminalHeight,
    setTerminalHeight,
    terminalTabs,
    activeTerminalTabId,
    setActiveTerminalTabId,
    addTerminalTab,
    closeTerminalTab,
  } = useStore();

  const [isMaximized, setIsMaximized] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  const activeTab =
    terminalTabs.find((t) => t.id === activeTerminalTabId) || terminalTabs[0];

  // Handle Resize Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight >= 140 && newHeight <= window.innerHeight - 100) {
        setTerminalHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, setTerminalHeight]);

  if (!isTerminalOpen) return null;

  const currentHeight = isMaximized ? 'calc(100vh - 56px)' : `${terminalHeight}px`;

  return (
    <div
      style={{ height: currentHeight }}
      className="w-full bg-[#171717] border-t border-[#303030] flex flex-col shrink-0 select-none relative z-30 transition-none"
    >
      {/* Resize Drag Handle */}
      {!isMaximized && (
        <div
          onMouseDown={handleMouseDown}
          className="h-1.5 w-full bg-transparent hover:bg-emerald-500/50 cursor-row-resize absolute top-0 left-0 right-0 z-40 transition-colors"
          title="Tarik untuk mengubah ukuran terminal"
        />
      )}

      {/* Header Tab Bar */}
      <div className="h-9 bg-[#1d1d1d] border-b border-[#2d2d2d] px-3 flex items-center justify-between shrink-0">
        {/* Left Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {terminalTabs.map((tab) => {
            const isActive = tab.id === (activeTab?.id || terminalTabs[0].id);
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTerminalTabId(tab.id)}
                className={`group flex items-center gap-1.5 px-3 py-1 rounded-md text-xs cursor-pointer font-mono transition-colors ${
                  isActive
                    ? 'bg-[#2b2b2b] text-[#ececec] font-medium border border-[#3c3c3c]'
                    : 'text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#242424]'
                }`}
              >
                <TerminalIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px]">{tab.title}</span>
                {terminalTabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTerminalTab(tab.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#383838] rounded text-[#8e8e8e] hover:text-white transition-opacity ml-1"
                    title="Tutup Tab"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={addTerminalTab}
            title="Buka Terminal Baru"
            className="p-1 rounded-md hover:bg-[#2b2b2b] text-[#8e8e8e] hover:text-[#ececec] transition-colors ml-1"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore Ukuran' : 'Maksimalkan Terminal'}
            className="p-1.5 rounded-md text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2b2b2b] transition-colors"
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={() => setTerminalOpen(false)}
            title="Tutup Panel Terminal [Ctrl+`]"
            className="p-1.5 rounded-md text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2b2b2b] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Container Rendering XtermView per Tab */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden relative bg-[#141414]">
        {terminalTabs.map((tab) => (
          <XtermView
            key={tab.id}
            tabId={tab.id}
            isActive={tab.id === (activeTab?.id || terminalTabs[0].id)}
          />
        ))}
      </div>
    </div>
  );
};

export default TerminalPanel;
