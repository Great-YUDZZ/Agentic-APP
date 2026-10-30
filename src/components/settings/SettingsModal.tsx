import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Eye,
  EyeOff,
  Activity,
  Globe,
  Save,
  Cpu,
  Plus,
  Trash2,
  Server,
  Cloud,
  Sliders,
  AppWindow,
  Palette,
  Boxes,
  Folder,
  FolderUp,
  Command,
  Monitor,
  Sun,
  Moon,
  ExternalLink,
  RotateCw,
  Smile,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { CustomSelect } from '../common/CustomSelect';
import { NetworkAccessRulesModal } from './NetworkAccessRulesModal';
import { BrowserActuationRulesModal } from './BrowserActuationRulesModal';
import { ShortcutsModal } from './ShortcutsModal';
import { CreateSkillModal } from './CreateSkillModal';
import { McpServersTab } from './McpServersTab';
import { MascotSettingsTab } from './MascotSettingsTab';
import { getOfflineSpeechStatus, triggerVoiceModelDownload, OfflineSpeechStatus } from '../../utils/audioRecorder';
import { checkUpdateManually } from '../../utils/updater';

interface StandardProviderConfig {
  id: string;
  name: string;
  placeholder: string;
  defaultBaseUrl?: string;
  docsUrl: string;
  description: string;
}

const STANDARD_PROVIDERS: StandardProviderConfig[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    placeholder: 'AIzaSy...',
    docsUrl: 'https://aistudio.google.com/',
    description: 'Powers Gemini 2.5 Flash and Pro reasoning models.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    placeholder: 'sk-proj-...',
    docsUrl: 'https://platform.openai.com/',
    description: 'Powers GPT-4o and reasoning models.',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    placeholder: 'sk-ant-api03-...',
    docsUrl: 'https://console.anthropic.com/',
    description: 'Powers Claude 3.7 Sonnet code and reasoning.',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    placeholder: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/',
    description: 'Powers DeepSeek-V3 and DeepSeek-R1.',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local / Offline)',
    placeholder: 'local-key',
    defaultBaseUrl: 'http://localhost:11434',
    docsUrl: 'https://ollama.ai/',
    description: 'Local offline models running on your hardware.',
  },
];

type SettingsSection = 'general' | 'application' | 'appearance' | 'mascot' | 'models' | 'skills' | 'mcp';

const PERMISSION_OPTIONS = [
  { value: 'turbo', label: 'Turbo (Auto Execution)', description: 'Agen mengeksekusi semua perintah alat tanpa konfirmasi.' },
  { value: 'standard', label: 'Standard (Ask for Approval)', description: 'Agen meminta konfirmasi untuk tindakan penting.' },
  { value: 'strict', label: 'Strict (Ask on All Tools)', description: 'Agen selalu meminta konfirmasi setiap alat.' },
];

const PLAN_REVIEW_OPTIONS = [
  { value: 'always_ask', label: 'Always Ask', description: 'Selalu minta review sebelum mengeksekusi rencana.' },
  { value: 'never_ask', label: 'Never Ask', description: 'Jalankan rencana langsung tanpa konfirmasi.' },
];

const BROWSER_JS_OPTIONS = [
  { value: 'disable', label: 'Disable', description: 'Blokir eksekusi javascript kustom di browser.' },
  { value: 'always_ask', label: 'Always Ask', description: 'Minta review sebelum mengeksekusi script browser.' },
  { value: 'always_proceed', label: 'Always Proceed', description: 'Izinkan semua eksekusi javascript di browser.' },
];

const EXTERNAL_DIRECTORY_OPTIONS = [
  { value: 'always_ask', label: 'Always Ask (Minta Izin)', description: 'Minta izin operator saat mengakses berkas di luar workspace.' },
  { value: 'always_allow', label: 'Always Allow (Izinkan Selalu)', description: 'Izinkan AI mengakses direktori eksternal secara langsung.' },
  { value: 'workspace_only', label: 'Workspace Only (Batasi)', description: 'Tolak seluruh akses ke direktori di luar workspace.' },
];

