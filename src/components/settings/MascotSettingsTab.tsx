import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Sparkles,
  Film,
  Palette,
  Check,
  Zap,
} from 'lucide-react';
import { useStore, DEFAULT_MASCOTS } from '../../store/useStore';
import { AgentMascot } from '../mascot/AgentMascot';
import { CustomSelect, SelectOption } from '../common/CustomSelect';
import {
  MascotShape,
  MascotExpression,
  MascotAnimation,
  MascotEvent,
} from '../../types';

const AVAILABLE_SHAPES: MascotShape[] = [
  'circle',
  'squircle',
  'pebble',
  'capsule',
  'triangle',
  'hexagon',
  'cloud',
  'drop',
];

const PRESET_COLORS: string[] = [
  '#ececec',
  '#171717',
  '#262626',
  '#64748b',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f5f5f0',
];

const AVAILABLE_EXPRESSIONS: { id: MascotExpression; name: string }[] = [
  { id: 'neutral', name: 'Netral' },
  { id: 'attentive', name: 'Fokus' },
  { id: 'happy', name: 'Ceria' },
  { id: 'curious', name: 'Penasaran' },
  { id: 'proud', name: 'Percaya Diri' },
  { id: 'thinking', name: 'Berpikir' },
  { id: 'wink', name: 'Kedip' },
  { id: 'sleepy', name: 'Santai' },
  { id: 'angry', name: 'Tegas' },
];

interface GalleryAnimationItem {
  id: MascotAnimation;
  name: string;
  duration: string;
}

const GALLERY_ANIMATIONS: GalleryAnimationItem[] = [
  { id: 'idle', name: 'Idle', duration: '2.4s' },
  { id: 'thinking', name: 'Thinking', duration: '2.6s' },
  { id: 'wink', name: 'Wink', duration: '1.6s' },
  { id: 'wide', name: 'Wide Eyes', duration: '1.8s' },
  { id: 'alert', name: 'Alert', duration: '2.4s' },
  { id: 'notify', name: 'Notification', duration: '2.2s' },
  { id: 'exclaim', name: 'Exclamation', duration: '2.0s' },
  { id: 'sleep', name: 'Sleep', duration: '2.4s' },
  { id: 'play', name: 'Play', duration: '2.0s' },
  { id: 'orbit', name: 'Orbit', duration: '4.0s' },
];

const ANIMATION_OPTIONS: SelectOption[] = [
  { value: 'idle', label: 'Idle (Santai)' },
  { value: 'thinking', label: 'Thinking (Berpikir)' },
  { value: 'wink', label: 'Wink (Kedip Senyum)' },
  { value: 'wide', label: 'Wide Eyes (Terbelalak)' },
  { value: 'alert', label: 'Alert (Tanda Seru Galat)' },
  { value: 'notify', label: 'Notification (Badge Notif)' },
  { value: 'exclaim', label: 'Exclamation (Hentakan Antusias)' },
  { value: 'sleep', label: 'Sleep (Tidur / Tenang)' },
  { value: 'play', label: 'Play (Ceria / Gerak)' },
  { value: 'orbit', label: 'Orbit (Cincin Partikel)' },
];

