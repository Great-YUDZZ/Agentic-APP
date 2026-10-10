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
  terminalTabs: TerminalTab[];
  activeTerminalTabId: string;
  setActiveTerminalTabId: (id: string) => void;
  addTerminalTab: () => void;
  closeTerminalTab: (id: string) => void;
  clearTerminalLogs: (tabId?: string) => void;
  runTerminalCommand: (command: string, tabId?: string) => Promise<void>;

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
  saveApiKey: (provider: string, apiKey: string, baseUrl?: string) => void;
  toggleApiKey: (provider: string) => void;

  // Chatbot Mode
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  setSessions: (sessions: ChatSession[]) => void;
  setActiveSessionId: (id: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  createNewSession: () => string;
  deleteSession: (id: string) => void;

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

const DEFAULT_AGENTS: CustomAgent[] = [
  {
    id: 'agent-architect',
    name: 'Lead System Architect',
    role: 'System Architect',
    task_description: 'Merancang arsitektur sistem, memecah requirement menjadi modul teknis, dan menentukan dependensi.',
    skills: ['file_system', 'web_fetcher', 'Architecture Design'],
    system_instructions: 'Fokus pada desain tingkat tinggi, modularitas, diagram alur, dan dekomposisi tugas.',
    avatar_color: '#3b82f6',
    created_at: new Date().toISOString(),
  },
  {
    id: 'agent-coder',
    name: 'Fullstack Core Engineer',
    role: 'Core Software Engineer',
    task_description: 'Mengimplementasikan logika kode, menulis fungsi bersih, menangani algoritma, dan mengintegrasikan API.',
    skills: ['file_system', 'terminal_runner', 'code_evaluator'],
    system_instructions: 'Tulis kode yang modular, efisien, aman, dan tanpa boilerplate yang tidak perlu.',
    avatar_color: '#10b981',
    created_at: new Date().toISOString(),
  },
  {
    id: 'agent-reviewer',
    name: 'QA & Security Auditor',
    role: 'Quality & Security Reviewer',
    task_description: 'Memeriksa potensi celah keamanan, boundary bugs, verifikasi sanitasi input, dan validasi kode.',
    skills: ['file_system', 'terminal_runner', 'Security Audit'],
    system_instructions: 'Kritisi solusi yang dibuat, cari edge-case, dan pastikan tidak ada kebocoran sandbox.',
    avatar_color: '#f59e0b',
    created_at: new Date().toISOString(),
  },
];

export const useStore = create<AppStore>((set, get) => ({
  // Clean default mode: Chatbot
  currentMode: 'chatbot',
  setMode: (currentMode) => set({ currentMode }),
  isSidebarOpen: true,
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

  // Workspace Project Root & Approval Policy
  workspaceProjectRoot: '/home/yudz/Agentic',
  setWorkspaceProjectRoot: (workspaceProjectRoot) => {
    set({ workspaceProjectRoot });
    get().addToast('info', `Direktori proyek diatur ke: ${workspaceProjectRoot}`);
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

  // Custom Endpoint pre-configured with user credentials
  selectedModel: 'openrouter/openrouter/free',
  selectedProvider: 'custom',
  availableModels: [],
  isDetectingModels: false,
  setModel: (selectedModel) => set({ selectedModel }),
  setProvider: (selectedProvider) => set({ selectedProvider }),
  setAvailableModels: (availableModels) => set({ availableModels }),

  fetchAvailableModels: async (customUrl, customKey) => {
    set({ isDetectingModels: true });
    try {
      const keys = get().apiKeys;
      const customConfig = keys.find((k) => k.provider === 'custom');
      const url = customUrl || customConfig?.base_url || 'http://localhost:20128/v1';
      const key = customKey || customConfig?.api_key || 'sk-fba3a2b12de42b58-3isf9v-4b13a384';

      const targetModelsUrl = getModelsEndpoint(url);
      const res = await fetch(targetModelsUrl, {
        headers: {
          Authorization: `Bearer ${key}`,
        },
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

      set({ isDetectingModels: false });
      return 0;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      get().addToast('error', `Gagal mendeteksi model: ${errMsg}`);
      set({ isDetectingModels: false });
      return 0;
    }
  },

  isSettingsOpen: false,
  setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),

  apiKeys: [
    {
      provider: 'custom',
      api_key: 'sk-fba3a2b12de42b58-3isf9v-4b13a384',
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
      api_key: 'local-ollama',
      base_url: 'http://localhost:11434',
      is_active: false,
      updated_at: new Date().toISOString(),
    },
  ],
  setApiKeys: (apiKeys) => set({ apiKeys }),
  saveApiKey: (provider, apiKey, baseUrl) =>
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
                  is_active: apiKey.length > 0,
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
            is_active: true,
            updated_at: new Date().toISOString(),
          },
        ],
      };
    }),
  toggleApiKey: (provider) =>
    set((s) => ({
      apiKeys: s.apiKeys.map((k) =>
        k.provider === provider ? { ...k, is_active: !k.is_active } : k
      ),
    })),

  // CLEAN CHAT STATE
  sessions: [],
  activeSessionId: null,
  messages: [],
  setSessions: (sessions) => set({ sessions }),
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  createNewSession: () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: 'Obrolan Baru',
      model: get().selectedModel,
      provider: get().selectedProvider,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    set((s) => ({
      sessions: [newSession, ...s.sessions],
      activeSessionId: newId,
    }));
    return newId;
  },
  deleteSession: (id) =>
    set((s) => {
      const remaining = s.sessions.filter((sess) => sess.id !== id);
      const remainingMsgs = s.messages.filter((m) => m.session_id !== id);
      return {
        sessions: remaining,
        messages: remainingMsgs,
        activeSessionId: s.activeSessionId === id ? remaining[0]?.id || null : s.activeSessionId,
      };
    }),

  // CUSTOM AGENTS ROSTER
  customAgents: DEFAULT_AGENTS,
  selectedAgentId: 'agent-architect',
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
    selected_agent_ids: ['agent-architect', 'agent-coder', 'agent-reviewer'],
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

    // Ambil endpoint dan model
    const customConfig = state.apiKeys.find((k) => k.provider === 'custom');
    const baseUrl = customConfig?.base_url || 'http://localhost:20128/v1';
    const apiKey = customConfig?.api_key || 'sk-fba3a2b12de42b58-3isf9v-4b13a384';
    const model = state.selectedModel || 'openrouter/openrouter/free';

    // Format riwayat diskusi
    const recentMessages = session.messages.slice(-6).map((m) => `${m.agent_name} (${m.agent_role}): ${m.content}`).join('\n\n');

    const prompt = `Anda adalah ${currentAgent.name}, dengan peran: ${currentAgent.role}.
Tugas utama Anda: ${currentAgent.task_description}
Keahlian/Skills yang Anda miliki: ${currentAgent.skills.join(', ')}
${currentAgent.system_instructions ? `Instruksi khusus: ${currentAgent.system_instructions}` : ''}

Target Proyek Bersama:
"${session.project_goal}"

Riwayat Diskusi Tim Sebelumnya:
${recentMessages || '(Belum ada pesan sebelumnya, Anda adalah pembicara pertama)'}

TUGAS ANDA SEKARANG:
Berikan kontribusi nyata sesuai peran dan keahlian Anda untuk memajukan proyek ini atau menanggapi instruksi operator/rekan tim.
- Jika Anda arsitek/perencana: Usulkan struktur, rancangan teknis, atau dekomposisi langkah.
- Jika Anda engineer/koder: Berikan solusi implementasi konkret, cuplikan kode/logika, atau algoritma.
- Jika Anda reviewer/QA: Analisis usulan kawan tim Anda, temukan celah, uji boundary, atau validasi kepatuhan.

Berbicaralah secara ringkas, padat, profesional, dan to the point (maksimal 3 paragraf). Jangan bertele-tele.`;

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

      const newMsg: DiscussionMessage = {
        id: `turn-${Date.now()}`,
        agent_id: currentAgent.id,
        agent_name: currentAgent.name,
        agent_role: currentAgent.role,
        avatar_color: currentAgent.avatar_color,
        content: reply,
        step_type: currentTurn === 0 ? 'proposal' : currentTurn === 1 ? 'implementation' : 'critique',
        timestamp: new Date().toLocaleTimeString(),
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
    const activeAgentIds =
      session.selected_agent_ids.length >= 2
        ? session.selected_agent_ids
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
  isTerminalOpen: false,
  setTerminalOpen: (isTerminalOpen) => set({ isTerminalOpen }),
  terminalTabs: [
    {
      id: 'term-tab-1',
      title: 'bash #1',
      cwd: '/home/yudz/Agentic',
      logs: [
        {
          id: 'log-init-1',
          type: 'system',
          content: 'Agentic Native Interactive Terminal ready.\nType any bash command (e.g. ls -la, git status, cargo test, npm run dev) or /help.',
          timestamp: new Date().toLocaleTimeString(),
        },
      ],
    },
  ],
  activeTerminalTabId: 'term-tab-1',
  setActiveTerminalTabId: (activeTerminalTabId) => set({ activeTerminalTabId }),
  addTerminalTab: () => {
    const id = `term-tab-${Date.now()}`;
    const newTab: TerminalTab = {
      id,
      title: `bash #${get().terminalTabs.length + 1}`,
      cwd: '/home/yudz/Agentic',
      logs: [
        {
          id: `log-${Date.now()}`,
          type: 'system',
          content: 'New shell session initialized.',
          timestamp: new Date().toLocaleTimeString(),
        },
      ],
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
      // Invoke Tauri IPC sandbox execute_sandbox_tool or fallback
      let output = '';
      let isErr = false;

      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const res: any = await invoke('execute_sandbox_tool', {
          toolName: 'execute_command',
          parameters: { command: trimmed },
        });
        output = res.output;
        isErr = !res.success;
      } else {
        // Dev server / web fallback simulation
        output = `[Dev mode execution for]: ${trimmed}\n(Tip: In Tauri desktop app, this executes directly in system bash shell)`;
      }

      const outLog: TerminalLog = {
        id: `out-${Date.now()}`,
        type: isErr ? 'stderr' : 'stdout',
        content: output,
        timestamp: new Date().toLocaleTimeString(),
      };

      set((s) => ({
        terminalTabs: s.terminalTabs.map((t) =>
          t.id === targetId ? { ...t, logs: [...t.logs, outLog] } : t
        ),
      }));
    } catch (e: any) {
      const errLog: TerminalLog = {
        id: `err-${Date.now()}`,
        type: 'stderr',
        content: `Execution error: ${e?.message || e}`,
        timestamp: new Date().toLocaleTimeString(),
      };
      set((s) => ({
        terminalTabs: s.terminalTabs.map((t) =>
          t.id === targetId ? { ...t, logs: [...t.logs, errLog] } : t
        ),
      }));
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
