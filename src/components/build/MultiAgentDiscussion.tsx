import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  Bot,
  Sparkles,
  Lightbulb,
  Code,
  ShieldCheck,
  UserCheck,
  AtSign,
  FileCode,
  Plus,
  Hand,
  Zap,
  ChevronDown,
  ChevronUp,
  Folder,
  Terminal,
  ArrowUp,
  Mic,
  Check,
  RotateCw,
  Search,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { CustomSelect } from '../common/CustomSelect';
import { AttachedFile } from '../../types';
import { AttachmentChips } from '../common/AttachmentChips';
import { processSelectedFiles, formatAttachedPrompt } from '../../utils/fileUpload';
import { extractCodeReviewItems } from '../../utils/codeExtractor';
import { getDailyGreeting } from '../../utils/dailyGreetings';
import { getConversationWidthClass } from '../../utils/layout';

export const MultiAgentDiscussion: React.FC = () => {
  const {
    customAgents,
    buildDiscussion,
    advanceDiscussionTurn,
    sendOperatorMessage,
    resetBuildDiscussion,
    addToast,
    selectedModel,
    setModel,
    availableModels,
    isDetectingModels,
    fetchAvailableModels,
    workspaceProjectRoot,
    pickAndSetWorkspaceRoot,
    setSkillsModalOpen,
    setCodeReviewModalOpen,
    setTerminalOpen,
    setSettingsOpen,
    updateCustomAgent,
    isStrictApprovalMode,
    toggleStrictApprovalMode,
    settings,
    queuedMessagesBuffer,
    addQueuedMessage,
    processNextQueuedMessage,
  } = useStore();

  const convWidthClass = getConversationWidthClass(settings?.conversationWidth);

  const [chatInput, setChatInput] = useState('');
  const [targetMention, setTargetMention] = useState<string>('all');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(() => {
    const validIds = buildDiscussion.selected_agent_ids.filter((id) =>
      customAgents.some((a) => a.id === id)
    );
    if (validIds.length > 0) return validIds;
    return customAgents.map((a) => a.id);
  });

  // Sinkronkan selectedAgentIds saat daftar customAgents berubah
  useEffect(() => {
    setSelectedAgentIds((prev) => {
      const stillExisting = prev.filter((id) => customAgents.some((a) => a.id === id));
      if (stillExisting.length > 0) return stillExisting;
      return customAgents.map((a) => a.id);
    });
  }, [customAgents]);
  const [isAutoLooping, setIsAutoLooping] = useState(false);
  const [isThinkingTurn, setIsThinkingTurn] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [openAgentModelDropdown, setOpenAgentModelDropdown] = useState<string | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [isSquadHeaderCollapsed, setIsSquadHeaderCollapsed] = useState(true);

  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

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

  // Total code snippets produced in discussion
  const detectedCodeItems = extractCodeReviewItems(buildDiscussion.messages);
  const codeSnippetCount = detectedCodeItems.length;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [buildDiscussion.messages, isThinkingTurn]);

  // Close model popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelMenuOpen(false);
      }
      const target = e.target as HTMLElement;
      if (!target.closest('.agent-model-dropdown-container')) {
        setOpenAgentModelDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-run turns if enabled
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAutoLooping && buildDiscussion.status === 'running' && !isThinkingTurn) {
      timer = setTimeout(async () => {
        setIsThinkingTurn(true);
        await advanceDiscussionTurn();
        setIsThinkingTurn(false);
      }, 2500);
    }
    return () => clearTimeout(timer);
  }, [isAutoLooping, buildDiscussion.status, buildDiscussion.current_turn_index, isThinkingTurn]);

  const toggleAgentSelection = (agentId: string) => {
    if (selectedAgentIds.includes(agentId)) {
      if (selectedAgentIds.length <= 2) {
        addToast('warning', 'Minimal harus memilih 2 agent untuk kolaborasi multi-agent!');
        return;
      }
      setSelectedAgentIds((prev) => prev.filter((id) => id !== agentId));
    } else {
      setSelectedAgentIds((prev) => [...prev, agentId]);
    }
  };

  const handleSendChat = async (explicitChat?: string) => {
    const chatText = (explicitChat !== undefined ? explicitChat : chatInput).trim();
    if (!chatText && attachedFiles.length === 0) return;

    const finalContent = formatAttachedPrompt(
      chatText || 'Mohon tinjau file yang saya lampirkan untuk diskusi tim.',
      explicitChat !== undefined ? [] : attachedFiles
    );

    if (isThinkingTurn) {
      if (settings.queuedMessages === 'queue') {
        addQueuedMessage(finalContent);
        if (explicitChat === undefined) {
          setChatInput('');
          setAttachedFiles([]);
        }
        addToast('info', 'Pesan operator dimasukkan ke antrean.');
        return;
      }
    }

    if (explicitChat === undefined) {
      setChatInput('');
      setAttachedFiles([]);
    }
    setIsThinkingTurn(true);

    try {
      const specificAgentId = targetMention === 'all' ? undefined : targetMention;
      await sendOperatorMessage(finalContent, specificAgentId);
    } finally {
      setIsThinkingTurn(false);

      if (
        document.hidden &&
        settings.notifyWhenUnfocused &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        new Notification('Agentic Engine', {
          body: 'Giliran diskusi multi-agent telah selesai.',
        });
      }

      if (settings.queuedMessages === 'queue') {
        const nextChat = processNextQueuedMessage();
        if (nextChat) {
          setTimeout(() => {
            handleSendChat(nextChat);
          }, 100);
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const handleStepNextTurn = async () => {
    if (isThinkingTurn) return;
    setIsThinkingTurn(true);
    try {
      await advanceDiscussionTurn();
    } finally {
      setIsThinkingTurn(false);

      if (settings.queuedMessages === 'queue') {
        const nextChat = processNextQueuedMessage();
        if (nextChat) {
          setTimeout(() => {
            handleSendChat(nextChat);
          }, 100);
        }
      }
    }
  };

  // Hitung giliran berikutnya
  const nextAgentIndex =
    buildDiscussion.selected_agent_ids.length > 0
      ? buildDiscussion.current_turn_index % buildDiscussion.selected_agent_ids.length
      : 0;
  const nextAgentId = buildDiscussion.selected_agent_ids[nextAgentIndex];
  const nextAgent = customAgents.find((a) => a.id === nextAgentId);

  const getStepIcon = (type?: string) => {
    switch (type) {
      case 'proposal':
        return <Lightbulb className="w-3.5 h-3.5 text-blue-400" />;
      case 'implementation':
        return <Code className="w-3.5 h-3.5 text-emerald-400" />;
      case 'critique':
        return <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />;
      case 'operator_directive':
        return <UserCheck className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#212121] overflow-hidden">


      {/* 3. Discussion Stream Messages */}
      <div className={`flex-1 overflow-y-auto p-6 space-y-4 ${convWidthClass} mx-auto w-full`}>
        {buildDiscussion.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#212121] border border-[#303030] flex items-center justify-center text-[#ececec]">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-medium tracking-tight text-[#ececec]">
                {dailyGreeting}
              </h2>
              <p className="text-xs text-[#b4b4b4] max-w-md mt-1.5 leading-relaxed">
                Ketik instruksi, arsitektur, atau target proyek pada kotak input di bawah untuk memulai
                kolaborasi tim multi-agent.
              </p>
            </div>
          </div>
        ) : (
          buildDiscussion.messages.map((msg) => {
            const isSystem = msg.agent_id === 'system';
            const isOperator = msg.agent_id === 'operator';

            if (isSystem) {
              return (
                <div
                  key={msg.id}
                  className="mx-auto max-w-2xl p-3 rounded-xl bg-[#181822] border border-[#2c2c3e] text-xs text-[#a0a0b8] leading-relaxed whitespace-pre-wrap font-mono"
                >
                  {msg.content}
                </div>
              );
            }

            if (isOperator) {
              return (
                <div key={msg.id} className="flex justify-end w-full">
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="max-w-[75%] rounded-2xl rounded-tr-sm bg-[#2f2f2f] border border-[#404040] p-3.5 space-y-1.5 shadow-sm text-right"
                  >
                    <div className="flex items-center justify-end gap-2 pb-1 border-b border-[#383838]">
                      <span className="text-[10px] text-[#707070] font-mono">{msg.timestamp}</span>
                      <span className="text-xs font-semibold text-[#ececec]">Anda</span>
                      <div className="w-5 h-5 rounded-md bg-[#ececec] text-black flex items-center justify-center text-[10px] font-bold">
                        OP
                      </div>
                    </div>

                    <div className="text-xs text-[#ececec] text-left leading-relaxed whitespace-pre-wrap font-normal">
                      {msg.content}
                    </div>
                  </motion.div>
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex justify-start w-full">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="max-w-[80%] rounded-2xl rounded-tl-sm bg-[#262626] border border-[#383838] p-4 space-y-2.5 shadow-sm"
                >
                  {/* Agent Header */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#303030] gap-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: msg.avatar_color }}
                      >
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-[#ececec]">{msg.agent_name}</span>
                        <span className="text-[10px] text-[#b4b4b4] font-mono px-1.5 py-0.2 rounded bg-[#1f1f1f]">
                          {msg.agent_role}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#1f1f1f] text-[9px] text-[#b4b4b4] font-mono uppercase">
                        {getStepIcon(msg.step_type)}
                        <span>{msg.step_type || 'discussion'}</span>
                      </span>
                      <span className="text-[10px] text-[#707070] font-mono">{msg.timestamp}</span>
                    </div>
                  </div>

                  {/* Message Body */}
                  <div className="text-xs text-[#ececec] leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </motion.div>
              </div>
            );
          })
        )}

        {isThinkingTurn && (
          <div className="flex justify-start w-full">
            <div className="max-w-[75%] p-3.5 rounded-2xl rounded-tl-sm bg-[#262626] border border-[#383838] flex items-center gap-3 text-xs text-[#b4b4b4]">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs animate-pulse"
                style={{ backgroundColor: nextAgent?.avatar_color || '#3b82f6' }}
              >
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>
                  <strong>{nextAgent?.name || 'Agent'}</strong> sedang menyusun respons...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Interactive Chat & Directive Dock (Bottom) */}
      <div className="p-4 bg-gradient-to-t from-[#212121] via-[#212121] to-transparent shrink-0">
        <div className={`${convWidthClass} mx-auto w-full space-y-2`}>
          {/* Queued Messages Indicator */}
          {queuedMessagesBuffer.length > 0 && (
            <div className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-[#282828] border border-[#383838] text-xs text-[#b4b4b4]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="font-medium text-[#ececec]">
                  Antrean Pesan Operator ({queuedMessagesBuffer.length}):
                </span>
                <span className="truncate max-w-xs text-[#b4b4b4]">
                  &quot;{queuedMessagesBuffer[0]}&quot;
                </span>
              </div>
              <span className="text-[11px] text-[#707070]">Diproses berurutan</span>
            </div>
          )}

          {/* Main Input Capsule */}
          <div className="relative rounded-3xl bg-[#2f2f2f] border border-[#383838] p-2.5 px-3.5 focus-within:border-[#4f4f4f] transition-colors">
            {/* Squad Room Header Bar & Quick Controls (Moved inside chat dock) */}
            <div className={`space-y-1.5 ${isSquadHeaderCollapsed ? 'pb-1 mb-1' : 'pb-2 mb-1.5'} border-b border-[#383838]`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsSquadHeaderCollapsed(!isSquadHeaderCollapsed)}
                  className="flex items-center gap-2 text-xs font-semibold text-[#ececec] hover:text-white transition-colors group"
                  title={isSquadHeaderCollapsed ? 'Tampilkan Pengaturan Tim' : 'Sembunyikan Pengaturan Tim'}
                >
                  <Users className="w-4 h-4 text-[#ececec]" />
                  <span>
                    Multi-Agent Squad Room ({selectedAgentIds.length} Agen Aktif)
                  </span>
                  <span className="p-0.5 rounded text-[#707070] group-hover:text-[#ececec] transition-transform">
                    {isSquadHeaderCollapsed ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronUp className="w-3.5 h-3.5" />
                    )}
                  </span>
                </button>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {buildDiscussion.status === 'running' && (
                    <>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
                        Sesi Berjalan
                      </span>
                      <button
                        onClick={handleStepNextTurn}
                        disabled={isThinkingTurn}
                        title="Minta agen giliran berikutnya berbicara"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#212121] hover:bg-[#282828] text-xs font-medium text-[#ececec] border border-[#303030] transition-colors disabled:opacity-50"
                      >
                        <ChevronRight className={`w-3.5 h-3.5 ${isThinkingTurn ? 'animate-spin' : ''}`} />
                        <span>{isThinkingTurn ? 'Berpikir...' : 'Lanjut'}</span>
                      </button>

                      <button
                        onClick={() => setIsAutoLooping(!isAutoLooping)}
                        title="Mode diskusi otomatis tanpa klik manual"
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          isAutoLooping
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-[#212121] border-[#303030] text-[#b4b4b4] hover:text-[#ececec]'
                        }`}
                      >
                        {isAutoLooping ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        <span>{isAutoLooping ? 'Auto: ON' : 'Auto: OFF'}</span>
                      </button>

                      <button
                        onClick={() => setCodeReviewModalOpen(true)}
                        title="Review dan terapkan hasil kode yang telah dibuat agen"
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          codeSnippetCount > 0
                            ? 'bg-[#212121] border-[#404040] text-white hover:bg-[#282828]'
                            : 'bg-[#212121] border-[#303030] text-[#b4b4b4] hover:text-[#ececec]'
                        }`}
                      >
                        <FileCode className="w-3.5 h-3.5 text-[#ececec]" />
                        <span>Review</span>
                        {codeSnippetCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#ececec] text-black font-semibold">
                            {codeSnippetCount}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setIsAutoLooping(false);
                          resetBuildDiscussion();
                        }}
                        title="Reset Percakapan Tim"
                        className="p-1 rounded-lg bg-[#212121] hover:bg-[#282828] border border-[#303030] text-[#b4b4b4] hover:text-red-400 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Collapsible squad member pills */}
              {!isSquadHeaderCollapsed && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                  {customAgents.length === 0 ? (
                    <span className="text-xs text-[#707070] italic">
                      Belum ada agent. Buka mode Agent untuk membuat agen baru.
                    </span>
                  ) : (
                    customAgents.map((agent) => {
                      const isSelected = selectedAgentIds.includes(agent.id);
                      const activeModelName = agent.model || selectedModel || 'Default';

                      return (
                        <div
                          key={agent.id}
                          className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border text-xs font-medium transition-colors shrink-0 ${
                            isSelected
                              ? 'bg-[#212121] border-[#404040] text-white'
                              : 'bg-[#212121]/60 border-[#303030] text-[#707070] hover:text-[#b4b4b4]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleAgentSelection(agent.id)}
                            className="flex items-center gap-1.5 focus:outline-none"
                            title={isSelected ? 'Klik untuk menonaktifkan agen dari tim' : 'Klik untuk mengaktifkan agen'}
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: agent.avatar_color }}
                            />
                            <span>{agent.name}</span>
                          </button>

                          {/* Dropdown pemilih model khusus agen ini */}
                          <div className="relative agent-model-dropdown-container">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenAgentModelDropdown(
                                  openAgentModelDropdown === agent.id ? null : agent.id
                                );
                              }}
                              className="flex items-center gap-1 bg-[#171717] hover:bg-[#212121] text-[#ececec] border border-[#383838] rounded-lg px-2 py-0.5 text-[10px] font-mono transition-colors max-w-[130px]"
                              title={`Model aktif: ${activeModelName}. Klik untuk memilih model.`}
                            >
                              <span className="truncate">
                                {agent.model
                                  ? agent.model.split('/').pop()
                                  : `Global (${selectedModel ? selectedModel.split('/').pop() : 'Default'})`}
                              </span>
                              <ChevronDown className="w-2.5 h-2.5 text-[#707070] shrink-0" />
                            </button>

                            {openAgentModelDropdown === agent.id && (
                              <div className="absolute bottom-full left-0 mb-1 w-64 max-h-56 overflow-y-auto rounded-xl bg-[#262626] border border-[#383838] p-1.5 z-50 shadow-2xl space-y-1">
                                <div className="px-2 py-1 text-[10px] text-[#707070] border-b border-[#303030] font-sans">
                                  Pilih Model untuk {agent.name}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateCustomAgent(agent.id, { model: undefined });
                                    setOpenAgentModelDropdown(null);
                                    addToast('info', `Model untuk ${agent.name}: Mengikuti Model Global`);
                                  }}
                                  className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-mono flex items-center justify-between transition-colors ${
                                    !agent.model
                                      ? 'bg-[#2f2f2f] text-white'
                                      : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-[#ececec]'
                                  }`}
                                >
                                  <span className="truncate">
                                    (Global: {selectedModel || 'Belum dipilih'})
                                  </span>
                                  {!agent.model && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                                </button>

                                {availableModels.map((m) => {
                                  const isCur = agent.model === m.id;
                                  return (
                                    <button
                                      key={`${m.endpoint_id || m.provider}-${m.id}`}
                                      type="button"
                                      onClick={() => {
                                        updateCustomAgent(agent.id, { model: m.id });
                                        setOpenAgentModelDropdown(null);
                                        addToast('info', `Model untuk ${agent.name}: ${m.id}`);
                                      }}
                                      className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-mono flex items-center justify-between transition-colors ${
                                        isCur
                                          ? 'bg-[#2f2f2f] text-white'
                                          : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-[#ececec]'
                                      }`}
                                    >
                                      <span className="truncate">
                                        {m.endpoint_name ? `[${m.endpoint_name}] ${m.id}` : m.id}
                                      </span>
                                      {isCur && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Active Project Goal Badge (if running) */}
              {buildDiscussion.status === 'running' && buildDiscussion.project_goal && (
                <div className="px-2.5 py-1 rounded-lg bg-[#212121] border border-[#383838] text-[11px] text-[#b4b4b4] flex items-center justify-between">
                  <span className="truncate">
                    <strong className="text-[#ececec]">Goal:</strong> {buildDiscussion.project_goal}
                  </span>
                  <span className="text-[10px] font-mono text-[#707070] shrink-0 ml-2">
                    Putaran {buildDiscussion.current_turn_index + 1}
                  </span>
                </div>
              )}
            </div>

            {/* Attachment Preview Chips */}
            <AttachmentChips
              files={attachedFiles}
              onRemove={(id) => setAttachedFiles((prev) => prev.filter((f) => f.id !== id))}
              className="mb-1.5"
            />

            <textarea
              ref={chatTextareaRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                buildDiscussion.status === 'running'
                  ? 'Beri arahan, tanyakan sesuatu, atau minta kode ke tim agent...'
                  : 'Ketik pesan atau target proyek untuk memulai diskusi tim...'
              }
              rows={1}
              className="w-full bg-transparent border-none text-[#ececec] placeholder-[#707070] text-sm focus:outline-none resize-none px-2 py-0.5 leading-relaxed font-sans min-h-[28px] max-h-40"
            />

            {/* Inner Bottom Actions Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-[#383838] mt-1 flex-wrap gap-2">
              {/* Left: Plus button, Mention Target, & Approval Toggle */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Unggah file dari direktori lokal"
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                    attachedFiles.length > 0
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : 'bg-[#212121] hover:bg-[#262626] border-[#383838] text-[#ececec] hover:text-white'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Target Mention Select Pill (Harmonized h-8, matching border & bg) */}
                <CustomSelect
                  value={targetMention}
                  options={[
                    { value: 'all', label: 'Semua Tim' },
                    ...customAgents
                      .filter((a) => selectedAgentIds.includes(a.id))
                      .map((agent) => ({
                        value: agent.id,
                        label: `@${agent.name}`,
                      })),
                  ]}
                  onChange={(val) => setTargetMention(val)}
                  direction="up"
                  align="left"
                  icon={<AtSign className="w-3.5 h-3.5 text-[#b4b4b4]" />}
                  buttonClassName="h-8 rounded-full bg-[#212121] hover:bg-[#262626] border-[#383838] px-3"
                />

                {/* Approval Mode Toggle: Ask for approval vs Strict (Harmonized h-8) */}
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
                {/* Model Selector Pill Dropdown (Harmonized h-8) */}
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
                      {selectedModel || (availableModels.length === 0 ? 'Atur API Key' : 'Pilih Model')}
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

                {/* Mic Icon (Harmonized h-8 w-8) */}
                <button
                  type="button"
                  title="Voice input (segera hadir)"
                  className="w-8 h-8 rounded-full hover:bg-[#383838] text-[#b4b4b4] hover:text-[#ececec] flex items-center justify-center transition-colors shrink-0"
                >
                  <Mic className="w-4 h-4" />
                </button>

                {/* Iconic Send Button (Harmonized h-8 w-8) */}
                <button
                  onClick={() => handleSendChat()}
                  disabled={!chatInput.trim() && attachedFiles.length === 0}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                    chatInput.trim() || attachedFiles.length > 0
                      ? 'bg-[#ececec] text-[#171717] hover:bg-white'
                      : 'bg-[#383838] text-[#707070] cursor-not-allowed'
                  }`}
                  title={
                    isThinkingTurn && settings.queuedMessages === 'queue'
                      ? 'Masukkan pesan operator ke antrean [Enter]'
                      : 'Kirim pesan [Enter]'
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
  );
};

export default MultiAgentDiscussion;
