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
  CodeReviewItem,
} from '../types';
import { parseRobustJson, getChatEndpoint, getModelsEndpoint, formatApiErrorMessage } from '../utils/api';
import { extractCodeReviewItems } from '../utils/codeExtractor';

interface AppStore {
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
  saveApiKey: (provider: string, apiKey: string, baseUrl?: string) => Promise<void>;
  toggleApiKey: (provider: string) => Promise<void>;

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

  // Toasts
  toasts: ToastItem[];
  addToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  removeToast: (id: string) => void;
}

export const useStore = create<AppStore>((set, get) => ({
  // Clean default mode: Chatbot
  currentMode: 'chatbot',
  setMode: (nextMode) => {
    const prevMode = get().currentMode;
    if (prevMode === nextMode) return;

    // Jika beralih ke mode chatbot, tutup terminal demi proteksi isolasi
    if (nextMode === 'chatbot') {
      set({ isTerminalOpen: false });
    }

    set({ currentMode: nextMode });

    // Cari sesi yang cocok untuk mode ini
    const modeSessions = get().sessions.filter((s) => (s.mode || 'chatbot') === nextMode);
    if (modeSessions.length > 0) {
      get().selectSession(modeSessions[0].id);
    } else {
      // Buat sesi default untuk mode ini jika belum ada
      const defaultTitle =
        nextMode === 'chatbot'
          ? 'Percakapan Chat'
          : nextMode === 'agent'
          ? 'Sesi Tugas Agent'
          : 'Proyek Studio Multi-Agent';
      get().createNewSession(defaultTitle, nextMode);
    }
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
    const customConfig = keys.find((k) => k.provider === 'custom');
    const url = customUrl || customConfig?.base_url || 'http://localhost:20128/v1';
    const key = customKey ?? customConfig?.api_key ?? '';

    // Jika tidak ada API key aktif, kosongkan model dan batalkan deteksi
    if (!key.trim()) {
      set({
        availableModels: [],
        selectedModel: '',
        isDetectingModels: false,
      });
      return 0;
    }

    set({ isDetectingModels: true });
    try {
      const targetModelsUrl = getModelsEndpoint(url);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${key.trim()}`,
      };

      const res = await fetch(targetModelsUrl, {
        headers,
      });

      if (!res.ok) {
        throw new Error(`Endpoint returned status ${res.status}`);
      }

      const rawText = await res.text();
      const json = parseRobustJson<any>(rawText);
      const rawList = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
      
      const detected: ModelOption[] = rawList.map((m: { id: string; context_length?: number }) => ({
        id: m.id,
        name: m.id,
        provider: 'custom',
        context_length: m.context_length,
      }));

      if (detected.length > 0) {
        const currentSelected = get().selectedModel;
        const stillValid = detected.some((d) => d.id === currentSelected);
        const nextModel = stillValid ? currentSelected : detected[0].id;

        set({
          availableModels: detected,
          selectedModel: nextModel,
          selectedProvider: 'custom',
          isDetectingModels: false,
        });
        return detected.length;
      }

      set({ availableModels: [], selectedModel: '', isDetectingModels: false });
      return 0;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      get().addToast('error', `Gagal mendeteksi model: ${errMsg}`);
      set({ availableModels: [], selectedModel: '', isDetectingModels: false });
      return 0;
    }
  },

  isSettingsOpen: false,
  setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),

  apiKeys: [
    {
      provider: 'custom',
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
          // Tambahkan custom providers yang mungkin ada di DB tapi belum ada di state
          dbKeys.forEach((dk) => {
            if (!merged.some((m) => m.provider === dk.provider)) {
              merged.push(dk);
            }
          });

          set({ apiKeys: merged });

          // Cek provider custom yang aktif
          const custom = merged.find((k) => k.provider === 'custom' && k.is_active && k.api_key.trim().length > 0);
          if (custom) {
            get().fetchAvailableModels(custom.base_url, custom.api_key);
          } else {
            set({ availableModels: [], selectedModel: '' });
          }
          return;
        }
      }
    } catch (err) {
      console.warn('Gagal memuat api keys dari SQLite database:', err);
    }
  },

  saveApiKey: async (provider, apiKey, baseUrl) => {
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
            api_key: apiKey,
            base_url: baseUrl,
            is_active: apiKey.trim().length > 0,
            updated_at: new Date().toISOString(),
          },
        ],
      };
    });

    // 3. Refresh ketersediaan model jika custom provider diperbarui
    if (provider === 'custom') {
      if (apiKey.trim().length > 0) {
        await get().fetchAvailableModels(baseUrl, apiKey);
      } else {
        set({ availableModels: [], selectedModel: '' });
      }
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

    if (provider === 'custom') {
      if (nextActive && target?.api_key.trim()) {
        await get().fetchAvailableModels(target.base_url, target.api_key);
      } else {
        set({ availableModels: [], selectedModel: '' });
      }
    }
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
          set({ sessions: loadedSessions });
          const currentMode = get().currentMode;
          const currentActive = get().activeSessionId;
          const modeSessions = loadedSessions.filter((s) => (s.mode || 'chatbot') === currentMode);

          if (currentActive && modeSessions.some((s) => s.id === currentActive)) {
            await get().selectSession(currentActive);
          } else if (modeSessions.length > 0) {
            await get().selectSession(modeSessions[0].id);
          } else {
            // Jika belum ada sesi untuk mode saat ini, buat sesi baru
            get().createNewSession(
              currentMode === 'chatbot'
                ? 'Percakapan Chat'
                : currentMode === 'agent'
                ? 'Sesi Tugas Agent'
                : 'Proyek Studio Multi-Agent',
              currentMode
            );
          }
        }
      } catch (err) {
        console.warn('Gagal memuat sesi obrolan dari SQLite:', err);
      }
    }
  },

  selectSession: async (id: string) => {
    set({ activeSessionId: id });
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const msgs = (await invoke('get_chat_messages', { sessionId: id })) as ChatMessage[];
        set({ messages: msgs || [] });
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
    const currentMode = get().currentMode;
    const remainingModeSessions = remaining.filter((s) => (s.mode || 'chatbot') === currentMode);
    const nextActive =
      get().activeSessionId === id
        ? remainingModeSessions[0]?.id || null
        : get().activeSessionId;

    set({
      sessions: remaining,
      messages: remainingMsgs,
      activeSessionId: nextActive,
    });

    if (nextActive) {
      await get().selectSession(nextActive);
    } else {
      // Jika semua sesi mode ini habis terhapus, buat sesi baru
      get().createNewSession(undefined, currentMode);
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

  // CUSTOM AGENTS ROSTER (Default zero built-in agents)
  customAgents: [],
  selectedAgentId: null,
  setCustomAgents: (customAgents) => set({ customAgents }),
  setSelectedAgentId: (selectedAgentId) => set({ selectedAgentId }),
  createCustomAgent: (agentData) => {
    const newId = `agent-${Date.now()}`;
    const newAgent: CustomAgent = {
      ...agentData,
      id: newId,
      created_at: new Date().toISOString(),
    };
    set((s) => ({
      customAgents: [...s.customAgents, newAgent],
      selectedAgentId: newId,
    }));
    get().addToast('success', `Agent "${newAgent.name}" berhasil dibuat!`);
    return newId;
  },
  updateCustomAgent: (id, updates) =>
    set((s) => ({
      customAgents: s.customAgents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
  deleteCustomAgent: (id) =>
    set((s) => {
      const remaining = s.customAgents.filter((a) => a.id !== id);
      return {
        customAgents: remaining,
        selectedAgentId: s.selectedAgentId === id ? remaining[0]?.id || null : s.selectedAgentId,
      };
    }),

  // MULTI-AGENT BUILD DISCUSSION SESSION
  buildDiscussion: {
    id: 'discussion-main',
    project_goal: '',
    selected_agent_ids: [],
    status: 'idle',
    current_turn_index: 0,
    messages: [],
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
    set(() => ({
      buildDiscussion: {
        id: `discussion-${Date.now()}`,
        project_goal: goal,
        selected_agent_ids: agentIds,
        status: 'running',
        current_turn_index: 0,
        messages: [
          {
            id: `msg-system-${Date.now()}`,
            agent_id: 'system',
            agent_name: 'Coordinator',
            agent_role: 'Orchestrator',
            avatar_color: '#6366f1',
            content: `🎯 Project Goal ditetapkan: "${goal}".\nTim terdiri dari ${agentIds.length} agen: ${agentIds
              .map((id) => s.customAgents.find((a) => a.id === id)?.name)
              .filter(Boolean)
              .join(', ')}. Diskusi kolaborasi dimulai.`,
            step_type: 'summary',
            timestamp: new Date().toLocaleTimeString(),
          },
        ],
      },
    }));

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
    const customConfig = state.apiKeys.find((k) => k.provider === 'custom');
    const baseUrl = customConfig?.base_url || 'http://localhost:20128/v1';
    const apiKey = customConfig?.api_key || '';
    const model = currentAgent.model || state.selectedModel;

    if (!apiKey.trim()) {
      state.addToast('error', `API Key belum diatur. Buka Pengaturan API untuk memasukkan kredensial.`);
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
  isTerminalOpen: true,
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
  installedSkills: [
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
  ],
  installSkill: async (skill) => {
    const id = `skill-${Date.now()}`;
    const fullSkill: InstalledSkill = {
      ...skill,
      id,
      installed_at: new Date().toISOString(),
    };
    set((s) => ({
      installedSkills: [...s.installedSkills, fullSkill],
    }));
    get().addToast('success', `Skill "${skill.name}" successfully installed!`);
  },
  uninstallSkill: async (skillId) => {
    const skill = get().installedSkills.find((s) => s.id === skillId);
    set((s) => ({
      installedSkills: s.installedSkills.filter((s) => s.id !== skillId),
    }));
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

    set((s) => ({
      installedSkills: [...s.installedSkills, newSkill],
    }));
    get().addToast('success', `Imported "${name}" to ${location} directory!`);
  },

  // Toasts
  toasts: [],
  addToast: (type, message) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