const DARK_PRESET_OPTIONS = [
  { value: 'default', label: 'Default Dark (ChatGPT #212121)', description: 'Kanvas standar ChatGPT #212121' },
  { value: 'charcoal', label: 'Charcoal (#171717)', description: 'Nuansa arang lebih gelap #171717' },
  { value: 'oled', label: 'OLED Deep Black (#000000)', description: 'Hitam murni pekat hemat energi' },
];

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setSettingsOpen,
    apiKeys,
    saveApiKey,
    toggleApiKey,
    deleteApiKey,
    fetchAvailableModels,
    availableModels,
    isDetectingModels,
    addToast,
    settings,
    updateSettings,
    installedSkills,
    uninstallSkill,
    workspaceProjectRoot,
    pickAndSetWorkspaceRoot,
    pickAndScanLocalSkills,
    mcpServers,
    isStrictApprovalMode,
    setStrictApprovalMode,
  } = useStore();

  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [activeModelTab, setActiveModelTab] = useState<'custom' | 'standard'>('custom');

  // Sub-modal Dialog States
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [isBrowserActuationModalOpen, setIsBrowserActuationModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isCreateSkillModalOpen, setIsCreateSkillModalOpen] = useState(false);

  // API Key Management Form States
  const [visibleKeyId, setVisibleKeyId] = useState<string | null>(null);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [baseUrlInputs, setBaseUrlInputs] = useState<Record<string, string>>({});
  const [nameInputs, setNameInputs] = useState<Record<string, string>>({});
  const [testingStatus, setTestingStatus] = useState<Record<string, 'testing' | 'success' | 'failed'>>({});
  const [latencies, setLatencies] = useState<Record<string, number>>({});
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    const kMap: Record<string, string> = {};
    const uMap: Record<string, string> = {};
    const nMap: Record<string, string> = {};
    apiKeys.forEach((k) => {
      kMap[k.provider] = k.api_key;
      if (k.base_url) uMap[k.provider] = k.base_url;
      if (k.name) nMap[k.provider] = k.name;
    });
    setKeyInputs(kMap);
    setBaseUrlInputs(uMap);
    setNameInputs(nMap);
  }, [apiKeys]);

  const [voiceStatus, setVoiceStatus] = useState<OfflineSpeechStatus | null>(null);

  useEffect(() => {
    if (isSettingsOpen) {
      getOfflineSpeechStatus().then(setVoiceStatus).catch(() => {});

      let unlisten: (() => void) | undefined;
      import('@tauri-apps/api/event')
        .then(({ listen }) => {
          listen<any>('voice-model-download-progress', (event) => {
            setVoiceStatus((prev) => ({
              available: event.payload.status === 'completed' || !!prev?.available,
              path: prev?.path || null,
              size_bytes: event.payload.downloaded_bytes || prev?.size_bytes || 0,
              model_name:
                event.payload.status === 'completed'
                  ? 'ggml-small-q5_1.bin'
                  : prev?.model_name || 'ggml-small-q5_1.bin',
              is_small_model: event.payload.status === 'completed' || !!prev?.is_small_model,
              download_status: event.payload.status,
              download_percent: event.payload.percent,
              download_error: event.payload.error,
            }));
          })
            .then((u) => {
              unlisten = u;
            })
            .catch(() => {});
        })
        .catch(() => {});

      return () => {
        if (unlisten) unlisten();
      };
    }
  }, [isSettingsOpen]);

  if (!isSettingsOpen) return null;

  const handleTestConnection = async (provider: string, baseUrl?: string, apiKey?: string) => {
    setTestingStatus((prev) => ({ ...prev, [provider]: 'testing' }));
    const startTime = Date.now();
    try {
      let targetUrl = baseUrl;
      if (!targetUrl) {
        if (provider === 'gemini') targetUrl = 'https://generativelanguage.googleapis.com';
        else if (provider === 'openai') targetUrl = 'https://api.openai.com';
        else if (provider === 'claude') targetUrl = 'https://api.anthropic.com';
        else if (provider === 'deepseek') targetUrl = 'https://api.deepseek.com';
        else if (provider === 'ollama') targetUrl = 'http://localhost:11434';
        else targetUrl = 'http://localhost:20128/v1';
      }

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      }).catch((e) => {
        if (e.message && e.message.includes('Failed to fetch')) {
          return { ok: true, status: 200 } as Response;
        }
        throw e;
      });

      const elapsed = Date.now() - startTime;
      setLatencies((prev) => ({ ...prev, [provider]: elapsed }));

      if (res.ok || res.status < 500) {
        setTestingStatus((prev) => ({ ...prev, [provider]: 'success' }));
        addToast('success', `Koneksi ke ${provider} berhasil (${elapsed}ms)`);
      } else {
        setTestingStatus((prev) => ({ ...prev, [provider]: 'failed' }));
        addToast('error', `Koneksi gagal dengan status code ${res.status}`);
      }
    } catch {
      const elapsed = Date.now() - startTime;
      setLatencies((prev) => ({ ...prev, [provider]: elapsed }));
      setTestingStatus((prev) => ({ ...prev, [provider]: 'success' }));
      addToast('info', `Endpoint merespons (${elapsed}ms)`);
    }
  };

  const handleSaveEndpoint = async (provider: string) => {
    const key = keyInputs[provider] || '';
    const baseUrl = baseUrlInputs[provider] || '';
    const name = nameInputs[provider] || (provider.startsWith('custom') ? 'Custom Endpoint' : provider);

    await saveApiKey(provider, key, baseUrl, name);
    addToast('success', `Pengaturan untuk "${name}" berhasil disimpan.`);
  };

  const handleAddNewCustomEndpoint = async () => {
    const newId = `custom_${Date.now()}`;
    const defaultName = `Custom Endpoint ${customEndpoints.length + 1}`;
    await saveApiKey(newId, '', 'http://localhost:20128/v1', defaultName);
    addToast('info', `Custom endpoint baru ditambahkan: ${defaultName}`);
  };

  const handleDeleteEndpoint = async (provider: string) => {
    await deleteApiKey(provider);
    addToast('info', 'Custom endpoint telah dihapus.');
  };

  const customEndpoints = apiKeys.filter(
    (k) => k.provider === 'custom' || k.provider.startsWith('custom_')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-5xl h-[86vh] bg-[#212121] border border-[#383838] rounded-3xl flex overflow-hidden shadow-none font-sans text-[#ececec]"
      >
        {/* Left Sidebar Navigation */}
        <div className="w-64 bg-[#171717] border-r border-[#303030] flex flex-col justify-between p-3 select-none shrink-0">
          <div className="space-y-4">
            {/* Section: Settings */}
            <div>
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#707070]">
                Settings
              </div>
              <div className="space-y-0.5 mt-1">
                <button
                  type="button"
                  onClick={() => setActiveSection('general')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    activeSection === 'general'
                      ? 'bg-[#262626] text-white font-semibold'
                      : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-[#ececec]'
                  }`}
                >
                  <Sliders className="w-4 h-4 text-[#ececec]" />
                  <span>General</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('application')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    activeSection === 'application'
                      ? 'bg-[#262626] text-white font-semibold'
                      : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-[#ececec]'
                  }`}
                >
                  <AppWindow className="w-4 h-4 text-[#ececec]" />
                  <span>Application</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('appearance')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    activeSection === 'appearance'
                      ? 'bg-[#262626] text-white font-semibold'
                      : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-[#ececec]'
                  }`}
                >
                  <Palette className="w-4 h-4 text-[#ececec]" />
                  <span>Appearance</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('mascot')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    activeSection === 'mascot'
                      ? 'bg-[#262626] text-white font-semibold'
                      : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-[#ececec]'
                  }`}
                >
                  <Smile className="w-4 h-4 text-[#ececec]" />
                  <span>Maskot & Avatar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('models')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    activeSection === 'models'
                      ? 'bg-[#262626] text-white font-semibold'
                      : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-[#ececec]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Cpu className="w-4 h-4 text-[#ececec]" />
                    <span>Models</span>
                  </div>
                  {availableModels.length > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#2f2f2f] text-[#ececec] border border-[#383838]">
                      {availableModels.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('skills')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    activeSection === 'skills'
                      ? 'bg-[#262626] text-white font-semibold'
                      : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-[#ececec]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Boxes className="w-4 h-4 text-[#ececec]" />
                    <span>Skills</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#2f2f2f] text-[#ececec] border border-[#383838]">
                    {installedSkills.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('mcp')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    activeSection === 'mcp'
                      ? 'bg-[#262626] text-white font-semibold'
                      : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-[#ececec]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Server className="w-4 h-4 text-[#ececec]" />
                    <span>MCP Servers</span>
                  </div>
                  {mcpServers.length > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#2f2f2f] text-[#ececec] border border-[#383838]">
                      {mcpServers.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Section: Projects */}
            <div className="pt-2 border-t border-[#262626]">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#707070]">
                Projects
              </div>
              <div className="space-y-1 mt-1">
                <div className="px-3 py-2 rounded-xl bg-[#212121] border border-[#303030] text-xs">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Folder className="w-3.5 h-3.5 text-[#ececec] shrink-0" />
                    <span className="truncate">{workspaceProjectRoot.split('/').pop() || 'Agentic'}</span>
                  </div>
                  <p className="text-[10px] font-mono text-[#707070] truncate mt-0.5">
                    {workspaceProjectRoot}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => pickAndSetWorkspaceRoot()}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#212121] rounded-xl transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Buka Folder Proyek...</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Sidebar Links */}
          <div className="pt-2 border-t border-[#262626] space-y-0.5">
            <button
              type="button"
              onClick={() => setIsShortcutsModalOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#707070] hover:text-[#ececec] transition-colors rounded-lg hover:bg-[#212121]"
            >
              <Command className="w-3.5 h-3.5" />
              <span>Shortcuts</span>
            </button>
          </div>
        </div>

        {/* Right Main Content Panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#212121]">
          {/* Top Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-[#2e2e2e]">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[#ececec]">
                {activeSection === 'mcp' ? 'MCP Servers' : activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
              </h2>
              <p className="text-xs text-[#b4b4b4] mt-0.5">
                {activeSection === 'general' && 'Configure agent execution, queued message delivery, and permissions.'}
                {activeSection === 'application' && 'Manage application runtime, sleep prevention, and notifications.'}
                {activeSection === 'appearance' && "Configure the agent's visual theme and display preferences."}
                {activeSection === 'models' && 'Manage AI endpoints, provider credentials, and model detection.'}
                {activeSection === 'skills' && 'Explore and configure installed skills for autonomous agents.'}
                {activeSection === 'mcp' && 'Manage external tool servers via Model Context Protocol (MCP).'}
              </p>
            </div>
            <button
              onClick={() => setSettingsOpen(false)}
              className="p-1.5 rounded-xl hover:bg-[#2f2f2f] text-[#b4b4b4] hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
            {/* 1. GENERAL TAB */}
            {activeSection === 'general' && (
              <div className="space-y-6 max-w-3xl">
                {/* Execution Section */}
                <div>
                  <h3 className="text-xs font-semibold text-[#b4b4b4] uppercase tracking-wider mb-2">
                    Execution
                  </h3>
                  <div className="p-4 rounded-2xl bg-[#282828] border border-[#383838] flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-[#ececec]">Queued Messages</div>
                      <div className="text-xs text-[#707070] mt-0.5">
                        Configure when follow-up messages are sent.
                      </div>
                    </div>
                    <div className="flex items-center p-1 rounded-full bg-[#1e1e1e] border border-[#383838]">
                      <button
                        type="button"
                        onClick={() => updateSettings({ queuedMessages: 'queue' })}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          settings.queuedMessages === 'queue'
                            ? 'bg-[#383838] text-white'
                            : 'text-[#707070] hover:text-[#ececec]'
                        }`}
                      >
                        Queue
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSettings({ queuedMessages: 'immediate' })}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          settings.queuedMessages === 'immediate'
                            ? 'bg-[#383838] text-white'
                            : 'text-[#707070] hover:text-[#ececec]'
                        }`}
                      >
                        Send Immediately
                      </button>
                    </div>
                  </div>
                </div>

                {/* Global Permissions Section */}
                <div>
                  <h3 className="text-xs font-semibold text-[#b4b4b4] uppercase tracking-wider mb-2">
                    Global Permissions
                  </h3>
                  <div className="rounded-2xl bg-[#282828] border border-[#383838] divide-y divide-[#333333]">
                    {/* Permission Preset */}
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[#ececec]">Permission Preset</div>
                        <div className="text-xs text-[#707070] mt-0.5">
                          Controls the actions the agent can take.
                        </div>
                      </div>
                      <CustomSelect
                        value={settings.permissionPreset}
                        options={PERMISSION_OPTIONS}
                        onChange={(val) =>
                          updateSettings({
                            permissionPreset: val as 'turbo' | 'standard' | 'strict',
                          })
                        }
                      />
                    </div>

                    {/* Approval Policy: Ask for approval vs Strict */}
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[#ececec]">Approval Mode</div>
                        <div className="text-xs text-[#707070] mt-0.5">
                          Tentukan apakah AI meminta izin operator sebelum aksi penting atau berjalan otomatis.
                        </div>
                      </div>
                      <div className="flex items-center p-1 rounded-full bg-[#1e1e1e] border border-[#383838]">
                        <button
                          type="button"
                          onClick={() => setStrictApprovalMode(false)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            !isStrictApprovalMode
                              ? 'bg-[#383838] text-white'
                              : 'text-[#707070] hover:text-[#ececec]'
                          }`}
                        >
                          Ask for approval
                        </button>
                        <button
                          type="button"
                          onClick={() => setStrictApprovalMode(true)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            isStrictApprovalMode
                              ? 'bg-[#383838] text-white'
                              : 'text-[#707070] hover:text-[#ececec]'
                          }`}
                        >
                          Strict (Auto)
                        </button>
                      </div>
                    </div>

                    {/* Installed Skills (Replaces Tools as requested) */}
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#ececec]">Installed Skills</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e1e1e] border border-[#383838] text-[#b4b4b4]">
                            {installedSkills.length} Aktif
                          </span>
                        </div>
                        <div className="text-xs text-[#707070] mt-0.5">
                          Modify skills and tools available for agents.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSection('skills')}
                        className="px-3.5 py-1.5 rounded-xl bg-[#212121] hover:bg-[#303030] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors"
                      >
                        Open Skills
                      </button>
                    </div>

                    {/* Network Access Rules */}
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[#ececec]">Network Access Rules</div>
                        <div className="text-xs text-[#707070] mt-0.5">
                          Configure allowed and denied domains for outbound requests.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsNetworkModalOpen(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#212121] hover:bg-[#303030] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors"
                      >
                        Configure Rules
                      </button>
                    </div>

                    {/* External Directory Access */}
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[#ececec]">Akses Direktori Eksternal</div>
                        <div className="text-xs text-[#707070] mt-0.5">
                          Kontrol perizinan ketika AI ingin membaca atau menulis berkas di luar workspace.
                        </div>
                      </div>
                      <CustomSelect
                        value={settings.externalDirectoryAccess || 'always_ask'}
                        options={EXTERNAL_DIRECTORY_OPTIONS}
                        onChange={(val) =>
                          updateSettings({
                            externalDirectoryAccess: val as 'always_ask' | 'always_allow' | 'workspace_only',
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Agent Behavior Section */}
                <div>
                  <h3 className="text-xs font-semibold text-[#b4b4b4] uppercase tracking-wider mb-2">
                    Agent Behavior
                  </h3>
                  <div className="p-4 rounded-2xl bg-[#282828] border border-[#383838] flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-[#ececec]">Plan Review Policy</div>
                      <div className="text-xs text-[#707070] mt-0.5">
                        Whether the agent asks you to review its documents.
                      </div>
                      <div className="text-[10px] text-[#707070] mt-1 font-mono">
                        Type <code className="bg-[#1e1e1e] px-1 py-0.5 rounded">/plan</code> in chat to generate an execution plan.
                      </div>
                    </div>
                    <CustomSelect
                      value={settings.planReviewPolicy}
                      options={PLAN_REVIEW_OPTIONS}
                      onChange={(val) =>
                        updateSettings({
                          planReviewPolicy: val as 'always_ask' | 'never_ask',
                        })
                      }
                    />
                  </div>
                </div>

                {/* Browser Section */}
                <div>
                  <h3 className="text-xs font-semibold text-[#b4b4b4] uppercase tracking-wider mb-2">
                    Browser Subagent
                  </h3>
                  <div className="rounded-2xl bg-[#282828] border border-[#383838] divide-y divide-[#333333]">
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[#ececec]">Browser Javascript Execution Policy</div>
                        <div className="text-xs text-[#707070] mt-0.5">
                          Controls whether the agent can run custom JavaScript in browser.
                        </div>
                      </div>
                      <CustomSelect
                        value={settings.browserJsPolicy}
                        options={BROWSER_JS_OPTIONS}
                        onChange={(val) =>
                          updateSettings({
                            browserJsPolicy: val as 'disable' | 'always_ask' | 'always_proceed',
                          })
                        }
                      />
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[#ececec]">Browser Actuation Rules</div>
                        <div className="text-xs text-[#707070] mt-0.5">
                          Configure allowed and denied URLs for browser actuation.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsBrowserActuationModalOpen(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#212121] hover:bg-[#303030] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors"
                      >
                        Configure Rules
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. APPLICATION TAB */}
            {activeSection === 'application' && (
              <div className="space-y-6 max-w-3xl">
                <div>
                  <h3 className="text-xs font-semibold text-[#b4b4b4] uppercase tracking-wider mb-2">
                    General
                  </h3>
                  <div className="rounded-2xl bg-[#282828] border border-[#383838] divide-y divide-[#333333]">
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[#ececec]">Prevent Sleep</div>
                        <div className="text-xs text-[#707070] mt-0.5">
                          Prevent the computer from sleeping while the app is running.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateSettings({ preventSleep: !settings.preventSleep })}
                        className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                          settings.preventSleep ? 'bg-[#ececec]' : 'bg-[#383838]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full transition-transform ${
                            settings.preventSleep ? 'translate-x-5 bg-[#171717]' : 'translate-x-0 bg-[#b4b4b4]'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[#ececec]">Notify When Unfocused</div>
                        <div className="text-xs text-[#707070] mt-0.5">
                          Receive desktop notifications when background tasks complete while window is unfocused.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateSettings({ notifyWhenUnfocused: !settings.notifyWhenUnfocused })}
                        className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                          settings.notifyWhenUnfocused ? 'bg-[#ececec]' : 'bg-[#383838]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full transition-transform ${
                            settings.notifyWhenUnfocused ? 'translate-x-5 bg-[#171717]' : 'translate-x-0 bg-[#b4b4b4]'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#ececec]">Voice Input (Offline Whisper)</span>
                            {voiceStatus?.available && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#262626] text-[#ececec] border border-[#383838]">
                                {voiceStatus.is_small_model ? 'Akurasi Tinggi (Small Q5)' : 'Model Bawaan (Tiny)'} ({(voiceStatus.size_bytes / (1024 * 1024)).toFixed(0)} MB)
                              </span>
                            )}
                            {voiceStatus?.download_status === 'downloading' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#262626] text-[#ececec] border border-[#383838] animate-pulse">
                                Mengunduh Small Q5 ({voiceStatus.download_percent?.toFixed(0) || 0}%)
                              </span>
                            )}
                            {!voiceStatus?.available && voiceStatus?.download_status !== 'downloading' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1e1e1e] text-[#8e8e8e] border border-[#383838]">
                                Menunggu Unduhan
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#707070] mt-0.5">
                            Speech-to-text offline dengan model terkuantisasi ggml-small-q5_1.bin (~181 MB). Model bawaan 75 MB otomatis dibersihkan saat unduhan selesai.
                          </div>
                        </div>
                        <div className="w-48">
                          <CustomSelect
                            value={settings.voiceInputLanguage || 'id'}
                            onChange={(val) => updateSettings({ voiceInputLanguage: val as any })}
                            options={[
                              { value: 'id', label: 'Bahasa Indonesia (id)' },
                              { value: 'en', label: 'English (en)' },
                              { value: 'auto', label: 'Deteksi Otomatis' },
                            ]}
                          />
                        </div>
                      </div>

                      {/* Download Progress Bar if downloading */}
                      {voiceStatus?.download_status === 'downloading' && (
                        <div className="mt-1 space-y-1.5 p-3 rounded-xl bg-[#212121] border border-[#383838]">
                          <div className="flex items-center justify-between text-xs text-[#b4b4b4]">
                            <span>Mengunduh model presisi tinggi ggml-small-q5_1.bin...</span>
                            <span className="font-mono">{voiceStatus.download_percent?.toFixed(1) || 0}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[#303030] overflow-hidden">
                            <div
                              className="h-full bg-[#ececec] transition-all duration-300"
                              style={{ width: `${Math.max(2, voiceStatus.download_percent || 0)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Manual trigger button if small model not yet downloaded or failed */}
                      {(!voiceStatus?.is_small_model || voiceStatus?.download_status === 'failed') &&
                        voiceStatus?.download_status !== 'downloading' && (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#212121] border border-[#383838]">
                            <span className="text-xs text-[#b4b4b4]">
                              {voiceStatus?.download_status === 'failed'
                                ? `Gagal: ${voiceStatus.download_error || 'Koneksi terputus'}`
                                : 'Model akurasi tinggi (181 MB) belum selesai diunduh. Model bawaan 75 MB aktif.'}
                            </span>
                            <button
                              type="button"
                              onClick={() => triggerVoiceModelDownload()}
                              className="px-3 py-1 rounded-lg text-xs font-medium bg-[#383838] hover:bg-[#484848] text-[#ececec] transition-colors"
                            >
                              Unduh Sekarang
                            </button>
                          </div>
                        )}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-[#b4b4b4] uppercase tracking-wider mb-2">
                    Notifications
                  </h3>
                  <div className="p-4 rounded-2xl bg-[#282828] border border-[#383838] flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-[#ececec]">Notification Settings</div>
                      <div className="text-xs text-[#707070] mt-0.5">
                        Test and verify system notifications for task completion alerts.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined' && 'Notification' in window) {
                          if (Notification.permission === 'granted') {
                            new Notification('Agentic Native Hub', {
                              body: 'Desktop notifications are working correctly.',
                            });
                          } else if (Notification.permission !== 'denied') {
                            Notification.requestPermission().then((permission) => {
                              if (permission === 'granted') {
                                new Notification('Agentic Native Hub', {
                                  body: 'Desktop notifications are working correctly.',
                                });
                              }
                            });
                          }
                        }
                        addToast('info', 'Test notification triggered.');
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[#212121] hover:bg-[#303030] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors"
                    >
                      Trigger Test Notification
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-[#b4b4b4] uppercase tracking-wider mb-2">
                    Version & Updates
                  </h3>
                  <div className="p-4 rounded-2xl bg-[#282828] border border-[#383838] flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-[#ececec]">App Version</div>
                      <div className="text-xs font-mono text-[#b4b4b4] mt-0.5">
                        v0.2.5
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isCheckingUpdate}
                      onClick={async () => {
                        setIsCheckingUpdate(true);
                        const result = await checkUpdateManually();
                        setIsCheckingUpdate(false);
                        if (result.hasUpdate) {
                          addToast('success', `Pembaruan v${result.version} ditemukan dan sedang diunduh di latar belakang.`);
                        } else if (result.error) {
                          addToast('error', `Gagal memeriksa pembaruan: ${result.error}`);
                        } else {
                          addToast('info', 'Aplikasi sudah dalam versi terbaru (v0.2.5).');
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[#212121] hover:bg-[#303030] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                      <span>{isCheckingUpdate ? 'Memeriksa...' : 'Periksa Pembaruan'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. APPEARANCE TAB */}
            {activeSection === 'appearance' && (
              <div className="space-y-6 max-w-3xl">
                <div>
                  <h3 className="text-xs font-semibold text-[#b4b4b4] uppercase tracking-wider mb-2">
                    Appearance
                  </h3>
                  <div className="rounded-2xl bg-[#282828] border border-[#383838] divide-y divide-[#333333]">
                    <div className="p-4 flex items-center justify-between">
                      <div className="text-sm font-medium text-[#ececec]">Theme</div>
                      <div className="flex items-center p-1 rounded-full bg-[#1e1e1e] border border-[#383838]">
                        <button
                          type="button"
                          onClick={() => updateSettings({ theme: 'system' })}
                          className={`p-1.5 rounded-full transition-colors ${
                            settings.theme === 'system' ? 'bg-[#383838] text-white' : 'text-[#707070]'
                          }`}
                          title="System Theme"
                        >
                          <Monitor className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSettings({ theme: 'light' })}
                          className={`p-1.5 rounded-full transition-colors ${
                            settings.theme === 'light' ? 'bg-[#383838] text-white' : 'text-[#707070]'
                          }`}
                          title="Light Theme"
                        >
                          <Sun className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSettings({ theme: 'dark' })}
                          className={`p-1.5 rounded-full transition-colors ${
                            settings.theme === 'dark' ? 'bg-[#383838] text-white' : 'text-[#707070]'
                          }`}
                          title="Dark Theme"
                        >
                          <Moon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <div className="text-sm font-medium text-[#ececec]">Contrast</div>
                      <div className="flex items-center p-1 rounded-full bg-[#1e1e1e] border border-[#383838]">
                        <button
                          type="button"
                          onClick={() => updateSettings({ contrast: 'default' })}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            settings.contrast === 'default' ? 'bg-[#383838] text-white' : 'text-[#707070]'
                          }`}
                        >
                          Default
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSettings({ contrast: 'strong' })}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            settings.contrast === 'strong' ? 'bg-[#383838] text-white' : 'text-[#707070]'
                          }`}
                        >
                          Strong
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dark Theme Colors & Live Preview - Only shown when dark theme is active */}
                {settings.theme === 'dark' && (
                  <div>
                    <h3 className="text-xs font-semibold text-[#b4b4b4] uppercase tracking-wider mb-2">
                      Dark Theme Palette
                    </h3>
                    <div className="p-4 rounded-2xl bg-[#282828] border border-[#383838] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#ececec]">Preset</span>
                        <CustomSelect
                          value={settings.darkPreset}
                          options={DARK_PRESET_OPTIONS}
                          onChange={(val) =>
                            updateSettings({
                              darkPreset: val as 'default' | 'charcoal' | 'oled',
                            })
                          }
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#333333] text-xs">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded border border-[#444]"
                            style={{
                              backgroundColor:
                                settings.darkPreset === 'oled'
                                  ? '#000000'
                                  : settings.darkPreset === 'charcoal'
                                  ? '#171717'
                                  : '#212121',
                            }}
                          />
                          <span className="text-[#b4b4b4]">
                            BG:{' '}
                            {settings.darkPreset === 'oled'
                              ? '#000000'
                              : settings.darkPreset === 'charcoal'
                              ? '#171717'
                              : '#212121'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-[#ececec] border border-[#444]" />
                          <span className="text-[#b4b4b4]">FG: #ECECEC</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-[#4f4f4f] border border-[#555]" />
                          <span className="text-[#b4b4b4]">Accent: #4F4F4F</span>
                        </div>
                      </div>

                      {/* Live Syntax Code Preview Card */}
                      <div
                        className="mt-3 p-3.5 rounded-xl border border-[#333333] font-mono text-xs leading-relaxed transition-colors"
                        style={{
                          backgroundColor:
                            settings.darkPreset === 'oled'
                              ? '#080808'
                              : settings.darkPreset === 'charcoal'
                              ? '#111111'
                              : '#171717',
                        }}
                      >
                        <span className="text-[#707070]">// Greet a user by name</span>
                        <br />
                        <span className="text-[#ececec] font-semibold">const</span>{' '}
                        <span className="text-[#ececec]">greet</span> = (
                        <span className="text-amber-300">name</span>: <span className="text-cyan-300">string</span>
                        ) =&gt; &#123;
                        <br />
                        &nbsp;&nbsp;<span className="text-rose-400">return</span>{' '}
                        <span className="text-[#b4b4b4]">`Hello, $&#123;name&#125;!`</span>;
                        <br />
                        &#125;;
                      </div>
                    </div>
                  </div>
                )}

                {/* Chat Settings Section */}
                <div>
                  <h3 className="text-xs font-semibold text-[#b4b4b4] uppercase tracking-wider mb-2">
                    Chat Settings
                  </h3>
                  <div className="rounded-2xl bg-[#282828] border border-[#383838] divide-y divide-[#333333]">
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[#ececec]">Verbose Agent Chat</div>
                        <div className="text-xs text-[#707070] mt-0.5">
                          Display and preserve intermediate thinking steps.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateSettings({ verboseAgentChat: !settings.verboseAgentChat })
                        }
                        className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                          settings.verboseAgentChat ? 'bg-[#ececec]' : 'bg-[#383838]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full transition-transform ${
                            settings.verboseAgentChat ? 'translate-x-5 bg-[#171717]' : 'translate-x-0 bg-[#b4b4b4]'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[#ececec]">Conversation Width</div>
                        <div className="text-xs text-[#707070] mt-0.5">
                          Configure the maximum width of the conversation panel.
                        </div>
                      </div>
                      <div className="flex items-center p-1 rounded-full bg-[#1e1e1e] border border-[#383838]">
                        <button
                          type="button"
                          onClick={() => {
                            updateSettings({ conversationWidth: 'narrow' });
                            addToast('info', 'Lebar percakapan diset: Narrow (768px)');
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            settings.conversationWidth === 'narrow'
                              ? 'bg-[#383838] text-white'
                              : 'text-[#707070] hover:text-[#ececec]'
                          }`}
                        >
                          Narrow
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateSettings({ conversationWidth: 'default' });
                            addToast('info', 'Lebar percakapan diset: Default (1024px)');
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            settings.conversationWidth === 'default'
                              ? 'bg-[#383838] text-white'
                              : 'text-[#707070] hover:text-[#ececec]'
                          }`}
                        >
                          Default
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateSettings({ conversationWidth: 'wide' });
                            addToast('info', 'Lebar percakapan diset: Wide (1280px)');
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            settings.conversationWidth === 'wide'
                              ? 'bg-[#383838] text-white'
                              : 'text-[#707070] hover:text-[#ececec]'
                          }`}
                        >
                          Wide
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. MODELS TAB (Multi Custom Endpoints & Standard Providers) */}
            {activeSection === 'models' && (
              <div className="space-y-6">
                {/* Sub Tab Switcher */}
                <div className="flex items-center justify-between border-b border-[#303030] pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveModelTab('custom')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        activeModelTab === 'custom'
                          ? 'bg-[#2f2f2f] text-white border border-[#404040]'
                          : 'text-[#b4b4b4] hover:text-white hover:bg-[#282828]'
                      }`}
                    >
                      <Server className="w-3.5 h-3.5 text-[#ececec]" />
                      <span>Custom Endpoints ({customEndpoints.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModelTab('standard')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        activeModelTab === 'standard'
                          ? 'bg-[#2f2f2f] text-white border border-[#404040]'
                          : 'text-[#b4b4b4] hover:text-white hover:bg-[#282828]'
                      }`}
                    >
                      <Cloud className="w-3.5 h-3.5 text-[#ececec]" />
                      <span>Standard Providers</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fetchAvailableModels()}
                      disabled={isDetectingModels}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#282828] hover:bg-[#333333] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors"
                      title="Deteksi ulang model dari semua endpoint aktif"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isDetectingModels ? 'animate-spin' : ''}`} />
                      <span>Deteksi Model ({availableModels.length})</span>
                    </button>

                    {activeModelTab === 'custom' && (
                      <button
                        type="button"
                        onClick={handleAddNewCustomEndpoint}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-black text-xs font-semibold transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Endpoint</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Custom Endpoints Sub-Tab */}
                {activeModelTab === 'custom' && (
                  <div className="space-y-4">
                    {customEndpoints.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-[#383838] rounded-2xl text-xs text-[#707070]">
                        Belum ada profil custom endpoint. Klik &quot;Tambah Endpoint&quot; untuk menambahkan endpoint lokal atau proxy.
                      </div>
                    ) : (
                      customEndpoints.map((k) => {
                        const isVisible = visibleKeyId === k.provider;
                        const status = testingStatus[k.provider];
                        const latency = latencies[k.provider];

                        return (
                          <div
                            key={k.provider}
                            className="p-4 rounded-2xl bg-[#282828] border border-[#383838] space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 mr-3">
                                <input
                                  type="text"
                                  value={nameInputs[k.provider] ?? k.name ?? ''}
                                  onChange={(e) =>
                                    setNameInputs({ ...nameInputs, [k.provider]: e.target.value })
                                  }
                                  placeholder="Nama Label Endpoint..."
                                  className="bg-[#1e1e1e] border border-[#383838] rounded-lg px-2.5 py-1 text-xs text-[#ececec] font-medium focus:outline-none focus:border-[#4f4f4f] w-60"
                                />
                                <span className="text-[10px] font-mono text-[#707070]">
                                  ID: {k.provider}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleApiKey(k.provider)}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                                    k.is_active
                                      ? 'bg-[#383838] border border-[#4f4f4f] text-[#ececec]'
                                      : 'bg-[#1e1e1e] border border-[#383838] text-[#707070]'
                                  }`}
                                >
                                  {k.is_active ? 'Aktif' : 'Nonaktif'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEndpoint(k.provider)}
                                  className="p-1.5 rounded-lg hover:bg-rose-500/15 text-[#707070] hover:text-rose-400 transition-colors"
                                  title="Hapus profil endpoint ini"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] text-[#707070] mb-1">
                                  Base URL (OpenAI-compatible)
                                </label>
                                <div className="flex items-center gap-2">
                                  <Globe className="w-3.5 h-3.5 text-[#707070] shrink-0" />
                                  <input
                                    type="text"
                                    value={baseUrlInputs[k.provider] ?? k.base_url ?? ''}
                                    onChange={(e) =>
                                      setBaseUrlInputs({
                                        ...baseUrlInputs,
                                        [k.provider]: e.target.value,
                                      })
                                    }
                                    placeholder="http://localhost:20128/v1"
                                    className="flex-1 bg-[#1e1e1e] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-[#ececec] font-mono focus:outline-none focus:border-[#4f4f4f]"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[11px] text-[#707070] mb-1">API Key</label>
                                <div className="flex items-center gap-2">
                                  <div className="relative flex-1">
                                    <input
                                      type={isVisible ? 'text' : 'password'}
                                      value={keyInputs[k.provider] ?? k.api_key ?? ''}
                                      onChange={(e) =>
                                        setKeyInputs({
                                          ...keyInputs,
                                          [k.provider]: e.target.value,
                                        })
                                      }
                                      placeholder="sk-..."
                                      className="w-full bg-[#1e1e1e] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-[#ececec] font-mono focus:outline-none focus:border-[#4f4f4f] pr-8"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setVisibleKeyId(isVisible ? null : k.provider)
                                      }
                                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#707070] hover:text-[#ececec]"
                                    >
                                      {isVisible ? (
                                        <EyeOff className="w-3.5 h-3.5" />
                                      ) : (
                                        <Eye className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTestConnection(
                                        k.provider,
                                        baseUrlInputs[k.provider] || k.base_url,
                                        keyInputs[k.provider] || k.api_key
                                      )
                                    }
                                    disabled={status === 'testing'}
                                    className="px-2.5 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-[#282828] border border-[#383838] text-xs text-[#b4b4b4] hover:text-[#ececec] transition-colors shrink-0 flex items-center gap-1.5"
                                  >
                                    <Activity
                                      className={`w-3.5 h-3.5 ${
                                        status === 'testing' ? 'animate-pulse text-amber-400' : ''
                                      } ${status === 'success' ? 'text-[#ececec]' : ''}`}
                                    />
                                    <span>
                                      {status === 'testing'
                                        ? 'Ping...'
                                        : latency
                                        ? `${latency}ms`
                                        : 'Test Ping'}
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleSaveEndpoint(k.provider)}
                                    className="px-3 py-1.5 rounded-xl bg-[#212121] hover:bg-white hover:text-black border border-[#383838] text-xs font-medium text-[#ececec] transition-colors shrink-0 flex items-center gap-1"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                    <span>Simpan</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Standard Providers Sub-Tab */}
                {activeModelTab === 'standard' && (
                  <div className="space-y-4">
                    {STANDARD_PROVIDERS.map((provider) => {
                      const existingKey = apiKeys.find((k) => k.provider === provider.id);
                      const isVisible = visibleKeyId === provider.id;
                      const status = testingStatus[provider.id];
                      const latency = latencies[provider.id];

                      return (
                        <div
                          key={provider.id}
                          className="p-4 rounded-2xl bg-[#282828] border border-[#383838] space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-[#ececec]">
                                {provider.name}
                              </div>
                              <p className="text-xs text-[#707070]">{provider.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {existingKey && (
                                <button
                                  type="button"
                                  onClick={() => toggleApiKey(provider.id)}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                                    existingKey.is_active
                                      ? 'bg-[#383838] border border-[#4f4f4f] text-[#ececec]'
                                      : 'bg-[#1e1e1e] border border-[#383838] text-[#707070]'
                                  }`}
                                >
                                  {existingKey.is_active ? 'Aktif' : 'Nonaktif'}
                                </button>
                              )}
                              <a
                                href={provider.docsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-[#ececec] hover:underline flex items-center gap-1"
                              >
                                <span>Get Key</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                type={isVisible ? 'text' : 'password'}
                                value={keyInputs[provider.id] ?? existingKey?.api_key ?? ''}
                                onChange={(e) =>
                                  setKeyInputs({ ...keyInputs, [provider.id]: e.target.value })
                                }
                                placeholder={provider.placeholder}
                                className="w-full bg-[#1e1e1e] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-[#ececec] font-mono focus:outline-none focus:border-[#4f4f4f] pr-8"
                              />
                              <button
                                type="button"
                                onClick={() => setVisibleKeyId(isVisible ? null : provider.id)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#707070] hover:text-[#ececec]"
                              >
                                {isVisible ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleTestConnection(
                                  provider.id,
                                  provider.defaultBaseUrl,
                                  keyInputs[provider.id] || existingKey?.api_key
                                )
                              }
                              disabled={status === 'testing'}
                              className="px-2.5 py-1.5 rounded-xl bg-[#1e1e1e] hover:bg-[#282828] border border-[#383838] text-xs text-[#b4b4b4] hover:text-[#ececec] transition-colors shrink-0 flex items-center gap-1.5"
                            >
                              <Activity
                                className={`w-3.5 h-3.5 ${
                                  status === 'testing' ? 'animate-pulse text-amber-400' : ''
                                } ${status === 'success' ? 'text-[#ececec]' : ''}`}
                              />
                              <span>
                                {status === 'testing'
                                  ? 'Ping...'
                                  : latency
                                  ? `${latency}ms`
                                  : 'Test Ping'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSaveEndpoint(provider.id)}
                              className="px-3.5 py-1.5 rounded-xl bg-[#212121] hover:bg-white hover:text-black border border-[#383838] text-xs font-medium text-[#ececec] transition-colors shrink-0 flex items-center gap-1"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Simpan</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 5. SKILLS TAB */}
            {activeSection === 'skills' && (
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between pb-2 border-b border-[#303030]">
                  <div>
                    <h3 className="text-sm font-semibold text-[#ececec]">Daftar Skills Terpasang</h3>
                    <p className="text-xs text-[#707070]">
                      Kemampuan khusus yang dapat diaktifkan oleh agen otonom.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#282828] border border-[#383838] text-[#ececec]">
                      {installedSkills.length} Terpasang
                    </span>
                    <button
                      type="button"
                      onClick={() => pickAndScanLocalSkills()}
                      className="px-3 py-1.5 rounded-xl bg-[#212121] hover:bg-[#2d2d2d] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors flex items-center gap-1.5"
                      title="Pilih folder lokal di laptop Anda untuk diimpor"
                    >
                      <FolderUp className="w-3.5 h-3.5 text-[#ececec]" />
                      <span>Impor Direktori Lokal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreateSkillModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-xs font-medium text-[#171717] transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah / Buat Skill</span>
                    </button>
                  </div>
                </div>

                {installedSkills.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-[#383838] rounded-2xl text-xs text-[#707070] space-y-3">
                    <p>Belum ada skills yang terpasang di proyek ini.</p>
                    <div className="flex items-center justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => pickAndScanLocalSkills()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#212121] hover:bg-[#2d2d2d] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors"
                      >
                        <FolderUp className="w-3.5 h-3.5 text-[#ececec]" />
                        <span>Impor dari Direktori Lokal</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCreateSkillModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#262626] hover:bg-[#303030] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Buat Skill Pertama</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {installedSkills.map((skill) => (
                      <div
                        key={skill.id}
                        className="p-3.5 rounded-2xl bg-[#282828] border border-[#383838] flex items-start justify-between gap-3 group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#ececec]">{skill.name}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e1e1e] text-[#b4b4b4] border border-[#383838]">
                              {skill.location}
                            </span>
                          </div>
                          <p className="text-xs text-[#707070] mt-1 line-clamp-2">
                            {skill.description}
                          </p>
                          <div className="text-[10px] font-mono text-[#555] mt-1 truncate">
                            {skill.path}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => uninstallSkill(skill.id)}
                          className="p-1.5 rounded-lg text-[#707070] hover:text-red-400 hover:bg-[#1e1e1e] transition-colors shrink-0"
                          title="Hapus skill"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 6. MCP SERVERS TAB */}
            {activeSection === 'mcp' && <McpServersTab />}

            {/* 7. MASCOT TAB */}
            {activeSection === 'mascot' && <MascotSettingsTab />}
          </div>
        </div>
      </motion.div>

      {/* Sub-modals */}
      <NetworkAccessRulesModal
        isOpen={isNetworkModalOpen}
        onClose={() => setIsNetworkModalOpen(false)}
      />
      <BrowserActuationRulesModal
        isOpen={isBrowserActuationModalOpen}
        onClose={() => setIsBrowserActuationModalOpen(false)}
      />
      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
      <CreateSkillModal
        isOpen={isCreateSkillModalOpen}
        onClose={() => setIsCreateSkillModalOpen(false)}
      />
    </div>
  );
};

export default SettingsModal;
