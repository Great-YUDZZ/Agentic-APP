import React, { useState } from 'react';
import {
  Plus,
  Settings,
  Trash2,
  ChevronLeft,
  Search,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

export const Sidebar: React.FC = () => {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createNewSession,
    deleteSession,
    isSettingsOpen,
    setSettingsOpen,
    isSidebarOpen,
    setSidebarOpen,
    apiKeys,
    addToast,
  } = useStore();

  const [searchFilter, setSearchFilter] = useState('');

  const activeKeyCount = apiKeys.filter((k) => k.is_active && k.api_key.trim().length > 0).length;

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSession(id);
    addToast('info', 'Percakapan dihapus');
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
          <button
            onClick={createNewSession}
            className="p-2 rounded-xl bg-[#212121] hover:bg-[#282828] border border-[#303030] text-[#ececec] transition-colors"
            title="Percakapan Baru"
          >
            <Plus className="w-4 h-4" />
          </button>
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
      {/* Header & New Chat */}
      <div className="p-3 border-b border-[#262626] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Hub Logo" className="w-4 h-4 rounded-md object-contain" />
            <span className="text-[11px] font-semibold text-[#b4b4b4] tracking-wide uppercase">
              Percakapan
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
          onClick={createNewSession}
          className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-[#212121] hover:bg-[#282828] border border-[#303030] text-[#ececec] text-xs font-medium transition-colors"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Chat Baru</span>
          </div>
          <span className="text-[10px] text-[#707070] font-mono">⌘N</span>
        </button>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#707070] absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Cari chat..."
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
                onClick={() => setActiveSessionId(session.id)}
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

                <button
                  onClick={(e) => handleDeleteSession(e, session.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-[#707070] hover:text-red-400 hover:bg-[#2a2a2a] transition-all shrink-0"
                  title="Hapus chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

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
            <span>Pengaturan API</span>
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
