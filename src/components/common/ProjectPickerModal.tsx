import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, Check, X, HardDrive, Compass, CornerDownRight } from 'lucide-react';
import { useStore } from '../../store/useStore';

const PRESET_PATHS = [
  { label: 'Current Working Workspace (SSD)', path: '/home/yudz/Agentic' },
  { label: 'External Backup Flashdisk', path: '/media/yudz/FLASHDISK/Agentic' },
  { label: 'Context Project Notes', path: '/home/yudz/Documents/context project/My Project/agentic app' },
  { label: 'Home Projects Directory', path: '/home/yudz/Projects' },
];

export const ProjectPickerModal: React.FC = () => {
  const {
    isProjectPickerOpen,
    setProjectPickerOpen,
    workspaceProjectRoot,
    setWorkspaceProjectRoot,
    addToast,
  } = useStore();

  const [inputPath, setInputPath] = useState(workspaceProjectRoot);

  if (!isProjectPickerOpen) return null;

  const handleSelectPreset = (path: string) => {
    setInputPath(path);
  };

  const handleConfirm = () => {
    if (!inputPath.trim()) {
      addToast('warning', 'Masukkan direktori proyek yang valid.');
      return;
    }
    setWorkspaceProjectRoot(inputPath.trim());
    setProjectPickerOpen(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-xl rounded-2xl bg-[#171717] border border-[#303030] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-4 px-5 border-b border-[#262626] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#212121] border border-[#303030] flex items-center justify-center text-[#ececec]">
                <Folder className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#ececec]">Pilih Direktori Proyek</h3>
                <p className="text-xs text-[#b4b4b4]">
                  Tentukan root workspace untuk pembacaan & penulisan kode oleh agent
                </p>
              </div>
            </div>
            <button
              onClick={() => setProjectPickerOpen(false)}
              className="p-1.5 rounded-lg hover:bg-[#212121] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Input Manual */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#ececec] flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[#b4b4b4]" />
                <span>Path Direktori Aktif:</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputPath}
                  onChange={(e) => setInputPath(e.target.value)}
                  placeholder="/home/username/my-project"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#212121] border border-[#303030] text-xs font-mono text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#404040]"
                />
              </div>
            </div>

            {/* Presets List */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-[#b4b4b4] uppercase tracking-wider">
                Direktori Cepat (Quick Access):
              </span>
              <div className="space-y-1.5">
                {PRESET_PATHS.map((preset) => {
                  const isCurrent = inputPath === preset.path;
                  return (
                    <button
                      key={preset.path}
                      onClick={() => handleSelectPreset(preset.path)}
                      className={`w-full text-left p-3 rounded-xl border text-xs flex items-center justify-between transition-colors ${
                        isCurrent
                          ? 'bg-[#212121] border-[#404040] text-white'
                          : 'bg-[#171717] hover:bg-[#212121] border-[#262626] text-[#b4b4b4] hover:text-[#ececec]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <HardDrive className="w-4 h-4 shrink-0 text-[#707070]" />
                        <div className="truncate">
                          <div className="font-medium text-[#ececec]">{preset.label}</div>
                          <div className="text-[11px] font-mono text-[#707070] truncate">
                            {preset.path}
                          </div>
                        </div>
                      </div>
                      {isCurrent && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 px-5 border-t border-[#262626] flex items-center justify-between bg-[#141414]">
            <div className="flex items-center gap-1.5 text-[11px] text-[#707070] font-mono">
              <CornerDownRight className="w-3.5 h-3.5" />
              <span>Workspace sandboxed confinement</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setProjectPickerOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-[#303030] hover:bg-[#212121] text-xs text-[#b4b4b4] transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-black text-xs font-semibold transition-colors"
              >
                Terapkan Direktori
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ProjectPickerModal;
