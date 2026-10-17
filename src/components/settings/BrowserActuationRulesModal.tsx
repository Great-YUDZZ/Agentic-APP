import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MousePointerClick, Plus, Trash2, X, CheckCircle2, Ban, ArrowLeftRight } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface BrowserActuationRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BrowserActuationRulesModal: React.FC<BrowserActuationRulesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings, updateSettings, addToast } = useStore();

  const [activeTab, setActiveTab] = useState<'allow' | 'block'>('allow');
  const [newPattern, setNewPattern] = useState('');

  const actuationRules = settings.actuationRules || { whitelist: [], blacklist: [] };
  const allowedList = actuationRules.whitelist || [];
  const blockedList = actuationRules.blacklist || [];

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPattern = newPattern.trim();

    if (!cleanPattern) {
      addToast('error', 'URL pattern cannot be empty.');
      return;
    }

    if (allowedList.includes(cleanPattern) || blockedList.includes(cleanPattern)) {
      addToast('warning', `Rule for "${cleanPattern}" already exists.`);
      return;
    }

    if (activeTab === 'allow') {
      updateSettings({
        actuationRules: {
          whitelist: [cleanPattern, ...allowedList],
          blacklist: blockedList,
        },
      });
      addToast('success', `Added allowed pattern: ${cleanPattern}`);
    } else {
      updateSettings({
        actuationRules: {
          whitelist: allowedList,
          blacklist: [cleanPattern, ...blockedList],
        },
      });
      addToast('success', `Added blocked pattern: ${cleanPattern}`);
    }

    setNewPattern('');
  };

  const handleToggleRule = (pattern: string, fromList: 'allow' | 'block') => {
    if (fromList === 'allow') {
      updateSettings({
        actuationRules: {
          whitelist: allowedList.filter((p) => p !== pattern),
          blacklist: [pattern, ...blockedList],
        },
      });
      addToast('info', `Moved "${pattern}" to blocked list`);
    } else {
      updateSettings({
        actuationRules: {
          whitelist: [pattern, ...allowedList],
          blacklist: blockedList.filter((p) => p !== pattern),
        },
      });
      addToast('info', `Moved "${pattern}" to allowed list`);
    }
  };

  const handleRemoveRule = (pattern: string, fromList: 'allow' | 'block') => {
    if (fromList === 'allow') {
      updateSettings({
        actuationRules: {
          whitelist: allowedList.filter((p) => p !== pattern),
          blacklist: blockedList,
        },
      });
    } else {
      updateSettings({
        actuationRules: {
          whitelist: allowedList,
          blacklist: blockedList.filter((p) => p !== pattern),
        },
      });
    }
    addToast('info', `Removed "${pattern}"`);
  };

  const currentList = activeTab === 'allow' ? allowedList : blockedList;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="bg-[#171717] border border-[#303030] w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#262626] flex items-center justify-between bg-[#171717]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#212121] border border-[#303030] text-[#ececec]">
                <MousePointerClick className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#ececec]">Browser Actuation Rules</h2>
                <p className="text-xs text-[#b4b4b4]">
                  Configure allowed and blocked URLs for automated browser interactions.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-[#212121] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Bar */}
          <div className="px-6 py-3 border-b border-[#262626] bg-[#1a1a1a] flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-[#212121] p-1 rounded-xl border border-[#303030]">
              <button
                type="button"
                onClick={() => setActiveTab('allow')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'allow'
                    ? 'bg-[#2f2f2f] text-[#ececec] border border-[#383838]'
                    : 'text-[#b4b4b4] hover:text-[#ececec]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Allowed ({allowedList.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('block')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'block'
                    ? 'bg-[#2f2f2f] text-[#ececec] border border-[#383838]'
                    : 'text-[#b4b4b4] hover:text-[#ececec]'
                }`}
              >
                <Ban className="w-3.5 h-3.5 text-rose-400" />
                <span>Blocked ({blockedList.length})</span>
              </button>
            </div>

            <span className="text-[11px] text-[#707070] font-mono">
              Pattern format (e.g. https://github.com/*)
            </span>
          </div>

          {/* Add Rule Form */}
          <form onSubmit={handleAddRule} className="p-4 border-b border-[#262626] bg-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                placeholder={
                  activeTab === 'allow'
                    ? 'Allowed URL (e.g. https://github.com/* or http://localhost:*)'
                    : 'Blocked URL (e.g. https://*.internal/*)'
                }
                className="flex-1 px-3 py-1.5 rounded-xl bg-[#212121] border border-[#303030] text-xs text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#4a4a4a]"
              />

              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl bg-[#2f2f2f] hover:bg-[#383838] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add to {activeTab === 'allow' ? 'Allowed' : 'Blocked'}</span>
              </button>
            </div>
          </form>

          {/* Rules List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {currentList.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#707070]">
                No URL patterns configured in {activeTab === 'allow' ? 'allowed' : 'blocked'} list.
              </div>
            ) : (
              currentList.map((pattern) => (
                <div
                  key={pattern}
                  className="p-3 rounded-xl bg-[#212121] border border-[#303030] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`px-2 py-0.5 text-[10px] uppercase font-mono font-medium rounded-md border shrink-0 ${
                        activeTab === 'allow'
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                          : 'bg-rose-950/40 text-rose-400 border-rose-800/50'
                      }`}
                    >
                      {activeTab}
                    </span>
                    <span className="text-xs font-mono text-[#ececec] truncate">
                      {pattern}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Toggle Button: Move to other list */}
                    <button
                      type="button"
                      onClick={() => handleToggleRule(pattern, activeTab)}
                      className="px-2.5 py-1 rounded-lg bg-[#282828] hover:bg-[#333333] border border-[#383838] text-[11px] text-[#b4b4b4] hover:text-[#ececec] transition-colors flex items-center gap-1"
                      title={
                        activeTab === 'allow'
                          ? 'Move to Blocked'
                          : 'Move to Allowed'
                      }
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span>{activeTab === 'allow' ? 'To Blocked' : 'To Allowed'}</span>
                    </button>

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveRule(pattern, activeTab)}
                      className="p-1.5 rounded-lg hover:bg-[#2a2a2a] text-[#707070] hover:text-rose-400 transition-colors"
                      title="Remove Pattern"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-[#262626] bg-[#171717] flex items-center justify-between">
            <span className="text-[11px] text-[#707070]">
              Actuation requests require approval if no explicit allow pattern matches.
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-[#2f2f2f] hover:bg-[#383838] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
