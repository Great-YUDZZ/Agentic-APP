import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Sparkles,
  Film,
  Palette,
  Check,
  Zap,
  MousePointer,
} from 'lucide-react';
import { useStore, DEFAULT_MASCOTS } from '../../store/useStore';
import { BloubBot } from '../mascot/BloubBot';
import { CustomSelect, SelectOption } from '../common/CustomSelect';
import {
  MascotShape,
  MascotExpression,
  MascotAnimation,
  MascotEvent,
} from '../../types';
import {
  SHAPES,
  COLORS,
  EXPRESSIONS,
  STATES,
  type StateId,
} from '../mascot/bloub';

const EXPRESSION_LABELS: Record<string, string> = {
  repos: 'Santai',
  joyeux: 'Ceria',
  attentif: 'Fokus',
  endormi: 'Mengantuk',
  curieux: 'Penasaran',
  clin_d_oeil: 'Kedip',
  inquiet: 'Waspada',
  colere: 'Tegas',
  etonne: 'Terkejut',
  effraye: 'Kaget',
};

const STATE_LABELS: Record<string, string> = {
  idle: 'Idle (Santai)',
  orbit: 'Orbit (Cincin Partikel)',
  notify: 'Notification (Pop Pastille)',
  alert: 'Alert (Tanda Peringatan)',
  exclaim: 'Exclamation (Titik Seru)',
  play: 'Play (Gerak Lincah)',
  wink: 'Wink (Kedip Senyum)',
  wide: 'Wide (Mata Terbelalak)',
  sleep: 'Sleep (Tidur Tenang)',
  swirl: 'Swirl (Putaran 360)',
  split: 'Split (Pecah Partikel)',
  spiral: 'Spiral (Lintasan Pusaran)',
  scan: 'Scan (Pemindaian)',
  bounce: 'Bounce (Lompat Membal)',
};

