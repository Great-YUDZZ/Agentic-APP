import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bot,
  Plus,
  FileCode,
  Terminal,
  Globe,
  Cpu,
  Check,
  Sparkles,
  ChevronDown,
  Network,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { CustomAgent } from '../../types';

interface AgentCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAgent?: CustomAgent | null;
}

const BUILTIN_SKILLS = [
  {
    id: 'orchestration',
    label: 'Multi-Agent Orchestration',
    description: 'Koordinasi terarah sub-agen, pemecahan DAG tugas, decision gates, dan loop pengawasan orkestrator.',
    icon: Network,
  },
  {
    id: 'file_system',
    label: 'File System Operations',
    description: 'Membaca, menulis, dan memodifikasi file di dalam workspace sandboxed.',
    icon: FileCode,
  },
  {
    id: 'terminal_runner',
    label: 'Terminal Command Runner',
    description: 'Mengeksekusi perintah CLI, build scripts, dan package managers.',
    icon: Terminal,
  },
  {
    id: 'web_fetcher',
    label: 'Web & API Fetcher',
    description: 'Mengunduh dokumentasi online, API schema, dan referensi eksternal.',
    icon: Globe,
  },
  {
    id: 'code_evaluator',
    label: 'Code Evaluator & AST',
    description: 'Menganalisis sintaks kode, linting, dan validasi algoritma.',
    icon: Cpu,
  },
];

const AVATAR_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

