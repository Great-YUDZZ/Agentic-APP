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
  Command,
  MessageSquare,
  Monitor,
  Sun,
  Moon,
  ExternalLink,
  RotateCw,
  ChevronDown,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

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

type SettingsSection = 'general' | 'application' | 'appearance' | 'models' | 'skills';

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
    workspaceProjectRoot,
    pickAndSetWorkspaceRoot,
  } = useStore();

  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [activeModelTab, setActiveModelTab] = useState<'custom' | 'standard'>('custom');

  // API Key Management Form States
  const [visibleKeyId, setVisibleKeyId] = useState<string | null>(null);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [baseUrlInputs, setBaseUrlInputs] = useState<Record<string, string>>({});
  const [nameInputs, setNameInputs] = useState<Record<string, string>>({});
  const [testingStatus, setTestingStatus] = useState<Record<string, 'testing' | 'success' | 'failed'>>({});
  const [latencies, setLatencies] = useState<Record<string, number>>({});

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
                    <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
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
              onClick={() => {
                addToast('info', 'Pintasan: Ctrl+C (Emergency Stop), / (Slash Command), Enter (Kirim)');
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#707070] hover:text-[#ececec] transition-colors rounded-lg hover:bg-[#212121]"
            >
              <Command className="w-3.5 h-3.5" />
              <span>Shortcuts</span>
            </button>

            <a
              href="https://github.com/Great-YUDZZ/Agentic-APP/issues"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#707070] hover:text-[#ececec] transition-colors rounded-lg hover:bg-[#212121]"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Provide Feedback</span>
            </a>
          </div>
        </div>

        {/* Right Main Content Panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#212121]">
          {/* Top Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-[#2e2e2e]">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[#ececec] capitalize">
                {activeSection}
              </h2>
              <p className="text-xs text-[#b4b4b4] mt-0.5">
                {activeSection === 'general' && 'Configure agent execution, queued message delivery, and permissions.'}
                {activeSection === 'application' && 'Manage application runtime, sleep prevention, and notifications.'}
                {activeSection === 'appearance' && "Configure the agent's visual theme and display preferences."}
                {activeSection === 'models' && 'Manage AI endpoints, provider credentials, and model detection.'}
                {activeSection === 'skills' && 'Explore and configure installed skills for autonomous agents.'}
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
                      <div className="relative inline-flex items-center">
                        <select
                          value={settings.permissionPreset}
                          onChange={(e) =>
                            updateSettings({
                              permissionPreset: e.target.value as 'turbo' | 'standard' | 'strict',
                            })
                          }
                          className="appearance-none bg-[#1e1e1e] hover:bg-[#262626] border border-[#383838] rounded-xl pl-3 pr-8 py-1.5 text-xs text-[#ececec] focus:outline-none focus:border-[#4f4f4f] cursor-pointer transition-colors"
                        >
                          <option value="turbo" className="bg-[#212121] text-[#ececec]">Turbo (Auto Execution)</option>
                          <option value="standard" className="bg-[#212121] text-[#ececec]">Standard (Ask for Approval)</option>
                          <option value="strict" className="bg-[#212121] text-[#ececec]">Strict (Ask on All Tools)</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-[#707070] absolute right-2.5 pointer-events-none" />
                      </div>
                    </div>

                    {/* Installed Skills (Replaces Tools as requested) */}
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#ececec]">Installed Skills</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e1e1e] border border-[#383838] text-emerald-400">
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
                          Configure allowed and denied URLs for reading.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addToast('info', 'Network rules: Semua domain web diizinkan secara default.')}
                        className="px-3.5 py-1.5 rounded-xl bg-[#212121] hover:bg-[#303030] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors"
                      >
                        Open
                      </button>
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
                        Ketik <code className="bg-[#1e1e1e] px-1 py-0.5 rounded">/plan</code> di chat untuk meminta pembuatan rencana.
                      </div>
                    </div>
                    <div className="relative inline-flex items-center">
                      <select
                        value={settings.planReviewPolicy}
                        onChange={(e) =>
                          updateSettings({
                            planReviewPolicy: e.target.value as 'always_ask' | 'auto' | 'never',
                          })
                        }
                        className="appearance-none bg-[#1e1e1e] hover:bg-[#262626] border border-[#383838] rounded-xl pl-3 pr-8 py-1.5 text-xs text-[#ececec] focus:outline-none focus:border-[#4f4f4f] cursor-pointer transition-colors"
                      >
                        <option value="always_ask" className="bg-[#212121] text-[#ececec]">Always Ask</option>
                        <option value="auto" className="bg-[#212121] text-[#ececec]">Automatic Approval</option>
                        <option value="never" className="bg-[#212121] text-[#ececec]">Never Ask</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-[#707070] absolute right-2.5 pointer-events-none" />
                    </div>
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
                      <div className="relative inline-flex items-center">
                        <select
                          value={settings.browserJsPolicy}
                          onChange={(e) =>
                            updateSettings({
                              browserJsPolicy: e.target.value as 'request_review' | 'allow' | 'block',
                            })
                          }
                          className="appearance-none bg-[#1e1e1e] hover:bg-[#262626] border border-[#383838] rounded-xl pl-3 pr-8 py-1.5 text-xs text-[#ececec] focus:outline-none focus:border-[#4f4f4f] cursor-pointer transition-colors"
                        >
                          <option value="request_review" className="bg-[#212121] text-[#ececec]">Request Review</option>
                          <option value="allow" className="bg-[#212121] text-[#ececec]">Allow Always</option>
                          <option value="block" className="bg-[#212121] text-[#ececec]">Block</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-[#707070] absolute right-2.5 pointer-events-none" />
                      </div>
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
                        onClick={() => addToast('info', 'Actuation rules: Default allow.')}
                        className="px-3.5 py-1.5 rounded-xl bg-[#212121] hover:bg-[#303030] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors"
                      >
                        Edit
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
                          settings.preventSleep ? 'bg-blue-600' : 'bg-[#383838]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition-transform ${
                            settings.preventSleep ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[#ececec]">Keep In Menu Bar</div>
                        <div className="text-xs text-[#707070] mt-0.5">
                          Keep the app accessible from tray and running in background when closed.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateSettings({ keepInMenuBar: !settings.keepInMenuBar })}
                        className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                          settings.keepInMenuBar ? 'bg-blue-600' : 'bg-[#383838]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition-transform ${
                            settings.keepInMenuBar ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
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
                        To modify notification settings, open your operating system preferences.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addToast('info', 'Notifikasi desktop aktif dan auto-dismiss 2 detik.')}
                      className="px-3.5 py-1.5 rounded-xl bg-[#212121] hover:bg-[#303030] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors"
                    >
                      Open System Preferences
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-[#b4b4b4] uppercase tracking-wider mb-2">
                    Version
                  </h3>
                  <div className="p-4 rounded-2xl bg-[#282828] border border-[#383838] flex items-center justify-between">
                    <div className="text-sm font-medium text-[#ececec]">App Version</div>
                    <div className="text-xs font-mono text-[#b4b4b4]">0.1.0 (Tauri 2.0 + Tokio Native)</div>
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

                {/* Dark Theme Colors & Live Preview */}
                <div>
                  <h3 className="text-xs font-semibold text-[#b4b4b4] uppercase tracking-wider mb-2">
                    Dark Theme Palette
                  </h3>
                  <div className="p-4 rounded-2xl bg-[#282828] border border-[#383838] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#ececec]">Preset</span>
                      <div className="relative inline-flex items-center">
                        <select
                          value={settings.darkPreset}
                          onChange={(e) =>
                            updateSettings({
                              darkPreset: e.target.value as 'default' | 'charcoal' | 'oled',
                            })
                          }
                          className="appearance-none bg-[#1e1e1e] hover:bg-[#262626] border border-[#383838] rounded-xl pl-3 pr-8 py-1.5 text-xs text-[#ececec] focus:outline-none focus:border-[#4f4f4f] cursor-pointer transition-colors"
                        >
                          <option value="default" className="bg-[#212121] text-[#ececec]">Default Dark (ChatGPT #212121)</option>
                          <option value="charcoal" className="bg-[#212121] text-[#ececec]">Charcoal (#171717)</option>
                          <option value="oled" className="bg-[#212121] text-[#ececec]">OLED Deep Black (#000000)</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-[#707070] absolute right-2.5 pointer-events-none" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#333333] text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-[#212121] border border-[#444]" />
                        <span className="text-[#b4b4b4]">BG: #212121</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-[#ececec] border border-[#444]" />
                        <span className="text-[#b4b4b4]">FG: #ECECEC</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-[#3b82f6] border border-[#444]" />
                        <span className="text-[#b4b4b4]">Accent: #3B82F6</span>
                      </div>
                    </div>

                    {/* Live Syntax Code Preview Card */}
                    <div className="mt-3 p-3.5 rounded-xl bg-[#171717] border border-[#333333] font-mono text-xs leading-relaxed">
                      <span className="text-[#707070]">// Greet a user by name</span>
                      <br />
                      <span className="text-blue-400">const</span>{' '}
                      <span className="text-emerald-400">greet</span> = (
                      <span className="text-amber-300">name</span>: <span className="text-cyan-300">string</span>
                      ) =&gt; &#123;
                      <br />
                      &nbsp;&nbsp;<span className="text-rose-400">return</span>{' '}
                      <span className="text-emerald-300">`Hello, $&#123;name&#125;!`</span>;
                      <br />
                      &#125;;
                    </div>
                  </div>
                </div>

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
                          settings.verboseAgentChat ? 'bg-blue-600' : 'bg-[#383838]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition-transform ${
                            settings.verboseAgentChat ? 'translate-x-5' : 'translate-x-0'
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
                      <Server className="w-3.5 h-3.5 text-blue-400" />
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
                      <Cloud className="w-3.5 h-3.5 text-emerald-400" />
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
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
                                  className="bg-[#1e1e1e] border border-[#383838] rounded-lg px-2.5 py-1 text-xs text-[#ececec] font-medium focus:outline-none focus:border-blue-500 w-60"
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
                                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
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
                                    className="flex-1 bg-[#1e1e1e] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-[#ececec] font-mono focus:outline-none focus:border-blue-500"
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
                                      className="w-full bg-[#1e1e1e] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-[#ececec] font-mono focus:outline-none focus:border-blue-500 pr-8"
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
                                      } ${status === 'success' ? 'text-emerald-400' : ''}`}
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
                                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
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
                                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
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
                                className="w-full bg-[#1e1e1e] border border-[#383838] rounded-xl px-3 py-1.5 text-xs text-[#ececec] font-mono focus:outline-none focus:border-blue-500 pr-8"
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
                                } ${status === 'success' ? 'text-emerald-400' : ''}`}
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
                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#282828] border border-[#383838] text-emerald-400">
                    {installedSkills.length} Skills Siap Pakai
                  </span>
                </div>

                {installedSkills.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-[#383838] rounded-2xl text-xs text-[#707070]">
                    Belum ada skills yang terpasang di proyek ini.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {installedSkills.map((skill) => (
                      <div
                        key={skill.id}
                        className="p-3.5 rounded-2xl bg-[#282828] border border-[#383838] flex items-start justify-between gap-3"
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsModal;
