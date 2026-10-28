import React from 'react';
import { RefreshCw, ArrowRight, X } from 'lucide-react';
import { applyUpdateAndRestart } from '../../utils/updater';

interface UpdateReadyToastProps {
  version: string;
  onDismiss: () => void;
}

export const UpdateReadyToast: React.FC<UpdateReadyToastProps> = ({ version, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-[#2f2f2f] border border-[#383838] px-4 py-3 rounded-2xl shadow-lg select-none">
      <div className="w-8 h-8 rounded-xl bg-[#262626] border border-[#383838] flex items-center justify-center shrink-0">
        <RefreshCw className="w-4 h-4 text-[#ececec] animate-spin" />
      </div>
      <div className="flex flex-col pr-1">
        <span className="text-xs font-medium text-[#ececec]">Pembaruan Siap Dipasang</span>
        <span className="text-[11px] text-[#b4b4b4]">Versi v{version} telah berhasil diunduh.</span>
      </div>
      <div className="flex items-center gap-2 ml-1">
        <button
          onClick={() => {
            applyUpdateAndRestart();
          }}
          className="h-8 px-3 rounded-full bg-[#ececec] text-[#171717] hover:bg-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>Restart</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDismiss}
          className="h-8 w-8 rounded-full text-[#707070] hover:text-[#ececec] hover:bg-[#383838] flex items-center justify-center transition-colors cursor-pointer"
          title="Tutup pemberitahuan"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
