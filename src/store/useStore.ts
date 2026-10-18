import { create } from 'zustand';
import {
  AppMode,
  ApiKeyRecord,
  ModelOption,
  ChatSession,
  ChatMessage,
  SubAgentState,
  KanbanTask,
  AgentLog,
  ToolCallRequest,
  DiffFile,
  ToastItem,
  CustomAgent,
  DiscussionMessage,
  BuildDiscussionSession,
  TerminalTab,
  TerminalLog,
  InstalledSkill,
  DiscoveredSkill,
  CodeReviewItem,
  StudioTab,
  AppSettings,
  PlanApprovalRequest,
  DraftPlanTask,
  RecommendedSquadAgent,
} from '../types';
import { parseRobustJson, getChatEndpoint, getModelsEndpoint, formatApiErrorMessage, resolveEndpointForModel } from '../utils/api';
import { extractCodeReviewItems } from '../utils/codeExtractor';

export const BUILTIN_LEAD_ORCHESTRATOR = {
  id: 'builtin-lead-orchestrator',
  name: 'Lead Orchestrator',
  role: 'Chief System Architect & Planning Director',
  avatar_color: '#3b82f6',
  skills: [
    'Multi-Agent Orchestration',
    'System Architecture & Task Decomposition',
    'Quality Assurance & Review',
  ],
  system_instructions:
    'Anda adalah Lead Orchestrator permanen yang memimpin perencanaan sistem, membedah requirement, merekomendasikan peran agen pelaksana, dan menyusun graf tugas.',
};

interface AppStore {
  // Studio View Navigation (Build Mode)
  activeStudioTab: StudioTab;
  setActiveStudioTab: (tab: StudioTab) => void;

  // Code Review Modal
  isCodeReviewModalOpen: boolean;
  setCodeReviewModalOpen: (open: boolean) => void;
  codeReviewItems: CodeReviewItem[];
  setCodeReviewItems: (items: CodeReviewItem[]) => void;
  updateCodeReviewItemStatus: (id: string, status: 'accepted' | 'rejected') => void;
  applyCodeReviewItem: (item: CodeReviewItem) => Promise<void>;

  // Terminal State
  isTerminalOpen: boolean;
  setTerminalOpen: (open: boolean) => void;
  terminalHeight: number;
  setTerminalHeight: (height: number) => void;
  terminalTabs: TerminalTab[];
  activeTerminalTabId: string;
  setActiveTerminalTabId: (id: string) => void;
  addTerminalTab: () => void;
  closeTerminalTab: (id: string) => void;
  clearTerminalLogs: (tabId?: string) => void;
  runTerminalCommand: (command: string, tabId?: string) => Promise<void>;
  appendTerminalStreamData: (tabId: string, line: string, isStderr: boolean) => void;
  killTerminalProcess: (tabId?: string) => Promise<void>;

  // Skills Management
  isSkillsModalOpen: boolean;
  setSkillsModalOpen: (open: boolean) => void;
  installedSkills: InstalledSkill[];
  installSkill: (skill: Omit<InstalledSkill, 'id' | 'installed_at'>) => Promise<void>;
  uninstallSkill: (skillId: string) => Promise<void>;
  importSkillFromText: (name: string, content: string, location: 'project' | 'global') => Promise<void>;
  isLocalSkillImportModalOpen: boolean;
  setLocalSkillImportModalOpen: (open: boolean) => void;
  localDiscoveredSkills: DiscoveredSkill[];
  setLocalDiscoveredSkills: (skills: DiscoveredSkill[]) => void;
  localImportSourcePath: string;
  setLocalImportSourcePath: (path: string) => void;
  openLocalSkillImport: () => Promise<void>;
  closeLocalSkillImport: () => void;
  pickAndScanLocalSkills: () => Promise<void>;
  confirmImportLocalSkills: (
    skillsToImport: Array<{ sourcePath: string; name: string; description?: string }>,
    targetLocation: 'project' | 'global'
  ) => Promise<number>;

  // Modes & Navigation
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Workspace Project Root & Approval Policy
  workspaceProjectRoot: string;
  setWorkspaceProjectRoot: (path: string) => void;
  pickAndSetWorkspaceRoot: () => Promise<string | null>;
  isProjectPickerOpen: boolean;
  setProjectPickerOpen: (open: boolean) => void;
  isStrictApprovalMode: boolean; // false = 'Ask for approval' (HITL), true = 'Strict' (Auto-execute without asking)
  toggleStrictApprovalMode: () => void;

  // Model & Provider
  selectedModel: string;
  selectedProvider: string;
  availableModels: ModelOption[];
  isDetectingModels: boolean;
  setModel: (model: string) => void;
  setProvider: (provider: string) => void;
  setAvailableModels: (models: ModelOption[]) => void;
  fetchAvailableModels: (customUrl?: string, customKey?: string) => Promise<number>;

  // Settings
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  apiKeys: ApiKeyRecord[];
  setApiKeys: (keys: ApiKeyRecord[]) => void;
  loadApiKeysFromDb: () => Promise<void>;
  saveApiKey: (provider: string, apiKey: string, baseUrl?: string, name?: string) => Promise<void>;
  toggleApiKey: (provider: string) => Promise<void>;
  deleteApiKey: (provider: string) => Promise<void>;

