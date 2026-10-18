import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2,
  X,
  RotateCcw,
  FileText,
  Clock,
  HardDrive,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

export const TrashFolderModal: React.FC<{ isEmbedded?: boolean }> = ({ isEmbedded = false }) => {
  const {
    isTrashModalOpen,
    setTrashModalOpen,
    trashNotes,
    fetchTrashNotes,
    restoreTrashNote,
    purgeTrashNote,
    settings,
  } = useStore();

  const [confirmPurgeTarget, setConfirmPurgeTarget] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isTrashModalOpen || isEmbedded) {
      fetchTrashNotes();
    }
  }, [isTrashModalOpen, isEmbedded, fetchTrashNotes]);

  if (!isTrashModalOpen && !isEmbedded) return null;

  const handleRestore = async (fileName: string) => {
    setIsProcessing(true);
    await restoreTrashNote(fileName);
    setIsProcessing(false);
  };

  const handlePurge = async (fileName: string) => {
    setIsProcessing(true);
    await purgeTrashNote(fileName);
    setConfirmPurgeTarget(null);
    setIsProcessing(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const renderInnerContent = () => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 px-5 border-b border-[#303030] bg-[#212121] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#ececec]">
              Tempat Sampah Vault (.trash/)
            </h2>
            <p className="text-xs text-[#b4b4b4]">
              Semua note yang disetujui untuk dihapus disimpan di sini dan dapat dipulihkan kapan saja
            </p>
          </div>
        </div>

        {!isEmbedded && (
          <button
            onClick={() => setTrashModalOpen(false)}
            className="p-1.5 rounded-lg text-[#707070] hover:text-[#ececec] hover:bg-[#2a2a2a] transition-colors"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Retention Notice Bar */}
          <div className="flex items-center justify-between p-3 px-5 border-b border-[#303030] bg-[#262626] text-xs">
            <span className="text-[#b4b4b4]">
              Total berkas: <strong className="text-[#ececec]">{trashNotes.length}</strong>
            </span>
            <span className="text-[11px] text-[#707070] font-mono">
              Kebijakan Auto-Purge: {settings.trashRetentionDays || 30} hari
            </span>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {trashNotes.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#212121] border border-[#303030] mx-auto flex items-center justify-center text-[#707070]">
                  <Trash2 className="w-6 h-6 text-[#707070]" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[#ececec]">Tempat Sampah Kosong</h3>
                  <p className="text-xs text-[#b4b4b4] mt-1 max-w-sm mx-auto">
                    Tidak ada berkas yang menunggu penghapusan di folder .trash/.
                  </p>
                </div>
              </div>
            ) : (
              trashNotes.map((item) => {
                const formattedTime = item.deleted_at
                  ? new Date(item.deleted_at * 1000).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Waktu tidak diketahui';

                const isConfirmingPurge = confirmPurgeTarget === item.file_name;

                return (
                  <div
                    key={item.file_name}
                    className="p-3 rounded-xl bg-[#212121] border border-[#383838] flex items-center justify-between gap-3 flex-wrap transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] border border-[#383838] flex items-center justify-center text-[#ececec] shrink-0">
                        <FileText className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#ececec] truncate">
                          {item.original_title}.md
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-[#707070] font-mono mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formattedTime}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            {formatFileSize(item.size_bytes)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isConfirmingPurge ? (
                        <div className="flex items-center gap-1.5 p-1 px-2 rounded-lg bg-red-500/15 border border-red-500/30 text-xs">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                          <span className="text-red-300">Yakin hapus permanen?</span>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handlePurge(item.file_name)}
                            className="px-2 py-0.5 rounded bg-red-500 hover:bg-red-600 text-white font-medium ml-1 transition-colors"
                          >
                            Ya
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmPurgeTarget(null)}
                            className="px-2 py-0.5 rounded bg-[#2a2a2a] text-[#ececec] hover:bg-[#333333] transition-colors"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleRestore(item.file_name)}
                            className="px-3 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#333333] text-[#ececec] border border-[#383838] text-xs transition-colors flex items-center gap-1.5"
                            title="Pulihkan note ke direktori vault utama"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Restore</span>
                          </button>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => setConfirmPurgeTarget(item.file_name)}
                            className="p-1.5 rounded-lg text-[#707070] hover:text-red-400 hover:bg-[#2a2a2a] transition-colors"
                            title="Hapus permanen dari disk"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
    </>
  );

  if (isEmbedded) {
    return (
      <div className="w-full h-full flex flex-col bg-[#171717] overflow-hidden">
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
          className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-[#262626] border border-[#383838] shadow-2xl overflow-hidden"
        >
          {renderInnerContent()}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TrashFolderModal;
