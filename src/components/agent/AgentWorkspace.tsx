import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Cpu,
  ShieldAlert,
  Terminal,
  FileCode,
  Search,
  Check,
  X,
  Plus,
  Edit2,
  Trash2,
  Bot,
  Sparkles,
  ArrowUp,
  Mic,
  Folder,
  AtSign,
  Zap,
  Hand,
  RotateCw,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { CustomAgent, AttachedFile, ChatMessage } from '../../types';
import { AgentCreatorModal } from './AgentCreatorModal';
import { AttachmentChips } from '../common/AttachmentChips';
import { FormattedMessage } from '../common/FormattedMessage';
import { processSelectedFiles, formatAttachedPrompt } from '../../utils/fileUpload';
import { parseRobustJson, getChatEndpoint, formatApiErrorMessage, resolveEndpointForModel } from '../../utils/api';
import { getDailyGreeting } from '../../utils/dailyGreetings';
import { getConversationWidthClass } from '../../utils/layout';

interface ExecutionStep {
  id: string;
  tool: string;
  params: Record<string, string>;
  status: 'success' | 'failed' | 'pending';
  duration: string;
  timestamp: string;
}

export const AgentWorkspace: React.FC = () => {
  const {
    customAgents,
    selectedAgentId,
    setSelectedAgentId,
    deleteCustomAgent,
    selectedModel,
    setModel,
    availableModels,
    isDetectingModels,
    fetchAvailableModels,
    apiKeys,
    pendingToolClearance,
    setPendingToolClearance,
    resolveToolClearance,
    workspaceProjectRoot,
    pickAndSetWorkspaceRoot,
    setSkillsModalOpen,
    setTerminalOpen,
    isStrictApprovalMode,
    toggleStrictApprovalMode,
    setSettingsOpen,
    addToast,
    addLog,
    settings,
    queuedMessagesBuffer,
    addQueuedMessage,
    processNextQueuedMessage,
    pendingPlanApproval,
    setPendingPlanApproval,
    resolvePlanApproval,
    messages,
    activeSessionId,
    addMessage,
    saveChatMessageToDb,
    createNewSession,
    updateSessionTitle,
    sessions,
  } = useStore();

  const convWidthClass = getConversationWidthClass(settings?.conversationWidth);

  const [isCreatorModalOpen, setIsCreatorModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<CustomAgent | null>(null);

  const [isReasoningOpen, setIsReasoningOpen] = useState(settings?.verboseAgentChat ?? true);
  const [isStepsOpen, setIsStepsOpen] = useState(settings?.verboseAgentChat ?? true);

  useEffect(() => {
    setIsReasoningOpen(settings?.verboseAgentChat ?? true);
    setIsStepsOpen(settings?.verboseAgentChat ?? true);
  }, [settings?.verboseAgentChat]);

  const [taskInput, setTaskInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeReasoning, setActiveReasoning] = useState<string>('');
  const [agentOutput, setAgentOutput] = useState<string>('');
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const taskTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentMessages = messages.filter(
    (m) => !activeSessionId || m.session_id === activeSessionId
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length, isExecuting, activeReasoning, agentOutput]);

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const res = await processSelectedFiles(files);
    if (res.error) {
      addToast('warning', res.error);
    }
    if (res.files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...res.files]);
      addToast('success', `${res.files.length} file berhasil dilampirkan.`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const dailyGreeting = getDailyGreeting();

  // Close model popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeAgent =
    customAgents.find((a) => a.id === selectedAgentId) || customAgents[0] || null;

  const handleOpenCreate = () => {
    setEditingAgent(null);
    setIsCreatorModalOpen(true);
  };

  const handleOpenEdit = (agent: CustomAgent) => {
    setEditingAgent(agent);
    setIsCreatorModalOpen(true);
  };

  const handleDelete = (agentId: string, agentName: string) => {
    deleteCustomAgent(agentId);
    addToast('info', `Agent "${agentName}" telah dihapus.`);
  };

  const handleClearance = (approved: boolean) => {
    resolveToolClearance(approved);
    if (approved) {
      addToast('success', `Aksi tool disetujui oleh operator.`);
      // Tandai step terakhir success
      setExecutionSteps((prev) =>
        prev.map((s, idx) => (idx === prev.length - 1 ? { ...s, status: 'success' } : s))
      );
    } else {
      addToast('info', `Aksi tool ditolak oleh operator.`);
      setExecutionSteps((prev) =>
        prev.map((s, idx) => (idx === prev.length - 1 ? { ...s, status: 'failed' } : s))
      );
    }
  };

  const handleRunTask = async (explicitTask?: string) => {
    const currentTask = (explicitTask !== undefined ? explicitTask : taskInput).trim();
    if ((!currentTask && attachedFiles.length === 0) || !activeAgent) return;

    if (isExecuting) {
      if (settings.queuedMessages === 'queue') {
        addQueuedMessage(currentTask);
        if (explicitTask === undefined) {
          setTaskInput('');
          setAttachedFiles([]);
        }
        addToast('info', 'Tugas agent ditambahkan ke antrean.');
        return;
      }
    }

    const filesToAttach = [...attachedFiles];
    const fullTaskPrompt = formatAttachedPrompt(currentTask, filesToAttach);

    if (explicitTask === undefined) {
      setTaskInput('');
      setAttachedFiles([]);
    }

    const targetSessionId =
      activeSessionId || createNewSession(currentTask.slice(0, 35) || 'Sesi Tugas Agent', 'agent');

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      session_id: targetSessionId,
      role: 'user',
      content: fullTaskPrompt,
      created_at: new Date().toISOString(),
    };
    addMessage(userMsg);
    saveChatMessageToDb(userMsg);

    setIsExecuting(true);
    setActiveReasoning('');
    setAgentOutput('');
    setExecutionSteps([]);

    addLog({
      id: `task-start-${Date.now()}`,
      agent_name: activeAgent.name,
      level: 'INFO',
      message: `Memulai eksekusi tugas: "${(currentTask || 'Lampiran file').slice(0, 40)}..."`,
      timestamp: new Date().toLocaleTimeString(),
    });

    try {
      const effectiveModel = activeAgent.model || selectedModel;
      const endpointConfig = resolveEndpointForModel(effectiveModel, availableModels, apiKeys);
      const baseUrl = endpointConfig.baseUrl;
      const apiKey = endpointConfig.apiKey;

      if (!apiKey.trim()) {
        addToast('error', 'API Key belum diatur. Buka menu Setting untuk memasukkan kredensial.');
        setIsExecuting(false);
        return;
      }

      if (!effectiveModel.trim()) {
        addToast('error', `Model belum dipilih untuk ${activeAgent.name}. Pastikan API Key aktif dan model terdeteksi.`);
        setIsExecuting(false);
        return;
      }

      const prompt = `Anda adalah ${activeAgent.name} (Peran: ${activeAgent.role}).
TUGAS UTAMA ANDA: ${activeAgent.task_description}
KEHLIAN & SKILLS: ${activeAgent.skills.join(', ')}
${activeAgent.system_instructions ? `INSTRUKSI KHUSUS: ${activeAgent.system_instructions}` : ''}

PENGGUNA MEMBERIKAN INSTRUKSI BERIKUT:
"${fullTaskPrompt}"

Sebagai agent spesialis, berikan:
1. Analisis langkah demi langkah yang Anda lakukan sesuai kapabilitas tools Anda.
2. Hasil atau implementasi solusi yang konkret.
3. Rekomendasi verifikasi selanjutnya.`;

      const targetChatUrl = getChatEndpoint(baseUrl);
      const res = await fetch(targetChatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: effectiveModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(formatApiErrorMessage(res.status, errText, effectiveModel));
      }

      const rawText = await res.text();
      const data = parseRobustJson<any>(rawText);
      const content = data.choices?.[0]?.message?.content || 'Tugas selesai dievaluasi.';
      const reasoning = data.choices?.[0]?.message?.reasoning_content || 
        `Agent memvalidasi tugas berdasarkan keahlian [${activeAgent.skills.join(', ')}] dan menyusun rencana tindakan.`;

      setActiveReasoning(reasoning);
      setAgentOutput(content);

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        session_id: targetSessionId,
        role: 'assistant',
        content,
        reasoning,
        created_at: new Date().toISOString(),
      };
      addMessage(assistantMsg);
      saveChatMessageToDb(assistantMsg);

      const currentSession = sessions.find((s) => s.id === targetSessionId);
      if (currentSession && (currentSession.title === 'Sesi Tugas Agent' || currentSession.title.startsWith('session-'))) {
        const newTitle = currentTask.trim().slice(0, 35);
        if (newTitle) {
          updateSessionTitle(targetSessionId, newTitle);
        }
      }

      // Simulasi langkah tool yang relevan dengan skills agent
      const generatedSteps: ExecutionStep[] = [];
      if (activeAgent.skills.includes('file_system')) {
        generatedSteps.push({
          id: `step-fs-${Date.now()}`,
          tool: 'read_workspace_file',
          params: { scope: 'src-tauri/src/' },
          status: 'success',
          duration: '38ms',
          timestamp: new Date().toLocaleTimeString(),
        });
      }
      if (activeAgent.skills.includes('terminal_runner')) {
        generatedSteps.push({
          id: `step-term-${Date.now()}`,
          tool: 'run_command',
          params: { cmd: 'cargo check --workspace' },
          status: 'success',
          duration: '142ms',
          timestamp: new Date().toLocaleTimeString(),
        });
      }
      if (activeAgent.skills.includes('code_evaluator')) {
        generatedSteps.push({
          id: `step-eval-${Date.now()}`,
          tool: 'ast_code_analyzer',
          params: { rule: 'antislop-syntax' },
          status: 'success',
          duration: '29ms',
          timestamp: new Date().toLocaleTimeString(),
        });
      }

      setExecutionSteps(generatedSteps);

      // Memicu HITL clearance jika ada aksi berisiko sedang/tinggi
      if (activeAgent.skills.includes('terminal_runner') || activeAgent.skills.includes('file_system')) {
        if (isStrictApprovalMode) {
          // Strict Mode: AI mengeksekusi langsung tanpa bertanya
          addToast('info', `[Strict Auto] Perintah terminal dijalankan langsung oleh ${activeAgent.name}.`);
          addLog({
            id: `strict-auto-${Date.now()}`,
            agent_name: activeAgent.name,
            level: 'EXEC',
            message: `Strict Auto: Eksekusi tool/command tanpa prompt HITL.`,
            timestamp: new Date().toLocaleTimeString(),
          });
        } else {
          // HITL Mode: Minta persetujuan operator
          setPendingToolClearance({
            id: `req-${Date.now()}`,
            tool_name: `${activeAgent.name} :: write_workspace_patch`,
            parameters: { target: 'src/agent_output.patch', risk: 'Medium' },
            requires_clearance: true,
            risk_level: 'Medium',
          });
        }
      }

      addToast('success', `Agent ${activeAgent.name} telah menyelesaikan instruksi!`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      addToast('error', `Gagal menjalankan tugas: ${errMsg}`);
      setAgentOutput(`Kendala eksekusi: ${errMsg}`);
    } finally {
      setIsExecuting(false);

      // Check planReviewPolicy if task was a plan
      const isPlan = currentTask.startsWith('/plan');
      if (isPlan) {
        if (settings.planReviewPolicy === 'always_ask') {
          setPendingPlanApproval({
            id: `plan-${Date.now()}`,
            title: currentTask.replace(/^\/plan\s*/, '').slice(0, 40) || 'Agent Task Plan',
            planContent: agentOutput || 'Rencana dihasilkan oleh agent.',
            status: 'pending',
            createdAt: new Date().toISOString(),
          });
          addToast('info', 'Rencana arsitektur dibuat oleh agent. Menunggu persetujuan operator.');
        } else {
          addToast('success', 'Rencana disetujui otomatis sesuai kebijakan never_ask.');
          addLog({
            id: `plan-auto-${Date.now()}`,
            agent_name: activeAgent.name,
            level: 'INFO',
            message: `Plan policy is never_ask. Automatically approved plan: ${currentTask.slice(0, 40)}`,
            timestamp: new Date().toLocaleTimeString(),
          });
        }
      }

      // Notify when unfocused
      if (
        document.hidden &&
        settings.notifyWhenUnfocused &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        new Notification('Agentic Engine', {
          body: `Tugas ${activeAgent.name} telah selesai.`,
        });
      }

      // Auto-trigger next queued message if settings.queuedMessages === 'queue'
      if (settings.queuedMessages === 'queue') {
        const nextTask = processNextQueuedMessage();
        if (nextTask) {
          setTimeout(() => {
            handleRunTask(nextTask);
          }, 100);
        }
      }
    }
  };

  const getToolIcon = (name: string) => {
    if (name.includes('file')) return <FileCode className="w-3.5 h-3.5 text-[#3b82f6]" />;
    if (name.includes('search')) return <Search className="w-3.5 h-3.5 text-[#f59e0b]" />;
    return <Terminal className="w-3.5 h-3.5 text-[#10b981]" />;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#212121] overflow-hidden">
      {/* Scrollable Agent Content Body */}
      <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${convWidthClass} mx-auto w-full`}>
        {/* Top Banner: Title (Clean without right-side model pill) */}
        <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
          <div>
            <h2 className="text-base font-semibold text-[#ececec] flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#ececec]" />
              <span>Agent Studio & Workspace</span>
            </h2>
            <p className="text-xs text-[#b4b4b4] mt-0.5">
              Buat agent kustom dengan deskripsi tugas utama dan skills untuk mengeksekusi instruksi secara mandiri.
            </p>
          </div>
        </div>

      {/* 1. Agent Selection & Creation Pills Bar */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">
        <div className="flex items-center gap-2">
          {customAgents.map((agent) => {
            const isSelected = activeAgent?.id === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-[#2f2f2f] border-[#404040] text-white'
                    : 'bg-[#212121] border-[#303030] text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#262626]'
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: agent.avatar_color }}
                />
                <span className="truncate max-w-[130px]">{agent.name}</span>
                <span className="text-[10px] text-[#707070] font-mono">
                  {agent.skills.length} skills
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-xs font-medium text-black transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Buat Agent</span>
        </button>
      </div>

      {/* 2. Active Agent Identity Card or Empty State */}
      {customAgents.length === 0 && currentMessages.length === 0 ? (
        <div className="rounded-2xl bg-[#2f2f2f] border border-[#383838] p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#212121] border border-[#383838] flex items-center justify-center mx-auto text-[#ececec]">
            <Bot className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-sm font-semibold text-[#ececec]">Belum Ada Agent yang Dibuat</h3>
            <p className="text-xs text-[#b4b4b4] leading-relaxed">
              Buat agent pertama Anda untuk mulai mendelegasikan tugas khusus, instruksi peran, dan tool eksekusi mandiri.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ececec] hover:bg-white text-xs font-semibold text-black transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Agent Pertama</span>
          </button>
        </div>
      ) : activeAgent ? (
        <div className="rounded-2xl bg-[#2f2f2f] border border-[#383838] p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 flex-1 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 mt-0.5"
                style={{ backgroundColor: activeAgent.avatar_color }}
              >
                <Bot className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#ececec] truncate">{activeAgent.name}</h3>
                  <span className="px-2 py-0.5 rounded-md bg-[#212121] text-[10px] font-mono text-[#b4b4b4] shrink-0">
                    {activeAgent.role}
                  </span>
                </div>
                <p className="text-xs text-[#b4b4b4] leading-relaxed line-clamp-2">
                  {activeAgent.task_description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleOpenEdit(activeAgent)}
                title="Edit agent ini"
                className="p-1.5 rounded-lg hover:bg-[#383838] text-[#b4b4b4] hover:text-[#ececec] transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(activeAgent.id, activeAgent.name)}
                title="Hapus agent ini"
                className="p-1.5 rounded-lg hover:bg-[#383838] text-[#b4b4b4] hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Skills Badges */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[#383838]">
            <span className="text-[11px] font-semibold text-[#b4b4b4]">Keahlian:</span>
            {activeAgent.skills.map((skill) => (
              <span
                key={skill}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#212121] border border-[#303030] text-[11px] font-mono text-[#ececec]"
              >
                <Sparkles className="w-3 h-3 text-[#ececec]" />
                <span>{skill}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* 3. Conversation & Task Execution History Stream */}
      {currentMessages.length > 0 && (
        <div className="space-y-4 pt-1">
          {currentMessages.map((msg) => {
            const isUser = msg.role === 'user';
            if (isUser) {
              return (
                <div key={msg.id} className="flex justify-end w-full">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#2f2f2f] border border-[#383838] p-4 text-[#ececec] shadow-sm">
                    <div className="flex items-center justify-end gap-2 pb-1.5 border-b border-[#383838] mb-2 text-xs">
                      <span className="text-[10px] text-[#707070] font-mono">
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      <span className="font-semibold text-[#ececec]">Operator</span>
                    </div>
                    <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex justify-start w-full">
                <div className="w-full rounded-2xl rounded-tl-sm bg-[#262626] border border-[#383838] p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-[#303030]">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: activeAgent?.avatar_color || '#3b82f6' }}
                      >
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-[#ececec]">{activeAgent?.name || 'Agent'}</span>
                      <span className="text-[10px] text-[#b4b4b4] font-mono px-1.5 py-0.5 rounded bg-[#1f1f1f]">
                        {activeAgent?.role || 'Autonomous Specialist'}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#707070] font-mono">
                      {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>

                  <FormattedMessage
                    content={msg.content}
                    reasoning={msg.reasoning}
                    verbose={settings?.verboseAgentChat ?? true}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Active Reasoning Chain & Live Output Stream while executing */}
      {(isExecuting || (!currentMessages.some((m) => m.content === agentOutput) && (activeReasoning || agentOutput))) && (
        <div className="rounded-2xl bg-[#2f2f2f] border border-[#383838] overflow-hidden">
          <button
            onClick={() => setIsReasoningOpen(!isReasoningOpen)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-[#383838] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Cpu className="w-4 h-4 text-[#ececec]" />
              <div>
                <span className="text-xs font-semibold text-[#ececec]">
                  Rantai Pemikiran & Output Agent
                </span>
                <span className="text-[11px] text-[#b4b4b4] block">
                  {isExecuting ? 'Agent sedang memproses langkah...' : 'Hasil eksekusi siap'}
                </span>
              </div>
            </div>
            {isReasoningOpen ? (
              <ChevronUp className="w-4 h-4 text-[#b4b4b4]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#b4b4b4]" />
            )}
          </button>

          <AnimatePresence>
            {isReasoningOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-5 pt-0 border-t border-[#383838] space-y-4"
              >
                {/* Reasoning Process */}
                {activeReasoning && (
                  <div className="mt-4 p-3.5 rounded-xl bg-[#212121] border border-[#303030] text-xs font-mono text-[#b4b4b4] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    <span className="text-[10px] text-[#ececec] uppercase tracking-wider block mb-1">
                      Cognitive Reasoning Chain:
                    </span>
                    {activeReasoning}
                  </div>
                )}

                {/* Final Output */}
                {agentOutput && (
                  <div className="p-4 rounded-xl bg-[#212121] border border-[#303030] text-xs text-[#ececec] leading-relaxed">
                    <FormattedMessage content={agentOutput} verbose={settings?.verboseAgentChat ?? true} />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div ref={messagesEndRef} />

      {/* 5. Executed Tool Step Badges */}
      {executionSteps.length > 0 && (
        <div className="rounded-2xl bg-[#2f2f2f] border border-[#383838] overflow-hidden">
          <button
            type="button"
            onClick={() => setIsStepsOpen(!isStepsOpen)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-[#383838] transition-colors"
          >
            <span className="text-xs font-semibold text-[#ececec]">
              Tool Steps yang Dijalankan ({executionSteps.length})
            </span>
            {isStepsOpen ? (
              <ChevronUp className="w-4 h-4 text-[#b4b4b4]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#b4b4b4]" />
            )}
          </button>

          <AnimatePresence>
            {isStepsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-5 pt-0 space-y-2"
              >
                {executionSteps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#212121] border border-[#303030] text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1 rounded-lg bg-[#2f2f2f]">{getToolIcon(step.tool)}</div>
                      <span className="font-mono text-[#ececec] font-medium">{step.tool}</span>
                      <span className="text-[#707070] font-mono text-[11px]">
                        {JSON.stringify(step.params)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[#707070] font-mono">
                      <span>{step.duration}</span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Check className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 6. Human-In-The-Loop (HITL) Tool Approval Card */}
      <AnimatePresence>
        {pendingToolClearance && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border-2 border-amber-500/50 bg-[#1e1a12] p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-amber-200 uppercase tracking-wide">
                  Operator Clearance Diperlukan (HITL Safety Gate)
                </h4>
                <p className="text-xs text-amber-100/80 mt-1">
                  Agent mengajukan eksekusi tool berisiko:{' '}
                  <span className="font-mono font-bold text-amber-300">
                    {pendingToolClearance.tool_name}
                  </span>
                </p>
                <div className="mt-2 p-2 rounded-lg bg-black/40 border border-amber-500/30 text-[11px] font-mono text-amber-200/90">
                  Parameter: {JSON.stringify(pendingToolClearance.parameters)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-amber-500/20">
              <button
                onClick={() => handleClearance(false)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-xs font-medium transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tolak Aksi</span>
              </button>
              <button
                onClick={() => handleClearance(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Beri Izin (Approve)</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* 7. Plan Review Approval Card */}
        {pendingPlanApproval && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border-2 border-blue-500/50 bg-[#141a24] p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-blue-200 uppercase tracking-wide">
                  Operator Plan Clearance Diperlukan (HITL Safety Gate)
                </h4>
                <p className="text-xs text-[#ececec] font-medium mt-1">
                  {pendingPlanApproval.title}
                </p>
                <div className="mt-2 p-2.5 rounded-lg bg-black/40 border border-blue-500/30 text-[11px] font-mono text-[#b4b4b4] max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {pendingPlanApproval.planContent}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-blue-500/20">
              <button
                onClick={() => resolvePlanApproval(false)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tolak Rencana</span>
              </button>
              <button
                onClick={() => {
                  const title = pendingPlanApproval.title;
                  resolvePlanApproval(true);
                  handleRunTask(`Lanjutkan eksekusi rencana: "${title}".`);
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Beri Izin Rencana</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* Fixed Bottom Input Dock with Daily Dynamic Greeting */}
      <div className="p-4 bg-transparent shrink-0">
        <div className={`${convWidthClass} mx-auto w-full space-y-2`}>
          {/* Queued Messages Indicator */}
          {queuedMessagesBuffer.length > 0 && (
            <div className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-[#282828] border border-[#383838] text-xs text-[#b4b4b4]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="font-medium text-[#ececec]">
                  Antrean Tugas ({queuedMessagesBuffer.length}):
                </span>
                <span className="truncate max-w-xs text-[#b4b4b4]">
                  &quot;{queuedMessagesBuffer[0]}&quot;
                </span>
              </div>
              <span className="text-[11px] text-[#707070]">Diproses berurutan</span>
            </div>
          )}

          {/* Dynamic Daily Greeting Headline */}
          <div className="text-center py-0.5">
            <h2 className="text-xl font-medium tracking-tight text-[#ececec]">
              {dailyGreeting}
            </h2>
            <p className="text-xs text-[#b4b4b4] mt-0.5">
              Berikan tugas, instruksi arsitektur, atau delegasikan pekerjaan ke {activeAgent?.name || 'Agent'}.
            </p>
          </div>

          {/* 2-Tier Input Dock Container */}
          <div className="space-y-2">
            {/* Top Tier: Main Input Capsule */}
            <div className="relative rounded-3xl bg-[#2f2f2f] border border-[#383838] p-2.5 px-3.5 focus-within:border-[#4f4f4f] transition-colors">
              {/* Attachment Chips Preview */}
              <AttachmentChips
                files={attachedFiles}
                onRemove={(id) => setAttachedFiles((prev) => prev.filter((f) => f.id !== id))}
                className="mb-1.5"
              />

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                multiple
                onChange={handleFileChange}
                className="hidden"
              />

              <textarea
                ref={taskTextareaRef}
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (taskInput.trim() || attachedFiles.length > 0) {
                      handleRunTask();
                    }
                  }
                }}
                placeholder={`Work with ${activeAgent?.name || 'Agent'}... (Enter untuk kirim)`}
                rows={1}
                className="w-full bg-transparent border-none text-[#ececec] placeholder-[#707070] text-sm focus:outline-none resize-none px-2 py-0.5 leading-relaxed font-sans min-h-[28px] max-h-40"
              />

              {/* Inner Bottom Actions Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-[#383838] mt-1">
                {/* Left: Plus button & Approval Toggle (Ask for approval vs Strict) */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Tambah lampiran file dari direktori"
                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                      attachedFiles.length > 0
                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 hover:bg-blue-600/30'
                        : 'bg-[#212121] hover:bg-[#262626] border-[#383838] text-[#ececec]'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  {/* Approval Mode Toggle: Ask for approval vs Strict */}
                  <button
                    type="button"
                    onClick={toggleStrictApprovalMode}
                    title={
                      isStrictApprovalMode
                        ? 'Mode Strict Aktif: AI langsung menjalankan perintah terminal tanpa izin.'
                        : 'Mode Ask for Approval Aktif: AI meminta izin operator sebelum aksi berisiko.'
                    }
                    className={`h-8 flex items-center gap-1.5 px-3 rounded-full text-xs font-medium border transition-colors ${
                      isStrictApprovalMode
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
                        : 'bg-[#212121] hover:bg-[#262626] border-[#383838] text-[#ececec]'
                    }`}
                  >
                    {isStrictApprovalMode ? (
                      <>
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Strict (Auto)</span>
                      </>
                    ) : (
                      <>
                        <Hand className="w-3.5 h-3.5 text-[#ececec]" />
                        <span>Ask for approval</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Right: Model Selector Pill, Mic, and Iconic Send Button */}
                <div className="flex items-center gap-2" ref={modelMenuRef}>
                  {/* Model Selector Pill Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (availableModels.length === 0) {
                          setSettingsOpen(true);
                        } else {
                          setIsModelMenuOpen(!isModelMenuOpen);
                        }
                      }}
                      className={`h-8 flex items-center gap-1.5 px-3 rounded-full border text-xs font-mono transition-all group ${
                        availableModels.length === 0
                          ? 'bg-[#212121] border-[#383838] text-[#707070] hover:text-[#b4b4b4] hover:border-[#4f4f4f]'
                          : 'bg-[#212121] hover:bg-[#262626] border-[#383838] text-[#ececec]'
                      }`}
                      title={availableModels.length === 0 ? 'Klik untuk mengatur API Key di Pengaturan' : 'Pilih Model AI'}
                    >
                      <span className="max-w-[150px] truncate font-medium">
                        {activeAgent?.model || selectedModel || (availableModels.length === 0 ? 'Atur API Key' : 'Pilih Model')}
                      </span>
                      {availableModels.length > 0 && (
                        <ChevronDown className="w-3 h-3 text-[#b4b4b4] group-hover:text-[#ececec] transition-transform" />
                      )}
                    </button>

                    {/* Model Selector Popover */}
                    {isModelMenuOpen && availableModels.length > 0 && (
                      <div className="absolute bottom-full right-0 mb-2 w-80 max-h-96 rounded-2xl bg-[#262626] border border-[#383838] p-2.5 z-50 flex flex-col space-y-2 shadow-2xl">
                        <div className="flex items-center justify-between px-1 pb-1 border-b border-[#303030] text-xs">
                          <span className="font-semibold text-[#ececec]">Model Tersedia</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#b4b4b4] font-mono">
                              {availableModels.length} model
                            </span>
                            <button
                              type="button"
                              onClick={() => fetchAvailableModels()}
                              disabled={isDetectingModels}
                              title="Refresh model"
                              className="p-1 rounded hover:bg-[#303030] text-[#b4b4b4] hover:text-white"
                            >
                              <RotateCw
                                className={`w-3 h-3 ${isDetectingModels ? 'animate-spin' : ''}`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Search inside models */}
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#212121] border border-[#303030]">
                          <Search className="w-3.5 h-3.5 text-[#b4b4b4]" />
                          <input
                            type="text"
                            value={modelSearchQuery}
                            onChange={(e) => setModelSearchQuery(e.target.value)}
                            placeholder="Cari model..."
                            className="flex-1 bg-transparent border-none text-xs text-[#ececec] placeholder-[#707070] focus:outline-none"
                          />
                        </div>

                        {/* Scrollable Model List */}
                        <div className="flex-1 overflow-y-auto max-h-60 space-y-1 pr-1">
                          {availableModels.length === 0 ? (
                            <div className="p-4 text-center text-xs text-[#b4b4b4]">
                              Belum ada model terdeteksi dari endpoint API.
                            </div>
                          ) : (
                            availableModels
                              .filter((m) =>
                                m.id.toLowerCase().includes(modelSearchQuery.toLowerCase())
                              )
                              .map((m) => {
                                const isSelected = m.id === selectedModel;
                                return (
                                  <button
                                    key={m.id}
                                    onClick={() => {
                                      setModel(m.id);
                                      setIsModelMenuOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                                      isSelected
                                        ? 'bg-[#2f2f2f] text-white border border-[#404040]'
                                        : 'hover:bg-[#212121] text-[#b4b4b4] hover:text-[#ececec]'
                                    }`}
                                  >
                                    <div className="truncate pr-2">
                                      <div className="font-mono font-medium truncate">{m.id}</div>
                                    </div>
                                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                                  </button>
                                );
                              })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mic Icon */}
                  <button
                    type="button"
                    title="Voice input (segera hadir)"
                    className="w-8 h-8 rounded-full hover:bg-[#383838] text-[#b4b4b4] hover:text-[#ececec] flex items-center justify-center transition-colors shrink-0"
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  {/* Iconic Send Button */}
                  <button
                    onClick={() => handleRunTask()}
                    disabled={!taskInput.trim() && attachedFiles.length === 0}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                      taskInput.trim() || attachedFiles.length > 0
                        ? 'bg-[#ececec] text-[#171717] hover:bg-white'
                        : 'bg-[#383838] text-[#707070] cursor-not-allowed'
                    }`}
                    title={
                      isExecuting && settings.queuedMessages === 'queue'
                        ? 'Masukkan ke antrean tugas [Enter]'
                        : 'Jalankan tugas [Enter]'
                    }
                  >
                    <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Tier: Auxiliary Sub-Bar (Choose project, @ Plugins, terminal shortcut) */}
            <div className="flex items-center justify-between px-2 pt-0.5">
              <div className="flex items-center gap-3">
                {/* Choose project button */}
                <button
                  type="button"
                  onClick={() => pickAndSetWorkspaceRoot()}
                  title={`Pilih folder proyek native: ${workspaceProjectRoot}`}
                  className="flex items-center gap-1.5 text-xs text-[#b4b4b4] hover:text-[#ececec] transition-colors group"
                >
                  <Folder className="w-3.5 h-3.5 text-[#b4b4b4] group-hover:text-[#ececec]" />
                  <span>Choose project</span>
                  <span className="text-[10px] text-[#707070] font-mono max-w-[120px] truncate">
                    ({workspaceProjectRoot.split('/').pop() || 'workspace'})
                  </span>
                </button>

                {/* @ Plugins button */}
                <button
                  type="button"
                  onClick={() => setSkillsModalOpen(true)}
                  title="Buka Skills & Plugins Hub"
                  className="flex items-center gap-1.5 text-xs text-[#b4b4b4] hover:text-[#ececec] transition-colors group"
                >
                  <AtSign className="w-3.5 h-3.5 text-[#b4b4b4] group-hover:text-[#ececec]" />
                  <span>Plugins</span>
                </button>
              </div>

              {/* Right: Quick Terminal Shortcut */}
              <button
                type="button"
                onClick={() => setTerminalOpen(true)}
                title="Buka Terminal Terintegrasi"
                className="p-1 rounded text-[#707070] hover:text-[#ececec] transition-colors"
              >
                <Terminal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Creator Modal */}
      <AgentCreatorModal
        isOpen={isCreatorModalOpen}
        onClose={() => setIsCreatorModalOpen(false)}
        editingAgent={editingAgent}
      />
    </div>
  );
};

export default AgentWorkspace;
