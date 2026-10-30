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
  Square,
  Loader2,
  Folder,
  AtSign,
  RotateCw,
  GitBranch,
  KeyRound,
  SlidersHorizontal,
  Copy,
} from 'lucide-react';
import { useVoiceRecorder } from '../../utils/audioRecorder';
import { useStore } from '../../store/useStore';
import { CustomAgent, AttachedFile, ChatMessage } from '../../types';
import { AgentCreatorModal } from './AgentCreatorModal';
import { AttachmentChips } from '../common/AttachmentChips';
import { FormattedMessage } from '../common/FormattedMessage';
import { ContextTelemetryBar } from '../common/ContextTelemetryBar';
import { processSelectedFiles, formatAttachedPrompt, pickNativeFiles } from '../../utils/fileUpload';
import { parseRobustJson, getChatEndpoint, formatApiErrorMessage, resolveEndpointForModel } from '../../utils/api';
import { getDailyGreeting } from '../../utils/dailyGreetings';
import { getConversationWidthClass } from '../../utils/layout';
import { AGENT_AVAILABLE_TOOLS, isPathExternal, convertMcpToolToDefinition } from '../../utils/tools';
import { ExecutionStep } from '../../types';
import { AgentMascot } from '../mascot/AgentMascot';

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
    addToast,
    addLog,
    settings,
    updateSettings,
    mcpTools,
    isStreaming,
    isWorking,
    setIsWorking,
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
    forkSessionFromMessage,
    selectSession,
    setSettingsOpen,
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
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const handleCopyMessage = (content: string, msgId: string) => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };
  const [activeReasoning, setActiveReasoning] = useState<string>('');
  const [agentOutput, setAgentOutput] = useState<string>('');
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const taskTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isRecording: isVoiceRecording,
    isTranscribing: isVoiceTranscribing,
    duration: voiceDuration,
    downloadProgress: voiceDownloadProgress,
    startRecording: startVoiceRecording,
    stopRecording: stopVoiceRecording,
    cancelRecording: cancelVoiceRecording,
  } = useVoiceRecorder();

  const preVoicePromptRef = useRef<string>('');

  const handleToggleVoice = async () => {
    if (isVoiceRecording) {
      try {
        const transcribedText = await stopVoiceRecording(settings?.voiceInputLanguage || 'id');
        if (transcribedText) {
          const base = preVoicePromptRef.current.trim();
          const combined = base ? `${base} ${transcribedText}` : transcribedText;
          setTaskInput(combined);
          addToast('success', `Suara berhasil ditranskripsi (${transcribedText.slice(0, 35)}...)`, 3000);
        }
      } catch (err: any) {
        addToast('error', `Gagal mentranskripsi suara: ${err?.message || err}`, 5000);
      }
    } else {
      try {
        preVoicePromptRef.current = taskInput;
        await startVoiceRecording({
          language: settings?.voiceInputLanguage || 'id',
          onInterimText: (interim) => {
            const base = preVoicePromptRef.current.trim();
            const combined = base ? `${base} ${interim}` : interim;
            setTaskInput(combined);
          },
        });
      } catch (err: any) {
        addToast('error', `Gagal mengakses mikrofon: ${err?.message || err}`, 5000);
      }
    }
  };

  const handleCancelVoice = () => {
    cancelVoiceRecording();
    setTaskInput(preVoicePromptRef.current);
  };

  const currentMessages = activeSessionId
    ? messages.filter((m) => m.session_id === activeSessionId)
    : [];

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

  const handleAttachClick = async () => {
    let nativeSuccess = false;
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      try {
        const picked = await pickNativeFiles();
        if (picked && picked.length > 0) {
          setAttachedFiles((prev) => [...prev, ...picked]);
          addToast('success', `${picked.length} file berhasil dilampirkan.`);
          return;
        }
        nativeSuccess = true;
      } catch (err) {
        console.warn('Native file picker fallback to HTML input:', err);
      }
    }
    if (!nativeSuccess) {
      fileInputRef.current?.click();
    }
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

  const pendingClearanceResolver = useRef<((approved: boolean) => void) | null>(null);

  const handleClearance = (approved: boolean) => {
    if (pendingClearanceResolver.current) {
      pendingClearanceResolver.current(approved);
      pendingClearanceResolver.current = null;
    }
    setPendingToolClearance(null);
    resolveToolClearance(approved);
    if (approved) {
      addToast('success', 'Aksi tool disetujui oleh operator.');
    } else {
      addToast('info', 'Aksi tool ditolak oleh operator.');
    }
  };

  const handleRunTask = async (explicitTask?: string) => {
    const currentTask = (explicitTask !== undefined ? explicitTask : taskInput).trim();
    if ((!currentTask && attachedFiles.length === 0) || !activeAgent) return;

    const isBusy = isExecuting || isWorking || isStreaming;
    if (isBusy && explicitTask === undefined) {
      if (settings.queuedMessages === 'queue') {
        addQueuedMessage(currentTask);
        setTaskInput('');
        setAttachedFiles([]);
        addToast('info', 'Tugas agent ditambahkan ke antrean.');
        return;
      }
      // When settings.queuedMessages === 'immediate', send immediately without queuing
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
    setIsWorking(true);
    setActiveReasoning('');
    setAgentOutput('');
    const agentKey = activeAgent.id || 'agent';
    useStore.getState().setAgentActiveEvent(agentKey, 'on_thinking');
    let hasError = false;

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
        useStore.getState().setAgentActiveEvent(agentKey, 'on_error', 3000);
        return;
      }

      if (!effectiveModel.trim()) {
        addToast('error', `Model belum dipilih untuk ${activeAgent.name}. Pastikan API Key aktif dan model terdeteksi.`);
        setIsExecuting(false);
        useStore.getState().setAgentActiveEvent(agentKey, 'on_error', 3000);
        return;
      }

      const systemPrompt = `Anda adalah ${activeAgent.name} (Peran: ${activeAgent.role}).
TUGAS UTAMA ANDA: ${activeAgent.task_description}
KEAHLIAN & SKILLS: ${activeAgent.skills.join(', ')}
${activeAgent.system_instructions ? `INSTRUKSI KHUSUS: ${activeAgent.system_instructions}` : ''}
ROOT WORKSPACE AKTIF: "${workspaceProjectRoot}"

PANDUAN EKSEKUSI TOOL & KEBIJAKAN SISTEM:
1. Anda memiliki akses ke tool nyata (function calls) berikut:
   - 'read_file': Membaca berkas di workspace atau direktori lain. Parameter: { path: string }
   - 'write_file': Menulis atau mengubah berkas. Parameter: { path: string, content: string }
   - 'list_dir': Melihat daftar berkas/folder. Parameter: { path?: string }
   - 'execute_command': Menjalankan perintah bash di workspace. Parameter: { command: string, working_dir?: string }
   - 'web_fetch': Mengambil konten data dari URL web. Parameter: { url: string }
   - 'web_search': Mencari informasi aktual di internet dan membaca intisari halaman teratas. Parameter: { query: string, max_chars?: number }
${mcpTools.length > 0 ? `\n2. Anda juga memiliki akses langsung ke perkakas eksternal via Model Context Protocol (MCP):\n` + mcpTools.map((t) => `   - '${t.namespaced_name}': [Server ${t.server_name}] ${t.description || t.original_name}`).join('\n') : ''}

3. PANDUAN PEMANGGILAN TOOL:
   - PANGGIL tool secara langsung melalui mekanisme function calling (tool_calls). DILARANG hanya menuliskan kode atau aksi di dalam teks/blok markdown biasa tanpa memanggil tool nyata.
   - Setelah eksekusi tool selesai dan hasilnya didapatkan, rangkum hasil pekerjaan Anda dengan jelas dan terstruktur kepada pengguna menggunakan Bahasa Indonesia yang profesional.`;

      const previousSessionMsgs = currentMessages.slice(-6).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content || '',
      }));

      const messagesHistory: Array<{
        role: 'system' | 'user' | 'assistant' | 'tool';
        content?: string;
        reasoning_content?: string;
        tool_calls?: any[];
        tool_call_id?: string;
      }> = [
        { role: 'system', content: systemPrompt },
        ...previousSessionMsgs,
        { role: 'user', content: fullTaskPrompt },
      ];

      const targetChatUrl = getChatEndpoint(baseUrl);
      let iteration = 0;
      const maxIterations = 5;
      const accumulatedSteps: ExecutionStep[] = [];
      let finalContent = '';
      let finalReasoning = '';

      while (iteration < maxIterations) {
        if (useStore.getState().emergencyStopped) {
          addToast('warning', 'Eksekusi dihentikan oleh operator (Emergency Stop).');
          break;
        }
        iteration++;

        const combinedTools = [
          ...AGENT_AVAILABLE_TOOLS,
          ...mcpTools.map(convertMcpToolToDefinition),
        ];

        const res = await fetch(targetChatUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: effectiveModel,
            messages: messagesHistory,
            tools: combinedTools,
            temperature: 0.5,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(formatApiErrorMessage(res.status, errText, effectiveModel));
        }

        const rawText = await res.text();
        const data = parseRobustJson<any>(rawText);
        const choice = data.choices?.[0]?.message;
        if (!choice) break;

        const toolCalls = choice.tool_calls;
        const msgContent = choice.content || '';
        const reasoning = choice.reasoning_content || '';
        if (reasoning) {
          finalReasoning = reasoning;
          setActiveReasoning(reasoning);
        }

        if (!toolCalls || toolCalls.length === 0) {
          finalContent = msgContent;
          break;
        }

        messagesHistory.push({
          role: 'assistant',
          content: msgContent,
          tool_calls: toolCalls,
        });

        for (const call of toolCalls) {
          if (useStore.getState().emergencyStopped) break;

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
          const isExternal = isPathExternal(targetPath, workspaceProjectRoot);
          const externalPolicy = settings.externalDirectoryAccess || 'always_ask';

          let shouldAskClearance = false;
          let clearanceReason = '';

          // 1. Pengecekan akses direktori eksternal
          if (isExternal) {
            if (externalPolicy === 'workspace_only') {
              const rejectMsg = `Keamanan: Akses ke '${targetPath}' ditolak karena jalur berada di luar workspace dan pengaturan diset ke 'Batasi ke Workspace'.`;
              messagesHistory.push({
                role: 'tool',
                tool_call_id: call.id,
                content: rejectMsg,
              });
              accumulatedSteps.push({
                id: `step-${Date.now()}-${accumulatedSteps.length}`,
                tool: toolName,
                params: toolParams,
                status: 'failed',
                duration: '0ms',
                output: rejectMsg,
                timestamp: new Date().toLocaleTimeString(),
              });
              setExecutionSteps([...accumulatedSteps]);
              continue;
            } else if (externalPolicy === 'always_ask') {
              shouldAskClearance = true;
              clearanceReason = `AI meminta akses ke berkas/direktori di luar workspace: "${targetPath}"`;
            }
          }

          // 2. Pengecekan tool mutatif jika Ask for Approval aktif, atau tool eksternal MCP
          if (!shouldAskClearance && (toolName === 'write_file' || toolName === 'execute_command' || toolName.startsWith('mcp__'))) {
            shouldAskClearance = true;
            clearanceReason =
              toolName === 'write_file'
                ? `Menulis berkas: "${targetPath}" (${(toolParams.content || '').length} karakter)`
                : toolName === 'execute_command'
                ? `Menjalankan perintah: "${toolParams.command}"`
                : `Eksekusi tool eksternal Model Context Protocol (MCP): ${toolName}`;
          }

          let allowExecution = true;
          if (shouldAskClearance) {
            useStore.getState().setAgentActiveEvent(agentKey, 'on_approval');
            setPendingToolClearance({
              id: `clearance-${Date.now()}`,
              tool_name: `${activeAgent.name} :: ${toolName}`,
              parameters: {
                ...toolParams,
                _deskripsi: clearanceReason,
                _is_external: isExternal,
                risk: isExternal || toolName.startsWith('mcp__') ? 'High' : 'Medium',
              },
              requires_clearance: true,
              risk_level: isExternal || toolName.startsWith('mcp__') ? 'High' : 'Medium',
            });

            allowExecution = await new Promise<boolean>((resolve) => {
              pendingClearanceResolver.current = resolve;
            });
            setPendingToolClearance(null);
            useStore.getState().setAgentActiveEvent(agentKey, 'on_thinking');
          }

          if (!allowExecution) {
            const userRejectedMsg = 'Aksi tool ditolak oleh operator (Human-in-the-Loop clearance).';
            messagesHistory.push({
              role: 'tool',
              tool_call_id: call.id,
              content: userRejectedMsg,
            });
            accumulatedSteps.push({
              id: `step-${Date.now()}-${accumulatedSteps.length}`,
              tool: toolName,
              params: toolParams,
              status: 'failed',
              duration: '0ms',
              output: userRejectedMsg,
              timestamp: new Date().toLocaleTimeString(),
            });
            setExecutionSteps([...accumulatedSteps]);
            continue;
          }

          // Eksekusi tool nyata via Rust backend
          const startTime = Date.now();
          let toolOutput = '';
          let toolSuccess = false;

          try {
            if ((window as any).__TAURI_INTERNALS__) {
              const { invoke } = await import('@tauri-apps/api/core');
              const res: any = await invoke('execute_sandbox_tool', {
                toolName,
                parameters: {
                  ...toolParams,
                  allow_external: isExternal ? (externalPolicy === 'always_allow' || allowExecution) : false,
                },
              });
              toolSuccess = res?.success ?? false;
              toolOutput = res?.output ?? '';
            } else {
              toolSuccess = true;
              toolOutput = `[Web Mode] Tool ${toolName} berhasil disimulasikan.`;
            }
          } catch (err: any) {
            toolSuccess = false;
            toolOutput = err?.message || String(err);
          }

          const elapsed = Date.now() - startTime;
          accumulatedSteps.push({
            id: `step-${Date.now()}-${accumulatedSteps.length}`,
            tool: toolName,
            params: toolParams,
            status: toolSuccess ? 'success' : 'failed',
            duration: `${elapsed}ms`,
            output: toolOutput.slice(0, 300),
            timestamp: new Date().toLocaleTimeString(),
          });
          setExecutionSteps([...accumulatedSteps]);

          messagesHistory.push({
            role: 'tool',
            tool_call_id: call.id,
            content: toolOutput,
          });

          addLog({
            id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            agent_name: activeAgent.name,
            level: toolSuccess ? 'EXEC' : 'WARN',
            message: `Tool ${toolName} (${elapsed}ms): ${toolOutput.slice(0, 80)}`,
            timestamp: new Date().toLocaleTimeString(),
          });
        }
      }

      if (!finalContent && accumulatedSteps.length > 0) {
        finalContent = `Seluruh ${accumulatedSteps.length} langkah alat telah selesai dijalankan.`;
      }
      if (!finalReasoning) {
        finalReasoning = `Agen memproses instruksi menggunakan tool [${activeAgent.skills.join(', ')}] dengan ${accumulatedSteps.length} langkah eksekusi.`;
      }

      setActiveReasoning(finalReasoning);
      setAgentOutput(finalContent);

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        session_id: targetSessionId,
        role: 'assistant',
        content: finalContent,
        reasoning: finalReasoning,
        created_at: new Date().toISOString(),
      };
      addMessage(assistantMsg);
      saveChatMessageToDb(assistantMsg);

      // Auto-detect artifacts if message contains code block or diagram
      const codeBlockMatch = finalContent.match(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
      if (codeBlockMatch) {
        const lang = codeBlockMatch[1] || 'code';
        const codeBody = codeBlockMatch[2].trim();
        if (codeBody.split('\n').length >= 6 || ['mermaid', 'html', 'svg'].includes(lang.toLowerCase())) {
          const artifactId = `art-auto-${Date.now()}`;
          const cleanTitle = `Snippet ${lang.toUpperCase()}`;
          useStore.getState().openArtifact({
            id: artifactId,
            title: cleanTitle,
            language: lang,
            content: codeBody,
            versions: [
              {
                version: 1,
                content: codeBody,
                timestamp: new Date().toISOString(),
                author: 'ai',
                summary: `Dibuat otomatis oleh agen ${activeAgent.name}`,
              },
            ],
            currentVersionIndex: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sessionId: targetSessionId,
            messageId: assistantMsg.id,
          });
        }
      }

      const currentSession = sessions.find((s) => s.id === targetSessionId);
      if (
        currentSession &&
        (currentSession.title === 'Sesi Tugas Agent' || currentSession.title.startsWith('session-'))
      ) {
        const newTitle = currentTask.trim().slice(0, 35);
        if (newTitle) {
          updateSessionTitle(targetSessionId, newTitle);
        }
      }

      addToast('success', `Agent ${activeAgent.name} telah menyelesaikan instruksi!`);
    } catch (err: unknown) {
      hasError = true;
      useStore.getState().setAgentActiveEvent(agentKey, 'on_error', 4000);
      const errMsg = err instanceof Error ? err.message : String(err);
      addToast('error', `Gagal menjalankan tugas: ${errMsg}`);
      setAgentOutput(`Kendala eksekusi: ${errMsg}`);
    } finally {
      setIsExecuting(false);
      setIsWorking(false);
      if (!hasError) {
        useStore.getState().setAgentActiveEvent(agentKey, 'on_success', 2500);
      }

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
          const planTitle = currentTask.replace(/^\/plan\s*/, '').slice(0, 40) || 'Agent Task Plan';
          setTimeout(() => {
            handleRunTask(`Lanjutkan eksekusi rencana: "${planTitle}".`);
          }, 300);
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
    if (name.includes('file')) return <FileCode className="w-3.5 h-3.5 text-[#b4b4b4]" />;
    if (name.includes('search')) return <Search className="w-3.5 h-3.5 text-[#b4b4b4]" />;
    return <Terminal className="w-3.5 h-3.5 text-[#ececec]" />;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#212121] overflow-hidden">
      {/* Scrollable Agent Content Body */}
      <div className="flex-1 overflow-y-auto p-6 w-full">
        <div className={`space-y-6 ${convWidthClass} mx-auto w-full`}>
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
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 overflow-hidden bg-[#262626] border border-[#383838]"
              >
                <AgentMascot roleOrId={activeAgent.id || 'agent'} size={46} />
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

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => updateSettings({ verboseAgentChat: !settings.verboseAgentChat })}
                title={settings.verboseAgentChat ? 'Sembunyikan langkah pemikiran rinci' : 'Tampilkan langkah pemikiran rinci'}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                  settings.verboseAgentChat
                    ? 'bg-[#2f2f2f] border-[#404040] text-[#ececec]'
                    : 'text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#383838] border-[#383838]'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span className="text-[11px] font-mono">Verbose {settings.verboseAgentChat ? 'ON' : 'OFF'}</span>
              </button>
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

      {/* Fork Origin Notification Banner if session is forked */}
      {(() => {
        const curSession = sessions.find((s) => s.id === activeSessionId);
        if (curSession?.parent_session_id) {
          const parentSession = sessions.find((s) => s.id === curSession.parent_session_id);
          return (
            <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-[#262626] border border-[#383838] text-xs text-[#b4b4b4]">
              <div className="flex items-center gap-2 min-w-0">
                <GitBranch className="w-3.5 h-3.5 text-[#ececec] shrink-0" />
                <span className="truncate">
                  Task ini merupakan cabang dari:{' '}
                  <span className="font-semibold text-[#ececec]">
                    {parentSession?.title || 'Sesi Induk'}
                  </span>
                </span>
              </div>
              {parentSession && (
                <button
                  type="button"
                  onClick={() => selectSession(parentSession.id)}
                  className="px-2.5 py-1 rounded-xl bg-[#212121] hover:bg-[#282828] border border-[#383838] text-[#ececec] text-[11px] font-medium transition-colors shrink-0 ml-2"
                >
                  Buka Sesi Induk
                </button>
              )}
            </div>
          );
        }
        return null;
      })()}

      {/* 3. Conversation & Task Execution History Stream */}
      {currentMessages.length > 0 && (
        <div className="space-y-4 pt-1">
          {currentMessages.map((msg) => {
            const isUser = msg.role === 'user';
            if (isUser) {
              return (
                <div key={msg.id} className="group flex flex-col items-end w-full space-y-1">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#2f2f2f] border border-[#383838] p-4 text-[#ececec] shadow-sm">
                    <div className="flex items-center justify-end gap-2 pb-1.5 border-b border-[#383838] mb-2 text-xs">
                      <span className="text-[10px] text-[#707070] font-mono">
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      <span className="font-semibold text-[#ececec]">Operator</span>
                    </div>
                    <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                  {/* Fork Action Button */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                    <button
                      type="button"
                      onClick={() => activeSessionId && forkSessionFromMessage(activeSessionId, msg.id)}
                      title="Cabangkan task baru dari pesan ini"
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[#262626] hover:bg-[#303030] text-[#707070] hover:text-[#ececec] border border-[#303030] hover:border-[#383838] transition-colors"
                    >
                      <GitBranch className="w-3 h-3 text-[#b4b4b4]" />
                      <span>Cabangkan (Fork)</span>
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className="group flex flex-col items-start w-full space-y-1">
                <div className="w-full rounded-2xl rounded-tl-sm bg-[#262626] border border-[#383838] p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-[#303030]">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-[#1f1f1f] border border-[#383838]"
                      >
                        <AgentMascot roleOrId={activeAgent?.id || 'agent'} size={36} />
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
                {/* Action Buttons (Copy & Fork) */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 justify-start select-none">
                  {msg.content && (
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.content, msg.id)}
                      title="Salin seluruh respons ini"
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[#262626] hover:bg-[#303030] text-[#707070] hover:text-[#ececec] border border-[#303030] hover:border-[#383838] transition-colors"
                    >
                      {copiedMsgId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-[#ececec]" />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => activeSessionId && forkSessionFromMessage(activeSessionId, msg.id)}
                    title="Cabangkan task baru dari respons ini"
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[#262626] hover:bg-[#303030] text-[#707070] hover:text-[#ececec] border border-[#303030] hover:border-[#383838] transition-colors"
                  >
                    <GitBranch className="w-3 h-3 text-[#b4b4b4]" />
                    <span>Cabangkan (Fork)</span>
                  </button>
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
                    className="p-3 rounded-xl bg-[#212121] border border-[#303030] text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1 rounded-lg bg-[#2f2f2f] shrink-0">{getToolIcon(step.tool || step.name || '')}</div>
                        <span className="font-mono text-[#ececec] font-medium shrink-0">{step.tool || step.name}</span>
                        <span className="text-[#707070] font-mono text-[11px] truncate max-w-sm">
                          {JSON.stringify(step.params || {})}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] font-mono shrink-0">
                        <span className="text-[#707070]">{step.duration}</span>
                        {step.status === 'success' ? (
                          <span className="flex items-center gap-1 text-[#ececec]">
                            <Check className="w-3.5 h-3.5 text-[#ececec]" />
                            <span>Done</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-rose-400">
                            <X className="w-3.5 h-3.5" />
                            <span>Failed</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {step.output && (
                      <div className="text-[10px] text-[#b4b4b4] font-mono bg-[#171717] p-2 rounded-lg border border-[#2e2e2e] whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed select-text">
                        {step.output}
                      </div>
                    )}
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
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs font-semibold text-amber-200 uppercase tracking-wide">
                    Operator Clearance Diperlukan (HITL Safety Gate)
                  </h4>
                  {Boolean(pendingToolClearance.parameters?._is_external) && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Akses Direktori Eksternal
                    </span>
                  )}
                </div>

                <p className="text-xs text-amber-100/90 leading-relaxed">
                  {pendingToolClearance.parameters?._deskripsi
                    ? String(pendingToolClearance.parameters._deskripsi)
                    : `Agent mengajukan eksekusi tool berisiko: ${pendingToolClearance.tool_name}`}
                </p>

                <div className="p-2 rounded-lg bg-black/40 border border-amber-500/30 text-[11px] font-mono text-amber-200/90 overflow-x-auto">
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
            className="rounded-2xl border border-[#383838] bg-[#1e1e1e] p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#ececec] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-[#ececec] uppercase tracking-wide">
                  Operator Plan Clearance Diperlukan (HITL Safety Gate)
                </h4>
                <p className="text-xs text-[#ececec] font-medium mt-1">
                  {pendingPlanApproval.title}
                </p>
                <div className="mt-2 p-2.5 rounded-lg bg-black/40 border border-[#303030] text-[11px] font-mono text-[#b4b4b4] max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {pendingPlanApproval.planContent}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#303030]">
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
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-black text-xs font-semibold transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Beri Izin Rencana</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        </div>
      </div>

      {/* Fixed Bottom Input Dock with Daily Dynamic Greeting */}
      <div className="p-4 bg-transparent shrink-0">
        <div className={`${convWidthClass} mx-auto w-full space-y-2`}>
          {/* Queued Messages Indicator */}
          {queuedMessagesBuffer.length > 0 && (
            <div className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-[#282828] border border-[#383838] text-xs text-[#b4b4b4]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ececec] animate-pulse" />
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
            {/* Real-time Token Counter & Context Meter Telemetry Bar */}
            <ContextTelemetryBar
              draftPrompt={taskInput}
              isProcessing={isExecuting || isWorking || isStreaming}
            />

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
                {/* Left: Plus button */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAttachClick}
                    title="Tambah lampiran file dari direktori"
                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                      attachedFiles.length > 0
                        ? 'bg-[#383838] border-[#4f4f4f] text-[#ececec] hover:bg-[#404040]'
                        : 'bg-[#212121] hover:bg-[#262626] border-[#383838] text-[#ececec]'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Right: Model Selector Pill, Mic, and Iconic Send Button */}
                <div className="flex items-center gap-2" ref={modelMenuRef}>
                  {/* Model Selector Pill Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                      className="h-8 flex items-center gap-1.5 px-3 rounded-full border text-xs font-mono transition-all group bg-[#212121] hover:bg-[#262626] border-[#383838] text-[#ececec]"
                      title="Pilih Model AI"
                    >
                      {availableModels.length === 0 ? (
                        <span className="w-2 h-2 rounded-full bg-amber-400/90 shrink-0" />
                      ) : (
                        <Cpu className="w-3.5 h-3.5 text-[#ececec]" />
                      )}
                      <span className="max-w-[150px] truncate font-medium">
                        {activeAgent?.model || selectedModel || 'Pilih Model'}
                      </span>
                      <ChevronDown
                        className={`w-3 h-3 text-[#b4b4b4] group-hover:text-[#ececec] transition-transform ${
                          isModelMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Model Selector Popover */}
                    {isModelMenuOpen && (
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
                          {availableModels.length === 0 && !modelSearchQuery.trim() ? (
                            <div className="p-4 rounded-xl border border-[#303030] bg-[#1f1f1f] text-center space-y-3 my-1">
                              <div className="w-9 h-9 mx-auto rounded-full bg-[#2a2a2a] border border-[#383838] flex items-center justify-center text-[#b4b4b4]">
                                <KeyRound className="w-4 h-4 text-amber-400/90" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-[#ececec]">Belum Ada Model Aktif</p>
                                <p className="text-[11px] text-[#888888] leading-relaxed">
                                  Tambahkan API Key di Pengaturan untuk mengaktifkan model AI.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsModelMenuOpen(false);
                                  setSettingsOpen(true);
                                }}
                                className="w-full py-1.5 px-3 rounded-xl bg-[#2b2b2b] hover:bg-[#383838] border border-[#383838] text-xs font-medium text-[#ececec] transition-colors flex items-center justify-center gap-1.5"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5 text-[#b4b4b4]" />
                                <span>Buka Pengaturan API</span>
                              </button>
                            </div>
                          ) : availableModels.length === 0 ? (
                            <div className="p-4 text-center text-xs text-[#b4b4b4] space-y-2">
                              <p>Tidak ada model yang cocok dengan pencarian.</p>
                              {modelSearchQuery.trim() && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModel(modelSearchQuery.trim());
                                    setIsModelMenuOpen(false);
                                  }}
                                  className="px-3 py-1 rounded-lg bg-[#383838] hover:bg-[#484848] text-[#ececec] text-xs font-mono"
                                >
                                  Gunakan &quot;{modelSearchQuery.trim()}&quot;
                                </button>
                              )}
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

                  {/* Voice Recording Active Timer Pill */}
                  {isVoiceRecording && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full text-xs font-mono animate-pulse mr-1">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span>
                        {Math.floor(voiceDuration / 60)
                          .toString()
                          .padStart(2, '0')}
                        :{(voiceDuration % 60).toString().padStart(2, '0')}
                      </span>
                      <button
                        type="button"
                        onClick={handleCancelVoice}
                        title="Batalkan rekaman"
                        className="ml-0.5 text-red-400 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Mic Button */}
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    disabled={isVoiceTranscribing}
                    title={
                      isVoiceTranscribing
                        ? 'Sedang mentranskripsi suara...'
                        : isVoiceRecording
                        ? 'Klik untuk selesai dan transkripsi'
                        : voiceDownloadProgress?.status === 'downloading'
                        ? `Sedang mengunduh model speech-to-text (${voiceDownloadProgress.percent.toFixed(0)}%)...`
                        : 'Bicara (Offline Voice Input)'
                    }
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                      isVoiceRecording
                        ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                        : isVoiceTranscribing
                        ? 'bg-[#383838] text-[#b4b4b4] cursor-wait'
                        : 'hover:bg-[#383838] text-[#b4b4b4] hover:text-[#ececec]'
                    }`}
                  >
                    {isVoiceTranscribing ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#ececec]" />
                    ) : isVoiceRecording ? (
                      <Square className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
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
