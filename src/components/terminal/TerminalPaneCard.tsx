import React, { useState, useRef } from 'react';
import {
  Columns,
  Rows,
  Maximize2,
  Minimize2,
  Trash2,
  X,
  Plus,
  GripVertical,
} from 'lucide-react';
import { TerminalPaneNode } from '../../types';
import { useStore, countPanesInTilingTree } from '../../store/useStore';
import { XtermView } from './XtermView';
import { AgentQuickLauncherPopover } from './AgentQuickLauncherPopover';

interface TerminalPaneCardProps {
  pane: TerminalPaneNode;
}

export const TerminalPaneCard: React.FC<TerminalPaneCardProps> = ({ pane }) => {
  const {
    tilingLayout,
    terminalTabs,
    activeTerminalWorkers,
    maximizedPaneId,
    draggingItem,
    setDraggingItem,
    setDraggingPaneId,
    reparentPane,
    splitPane,
    splitPaneWithTab,
    moveTabToPane,
    moveTabInPane,
    closePane,
    toggleMaximizePane,
    setActiveTabInPane,
    closeTabInPane,
    terminateTerminalWorker,
  } = useStore();

  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [dropZone, setDropZone] = useState<'left' | 'right' | 'top' | 'bottom' | 'tab' | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const isMaximized = maximizedPaneId === pane.id;

  const totalPanes = countPanesInTilingTree(tilingLayout);
  const canDragSnap = totalPanes >= 2;

  const getWorkerForTab = (tabId: string) => {
    return activeTerminalWorkers.find((w) => w.tab_id === tabId);
  };

  const handleClearTerminal = async () => {
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('terminal_pty_write', {
          tabId: pane.activeTabId,
          data: 'clear\n',
        });
      } catch (err) {
        console.error('Failed to clear terminal:', err);
      }
    }
  };

  // Drag Source Handlers for Pane Header
  const handlePaneDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', pane.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingItem({
      type: 'pane',
      paneId: pane.id,
      title: 'Panel',
    });
  };

  // Drag Source Handlers for Individual Tab
  const handleTabDragStart = (e: React.DragEvent, tabId: string, title: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', tabId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingItem({
      type: 'tab',
      tabId,
      paneId: pane.id,
      title,
    });
  };

  const handleDragEnd = () => {
    setDraggingItem(null);
    setDraggingPaneId(null);
    setDropZone(null);
  };

  // Drop Target Handlers for Pane Body & Drag Shield
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!cardRef.current || !draggingItem) return;
    e.dataTransfer.dropEffect = 'move';

    // Jika drag tab dari pane ini sendiri dan hanya ada 1 tab, tidak bisa split dengan diri sendiri
    if (draggingItem.type === 'tab' && draggingItem.paneId === pane.id && pane.tabs.length <= 1) {
      setDropZone(null);
      return;
    }

    // Jika drag panel ke panel yang sama, abaikan
    if (draggingItem.type === 'pane' && draggingItem.paneId === pane.id) {
      setDropZone(null);
      return;
    }

    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (x > 0.65) {
      setDropZone('right');
    } else if (x < 0.35) {
      setDropZone('left');
    } else if (y > 0.65) {
      setDropZone('bottom');
    } else if (y < 0.35) {
      setDropZone('top');
    } else {
      // Area tengah: jika dari pane berbeda, gabung tab. Jika dari pane sama, tidak ada aksi tengah
      if (draggingItem.paneId !== pane.id) {
        setDropZone('tab');
      } else {
        setDropZone(null);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!cardRef.current?.contains(e.relatedTarget as Node)) {
      setDropZone(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggingItem || !dropZone) {
      setDropZone(null);
      setDraggingItem(null);
      return;
    }

    if (draggingItem.type === 'tab' && draggingItem.tabId) {
      if (dropZone === 'tab') {
        if (draggingItem.paneId !== pane.id) {
          moveTabToPane(draggingItem.paneId, pane.id, draggingItem.tabId);
        }
      } else {
        splitPaneWithTab(draggingItem.paneId, pane.id, draggingItem.tabId, dropZone);
      }
    } else if (draggingItem.type === 'pane') {
      if (draggingItem.paneId !== pane.id) {
        reparentPane(draggingItem.paneId, pane.id, dropZone);
      }
    }

    setDraggingItem(null);
    setDraggingPaneId(null);
    setDropZone(null);
  };

  // Tab Item Reorder Handlers
  const handleTabItemDragOver = (e: React.DragEvent) => {
    if (draggingItem?.type === 'tab') {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleTabItemDrop = (e: React.DragEvent, targetIndex: number) => {
    if (!draggingItem || draggingItem.type !== 'tab' || !draggingItem.tabId) return;
    e.preventDefault();
    e.stopPropagation();

    if (draggingItem.paneId === pane.id) {
      const fromIndex = pane.tabs.indexOf(draggingItem.tabId);
      if (fromIndex !== -1 && fromIndex !== targetIndex) {
        moveTabInPane(pane.id, fromIndex, targetIndex);
      }
    } else {
      moveTabToPane(draggingItem.paneId, pane.id, draggingItem.tabId, targetIndex);
    }

    setDraggingItem(null);
    setDraggingPaneId(null);
    setDropZone(null);
  };

  // Tentukan apakah transparent drag catcher aktif
  const isShieldActive =
    draggingItem !== null &&
    (draggingItem.paneId !== pane.id || (draggingItem.type === 'tab' && pane.tabs.length > 1));

  return (
    <div
      ref={cardRef}
      className="flex flex-col h-full w-full bg-[#171717] border border-[#2e2e2e] rounded-lg overflow-hidden relative shadow-sm"
    >
      {/* Pane Header */}
      <div
        draggable={canDragSnap}
        onDragStart={canDragSnap ? handlePaneDragStart : undefined}
        onDragEnd={canDragSnap ? handleDragEnd : undefined}
        className={`h-9 bg-[#1f1f1f] border-b border-[#2e2e2e] px-2 flex items-center justify-between flex-shrink-0 select-none ${
          canDragSnap ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        {/* Left Drag Handle + Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-[70%] scrollbar-none py-1">
          {canDragSnap && (
            <div
              className="p-1 rounded text-[#707070] hover:text-[#ececec] flex-shrink-0 mr-0.5"
              title="Tarik untuk memindahkan atau men-split posisi panel terminal"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>
          )}

          {pane.tabs.map((tabId, tabIndex) => {
            const tab = terminalTabs.find((t) => t.id === tabId);
            const worker = getWorkerForTab(tabId);
            const isActive = tabId === pane.activeTabId;
            const isTabBeingDragged = draggingItem?.type === 'tab' && draggingItem?.tabId === tabId;

            return (
              <div
                key={tabId}
                draggable={true}
                onDragStart={(e) => handleTabDragStart(e, tabId, tab?.title || 'Terminal')}
                onDragEnd={handleDragEnd}
                onDragOver={handleTabItemDragOver}
                onDrop={(e) => handleTabItemDrop(e, tabIndex)}
                onClick={() => setActiveTabInPane(pane.id, tabId)}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs cursor-grab active:cursor-grabbing border transition-all flex-shrink-0 select-none ${
                  isTabBeingDragged ? 'opacity-40 border-dashed border-blue-400' : ''
                } ${
                  isActive
                    ? 'bg-[#2a2a2a] border-[#404040] text-[#ececec]'
                    : 'bg-[#1b1b1b] border-transparent text-[#8e8e8e] hover:text-[#b4b4b4] hover:bg-[#222222]'
                }`}
                title="Klik untuk memilih. Tarik ke sisi layar untuk split panel baru (Orca style)"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    worker?.status === 'working'
                      ? 'bg-[#10a37f] animate-pulse'
                      : worker?.status === 'waiting_approval'
                      ? 'bg-[#f59e0b]'
                      : 'bg-[#707070]'
                  }`}
                />
                <span className="truncate max-w-[110px] font-medium">
                  {tab?.title || 'Terminal'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (worker) {
                      terminateTerminalWorker(worker.worker_id);
                    }
                    closeTabInPane(pane.id, tabId);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#383838] text-[#8e8e8e] hover:text-[#ececec] transition-opacity ml-0.5"
                  title="Tutup tab"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* '+' Button to open Quick Launcher Popover */}
          <div className="flex-shrink-0">
            <button
              ref={addBtnRef}
              onClick={() => setIsLauncherOpen(!isLauncherOpen)}
              className="p-1 rounded-md bg-[#252525] hover:bg-[#303030] text-[#8e8e8e] hover:text-[#ececec] border border-[#333333] transition-colors"
              title="Buka agen atau terminal baru"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {isLauncherOpen && (
              <AgentQuickLauncherPopover
                paneId={pane.id}
                triggerRect={addBtnRef.current?.getBoundingClientRect()}
                onClose={() => setIsLauncherOpen(false)}
              />
            )}
          </div>
        </div>

        {/* Pane Controls Right */}
        <div className="flex items-center gap-0.5 text-[#8e8e8e]">
          <button
            onClick={() => splitPane(pane.id, 'horizontal')}
            className="p-1 rounded hover:bg-[#2a2a2a] hover:text-[#ececec] transition-colors"
            title="Split Kanan (Horizontal)"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => splitPane(pane.id, 'vertical')}
            className="p-1 rounded hover:bg-[#2a2a2a] hover:text-[#ececec] transition-colors"
            title="Split Bawah (Vertikal)"
          >
            <Rows className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => toggleMaximizePane(pane.id)}
            className="p-1 rounded hover:bg-[#2a2a2a] hover:text-[#ececec] transition-colors"
            title={isMaximized ? 'Pulihkan Ukuran' : 'Fokus Layar Penuh'}
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5 text-[#10a37f]" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={handleClearTerminal}
            className="p-1 rounded hover:bg-[#2a2a2a] hover:text-[#ececec] transition-colors"
            title="Bersihkan Layar Terminal (clear)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => closePane(pane.id)}
            className="p-1 rounded hover:bg-[#3d2424] hover:text-[#ef4444] transition-colors ml-0.5"
            title="Tutup Panel Ini"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pane Terminal Canvas */}
      <div className="flex-1 min-h-0 relative bg-[#121212]">
        {pane.tabs.map((tabId) => (
          <XtermView
            key={tabId}
            tabId={tabId}
            isActive={tabId === pane.activeTabId}
          />
        ))}
      </div>

      {/* Transparent Drag-Over Event Shield across Xterm */}
      {isShieldActive && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="absolute inset-0 z-40 bg-transparent"
        />
      )}

      {/* Visual Drop Zone Previews (Orca Blue Style) */}
      {dropZone === 'right' && (
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[#3b82f6]/12 border-2 border-[#3b82f6] rounded-r-lg z-50 pointer-events-none flex flex-col justify-end p-3 animate-in fade-in duration-75">
          <div className="bg-[#0d1527]/95 border border-[#3b82f6]/60 text-[#60a5fa] text-[11px] font-medium px-2.5 py-1 rounded shadow-lg self-start flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] animate-pulse" />
            New split
          </div>
        </div>
      )}

      {dropZone === 'left' && (
        <div className="absolute top-0 left-0 w-1/2 h-full bg-[#3b82f6]/12 border-2 border-[#3b82f6] rounded-l-lg z-50 pointer-events-none flex flex-col justify-end p-3 animate-in fade-in duration-75">
          <div className="bg-[#0d1527]/95 border border-[#3b82f6]/60 text-[#60a5fa] text-[11px] font-medium px-2.5 py-1 rounded shadow-lg self-start flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] animate-pulse" />
            New split
          </div>
        </div>
      )}

      {dropZone === 'bottom' && (
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-[#3b82f6]/12 border-2 border-[#3b82f6] rounded-b-lg z-50 pointer-events-none flex flex-col justify-end p-3 animate-in fade-in duration-75">
          <div className="bg-[#0d1527]/95 border border-[#3b82f6]/60 text-[#60a5fa] text-[11px] font-medium px-2.5 py-1 rounded shadow-lg self-start flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] animate-pulse" />
            New split
          </div>
        </div>
      )}

      {dropZone === 'top' && (
        <div className="absolute top-0 left-0 w-full h-1/2 bg-[#3b82f6]/12 border-2 border-[#3b82f6] rounded-t-lg z-50 pointer-events-none flex flex-col justify-end p-3 animate-in fade-in duration-75">
          <div className="bg-[#0d1527]/95 border border-[#3b82f6]/60 text-[#60a5fa] text-[11px] font-medium px-2.5 py-1 rounded shadow-lg self-start flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] animate-pulse" />
            New split
          </div>
        </div>
      )}

      {dropZone === 'tab' && (
        <div className="absolute inset-1.5 bg-[#3b82f6]/10 border-2 border-dashed border-[#3b82f6]/70 rounded-lg z-50 pointer-events-none flex flex-col justify-end p-3 animate-in fade-in duration-75">
          <div className="bg-[#0d1527]/95 border border-[#3b82f6]/60 text-[#60a5fa] text-[11px] font-medium px-2.5 py-1 rounded shadow-lg self-start flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa]" />
            New tab
          </div>
        </div>
      )}
    </div>
  );
};
