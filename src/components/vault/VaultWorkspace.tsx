import React, { useEffect } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Share2,
  History,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { GraphViewModal } from './GraphViewModal';
import { VaultAuditModal } from './VaultAuditModal';
import { TrashFolderModal } from './TrashFolderModal';
import { PendingApprovalsModal } from './PendingApprovalsModal';

export const VaultWorkspace: React.FC = () => {
  const {
    setIsVaultPageOpen,
    activeVaultTab,
    setActiveVaultTab,
    pendingDeleteRequests,
    fetchPendingDeleteRequests,
    trashNotes,
    fetchTrashNotes,
    currentMode,
  } = useStore();

  useEffect(() => {
    fetchPendingDeleteRequests();
    fetchTrashNotes();
  }, [fetchPendingDeleteRequests, fetchTrashNotes]);

  const tabs: {
    id: 'graph' | 'audit' | 'trash' | 'approvals';
    label: string;
    icon: React.ElementType;
    badge?: number;
    badgeColor?: string;
  }[] = [
    { id: 'graph', label: 'Graph View', icon: Share2 },
    { id: 'audit', label: 'Audit Trail', icon: History },
    {
      id: 'trash',
      label: 'Trash (.trash)',
      icon: Trash2,
      badge: trashNotes.length > 0 ? trashNotes.length : undefined,
      badgeColor: 'bg-[#383838] text-[#b4b4b4]',
    },
    {
      id: 'approvals',
      label: 'Approvals',
      icon: ShieldAlert,
      badge: pendingDeleteRequests.length > 0 ? pendingDeleteRequests.length : undefined,
      badgeColor: 'bg-[#383838] text-[#ececec]',
    },
  ];

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#212121] overflow-hidden select-none">
      {/* Top Navigation Bar */}
      <header className="h-14 px-5 border-b border-[#262626] bg-[#171717] flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4 min-w-0">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => setIsVaultPageOpen(false)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#212121] hover:bg-[#262626] border border-[#303030] text-xs font-medium text-[#ececec] transition-colors shrink-0"
            title={`Kembali ke mode ${currentMode}`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Kembali</span>
          </button>

          <div className="h-5 w-px bg-[#262626] shrink-0" />

          {/* Vault Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#2f2f2f] border border-[#383838] flex items-center justify-center text-[#ececec] shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-semibold text-[#ececec] tracking-tight truncate">
                Universal Context Vault
              </h1>
              <p className="text-[10px] text-[#707070] truncate hidden md:block">
                Obsidian vault context, wikilink knowledge graph, jejak audit, dan persetujuan hapus note
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher Pills - ChatGPT Standard Segmented Pill */}
        <div className="flex items-center gap-1 bg-[#2f2f2f] p-1 rounded-full border border-[#383838] shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeVaultTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveVaultTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#404040] text-[#ececec]'
                    : 'text-[#b4b4b4] hover:text-[#ececec]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#ececec]' : 'text-[#707070]'}`} />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono leading-none ${
                      tab.badgeColor || 'bg-[#383838] text-[#ececec]'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Prominent Warning Alert Banner if Delete Requests Pending */}
      {pendingDeleteRequests.length > 0 && activeVaultTab !== 'approvals' && (
        <div className="bg-[#262626] border-b border-[#303030] px-5 py-2.5 flex items-center justify-between text-xs text-[#ececec] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldAlert className="w-4 h-4 text-[#b4b4b4] shrink-0" />
            <span className="truncate">
              Terdapat <strong className="text-[#ececec]">{pendingDeleteRequests.length} permintaan penghapusan note</strong> yang menunggu persetujuan Anda.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveVaultTab('approvals')}
            className="px-3 py-1 rounded-xl bg-[#2f2f2f] hover:bg-[#383838] border border-[#383838] text-[#ececec] font-medium text-xs transition-colors shrink-0 ml-3"
          >
            Tinjau Permintaan
          </button>
        </div>
      )}

      {/* Active Tab View */}
      <main className="flex-1 w-full h-full relative overflow-hidden bg-[#212121]">
        {activeVaultTab === 'graph' && <GraphViewModal isEmbedded />}
        {activeVaultTab === 'audit' && <VaultAuditModal isEmbedded />}
        {activeVaultTab === 'trash' && <TrashFolderModal isEmbedded />}
        {activeVaultTab === 'approvals' && <PendingApprovalsModal isEmbedded />}
      </main>
    </div>
  );
};

export default VaultWorkspace;