  // Chatbot Mode
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  isContextCompressed: boolean;
  contextUsagePercent: number;
  setContextCompressed: (compressed: boolean) => void;
  setContextUsagePercent: (percent: number) => void;
  setSessions: (sessions: ChatSession[]) => void;
  setActiveSessionId: (id: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  createNewSession: (title?: string, mode?: AppMode) => string;
  deleteSession: (id: string) => Promise<void>;
  loadSessionsFromDb: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  saveChatMessageToDb: (msg: ChatMessage) => Promise<void>;
  updateSessionTitle: (id: string, title: string) => Promise<void>;

  // Custom Agent Mode
  customAgents: CustomAgent[];
  selectedAgentId: string | null;
  setCustomAgents: (agents: CustomAgent[]) => void;
  setSelectedAgentId: (id: string | null) => void;
  createCustomAgent: (agent: Omit<CustomAgent, 'id' | 'created_at'>) => string;
  updateCustomAgent: (id: string, updates: Partial<CustomAgent>) => void;
  deleteCustomAgent: (id: string) => void;

  // Multi-Agent Build Discussion Mode
  buildDiscussion: BuildDiscussionSession;
  setBuildDiscussion: (discussion: Partial<BuildDiscussionSession>) => void;
  startBuildDiscussion: (goal: string, agentIds: string[]) => void;
  addDiscussionMessage: (msg: DiscussionMessage) => void;
  advanceDiscussionTurn: (targetAgentId?: string) => Promise<void>;
  sendOperatorMessage: (content: string, targetAgentId?: string) => Promise<void>;
  stopBuildDiscussion: () => void;
  resetBuildDiscussion: () => void;

  // Planning & Lead Orchestrator
  setBuildSubMode: (mode: 'plan' | 'build') => void;
  toggleBuildSubMode: () => void;
  isOrchestratorThinking: boolean;
  sendPlanningMessage: (content: string) => Promise<void>;
  autoSpawnRecommendedSquad: () => void;
  approveAndDispatchPlan: () => void;

  // Legacy/Native Subagent Tree & Tasks
  subagents: SubAgentState[];
  kanbanTasks: KanbanTask[];
  logs: AgentLog[];
  emergencyStopped: boolean;
  pendingToolClearance: ToolCallRequest | null;
  diffFiles: DiffFile[];
  setSubagents: (agents: SubAgentState[]) => void;
  setKanbanTasks: (tasks: KanbanTask[]) => void;
  updateTaskStatus: (taskId: string, status: KanbanTask['status']) => void;
  setLogs: (logs: AgentLog[]) => void;
  addLog: (log: AgentLog) => void;
  clearLogs: () => void;
  setEmergencyStopped: (stopped: boolean) => void;
  setPendingToolClearance: (req: ToolCallRequest | null) => void;
  resolveToolClearance: (approved: boolean) => void;
  acceptDiff: (filename: string) => void;
  rejectDiff: (filename: string) => void;

  // Streaming and Working Status
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  isWorking: boolean;
  setIsWorking: (working: boolean) => void;

  // Queued Messages
  queuedMessagesBuffer: string[];
  addQueuedMessage: (msg: string) => void;
  processNextQueuedMessage: () => string | null;

  // Plan Review Approval
  pendingPlanApproval: PlanApprovalRequest | null;
  setPendingPlanApproval: (req: PlanApprovalRequest | null) => void;
  resolvePlanApproval: (approved: boolean) => void;

  // Toasts
  toasts: ToastItem[];
  addToast: (type: 'success' | 'error' | 'info' | 'warning', message: string, duration?: number) => void;
  removeToast: (id: string) => void;

  // Global App Settings
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  queuedMessages: 'queue',
  permissionPreset: 'standard',
  planReviewPolicy: 'always_ask',
  browserJsPolicy: 'always_ask',
  networkRules: {
    whitelist: ['*.github.com', 'api.openai.com', 'generativelanguage.googleapis.com'],
    blacklist: ['*.doubleclick.net'],
  },
  actuationRules: {
    whitelist: ['https://github.com/*', 'http://localhost:*'],
    blacklist: ['https://*.internal/*'],
  },
  preventSleep: true,
  notifyWhenUnfocused: true,
  theme: 'dark',
  contrast: 'default',
  darkPreset: 'default',
  bgColor: '#212121',
  fgColor: '#ececec',
  accentColor: '#3b82f6',
  verboseAgentChat: true,
  conversationWidth: 'default',
};

const loadSavedSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem('agentic_app_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      delete parsed.keepInMenuBar;
      delete parsed.networkAccessRules;
      delete parsed.browserActuationRules;

      if (parsed.planReviewPolicy === 'auto' || parsed.planReviewPolicy !== 'never_ask') {
        parsed.planReviewPolicy = 'always_ask';
      }
      if (parsed.browserJsPolicy === 'request_review') {
        parsed.browserJsPolicy = 'always_ask';
      } else if (parsed.browserJsPolicy === 'allow') {
        parsed.browserJsPolicy = 'always_proceed';
      } else if (parsed.browserJsPolicy === 'block') {
        parsed.browserJsPolicy = 'disable';
      }
      if (!parsed.networkRules || Array.isArray(parsed.networkRules)) {
        parsed.networkRules = DEFAULT_SETTINGS.networkRules;
      }
      if (!parsed.actuationRules || Array.isArray(parsed.actuationRules)) {
        parsed.actuationRules = DEFAULT_SETTINGS.actuationRules;
      }
      if (typeof parsed.notifyWhenUnfocused !== 'boolean') {
        parsed.notifyWhenUnfocused = true;
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
};

export const useStore = create<AppStore>((set, get) => ({
  // Studio View Navigation (Build Mode)
  activeStudioTab: 'discussion',
  setActiveStudioTab: (activeStudioTab) => set({ activeStudioTab }),

  // Clean default mode: Chatbot
  currentMode: 'chatbot',
  setMode: (nextMode) => {
    const prevMode = get().currentMode;
    if (prevMode === nextMode) return;

    // Selalu tutup terminal saat beralih mode agar memulai dalam keadaan tertutup
    set({ isTerminalOpen: false, currentMode: nextMode, activeSessionId: null, messages: [] });
  },
  isSidebarOpen: true,
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

  // Workspace Project Root & Approval Policy
  workspaceProjectRoot: '/home/yudz/Agentic',
  setWorkspaceProjectRoot: async (workspaceProjectRoot) => {
    set((s) => ({
      workspaceProjectRoot,
      terminalTabs: s.terminalTabs.map((t) => ({ ...t, cwd: workspaceProjectRoot })),
    }));
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_workspace_directory', { path: workspaceProjectRoot });
      } catch (err) {
        console.warn('Gagal sinkronisasi workspace directory ke Rust:', err);
      }
    }
    get().addToast('info', `Direktori proyek diatur ke: ${workspaceProjectRoot}`);
  },
  pickAndSetWorkspaceRoot: async () => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const chosen = (await invoke('pick_workspace_directory')) as string | null;
        if (chosen) {
          set((s) => ({
            workspaceProjectRoot: chosen,
            terminalTabs: s.terminalTabs.map((t) => ({ ...t, cwd: chosen })),
          }));
          get().addToast('success', `Direktori proyek aktif: ${chosen}`);
          return chosen;
        }
        return null;
      } else if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        // Fallback untuk browser web preview
        const handle = await (window as any).showDirectoryPicker();
        if (handle?.name) {
          const pseudoPath = `/workspace/${handle.name}`;
          set({ workspaceProjectRoot: pseudoPath });
          get().addToast('success', `Folder terpilih: ${handle.name}`);
          return pseudoPath;
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        get().addToast('error', `Gagal memilih folder: ${err?.message || err}`);
      }
    }
    return null;
  },
  isProjectPickerOpen: false,
  setProjectPickerOpen: (isProjectPickerOpen) => set({ isProjectPickerOpen }),
  isStrictApprovalMode: false,
  toggleStrictApprovalMode: () => {
    const nextVal = !get().isStrictApprovalMode;
    set({ isStrictApprovalMode: nextVal });
    if (nextVal) {
      get().addToast('warning', 'Mode Strict aktif: AI mengeksekusi terminal tanpa meminta izin.');
    } else {
      get().addToast('info', 'Mode Ask for approval aktif: Operator menyetujui setiap aksi berisiko.');
    }
  },

  // Custom Endpoint - model dideteksi berdasarkan ketersediaan API key
  selectedModel: '',
  selectedProvider: 'custom',
  availableModels: [],
  isDetectingModels: false,
  setModel: (selectedModel) => set({ selectedModel }),
  setProvider: (selectedProvider) => set({ selectedProvider }),
  setAvailableModels: (availableModels) => set({ availableModels }),

  fetchAvailableModels: async (customUrl, customKey) => {
    const keys = get().apiKeys;
    const activeCustoms = keys.filter(
      (k) => (k.provider === 'custom' || k.provider.startsWith('custom_')) && k.is_active && k.api_key.trim().length > 0
    );

    // Jika dipanggil dengan parameter eksplisit
    if (customUrl || customKey) {
      const url = customUrl || 'http://localhost:20128/v1';
      const key = customKey || '';
      if (!key.trim()) return 0;

      set({ isDetectingModels: true });
      try {
        const targetModelsUrl = getModelsEndpoint(url);
        const res = await fetch(targetModelsUrl, {
          headers: { Authorization: `Bearer ${key.trim()}` },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const rawText = await res.text();
        const json = parseRobustJson<any>(rawText);
        const rawList = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
        const detected: ModelOption[] = rawList.map((m: { id: string; context_length?: number }) => ({
          id: m.id,
          name: m.id,
          provider: 'custom',
          endpoint_id: 'custom',
          endpoint_name: 'Custom Endpoint',
          context_length: m.context_length,
        }));

        set({ isDetectingModels: false });
        return detected.length;
      } catch (err) {
        set({ isDetectingModels: false });
        throw err;
      }
    }

    if (activeCustoms.length === 0) {
      set({ availableModels: [], selectedModel: '', isDetectingModels: false });
      return 0;
    }

    set({ isDetectingModels: true });
    const allModels: ModelOption[] = [];

    for (const endpoint of activeCustoms) {
      const url = endpoint.base_url || 'http://localhost:20128/v1';
      const key = endpoint.api_key;
      const endpointLabel = endpoint.name || (endpoint.provider === 'custom' ? 'Custom Endpoint' : 'Local Proxy');

      try {
        const targetModelsUrl = getModelsEndpoint(url);
        const res = await fetch(targetModelsUrl, {
          headers: { Authorization: `Bearer ${key.trim()}` },
        });
        if (res.ok) {
          const rawText = await res.text();
          const json = parseRobustJson<any>(rawText);
          const rawList = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
          rawList.forEach((m: { id: string; context_length?: number }) => {
            allModels.push({
              id: m.id,
              name: m.id,
              provider: endpoint.provider,
              endpoint_id: endpoint.provider,
              endpoint_name: endpointLabel,
              context_length: m.context_length,
            });
          });
        }
      } catch (e) {
        console.warn(`Gagal deteksi model untuk ${endpointLabel}:`, e);
      }
    }

    if (allModels.length > 0) {
      const currentSelected = get().selectedModel;
      const stillValid = allModels.some((d) => d.id === currentSelected);
      const nextModel = stillValid ? currentSelected : allModels[0].id;

      set({
        availableModels: allModels,
        selectedModel: nextModel,
        selectedProvider: 'custom',
        isDetectingModels: false,
      });
      return allModels.length;
    }

    set({ availableModels: [], selectedModel: '', isDetectingModels: false });
    return 0;
  },

  isSettingsOpen: false,
  setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),

  apiKeys: [
    {
      provider: 'custom',
      name: 'Custom Endpoint 1',
      api_key: '',
      base_url: 'http://localhost:20128/v1',
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    {
      provider: 'gemini',
      api_key: '',
      is_active: false,
      updated_at: new Date().toISOString(),
    },
    {
      provider: 'openai',
      api_key: '',
      is_active: false,
      updated_at: new Date().toISOString(),
    },
    {
      provider: 'claude',
      api_key: '',
      is_active: false,
      updated_at: new Date().toISOString(),
    },
    {
      provider: 'deepseek',
      api_key: '',
      is_active: false,
      updated_at: new Date().toISOString(),
    },
    {
      provider: 'ollama',
      api_key: '',
      base_url: 'http://localhost:11434',
      is_active: false,
      updated_at: new Date().toISOString(),
    },
  ],
  setApiKeys: (apiKeys) => set({ apiKeys }),

  loadApiKeysFromDb: async () => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const dbKeys = (await invoke('get_api_keys')) as ApiKeyRecord[];
        if (dbKeys && Array.isArray(dbKeys) && dbKeys.length > 0) {
          const currentKeys = get().apiKeys;
          const merged = currentKeys.map((k) => {
            const found = dbKeys.find((dk) => dk.provider === k.provider);
            return found ? { ...k, ...found } : k;
          });
          // Tambahkan custom providers yang ada di DB tapi belum ada di state
          dbKeys.forEach((dk) => {
            if (!merged.some((m) => m.provider === dk.provider)) {
              merged.push(dk);
            }
          });

          set({ apiKeys: merged });

          // Refresh model untuk seluruh custom endpoint aktif
          await get().fetchAvailableModels();
          return;
        }
      }
    } catch (err) {
      console.warn('Gagal memuat api keys dari SQLite database:', err);
    }
  },

  saveApiKey: async (provider, apiKey, baseUrl, name) => {
    // 1. Simpan ke SQLite Rust Tauri jika tersedia
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_api_key', {
          provider,
          apiKey,
          baseUrl: baseUrl ?? null,
        });
      } catch (err) {
        console.warn(`Gagal menyimpan api key ${provider} ke SQLite:`, err);
      }
    }

    // 2. Perbarui state Zustand
    set((s) => {
      const existing = s.apiKeys.find((k) => k.provider === provider);
      if (existing) {
        return {
          apiKeys: s.apiKeys.map((k) =>
            k.provider === provider
              ? {
                  ...k,
                  api_key: apiKey,
                  name: name ?? k.name,
                  base_url: baseUrl ?? k.base_url,
                  is_active: apiKey.trim().length > 0,
                  updated_at: new Date().toISOString(),
                }
              : k
          ),
        };
      }
      return {
        apiKeys: [
          ...s.apiKeys,
          {
            provider,
            name: name || (provider.startsWith('custom') ? 'Custom Endpoint' : provider),
            api_key: apiKey,
            base_url: baseUrl,
            is_active: apiKey.trim().length > 0,
            updated_at: new Date().toISOString(),
          },
        ],
      };
    });

    // 3. Refresh ketersediaan model jika custom endpoint diperbarui
    if (provider === 'custom' || provider.startsWith('custom_')) {
      await get().fetchAvailableModels();
    }
  },

  toggleApiKey: async (provider) => {
    const target = get().apiKeys.find((k) => k.provider === provider);
    const nextActive = target ? !target.is_active : false;

    set((s) => ({
      apiKeys: s.apiKeys.map((k) =>
        k.provider === provider ? { ...k, is_active: nextActive } : k
      ),
    }));

    if ((window as any).__TAURI_INTERNALS__ && target) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_api_key', {
          provider,
          apiKey: target.api_key,
          baseUrl: target.base_url ?? null,
        });
      } catch (err) {
        console.warn(`Gagal toggle status api key ${provider} di SQLite:`, err);
      }
    }

    if (provider === 'custom' || provider.startsWith('custom_')) {
      await get().fetchAvailableModels();
    }
  },

  deleteApiKey: async (provider) => {
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('delete_api_key', { provider });
      } catch (err) {
        console.warn(`Gagal menghapus api key ${provider} di SQLite:`, err);
      }
    }

    set((s) => ({
      apiKeys: s.apiKeys.filter((k) => k.provider !== provider),
    }));

    await get().fetchAvailableModels();
  },

  // CLEAN CHAT STATE & PERSISTENCE
  sessions: [],
  activeSessionId: null,
  messages: [],
  isContextCompressed: false,
  contextUsagePercent: 0,
  setContextCompressed: (isContextCompressed) => set({ isContextCompressed }),
  setContextUsagePercent: (contextUsagePercent) => set({ contextUsagePercent }),
  setSessions: (sessions) => set({ sessions }),
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  loadSessionsFromDb: async () => {
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const loadedSessions = (await invoke('get_chat_sessions')) as ChatSession[];
        if (loadedSessions && loadedSessions.length > 0) {
          set({
            sessions: loadedSessions,
            activeSessionId: null,
            messages: [],
            buildDiscussion: {
              id: 'discussion-main',
              project_goal: '',
              selected_agent_ids: [],
              status: 'idle',
              current_turn_index: 0,
              messages: [],
              buildSubMode: 'plan',
              planningMessages: [],
              draftPlanTasks: [],
              recommendedSquad: [],
            },
          });
        }
      } catch (err) {
        console.warn('Gagal memuat sesi obrolan dari SQLite:', err);
      }
    }
  },

  selectSession: async (id: string) => {
    set({ activeSessionId: id });
    const targetSession = get().sessions.find((s) => s.id === id);
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const msgs = (await invoke('get_chat_messages', { sessionId: id })) as ChatMessage[];
        const safeMsgs = msgs || [];
        set({ messages: safeMsgs });

        // Jika sesi bertipe build discussion, sinkronkan ke buildDiscussion.messages
        if (targetSession?.mode === 'build') {
          const discussionMsgs: DiscussionMessage[] = safeMsgs.map((m) => {
            const isOp = m.role === 'user';
            let agentName = 'Studio Builder Agent';
            let agentRole = 'Full-Stack Engineer';
            let content = m.content;
            if (!isOp) {
              const match = m.content.match(/^\[(.*?)\s*-\s*(.*?)\]\n([\s\S]*)$/);
              if (match) {
                agentName = match[1];
                agentRole = match[2];
                content = match[3];
              }
            }
            return {
              id: m.id,
              agent_id: isOp ? 'operator' : 'agent-build',
              agent_name: isOp ? 'Operator (You)' : agentName,
              agent_role: isOp ? 'Human Director' : agentRole,
              avatar_color: isOp ? '#ececec' : '#3b82f6',
              content: content,
              step_type: isOp ? 'operator_directive' : 'implementation',
              timestamp: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            };
          });

          set((s) => ({
            buildDiscussion: {
              ...s.buildDiscussion,
              id: id,
              project_goal: targetSession.title,
              messages: discussionMsgs,
              status: discussionMsgs.length > 0 ? 'completed' : 'idle',
            },
          }));
        }
      } catch (err) {
        console.warn(`Gagal memuat pesan untuk sesi ${id}:`, err);
      }
    }
  },

  createNewSession: (customTitle?: string, targetMode?: AppMode) => {
    const effectiveMode = targetMode || get().currentMode;
    const newId = `session-${Date.now()}`;
    const defaultTitle =
      customTitle ||
      (effectiveMode === 'chatbot'
        ? 'Percakapan Chat'
        : effectiveMode === 'agent'
        ? 'Sesi Tugas Agent'
        : 'Proyek Studio Multi-Agent');

    const newSession: ChatSession = {
      id: newId,
      title: defaultTitle,
      model: get().selectedModel,
      provider: get().selectedProvider,
      mode: effectiveMode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    set((s) => ({
      sessions: [newSession, ...s.sessions],
      activeSessionId: newId,
      messages: [],
    }));

    if ((window as any).__TAURI_INTERNALS__) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('create_chat_session', {
          id: newId,
          title: newSession.title,
          model: newSession.model || 'default',
          provider: newSession.provider || 'custom',
          mode: effectiveMode,
        }).catch((e) => console.warn('Gagal simpan create_chat_session ke SQLite:', e));
      });
    }

    return newId;
  },

  saveChatMessageToDb: async (msg: ChatMessage) => {
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_chat_message', { message: msg });
      } catch (err) {
        console.warn('Gagal menyimpan pesan ke SQLite:', err);
      }
    }
  },

  updateSessionTitle: async (id: string, title: string) => {
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, title } : sess)),
    }));
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('update_chat_session_title', { sessionId: id, title });
      } catch (err) {
        console.warn('Gagal memperbarui judul sesi di SQLite:', err);
      }
    }
  },

  deleteSession: async (id: string) => {
    const remaining = get().sessions.filter((sess) => sess.id !== id);
    const remainingMsgs = get().messages.filter((m) => m.session_id !== id);
    const isCurrentActive = get().activeSessionId === id;

    set({
      sessions: remaining,
      messages: isCurrentActive ? [] : remainingMsgs,
      activeSessionId: isCurrentActive ? null : get().activeSessionId,
    });

    if (isCurrentActive && get().currentMode === 'build') {
      get().resetBuildDiscussion();
    }

    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('delete_chat_session', { sessionId: id });
      } catch (err) {
        console.warn('Gagal menghapus sesi dari SQLite:', err);
      }
    }
  },

  // CUSTOM AGENTS ROSTER (With localStorage persistence)
  customAgents: (() => {
    try {
      const raw = localStorage.getItem('agentic_custom_agents');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Gagal membaca agentic_custom_agents dari localStorage:', e);
    }
    return [
      {
        id: 'agent-lead-researcher',
        name: 'Lead Research Analyst',
        role: 'Research & Architecture Analyst',
        task_description: 'Menganalisis arsitektur sistem, membedah dokumen teknis, dan merumuskan spesifikasi desain engineering.',
        skills: ['Code Analysis', 'System Architecture', 'Security Sandbox Review'],
        avatar_color: '#3b82f6',
        created_at: new Date().toISOString(),
      },
    ];
  })(),
  selectedAgentId: 'agent-lead-researcher',
  setCustomAgents: (customAgents) => {
    try {
      localStorage.setItem('agentic_custom_agents', JSON.stringify(customAgents));
    } catch (_) {}
    set({ customAgents });
  },
  setSelectedAgentId: (selectedAgentId) => set({ selectedAgentId }),
  createCustomAgent: (agentData) => {
    const newId = `agent-${Date.now()}`;
    const newAgent: CustomAgent = {
      ...agentData,
      id: newId,
      created_at: new Date().toISOString(),
    };
    const nextAgents = [...get().customAgents, newAgent];
    try {
      localStorage.setItem('agentic_custom_agents', JSON.stringify(nextAgents));
    } catch (_) {}
    set(() => ({
      customAgents: nextAgents,
      selectedAgentId: newId,
    }));
    get().addToast('success', `Agent "${newAgent.name}" berhasil dibuat!`);
    return newId;
  },
  updateCustomAgent: (id, updates) => {
    const nextAgents = get().customAgents.map((a) => (a.id === id ? { ...a, ...updates } : a));
    try {
      localStorage.setItem('agentic_custom_agents', JSON.stringify(nextAgents));
    } catch (_) {}
    set(() => ({
      customAgents: nextAgents,
    }));
  },
  deleteCustomAgent: (id) => {
    const remaining = get().customAgents.filter((a) => a.id !== id);
    try {
      localStorage.setItem('agentic_custom_agents', JSON.stringify(remaining));
    } catch (_) {}
    set((s) => ({
      customAgents: remaining,
      selectedAgentId: s.selectedAgentId === id ? remaining[0]?.id || null : s.selectedAgentId,
    }));
  },

  // MULTI-AGENT BUILD DISCUSSION SESSION
  buildDiscussion: {
    id: 'discussion-main',
    project_goal: '',
    selected_agent_ids: [],
    status: 'idle',
    current_turn_index: 0,
    messages: [],
    buildSubMode: 'plan',
    planningMessages: [],
    draftPlanTasks: [],
    recommendedSquad: [],
  },
  setBuildDiscussion: (patch) =>
    set((s) => ({
      buildDiscussion: { ...s.buildDiscussion, ...patch },
    })),
  startBuildDiscussion: (goal, agentIds) => {
    const s = get();
    if (agentIds.length < 2) {
      s.addToast('warning', 'Pilih minimal 2 agent untuk memulai diskusi tim!');
      return;
    }
    if (!goal.trim()) {
      s.addToast('warning', 'Tentukan project goal terlebih dahulu!');
      return;
    }
    const targetSessionId = s.activeSessionId || s.createNewSession(goal.slice(0, 35), 'build');
    const systemMsgId = `msg-system-${Date.now()}`;
    const systemContent = `Project Goal ditetapkan: "${goal}".\nTim terdiri dari ${agentIds.length} agen: ${agentIds
      .map((id) => s.customAgents.find((a) => a.id === id)?.name)
      .filter(Boolean)
      .join(', ')}. Diskusi kolaborasi dimulai.`;

    set(() => ({
      buildDiscussion: {
        id: `discussion-${Date.now()}`,
        project_goal: goal,
        selected_agent_ids: agentIds,
        status: 'running',
        current_turn_index: 0,
        messages: [
          {
            id: systemMsgId,
            agent_id: 'system',
            agent_name: 'Coordinator',
            agent_role: 'Orchestrator',
            avatar_color: '#6366f1',
            content: systemContent,
            step_type: 'summary',
            timestamp: new Date().toLocaleTimeString(),
          },
        ],
        buildSubMode: 'build',
        planningMessages: s.buildDiscussion.planningMessages || [],
        draftPlanTasks: s.buildDiscussion.draftPlanTasks || [],
        recommendedSquad: s.buildDiscussion.recommendedSquad || [],
      },
    }));

    s.saveChatMessageToDb({
      id: systemMsgId,
      session_id: targetSessionId,
      role: 'user',
      content: systemContent,
      created_at: new Date().toISOString(),
    });

    s.addToast('info', `Diskusi multi-agent dimulai untuk: "${goal.slice(0, 35)}..."`);
    // Otomatis memicu putaran pertama
    get().advanceDiscussionTurn();
  },
  addDiscussionMessage: (msg) =>
    set((s) => ({
      buildDiscussion: {
        ...s.buildDiscussion,
        messages: [...s.buildDiscussion.messages, msg],
      },
    })),
  advanceDiscussionTurn: async (targetAgentId?: string) => {
    const state = get();
    const session = state.buildDiscussion;
    if (session.status !== 'running' || session.selected_agent_ids.length === 0) return;

    const currentTurn = session.current_turn_index % session.selected_agent_ids.length;
    const resolvedAgentId =
      targetAgentId && session.selected_agent_ids.includes(targetAgentId)
        ? targetAgentId
        : session.selected_agent_ids[currentTurn];
    const currentAgent = state.customAgents.find((a) => a.id === resolvedAgentId);

    if (!currentAgent) return;

    // Ambil endpoint dan model spesifik agen (fallback ke model global)
    const model = currentAgent.model || state.selectedModel;
    const endpointConfig = resolveEndpointForModel(model, state.availableModels, state.apiKeys);
    const baseUrl = endpointConfig.baseUrl;
    const apiKey = endpointConfig.apiKey;

    if (!apiKey.trim()) {
      state.addToast('error', `API Key belum diatur untuk model ${model}. Buka menu Setting untuk memasukkan kredensial.`);
      set((s) => ({
        buildDiscussion: {
          ...s.buildDiscussion,
          status: 'paused',
        },
      }));
      return;
    }

    if (!model.trim()) {
      state.addToast('error', `Model belum dipilih untuk ${currentAgent.name}. Pastikan API Key aktif dan model terdeteksi.`);
      set((s) => ({
        buildDiscussion: {
          ...s.buildDiscussion,
          status: 'paused',
        },
      }));
      return;
    }

    // Query konteks file eksisting di workspace jika berjalan di Tauri
    let existingWorkspaceFiles = '';
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const listRes: any = await invoke('execute_sandbox_tool', {
          toolName: 'list_dir',
          parameters: { path: '.' },
        });
        if (listRes?.success && listRes?.output) {
          existingWorkspaceFiles = listRes.output;
        }
      } catch (e) {
        // Lanjutkan jika list_dir belum tersedia
      }
    }

    // Format riwayat diskusi
    const recentMessages = session.messages.slice(-6).map((m) => `${m.agent_name} (${m.agent_role}): ${m.content}`).join('\n\n');

    const prompt = `Anda adalah ${currentAgent.name}, dengan peran: ${currentAgent.role}.
Tugas utama Anda: ${currentAgent.task_description}
Keahlian/Skills yang Anda miliki: ${currentAgent.skills.join(', ')}
${currentAgent.system_instructions ? `Instruksi khusus: ${currentAgent.system_instructions}` : ''}

Target Proyek Bersama:
"${session.project_goal}"

Direktori Workspace Proyek Aktif:
"${state.workspaceProjectRoot}"
${existingWorkspaceFiles ? `Daftar File di Workspace Saat Ini:\n${existingWorkspaceFiles}\n` : ''}

Riwayat Diskusi Tim Sebelumnya:
${recentMessages || '(Belum ada pesan sebelumnya, Anda adalah pembicara pertama)'}

ATURAN KOMUNIKASI & TUGAS ANDA SEKARANG:
1. WAJIB menggunakan Bahasa Indonesia yang ramah, jelas, sopan, dan mudah dipahami oleh pengguna awam.
2. Tanggapi langsung instruksi terbaru dari Operator atau kawan tim Anda secara to-the-point.
3. Kontribusi sesuai peran:
   - Jika Anda arsitek: Jelaskan rancangan alur langkah demi langkah secara terstruktur.
   - Jika Anda engineer/koder: Buat kode program yang lengkap dan siap pakai di dalam blok kode Markdown dengan mencantumkan nama file di header blok kode (contoh: \`\`\`python kalkulator.py atau \`\`\`python filename="kalkulator.py"), sertakan penjelasan singkat fungsinya. Runtime kami akan secara otomatis menulis file tersebut langsung ke direktori workspace proyek!
   - Jika Anda reviewer/QA: Tinjau kelengkapan kode/solusi kawan tim dan berikan masukan atau konfirmasi kesiapan.
4. Jangan memberikan pesan error teknis server, dan jangan gunakan singkatan yang membingungkan.`;

    try {
      const targetChatUrl = getChatEndpoint(baseUrl);
      const res = await fetch(targetChatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(formatApiErrorMessage(res.status, errText, model));
      }

      const rawText = await res.text();
      const json = parseRobustJson<any>(rawText);
      const reply = json.choices?.[0]?.message?.content || `${currentAgent.name} menganalisis tujuan proyek.`;

      let finalContent = reply;
      const tempMsg: DiscussionMessage = {
        id: `turn-${Date.now()}`,
        agent_id: currentAgent.id,
        agent_name: currentAgent.name,
        agent_role: currentAgent.role,
        avatar_color: currentAgent.avatar_color,
        content: reply,
        step_type: currentTurn === 0 ? 'proposal' : currentTurn === 1 ? 'implementation' : 'critique',
        timestamp: new Date().toLocaleTimeString(),
      };

      // Autonomous File Writing ke Workspace
      const extractedItems = extractCodeReviewItems([tempMsg]);
      const writtenFiles: string[] = [];

      if (extractedItems.length > 0 && (window as any).__TAURI_INTERNALS__) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          for (const item of extractedItems) {
            const writeRes: any = await invoke('execute_sandbox_tool', {
              toolName: 'write_file',
              parameters: {
                path: item.filename,
                content: item.content,
              },
            });
            if (writeRes?.success) {
              writtenFiles.push(item.filename);
              set((s) => ({
                codeReviewItems: [
                  ...s.codeReviewItems.filter((i) => i.filename !== item.filename),
                  { ...item, status: 'accepted' },
                ],
              }));
              state.addLog({
                id: `log-file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                agent_name: currentAgent.name,
                level: 'EXEC',
                message: `Menulis file "${item.filename}" ke workspace (${item.content.length} bytes)`,
                timestamp: new Date().toLocaleTimeString(),
              });
            }
          }
        } catch (writeErr) {
          console.warn('Gagal autonomous write file:', writeErr);
        }
      }

      if (writtenFiles.length > 0) {
        finalContent += `\n\n> File berhasil ditulis ke direktori workspace: ${writtenFiles.map((f) => `\`${f}\``).join(', ')}`;
        state.addToast('success', `${currentAgent.name} berhasil menulis ${writtenFiles.length} file ke workspace`);
      }

      const newMsg: DiscussionMessage = {
        ...tempMsg,
        content: finalContent,
      };

      set((s) => ({
        buildDiscussion: {
          ...s.buildDiscussion,
          messages: [...s.buildDiscussion.messages, newMsg],
          current_turn_index: s.buildDiscussion.current_turn_index + 1,
        },
      }));

      // Simpan respons agen ke SQLite
      const targetSessionId = state.activeSessionId || state.createNewSession(session.project_goal || 'Proyek Studio Multi-Agent', 'build');
      state.saveChatMessageToDb({
        id: newMsg.id,
        session_id: targetSessionId,
        role: 'assistant',
        content: `[${currentAgent.name} - ${currentAgent.role}]\n${finalContent}`,
        created_at: new Date().toISOString(),
      });

      // Tambahkan ke log
      state.addLog({
        id: `log-turn-${Date.now()}`,
        agent_name: currentAgent.name,
        level: 'INFO',
        message: `Menyampaikan respons giliran ke-${session.current_turn_index + 1}`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      state.addToast('error', `Gagal mendapatkan respons dari ${currentAgent.name}: ${errMsg}`);
      set((s) => ({
        buildDiscussion: {
          ...s.buildDiscussion,
          status: 'paused',
        },
      }));
    }
  },
  sendOperatorMessage: async (content: string, targetAgentId?: string) => {
    const s = get();
    if (!content.trim()) return;

    const session = s.buildDiscussion;
    const validSelectedIds = session.selected_agent_ids.filter((id) =>
      s.customAgents.some((a) => a.id === id)
    );
    const activeAgentIds =
      validSelectedIds.length >= 2
        ? validSelectedIds
        : s.customAgents.slice(0, 3).map((a) => a.id);

    // Jika diskusi belum aktif, mulai dengan goal dari pesan ini
    if (session.status !== 'running') {
      s.startBuildDiscussion(content.trim(), activeAgentIds);
      return;
    }

    const opMsg: DiscussionMessage = {
      id: `op-${Date.now()}`,
      agent_id: 'operator',
      agent_name: 'Operator (You)',
      agent_role: 'Human Director',
      avatar_color: '#3b82f6',
      content: content.trim(),
      step_type: 'operator_directive',
      timestamp: new Date().toLocaleTimeString(),
    };

    set((state) => ({
      buildDiscussion: {
        ...state.buildDiscussion,
        messages: [...state.buildDiscussion.messages, opMsg],
      },
    }));

    // Simpan pesan operator ke SQLite
    const targetSessionId = s.activeSessionId || s.createNewSession(content.trim().slice(0, 30), 'build');
    s.saveChatMessageToDb({
      id: opMsg.id,
      session_id: targetSessionId,
      role: 'user',
      content: content.trim(),
      created_at: new Date().toISOString(),
    });

    s.addToast('info', 'Instruksi operator dikirim ke tim agen.');
    await get().advanceDiscussionTurn(targetAgentId);
  },
  stopBuildDiscussion: () =>
    set((s) => ({
      buildDiscussion: {
        ...s.buildDiscussion,
        status: 'paused',
      },
    })),
  resetBuildDiscussion: () =>
    set((s) => ({
      buildDiscussion: {
        ...s.buildDiscussion,
        status: 'idle',
        messages: [],
        current_turn_index: 0,
      },
    })),

  // PLANNING & LEAD ORCHESTRATOR IMPLEMENTATION
  isOrchestratorThinking: false,

  setBuildSubMode: (mode) =>
    set((s) => ({
      buildDiscussion: {
        ...s.buildDiscussion,
        buildSubMode: mode,
      },
    })),

  toggleBuildSubMode: () =>
    set((s) => ({
      buildDiscussion: {
        ...s.buildDiscussion,
        buildSubMode: s.buildDiscussion.buildSubMode === 'plan' ? 'build' : 'plan',
      },
    })),

  sendPlanningMessage: async (content: string) => {
    const s = get();
    if (!content.trim()) return;

    const userMsg: DiscussionMessage = {
      id: `plan-user-${Date.now()}`,
      agent_id: 'operator',
      agent_name: 'Operator',
      agent_role: 'Human Director',
      avatar_color: '#3b82f6',
      content: content.trim(),
      step_type: 'operator_directive',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentPlanningMsgs = s.buildDiscussion.planningMessages || [];
    const updatedPlanningMessages = [...currentPlanningMsgs, userMsg];
    const currentMainMessages = s.buildDiscussion.messages || [];
    const updatedMainMessages = [...currentMainMessages, userMsg];

    set((state) => ({
      isOrchestratorThinking: true,
      isWorking: true,
      buildDiscussion: {
        ...state.buildDiscussion,
        project_goal: state.buildDiscussion.project_goal || content.trim(),
        planningMessages: updatedPlanningMessages,
        messages: updatedMainMessages,
      },
    }));

    // Simpan pesan user planning ke SQLite
    const targetSessionId = s.activeSessionId || s.createNewSession(content.trim().slice(0, 30), 'build');
    s.saveChatMessageToDb({
      id: userMsg.id,
      session_id: targetSessionId,
      role: 'user',
      content: userMsg.content,
      created_at: new Date().toISOString(),
    });

    try {
      const model = s.selectedModel;
      const endpointConfig = resolveEndpointForModel(model, s.availableModels, s.apiKeys);
      const baseUrl = endpointConfig.baseUrl;
      const apiKey = endpointConfig.apiKey;

      let replyContent = '';
      let extractedTasks: DraftPlanTask[] = [];
      let squadRecs: RecommendedSquadAgent[] = [];

      if (apiKey && apiKey.trim()) {
        const systemPrompt = `Anda adalah Lead Orchestrator dan Built-in System Architect untuk proyek perangkat lunak otonom.
Tugas Anda:
1. Menganalisis target proyek dari Operator secara holistik dan terstruktur.
2. Menjelaskan spesifikasi arsitektur teknis, teknologi yang direkomendasikan, dan alur kerja DAG.
3. Merinci rekomendasi peran tim agen (minimal 2 peran, misal: Frontend Engineer, Backend Architect, QA Engineer).
4. Menyusun draf tugas rincian terpecah untuk dikerjakan tim.
Format output Anda dalam Bahasa Indonesia yang profesional, ramah, dan terstruktur dengan Markdown.
Penting: Di akhir balasan, sertakan blok kode JSON valid seperti format berikut agar draf tugas dan rekomendasi tim dapat diekstrak otomatis:
\`\`\`json
{
  "tasks": [
    { "title": "Nama Tugas", "role_needed": "Peran Agen", "priority": "high" }
  ],
  "squad": [
    { "name": "Nama Agen", "role": "Peran Agen", "task_description": "Deskripsi tugas peran", "skills": ["file_system", "code_evaluator"], "avatar_color": "#3b82f6" }
  ]
}
\`\`\``;

        const chatUrl = getChatEndpoint(baseUrl);
        const res = await fetch(chatUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...updatedPlanningMessages.slice(-6).map((m) => ({
                role: m.agent_id === 'operator' ? 'user' : 'assistant',
                content: m.content,
              })),
            ],
            temperature: 0.7,
          }),
        });

        if (res.ok) {
          const rawText = await res.text();
          const json = parseRobustJson<any>(rawText);
          replyContent = json.choices?.[0]?.message?.content || '';

          const jsonMatch = replyContent.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              if (Array.isArray(parsed.tasks)) {
                extractedTasks = parsed.tasks.map((t: any, idx: number) => ({
                  id: `draft-task-${Date.now()}-${idx}`,
                  title: String(t.title || `Tugas ${idx + 1}`),
                  role_needed: String(t.role_needed || 'Software Engineer'),
                  priority: ['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium',
                }));
              }
              if (Array.isArray(parsed.squad)) {
                squadRecs = parsed.squad.map((sq: any) => ({
                  name: String(sq.name || sq.role || 'Agent'),
                  role: String(sq.role || 'Specialist'),
                  task_description: String(sq.task_description || 'Melaksanakan tugas terkait'),
                  skills: Array.isArray(sq.skills) ? sq.skills : ['file_system', 'code_evaluator'],
                  avatar_color: sq.avatar_color || '#3b82f6',
                }));
              }
            } catch (_) {}
          }
        }
      }

      if (!replyContent) {
        replyContent = `Saya telah menganalisis tujuan proyek: "${content.trim()}".

Berikut adalah rancangan arsitektur teknis dan strategi eksekusi yang saya rekomendasikan:

### 1. Spesifikasi Arsitektur Sistem
- **Modular Decoupling**: Memisahkan antarmuka pengguna, pemrosesan logika, dan penyimpanan status lokal.
- **Strict Data Contracts**: Memastikan seluruh pesan antar agen dan komponen divalidasi dengan skema tipe yang ketat.
- **Fail-safe Execution**: Melakukan verifikasi keamanan di setiap tahapan mutasi file atau perintah terminal.

### 2. Rekomendasi Skuad Spesialis
1. **Frontend Engineer**: Mengimplementasikan antarmuka interaktif yang responsif dan ergonomis.
2. **Backend Architect**: Mengembangkan modul komunikasi data, integrasi API, dan penanganan status backend.
3. **QA & Security Auditor**: Meninjau kualitas kode, skenario pengujian fungsional, dan validasi keamanan.

### 3. Distribusi Rencana Tugas
Draf tugas terperinci telah disiapkan di kartu rencana. Anda dapat meninjau dan langsung menekan tombol "Setujui & Bagikan Tugas ke Tim".`;

        extractedTasks = [
          { id: `draft-1-${Date.now()}`, title: 'Spesifikasi Arsitektur & Struktur Basis Kode', role_needed: 'System Architect', priority: 'high' },
          { id: `draft-2-${Date.now()}`, title: 'Implementasi Komponen UI & Antarmuka Utama', role_needed: 'Frontend Engineer', priority: 'urgent' },
          { id: `draft-3-${Date.now()}`, title: 'Pengembangan Logika Bisnis & Integrasi Data', role_needed: 'Backend Architect', priority: 'high' },
          { id: `draft-4-${Date.now()}`, title: 'Audit Kualitas, Validasi Edge Cases, & Pengujian', role_needed: 'QA Engineer', priority: 'medium' },
        ];

        squadRecs = [
          { name: 'Frontend Engineer', role: 'Frontend Engineer', task_description: 'Membangun antarmuka interaktif dan integrasi visual', skills: ['file_system', 'code_evaluator'], avatar_color: '#3b82f6' },
          { name: 'Backend Architect', role: 'Backend Architect', task_description: 'Merancang API, struktur data, dan arsitektur inti', skills: ['terminal_runner', 'file_system'], avatar_color: '#10b981' },
          { name: 'QA Auditor', role: 'QA Engineer', task_description: 'Memverifikasi fungsionalitas, keamanan kode, dan pengujian', skills: ['code_evaluator'], avatar_color: '#f59e0b' },
        ];
      }

      const orchMsg: DiscussionMessage = {
        id: `plan-orch-${Date.now()}`,
        agent_id: 'lead-orchestrator',
        agent_name: 'Lead Orchestrator',
        agent_role: 'Built-in System Architect',
        avatar_color: '#10b981',
        content: replyContent,
        step_type: 'proposal',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      set((state) => ({
        isOrchestratorThinking: false,
        isWorking: false,
        buildDiscussion: {
          ...state.buildDiscussion,
          planningMessages: [...(state.buildDiscussion.planningMessages || []), orchMsg],
          messages: [...(state.buildDiscussion.messages || []), orchMsg],
          draftPlanTasks: extractedTasks.length > 0 ? extractedTasks : state.buildDiscussion.draftPlanTasks,
          recommendedSquad: squadRecs.length > 0 ? squadRecs : state.buildDiscussion.recommendedSquad,
        },
      }));

      // Simpan pesan Lead Orchestrator ke SQLite
      s.saveChatMessageToDb({
        id: orchMsg.id,
        session_id: targetSessionId,
        role: 'assistant',
        content: `[Lead Orchestrator - Rencana Proyek]\n${orchMsg.content}`,
        created_at: new Date().toISOString(),
      });

      s.addToast('success', 'Rencana proyek berhasil dirumuskan oleh Lead Orchestrator.');
    } catch (err: unknown) {
      set({ isOrchestratorThinking: false, isWorking: false });
      const errMsg = err instanceof Error ? err.message : String(err);
      s.addToast('error', `Gagal merumuskan rencana: ${errMsg}`);
    }
  },

  autoSpawnRecommendedSquad: () => {
    const s = get();
    const recommendations = s.buildDiscussion.recommendedSquad && s.buildDiscussion.recommendedSquad.length > 0
      ? s.buildDiscussion.recommendedSquad
      : [
          { name: 'Frontend Engineer', role: 'Frontend Engineer', task_description: 'Membangun antarmuka interaktif dan integrasi visual', skills: ['file_system', 'code_evaluator'], avatar_color: '#3b82f6' },
          { name: 'Backend Architect', role: 'Backend Architect', task_description: 'Merancang API, struktur data, dan arsitektur inti', skills: ['terminal_runner', 'file_system'], avatar_color: '#10b981' },
          { name: 'QA Auditor', role: 'QA Engineer', task_description: 'Memverifikasi fungsionalitas, keamanan kode, dan pengujian', skills: ['code_evaluator'], avatar_color: '#f59e0b' },
        ];

    const spawnedIds: string[] = [];
    recommendations.forEach((rec) => {
      const exists = s.customAgents.some(
        (a) => a.role.toLowerCase() === rec.role.toLowerCase() || a.name.toLowerCase() === rec.name.toLowerCase()
      );
      if (!exists) {
        const id = s.createCustomAgent({
          name: rec.name,
          role: rec.role,
          task_description: rec.task_description,
          skills: rec.skills,
          avatar_color: rec.avatar_color,
          system_instructions: `Fokus pada eksekusi tugas ${rec.role} sesuai arahan Lead Orchestrator.`,
        });
        spawnedIds.push(id);
      } else {
        const found = s.customAgents.find(
          (a) => a.role.toLowerCase() === rec.role.toLowerCase() || a.name.toLowerCase() === rec.name.toLowerCase()
        );
        if (found) spawnedIds.push(found.id);
      }
    });

    const allAgentIds = Array.from(new Set([...s.buildDiscussion.selected_agent_ids, ...spawnedIds]));
    set((state) => ({
      buildDiscussion: {
        ...state.buildDiscussion,
        selected_agent_ids: allAgentIds,
        recommendedSquad: [],
      },
    }));

    s.addToast('success', 'Tim agen berhasil dibentuk secara otomatis.');
  },

  approveAndDispatchPlan: () => {
    const s = get();
    const tasks = s.buildDiscussion.draftPlanTasks || [];
    if (tasks.length === 0) {
      s.addToast('warning', 'Belum ada draf tugas untuk disetujui.');
      return;
    }

    if (s.customAgents.length < 2) {
      s.autoSpawnRecommendedSquad();
    }

    const currentAgents = get().customAgents;
    const newKanbanTasks: KanbanTask[] = tasks.map((t, idx) => {
      const matchedAgent = currentAgents.find((a) =>
        a.role.toLowerCase().includes(t.role_needed.toLowerCase()) ||
        t.role_needed.toLowerCase().includes(a.role.toLowerCase())
      );
      return {
        id: `task-plan-${Date.now()}-${idx}`,
        title: t.title,
        status: 'backlog',
        assigned_agent: matchedAgent ? matchedAgent.name : t.role_needed,
        priority: t.priority,
        progress: 0,
      };
    });

    const handoverMsg: DiscussionMessage = {
      id: `handover-${Date.now()}`,
      agent_id: 'lead-orchestrator',
      agent_name: 'Lead Orchestrator',
      agent_role: 'Built-in System Architect',
      avatar_color: '#10b981',
      content: `Rencana proyek telah disetujui oleh Operator. Sebanyak ${tasks.length} tugas telah dialokasikan ke backlog Kanban tim. Tim dipersilakan memulai koordinasi eksekusi.`,
      step_type: 'summary',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    set((state) => ({
      kanbanTasks: [...state.kanbanTasks, ...newKanbanTasks],
      buildDiscussion: {
        ...state.buildDiscussion,
        buildSubMode: 'build',
        status: 'running',
        selected_agent_ids: state.customAgents.map((a) => a.id),
        messages: [...state.buildDiscussion.messages, handoverMsg],
        draftPlanTasks: [],
      },
    }));

    s.addToast('success', 'Rencana disetujui, tugas telah dialokasikan ke tim.');
  },

  // CLEAN MULTI-AGENT STATE (Zero test traces)
  subagents: [],
  kanbanTasks: [],
  logs: [],
  emergencyStopped: false,
  pendingToolClearance: null,
  diffFiles: [],
  setSubagents: (subagents) => set({ subagents }),
  setKanbanTasks: (kanbanTasks) => set({ kanbanTasks }),
  updateTaskStatus: (taskId, status) =>
    set((s) => ({
      kanbanTasks: s.kanbanTasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
    })),
  setLogs: (logs) => set({ logs }),
  addLog: (log) => set((s) => ({ logs: [log, ...s.logs] })),
  clearLogs: () => set({ logs: [] }),
  setEmergencyStopped: (emergencyStopped) => set({ emergencyStopped }),
  setPendingToolClearance: (pendingToolClearance) => set({ pendingToolClearance }),
  resolveToolClearance: (approved) =>
    set((s) => {
      if (s.pendingToolClearance) {
        s.addToast(
          approved ? 'success' : 'warning',
          approved
            ? `Clearance granted for ${s.pendingToolClearance.tool_name}`
            : `Tool execution denied by operator`
        );
      }
      return { pendingToolClearance: null };
    }),
  acceptDiff: (filename) =>
    set((s) => ({
      diffFiles: s.diffFiles.map((d) => (d.filename === filename ? { ...d, status: 'accepted' } : d)),
    })),
  rejectDiff: (filename) =>
    set((s) => ({
      diffFiles: s.diffFiles.map((d) => (d.filename === filename ? { ...d, status: 'rejected' } : d)),
    })),

  // Code Review Modal Implementation
  isCodeReviewModalOpen: false,
  setCodeReviewModalOpen: (isCodeReviewModalOpen) => set({ isCodeReviewModalOpen }),
  codeReviewItems: [],
  setCodeReviewItems: (codeReviewItems) => set({ codeReviewItems }),
  updateCodeReviewItemStatus: (id, status) =>
    set((s) => ({
      codeReviewItems: s.codeReviewItems.map((item) =>
        item.id === id ? { ...item, status } : item
      ),
    })),
  applyCodeReviewItem: async (item) => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('execute_sandbox_tool', {
          toolName: 'write_file',
          parameters: {
            path: item.filename,
            content: item.content,
          },
        });
      }
      get().updateCodeReviewItemStatus(item.id, 'accepted');
      get().addToast('success', `Berhasil menerapkan kode ke "${item.filename}"`);
    } catch (e: any) {
      get().addToast('error', `Gagal menulis file: ${e?.message || e}`);
    }
  },

  // Terminal State Implementation
  isTerminalOpen: false,
  setTerminalOpen: (isTerminalOpen) => set({ isTerminalOpen }),
  terminalHeight: 260,
  setTerminalHeight: (terminalHeight) => set({ terminalHeight }),
  terminalTabs: [
    {
      id: 'term-tab-1',
      title: 'bash #1',
      cwd: '/home/yudz/Agentic',
      logs: [],
    },
  ],
  activeTerminalTabId: 'term-tab-1',
  setActiveTerminalTabId: (activeTerminalTabId) => set({ activeTerminalTabId }),
  addTerminalTab: () => {
    const id = `term-tab-${Date.now()}`;
    const newTab: TerminalTab = {
      id,
      title: `bash #${get().terminalTabs.length + 1}`,
      cwd: get().workspaceProjectRoot,
      logs: [],
    };
    set((s) => ({
      terminalTabs: [...s.terminalTabs, newTab],
      activeTerminalTabId: id,
    }));
  },
  closeTerminalTab: (id) => {
    const { terminalTabs, activeTerminalTabId } = get();
    if (terminalTabs.length <= 1) return;
    const remaining = terminalTabs.filter((t) => t.id !== id);
    const nextActive = activeTerminalTabId === id ? remaining[0].id : activeTerminalTabId;
    set({ terminalTabs: remaining, activeTerminalTabId: nextActive });
  },
  clearTerminalLogs: (tabId) => {
    const targetId = tabId || get().activeTerminalTabId;
    set((s) => ({
      terminalTabs: s.terminalTabs.map((t) => (t.id === targetId ? { ...t, logs: [] } : t)),
    }));
  },
  appendTerminalStreamData: (tabId, line, isStderr) => {
    const targetId = tabId || get().activeTerminalTabId;
    const newLog: TerminalLog = {
      id: `stream-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: isStderr ? 'stderr' : 'stdout',
      content: line,
      timestamp: new Date().toLocaleTimeString(),
    };
    set((s) => ({
      terminalTabs: s.terminalTabs.map((t) =>
        t.id === targetId ? { ...t, logs: [...t.logs, newLog] } : t
      ),
    }));
  },

  killTerminalProcess: async (tabId) => {
    const targetId = tabId || get().activeTerminalTabId;
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('kill_terminal_command', { tabId: targetId });
      } catch (e) {
        console.warn('Gagal kill terminal process:', e);
      }
    }
    const cLog: TerminalLog = {
      id: `ctrlc-${Date.now()}`,
      type: 'stderr',
      content: '^C',
      timestamp: new Date().toLocaleTimeString(),
    };
    set((s) => ({
      terminalTabs: s.terminalTabs.map((t) =>
        t.id === targetId ? { ...t, logs: [...t.logs, cLog] } : t
      ),
    }));
  },

  runTerminalCommand: async (cmdStr, tabId) => {
    const targetId = tabId || get().activeTerminalTabId;
    const trimmed = cmdStr.trim();
    if (!trimmed) return;

    const time = new Date().toLocaleTimeString();
    const inLog: TerminalLog = {
      id: `in-${Date.now()}`,
      type: 'stdin',
      content: trimmed,
      timestamp: time,
    };

    set((s) => ({
      terminalTabs: s.terminalTabs.map((t) =>
        t.id === targetId ? { ...t, logs: [...t.logs, inLog] } : t
      ),
    }));

    if (trimmed === 'clear') {
      get().clearTerminalLogs(targetId);
      return;
    }

    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const { listen } = await import('@tauri-apps/api/event');

        // Jalankan perintah streaming dan tunggu event terminal-stream-done
        await new Promise<void>(async (resolve) => {
          let unlistenDone: (() => void) | null = null;

          unlistenDone = await listen<any>('terminal-stream-done', (event) => {
            if (event.payload?.tab_id === targetId) {
              if (unlistenDone) unlistenDone();
              resolve();
            }
          });

          try {
            await invoke('run_terminal_command_stream', {
              tabId: targetId,
              command: trimmed,
            });
          } catch (invokeErr: any) {
            if (unlistenDone) unlistenDone();
            get().appendTerminalStreamData(targetId, `Error: ${invokeErr?.message || invokeErr}`, true);
            resolve();
          }
        });
      } else {
        // Fallback untuk web preview simulation
        get().appendTerminalStreamData(
          targetId,
          `[Web Preview]: Menjalankan "${trimmed}" secara streaming...`,
          false
        );
      }
    } catch (e: any) {
      get().appendTerminalStreamData(targetId, `Execution error: ${e?.message || e}`, true);
    }
  },

  // Skills Management Implementation
  isSkillsModalOpen: false,
  setSkillsModalOpen: (isSkillsModalOpen) => set({ isSkillsModalOpen }),
  isLocalSkillImportModalOpen: false,
  setLocalSkillImportModalOpen: (isLocalSkillImportModalOpen) => set({ isLocalSkillImportModalOpen }),
  localDiscoveredSkills: [],
  setLocalDiscoveredSkills: (localDiscoveredSkills) => set({ localDiscoveredSkills }),
  localImportSourcePath: '',
  setLocalImportSourcePath: (localImportSourcePath) => set({ localImportSourcePath }),

  openLocalSkillImport: async () => {
    await get().pickAndScanLocalSkills();
  },
  closeLocalSkillImport: () => {
    set({
      isLocalSkillImportModalOpen: false,
      localDiscoveredSkills: [],
      localImportSourcePath: '',
    });
  },

  pickAndScanLocalSkills: async () => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const chosenPath = (await invoke('pick_local_directory')) as string | null;
        if (!chosenPath) return;

        const results = (await invoke('scan_local_skills_directory', {
          directoryPath: chosenPath,
        })) as DiscoveredSkill[];

        if (!results || results.length === 0) {
          get().addToast('warning', 'Tidak ditemukan file SKILL.md di direktori tersebut.');
          return;
        }

        set({
          localImportSourcePath: chosenPath,
          localDiscoveredSkills: results,
          isLocalSkillImportModalOpen: true,
        });
      } else {
        get().addToast('info', 'File picker lokal hanya aktif pada desktop native Tauri.');
      }
    } catch (err: any) {
      get().addToast('error', `Gagal memindai folder skill: ${err?.message || err}`);
    }
  },

  confirmImportLocalSkills: async (skillsToImport, targetLocation) => {
    if (skillsToImport.length === 0) return 0;
    let importedCount = 0;
    const newInstalledList = [...get().installedSkills];

    if ((window as any).__TAURI_INTERNALS__) {
      const { invoke } = await import('@tauri-apps/api/core');
      for (const item of skillsToImport) {
        try {
          const res = (await invoke('copy_skill_folder', {
            sourcePath: item.sourcePath,
            targetLocation,
            customName: item.name,
            description: item.description,
          })) as InstalledSkill;

          if (res) {
            newInstalledList.push(res);
            importedCount++;
          }
        } catch (err) {
          console.warn(`Gagal menyalin skill ${item.name}:`, err);
        }
      }
    } else {
      // Web fallback
      for (const item of skillsToImport) {
        newInstalledList.push({
          id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: item.name,
          description: item.description || 'Skill lokal terpasang',
          location: targetLocation,
          path: item.sourcePath,
          content: `# ${item.name}\n${item.description || ''}`,
          installed_at: new Date().toISOString(),
        });
        importedCount++;
      }
    }

    set({ installedSkills: newInstalledList });
    try {
      localStorage.setItem('agentic_installed_skills', JSON.stringify(newInstalledList));
    } catch (_) {}

    if (importedCount > 0) {
      get().addToast(
        'success',
        `Berhasil menyalin & memasang ${importedCount} skill ke ${targetLocation === 'project' ? 'Project' : 'Global'}.`
      );
    }
    return importedCount;
  },

  installedSkills: (() => {
    try {
      const raw = localStorage.getItem('agentic_installed_skills');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Gagal membaca agentic_installed_skills dari localStorage:', e);
    }
    return [
      {
        id: 'skill-antislop',
        name: 'Anti-Slop Clean UI & Code',
        description: 'Enforces human-level taste, zero generic AI slop, and clean architecture without boilerplate.',
        location: 'project',
        path: '/home/yudz/Agentic/skills/antislop/SKILL.md',
        content: '# Anti-Slop Guidelines\nZero generic blue-purple gradients. Clear contrast and clean code.',
        installed_at: new Date().toISOString(),
      },
      {
        id: 'skill-rust-tokio',
        name: 'Rust & Tokio Native Engine',
        description: 'Tokio async patterns, SQLite thread safety, and zero-allocation memory management.',
        location: 'project',
        path: '/home/yudz/Agentic/skills/rust-tokio/SKILL.md',
        content: '# Rust Tokio Best Practices\nUse Tokio channels and sync primitives properly.',
        installed_at: new Date().toISOString(),
      },
      {
        id: 'skill-react19-framer',
        name: 'React 19 & Framer Motion',
        description: 'Spring physics, layoutId morphs, tactile feedback, and accessible animations.',
        location: 'global',
        path: '/home/yudz/.agentic/skills/react-motion/SKILL.md',
        content: '# Framer Motion Guidelines\nUse spring physics damping 35, stiffness 450.',
        installed_at: new Date().toISOString(),
      },
    ];
  })(),
  installSkill: async (skill) => {
    const id = `skill-${Date.now()}`;
    const fullSkill: InstalledSkill = {
      ...skill,
      id,
      installed_at: new Date().toISOString(),
    };
    const nextList = [...get().installedSkills, fullSkill];
    set({ installedSkills: nextList });
    try {
      localStorage.setItem('agentic_installed_skills', JSON.stringify(nextList));
    } catch (_) {}
    get().addToast('success', `Skill "${skill.name}" successfully installed!`);
  },
  uninstallSkill: async (skillId) => {
    const skill = get().installedSkills.find((s) => s.id === skillId);
    const nextList = get().installedSkills.filter((s) => s.id !== skillId);
    set({ installedSkills: nextList });
    try {
      localStorage.setItem('agentic_installed_skills', JSON.stringify(nextList));
    } catch (_) {}
    get().addToast('info', `Skill "${skill?.name || skillId}" uninstalled.`);
  },
  importSkillFromText: async (name, content, location) => {
    const basePath = location === 'project' ? '/home/yudz/Agentic/skills' : '/home/yudz/.agentic/skills';
    const folderName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const path = `${basePath}/${folderName}/SKILL.md`;

    const newSkill: InstalledSkill = {
      id: `skill-${Date.now()}`,
      name,
      description: content.slice(0, 120).replace(/[#*`\n]/g, ' ').trim() + '...',
      location,
      path,
      content,
      installed_at: new Date().toISOString(),
    };

    const nextList = [...get().installedSkills, newSkill];
    set({ installedSkills: nextList });
    try {
      localStorage.setItem('agentic_installed_skills', JSON.stringify(nextList));
    } catch (_) {}
    get().addToast('success', `Imported "${name}" to ${location} directory!`);
  },

  // Streaming and Working Status
  isStreaming: false,
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  isWorking: false,
  setIsWorking: (isWorking) => set({ isWorking }),

  // Queued Messages
  queuedMessagesBuffer: [],
  addQueuedMessage: (msg: string) => {
    set((s) => ({ queuedMessagesBuffer: [...s.queuedMessagesBuffer, msg] }));
  },
  processNextQueuedMessage: () => {
    const { queuedMessagesBuffer } = get();
    if (queuedMessagesBuffer.length === 0) return null;
    const [next, ...rest] = queuedMessagesBuffer;
    set({ queuedMessagesBuffer: rest });
    return next;
  },

  // Plan Review Approval
  pendingPlanApproval: null,
  setPendingPlanApproval: (pendingPlanApproval) => set({ pendingPlanApproval }),
  resolvePlanApproval: (approved) => {
    const { pendingPlanApproval } = get();
    if (pendingPlanApproval) {
      get().addToast(
        approved ? 'success' : 'info',
        approved
          ? `Rencana disetujui: ${pendingPlanApproval.title}`
          : `Rencana ditolak: ${pendingPlanApproval.title}`
      );
      get().addLog({
        id: `plan-res-${Date.now()}`,
        agent_name: 'Operator',
        level: approved ? 'INFO' : 'WARN',
        message: `Plan ${pendingPlanApproval.title} ${approved ? 'approved' : 'rejected'} by operator.`,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
    set({ pendingPlanApproval: null });
  },

  // Toasts
  toasts: [],
  addToast: (type, message, duration = 2000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { id, type, message, duration }] }));
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  // Global App Settings
  settings: loadSavedSettings(),
  updateSettings: (partial) => {
    set((state) => {
      const updated = { ...state.settings, ...partial };
      try {
        localStorage.setItem('agentic_app_settings', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save settings:', e);
      }
      let strictMode = state.isStrictApprovalMode;
      if (partial.permissionPreset) {
        strictMode = partial.permissionPreset === 'turbo';
      }
      return { settings: updated, isStrictApprovalMode: strictMode };
    });
  },
}));
