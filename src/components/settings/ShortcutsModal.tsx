import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Command, X, Search } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  id: string;
  category: 'Navigation' | 'Chat & Models' | 'Execution & Terminal';
  keys: string[];
  description: string;
}

const SHORTCUTS: ShortcutItem[] = [
  {
    id: 'new-chat',
    category: 'Chat & Models',
    keys: ['Ctrl', 'N'],
    description: 'New Chat',
  },
  {
    id: 'open-settings',
    category: 'Navigation',
    keys: ['Ctrl', ','],
    description: 'Open Settings',
  },
  {
    id: 'quick-open',
    category: 'Navigation',
    keys: ['Ctrl', 'P'],
    description: 'Quick Open File',
  },
  {
    id: 'focus-search',
    category: 'Chat & Models',
    keys: ['Ctrl', 'K'],
    description: 'Focus / Model Search',
  },
  {
    id: 'toggle-sidebar',
    category: 'Navigation',
    keys: ['Ctrl', 'B'],
    description: 'Toggle Sidebar',
  },
  {
    id: 'toggle-terminal',
    category: 'Execution & Terminal',
    keys: ['Ctrl', '`'],
    description: 'Toggle Terminal',
  },
  {
    id: 'emergency-stop',
    category: 'Execution & Terminal',
    keys: ['Ctrl', 'C'],
    description: 'Emergency Stop',
  },
  {
    id: 'slash-commands',
    category: 'Chat & Models',
    keys: ['/'],
    description: 'Slash Commands',
  },
  {
    id: 'toggle-canvas',
    category: 'Navigation',
    keys: ['Ctrl', 'E'],
    description: 'Toggle Sidecar Canvas',
  },
  {
    id: 'close-modal',
    category: 'Navigation',
    keys: ['Esc'],
    description: 'Close Active Modal',
  },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredShortcuts = SHORTCUTS.filter(
    (item) =>
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.keys.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories: Array<'Navigation' | 'Chat & Models' | 'Execution & Terminal'> = [
    'Navigation',
    'Chat & Models',
    'Execution & Terminal',
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="bg-[#171717] border border-[#303030] w-full max-w-xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#262626] flex items-center justify-between bg-[#171717]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#212121] border border-[#303030] text-[#ececec]">
                <Command className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#ececec]">Keyboard Shortcuts</h2>
                <p className="text-xs text-[#b4b4b4]">
                  Interactive cheatsheet for workspace navigation and commands.
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

          {/* Search Bar */}
          <div className="p-4 border-b border-[#262626] bg-[#1a1a1a]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search shortcuts..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#212121] border border-[#303030] text-xs text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#4a4a4a]"
              />
            </div>
          </div>

          {/* Shortcuts Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {categories.map((cat) => {
              const items = filteredShortcuts.filter((s) => s.category === cat);
              if (items.length === 0) return null;

              return (
                <div key={cat} className="space-y-2">
                  <h3 className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider px-1">
                    {cat}
                  </h3>
                  <div className="rounded-xl bg-[#212121] border border-[#303030] divide-y divide-[#2a2a2a] overflow-hidden">
                    {items.map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="px-4 py-2.5 flex items-center justify-between text-xs"
                      >
                        <span className="text-[#ececec] font-medium">
                          {shortcut.description}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {shortcut.keys.map((key, idx) => (
                            <React.Fragment key={idx}>
                              {idx > 0 && (
                                <span className="text-[10px] text-[#707070]">+</span>
                              )}
                              <kbd className="px-2 py-0.5 text-[11px] font-mono font-medium rounded-md bg-[#2a2a2a] border border-[#383838] text-[#ececec]">
                                {key}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {filteredShortcuts.length === 0 && (
              <div className="py-12 text-center text-xs text-[#707070]">
                No shortcuts matching &quot;{searchQuery}&quot;
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-[#262626] bg-[#171717] flex items-center justify-between">
            <span className="text-[11px] text-[#707070]">
              Press Esc anytime to dismiss this cheatsheet.
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-[#2f2f2f] hover:bg-[#383838] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
