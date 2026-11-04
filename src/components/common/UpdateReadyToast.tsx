import React, { useState } from 'react';
import { DownloadCloud, ArrowRight, X, Loader2, CheckCircle2, RotateCw } from 'lucide-react';
import { downloadAndInstallConfirmedUpdate, applyUpdateAndRestart } from '../../utils/updater';

interface UpdateReadyToastProps {
  version: string;
  onDismiss: () => void;
}

export const UpdateReadyToast: React.FC<UpdateReadyToastProps> = ({ version, onDismiss }) => {
  const [status, setStatus] = useState<'available' | 'installing' | 'ready_to_restart' | 'error'>('available');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartUpdate = async () => {
    setStatus('installing');
    setErrorMessage(null);
    try {
      await downloadAndInstallConfirmedUpdate();
      setStatus('ready_to_restart');
    } catch (err: any) {
      console.warn('Gagal memasang pembaruan:', err);
      setStatus('error');
      setErrorMessage(
        err?.message?.includes('cancelled') || err?.message?.includes('cancel')
          ? 'Pemasangan dibatalkan oleh operator.'
          : 'Gagal memasang pembaruan atau otentikasi ditolak.'
      );
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3.5 bg-[#262626] border border-[#383838] px-4 py-3 rounded-2xl shadow-xl select-none max-w-md animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="w-9 h-9 rounded-xl bg-[#202020] border border-[#383838] flex items-center justify-center shrink-0">
        {status === 'installing' ? (
          <Loader2 className="w-4 h-4 text-[#ececec] animate-spin" />
        ) : status === 'ready_to_restart' ? (
          <CheckCircle2 className="w-4 h-4 text-[#ececec]" />
        ) : status === 'error' ? (
          <RotateCw className="w-4 h-4 text-[#b4b4b4]" />
        ) : (
          <DownloadCloud className="w-4 h-4 text-[#ececec]" />
        )}
      </div>

      <div className="flex flex-col pr-1 min-w-0">
        <span className="text-xs font-semibold text-[#ececec]">
          {status === 'installing'
            ? 'Memasang Pembaruan...'
            : status === 'ready_to_restart'
            ? 'Pembaruan Berhasil Dipasang'
            : status === 'error'
            ? 'Pembaruan Belum Selesai'
            : 'Pembaruan Tersedia'}
        </span>
        <span className="text-[11px] text-[#b4b4b4] truncate mt-0.5">
          {status === 'installing'
            ? 'Mengunduh paket dan memproses instalasi.'
            : status === 'ready_to_restart'
            ? `Versi v${version} siap digunakan.`
            : status === 'error'
            ? (errorMessage || 'Otentikasi ditolak atau koneksi terputus.')
            : `Versi rilis v${version} siap dipasang.`}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-1">
        {status === 'available' && (
          <button
            type="button"
            onClick={handleStartUpdate}
            className="h-8 px-3 rounded-full bg-[#ececec] text-[#171717] hover:bg-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Perbarui</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        {status === 'installing' && (
          <span className="text-[11px] text-[#707070] italic">
            Mohon tunggu...
          </span>
        )}

        {status === 'ready_to_restart' && (
          <button
            type="button"
            onClick={() => applyUpdateAndRestart()}
            className="h-8 px-3 rounded-full bg-[#ececec] text-[#171717] hover:bg-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Restart</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        {status === 'error' && (
          <button
            type="button"
            onClick={handleStartUpdate}
            className="h-8 px-3 rounded-full bg-[#333333] hover:bg-[#383838] text-[#ececec] border border-[#444444] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Coba Lagi</span>
          </button>
        )}

        <button
          type="button"
          onClick={onDismiss}
          disabled={status === 'installing'}
          className="h-8 w-8 rounded-full text-[#707070] hover:text-[#ececec] hover:bg-[#333333] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30"
          title="Tutup pemberitahuan"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
