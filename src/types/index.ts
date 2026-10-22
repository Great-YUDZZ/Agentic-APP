export type AppMode = 'chatbot' | 'agent' | 'build';
export type StudioTab = 'discussion' | 'hierarchy' | 'kanban' | 'diff' | 'git';

export interface ApiKeyRecord {
  provider: string; // 'custom', 'custom_<id>', 'gemini', 'openai', 'claude', 'deepseek', 'ollama'
  name?: string;     // Label nama ramah pengguna (misal: "Local Proxy", "OpenRouter Personal")
  api_key: string;
  base_url?: string;
  is_active: boolean;
  updated_at: string;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  endpoint_id?: string;
  endpoint_name?: string;
  context_length?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  model: string;
  provider: string;
  mode?: AppMode;
  parent_session_id?: string;
  forked_from_message_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SessionTelemetry {
  inputTokens: number;
  outputTokens: number;
  totalSessionTokens: number;
  contextLimit: number;
  usagePercent: number;
  ttftMs: number | null;
  totalLatencyMs: number | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  token_count?: number;
  created_at: string;
}

export interface SubAgentState {
  id: string;
  name: string;
  role: string;
  status: 'Idle' | 'Thinking' | 'ExecutingTool' | 'WaitingClearance' | 'Completed' | 'Failed' | 'Terminated';
  current_step: string;
  progress: number;
  parent_id?: string;
}

export interface KanbanTask {
  id: string;
  title: string;
  status: 'backlog' | 'in_progress' | 'in_review' | 'done';
  assigned_agent: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
}

export interface AgentLog {
  id: string;
  agent_name: string;
  level: 'INFO' | 'EXEC' | 'WARN' | 'FAIL';
  message: string;
  timestamp: string;
}

export interface ToolCallRequest {
  id: string;
  tool_name: string;
  parameters: Record<string, unknown>;
  requires_clearance: boolean;
  risk_level: 'Low' | 'Medium' | 'High';
}

export interface DiffFile {
  filename: string;
  oldContent: string;
  newContent: string;
  additions: number;
  deletions: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

export interface CustomAgent {
  id: string;
  name: string;
  role: string;
  task_description: string;
  skills: string[];
  system_instructions?: string;
  avatar_color: string;
  model?: string;
  created_at: string;
}

export interface ExecutionStep {
  id?: string;
  name?: string;
  tool?: string;
  status: 'running' | 'pending' | 'success' | 'failed';
  duration?: string;
  output?: string;
  params?: Record<string, any>;
  timestamp?: string;
}

export interface DiscussionMessage {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_role: string;
  avatar_color: string;
  content: string;
  step_type?: 'proposal' | 'critique' | 'implementation' | 'verification' | 'summary' | 'operator_directive';
  timestamp: string;
  tool_steps?: ExecutionStep[];
}

export interface DraftPlanTask {
  id: string;
  title: string;
  role_needed: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface RecommendedSquadAgent {
  name: string;
  role: string;
  task_description: string;
  skills: string[];
  avatar_color: string;
}

export interface BuildDiscussionSession {
  id: string;
  project_goal: string;
  selected_agent_ids: string[];
  status: 'idle' | 'running' | 'paused' | 'completed';
  current_turn_index: number;
  messages: DiscussionMessage[];
  buildSubMode: 'plan' | 'build';
  planningMessages: DiscussionMessage[];
  draftPlanTasks?: DraftPlanTask[];
  recommendedSquad?: RecommendedSquadAgent[];
}

export interface TerminalLog {
  id: string;
  type: 'stdin' | 'stdout' | 'stderr' | 'system';
  content: string;
  timestamp: string;
}

export interface TerminalTab {
  id: string;
  title: string;
  cwd: string;
  logs: TerminalLog[];
}

export interface InstalledSkill {
  id: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  location: 'project' | 'global';
  path: string;
  content: string;
  installed_at: string;
}

export interface DiscoveredSkill {
  name: string;
  description: string;
  path: string;
  has_skill_file: boolean;
  content_preview: string;
  selected?: boolean;
  custom_name?: string;
}

export interface CodeReviewItem {
  id: string;
  filename: string;
  language: string;
  content: string;
  originalContent?: string;
  agentName: string;
  agentRole: string;
  avatarColor: string;
  timestamp: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
  isImage: boolean;
}


export interface PlanApprovalRequest {
  id: string;
  title: string;
  planContent: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface AppSettings {
  // General
  queuedMessages: 'queue' | 'immediate';
  permissionPreset: 'turbo' | 'standard' | 'strict';
  planReviewPolicy: 'always_ask' | 'never_ask';
  browserJsPolicy: 'disable' | 'always_ask' | 'always_proceed';
  externalDirectoryAccess: 'always_ask' | 'always_allow' | 'workspace_only';
  networkRules: { whitelist: string[]; blacklist: string[] };
  actuationRules: { whitelist: string[]; blacklist: string[] };

  // Voice Input (Offline Whisper)
  voiceInputLanguage?: 'id' | 'en' | 'auto';

  // Application
  preventSleep: boolean;
  notifyWhenUnfocused: boolean;

  // Appearance
  theme: 'system' | 'light' | 'dark';
  contrast: 'default' | 'strong';
  darkPreset: 'default' | 'charcoal' | 'oled';
  bgColor: string;
  fgColor: string;
  accentColor: string;
  verboseAgentChat: boolean;
  conversationWidth: 'narrow' | 'default' | 'wide';
  trashRetentionDays: number;
}

export interface DeleteRequest {
  request_id: string;
  agent_id: string;
  note_title: string;
  reason: string;
  requested_at: number;
  note_content_preview: string;
}

export interface TrashItem {
  file_name: string;
  original_title: string;
  deleted_at: number;
  size_bytes: number;
}

export interface VaultAuditEntry {
  id: string;
  timestamp: number;
  agent_id: string;
  action: string;
  note_title: string;
  previous_content?: string;
  diff_summary?: string;
}

export interface GraphNodeItem {
  id: string;
  title: string;
  tags: string[];
  backlink_count: number;
  link_count: number;
  word_count: number;
}

export interface GraphEdgeItem {
  source: string;
  target: string;
}

export interface GraphSnapshot {
  nodes: GraphNodeItem[];
  edges: GraphEdgeItem[];
}

export interface ScoredSearchResult {
  title: string;
  path: string;
  snippet: string;
  score: number;
  match_type: string;
  tags: string[];
}

export interface McpServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  is_active: boolean;
}

export interface McpToolInfo {
  server_id: string;
  server_name: string;
  original_name: string;
  namespaced_name: string;
  description: string;
  input_schema: any;
}

export interface McpServerStatus {
  id: string;
  name: string;
  is_connected: boolean;
  tools_count: number;
  error_message?: string;
}

export interface GitFileItem {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  is_staged: boolean;
}

export interface GitStatusResponse {
  is_git_repo: boolean;
  current_branch: string;
  upstream_branch?: string | null;
  ahead: number;
  behind: number;
  staged_files: GitFileItem[];
  unstaged_files: GitFileItem[];
  untracked_files: GitFileItem[];
}