export const MascotSettingsTab: React.FC = () => {
  const {
    settings,
    customAgents,
    updateAgentMascot,
    updateAgentMascotEvent,
    resetAgentMascot,
    addToast,
  } = useStore();

  const [selectedRole, setSelectedRole] = useState<string>('default');
  const [previewAnimation, setPreviewAnimation] = useState<MascotAnimation>('idle');
  const [activeSection, setActiveSection] = useState<'appearance' | 'animations'>('appearance');

  // Daftar opsi agen
  const agentOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = [
      { value: 'default', label: 'Chatbot Utama (Default)' },
      { value: 'agent', label: 'Single Agent (Mode Agent)' },
      { value: 'lead_architect', label: 'Lead Architect (Mode Studio)' },
      { value: 'coder', label: 'Coder Agent (Mode Studio)' },
      { value: 'reviewer', label: 'Reviewer Agent (Mode Studio)' },
      { value: 'tester', label: 'Tester Subagent (Mode Studio)' },
    ];
    if (customAgents && customAgents.length > 0) {
      customAgents.forEach((ca) => {
        list.push({ value: ca.id, label: `${ca.name} (${ca.role})` });
      });
    }
    return list;
  }, [customAgents]);

  const currentConfig = useMemo(() => {
    const mascots = settings.agentMascots || DEFAULT_MASCOTS;
    return mascots[selectedRole] || mascots['default'] || DEFAULT_MASCOTS.default;
  }, [settings.agentMascots, selectedRole]);

  const handleShapeSelect = (shape: MascotShape) => {
    updateAgentMascot(selectedRole, { shape });
  };

  const handleColorSelect = (color: string) => {
    updateAgentMascot(selectedRole, { color });
  };

  const handleExpressionSelect = (expression: MascotExpression) => {
    updateAgentMascot(selectedRole, { expression });
  };

  const handleEventChange = (eventKey: MascotEvent, anim: MascotAnimation) => {
    updateAgentMascotEvent(selectedRole, eventKey, anim);
    setPreviewAnimation(anim);
  };

  const handleReset = () => {
    resetAgentMascot(selectedRole);
    setPreviewAnimation('idle');
    addToast('info', 'Konfigurasi maskot peran ini dikembalikan ke default.');
  };

  return (
    <div className="space-y-6 select-none font-sans">
      {/* Header & Pemilih Peran Agen */}
      <div className="p-4 rounded-2xl bg-[#282828] border border-[#383838] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#ececec]" />
            <h3 className="text-sm font-semibold text-[#ececec]">Kustomisasi Maskot Agen</h3>
          </div>
          <p className="text-xs text-[#707070] mt-1">
            Personalisasi bentuk visual, ekspresi, dan reaksi animasi untuk setiap peran agen.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-[#b4b4b4]">Peran:</span>
          <CustomSelect
            value={selectedRole}
            options={agentOptions}
            onChange={(val) => {
              setSelectedRole(val);
              setPreviewAnimation('idle');
            }}
            className="w-56"
          />
        </div>
      </div>

      {/* Grid Utama: Preview Interaktif di Kiri, Pengaturan di Kanan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri: Live Preview & Galeri Tombol Animasi */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-[#282828] border border-[#383838] flex flex-col items-center">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#707070] mb-4">
            Live Interactive Preview
          </span>

          {/* Kanvas Lingkaran Preview */}
          <div className="w-40 h-40 rounded-full bg-[#1e1e1e] border border-[#333333] flex items-center justify-center relative shadow-inner overflow-hidden my-2">
            <AgentMascot
              config={currentConfig}
              animationOverride={previewAnimation}
              size={100}
              showBadge={true}
            />

            {/* Label Animasi Aktif */}
            <div className="absolute bottom-2.5 px-2.5 py-0.5 rounded-full bg-[#141414]/90 border border-[#383838] text-[10px] font-mono text-[#b4b4b4]">
              {previewAnimation}
            </div>
          </div>

          <div className="text-center mt-3">
            <h4 className="text-sm font-medium text-[#ececec]">
              {agentOptions.find((o) => o.value === selectedRole)?.label}
            </h4>
            <p className="text-[11px] text-[#707070] mt-0.5 font-mono">
              Bentuk: {currentConfig.shape} | Warna: {currentConfig.color}
            </p>
          </div>

          {/* Galeri Animasi bloub.vercel.app */}
          <div className="w-full mt-6 pt-5 border-t border-[#333333]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#ececec] flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-[#b4b4b4]" />
                Galeri Animasi (Klik untuk Uji)
              </span>
              <span className="text-[10px] text-[#707070]">10 variasi</span>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {GALLERY_ANIMATIONS.map((anim) => {
                const isActive = previewAnimation === anim.id;
                return (
                  <button
                    key={anim.id}
                    type="button"
                    onClick={() => setPreviewAnimation(anim.id)}
                    className={`px-3 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isActive
                        ? 'bg-[#383838] border-[#555555] text-[#ececec]'
                        : 'bg-[#212121] hover:bg-[#2e2e2e] border-[#303030] text-[#909090] hover:text-[#ececec]'
                    }`}
                  >
                    <span className="text-xs font-medium">{anim.name}</span>
                    <span className="text-[10px] font-mono text-[#666666]">{anim.duration}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Tab Penampilan & Pemetaan Event */}
        <div className="lg:col-span-7 space-y-5">
          {/* Sub-tab Switcher: Penampilan vs Animasi Event */}
          <div className="flex items-center justify-between p-1 bg-[#282828] rounded-xl border border-[#383838]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveSection('appearance')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeSection === 'appearance'
                    ? 'bg-[#383838] text-[#ececec]'
                    : 'text-[#909090] hover:text-[#ececec]'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Bentuk & Penampilan</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('animations')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeSection === 'animations'
                    ? 'bg-[#383838] text-[#ececec]'
                    : 'text-[#909090] hover:text-[#ececec]'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Pemetaan Event Reaktif</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#909090] hover:text-[#ececec] transition-colors rounded-lg hover:bg-[#333333]"
              title="Kembalikan maskot peran ini ke konfigurasi default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>
          </div>

          {/* Bagian 1: Penampilan (Bentuk, Warna, Mata) */}
          {activeSection === 'appearance' && (
            <div className="p-5 rounded-2xl bg-[#282828] border border-[#383838] space-y-6">
              {/* Pilihan Bentuk Tubuh (Shapes) */}
              <div>
                <label className="text-xs font-semibold text-[#ececec] block mb-2.5">
                  1. Bentuk Tubuh
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {AVAILABLE_SHAPES.map((shape) => {
                    const isSelected = currentConfig.shape === shape;
                    return (
                      <button
                        key={shape}
                        type="button"
                        onClick={() => handleShapeSelect(shape)}
                        className={`h-12 rounded-xl border transition-all flex items-center justify-center ${
                          isSelected
                            ? 'bg-[#383838] border-[#ececec]'
                            : 'bg-[#212121] hover:bg-[#2b2b2b] border-[#333333]'
                        }`}
                        title={shape}
                      >
                        <AgentMascot
                          config={{ ...currentConfig, shape, animate: false }}
                          size={28}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pilihan Warna Tubuh (Colors) */}
              <div>
                <label className="text-xs font-semibold text-[#ececec] block mb-2.5">
                  2. Palet Warna
                </label>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {PRESET_COLORS.map((colHex) => {
                    const isSelected = currentConfig.color.toLowerCase() === colHex.toLowerCase();
                    return (
                      <button
                        key={colHex}
                        type="button"
                        onClick={() => handleColorSelect(colHex)}
                        className={`w-8 h-8 rounded-full border transition-all flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-[#ececec] ring-2 ring-[#ececec]/30 scale-105'
                            : 'border-[#333333] hover:scale-105'
                        }`}
                        style={{ backgroundColor: colHex }}
                        title={colHex}
                      >
                        {isSelected && (
                          <Check
                            className="w-4 h-4"
                            style={{ color: colHex === '#ececec' || colHex === '#f5f5f0' ? '#171717' : '#ffffff' }}
                          />
                        )}
                      </button>
                    );
                  })}

                  <label
                    className="w-8 h-8 rounded-full border border-dashed border-[#555555] hover:border-[#ececec] flex items-center justify-center cursor-pointer transition-colors relative shrink-0 bg-[#212121]"
                    title="Pilih warna kustom"
                  >
                    <Palette className="w-3.5 h-3.5 text-[#b4b4b4]" />
                    <input
                      type="color"
                      value={currentConfig.color}
                      onChange={(e) => handleColorSelect(e.target.value)}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Pilihan Ekspresi Mata Dasar */}
              <div>
                <label className="text-xs font-semibold text-[#ececec] block mb-2.5">
                  3. Ekspresi Mata
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {AVAILABLE_EXPRESSIONS.map((expr) => {
                    const isSelected = currentConfig.expression === expr.id;
                    return (
                      <button
                        key={expr.id}
                        type="button"
                        onClick={() => handleExpressionSelect(expr.id)}
                        className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all text-center ${
                          isSelected
                            ? 'bg-[#383838] border-[#ececec] text-[#ececec]'
                            : 'bg-[#212121] hover:bg-[#2b2b2b] border-[#333333] text-[#a0a0a0] hover:text-[#ececec]'
                        }`}
                      >
                        {expr.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opsi Toggle Animasi Hidup */}
              <div className="pt-2 border-t border-[#333333] flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-[#ececec]">Animasi Gerak Hidup</span>
                  <p className="text-[11px] text-[#707070]">
                    Aktifkan kedipan mata berkala dan gerakan nafas lembut saat idle.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateAgentMascot(selectedRole, { animate: !currentConfig.animate })}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    currentConfig.animate ? 'bg-[#ececec]' : 'bg-[#333333]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full transition-transform ${
                      currentConfig.animate ? 'translate-x-5 bg-[#171717]' : 'translate-x-0 bg-[#888888]'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Bagian 2: Pemetaan Event ke Animasi */}
          {activeSection === 'animations' && (
            <div className="p-5 rounded-2xl bg-[#282828] border border-[#383838] space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-[#ececec]">
                  Pemetaan Event Reaktif Aplikasi
                </h4>
                <p className="text-[11px] text-[#707070] mt-0.5">
                  Tentukan animasi yang akan diputar oleh maskot agen saat event tertentu terjadi di sistem.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {/* 1. Event Menunggu (Idle) */}
                <div className="p-3 rounded-xl bg-[#212121] border border-[#333333] flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-medium text-[#ececec]">Saat Menunggu (Idle)</span>
                    <p className="text-[10px] text-[#707070]">Kondisi diam menunggu instruksi pengguna</p>
                  </div>
                  <CustomSelect
                    value={currentConfig.events.on_idle}
                    options={ANIMATION_OPTIONS}
                    onChange={(val) => handleEventChange('on_idle', val as MascotAnimation)}
                    className="w-44"
                  />
                </div>

                {/* 2. Event Berpikir (Thinking) */}
                <div className="p-3 rounded-xl bg-[#212121] border border-[#333333] flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-medium text-[#ececec]">Saat Berpikir (Thinking)</span>
                    <p className="text-[10px] text-[#707070]">Agen sedang bernalar, memanggil tools, atau merancang kode</p>
                  </div>
                  <CustomSelect
                    value={currentConfig.events.on_thinking}
                    options={ANIMATION_OPTIONS}
                    onChange={(val) => handleEventChange('on_thinking', val as MascotAnimation)}
                    className="w-44"
                  />
                </div>

                {/* 3. Event Menemukan Bug / Error */}
                <div className="p-3 rounded-xl bg-[#212121] border border-[#333333] flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-medium text-[#ececec]">Saat Galat / Bug (Error)</span>
                    <p className="text-[10px] text-[#707070]">Eksekusi tool gagal atau API mengembalikan galat</p>
                  </div>
                  <CustomSelect
                    value={currentConfig.events.on_error}
                    options={ANIMATION_OPTIONS}
                    onChange={(val) => handleEventChange('on_error', val as MascotAnimation)}
                    className="w-44"
                  />
                </div>

                {/* 4. Event Notifikasi / Pesan Masuk */}
                <div className="p-3 rounded-xl bg-[#212121] border border-[#333333] flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-medium text-[#ececec]">Saat Notifikasi (Notify)</span>
                    <p className="text-[10px] text-[#707070]">Pesan baru masuk di latar belakang atau toast muncul</p>
                  </div>
                  <CustomSelect
                    value={currentConfig.events.on_notification}
                    options={ANIMATION_OPTIONS}
                    onChange={(val) => handleEventChange('on_notification', val as MascotAnimation)}
                    className="w-44"
                  />
                </div>

                {/* 5. Event Tugas Selesai (Success) */}
                <div className="p-3 rounded-xl bg-[#212121] border border-[#333333] flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-medium text-[#ececec]">Saat Tugas Selesai (Success)</span>
                    <p className="text-[10px] text-[#707070]">Giliran asisten selesai merespons atau task selesai</p>
                  </div>
                  <CustomSelect
                    value={currentConfig.events.on_success}
                    options={ANIMATION_OPTIONS}
                    onChange={(val) => handleEventChange('on_success', val as MascotAnimation)}
                    className="w-44"
                  />
                </div>

                {/* 6. Event Menunggu Persetujuan Operator (HITL) */}
                <div className="p-3 rounded-xl bg-[#212121] border border-[#333333] flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-medium text-[#ececec]">Menunggu Persetujuan (Approval)</span>
                    <p className="text-[10px] text-[#707070]">Permintaan izin eksekusi tool muncul di layar</p>
                  </div>
                  <CustomSelect
                    value={currentConfig.events.on_approval}
                    options={ANIMATION_OPTIONS}
                    onChange={(val) => handleEventChange('on_approval', val as MascotAnimation)}
                    className="w-44"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
