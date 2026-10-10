import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useStore } from '../../store/useStore';

export const ToastFeedback: React.FC = () => {
  const { toasts, removeToast } = useStore();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border border-[#383838] bg-[#2f2f2f] text-[#ececec]"
          >
            <div className="mt-0.5">{getIcon(toast.type)}</div>
            <div className="flex-1 text-xs font-medium leading-relaxed break-words text-[#ececec]">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[#b4b4b4] hover:text-[#ececec] transition-colors shrink-0 p-0.5 rounded-lg hover:bg-[#383838]"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastFeedback;
