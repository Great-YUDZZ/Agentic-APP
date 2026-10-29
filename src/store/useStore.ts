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
  DeleteRequest,
  TrashItem,
  VaultAuditEntry,
  GraphSnapshot,
  ScoredSearchResult,
  ExecutionStep,
  McpServerConfig,
  McpToolInfo,
  McpServerStatus,
  Artifact,
  ArtifactVersion,
  FileNode,
  CodeChunkMatch,
  TextSearchMatch,
  ActiveAgentWorkFile,
  PendingTypingAnimation,
  OpenEditorFile,
  CliAgentMetadata,
  OrchestratorSelection,
  TerminalWorkerSession,
  InterAgentMessage,
  WorktreeSession,
  AgentTelemetryPayload,
  HookServerCoords,
  SplitDirection,
  TerminalPaneNode,
  TilingNode,
  DraggingItem,
  ActiveDropTarget,
} from '../types';
import { parseRobustJson, getChatEndpoint, getModelsEndpoint, formatApiErrorMessage, resolveEndpointForModel } from '../utils/api';
import { extractCodeReviewItems } from '../utils/codeExtractor';
import { AGENT_AVAILABLE_TOOLS, isPathExternal, convertMcpToolToDefinition } from '../utils/tools';

export const BUILTIN_LEAD_ORCHESTRATOR = {
  id: 'builtin-lead-orchestrator',
  name: 'Lead Orchestrator',
  role: 'Chief System Architect & Planning Director',
  avatar_color: '#737373',
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
  setStrictApprovalMode: (val: boolean) => void;

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
  lastTelemetry: {
    ttftMs: number | null;
    totalLatencyMs: number | null;
    lastInputTokens: number;
    lastOutputTokens: number;
  };
  setLastTelemetry: (telemetry: {
    ttftMs: number | null;
    totalLatencyMs: number | null;
    lastInputTokens?: number;
    lastOutputTokens?: number;
  }) => void;
  setContextCompressed: (compressed: boolean) => void;
  setContextUsagePercent: (percent: number) => void;
  setSessions: (sessions: ChatSession[]) => void;
  setActiveSessionId: (id: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  createNewSession: (title?: string, mode?: AppMode) => string;
  forkSessionFromMessage: (sessionId: string, upToMessageId: string) => Promise<string | null>;
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
  pendingClearanceResolver: ((approved: boolean) => void) | null;
  setPendingClearanceResolver: (resolver: ((approved: boolean) => void) | null) => void;
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

  // Universal Context Vault (Obsidian-Style)
  isVaultPageOpen: boolean;
  setIsVaultPageOpen: (open: boolean) => void;
  activeVaultTab: 'graph' | 'audit' | 'trash' | 'approvals';
  setActiveVaultTab: (tab: 'graph' | 'audit' | 'trash' | 'approvals') => void;
  pendingDeleteRequests: DeleteRequest[];
  trashNotes: TrashItem[];
  vaultAuditLog: VaultAuditEntry[];
  isPendingApprovalsModalOpen: boolean;
  setPendingApprovalsModalOpen: (open: boolean) => void;
  isTrashModalOpen: boolean;
  setTrashModalOpen: (open: boolean) => void;
  isGraphViewModalOpen: boolean;
  setGraphViewModalOpen: (open: boolean) => void;
  isVaultAuditModalOpen: boolean;
  setVaultAuditModalOpen: (open: boolean) => void;
  fetchPendingDeleteRequests: () => Promise<void>;
  approveDeleteRequest: (requestId: string) => Promise<void>;
  rejectDeleteRequest: (requestId: string) => Promise<void>;
  batchApproveDeleteRequests: (requestIds: string[]) => Promise<void>;
  batchRejectDeleteRequests: (requestIds: string[]) => Promise<void>;
  fetchTrashNotes: () => Promise<void>;
  restoreTrashNote: (fileName: string) => Promise<string | null>;
  purgeTrashNote: (fileName: string) => Promise<void>;
  fetchVaultAuditLog: (limit?: number) => Promise<void>;
  getGraphSnapshot: () => Promise<GraphSnapshot | null>;
  searchNotesHybrid: (query: string, limit?: number) => Promise<ScoredSearchResult[]>;

  // MCP (Model Context Protocol) State
  mcpServers: McpServerConfig[];
  mcpTools: McpToolInfo[];
  mcpStatuses: McpServerStatus[];
  fetchMcpServers: () => Promise<void>;
  saveMcpServer: (config: McpServerConfig) => Promise<void>;
  deleteMcpServer: (id: string) => Promise<void>;
  toggleMcpServer: (id: string, isActive: boolean) => Promise<void>;
  importMcpConfigJson: (jsonStr: string) => Promise<number>;
  fetchMcpTools: () => Promise<void>;
  fetchMcpStatuses: () => Promise<void>;
  callMcpTool: (namespacedName: string, args: any) => Promise<string>;

  // Dedicated Artifacts & Canvas (Sidecar Viewer)
  artifacts: Artifact[];
  activeArtifactId: string | null;
  isSidecarOpen: boolean;
  sidecarWidth: number;
  sidecarTab: 'preview' | 'code';
  openArtifact: (artifact: Artifact) => void;
  closeSidecar: () => void;
  toggleSidecar: () => void;
  setSidecarTab: (tab: 'preview' | 'code') => void;
  setSidecarWidth: (width: number) => void;
  setActiveArtifactId: (id: string | null) => void;
  updateArtifactContent: (id: string, newContent: string, author: 'ai' | 'user', summary?: string) => void;
  setArtifactVersion: (id: string, versionIndex: number) => void;
  saveArtifactToWorkspace: (id: string, relativePath: string) => Promise<boolean>;

  // Workspace File Explorer & Codebase RAG
  sidebarTab: 'sessions' | 'files';
  setSidebarTab: (tab: 'sessions' | 'files') => void;
  workspaceFiles: FileNode[];
  activeWorkspacePath: string | null;
  isWorkspaceFilesLoading: boolean;
  fetchWorkspaceFiles: () => Promise<void>;
  createWorkspaceFile: (relativePath: string, isDir: boolean) => Promise<boolean>;
  renameWorkspaceFile: (oldPath: string, newPath: string) => Promise<boolean>;
  deleteWorkspaceFile: (relativePath: string) => Promise<boolean>;
  revealInFileManager: (relativePath?: string) => Promise<void>;
  openFileInSidecar: (file: FileNode) => Promise<void>;
  queryCodebase: (query: string, maxChunks?: number) => Promise<CodeChunkMatch[]>;
  searchWorkspaceText: (
    query: string,
    caseSensitive?: boolean,
    wholeWord?: boolean,
    maxResults?: number
  ) => Promise<TextSearchMatch[]>;

  // Studio Code Editor State & Actions
  openEditorFiles: OpenEditorFile[];
  activeEditorFilePath: string | null;
  openFileInStudioEditor: (file: FileNode) => Promise<void>;
  closeEditorFile: (path: string) => void;
  setActiveEditorFile: (path: string) => void;
  updateEditorFileContent: (path: string, content: string) => void;
  saveActiveEditorFile: () => Promise<boolean>;

  // Quick Open File & Global Search Modals
  isQuickOpenModalOpen: boolean;
  setQuickOpenModalOpen: (open: boolean) => void;
  isGlobalSearchModalOpen: boolean;
  setGlobalSearchModalOpen: (open: boolean) => void;

  // Active Agent Work Locations & Typewriter Animations
  activeAgentWorkFiles: Record<string, ActiveAgentWorkFile>;
  setActiveAgentWorkFile: (filePath: string, work: ActiveAgentWorkFile | null) => void;
  pendingTypingAnimations: Record<string, PendingTypingAnimation>;
  registerPendingTypingAnimation: (anim: PendingTypingAnimation) => void;
  consumePendingTypingAnimation: (filePath: string) => PendingTypingAnimation | null;

  // Terminal Agent Discovery & Multi-Agent Orchestration
  installedCliAgents: CliAgentMetadata[];
  isDetectingCliAgents: boolean;
  orchestratorConfig: OrchestratorSelection;
  activeTerminalWorkers: TerminalWorkerSession[];
  interAgentMessages: InterAgentMessage[];
  multiTerminalSplit: 'tabs' | 'split-horizontal' | 'split-vertical';
  isAgentRosterModalOpen: boolean;
  setOrchestratorConfig: (config: OrchestratorSelection) => void;
  setIsAgentRosterModalOpen: (open: boolean) => void;
  setMultiTerminalSplit: (split: 'tabs' | 'split-horizontal' | 'split-vertical') => void;
  refreshInstalledCliAgents: () => Promise<void>;
  spawnTerminalWorker: (agentId: string, role: string, taskSpec?: string) => Promise<string | null>;
  terminateTerminalWorker: (workerId: string) => Promise<void>;
  sendInterAgentMessage: (recipient: string, content: string, runId?: string) => Promise<void>;

  // Git Worktrees & Hook Telemetry
  worktrees: WorktreeSession[];
  activeWorktreeId: string | null;
  hookCoords: HookServerCoords | null;
  setActiveWorktreeId: (id: string | null) => void;
  refreshWorktrees: () => Promise<void>;
  createWorktreeForTask: (taskId: string, taskTitle: string, branchName: string, agentName: string) => Promise<WorktreeSession | null>;
  removeWorktree: (worktreePath: string) => Promise<void>;
  mergeWorktree: (branchName: string) => Promise<boolean>;
  openTerminalForWorktree: (worktree: WorktreeSession) => Promise<string | null>;
  initHookTelemetryListener: () => void;

  // Orca-Style Multi-Pane Tiling State & Actions
  tilingLayout: TilingNode | null;
  maximizedPaneId: string | null;
  isTerminalInspectorOpen: boolean;
  setTilingLayout: (layout: TilingNode | null) => void;
  setMaximizedPaneId: (paneId: string | null) => void;
  setIsTerminalInspectorOpen: (open: boolean) => void;
  splitPane: (paneId: string, direction: SplitDirection, newTabId?: string) => Promise<string>;
  closePane: (paneId: string) => void;
  updateSplitRatio: (containerId: string, ratio: number) => void;
  toggleMaximizePane: (paneId: string) => void;
  spawnAgentInPane: (
    paneId: string,
    agentId: string,
    customCwd?: string,
    placement?: 'tab' | 'split-right' | 'split-down'
  ) => Promise<string | null>;
  draggingItem: DraggingItem | null;
  dragPreviewPos: { x: number; y: number } | null;
  activeDropTarget: ActiveDropTarget | null;
  setDraggingItem: (item: DraggingItem | null) => void;
  setDragPreviewPos: (pos: { x: number; y: number } | null) => void;
  setActiveDropTarget: (target: ActiveDropTarget | null) => void;
  draggingPaneId: string | null;
  setDraggingPaneId: (paneId: string | null) => void;
  splitPaneWithTab: (
    sourcePaneId: string,
    targetPaneId: string,
    tabId: string,
    direction: 'left' | 'right' | 'top' | 'bottom'
  ) => void;
  moveTabToPane: (
    sourcePaneId: string,
    targetPaneId: string,
    tabId: string,
    targetIndex?: number
  ) => void;
  moveTabInPane: (paneId: string, fromIndex: number, toIndex: number) => void;
  reparentPane: (
    sourcePaneId: string,
    targetPaneId: string,
    position: 'left' | 'right' | 'top' | 'bottom' | 'tab'
  ) => void;
  consumeInitialCommand: (tabId: string) => void;
  addTabToPane: (paneId: string, title?: string, cwd?: string) => Promise<string>;
  setActiveTabInPane: (paneId: string, tabId: string) => void;
  closeTabInPane: (paneId: string, tabId: string) => void;
  applyPresetLayout: (preset: 'single' | 'split-horizontal' | 'split-vertical' | 'grid-2x2') => Promise<void>;
  ensureTilingInitialized: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  queuedMessages: 'queue',
  permissionPreset: 'standard',
  planReviewPolicy: 'always_ask',
  browserJsPolicy: 'always_ask',
  externalDirectoryAccess: 'always_ask',
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
  voiceInputLanguage: 'id',
  theme: 'dark',
  contrast: 'default',
  darkPreset: 'default',
  bgColor: '#212121',
  fgColor: '#ececec',
  accentColor: '#ececec',
  verboseAgentChat: true,
  conversationWidth: 'default',
  trashRetentionDays: 30,
};

const loadSavedSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem('agentic_app_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      delete parsed.keepInMenuBar;
      delete parsed.networkAccessRules;
      delete parsed.browserActuationRules;

      if (parsed.accentColor === '#3b82f6') {
        parsed.accentColor = '#ececec';
      }

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
      if (!['always_ask', 'always_allow', 'workspace_only'].includes(parsed.externalDirectoryAccess)) {
        parsed.externalDirectoryAccess = 'always_ask';
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
      if (!['id', 'en', 'auto'].includes(parsed.voiceInputLanguage)) {
        parsed.voiceInputLanguage = 'id';
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
};

export const DEFAULT_POPULAR_MODELS: ModelOption[] = [];

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
    set({
      isTerminalOpen: false,
      currentMode: nextMode,
      activeSessionId: null,
      messages: [],
      activeWorkspacePath: null,
      workspaceFiles: [],
      openEditorFiles: [],
      activeEditorFilePath: null,
    });
  },
  isSidebarOpen: true,
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

  // Workspace Project Root & Approval Policy
  workspaceProjectRoot: '',
  setWorkspaceProjectRoot: async (workspaceProjectRoot) => {
    set((s) => ({
      workspaceProjectRoot,
      activeWorkspacePath: workspaceProjectRoot,
      terminalTabs: s.terminalTabs.map((t) => ({ ...t, cwd: workspaceProjectRoot })),
    }));
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_workspace_directory', { path: workspaceProjectRoot });
        await get().fetchWorkspaceFiles();
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
            activeWorkspacePath: chosen,
            terminalTabs: s.terminalTabs.map((t) => ({ ...t, cwd: chosen })),
          }));
          await invoke('set_workspace_directory', { path: chosen });
          await get().fetchWorkspaceFiles();
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
  isStrictApprovalMode: typeof localStorage !== 'undefined' ? localStorage.getItem('agentic_strict_approval_mode') === 'true' : false,
  toggleStrictApprovalMode: () => {
    const nextVal = !get().isStrictApprovalMode;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('agentic_strict_approval_mode', nextVal ? 'true' : 'false');
    }
    set({ isStrictApprovalMode: nextVal });
    if (nextVal) {
      get().addToast('warning', 'Mode Strict aktif: AI mengeksekusi aksi tanpa meminta izin.');
    } else {
      get().addToast('info', 'Mode Ask for approval aktif: Operator menyetujui setiap aksi berisiko.');
    }
  },
  setStrictApprovalMode: (val: boolean) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('agentic_strict_approval_mode', val ? 'true' : 'false');
    }
    set({ isStrictApprovalMode: val });
    if (val) {
      get().addToast('warning', 'Mode Strict aktif: AI mengeksekusi aksi tanpa meminta izin.');
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
      set({
        availableModels: [],
        selectedModel: '',
        isDetectingModels: false,
      });
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

    set({
      availableModels: [],
      selectedModel: '',
      isDetectingModels: false,
    });
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
  lastTelemetry: {
    ttftMs: null,
    totalLatencyMs: null,
    lastInputTokens: 0,
    lastOutputTokens: 0,
  },
  setLastTelemetry: (telemetry) =>
    set((s) => ({
      lastTelemetry: {
        ...s.lastTelemetry,
        ...telemetry,
      },
    })),
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
              avatar_color: isOp ? '#ececec' : '#737373',
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
          parentSessionId: null,
          forkedFromMessageId: null,
        }).catch((e) => console.warn('Gagal simpan create_chat_session ke SQLite:', e));
      });
    }

    return newId;
  },

  forkSessionFromMessage: async (sessionId: string, upToMessageId: string) => {
    const state = get();
    const sourceSession = state.sessions.find((s) => s.id === sessionId);
    if (!sourceSession) {
      state.addToast('error', 'Sesi asal tidak ditemukan.');
      return null;
    }

    // Ambil riwayat pesan hingga pesan yang dipilih
    let sourceMessages = state.messages.filter((m) => m.session_id === sessionId);
    if (sourceMessages.length === 0 && (window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        sourceMessages = (await invoke('get_chat_messages', { sessionId })) as ChatMessage[];
      } catch (e) {
        console.warn('Gagal memuat pesan untuk forking:', e);
      }
    }

    const targetIdx = sourceMessages.findIndex((m) => m.id === upToMessageId);
    const messagesToClone =
      targetIdx !== -1 ? sourceMessages.slice(0, targetIdx + 1) : sourceMessages;

    const newForkedId = `session-fork-${Date.now()}`;
    const cleanOriginTitle = sourceSession.title.replace(/^\[Cabang\]\s*/, '');
    const newTitle = `[Cabang] ${cleanOriginTitle}`;

    const newSession: ChatSession = {
      id: newForkedId,
      title: newTitle,
      model: sourceSession.model || state.selectedModel,
      provider: sourceSession.provider || state.selectedProvider,
      mode: sourceSession.mode || state.currentMode,
      parent_session_id: sessionId,
      forked_from_message_id: upToMessageId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const clonedMessages: ChatMessage[] = messagesToClone.map((m, idx) => ({
      ...m,
      id: `fork-msg-${Date.now()}-${idx}`,
      session_id: newForkedId,
    }));

    set((s) => ({
      sessions: [newSession, ...s.sessions],
      activeSessionId: newForkedId,
      messages: clonedMessages,
    }));

    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('fork_chat_session', {
          session: newSession,
          messages: clonedMessages,
        });
      } catch (err) {
        console.warn('Gagal menyimpan sesi forked ke SQLite:', err);
      }
    }

    state.addToast('success', `Percabangan berhasil dibuat dari pesan terpilih (${clonedMessages.length} pesan).`);
    return newForkedId;
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
        avatar_color: '#737373',
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

    // Riwayat diskusi tim sebelumnya
    const recentMessages = session.messages
      .slice(-8)
      .map((m) => `${m.agent_name} (${m.agent_role}): ${m.content}`)
      .join('\n\n');

    const activeTasksSummary = state.kanbanTasks.length > 0
      ? `\n\nDaftar Tugas Papan Kanban Proyek Saat Ini:\n` +
        state.kanbanTasks
          .map(
            (t) =>
              `- [${t.id}] (${t.status}, progress: ${t.progress}%) ${t.title} [Ditugaskan: ${t.assigned_agent}]`
          )
          .join('\n') +
        `\n\nUntuk memperbarui progres tugas, panggil tool 'update_kanban_task' dengan parameter 'task_id' dan 'status' ('in_progress' saat mulai mengerjakan, atau 'in_review' saat implementasi/pengujian selesai). Catatan: Status 'done' hanya dapat disetujui secara langsung oleh operator.`
      : '';

    const systemPrompt = `Anda adalah ${currentAgent.name}, dengan peran: ${currentAgent.role}.
Tugas utama Anda: ${currentAgent.task_description}
Keahlian/Skills yang Anda miliki: ${currentAgent.skills.join(', ')}
${currentAgent.system_instructions ? `Instruksi khusus: ${currentAgent.system_instructions}` : ''}

Target Proyek Bersama:
"${session.project_goal}"

Direktori Workspace Proyek Aktif:
"${state.workspaceProjectRoot}"
${activeTasksSummary}

ATURAN KOMUNIKASI & EKSEKUSI TOOL:
1. WAJIB menggunakan Bahasa Indonesia yang ramah, profesional, dan terstruktur.
2. Anda memiliki akses ke tool nyata sistem (read_file, write_file, list_dir, execute_command, web_fetch, web_search, update_kanban_task).
3. Jika tugas Anda membutuhkan pencarian internet terbaru, pembacaan file, pembuatan file, pemeriksaan folder, atau pengetesan perintah, panggillah tools yang sesuai secara bertahap.
4. Jangan ragu memanggil tools berulang kali jika diperlukan untuk menyelesaikan giliran tugas Anda secara tuntas.
5. Setelah semua tool selesai dijalankan, berikan rangkuman hasil kerja dan penjelasan yang jelas kepada tim.`;

    const messagesHistory: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool';
      content?: string;
      tool_calls?: any[];
      tool_call_id?: string;
    }> = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Riwayat Diskusi Tim Sebelumnya:\n${recentMessages || '(Belum ada pesan sebelumnya, Anda adalah pembicara pertama)'}\n\nSekarang giliran Anda (${currentAgent.name}) untuk berkontribusi dan mengambil tindakan.`,
      },
    ];

    const targetChatUrl = getChatEndpoint(baseUrl);
    let iteration = 0;
    const maxIterations = 5;
    const accumulatedSteps: ExecutionStep[] = [];
    let finalContent = '';

    state.addLog({
      id: `log-start-${Date.now()}`,
      agent_name: currentAgent.name,
      level: 'INFO',
      message: `Memulai giliran kerja ke-${session.current_turn_index + 1} (${currentAgent.role})`,
      timestamp: new Date().toLocaleTimeString(),
    });

    try {
      while (iteration < maxIterations) {
        if (get().emergencyStopped) {
          state.addToast('warning', 'Eksekusi dihentikan oleh operator (Emergency Stop).');
          break;
        }
        iteration++;

        const combinedTools = [
          ...AGENT_AVAILABLE_TOOLS,
          ...get().mcpTools.map(convertMcpToolToDefinition),
        ];

        const res = await fetch(targetChatUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: messagesHistory,
            tools: combinedTools,
            temperature: 0.5,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(formatApiErrorMessage(res.status, errText, model));
        }

        const rawText = await res.text();
        const data = parseRobustJson<any>(rawText);
        const choice = data.choices?.[0]?.message;
        if (!choice) break;

        const toolCalls = choice.tool_calls;
        const msgContent = choice.content || '';

        if (!toolCalls || toolCalls.length === 0) {
          finalContent = msgContent || `${currentAgent.name} telah menyelesaikan gilirannya.`;
          break;
        }

        messagesHistory.push({
          role: 'assistant',
          content: msgContent,
          tool_calls: toolCalls,
        });

        for (const call of toolCalls) {
          if (get().emergencyStopped) break;

          const toolName = call.function?.name || 'unknown_tool';
          let toolParams: Record<string, any> = {};
          try {
            toolParams =
              typeof call.function?.arguments === 'string'
                ? JSON.parse(call.function.arguments)
                : call.function?.arguments || {};
          } catch {
            toolParams = {};
          }

          const targetPath = String(toolParams.path || toolParams.working_dir || '');
          const isExternal = isPathExternal(targetPath, state.workspaceProjectRoot);
          const externalPolicy = state.settings.externalDirectoryAccess || 'always_ask';

          let shouldAskClearance = false;
          let clearanceReason = '';

          // 1. Pengecekan akses direktori eksternal
          if (isExternal) {
            if (externalPolicy === 'workspace_only') {
              const rejectMsg = `Keamanan: Akses ke '${targetPath}' ditolak karena jalur berada di luar workspace dan pengaturan diset ke 'Hanya Workspace Ini'.`;
              messagesHistory.push({
                role: 'tool',
                tool_call_id: call.id,
                content: rejectMsg,
              });
              accumulatedSteps.push({
                id: `step-${Date.now()}-${accumulatedSteps.length}`,
                name: toolName,
                tool: toolName,
                params: toolParams,
                status: 'failed',
                duration: '0ms',
                output: rejectMsg,
                timestamp: new Date().toLocaleTimeString(),
              });
              state.addLog({
                id: `log-tool-${Date.now()}`,
                agent_name: currentAgent.name,
                level: 'FAIL',
                message: `Akses direktori luar ditolak: ${targetPath}`,
                timestamp: new Date().toLocaleTimeString(),
              });
              continue;
            } else if (externalPolicy === 'always_ask') {
              shouldAskClearance = true;
              clearanceReason = `Agen ingin mengakses direktori eksternal: ${targetPath}`;
            }
          }

          // 2. Strict approval mode atau tool berisiko (execute_command atau tool eksternal MCP)
          if (state.isStrictApprovalMode || toolName === 'execute_command' || toolName.startsWith('mcp__')) {
            shouldAskClearance = true;
            if (!clearanceReason) {
              clearanceReason =
                toolName === 'execute_command'
                  ? `Eksekusi perintah terminal: ${toolParams.command || ''}`
                  : toolName.startsWith('mcp__')
                  ? `Eksekusi tool eksternal Model Context Protocol (MCP): ${toolName}`
                  : `Menjalankan aksi tool: ${toolName}`;
            }
          }

          let isApproved = true;
          if (shouldAskClearance) {
            isApproved = await new Promise<boolean>((resolve) => {
              set({
                pendingClearanceResolver: resolve,
                pendingToolClearance: {
                  id: `clr-${Date.now()}`,
                  tool_name: toolName,
                  parameters: {
                    ...toolParams,
                    _deskripsi: clearanceReason,
                    _is_external: isExternal,
                  },
                  requires_clearance: true,
                  risk_level: toolName === 'execute_command' || toolName.startsWith('mcp__') || isExternal ? 'High' : 'Medium',
                },
              });
            });
          }

          if (!isApproved) {
            const deniedMsg = `Ditolak oleh Operator: Izin eksekusi untuk tool '${toolName}' tidak diberikan.`;
            messagesHistory.push({
              role: 'tool',
              tool_call_id: call.id,
              content: deniedMsg,
            });
            accumulatedSteps.push({
              id: `step-${Date.now()}-${accumulatedSteps.length}`,
              name: toolName,
              tool: toolName,
              params: toolParams,
              status: 'failed',
              duration: '0ms',
              output: deniedMsg,
              timestamp: new Date().toLocaleTimeString(),
            });
            state.addLog({
              id: `log-denied-${Date.now()}`,
              agent_name: currentAgent.name,
              level: 'WARN',
              message: `Operator menolak eksekusi tool ${toolName}`,
              timestamp: new Date().toLocaleTimeString(),
            });
            continue;
          }

          // Eksekusi tool via Tauri IPC atau State Handler
          const startTime = Date.now();
          let stepOutput = '';
          let stepSuccess = false;

          // Handler khusus untuk tool update_kanban_task (State Store)
          if (toolName === 'update_kanban_task') {
            const taskId = String(toolParams.task_id || '').trim();
            const requestedStatus = String(toolParams.status || '').trim().toLowerCase();
            const progress = typeof toolParams.progress === 'number' ? toolParams.progress : undefined;
            const note = toolParams.note ? String(toolParams.note).trim() : '';

            const existingTask = get().kanbanTasks.find((t) => t.id === taskId);
            if (!existingTask) {
              stepSuccess = false;
              stepOutput = `Error: Tugas dengan ID '${taskId}' tidak ditemukan di papan Kanban. Pastikan ID sesuai dengan daftar tugas aktif.`;
            } else {
              stepSuccess = true;
              let finalStatus: KanbanTask['status'] = 'in_progress';
              let warningNote = '';

              if (requestedStatus === 'done') {
                // Human-in-the-Loop Guardrail:
                // Status 'done' hanya dapat disetujui secara manual oleh operator/user!
                finalStatus = 'in_review';
                warningNote = ` Catatan Keamanan: Status 'done' memerlukan persetujuan dan verifikasi manual dari operator. Tugas secara otomatis dialihkan ke status 'in_review' dan menunggu review operator.`;
                get().addToast('info', `Tugas ${taskId} dialihkan ke In Review (menunggu verifikasi operator)`, 4000);
              } else if (requestedStatus === 'in_review') {
                finalStatus = 'in_review';
                get().addToast('info', `Tugas ${taskId} dipindahkan ke In Review oleh ${currentAgent.name}`, 3000);
              } else {
                finalStatus = 'in_progress';
                get().addToast('info', `Tugas ${taskId} mulai dikerjakan (In Progress) oleh ${currentAgent.name}`, 3000);
              }

              const newProgress =
                progress !== undefined
                  ? Math.min(100, Math.max(0, progress))
                  : finalStatus === 'in_review'
                  ? 90
                  : 50;

              set((s) => ({
                kanbanTasks: s.kanbanTasks.map((t) =>
                  t.id === taskId
                    ? {
                        ...t,
                        status: finalStatus,
                        progress: newProgress,
                        assigned_agent: currentAgent.name,
                      }
                    : t
                ),
              }));

              stepOutput = `Sukses: Status tugas '${taskId}' (${existingTask.title}) berhasil diperbarui menjadi '${finalStatus}' dengan progres ${newProgress}%.${note ? ` Catatan: ${note}.` : ''}${warningNote}`;
            }

            const elapsedMs = Date.now() - startTime;
            accumulatedSteps.push({
              id: `step-${Date.now()}-${accumulatedSteps.length}`,
              name: toolName,
              tool: toolName,
              params: toolParams,
              status: stepSuccess ? 'success' : 'failed',
              duration: `${elapsedMs}ms`,
              output: stepOutput,
              timestamp: new Date().toLocaleTimeString(),
            });

            messagesHistory.push({
              role: 'tool',
              tool_call_id: call.id,
              content: stepOutput,
            });

            state.addLog({
              id: `log-kanban-${Date.now()}`,
              agent_name: currentAgent.name,
              level: 'INFO',
              message: `Memperbarui status tugas ${taskId} menjadi ${toolParams.status}`,
              timestamp: new Date().toLocaleTimeString(),
            });

            continue;
          }

          const activeWorkPath = toolParams?.path || toolParams?.relativePath || toolParams?.file_path;
          if (activeWorkPath && (toolName === 'write_file' || toolName === 'create_workspace_file' || toolName === 'read_file')) {
            get().setActiveAgentWorkFile(activeWorkPath, {
              filePath: activeWorkPath,
              agentId: currentAgent.id,
              agentName: currentAgent.name,
              agentRole: currentAgent.role,
              avatarColor: currentAgent.avatar_color,
              status: 'working',
              updatedAt: Date.now(),
            });
          }

          if ((window as any).__TAURI_INTERNALS__) {
            try {
              const { invoke } = await import('@tauri-apps/api/core');
              const invokeParams = { ...toolParams };
              if (isExternal && (externalPolicy === 'always_allow' || isApproved)) {
                invokeParams.allow_external = true;
              }

              const toolRes: any = await invoke('execute_sandbox_tool', {
                toolName,
                parameters: invokeParams,
              });

              stepSuccess = Boolean(toolRes?.success);
              stepOutput = toolRes?.output || (stepSuccess ? 'Aksi selesai tanpa output.' : 'Eksekusi gagal.');

              if (toolName === 'write_file' && stepSuccess && toolParams.path) {
                // Daftarkan animasi ketikan untuk berkas ini
                get().registerPendingTypingAnimation({
                  filePath: toolParams.path,
                  fullContent: toolParams.content || '',
                  agentName: currentAgent.name,
                  avatarColor: currentAgent.avatar_color,
                  timestamp: Date.now(),
                });

                // Perbarui jika sudah terbuka di editor
                set((s) => ({
                  openEditorFiles: s.openEditorFiles.map((f) =>
                    f.path === toolParams.path
                      ? {
                          ...f,
                          originalContent: toolParams.content || '',
                          isDirty: false,
                        }
                      : f
                  ),
                  codeReviewItems: [
                    ...s.codeReviewItems.filter((i) => i.filename !== toolParams.path),
                    {
                      id: `item-${Date.now()}`,
                      filename: toolParams.path,
                      language: toolParams.path.split('.').pop() || 'text',
                      content: toolParams.content || '',
                      description: `Dibuat oleh ${currentAgent.name}`,
                      status: 'accepted',
                      agentName: currentAgent.name,
                      agentRole: currentAgent.role,
                      avatarColor: currentAgent.avatar_color,
                      timestamp: new Date().toLocaleTimeString(),
                    },
                  ],
                }));
              }
            } catch (invErr: any) {
              stepSuccess = false;
              stepOutput = invErr?.message || String(invErr);
            }
          } else {
            // Fallback Web Preview simulasi
            await new Promise((r) => setTimeout(r, 600));
            stepSuccess = true;
            stepOutput = `[Web Preview] Tool ${toolName} berhasil disimulasikan.`;
            if (toolName === 'write_file' && toolParams.path) {
              get().registerPendingTypingAnimation({
                filePath: toolParams.path,
                fullContent: toolParams.content || '',
                agentName: currentAgent.name,
                avatarColor: currentAgent.avatar_color,
                timestamp: Date.now(),
              });
            }
          }

          if (activeWorkPath) {
            setTimeout(() => {
              get().setActiveAgentWorkFile(activeWorkPath, null);
            }, 2500);
          }

          const elapsedMs = Date.now() - startTime;
          accumulatedSteps.push({
            id: `step-${Date.now()}-${accumulatedSteps.length}`,
            name: toolName,
            tool: toolName,
            params: toolParams,
            status: stepSuccess ? 'success' : 'failed',
            duration: `${elapsedMs}ms`,
            output: stepOutput,
            timestamp: new Date().toLocaleTimeString(),
          });

          messagesHistory.push({
            role: 'tool',
            tool_call_id: call.id,
            content: stepOutput,
          });

          state.addLog({
            id: `log-exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            agent_name: currentAgent.name,
            level: stepSuccess ? 'EXEC' : 'FAIL',
            message: `${toolName}: ${stepOutput.slice(0, 100)}${stepOutput.length > 100 ? '...' : ''} (${elapsedMs}ms)`,
            timestamp: new Date().toLocaleTimeString(),
          });
        }
      }

      if (!finalContent && accumulatedSteps.length > 0) {
        finalContent = `${currentAgent.name} telah mengeksekusi ${accumulatedSteps.length} langkah aksi untuk target proyek.`;
      }

      // Fallback deteksi blok kode markdown jika model menyertakan kode di teks
      const tempMsg: DiscussionMessage = {
        id: `turn-${Date.now()}`,
        agent_id: currentAgent.id,
        agent_name: currentAgent.name,
        agent_role: currentAgent.role,
        avatar_color: currentAgent.avatar_color,
        content: finalContent,
        step_type: currentTurn === 0 ? 'proposal' : currentTurn === 1 ? 'implementation' : 'critique',
        timestamp: new Date().toLocaleTimeString(),
        tool_steps: accumulatedSteps.length > 0 ? accumulatedSteps : undefined,
      };

      const extractedItems = extractCodeReviewItems([tempMsg]);
      if (extractedItems.length > 0) {
        set((s) => ({
          codeReviewItems: [
            ...s.codeReviewItems.filter((i) => !extractedItems.some((e) => e.filename === i.filename)),
            ...extractedItems,
          ],
        }));
      }

      const newMsg: DiscussionMessage = {
        ...tempMsg,
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
        message: `Menyelesaikan respons giliran ke-${session.current_turn_index + 1} (${accumulatedSteps.length} tools dieksekusi)`,
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
      avatar_color: '#ececec',
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
      avatar_color: '#ececec',
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
    { "name": "Nama Agen", "role": "Peran Agen", "task_description": "Deskripsi tugas peran", "skills": ["file_system", "code_evaluator"], "avatar_color": "#737373" }
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
                  avatar_color: sq.avatar_color || '#737373',
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
          { name: 'Frontend Engineer', role: 'Frontend Engineer', task_description: 'Membangun antarmuka interaktif dan integrasi visual', skills: ['file_system', 'code_evaluator'], avatar_color: '#737373' },
          { name: 'Backend Architect', role: 'Backend Architect', task_description: 'Merancang API, struktur data, dan arsitektur inti', skills: ['terminal_runner', 'file_system'], avatar_color: '#737373' },
          { name: 'QA Auditor', role: 'QA Engineer', task_description: 'Memverifikasi fungsionalitas, keamanan kode, dan pengujian', skills: ['code_evaluator'], avatar_color: '#f59e0b' },
        ];
      }

      const orchMsg: DiscussionMessage = {
        id: `plan-orch-${Date.now()}`,
        agent_id: 'lead-orchestrator',
        agent_name: 'Lead Orchestrator',
        agent_role: 'Built-in System Architect',
        avatar_color: '#383838',
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
          { name: 'Frontend Engineer', role: 'Frontend Engineer', task_description: 'Membangun antarmuka interaktif dan integrasi visual', skills: ['file_system', 'code_evaluator'], avatar_color: '#737373' },
          { name: 'Backend Architect', role: 'Backend Architect', task_description: 'Merancang API, struktur data, dan arsitektur inti', skills: ['terminal_runner', 'file_system'], avatar_color: '#737373' },
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
      avatar_color: '#383838',
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
  pendingClearanceResolver: null,
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
  setPendingClearanceResolver: (pendingClearanceResolver) => set({ pendingClearanceResolver }),
  resolveToolClearance: (approved) => {
    const s = get();
    if (s.pendingClearanceResolver) {
      s.pendingClearanceResolver(approved);
    }
    if (s.pendingToolClearance) {
      s.addToast(
        approved ? 'success' : 'warning',
        approved
          ? `Izin diberikan untuk ${s.pendingToolClearance.tool_name}`
          : `Eksekusi tool ditolak oleh operator`
      );
    }
    set({ pendingToolClearance: null, pendingClearanceResolver: null });
  },
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
      cwd: '',
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

  // Universal Context Vault (Obsidian-Style)
  isVaultPageOpen: false,
  setIsVaultPageOpen: (isVaultPageOpen) => set({ isVaultPageOpen }),
  activeVaultTab: 'graph',
  setActiveVaultTab: (activeVaultTab) => set({ activeVaultTab }),
  pendingDeleteRequests: [],
  trashNotes: [],
  vaultAuditLog: [],
  isPendingApprovalsModalOpen: false,
  setPendingApprovalsModalOpen: (isPendingApprovalsModalOpen) => set({ isPendingApprovalsModalOpen }),
  isTrashModalOpen: false,
  setTrashModalOpen: (isTrashModalOpen) => set({ isTrashModalOpen }),
  isGraphViewModalOpen: false,
  setGraphViewModalOpen: (isGraphViewModalOpen) => set({ isGraphViewModalOpen }),
  isVaultAuditModalOpen: false,
  setVaultAuditModalOpen: (isVaultAuditModalOpen) => set({ isVaultAuditModalOpen }),

  fetchPendingDeleteRequests: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const list = await invoke<DeleteRequest[]>('get_pending_delete_requests');
      set({ pendingDeleteRequests: list || [] });
    } catch {
      set({ pendingDeleteRequests: [] });
    }
  },

  approveDeleteRequest: async (requestId: string) => {
    const s = get();
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('approve_delete_request', { requestId });
      s.addToast('success', 'Permintaan hapus disetujui. Note dipindahkan ke .trash/');
      await s.fetchPendingDeleteRequests();
      await s.fetchTrashNotes();
    } catch {
      const target = s.pendingDeleteRequests.find((r) => r.request_id === requestId);
      if (target) {
        set((state) => ({
          pendingDeleteRequests: state.pendingDeleteRequests.filter((r) => r.request_id !== requestId),
          trashNotes: [
            {
              file_name: `${target.note_title.toLowerCase().replace(/\s+/g, '_')}.md.${Math.floor(Date.now() / 1000)}.trash`,
              original_title: target.note_title,
              deleted_at: Math.floor(Date.now() / 1000),
              size_bytes: target.note_content_preview?.length || 2048,
            },
            ...state.trashNotes,
          ],
          vaultAuditLog: [
            {
              id: `audit-${Date.now()}`,
              timestamp: Math.floor(Date.now() / 1000),
              action: 'DELETE',
              note_title: target.note_title,
              agent_id: target.agent_id,
              diff_summary: `- Disetujui operator: ${target.reason}`,
              previous_content: target.note_content_preview,
            },
            ...state.vaultAuditLog,
          ],
        }));
        s.addToast('success', 'Permintaan hapus disetujui. Note dipindahkan ke .trash/');
      }
    }
  },

  rejectDeleteRequest: async (requestId: string) => {
    const s = get();
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('reject_delete_request', { requestId });
      s.addToast('info', 'Permintaan hapus ditolak.');
      await s.fetchPendingDeleteRequests();
    } catch {
      set((state) => ({
        pendingDeleteRequests: state.pendingDeleteRequests.filter((r) => r.request_id !== requestId),
      }));
      s.addToast('info', 'Permintaan hapus ditolak.');
    }
  },

  batchApproveDeleteRequests: async (requestIds: string[]) => {
    const s = get();
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const count = await invoke<number>('batch_approve_delete_requests', { requestIds });
      s.addToast('success', `${count} permintaan hapus berhasil disetujui.`);
      await s.fetchPendingDeleteRequests();
      await s.fetchTrashNotes();
    } catch {
      set((state) => {
        const approved = state.pendingDeleteRequests.filter((r) => requestIds.includes(r.request_id));
        const remaining = state.pendingDeleteRequests.filter((r) => !requestIds.includes(r.request_id));
        const newTrash: TrashItem[] = approved.map((r) => ({
          file_name: `${r.note_title.toLowerCase().replace(/\s+/g, '_')}.md.${Math.floor(Date.now() / 1000)}.trash`,
          original_title: r.note_title,
          deleted_at: Math.floor(Date.now() / 1000),
          size_bytes: r.note_content_preview?.length || 2048,
        }));
        const newAudits: VaultAuditEntry[] = approved.map((r) => ({
          id: `audit-${Math.random()}`,
          timestamp: Math.floor(Date.now() / 1000),
          action: 'DELETE',
          note_title: r.note_title,
          agent_id: r.agent_id,
          diff_summary: `- Batch approve operator: ${r.reason}`,
          previous_content: r.note_content_preview,
        }));
        return {
          pendingDeleteRequests: remaining,
          trashNotes: [...newTrash, ...state.trashNotes],
          vaultAuditLog: [...newAudits, ...state.vaultAuditLog],
        };
      });
      s.addToast('success', `${requestIds.length} permintaan hapus berhasil disetujui.`);
    }
  },

  batchRejectDeleteRequests: async (requestIds: string[]) => {
    const s = get();
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const count = await invoke<number>('batch_reject_delete_requests', { requestIds });
      s.addToast('info', `${count} permintaan hapus ditolak.`);
      await s.fetchPendingDeleteRequests();
    } catch {
      set((state) => ({
        pendingDeleteRequests: state.pendingDeleteRequests.filter((r) => !requestIds.includes(r.request_id)),
      }));
      s.addToast('info', `${requestIds.length} permintaan hapus ditolak.`);
    }
  },

  fetchTrashNotes: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const list = await invoke<TrashItem[]>('list_trash_notes');
      set({ trashNotes: list || [] });
    } catch {
      set({ trashNotes: [] });
    }
  },

  restoreTrashNote: async (fileName: string) => {
    const s = get();
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const restoredTitle = await invoke<string>('restore_trash_note', { fileName });
      s.addToast('success', `Note berhasil dipulihkan: ${restoredTitle}`);
      await s.fetchTrashNotes();
      return restoredTitle;
    } catch {
      const target = s.trashNotes.find((t) => t.file_name === fileName);
      if (target) {
        set((state) => ({
          trashNotes: state.trashNotes.filter((t) => t.file_name !== fileName),
          vaultAuditLog: [
            {
              id: `audit-${Date.now()}`,
              timestamp: Math.floor(Date.now() / 1000),
              action: 'RESTORE',
              note_title: target.original_title,
              agent_id: 'user',
              diff_summary: `<- Pemulihan note ${target.file_name} kembali ke root vault`,
            },
            ...state.vaultAuditLog,
          ],
        }));
        s.addToast('success', `Note berhasil dipulihkan: ${target.original_title}`);
        return target.original_title;
      }
      return null;
    }
  },

  purgeTrashNote: async (fileName: string) => {
    const s = get();
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('purge_trash_note', { fileName });
      s.addToast('info', `Berkas ${fileName} dihapus permanen.`);
      await s.fetchTrashNotes();
    } catch {
      set((state) => ({
        trashNotes: state.trashNotes.filter((t) => t.file_name !== fileName),
      }));
      s.addToast('info', `Berkas ${fileName} dihapus permanen.`);
    }
  },

  fetchVaultAuditLog: async (limit = 100) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const entries = await invoke<VaultAuditEntry[]>('get_vault_audit_log', { limit });
      set({ vaultAuditLog: entries || [] });
    } catch {
      set({ vaultAuditLog: [] });
    }
  },

  getGraphSnapshot: async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const snapshot = await invoke<GraphSnapshot>('get_graph_snapshot');
      if (snapshot && snapshot.nodes) {
        return snapshot;
      }
      return { nodes: [], edges: [] };
    } catch {
      return { nodes: [], edges: [] };
    }
  },

  searchNotesHybrid: async (query: string, limit = 15) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<ScoredSearchResult[]>('search_notes_hybrid', { query, limit });
    } catch {
      return [];
    }
  },

  // MCP (Model Context Protocol) Implementation
  mcpServers: [],
  mcpTools: [],
  mcpStatuses: [],

  fetchMcpServers: async () => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const list = await invoke<McpServerConfig[]>('mcp_list_servers');
        set({ mcpServers: list || [] });
      }
    } catch (e) {
      console.error('Failed to list MCP servers:', e);
    }
  },

  fetchMcpTools: async () => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const tools = await invoke<McpToolInfo[]>('mcp_list_active_tools');
        const statuses = await invoke<McpServerStatus[]>('mcp_get_server_statuses');
        set({ mcpTools: tools || [], mcpStatuses: statuses || [] });
      }
    } catch (e) {
      console.error('Failed to list MCP tools:', e);
    }
  },

  fetchMcpStatuses: async () => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const statuses = await invoke<McpServerStatus[]>('mcp_get_server_statuses');
        set({ mcpStatuses: statuses || [] });
      }
    } catch (e) {
      console.error('Failed to get MCP server statuses:', e);
    }
  },

  saveMcpServer: async (config: McpServerConfig) => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('mcp_save_server', { config });
        await get().fetchMcpServers();
        await get().fetchMcpTools();
        get().addToast('success', `Konfigurasi server MCP '${config.name}' berhasil disimpan.`);
      }
    } catch (e: any) {
      get().addToast('error', `Gagal menyimpan server MCP: ${e}`);
      throw e;
    }
  },

  deleteMcpServer: async (id: string) => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('mcp_delete_server', { id });
        await get().fetchMcpServers();
        await get().fetchMcpTools();
        get().addToast('info', 'Server MCP berhasil dihapus.');
      }
    } catch (e: any) {
      get().addToast('error', `Gagal menghapus server MCP: ${e}`);
    }
  },

  toggleMcpServer: async (id: string, isActive: boolean) => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('mcp_toggle_server', { id, isActive });
        await get().fetchMcpServers();
        await get().fetchMcpTools();
        get().addToast('info', `Server MCP ${isActive ? 'diaktifkan' : 'dinonaktifkan'}.`);
      }
    } catch (e: any) {
      get().addToast('error', `Gagal mengubah status server MCP: ${e}`);
    }
  },

  importMcpConfigJson: async (jsonStr: string) => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const count = await invoke<number>('mcp_import_json_config', { jsonStr });
        await get().fetchMcpServers();
        await get().fetchMcpTools();
        get().addToast('success', `Berhasil mengimpor ${count} server MCP.`);
        return count;
      }
      return 0;
    } catch (e: any) {
      get().addToast('error', `Gagal mengimpor konfigurasi MCP: ${e}`);
      throw e;
    }
  },

  callMcpTool: async (namespacedName: string, args: any) => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<string>('mcp_call_tool', { namespacedName, arguments: args });
      }
      return 'Simulated MCP call result (browser mode)';
    } catch (e: any) {
      throw new Error(`MCP tool call failed: ${e}`);
    }
  },

  // Dedicated Artifacts & Canvas (Sidecar Viewer) Implementation
  artifacts: [],
  activeArtifactId: null,
  isSidecarOpen: false,
  sidecarWidth: 540,
  sidecarTab: 'code',

  openArtifact: (artifact: Artifact) => {
    const existing = get().artifacts.find((a) => a.id === artifact.id);
    const isPreviewable = ['html', 'svg', 'mermaid', 'markdown'].includes(artifact.language.toLowerCase());
    if (!existing) {
      set((s) => ({
        artifacts: [artifact, ...s.artifacts],
        activeArtifactId: artifact.id,
        isSidecarOpen: true,
        sidecarTab: isPreviewable ? 'preview' : 'code',
      }));
    } else {
      set({
        activeArtifactId: artifact.id,
        isSidecarOpen: true,
        sidecarTab: isPreviewable ? 'preview' : 'code',
      });
    }
  },

  closeSidecar: () => set({ isSidecarOpen: false }),

  toggleSidecar: () => set((s) => ({ isSidecarOpen: !s.isSidecarOpen })),

  setSidecarTab: (sidecarTab) => set({ sidecarTab }),

  setSidecarWidth: (sidecarWidth) => set({ sidecarWidth: Math.max(360, Math.min(840, sidecarWidth)) }),

  setActiveArtifactId: (activeArtifactId) => {
    const art = get().artifacts.find((a) => a.id === activeArtifactId);
    const isPreviewable = art ? ['html', 'svg', 'mermaid', 'markdown'].includes(art.language.toLowerCase()) : false;
    set({
      activeArtifactId,
      sidecarTab: isPreviewable ? 'preview' : 'code',
    });
  },

  updateArtifactContent: (id, newContent, author, summary) => {
    set((s) => ({
      artifacts: s.artifacts.map((a) => {
        if (a.id !== id) return a;
        const newVersionNumber = a.versions.length + 1;
        const newVersion: ArtifactVersion = {
          version: newVersionNumber,
          content: newContent,
          timestamp: new Date().toISOString(),
          author,
          summary: summary || (author === 'user' ? 'Operator manual edit' : 'AI generated revision'),
        };
        const updatedVersions = [...a.versions, newVersion];
        return {
          ...a,
          content: newContent,
          versions: updatedVersions,
          currentVersionIndex: updatedVersions.length - 1,
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  },

  setArtifactVersion: (id, versionIndex) => {
    set((s) => ({
      artifacts: s.artifacts.map((a) => {
        if (a.id !== id) return a;
        const targetVersion = a.versions[versionIndex];
        if (!targetVersion) return a;
        return {
          ...a,
          content: targetVersion.content,
          currentVersionIndex: versionIndex,
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  },

  saveArtifactToWorkspace: async (id, relativePath) => {
    const art = get().artifacts.find((a) => a.id === id);
    if (!art) {
      get().addToast('error', 'Artefak tidak ditemukan.');
      return false;
    }
    const defaultExt =
      art.language === 'markdown'
        ? 'md'
        : art.language === 'typescript'
        ? 'ts'
        : art.language === 'javascript'
        ? 'js'
        : art.language === 'python'
        ? 'py'
        : art.language === 'rust'
        ? 'rs'
        : art.language === 'html'
        ? 'html'
        : art.language === 'css'
        ? 'css'
        : art.language === 'json'
        ? 'json'
        : 'txt';
    const targetPath =
      relativePath.trim() ||
      (art.title.includes('.') ? art.title : `${art.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.${defaultExt}`);
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('execute_sandbox_tool', {
          toolName: 'write_file',
          parameters: {
            path: targetPath,
            content: art.content,
          },
        });
      }
      get().addToast('success', `Berhasil menyimpan artefak ke "${targetPath}"`);
      return true;
    } catch (e: any) {
      get().addToast('error', `Gagal menyimpan artefak: ${e?.message || e}`);
      return false;
    }
  },

  // Workspace File Explorer & Codebase RAG Actions
  sidebarTab: 'sessions',
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  workspaceFiles: [],
  activeWorkspacePath: null,
  isWorkspaceFilesLoading: false,

  fetchWorkspaceFiles: async () => {
    // Jika tidak ada sesi aktif, jangan buka atau muat direktori apapun demi keamanan
    if (!get().activeSessionId) {
      set({
        activeWorkspacePath: null,
        workspaceFiles: [],
        isWorkspaceFilesLoading: false,
      });
      return;
    }

    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      try {
        set({ isWorkspaceFilesLoading: true });
        const { invoke } = await import('@tauri-apps/api/core');
        let dir = await invoke<string>('get_workspace_directory');

        if (!dir && get().workspaceProjectRoot) {
          const defaultProject = get().workspaceProjectRoot;
          if (defaultProject && defaultProject !== '/home/yudz' && defaultProject !== '/') {
            await invoke('set_workspace_directory', { path: defaultProject });
            dir = await invoke<string>('get_workspace_directory');
          }
        }

        if (!dir) {
          set({
            activeWorkspacePath: null,
            workspaceFiles: [],
            isWorkspaceFilesLoading: false,
          });
          return;
        }

        const tree = await invoke<FileNode[]>('get_workspace_file_tree', { maxDepth: 6 });
        set({
          activeWorkspacePath: dir || null,
          workspaceFiles: tree || [],
          isWorkspaceFilesLoading: false,
        });
      } catch (err) {
        console.error('Failed to fetch workspace files:', err);
        set({ isWorkspaceFilesLoading: false });
      }
    }
  },

  createWorkspaceFile: async (relativePath: string, isDir: boolean) => {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('create_workspace_file', { relativePath, isDir });
        await get().fetchWorkspaceFiles();
        get().addToast('success', `${isDir ? 'Folder' : 'Berkas'} "${relativePath}" berhasil dibuat.`);
        return true;
      } catch (err: any) {
        get().addToast('error', `Gagal membuat ${isDir ? 'folder' : 'berkas'}: ${err}`);
        return false;
      }
    }
    return false;
  },

  renameWorkspaceFile: async (oldRelativePath: string, newRelativePath: string) => {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('rename_workspace_file', { oldRelativePath, newRelativePath });
        await get().fetchWorkspaceFiles();
        get().addToast('success', `Berhasil mengganti nama menjadi "${newRelativePath}".`);
        return true;
      } catch (err: any) {
        get().addToast('error', `Gagal mengganti nama: ${err}`);
        return false;
      }
    }
    return false;
  },

  deleteWorkspaceFile: async (relativePath: string) => {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('delete_workspace_file', { relativePath });
        await get().fetchWorkspaceFiles();
        get().addToast('success', `Berkas "${relativePath}" berhasil dihapus.`);
        return true;
      } catch (err: any) {
        get().addToast('error', `Gagal menghapus berkas: ${err}`);
        return false;
      }
    }
    return false;
  },

  revealInFileManager: async (relativePath?: string) => {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('reveal_in_file_manager', { relativePath: relativePath || null });
      } catch (err: any) {
        get().addToast('error', `Gagal membuka di file manager: ${err}`);
      }
    }
  },

  openFileInSidecar: async (file: FileNode) => {
    if (file.is_dir) return;
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const content = await invoke<string>('read_workspace_file', { relativePath: file.relative_path });

        const ext = file.extension.toLowerCase();
        const langMap: Record<string, string> = {
          rs: 'rust',
          ts: 'typescript',
          tsx: 'tsx',
          js: 'javascript',
          jsx: 'jsx',
          py: 'python',
          json: 'json',
          md: 'markdown',
          html: 'html',
          css: 'css',
          sql: 'sql',
          sh: 'bash',
          yaml: 'yaml',
          yml: 'yaml',
          toml: 'toml',
        };
        const language = langMap[ext] || ext || 'text';

        const artifact: Artifact = {
          id: `file-${file.relative_path.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          title: file.name,
          language,
          content,
          versions: [
            {
              version: 1,
              content,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              author: 'user',
              summary: `Dibuka dari ${file.relative_path}`,
            },
          ],
          currentVersionIndex: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        get().openArtifact(artifact);
      } catch (err: any) {
        get().addToast('error', `Gagal membaca berkas: ${err}`);
      }
    }
  },

  queryCodebase: async (query: string, maxChunks?: number) => {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const results = await invoke<CodeChunkMatch[]>('query_codebase_context', {
          query,
          maxChunks: maxChunks || 4,
        });
        return results || [];
      } catch (err) {
        console.error('Codebase query error:', err);
        return [];
      }
    }
    return [];
  },

  searchWorkspaceText: async (
    query: string,
    caseSensitive?: boolean,
    wholeWord?: boolean,
    maxResults?: number
  ) => {
    if (!query.trim()) return [];
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const results = await invoke<TextSearchMatch[]>('search_workspace_text', {
          query,
          caseSensitive: caseSensitive || false,
          wholeWord: wholeWord || false,
          maxResults: maxResults || 300,
        });
        return results || [];
      } catch (err) {
        console.error('Workspace text search error:', err);
        return [];
      }
    }
    // Web fallback
    const openFiles = get().openEditorFiles;
    const matches: TextSearchMatch[] = [];
    const q = caseSensitive ? query : query.toLowerCase();
    for (const file of openFiles) {
      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineToSearch = caseSensitive ? line : line.toLowerCase();
        let idx = lineToSearch.indexOf(q);
        while (idx !== -1) {
          matches.push({
            relative_path: file.path,
            file_name: file.name,
            line_number: i + 1,
            line_content: line,
            match_start: idx,
            match_end: idx + query.length,
          });
          idx = lineToSearch.indexOf(q, idx + query.length);
        }
      }
    }
    return matches;
  },

  // Studio Code Editor State & Actions
  openEditorFiles: [],
  activeEditorFilePath: null,

  openFileInStudioEditor: async (file: FileNode) => {
    if (file.is_dir) return;

    // Switch Studio Tab to 'editor'
    set({ activeStudioTab: 'editor' });

    const existing = get().openEditorFiles.find((f) => f.path === file.relative_path);
    if (existing) {
      set({ activeEditorFilePath: existing.path });
      return;
    }

    let content = '';
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        content = await invoke<string>('read_workspace_file', { relativePath: file.relative_path });
      } catch (err: any) {
        get().addToast('error', `Gagal membaca berkas '${file.name}': ${err}`);
        return;
      }
    } else {
      content = `// Preview: ${file.relative_path}\n`;
    }

    const newFile: OpenEditorFile = {
      path: file.relative_path,
      name: file.name,
      extension: file.extension,
      content,
      originalContent: content,
      isDirty: false,
    };

    set((s) => ({
      openEditorFiles: [...s.openEditorFiles, newFile],
      activeEditorFilePath: newFile.path,
    }));
  },

  closeEditorFile: (path: string) => {
    const { openEditorFiles, activeEditorFilePath } = get();
    const remaining = openEditorFiles.filter((f) => f.path !== path);

    let nextActive = activeEditorFilePath;
    if (activeEditorFilePath === path) {
      nextActive = remaining.length > 0 ? remaining[remaining.length - 1].path : null;
    }

    set({
      openEditorFiles: remaining,
      activeEditorFilePath: nextActive,
    });
  },

  setActiveEditorFile: (path: string) => {
    set({ activeEditorFilePath: path });
  },

  updateEditorFileContent: (path: string, content: string) => {
    set((s) => ({
      openEditorFiles: s.openEditorFiles.map((f) =>
        f.path === path
          ? {
              ...f,
              content,
              isDirty: content !== f.originalContent,
            }
          : f
      ),
    }));
  },

  saveActiveEditorFile: async () => {
    const { activeEditorFilePath, openEditorFiles, addToast } = get();
    if (!activeEditorFilePath) return false;

    const targetFile = openEditorFiles.find((f) => f.path === activeEditorFilePath);
    if (!targetFile) return false;

    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('write_workspace_file', {
          relativePath: targetFile.path,
          content: targetFile.content,
        });

        set((s) => ({
          openEditorFiles: s.openEditorFiles.map((f) =>
            f.path === targetFile.path
              ? { ...f, originalContent: targetFile.content, isDirty: false }
              : f
          ),
        }));

        addToast('success', `Tersimpan: ${targetFile.name}`);
        return true;
      } catch (err: any) {
        addToast('error', `Gagal menyimpan berkas '${targetFile.name}': ${err}`);
        return false;
      }
    } else {
      set((s) => ({
        openEditorFiles: s.openEditorFiles.map((f) =>
          f.path === targetFile.path
            ? { ...f, originalContent: targetFile.content, isDirty: false }
            : f
        ),
      }));
      addToast('info', `Simulasi web: perubahan '${targetFile.name}' dicatat.`);
      return true;
    }
  },

  // Quick Open File & Global Search Modals
  isQuickOpenModalOpen: false,
  setQuickOpenModalOpen: (open: boolean) => set({ isQuickOpenModalOpen: open }),
  isGlobalSearchModalOpen: false,
  setGlobalSearchModalOpen: (open: boolean) => set({ isGlobalSearchModalOpen: open }),

  // Active Agent Work Locations & Typewriter Animations
  activeAgentWorkFiles: {},
  setActiveAgentWorkFile: (filePath: string, work: ActiveAgentWorkFile | null) => {
    set((s) => {
      const copy = { ...s.activeAgentWorkFiles };
      if (!work) {
        delete copy[filePath];
      } else {
        copy[filePath] = work;
      }
      return { activeAgentWorkFiles: copy };
    });
  },

  pendingTypingAnimations: {},
  registerPendingTypingAnimation: (anim: PendingTypingAnimation) => {
    set((s) => ({
      pendingTypingAnimations: {
        ...s.pendingTypingAnimations,
        [anim.filePath]: anim,
      },
    }));
  },

  consumePendingTypingAnimation: (filePath: string) => {
    const { pendingTypingAnimations } = get();
    const anim = pendingTypingAnimations[filePath] || null;
    if (anim) {
      set((s) => {
        const copy = { ...s.pendingTypingAnimations };
        delete copy[filePath];
        return { pendingTypingAnimations: copy };
      });
    }
    return anim;
  },

  // Terminal Agent Discovery & Multi-Agent Orchestration
  installedCliAgents: [],
  isDetectingCliAgents: false,
  orchestratorConfig: { type: 'api', modelId: 'gemini-2.5-flash' },
  activeTerminalWorkers: [],
  interAgentMessages: [],
  multiTerminalSplit: 'tabs',
  isAgentRosterModalOpen: false,

  // Git Worktrees & Hook Telemetry Initial State
  worktrees: [],
  activeWorktreeId: null,
  hookCoords: null,
  setActiveWorktreeId: (id) => set({ activeWorktreeId: id }),

  // Orca Tiling Studio Initial State
  tilingLayout: null,
  maximizedPaneId: null,
  isTerminalInspectorOpen: true,
  setTilingLayout: (layout) => set({ tilingLayout: layout }),
  setMaximizedPaneId: (paneId) => set({ maximizedPaneId: paneId }),
  setIsTerminalInspectorOpen: (open) => set({ isTerminalInspectorOpen: open }),

  setOrchestratorConfig: (config: OrchestratorSelection) => {
    set({ orchestratorConfig: config });
    if ((window as any).__TAURI_INTERNALS__) {
      const roleStr = config.type === 'terminal' ? (config.agentId || 'claude') : 'api';
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('set_orchestrator_role', { roleOrAgent: roleStr }).catch(() => {});
      });
    }
  },

  setIsAgentRosterModalOpen: (open: boolean) => set({ isAgentRosterModalOpen: open }),

  setMultiTerminalSplit: (split: 'tabs' | 'split-horizontal' | 'split-vertical') =>
    set({ multiTerminalSplit: split }),

  refreshInstalledCliAgents: async () => {
    set({ isDetectingCliAgents: true });
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const agents = await invoke<CliAgentMetadata[]>('detect_installed_cli_agents');
        set({ installedCliAgents: agents });
      } else {
        set({
          installedCliAgents: [
            {
              id: 'claude',
              name: 'Claude Code',
              binary_name: 'claude',
              path: '/home/yudz/.local/bin/claude',
              version: '2.1.311',
              is_installed: true,
              default_args: [],
              custom_env: {},
              supports_mcp: true,
              is_custom: false,
            },
            {
              id: 'agy',
              name: 'Google Antigravity',
              binary_name: 'agy',
              path: '/home/yudz/.local/bin/agy',
              version: '1.4.8',
              is_installed: true,
              default_args: [],
              custom_env: {},
              supports_mcp: true,
              is_custom: false,
            },
            {
              id: 'omp',
              name: 'Oh My Phi (omp)',
              binary_name: 'omp',
              path: '/home/yudz/.local/bin/omp',
              version: '18.9.0',
              is_installed: true,
              default_args: [],
              custom_env: {},
              supports_mcp: true,
              is_custom: false,
            },
            {
              id: 'opencode',
              name: 'OpenCode',
              binary_name: 'opencode',
              path: '/home/yudz/.opencode/bin/opencode',
              version: '1.18.35',
              is_installed: true,
              default_args: [],
              custom_env: {},
              supports_mcp: true,
              is_custom: false,
            },
            {
              id: 'gemini',
              name: 'Gemini CLI',
              binary_name: 'gemini',
              path: '/home/yudz/.nvm/versions/node/v22.23.2/bin/gemini',
              version: '0.63.0',
              is_installed: true,
              default_args: [],
              custom_env: {},
              supports_mcp: true,
              is_custom: false,
            },
          ],
        });
      }
    } catch (err) {
      console.error('Failed to detect CLI agents:', err);
    } finally {
      set({ isDetectingCliAgents: false });
    }
  },

  spawnTerminalWorker: async (agentId: string, _role: string, _taskSpec?: string) => {
    const { ensureTilingInitialized } = get();
    await ensureTilingInitialized();
    const currentLayout = get().tilingLayout;
    const targetPane = getFirstPaneInTilingTree(currentLayout);
    const targetPaneId = targetPane?.id || 'pane-root';

    return await get().spawnAgentInPane(targetPaneId, agentId, undefined, 'tab');
  },


  terminateTerminalWorker: async (workerId: string) => {
    const { activeTerminalWorkers, addToast } = get();
    const worker = activeTerminalWorkers.find((w) => w.worker_id === workerId);
    if (!worker) return;

    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('stop_terminal_worker', {
          workerId,
          tabId: worker.tab_id,
        });
      } catch (err) {
        console.error('Error stopping worker:', err);
      }
    }

    const remainingTabs = get().terminalTabs.filter((t) => t.id !== worker.tab_id);
    const nextTabId =
      get().activeTerminalTabId === worker.tab_id
        ? (remainingTabs[0]?.id || '')
        : get().activeTerminalTabId;

    set((s) => ({
      activeTerminalWorkers: s.activeTerminalWorkers.filter((w) => w.worker_id !== workerId),
      terminalTabs: remainingTabs,
      activeTerminalTabId: nextTabId,
    }));

    addToast('info', `Pekerja '${worker.agent_id}' telah dihentikan.`);
  },

  sendInterAgentMessage: async (recipient: string, content: string, runId?: string) => {
    const { addToast } = get();
    const rId = runId || 'run-default';
    const msg: InterAgentMessage = {
      id: `msg-${Date.now()}`,
      run_id: rId,
      sender: 'orchestrator',
      recipient,
      content,
      timestamp: Date.now(),
    };

    set((s) => ({
      interAgentMessages: [...s.interAgentMessages, msg],
    }));

    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('send_inter_agent_message', {
          runId: rId,
          sender: 'orchestrator',
          recipient,
          content,
        });
      } catch (err) {
        console.error('Error sending inter-agent message:', err);
      }
    }

    addToast('success', `Pesan diteruskan ke agen '${recipient}'.`);
  },

  refreshWorktrees: async () => {
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const list: WorktreeSession[] = await invoke('list_task_worktrees');
        set({ worktrees: list });
      } catch (err) {
        console.error('Gagal mengambil daftar git worktrees:', err);
      }
    }
  },

  createWorktreeForTask: async (taskId: string, taskTitle: string, branchName: string, agentName: string) => {
    const { addToast, refreshWorktrees } = get();
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const wt: WorktreeSession = await invoke('create_task_worktree', {
          taskId,
          taskTitle,
          branchName,
          assignedAgent: agentName,
        });
        await refreshWorktrees();
        set({ activeWorktreeId: wt.id });
        addToast('success', `Git worktree '${wt.branch_name}' berhasil dibuat di ${wt.path}.`);
        return wt;
      } catch (err: any) {
        addToast('error', `Gagal membuat git worktree: ${err}`);
        return null;
      }
    }
    return null;
  },

  removeWorktree: async (worktreePath: string) => {
    const { addToast, refreshWorktrees } = get();
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('remove_task_worktree', {
          worktreePath,
          force: true,
        });
        await refreshWorktrees();
        addToast('info', 'Git worktree berhasil dihapus dan dibersihkan.');
      } catch (err: any) {
        addToast('error', `Gagal menghapus git worktree: ${err}`);
      }
    }
  },

  mergeWorktree: async (branchName: string) => {
    const { addToast, refreshWorktrees } = get();
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('merge_task_worktree', {
          branchName,
        });
        await refreshWorktrees();
        addToast('success', `Berhasil menggabungkan cabang '${branchName}' ke repositori utama.`);
        return true;
      } catch (err: any) {
        addToast('error', `Gagal merge cabang '${branchName}': ${err}`);
        return false;
      }
    }
    return false;
  },

  openTerminalForWorktree: async (worktree: WorktreeSession) => {
    const { addToast, setActiveStudioTab } = get();
    const tabId = `tab-wt-${Date.now()}`;
    const newTab: TerminalTab = {
      id: tabId,
      title: `WT: ${worktree.task_id} (${worktree.assigned_agent})`,
      cwd: worktree.path,
      logs: [],
    };

    set((s) => ({
      terminalTabs: [...s.terminalTabs, newTab],
      activeTerminalTabId: tabId,
    }));

    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('init_terminal_pty', {
          tabId,
          cols: 80,
          rows: 24,
          cwd: worktree.path,
        });
        addToast('success', `Terminal dibuka pada direktori worktree '${worktree.task_id}'.`);
      } catch (err: any) {
        addToast('error', `Gagal membuka terminal worktree: ${err}`);
      }
    }

    setActiveStudioTab('terminals');
    return tabId;
  },

  initHookTelemetryListener: () => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    const { addToast } = get();

    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('get_hook_server_coords')
        .then((coords: any) => {
          set({ hookCoords: coords });
        })
        .catch((err) => console.error('Failed to get hook server coords:', err));
    });

    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<AgentTelemetryPayload>('agent-telemetry-event', (event) => {
        const payload = event.payload;
        if (!payload) return;

        // Perbarui status pekerja terminal jika pane_key cocok
        if (payload.pane_key) {
          const tabId = payload.pane_key;
          let newStatus: 'idle' | 'working' | 'waiting_approval' | 'done' | 'error' | null = null;
          if (payload.hook_event_name === 'tool.call') {
            newStatus = 'working';
            const toolName = payload.payload?.tool || payload.payload?.tool_name || 'Tool';
            addToast('info', `[${payload.agent_name}] Menjalankan alat: ${toolName}`);
          } else if (payload.hook_event_name === 'PermissionRequest') {
            newStatus = 'waiting_approval';
            addToast('warning', `[${payload.agent_name}] Meminta izin eksekusi perintah.`);
          } else if (payload.hook_event_name === 'done' || payload.hook_event_name === 'Stop') {
            newStatus = 'done';
            addToast('success', `[${payload.agent_name}] Tugas selesai.`);
          }

          if (newStatus) {
            set((s) => ({
              activeTerminalWorkers: s.activeTerminalWorkers.map((w) =>
                w.tab_id === tabId ? { ...w, status: newStatus! } : w
              ),
            }));
          }
        }
      });
    });
  },

  // Orca-Style Multi-Pane Tiling Studio Actions
  ensureTilingInitialized: async () => {
    const { tilingLayout, terminalTabs } = get();
    if (tilingLayout) return;

    let initialTabId = terminalTabs[0]?.id;
    if (!initialTabId) {
      initialTabId = `tab-terminal-${Date.now()}`;
      const defaultTab: TerminalTab = {
        id: initialTabId,
        title: 'Terminal 1',
        cwd: get().workspaceProjectRoot || '',
        logs: [],
      };
      set({ terminalTabs: [defaultTab], activeTerminalTabId: initialTabId });
    }

    const rootPane: TilingNode = {
      type: 'pane',
      data: {
        id: 'pane-root',
        tabs: [initialTabId],
        activeTabId: initialTabId,
      },
    };
    set({ tilingLayout: rootPane });
  },

  addTabToPane: async (paneId: string, title?: string, cwd?: string) => {
    const { tilingLayout } = get();
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newTab: TerminalTab = {
      id: tabId,
      title: title || `Terminal ${get().terminalTabs.length + 1}`,
      cwd: cwd || get().workspaceProjectRoot || '',
      logs: [],
    };

    set((s) => ({
      terminalTabs: [...s.terminalTabs, newTab],
      activeTerminalTabId: tabId,
    }));

    if (tilingLayout) {
      const updated = updatePaneDataInTilingTree(tilingLayout, paneId, (p) => ({
        ...p,
        tabs: [...p.tabs, tabId],
        activeTabId: tabId,
      }));
      set({ tilingLayout: updated });
    }

    return tabId;
  },

  consumeInitialCommand: (tabId: string) => {
    set((s) => ({
      terminalTabs: s.terminalTabs.map((t) =>
        t.id === tabId ? { ...t, initialCommand: undefined } : t
      ),
    }));
  },

  spawnAgentInPane: async (
    paneId: string,
    agentId: string,
    customCwd?: string,
    placement: 'tab' | 'split-right' | 'split-down' = 'tab'
  ) => {
    const { installedCliAgents, addToast, splitPane, ensureTilingInitialized } = get();

    await ensureTilingInitialized();
    let currentLayout = get().tilingLayout;

    // Pastikan target pane valid di dalam tilingLayout
    let targetPane = findPaneInTilingTree(currentLayout, paneId);
    if (!targetPane) {
      targetPane = getFirstPaneInTilingTree(currentLayout);
    }
    const resolvedPaneId = targetPane?.id || 'pane-root';

    // Cari metadata agen dengan pencocokan id atau binary_name yang fleksibel
    const agent = installedCliAgents.find(
      (a) =>
        a.id.toLowerCase() === agentId.toLowerCase() ||
        a.binary_name.toLowerCase() === agentId.toLowerCase() ||
        (agentId.toLowerCase() === 'antigravity' && a.id.toLowerCase() === 'agy') ||
        (agentId.toLowerCase() === 'agy' && a.id.toLowerCase() === 'antigravity') ||
        (agentId.toLowerCase() === 'oh-my-phi' && a.id.toLowerCase() === 'omp') ||
        (agentId.toLowerCase() === 'omp' && a.id.toLowerCase() === 'oh-my-phi')
    );

    const agentName =
      agent?.name ||
      (agentId === 'agy' || agentId === 'antigravity'
        ? 'Google Antigravity'
        : agentId === 'omp' || agentId === 'oh-my-phi'
        ? 'Oh My Phi (omp)'
        : agentId);

    const tabId = `tab-agent-${Date.now()}`;
    const workerId = `worker-${Date.now()}`;

    // Perintah eksekusi ringkas (nama biner murni seperti agy, omp, claude, opencode, gemini tanpa path folder)
    let launchCmd = agent?.binary_name || agentId;
    if (launchCmd.toLowerCase() === 'antigravity') launchCmd = 'agy';
    if (launchCmd.toLowerCase() === 'oh-my-phi') launchCmd = 'omp';

    const newTab: TerminalTab = {
      id: tabId,
      title: agentName,
      cwd: customCwd || get().workspaceProjectRoot || '',
      logs: [],
      initialCommand: `${launchCmd}\r\n`,
      agentId: agent?.id || agentId,
    };

    const workerSession: TerminalWorkerSession = {
      worker_id: workerId,
      agent_id: agent?.id || agentId,
      tab_id: tabId,
      role: 'Agent Worker',
      task_spec: '',
      status: 'working',
      created_at: Date.now(),
    };

    set((s) => ({
      terminalTabs: [...s.terminalTabs, newTab],
      activeTerminalTabId: tabId,
      activeTerminalWorkers: [...s.activeTerminalWorkers, workerSession],
    }));

    if (placement === 'split-right') {
      await splitPane(resolvedPaneId, 'horizontal', tabId);
    } else if (placement === 'split-down') {
      await splitPane(resolvedPaneId, 'vertical', tabId);
    } else {
      const activeLayout = get().tilingLayout || currentLayout!;
      const updated = updatePaneDataInTilingTree(activeLayout, resolvedPaneId, (p) => ({
        ...p,
        tabs: [...p.tabs, tabId],
        activeTabId: tabId,
      }));
      set({ tilingLayout: updated });
    }

    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('register_terminal_worker', {
          workerId,
          agentId: agent?.id || agentId,
          tabId,
          role: 'Agent Worker',
          taskSpec: '',
        });
      } catch (err: any) {
        console.warn('Gagal registrasi terminal worker:', err);
      }
    }

    addToast('success', `Agen '${agentName}' dijalankan di terminal.`);
    return workerId;
  },

  draggingItem: null,
  dragPreviewPos: null,
  activeDropTarget: null,
  setDraggingItem: (item: DraggingItem | null) =>
    set({ draggingItem: item, draggingPaneId: item?.type === 'pane' ? item.paneId : null }),
  setDragPreviewPos: (pos: { x: number; y: number } | null) => set({ dragPreviewPos: pos }),
  setActiveDropTarget: (target: ActiveDropTarget | null) => set({ activeDropTarget: target }),
  draggingPaneId: null,
  setDraggingPaneId: (paneId: string | null) =>
    set({
      draggingPaneId: paneId,
      draggingItem: paneId ? { type: 'pane', paneId, title: 'Panel' } : null,
    }),

  splitPaneWithTab: (
    sourcePaneId: string,
    targetPaneId: string,
    tabId: string,
    direction: 'left' | 'right' | 'top' | 'bottom'
  ) => {
    const { tilingLayout, addToast } = get();
    if (!tilingLayout) return;

    const res = splitPaneWithTabInTilingTree(
      tilingLayout,
      sourcePaneId,
      targetPaneId,
      tabId,
      direction
    );
    if (res) {
      set({
        tilingLayout: res.updatedTree,
        draggingItem: null,
        dragPreviewPos: null,
        activeDropTarget: null,
        draggingPaneId: null,
        activeTerminalTabId: tabId,
      });
      addToast('info', 'Panel terminal berhasil di-split.');
    }
  },

  moveTabToPane: (
    sourcePaneId: string,
    targetPaneId: string,
    tabId: string,
    targetIndex?: number
  ) => {
    const { tilingLayout, addToast } = get();
    if (!tilingLayout) return;

    const updated = moveTabToPaneInTilingTree(
      tilingLayout,
      sourcePaneId,
      targetPaneId,
      tabId,
      targetIndex
    );
    set({
      tilingLayout: updated,
      draggingItem: null,
      dragPreviewPos: null,
      activeDropTarget: null,
      draggingPaneId: null,
      activeTerminalTabId: tabId,
    });
    addToast('info', 'Tab dipindahkan ke panel target.');
  },

  moveTabInPane: (paneId: string, fromIndex: number, toIndex: number) => {
    const { tilingLayout } = get();
    if (!tilingLayout) return;

    const updated = moveTabInPaneInTilingTree(tilingLayout, paneId, fromIndex, toIndex);
    set({
      tilingLayout: updated,
      draggingItem: null,
      dragPreviewPos: null,
      activeDropTarget: null,
      draggingPaneId: null,
    });
  },

  reparentPane: (
    sourcePaneId: string,
    targetPaneId: string,
    position: 'left' | 'right' | 'top' | 'bottom' | 'tab'
  ) => {
    const { tilingLayout, addToast } = get();
    if (!tilingLayout || sourcePaneId === targetPaneId) return;

    const updated = reparentPaneInTilingTree(tilingLayout, sourcePaneId, targetPaneId, position);
    set({
      tilingLayout: updated,
      draggingPaneId: null,
      draggingItem: null,
      dragPreviewPos: null,
      activeDropTarget: null,
    });
    addToast('info', 'Tata letak terminal diperbarui.');
  },

  splitPane: async (paneId: string, direction: SplitDirection, newTabId?: string) => {
    const { tilingLayout } = get();
    if (!tilingLayout) return '';

    const targetPane = findPaneInTilingTree(tilingLayout, paneId);
    if (!targetPane) return '';

    const newPaneId = `pane-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    let assignedTabId = newTabId;

    if (!assignedTabId) {
      assignedTabId = `tab-${Date.now()}`;
      const newTab: TerminalTab = {
        id: assignedTabId,
        title: `Terminal ${get().terminalTabs.length + 1}`,
        cwd: get().workspaceProjectRoot || '',
        logs: [],
      };
      set((s) => ({
        terminalTabs: [...s.terminalTabs, newTab],
        activeTerminalTabId: assignedTabId,
      }));
    }

    const newPaneNode: TilingNode = {
      type: 'pane',
      data: {
        id: newPaneId,
        tabs: [assignedTabId],
        activeTabId: assignedTabId,
      },
    };

    const currentPaneNode: TilingNode = {
      type: 'pane',
      data: { ...targetPane },
    };

    const splitContainer: TilingNode = {
      type: 'split',
      data: {
        id: `split-${Date.now()}`,
        direction,
        ratio: 0.5,
        first: currentPaneNode,
        second: newPaneNode,
      },
    };

    const updatedTree = replacePaneInTilingTree(tilingLayout, paneId, splitContainer);
    set({ tilingLayout: updatedTree });
    return newPaneId;
  },

  closePane: (paneId: string) => {
    const { tilingLayout, maximizedPaneId, ensureTilingInitialized } = get();
    if (!tilingLayout) return;

    if (maximizedPaneId === paneId) {
      set({ maximizedPaneId: null });
    }

    const updated = removePaneFromTilingTree(tilingLayout, paneId);
    if (!updated) {
      // Jika semua panel ditutup, reset ke single pane
      set({ tilingLayout: null });
      ensureTilingInitialized();
    } else {
      set({ tilingLayout: updated });
    }
  },

  updateSplitRatio: (containerId: string, ratio: number) => {
    const { tilingLayout } = get();
    if (!tilingLayout) return;
    const updated = updateRatioInTilingTree(tilingLayout, containerId, ratio);
    set({ tilingLayout: updated });
  },

  toggleMaximizePane: (paneId: string) => {
    set((s) => ({
      maximizedPaneId: s.maximizedPaneId === paneId ? null : paneId,
    }));
  },

  setActiveTabInPane: (paneId: string, tabId: string) => {
    const { tilingLayout } = get();
    set({ activeTerminalTabId: tabId });
    if (!tilingLayout) return;
    const updated = updatePaneDataInTilingTree(tilingLayout, paneId, (p) => ({
      ...p,
      activeTabId: tabId,
    }));
    set({ tilingLayout: updated });
  },

  closeTabInPane: (paneId: string, tabId: string) => {
    const { tilingLayout, terminalTabs, closePane } = get();
    const remainingTabs = terminalTabs.filter((t) => t.id !== tabId);
    set({ terminalTabs: remainingTabs });

    if (!tilingLayout) return;
    const target = findPaneInTilingTree(tilingLayout, paneId);
    if (!target) return;

    const remainingPaneTabs = target.tabs.filter((id) => id !== tabId);
    if (remainingPaneTabs.length === 0) {
      closePane(paneId);
    } else {
      const nextActive = remainingPaneTabs[0];
      const updated = updatePaneDataInTilingTree(tilingLayout, paneId, (p) => ({
        ...p,
        tabs: remainingPaneTabs,
        activeTabId: nextActive,
      }));
      set({ tilingLayout: updated, activeTerminalTabId: nextActive });
    }
  },

  applyPresetLayout: async (preset: 'single' | 'split-horizontal' | 'split-vertical' | 'grid-2x2') => {
    const { addToast } = get();
    const ensureTabs = async (count: number) => {
      const currentTabs = [...get().terminalTabs];
      while (currentTabs.length < count) {
        const id = `tab-${Date.now()}-${currentTabs.length}`;
        const newTab: TerminalTab = {
          id,
          title: `Terminal ${currentTabs.length + 1}`,
          cwd: '',
          logs: [],
        };
        currentTabs.push(newTab);
        if ((window as any).__TAURI_INTERNALS__) {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('init_terminal_pty', { tabId: id, cols: 80, rows: 24 });
          } catch (e) {
            console.error(e);
          }
        }
      }
      set({ terminalTabs: currentTabs });
      return currentTabs;
    };

    if (preset === 'single') {
      const tabs = await ensureTabs(1);
      const root: TilingNode = {
        type: 'pane',
        data: { id: 'pane-single', tabs: [tabs[0].id], activeTabId: tabs[0].id },
      };
      set({ tilingLayout: root, maximizedPaneId: null });
      addToast('info', 'Tata letak diatur ke Terminal Tunggal.');
    } else if (preset === 'split-horizontal') {
      const tabs = await ensureTabs(2);
      const root: TilingNode = {
        type: 'split',
        data: {
          id: `split-h-${Date.now()}`,
          direction: 'horizontal',
          ratio: 0.5,
          first: { type: 'pane', data: { id: 'pane-left', tabs: [tabs[0].id], activeTabId: tabs[0].id } },
          second: { type: 'pane', data: { id: 'pane-right', tabs: [tabs[1].id], activeTabId: tabs[1].id } },
        },
      };
      set({ tilingLayout: root, maximizedPaneId: null });
      addToast('info', 'Tata letak diatur ke Split 2 Kolom (Horizontal).');
    } else if (preset === 'split-vertical') {
      const tabs = await ensureTabs(2);
      const root: TilingNode = {
        type: 'split',
        data: {
          id: `split-v-${Date.now()}`,
          direction: 'vertical',
          ratio: 0.5,
          first: { type: 'pane', data: { id: 'pane-top', tabs: [tabs[0].id], activeTabId: tabs[0].id } },
          second: { type: 'pane', data: { id: 'pane-bottom', tabs: [tabs[1].id], activeTabId: tabs[1].id } },
        },
      };
      set({ tilingLayout: root, maximizedPaneId: null });
      addToast('info', 'Tata letak diatur ke Split 2 Baris (Vertikal).');
    } else if (preset === 'grid-2x2') {
      const tabs = await ensureTabs(4);
      const root: TilingNode = {
        type: 'split',
        data: {
          id: `split-v-root-${Date.now()}`,
          direction: 'vertical',
          ratio: 0.5,
          first: {
            type: 'split',
            data: {
              id: `split-h-top-${Date.now()}`,
              direction: 'horizontal',
              ratio: 0.5,
              first: { type: 'pane', data: { id: 'pane-top-left', tabs: [tabs[0].id], activeTabId: tabs[0].id } },
              second: { type: 'pane', data: { id: 'pane-top-right', tabs: [tabs[1].id], activeTabId: tabs[1].id } },
            },
          },
          second: {
            type: 'split',
            data: {
              id: `split-h-bottom-${Date.now()}`,
              direction: 'horizontal',
              ratio: 0.5,
              first: { type: 'pane', data: { id: 'pane-bottom-left', tabs: [tabs[2].id], activeTabId: tabs[2].id } },
              second: { type: 'pane', data: { id: 'pane-bottom-right', tabs: [tabs[3].id], activeTabId: tabs[3].id } },
            },
          },
        },
      };
      set({ tilingLayout: root, maximizedPaneId: null });
      addToast('success', 'Tata letak diatur ke Grid 2x2 (4 Terminal Aktif).');
    }
  },
}));

// Tiling Tree Pure Helper Functions
export function findPaneInTilingTree(node: TilingNode | null, paneId: string): TerminalPaneNode | null {
  if (!node) return null;
  if (node.type === 'pane') {
    return node.data.id === paneId ? node.data : null;
  }
  return findPaneInTilingTree(node.data.first, paneId) || findPaneInTilingTree(node.data.second, paneId);
}

export function getFirstPaneInTilingTree(node: TilingNode | null): TerminalPaneNode | null {
  if (!node) return null;
  if (node.type === 'pane') return node.data;
  return getFirstPaneInTilingTree(node.data.first) || getFirstPaneInTilingTree(node.data.second);
}


function replacePaneInTilingTree(
  node: TilingNode,
  targetPaneId: string,
  replacement: TilingNode
): TilingNode {
  if (node.type === 'pane') {
    return node.data.id === targetPaneId ? replacement : node;
  }
  return {
    type: 'split',
    data: {
      ...node.data,
      first: replacePaneInTilingTree(node.data.first, targetPaneId, replacement),
      second: replacePaneInTilingTree(node.data.second, targetPaneId, replacement),
    },
  };
}

function removePaneFromTilingTree(node: TilingNode, targetPaneId: string): TilingNode | null {
  if (node.type === 'pane') {
    return node.data.id === targetPaneId ? null : node;
  }

  const newFirst = removePaneFromTilingTree(node.data.first, targetPaneId);
  const newSecond = removePaneFromTilingTree(node.data.second, targetPaneId);

  if (!newFirst && !newSecond) return null;
  if (!newFirst) return newSecond;
  if (!newSecond) return newFirst;

  return {
    type: 'split',
    data: {
      ...node.data,
      first: newFirst,
      second: newSecond,
    },
  };
}

function updateRatioInTilingTree(node: TilingNode, containerId: string, ratio: number): TilingNode {
  if (node.type === 'pane') return node;
  if (node.data.id === containerId) {
    return {
      type: 'split',
      data: {
        ...node.data,
        ratio: Math.min(Math.max(ratio, 0.1), 0.9),
      },
    };
  }
  return {
    type: 'split',
    data: {
      ...node.data,
      first: updateRatioInTilingTree(node.data.first, containerId, ratio),
      second: updateRatioInTilingTree(node.data.second, containerId, ratio),
    },
  };
}

function updatePaneDataInTilingTree(
  node: TilingNode,
  paneId: string,
  updater: (pane: TerminalPaneNode) => TerminalPaneNode
): TilingNode {
  if (node.type === 'pane') {
    return node.data.id === paneId
      ? { type: 'pane', data: updater(node.data) }
      : node;
  }
  return {
    type: 'split',
    data: {
      ...node.data,
      first: updatePaneDataInTilingTree(node.data.first, paneId, updater),
      second: updatePaneDataInTilingTree(node.data.second, paneId, updater),
    },
  };
}

export function countPanesInTilingTree(node: TilingNode | null): number {
  if (!node) return 0;
  if (node.type === 'pane') return 1;
  return countPanesInTilingTree(node.data.first) + countPanesInTilingTree(node.data.second);
}

export function reparentPaneInTilingTree(
  root: TilingNode,
  sourcePaneId: string,
  targetPaneId: string,
  position: 'left' | 'right' | 'top' | 'bottom' | 'tab'
): TilingNode {
  if (sourcePaneId === targetPaneId) return root;

  const sourcePane = findPaneInTilingTree(root, sourcePaneId);
  if (!sourcePane) return root;

  if (position === 'tab') {
    const treeWithoutSource = removePaneFromTilingTree(root, sourcePaneId);
    if (!treeWithoutSource) return root;

    return updatePaneDataInTilingTree(treeWithoutSource, targetPaneId, (target) => ({
      ...target,
      tabs: Array.from(new Set([...target.tabs, ...sourcePane.tabs])),
      activeTabId: sourcePane.activeTabId || target.activeTabId,
    }));
  }

  const treeWithoutSource = removePaneFromTilingTree(root, sourcePaneId);
  if (!treeWithoutSource) return root;

  const targetPane = findPaneInTilingTree(treeWithoutSource, targetPaneId);
  if (!targetPane) return root;

  const direction: SplitDirection =
    position === 'left' || position === 'right' ? 'horizontal' : 'vertical';

  const sourceNode: TilingNode = {
    type: 'pane',
    data: { ...sourcePane },
  };

  const targetNode: TilingNode = {
    type: 'pane',
    data: { ...targetPane },
  };

  const firstNode = position === 'left' || position === 'top' ? sourceNode : targetNode;
  const secondNode = position === 'left' || position === 'top' ? targetNode : sourceNode;

  const newSplitContainer: TilingNode = {
    type: 'split',
    data: {
      id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      direction,
      ratio: 0.5,
      first: firstNode,
      second: secondNode,
    },
  };

  return replacePaneInTilingTree(treeWithoutSource, targetPaneId, newSplitContainer);
}

export function splitPaneWithTabInTilingTree(
  root: TilingNode,
  sourcePaneId: string,
  targetPaneId: string,
  tabId: string,
  direction: 'left' | 'right' | 'top' | 'bottom'
): { updatedTree: TilingNode; newPaneId: string } | null {
  const sourcePane = findPaneInTilingTree(root, sourcePaneId);
  if (!sourcePane || !sourcePane.tabs.includes(tabId)) return null;

  // Jika drag tab dari pane ke dirinya sendiri tapi tab cuma 1, tidak bisa split
  if (sourcePaneId === targetPaneId && sourcePane.tabs.length <= 1) return null;

  const remainingTabs = sourcePane.tabs.filter((id) => id !== tabId);
  let treeWithoutSourceTab: TilingNode | null;

  if (remainingTabs.length === 0) {
    // Sumber menjadi kosong, hapus pane sumber dari tree
    treeWithoutSourceTab = removePaneFromTilingTree(root, sourcePaneId);
  } else {
    // Masih ada tab tersisa di sumber, perbarui pane sumber
    const nextActive = sourcePane.activeTabId === tabId ? remainingTabs[0] : sourcePane.activeTabId;
    treeWithoutSourceTab = updatePaneDataInTilingTree(root, sourcePaneId, (p) => ({
      ...p,
      tabs: remainingTabs,
      activeTabId: nextActive,
    }));
  }

  if (!treeWithoutSourceTab) return null;

  const targetPane = findPaneInTilingTree(treeWithoutSourceTab, targetPaneId);
  if (!targetPane) return null;

  const newPaneId = `pane-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newPane: TerminalPaneNode = {
    id: newPaneId,
    tabs: [tabId],
    activeTabId: tabId,
  };

  const splitDir: SplitDirection =
    direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical';

  const newNode: TilingNode = {
    type: 'pane',
    data: newPane,
  };

  const targetNode: TilingNode = {
    type: 'pane',
    data: { ...targetPane },
  };

  const firstNode = direction === 'left' || direction === 'top' ? newNode : targetNode;
  const secondNode = direction === 'left' || direction === 'top' ? targetNode : newNode;

  const newSplitContainer: TilingNode = {
    type: 'split',
    data: {
      id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      direction: splitDir,
      ratio: 0.5,
      first: firstNode,
      second: secondNode,
    },
  };

  const updatedTree = replacePaneInTilingTree(treeWithoutSourceTab, targetPaneId, newSplitContainer);
  return { updatedTree, newPaneId };
}