export const AgentCreatorModal: React.FC<AgentCreatorModalProps> = ({
  isOpen,
  onClose,
  editingAgent,
}) => {
  const { createCustomAgent, updateCustomAgent, installedSkills, availableModels, selectedModel, addToast } = useStore();

  const [name, setName] = useState(editingAgent?.name || '');
  const [role, setRole] = useState(editingAgent?.role || '');
  const [taskDescription, setTaskDescription] = useState(editingAgent?.task_description || '');
  const [systemInstructions, setSystemInstructions] = useState(editingAgent?.system_instructions || '');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(
    editingAgent?.skills || ['file_system', 'code_evaluator']
  );
  const [agentModel, setAgentModel] = useState<string>(editingAgent?.model || '');
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [avatarColor, setAvatarColor] = useState(editingAgent?.avatar_color || '#3b82f6');

  // Reset when opening/editing changes
  React.useEffect(() => {
    if (editingAgent) {
      setName(editingAgent.name);
      setRole(editingAgent.role);
      setTaskDescription(editingAgent.task_description);
      setSystemInstructions(editingAgent.system_instructions || '');
      setSelectedSkills(editingAgent.skills);
      setAgentModel(editingAgent.model || '');
      setAvatarColor(editingAgent.avatar_color);
    } else {
      setName('');
      setRole('');
      setTaskDescription('');
      setSystemInstructions('');
      setSelectedSkills(['file_system', 'code_evaluator']);
      setAgentModel('');
      setAvatarColor('#3b82f6');
    }
  }, [editingAgent, isOpen]);

  if (!isOpen) return null;

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId) ? prev.filter((s) => s !== skillId) : [...prev, skillId]
    );
  };

  const handleAddCustomSkill = () => {
    const trimmed = customSkillInput.trim();
    if (trimmed && !selectedSkills.includes(trimmed)) {
      setSelectedSkills((prev) => [...prev, trimmed]);
      setCustomSkillInput('');
    }
  };

  const handleRemoveSkill = (skillName: string) => {
    setSelectedSkills((prev) => prev.filter((s) => s !== skillName));
  };

  const handleSave = () => {
    if (!name.trim()) {
      addToast('warning', 'Nama Agent wajib diisi!');
      return;
    }
    if (!taskDescription.trim()) {
      addToast('warning', 'Deskripsi tugas utama Agent wajib diisi!');
      return;
    }

    if (editingAgent) {
      updateCustomAgent(editingAgent.id, {
        name: name.trim(),
        role: role.trim() || 'Specialist Agent',
        task_description: taskDescription.trim(),
        system_instructions: systemInstructions.trim(),
        skills: selectedSkills,
        model: agentModel || undefined,
        avatar_color: avatarColor,
      });
      addToast('success', `Agent "${name}" berhasil diperbarui.`);
    } else {
      createCustomAgent({
        name: name.trim(),
        role: role.trim() || 'Specialist Agent',
        task_description: taskDescription.trim(),
        system_instructions: systemInstructions.trim(),
        skills: selectedSkills,
        model: agentModel || undefined,
        avatar_color: avatarColor,
      });
    }

    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-xl max-h-[90vh] bg-[#171717] border border-[#303030] rounded-2xl flex flex-col overflow-hidden select-none"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#262626] flex items-center justify-between shrink-0 bg-[#171717]">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                style={{ backgroundColor: avatarColor }}
              >
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#ececec]">
                  {editingAgent ? 'Edit Konfigurasi Agent' : 'Buat Custom Agent Baru'}
                </h3>
                <p className="text-[11px] text-[#b4b4b4]">
                  Tentukan spesialisasi, tugas utama, dan kapabilitas tool yang dimiliki agent.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-[#212121] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#171717]">
            {/* 1. Basic Info & Avatar Color */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-[#b4b4b4]">Nama Agent *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="misal: Rust Sandbox Engineer"
                    className="w-full px-3 py-2 rounded-xl bg-[#212121] border border-[#303030] text-xs text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#404040]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#c4c4d4]">Warna Avatar</label>
                  <div className="flex items-center gap-1.5 pt-1">
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarColor(c)}
                        className={`w-6 h-6 rounded-lg transition-transform ${
                          avatarColor === c ? 'scale-110 ring-2 ring-white/50' : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#b4b4b4]">Peran / Jabatan Teknis</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="misal: Systems Architect, Security Reviewer, API Developer"
                  className="w-full px-3 py-2 rounded-xl bg-[#212121] border border-[#303030] text-xs text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#404040]"
                />
              </div>

              {/* Model AI Spesifik untuk Agent ini */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[#b4b4b4]">Model AI Khusus Agent</label>
                  <span className="text-[10px] text-[#707070]">
                    {agentModel ? 'Model Kustom' : 'Mengikuti Model Global'}
                  </span>
                </div>
                <div className="relative">
                  <select
                    value={agentModel}
                    onChange={(e) => setAgentModel(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 rounded-xl bg-[#212121] border border-[#303030] text-xs font-mono text-[#ececec] focus:outline-none focus:border-[#404040] cursor-pointer appearance-none"
                  >
                    <option value="" className="bg-[#212121] text-[#ececec]">
                      (Default: Mengikuti Model Global {selectedModel ? `[${selectedModel}]` : ''})
                    </option>
                    {availableModels.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#212121] text-[#ececec]">
                        {m.id}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#707070]">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-[10px] text-[#707070]">
                  {availableModels.length === 0
                    ? 'Belum ada model terdeteksi. Silakan atur API Key di menu Pengaturan.'
                    : 'Pilih model spesifik agar agent ini menggunakan kecerdasan buatan yang berbeda dari agent lain.'}
                </p>
              </div>

              {/* 2. Main Task Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#b4b4b4]">
                  Deskripsi Tugas Utama (Main Mission) *
                </label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={3}
                  placeholder="Jelaskan apa yang menjadi tanggung jawab utama agent ini saat dijalankan..."
                  className="w-full px-3 py-2 rounded-xl bg-[#212121] border border-[#303030] text-xs text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#404040] leading-relaxed resize-none"
                />
              </div>
            </div>

            {/* 3. Skills Checklist */}
            <div className="space-y-2.5 pt-2 border-t border-[#262626]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#ececec]">
                  Skills & Kapabilitas Tools
                </label>
                <span className="text-[11px] text-[#707070] font-mono">
                  {selectedSkills.length} dipilih
                </span>
              </div>

              {/* Built-in Skills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {BUILTIN_SKILLS.map((skill) => {
                  const Icon = skill.icon;
                  const isChecked = selectedSkills.includes(skill.id);

                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => toggleSkill(skill.id)}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-colors ${
                        isChecked
                          ? 'bg-[#2f2f2f] border-[#404040] text-white'
                          : 'bg-[#212121] border-[#303030] text-[#b4b4b4] hover:bg-[#262626]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border transition-colors ${
                          isChecked
                            ? 'bg-[#ececec] border-[#ececec] text-black'
                            : 'border-[#444455]'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[#ececec] flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-[#ececec]" />
                          <span>{skill.label}</span>
                        </div>
                        <p className="text-[10px] text-[#707070] mt-0.5 leading-normal">
                          {skill.description}
                        </p>
                      </div>
                    </button>
                  );
                })}

                {/* Installed Skills from Skills Hub */}
                {installedSkills.map((sk) => {
                  const isChecked = selectedSkills.includes(sk.name);
                  return (
                    <button
                      key={sk.id}
                      type="button"
                      onClick={() =>
                        setSelectedSkills((prev) =>
                          prev.includes(sk.name) ? prev.filter((s) => s !== sk.name) : [...prev, sk.name]
                        )
                      }
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-colors ${
                        isChecked
                          ? 'bg-[#2f2f2f] border-[#404040] text-white'
                          : 'bg-[#212121] border-[#303030] text-[#b4b4b4] hover:bg-[#262626]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border transition-colors ${
                          isChecked
                            ? 'bg-amber-400 border-amber-400 text-black'
                            : 'border-[#444455]'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[#ececec] flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span className="truncate">{sk.name}</span>
                          <span className="text-[9px] px-1 rounded bg-[#2f2f2f] text-[#ececec] font-mono">
                            {sk.location}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#707070] mt-0.5 line-clamp-1 leading-normal">
                          {sk.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Skills Tag Adder */}
              <div className="pt-2 space-y-2">
                <label className="text-[11px] font-medium text-[#b4b4b4]">
                  Keahlian Tambahan / Custom Skill
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customSkillInput}
                    onChange={(e) => setCustomSkillInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomSkill())}
                    placeholder="misal: Rust Tokio Concurrency, SQLite Optimizer, Docker"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-[#212121] border border-[#303030] text-xs text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#404040]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomSkill}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#212121] hover:bg-[#282828] border border-[#303030] text-xs text-[#ececec] font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>

                {/* Selected Custom Skill Badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedSkills
                    .filter((s) => !BUILTIN_SKILLS.some((b) => b.id === s))
                    .map((s) => (
                      <span
                        key={s}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#212121] border border-[#303030] text-xs font-mono text-[#ececec]"
                      >
                        <Sparkles className="w-3 h-3 text-[#ececec]" />
                        <span>{s}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(s)}
                          className="hover:text-red-400 ml-1 text-[#707070]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                </div>
              </div>
            </div>

            {/* 4. Additional System Instructions */}
            <div className="space-y-1.5 pt-2 border-t border-[#262626]">
              <label className="text-xs font-medium text-[#b4b4b4]">
                Instruksi Sistem Khusus (Optional System Prompt)
              </label>
              <textarea
                value={systemInstructions}
                onChange={(e) => setSystemInstructions(e.target.value)}
                rows={2}
                placeholder="Pedoman cara berpikir, format jawaban khusus, atau batasan kerja..."
                className="w-full px-3 py-2 rounded-xl bg-[#212121] border border-[#303030] text-xs text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#404040] leading-relaxed resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-3 border-t border-[#262626] bg-[#171717] flex items-center justify-end gap-2.5 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-[#303030] hover:bg-[#212121] text-xs text-[#b4b4b4] hover:text-[#ececec] transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-xs text-black font-medium transition-colors"
            >
              {editingAgent ? 'Simpan Perubahan' : 'Buat Agent'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AgentCreatorModal;
