import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCode,
  Wrench,
  Search,
  CheckCircle,
  Terminal,
  Sparkles,
  Trash2,
  HelpCircle,
  LucideIcon,
} from 'lucide-react';

export interface SlashCommandItem {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  actionText?: string;
  type?: 'template' | 'action';
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: 'plan',
    name: '/plan',
    description: 'Buat rencana arsitektur langkah-demi-langkah & dekomposisi modul.',
    icon: FileCode,
    type: 'template',
    actionText: 'Tolong buatkan rencana arsitektur terstruktur (step-by-step implementation plan) untuk:',
  },
  {
    id: 'fix',
    name: '/fix',
    description: 'Investigasi & perbaiki bug/error dengan analisis root cause.',
    icon: Wrench,
    type: 'template',
    actionText: 'Tolong investigasi dan perbaiki error berikut, sertakan root cause analysis dan solusinya:',
  },
  {
    id: 'review',
    name: '/review',
    description: 'Audit keamanan, performa kode, dan prinsip anti-slop.',
    icon: Search,
    type: 'template',
    actionText: 'Tolong review kode berikut dengan fokus pada keamanan sandbox, performa memori, dan zero-slop architecture:',
  },
  {
    id: 'test',
    name: '/test',
    description: 'Rancang unit test komprehensif & boundary case test.',
    icon: CheckCircle,
    type: 'template',
    actionText: 'Tolong buatkan unit test lengkap (termasuk happy path, boundary state, dan error edge cases) untuk:',
  },
  {
    id: 'terminal',
    name: '/terminal',
    description: 'Buka drawer terminal interaktif bawaan aplikasi.',
    icon: Terminal,
    type: 'action',
  },
  {
    id: 'skills',
    name: '/skills',
    description: 'Buka pengelola skills agent & instalasi skill baru.',
    icon: Sparkles,
    type: 'action',
  },
  {
    id: 'clear',
    name: '/clear',
    description: 'Bersihkan riwayat percakapan saat ini.',
    icon: Trash2,
    type: 'action',
  },
  {
    id: 'help',
    name: '/help',
    description: 'Tampilkan panduan penggunaan perintah dan mode hub.',
    icon: HelpCircle,
    type: 'template',
    actionText: 'Tolong jelaskan fitur utama yang tersedia di Agentic Native Hub dan cara menggunakannya.',
  },
];

interface SlashCommandPopoverProps {
  filter: string;
  selectedIndex: number;
  onSelect: (command: SlashCommandItem) => void;
  onClose?: () => void;
}

export const SlashCommandPopover: React.FC<SlashCommandPopoverProps> = ({
  filter,
  selectedIndex,
  onSelect,
}) => {
  const query = filter.toLowerCase().replace(/^\//, '');

  const filtered = SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query)
  );

  if (filtered.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="absolute bottom-full left-0 mb-2 w-80 max-h-72 bg-[#262626] border border-[#383838] rounded-2xl p-1.5 overflow-y-auto z-50 select-none"
      >
        <div className="px-2.5 py-1.5 text-[11px] font-semibold text-[#b4b4b4] uppercase tracking-wider border-b border-[#303030] flex items-center justify-between">
          <span>Perintah Tersedia</span>
          <span className="text-[10px] font-normal text-[#707070]">Tab/Enter untuk pilih</span>
        </div>

        <div className="mt-1 space-y-0.5">
          {filtered.map((cmd, idx) => {
            const Icon = cmd.icon;
            const isSelected = idx === selectedIndex;

            return (
              <div
                key={cmd.id}
                onClick={() => onSelect(cmd)}
                className={`flex items-start gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#2f2f2f] text-white border border-[#404040]'
                    : 'text-[#b4b4b4] hover:bg-[#2a2a2a] hover:text-[#ececec]'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg mt-0.5 ${
                    isSelected ? 'bg-[#383838] text-white' : 'bg-[#212121] text-[#b4b4b4]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-[#ececec]">
                      {cmd.name}
                    </span>
                    {cmd.type === 'action' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#383838] text-[#ececec] font-mono">
                        Aksi
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#707070] line-clamp-1 mt-0.5">
                    {cmd.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SlashCommandPopover;
