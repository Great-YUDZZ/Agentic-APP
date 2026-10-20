import React, { useState, useEffect } from 'react';
import {
  Plus,
  Settings,
  Trash2,
  ChevronLeft,
  Search,
  BookOpen,
  ArrowLeft,
  Share2,
  History,
  ShieldAlert,
  Download,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { exportConversationSession } from '../../utils/exporter';
import { ChatSession } from '../../types';

export const Sidebar: React.FC = () => {
  const {
    currentMode,
    sessions,
    activeSessionId,
    selectSession,
    deleteSession,
    isSettingsOpen,
    setSettingsOpen,
    isSidebarOpen,
    setSidebarOpen,
    apiKeys,
    addToast,
    pendingDeleteRequests,
    fetchPendingDeleteRequests,
    trashNotes,
    fetchTrashNotes,
    isVaultPageOpen,
    setIsVaultPageOpen,
    activeVaultTab,
    setActiveVaultTab,
    messages,
  } = useStore();

  useEffect(() => {
    fetchPendingDeleteRequests();
    fetchTrashNotes();
  }, [fetchPendingDeleteRequests, fetchTrashNotes]);

  const [searchFilter, setSearchFilter] = useState('');

  const activeKeyCount = apiKeys.filter((k) => k.is_active && k.api_key.trim().length > 0).length;

  const vaultNavItems = [
    {
      id: 'graph' as const,
      label: 'Graph View',
      icon: Share2,
      subtitle: 'Grafik keterhubungan wikilink',
    },
    {
      id: 'audit' as const,
      label: 'Audit Trail',
      icon: History,
      subtitle: 'Riwayat mutasi berkas',
    },
    {
      id: 'trash' as const,
      label: 'Tempat Sampah',
      icon: Trash2,
      badge: trashNotes.length > 0 ? trashNotes.length : undefined,
      subtitle: 'Berkas .trash/',
    },
    {
      id: 'approvals' as const,
      label: 'Persetujuan Hapus',
      icon: ShieldAlert,
      badge: pendingDeleteRequests.length > 0 ? pendingDeleteRequests.length : undefined,
      subtitle: 'Permintaan agen',
    },
  ];

  // Filter sesi berdasarkan mode yang sedang aktif
  const modeSessions = sessions.filter((s) => (s.mode || 'chatbot') === currentMode);

  const filteredSessions = modeSessions.filter((s) =>
    s.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const getModeLabel = () => {
    switch (currentMode) {
      case 'chatbot':
        return { sectionTitle: 'Percakapan Chat', newBtn: 'Chat Baru', placeholder: 'Cari chat...' };
      case 'agent':
        return { sectionTitle: 'Task Agent', newBtn: 'Task Baru', placeholder: 'Cari sesi task...' };
      case 'build':
        return { sectionTitle: 'Proyek Studio', newBtn: 'Proyek Baru', placeholder: 'Cari proyek...' };
    }
  };

  const modeLabel = getModeLabel();

  const handleCreateNew = () => {
    setIsVaultPageOpen(false);
    useStore.setState({ activeSessionId: null, messages: [] });
    if (currentMode === 'build') {
      useStore.getState().resetBuildDiscussion();
    }
  };

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSession(id);
    addToast('info', 'Sesi dihapus');
  };

  const handleExportSession = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    exportConversationSession(session, messages);
    addToast('success', `Sesi "${session.title || 'chat'}" berhasil diekspor.`);
  };

  if (!isSidebarOpen) {
    return (
      <aside className="w-12 bg-[#171717] border-r border-[#262626] flex flex-col items-center py-3 justify-between shrink-0 select-none">
        <div className="flex flex-col items-center gap-2.5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-xl hover:bg-[#212121] transition-colors"
            title="Buka Sidebar"
          >
            <img src="/logo.png" alt="Hub Logo" className="w-6 h-6 rounded-md object-contain" />
          </button>

          {isVaultPageOpen ? (
            <>
              <button
                onClick={() => setIsVaultPageOpen(false)}
                className="p-2 rounded-xl bg-[#212121] hover:bg-[#282828] border border-[#303030] text-[#ececec] transition-colors"
                title="Kembali ke Chat / Workspace"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="w-6 h-px bg-[#262626] my-1" />

              {vaultNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeVaultTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveVaultTab(item.id)}
                    className={`relative p-2 rounded-xl transition-colors ${
                      isActive
                        ? 'bg-[#2f2f2f] text-[#ececec] border border-[#383838]'
                        : 'bg-[#212121] hover:bg-[#282828] border border-[#303030] text-[#b4b4b4] hover:text-[#ececec]'
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-4 h-4" />
                    {item.badge !== undefined && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#ececec] ring-2 ring-[#171717]" />
                    )}
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <button
                onClick={handleCreateNew}
                className="p-2 rounded-xl bg-[#212121] hover:bg-[#282828] border border-[#303030] text-[#ececec] transition-colors"
                title={modeLabel.newBtn}
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsVaultPageOpen(true)}
                className="relative p-2 rounded-xl bg-[#212121] hover:bg-[#282828] border border-[#303030] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
                title="Universal Context Vault"
              >
                <BookOpen className="w-4 h-4" />
                {pendingDeleteRequests.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#ececec] ring-2 ring-[#171717]" />
                )}
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-xl text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#212121] transition-colors"
          title="Pengaturan"
        >
          <Settings className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-[#171717] border-r border-[#262626] flex flex-col justify-between shrink-0 select-none">
      {isVaultPageOpen ? (
        <>
          {/* Header Vault & Back Button */}
          <div className="p-3 border-b border-[#262626] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#ececec]" />
                <span className="text-[11px] font-semibold text-[#ececec] tracking-wide uppercase">
                  Context Vault
                </span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#212121] transition-colors"
                title="Tutup Sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setIsVaultPageOpen(false)}
              className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-[#212121] hover:bg-[#282828] border border-[#303030] text-[#ececec] text-xs font-medium transition-colors"
              title="Kembali ke Mode Chat / Workspace"
            >
              <div className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Chat</span>
              </div>
              <span className="text-[10px] text-[#707070] font-mono">Esc</span>
            </button>
          </div>

          {/* Vault Vertical Menu */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="px-2 pt-1 pb-1">
              <span className="text-[10px] font-semibold text-[#707070] uppercase tracking-wider">
                Menu Vault
              </span>
            </div>

            {vaultNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeVaultTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveVaultTab(item.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors ${
                    isActive
                      ? 'bg-[#2f2f2f] text-[#ececec] font-medium border border-[#383838]'
                      : 'text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#212121]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#ececec]' : 'text-[#707070]'}`} />
                    <div className="text-left truncate">
                      <p className="truncate font-medium">{item.label}</p>
                      <p className="text-[10px] text-[#707070] truncate">{item.subtitle}</p>
                    </div>
                  </div>
                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#212121] border border-[#383838] text-[#ececec] shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Header, New Chat & Context Vault */}
          <div className="p-3 border-b border-[#262626] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Hub Logo" className="w-4 h-4 rounded-md object-contain" />
                <span className="text-[11px] font-semibold text-[#b4b4b4] tracking-wide uppercase">
                  {modeLabel.sectionTitle}
                </span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#212121] transition-colors"
                title="Tutup Sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleCreateNew}
              className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-[#212121] hover:bg-[#282828] border border-[#303030] text-[#ececec] text-xs font-medium transition-colors"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span>{modeLabel.newBtn}</span>
              </div>
              <span className="text-[10px] text-[#707070] font-mono">⌘N</span>
            </button>

            {/* Dedicated Context Vault Page Navigation Button */}
            <button
              type="button"
              onClick={() => setIsVaultPageOpen(true)}
              className="w-full flex items-center justify-between py-2 px-3 rounded-xl border border-[#303030] bg-[#212121] hover:bg-[#282828] text-[#b4b4b4] hover:text-[#ececec] text-xs font-medium transition-colors"
              title="Buka Halaman Khusus Universal Context Vault"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#707070]" />
                <span>Context Vault</span>
              </div>
              {pendingDeleteRequests.length > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#2f2f2f] border border-[#383838] text-[#ececec]">
                  {pendingDeleteRequests.length}
                </span>
              ) : (
                <span className="text-[10px] text-[#707070] font-mono">Vault</span>
              )}
            </button>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#707070] absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder={modeLabel.placeholder}
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#212121] border border-[#303030] text-xs text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#404040] transition-colors"
              />
            </div>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredSessions.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#707070]">Belum ada riwayat</div>
            ) : (
              filteredSessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <div
                    key={session.id}
                    onClick={() => {
                      setIsVaultPageOpen(false);
                      selectSession(session.id);
                    }}
                    className={`group flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#212121] text-[#ececec] font-medium border border-[#303030]'
                        : 'text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#212121]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isActive ? 'bg-[#ececec]' : 'bg-transparent'
                        }`}
                      />
                      <div className="truncate">
                        <p className="truncate">{session.title}</p>
                        <span className="text-[10px] text-[#707070]">
                          {session.model.replace('gemini-', '').replace('claude-', '')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity">
                      <button
                        onClick={(e) => handleExportSession(e, session)}
                        className="p-1 rounded-lg text-[#707070] hover:text-[#ececec] hover:bg-[#2a2a2a] transition-all"
                        title="Ekspor percakapan (.md)"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        className="p-1 rounded-lg text-[#707070] hover:text-[#ececec] hover:bg-[#2a2a2a] transition-all"
                        title="Hapus chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Footer Settings */}
      <div className="p-3 border-t border-[#262626] bg-[#171717]">
        <button
          onClick={() => setSettingsOpen(true)}
          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
            isSettingsOpen
              ? 'bg-[#212121] text-[#ececec] border border-[#303030]'
              : 'text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#212121]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <span>Setting</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#212121] border border-[#303030] text-[#ececec]">
            {activeKeyCount} Aktif
          </span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
