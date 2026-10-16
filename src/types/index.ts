export type AppMode = 'chatbot' | 'agent' | 'build';
export type StudioTab = 'discussion' | 'hierarchy' | 'kanban' | 'diff';

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
  created_at: string;
  updated_at: string;
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

export interface DiscussionMessage {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_role: string;
  avatar_color: string;
  content: string;
  step_type?: 'proposal' | 'critique' | 'implementation' | 'verification' | 'summary' | 'operator_directive';
  timestamp: string;
}

export interface BuildDiscussionSession {
  id: string;
  project_goal: string;
  selected_agent_ids: string[];
  status: 'idle' | 'running' | 'paused' | 'completed';
  current_turn_index: number;
  messages: DiscussionMessage[];
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


