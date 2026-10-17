import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Plus, Trash2, X, ShieldCheck, ShieldAlert, ArrowLeftRight } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface NetworkAccessRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NetworkAccessRulesModal: React.FC<NetworkAccessRulesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings, updateSettings, addToast } = useStore();

  const [activeTab, setActiveTab] = useState<'whitelist' | 'blacklist'>('whitelist');
  const [newDomain, setNewDomain] = useState('');

  const networkRules = settings.networkRules || { whitelist: [], blacklist: [] };
  const whitelist = networkRules.whitelist || [];
  const blacklist = networkRules.blacklist || [];

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
    const cleanDomain = newDomain.trim().toLowerCase();

    if (!cleanDomain) {
      addToast('error', 'Domain pattern cannot be empty.');
      return;
    }

    if (whitelist.includes(cleanDomain) || blacklist.includes(cleanDomain)) {
      addToast('warning', `Rule for "${cleanDomain}" already exists.`);
      return;
    }

    if (activeTab === 'whitelist') {
      updateSettings({
        networkRules: {
          whitelist: [cleanDomain, ...whitelist],
          blacklist,
        },
      });
      addToast('success', `Added "${cleanDomain}" to whitelist`);
    } else {
      updateSettings({
        networkRules: {
          whitelist,
          blacklist: [cleanDomain, ...blacklist],
        },
      });
      addToast('success', `Added "${cleanDomain}" to blacklist`);
    }

    setNewDomain('');
  };

  const handleToggleRule = (domain: string, fromList: 'whitelist' | 'blacklist') => {
    if (fromList === 'whitelist') {
      updateSettings({
        networkRules: {
          whitelist: whitelist.filter((d) => d !== domain),
          blacklist: [domain, ...blacklist],
        },
      });
      addToast('info', `Moved "${domain}" to blacklist`);
    } else {
      updateSettings({
        networkRules: {
          whitelist: [domain, ...whitelist],
          blacklist: blacklist.filter((d) => d !== domain),
        },
      });
      addToast('info', `Moved "${domain}" to whitelist`);
    }
  };

  const handleRemoveRule = (domain: string, fromList: 'whitelist' | 'blacklist') => {
    if (fromList === 'whitelist') {
      updateSettings({
        networkRules: {
          whitelist: whitelist.filter((d) => d !== domain),
          blacklist,
        },
      });
    } else {
      updateSettings({
        networkRules: {
          whitelist,
          blacklist: blacklist.filter((d) => d !== domain),
        },
      });
    }
    addToast('info', `Removed "${domain}"`);
  };

  const currentList = activeTab === 'whitelist' ? whitelist : blacklist;

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
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#ececec]">Network Access Rules</h2>
                <p className="text-xs text-[#b4b4b4]">
                  Configure whitelist and blacklist domains for web network requests.
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

          {/* Tabs */}
          <div className="px-6 py-3 border-b border-[#262626] bg-[#1a1a1a] flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-[#212121] p-1 rounded-xl border border-[#303030]">
              <button
                type="button"
                onClick={() => setActiveTab('whitelist')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'whitelist'
                    ? 'bg-[#2f2f2f] text-[#ececec] border border-[#383838]'
                    : 'text-[#b4b4b4] hover:text-[#ececec]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Whitelist ({whitelist.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('blacklist')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'blacklist'
                    ? 'bg-[#2f2f2f] text-[#ececec] border border-[#383838]'
                    : 'text-[#b4b4b4] hover:text-[#ececec]'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Blacklist ({blacklist.length})</span>
              </button>
            </div>

            <span className="text-[11px] text-[#707070] font-mono">
              Supports wildcards (e.g. *.github.com)
            </span>
          </div>

          {/* Add Form */}
          <form onSubmit={handleAddRule} className="p-4 border-b border-[#262626] bg-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder={
                  activeTab === 'whitelist'
                    ? 'Allow domain (e.g. *.github.com or api.openai.com)'
                    : 'Block domain (e.g. *.doubleclick.net)'
                }
                className="flex-1 px-3 py-1.5 rounded-xl bg-[#212121] border border-[#303030] text-xs text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#4a4a4a]"
              />

              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl bg-[#2f2f2f] hover:bg-[#383838] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add to {activeTab === 'whitelist' ? 'Whitelist' : 'Blacklist'}</span>
              </button>
            </div>
          </form>

          {/* Rules List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {currentList.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#707070]">
                No domains configured in {activeTab}.
              </div>
            ) : (
              currentList.map((domain) => (
                <div
                  key={domain}
                  className="p-3 rounded-xl bg-[#212121] border border-[#303030] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`px-2 py-0.5 text-[10px] uppercase font-mono font-medium rounded-md border shrink-0 ${
                        activeTab === 'whitelist'
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                          : 'bg-rose-950/40 text-rose-400 border-rose-800/50'
                      }`}
                    >
                      {activeTab}
                    </span>
                    <span className="text-xs font-mono text-[#ececec] truncate">
                      {domain}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Toggle Button: Move to other list */}
                    <button
                      type="button"
                      onClick={() => handleToggleRule(domain, activeTab)}
                      className="px-2.5 py-1 rounded-lg bg-[#282828] hover:bg-[#333333] border border-[#383838] text-[11px] text-[#b4b4b4] hover:text-[#ececec] transition-colors flex items-center gap-1"
                      title={
                        activeTab === 'whitelist'
                          ? 'Move to Blacklist'
                          : 'Move to Whitelist'
                      }
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span>{activeTab === 'whitelist' ? 'To Blacklist' : 'To Whitelist'}</span>
                    </button>

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveRule(domain, activeTab)}
                      className="p-1.5 rounded-lg hover:bg-[#2a2a2a] text-[#707070] hover:text-rose-400 transition-colors"
                      title="Remove Domain"
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
              Network rules are applied before initiating outbound requests.
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
