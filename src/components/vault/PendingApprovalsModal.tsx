import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  X,
  FileText,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  Ban,
  Clock,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

export const PendingApprovalsModal: React.FC<{ isEmbedded?: boolean }> = ({ isEmbedded = false }) => {
  const {
    isPendingApprovalsModalOpen,
    setPendingApprovalsModalOpen,
    pendingDeleteRequests,
    fetchPendingDeleteRequests,
    approveDeleteRequest,
    rejectDeleteRequest,
    batchApproveDeleteRequests,
    batchRejectDeleteRequests,
  } = useStore();

  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isPendingApprovalsModalOpen || isEmbedded) {
      fetchPendingDeleteRequests();
    }
  }, [isPendingApprovalsModalOpen, isEmbedded, fetchPendingDeleteRequests]);

  if (!isPendingApprovalsModalOpen && !isEmbedded) return null;

  const toggleExpand = (id: string) => {
    setExpandedRequestId(expandedRequestId === id ? null : id);
  };

  const handleApprove = async (id: string) => {
    setIsProcessing(true);
    await approveDeleteRequest(id);
    setIsProcessing(false);
  };

  const handleReject = async (id: string) => {
    setIsProcessing(true);
    await rejectDeleteRequest(id);
    setIsProcessing(false);
  };

  const handleBatchApprove = async () => {
    if (pendingDeleteRequests.length === 0) return;
    setIsProcessing(true);
    const ids = pendingDeleteRequests.map((r) => r.request_id);
    await batchApproveDeleteRequests(ids);
    setIsProcessing(false);
  };

  const handleBatchReject = async () => {
    if (pendingDeleteRequests.length === 0) return;
    setIsProcessing(true);
    const ids = pendingDeleteRequests.map((r) => r.request_id);
    await batchRejectDeleteRequests(ids);
    setIsProcessing(false);
  };

  const renderInnerContent = () => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 px-5 border-b border-[#262626] bg-[#171717] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#2f2f2f] border border-[#383838] flex items-center justify-center text-[#ececec]">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#ececec]">
              Persetujuan Hapus Note (Pending Approvals)
            </h2>
            <p className="text-xs text-[#b4b4b4]">
              Human-in-the-Loop: Tinjau dan konfirmasi permintaan hapus berkas dari AI agent
            </p>
          </div>
        </div>

        {!isEmbedded && (
          <button
            onClick={() => setPendingApprovalsModalOpen(false)}
            className="p-1.5 rounded-lg text-[#707070] hover:text-[#ececec] hover:bg-[#262626] transition-colors"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Action Subbar */}
      {pendingDeleteRequests.length > 0 && (
        <div className="flex items-center justify-between p-3 px-5 border-b border-[#262626] bg-[#171717] text-xs">
          <span className="text-[#b4b4b4] font-medium">
            {pendingDeleteRequests.length} permintaan menunggu tindakan Anda
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleBatchReject}
              className="px-3 py-1.5 rounded-xl bg-[#212121] hover:bg-[#262626] text-[#b4b4b4] hover:text-[#ececec] border border-[#383838] transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Tolak Semua</span>
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleBatchApprove}
              className="px-3 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-[#171717] transition-colors flex items-center gap-1.5 disabled:opacity-50 font-medium"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Setujui Semua (Pindah ke Trash)</span>
            </button>
          </div>
        </div>
      )}

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#212121]">
        {pendingDeleteRequests.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#2f2f2f] border border-[#383838] mx-auto flex items-center justify-center text-[#707070]">
              <Check className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[#ececec]">
                Tidak Ada Permintaan Hapus
              </h3>
              <p className="text-xs text-[#b4b4b4] mt-1 max-w-sm mx-auto">
                Semua berkas di vault berada dalam kondisi aman. Permintaan hapus dari agen akan muncul di sini.
              </p>
            </div>
          </div>
        ) : (
          pendingDeleteRequests.map((req) => {
            const isExpanded = expandedRequestId === req.request_id;
            const formattedTime = new Date(req.requested_at * 1000).toLocaleString('id-ID', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={req.request_id}
                className="p-4 rounded-2xl bg-[#2f2f2f] border border-[#383838] space-y-3 transition-colors"
              >
                {/* Header Item */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#262626] border border-[#383838] flex items-center justify-center text-[#ececec] shrink-0 mt-0.5">
                      <FileText className="w-4 h-4 text-[#ececec]" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#ececec] flex items-center gap-2">
                        <span>{req.note_title}.md</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#707070] mt-0.5 font-mono">
                        <span className="flex items-center gap-1">
                          <Bot className="w-3 h-3 text-[#b4b4b4]" />
                          {req.agent_id}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formattedTime}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleReject(req.request_id)}
                      className="px-3 py-1.5 rounded-xl bg-[#262626] hover:bg-[#383838] text-[#b4b4b4] hover:text-[#ececec] border border-[#383838] text-xs transition-colors"
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleApprove(req.request_id)}
                      className="px-3 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-[#171717] text-xs font-medium transition-colors"
                    >
                      Setujui Hapus
                    </button>
                  </div>
                </div>

                {/* Reason Box */}
                <div className="p-2.5 rounded-xl bg-[#262626] border border-[#383838] text-xs text-[#b4b4b4]">
                  <span className="font-medium text-[#ececec]">Alasan Agen: </span>
                  <span>&quot;{req.reason}&quot;</span>
                </div>

                {/* Preview Toggle */}
                {req.note_content_preview && (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleExpand(req.request_id)}
                      className="flex items-center gap-1 text-[11px] text-[#707070] hover:text-[#ececec] transition-colors"
                    >
                      <span>{isExpanded ? 'Sembunyikan pratinjau' : 'Lihat pratinjau isi note'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 p-3 rounded-xl bg-[#212121] border border-[#383838] text-xs text-[#ececec] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                        {req.note_content_preview}
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
          className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-[#262626] border border-[#383838] shadow-2xl overflow-hidden"
        >
          {renderInnerContent()}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PendingApprovalsModal;