const ANIMATION_OPTIONS: SelectOption[] = STATES.map((st) => ({
  value: st.id,
  label: STATE_LABELS[st.id] ?? st.id,
}));

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
  const [previewAnimation, setPreviewAnimation] = useState<StateId>('idle');
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
    setPreviewAnimation(anim as StateId);
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
            <h3 className="text-sm font-semibold text-[#ececec]">Kustomisasi Maskot Bloub</h3>
          </div>
          <p className="text-xs text-[#707070] mt-1">
            Personalisasi siluet morphing, ekspresi, dan reaksi event untuk setiap peran agen.
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

      {/* Grid Utama: Preview Kiri & Kontrol Kanan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri: Live Interactive Preview & Animation Gallery */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-2xl bg-[#282828] border border-[#383838] flex flex-col items-center justify-center relative min-h-[260px] overflow-hidden group">
            {/* Status Event Badge */}
            <div className="absolute top-3.5 left-3.5 flex items-center gap-2">
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#212121] text-[#ececec] border border-[#383838]">
                {previewAnimation}
              </span>
            </div>

            {/* Hint Gaze Tracking */}
            <div className="absolute top-3.5 right-3.5 flex items-center gap-1 text-[10px] text-[#707070]">
              <MousePointer className="w-3 h-3" />
              <span>Gaze Active</span>
            </div>

            {/* Avatar Maskot Bloub Interaktif */}
            <div className="py-2">
              <BloubBot
                size={140}
                shape={currentConfig.shape}
                color={currentConfig.color}
                expression={currentConfig.expression}
                state={previewAnimation}
                follow={true}
              />
            </div>

            {/* Label Peran & Info */}
            <div className="mt-2 text-center">
              <span className="text-xs font-semibold text-[#ececec]">
                {agentOptions.find((o) => o.value === selectedRole)?.label}
              </span>
              <p className="text-[11px] text-[#707070] mt-0.5">
                Arahkan mouse di area ini untuk melihat lirikan mata maskot.
              </p>
            </div>
          </div>

          {/* Galeri Pengujian 14 State Animasi Bloub */}
          <div className="p-4 rounded-2xl bg-[#282828] border border-[#383838] space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-[#333333]">
              <Film className="w-3.5 h-3.5 text-[#ececec]" />
              <span className="text-xs font-semibold text-[#ececec]">
                Uji Coba 14 Animasi Bawaan Bloub
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
              {STATES.map((st) => {
                const isActive = previewAnimation === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setPreviewAnimation(st.id)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                      isActive
                        ? 'bg-[#383838] border-[#ececec] text-[#ececec]'
                        : 'bg-[#212121] hover:bg-[#282828] border-[#333333] text-[#909090] hover:text-[#ececec]'
                    }`}
                  >
                    <span className="truncate">{st.id}</span>
                    <span className="text-[10px] text-[#707070] font-mono shrink-0 ml-1">
                      {(st.minDuration ?? st.duration).toFixed(1)}s
                    </span>
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

          {/* Bagian 1: Penampilan (Bentuk, Warna, Ekspresi) */}
          {activeSection === 'appearance' && (
            <div className="p-5 rounded-2xl bg-[#282828] border border-[#383838] space-y-6">
              {/* Pilihan 10 Bentuk Tubuh (Shapes) */}
              <div>
                <label className="text-xs font-semibold text-[#ececec] block mb-2.5">
                  1. Bentuk Tubuh Siluet
                </label>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {SHAPES.map((shape) => {
                    const isSelected = currentConfig.shape === shape.id;
                    return (
                      <button
                        key={shape.id}
                        type="button"
                        onClick={() => handleShapeSelect(shape.id as MascotShape)}
                        className={`h-11 rounded-xl border transition-all flex items-center justify-center ${
                          isSelected
                            ? 'bg-[#383838] border-[#ececec]'
                            : 'bg-[#212121] hover:bg-[#2b2b2b] border-[#333333]'
                        }`}
                        title={shape.id}
                      >
                        <BloubBot
                          size={28}
                          shape={shape.id}
                          color={currentConfig.color}
                          expression={currentConfig.expression}
                          frozenAt={0}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pilihan 12 Palet Warna Asli Bloub + Kustom */}
              <div>
                <label className="text-xs font-semibold text-[#ececec] block mb-2.5">
                  2. Palet Skin Warna
                </label>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {COLORS.map((col) => {
                    const isSelected = currentConfig.color.toLowerCase() === col.hex.toLowerCase();
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => handleColorSelect(col.hex)}
                        className={`w-8 h-8 rounded-full border transition-all flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-[#ececec] ring-2 ring-[#ececec]/30 scale-105'
                            : 'border-[#333333] hover:scale-105'
                        }`}
                        style={{ backgroundColor: col.hex }}
                        title={`${col.id} (${col.hex})`}
                      >
                        {isSelected && (
                          <Check
                            className="w-4 h-4"
                            style={{ color: col.hex === '#f5f5f0' ? '#171717' : '#ffffff' }}
                          />
                        )}
                      </button>
                    );
                  })}

                  <label
                    className="w-8 h-8 rounded-full border border-dashed border-[#555555] hover:border-[#ececec] flex items-center justify-center cursor-pointer transition-colors relative shrink-0 bg-[#212121]"
                    title="Pilih warna hex kustom"
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

              {/* Pilihan 10 Ekspresi Wajah Asli Bloub */}
              <div>
                <label className="text-xs font-semibold text-[#ececec] block mb-2.5">
                  3. Ekspresi Wajah
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {EXPRESSIONS.map((expr) => {
                    const isSelected = currentConfig.expression === expr.id;
                    return (
                      <button
                        key={expr.id}
                        type="button"
                        onClick={() => handleExpressionSelect(expr.id as MascotExpression)}
                        className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all text-center ${
                          isSelected
                            ? 'bg-[#383838] border-[#ececec] text-[#ececec]'
                            : 'bg-[#212121] hover:bg-[#2b2b2b] border-[#333333] text-[#a0a0a0] hover:text-[#ececec]'
                        }`}
                      >
                        {EXPRESSION_LABELS[expr.id] ?? expr.id}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opsi Toggle Gaze Tracking */}
              <div className="pt-2 border-t border-[#333333] flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-[#ececec]">Interaksi Lirikan Kursor (Gaze Tracking)</span>
                  <p className="text-[11px] text-[#707070]">
                    Mata maskot melirik dan mengikuti pergerakan kursor mouse saat aktif.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateAgentMascot(selectedRole, { follow: !currentConfig.follow })}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    currentConfig.follow !== false ? 'bg-[#ececec]' : 'bg-[#333333]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full transition-transform ${
                      currentConfig.follow !== false ? 'translate-x-5 bg-[#171717]' : 'translate-x-0 bg-[#888888]'
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
                  Pilih salah satu dari 14 animasi bawaan Bloub untuk diputar saat event aplikasi terjadi.
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
                    className="w-48"
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
                    className="w-48"
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
                    className="w-48"
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
                    className="w-48"
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
                    className="w-48"
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
                    className="w-48"
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

export default MascotSettingsTab;
