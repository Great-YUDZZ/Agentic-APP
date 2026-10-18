import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  X,
  Search,
  Filter,
  FileText,
  Bot,
  User,
  ChevronDown,
  ChevronUp,
  Clock,
  RotateCw,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

export const VaultAuditModal: React.FC<{ isEmbedded?: boolean }> = ({ isEmbedded = false }) => {
  const {
    isVaultAuditModalOpen,
    setVaultAuditModalOpen,
    vaultAuditLog,
    fetchVaultAuditLog,
  } = useStore();

  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isVaultAuditModalOpen || isEmbedded) {
      loadLogs();
    }
  }, [isVaultAuditModalOpen, isEmbedded]);

  const loadLogs = async () => {
    setIsLoading(true);
    await fetchVaultAuditLog(150);
    setIsLoading(false);
  };

  if (!isVaultAuditModalOpen && !isEmbedded) return null;

  const filteredLogs = vaultAuditLog.filter((entry) => {
    const matchesAction =
      actionFilter === 'all' || entry.action.toLowerCase().includes(actionFilter.toLowerCase());
    const matchesQuery =
      searchQuery === '' ||
      entry.note_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.agent_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.diff_summary && entry.diff_summary.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesAction && matchesQuery;
  });

  const getActionBadge = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('create')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">CREATE</span>;
    }
    if (act.includes('edit')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30">EDIT</span>;
    }
    if (act.includes('delete')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-red-500/15 text-red-400 border border-red-500/30">DELETE</span>;
    }
    if (act.includes('restore')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">RESTORE</span>;
    }
    if (act.includes('auto_purge') || act.includes('purge')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">PURGE</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#303030] text-[#ececec]">{action.toUpperCase()}</span>;
  };

  const renderInnerContent = () => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 px-5 border-b border-[#262626] bg-[#171717] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#2f2f2f] border border-[#383838] flex items-center justify-center text-[#ececec]">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#ececec]">
              Jejak Audit Vault (.audit.jsonl)
            </h2>
            <p className="text-xs text-[#b4b4b4]">
              Riwayat append-only kronologis seluruh aksi baca, tulis, hapus, dan pemulihan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadLogs}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#262626] transition-colors"
            title="Segarkan Log"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {!isEmbedded && (
            <button
              onClick={() => setVaultAuditModalOpen(false)}
              className="p-1.5 rounded-lg text-[#707070] hover:text-[#ececec] hover:bg-[#262626] transition-colors"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-3 px-5 border-b border-[#262626] bg-[#171717] flex items-center justify-between gap-3 flex-wrap text-xs">
        {/* Search Input */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#262626] border border-[#383838] flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-[#707070]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul note, agen, atau aksi..."
            className="bg-transparent border-none text-xs text-[#ececec] placeholder-[#707070] focus:outline-none flex-1"
          />
        </div>

        {/* Action Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[#707070] flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          <div className="flex items-center gap-1 bg-[#262626] p-1 rounded-full border border-[#383838]">
            {['all', 'create', 'edit', 'delete', 'restore', 'purge'].map((act) => (
              <button
                key={act}
                type="button"
                onClick={() => setActionFilter(act)}
                className={`px-2.5 py-0.5 rounded-full text-xs capitalize transition-colors ${
                  actionFilter === act
                    ? 'bg-[#404040] text-[#ececec]'
                    : 'text-[#b4b4b4] hover:text-[#ececec]'
                }`}
              >
                {act === 'all' ? 'Semua' : act}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#212121]">
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#2f2f2f] border border-[#383838] mx-auto flex items-center justify-center text-[#707070]">
              <History className="w-6 h-6 text-[#707070]" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[#ececec]">Belum Ada Catatan Audit</h3>
              <p className="text-xs text-[#b4b4b4] mt-1 max-w-sm mx-auto">
                Aktivitas pengelolaan note oleh agen atau pengguna akan tercatat otomatis di sini.
              </p>
            </div>
          </div>
        ) : (
          filteredLogs.map((entry) => {
            const isExpanded = expandedEntryId === entry.id;
            const formattedTime = new Date(entry.timestamp * 1000).toLocaleString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div
                key={entry.id || `${entry.timestamp}-${entry.note_title}`}
                className="p-3.5 rounded-2xl bg-[#2f2f2f] border border-[#383838] space-y-2 text-xs transition-colors"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {getActionBadge(entry.action)}
                    <span className="font-semibold text-[#ececec] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#b4b4b4]" />
                      {entry.note_title}.md
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-[#707070] font-mono">
                    <span className="flex items-center gap-1">
                      {entry.agent_id === 'user' ? (
                        <User className="w-3 h-3 text-[#b4b4b4]" />
                      ) : (
                        <Bot className="w-3 h-3 text-[#b4b4b4]" />
                      )}
                      {entry.agent_id}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formattedTime}
                    </span>
                  </div>
                </div>

                {entry.diff_summary && (
                  <p className="text-[#b4b4b4] text-xs leading-relaxed">
                    {entry.diff_summary}
                  </p>
                )}

                {entry.previous_content && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                      className="flex items-center gap-1 text-[11px] text-[#707070] hover:text-[#ececec] transition-colors"
                    >
                      <span>{isExpanded ? 'Sembunyikan isi sebelumnya' : 'Lihat isi sebelum diubah'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 p-3 rounded-xl bg-[#212121] border border-[#383838] text-xs text-[#ececec] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                        {entry.previous_content}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );

  if (isEmbedded) {
    return (
      <div className="w-full h-full flex flex-col bg-[#212121] overflow-hidden">
        {renderInnerContent()}
      </div>
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-[#262626] border border-[#383838] shadow-2xl overflow-hidden"
        >
          {renderInnerContent()}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default VaultAuditModal;
