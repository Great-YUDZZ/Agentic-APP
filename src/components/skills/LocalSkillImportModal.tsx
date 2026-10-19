import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderUp,
  X,
  Check,
  FolderGit2,
  HardDrive,
  FileCode,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DiscoveredSkill } from '../../types';

export const LocalSkillImportModal: React.FC = () => {
  const {
    isLocalSkillImportModalOpen,
    closeLocalSkillImport,
    localDiscoveredSkills,
    localImportSourcePath,
    confirmImportLocalSkills,
  } = useStore();

  const [targetLocation, setTargetLocation] = useState<'project' | 'global'>('project');
  const [skillsState, setSkillsState] = useState<DiscoveredSkill[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Sinkronkan state lokal saat modal dibuka dengan skills yang terdeteksi
  React.useEffect(() => {
    if (localDiscoveredSkills.length > 0) {
      setSkillsState(
        localDiscoveredSkills.map((s) => ({
          ...s,
          selected: true,
          custom_name: s.name,
        }))
      );
    }
  }, [localDiscoveredSkills]);

  if (!isLocalSkillImportModalOpen) return null;

  const handleToggleSelect = (index: number) => {
    setSkillsState((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleToggleSelectAll = () => {
    const allSelected = skillsState.every((s) => s.selected);
    setSkillsState((prev) =>
      prev.map((item) => ({ ...item, selected: !allSelected }))
    );
  };

  const handleNameChange = (index: number, newName: string) => {
    setSkillsState((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, custom_name: newName } : item
      )
    );
  };

  const selectedCount = skillsState.filter((s) => s.selected).length;

  const handleExecuteImport = async () => {
    const toImport = skillsState
      .filter((s) => s.selected)
      .map((s) => ({
        sourcePath: s.path,
        name: (s.custom_name || s.name).trim(),
        description: s.description,
      }));

    if (toImport.length === 0) return;

    try {
      setIsImporting(true);
      await confirmImportLocalSkills(toImport, targetLocation);
      closeLocalSkillImport();
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[2px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="bg-[#171717] border border-[#303030] w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh] shadow-2xl"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#262626] flex items-center justify-between bg-[#171717]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#212121] border border-[#303030] text-[#ececec]">
                <FolderUp className="w-4 h-4 text-[#ececec]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#ececec]">
                  Impor Skills dari Direktori Lokal
                </h2>
                <p className="text-xs text-[#b4b4b4]">
                  Pilih skill yang ingin disalin ke proyek atau direktori global
                </p>
              </div>
            </div>

            <button
              onClick={closeLocalSkillImport}
              className="p-1.5 rounded-xl hover:bg-[#212121] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
              title="Tutup dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Source Path & Target Selector Bar */}
          <div className="px-5 py-3 border-b border-[#262626] bg-[#1a1a1a] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0 max-w-md">
              <span className="text-[11px] text-[#707070] shrink-0 font-medium">Sumber:</span>
              <span
                className="font-mono text-[11px] text-[#b4b4b4] bg-[#212121] px-2 py-0.5 rounded border border-[#2e2e2e] truncate"
                title={localImportSourcePath}
              >
                {localImportSourcePath}
              </span>
            </div>

            {/* Target Location Toggle */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-[#707070]">Tujuan Simpan:</span>
              <div className="flex items-center bg-[#212121] rounded-lg p-0.5 border border-[#303030]">
                <button
                  type="button"
                  onClick={() => setTargetLocation('project')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                    targetLocation === 'project'
                      ? 'bg-[#2f2f2f] text-[#ececec] border border-[#383838]'
                      : 'text-[#707070] hover:text-[#ececec]'
                  }`}
                >
                  <FolderGit2 className="w-3 h-3 text-[#ececec]" />
                  <span>Project (skills/)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetLocation('global')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                    targetLocation === 'global'
                      ? 'bg-[#2f2f2f] text-[#ececec] border border-[#383838]'
                      : 'text-[#707070] hover:text-[#ececec]'
                  }`}
                >
                  <HardDrive className="w-3 h-3 text-[#ececec]" />
                  <span>Global (~/.agentic/)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Detected Skills Content List */}
          <div className="flex-1 overflow-y-auto p-5 bg-[#171717] space-y-4">
            {skillsState.length === 0 ? (
              <div className="text-center py-12 text-[#707070] space-y-2">
                <FileCode className="w-8 h-8 mx-auto opacity-40 text-[#b4b4b4]" />
                <p className="text-xs">Tidak ditemukan file SKILL.md di direktori yang dipilih.</p>
                <p className="text-[11px] text-[#555555]">
                  Pastikan folder yang dipilih berisi berkas SKILL.md atau subfolder skill yang valid.
                </p>
              </div>
            ) : (
              <>
                {/* Batch Header Toolbar if multiple skills */}
                {skillsState.length > 1 && (
                  <div className="flex items-center justify-between pb-2 border-b border-[#262626] text-xs">
                    <span className="text-[11px] text-[#b4b4b4] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>Terdeteksi {skillsState.length} skill dalam koleksi</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-[11px] text-[#ececec] hover:underline cursor-pointer"
                    >
                      {skillsState.every((s) => s.selected) ? 'Batal Pilih Semua' : 'Pilih Semua'}
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {skillsState.map((skill, idx) => (
                    <div
                      key={skill.path}
                      className={`p-3.5 rounded-xl border transition-colors ${
                        skill.selected
                          ? 'bg-[#212121] border-[#383838]'
                          : 'bg-[#1b1b1b] border-[#262626] opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(idx)}
                          className={`mt-1 w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                            skill.selected
                              ? 'bg-[#ececec] border-[#ececec] text-[#171717]'
                              : 'border-[#404040] hover:border-[#606060]'
                          }`}
                        >
                          {skill.selected && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>

                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Inline Rename Field */}
                          <div>
                            <label className="block text-[10px] uppercase font-mono text-[#707070] mb-0.5">
                              Nama Skill (Dapat Diubah)
                            </label>
                            <input
                              type="text"
                              value={skill.custom_name ?? skill.name}
                              onChange={(e) => handleNameChange(idx, e.target.value)}
                              disabled={!skill.selected}
                              placeholder="Ketik nama skill..."
                              className="w-full px-2.5 py-1 rounded-lg bg-[#171717] border border-[#303030] text-xs text-[#ececec] font-medium outline-none focus:border-[#4f4f4f] disabled:opacity-50"
                            />
                          </div>

                          {/* Description */}
                          <p className="text-[11px] text-[#b4b4b4] leading-relaxed line-clamp-2">
                            {skill.description}
                          </p>

                          {/* Source Path */}
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#707070] truncate">
                            <span className="shrink-0">Folder Asal:</span>
                            <span className="truncate">{skill.path}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3 border-t border-[#262626] bg-[#171717] flex items-center justify-between">
            <div className="text-xs text-[#b4b4b4]">
              {selectedCount > 0 ? (
                <span>
                  <strong className="text-[#ececec] font-semibold">{selectedCount}</strong> skill siap disalin
                </span>
              ) : (
                <span className="text-[#707070]">Pilih minimal 1 skill</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeLocalSkillImport}
                className="px-3 py-1.5 rounded-xl border border-[#303030] hover:bg-[#212121] text-xs text-[#b4b4b4] hover:text-[#ececec] transition-colors"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={selectedCount === 0 || isImporting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-black text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isImporting
                    ? 'Menyalin...'
                    : `Salin & Pasang (${selectedCount} Skill)`}
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