export function moveTabToPaneInTilingTree(
  root: TilingNode,
  sourcePaneId: string,
  targetPaneId: string,
  tabId: string,
  targetIndex?: number
): TilingNode {
  if (sourcePaneId === targetPaneId) {
    return root;
  }

  const sourcePane = findPaneInTilingTree(root, sourcePaneId);
  if (!sourcePane || !sourcePane.tabs.includes(tabId)) return root;

  const remaining = sourcePane.tabs.filter((id) => id !== tabId);
  let treeAfterSource: TilingNode | null;

  if (remaining.length === 0) {
    treeAfterSource = removePaneFromTilingTree(root, sourcePaneId);
  } else {
    const nextActive = sourcePane.activeTabId === tabId ? remaining[0] : sourcePane.activeTabId;
    treeAfterSource = updatePaneDataInTilingTree(root, sourcePaneId, (p) => ({
      ...p,
      tabs: remaining,
      activeTabId: nextActive,
    }));
  }

  if (!treeAfterSource) return root;

  return updatePaneDataInTilingTree(treeAfterSource, targetPaneId, (target) => {
    const newTabs = [...target.tabs];
    if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= newTabs.length) {
      newTabs.splice(targetIndex, 0, tabId);
    } else {
      newTabs.push(tabId);
    }
    return {
      ...target,
      tabs: newTabs,
      activeTabId: tabId,
    };
  });
}

export function moveTabInPaneInTilingTree(
  root: TilingNode,
  paneId: string,
  fromIndex: number,
  toIndex: number
): TilingNode {
  return updatePaneDataInTilingTree(root, paneId, (pane) => {
    if (
      fromIndex < 0 ||
      fromIndex >= pane.tabs.length ||
      toIndex < 0 ||
      toIndex >= pane.tabs.length
    ) {
      return pane;
    }
    const newTabs = [...pane.tabs];
    const [moved] = newTabs.splice(fromIndex, 1);
    newTabs.splice(toIndex, 0, moved);
    return { ...pane, tabs: newTabs };
  });
}

