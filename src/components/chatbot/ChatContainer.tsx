import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Globe,
  Paperclip,
  Copy,
  Check,
  Bot,
  Trash2,
  ChevronRight,
  ChevronDown,
  RotateCw,
  Search,
  Sparkles,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ChatMessage } from '../../types';
import { EmptyState } from '../common/EmptyState';
import {
  parseRobustJson,
  getChatEndpoint,
  formatApiErrorMessage,
  isModelActive,
  isModelUnavailable,
  getModelCategory,
  resolveEndpointForModel,
} from '../../utils/api';
import { preparePrunedContextMessages } from '../../utils/contextManager';
import { SlashCommandPopover, SLASH_COMMANDS, SlashCommandItem } from '../common/SlashCommandPopover';
import { getConversationWidthClass } from '../../utils/layout';

// Formatted Code and Text component
const FormattedMessage: React.FC<{ content: string; reasoning?: string; verbose?: boolean }> = ({
  content,
  reasoning,
  verbose = true,
}) => {
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);

  const parts = content.split(/(```[\s\S]*?```)/g);

  const handleCopyCode = (codeText: string, index: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  return (
    <div className="space-y-3 leading-relaxed text-sm">
      {reasoning && (
        <details
          key={String(verbose)}
          open={verbose}
          className="mb-3 p-3 rounded-xl bg-[#262626] border border-[#303030] text-xs text-[#b4b4b4] group"
        >
          <summary className="cursor-pointer font-medium text-xs text-[#b4b4b4] hover:text-[#ececec] select-none flex items-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
            <span>Proses Berpikir Model ({reasoning.length} karakter)</span>
          </summary>
          <div className="mt-2 pt-2 border-t border-[#303030] text-[11px] font-mono whitespace-pre-wrap text-[#9e9ea7] max-h-48 overflow-y-auto">
            {reasoning}
          </div>
        </details>
      )}

      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : 'code';
          const codeBody = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <div
              key={index}
              className="my-3 rounded-xl overflow-hidden border border-[#303030] bg-[#171717]"
            >
              <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#212121] border-b border-[#303030] text-xs">
                <span className="font-mono text-[#b4b4b4] text-[11px] lowercase">
                  {lang}
                </span>
                <button
                  onClick={() => handleCopyCode(codeBody, index)}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg hover:bg-[#2f2f2f] text-[#b4b4b4] hover:text-[#ececec] transition-colors text-[11px]"
                >
                  {copiedCodeIndex === index ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 overflow-x-auto text-xs font-mono text-[#ececec] leading-relaxed bg-[#171717]">
                <code>{codeBody}</code>
              </pre>
            </div>
          );
        }

        return (
          <div key={index} className="space-y-2 whitespace-pre-wrap">
            {part.split('\n\n').map((paragraph, pIdx) => {
              if (!paragraph.trim()) return null;
              return (
                <p key={pIdx} className="text-[#ececec]">
                  {paragraph}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export const ChatContainer: React.FC = () => {
  const {
    messages,
    addMessage,
    sessions,
    activeSessionId,
    createNewSession,
    saveChatMessageToDb,
    updateSessionTitle,
    selectedModel,
    setModel,
    availableModels,
    isDetectingModels,
    fetchAvailableModels,
    apiKeys,
    setMessages,
    addToast,
    addLog,
    setSkillsModalOpen,
    setSettingsOpen,
    isContextCompressed,
    contextUsagePercent,
    setContextCompressed,
    setContextUsagePercent,
    settings,
    queuedMessagesBuffer,
    addQueuedMessage,
    processNextQueuedMessage,
    pendingPlanApproval,
    setPendingPlanApproval,
    resolvePlanApproval,
  } = useStore();

  const convWidthClass = getConversationWidthClass(settings?.conversationWidth);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isWebSearchActive, setIsWebSearchActive] = useState(false);
  const [hasContextAttached, setHasContextAttached] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Slash Command Autocomplete State
  const [isSlashOpen, setIsSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);

  // Model Selector Popover State
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [modelCategoryFilter, setModelCategoryFilter] = useState<'all' | 'gemini' | 'claude' | 'openrouter' | 'other'>('all');
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({});
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  const currentMessages = messages.filter(
    (m) => !activeSessionId || m.session_id === activeSessionId
  );

  // Auto-fetch models on component mount if empty
  useEffect(() => {
    if (availableModels.length === 0) {
      fetchAvailableModels();
    }
  }, []);

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

  // Filtered models by search query and category, with active models prioritized
  const filteredModels = availableModels
    .filter((m) => {
      const matchSearch = m.id.toLowerCase().includes(modelSearchQuery.toLowerCase());
      if (!matchSearch) return false;
      if (modelCategoryFilter === 'all') return true;
      const cat = getModelCategory(m.id);
      return cat === modelCategoryFilter;
    })
    .sort((a, b) => {
      const aActive = isModelActive(a.id);
      const bActive = isModelActive(b.id);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return 0;
    });

  const handleSelectModel = (modelId: string) => {
    setModel(modelId);
    setIsModelMenuOpen(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Handle slash command keyboard navigation & detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputPrompt(val);

    const match = val.match(/^\/([a-zA-Z0-9_-]*)$/);
    if (match) {
      setIsSlashOpen(true);
      setSlashFilter(match[1]);
      setSlashIndex(0);
    } else {
      setIsSlashOpen(false);
    }
  };

  const executeSlashCommand = (cmd: SlashCommandItem) => {
    setIsSlashOpen(false);

    if (cmd.type === 'action') {
      if (cmd.id === 'skills') {
        setSkillsModalOpen(true);
        setInputPrompt('');
      } else if (cmd.id === 'clear') {
        if (activeSessionId) {
          setMessages(messages.filter((m) => m.session_id !== activeSessionId));
          addToast('info', 'Percakapan berhasil dibersihkan.');
        }
        setInputPrompt('');
      }
      return;
    }

    if (cmd.actionText) {
      setInputPrompt(cmd.actionText + ' ');
      setTimeout(() => promptInputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashOpen) {
      const query = slashFilter.toLowerCase().replace(/^\//, '');
      const filtered = SLASH_COMMANDS.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(query) ||
          cmd.description.toLowerCase().includes(query)
      );

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((prev) =>
          prev === 0 ? Math.max(0, filtered.length - 1) : prev - 1
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filtered[slashIndex]) {
          executeSlashCommand(filtered[slashIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        setIsSlashOpen(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async (explicitText?: string) => {
    const rawText = (explicitText !== undefined ? explicitText : inputPrompt).trim();
    if (!rawText) return;

    if (isGenerating) {
      if (settings.queuedMessages === 'queue') {
        addQueuedMessage(rawText);
        if (explicitText === undefined) {
          setInputPrompt('');
          setIsSlashOpen(false);
        }
        addToast('info', 'Pesan ditambahkan ke antrean.');
        return;
      }
    }

    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
      targetSessionId = createNewSession();
    }

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      session_id: targetSessionId,
      role: 'user',
      content: rawText,
      created_at: new Date().toISOString(),
      token_count: Math.ceil(rawText.length / 4),
    };

    addMessage(userMsg);
    saveChatMessageToDb(userMsg);

    // Update judul sesi jika masih default "Obrolan Baru"
    const currentSession = sessions.find((s) => s.id === targetSessionId);
    if (!currentSession || currentSession.title === 'Obrolan Baru') {
      const summaryTitle = userMsg.content.slice(0, 32) + (userMsg.content.length > 32 ? '...' : '');
      updateSessionTitle(targetSessionId, summaryTitle);
    }

    if (explicitText === undefined) {
      setInputPrompt('');
      setIsSlashOpen(false);
    }
    setIsGenerating(true);

    const endpointConfig = resolveEndpointForModel(selectedModel, availableModels, apiKeys);

    if (!endpointConfig.apiKey.trim()) {
      addToast('error', 'API Key belum diatur. Buka menu Setting di sidebar untuk mengisi kunci.');
      setIsGenerating(false);
      return;
    }

    if (!selectedModel.trim()) {
      addToast('error', 'Belum ada model AI yang dipilih. Pastikan API Key aktif dan pilih model di dock bawah.');
      setIsGenerating(false);
      return;
    }

    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      session_id: targetSessionId,
      role: 'assistant',
      content: '',
      reasoning: '',
      created_at: new Date().toISOString(),
    };
    addMessage(initialAssistantMsg);

    try {
      const {
        messages: prunedMessages,
        isCompressed,
        usagePercent,
      } = preparePrunedContextMessages(
        currentMessages,
        userMsg.content,
        selectedModel,
        availableModels
      );

      setContextCompressed(isCompressed);
      setContextUsagePercent(usagePercent);

      const requestPayload = {
        model: selectedModel,
        messages: prunedMessages,
        stream: true,
        temperature: 0.7,
      };

      const chatUrl = getChatEndpoint(endpointConfig.baseUrl);
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${endpointConfig.apiKey}`,
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const formattedErr = formatApiErrorMessage(
          response.status,
          errorText,
          selectedModel
        );
        throw new Error(formattedErr);
      }

      if (!response.body) {
        throw new Error('Respons tidak memiliki body stream.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedContent = '';
      let accumulatedReasoning = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = parseRobustJson(dataStr);
            const delta = parsed?.choices?.[0]?.delta;
            if (delta) {
              if (delta.reasoning_content) {
                accumulatedReasoning += delta.reasoning_content;
              }
              if (delta.content) {
                accumulatedContent += delta.content;
              }

              useStore.setState((state) => ({
                messages: state.messages.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: accumulatedContent,
                        reasoning: accumulatedReasoning,
                        token_count: Math.ceil(
                          (accumulatedContent.length + accumulatedReasoning.length) / 4
                        ),
                      }
                    : m
                ),
              }));
            }
          } catch {
            // Abaikan parsing line yang tidak lengkap
          }
        }
      }

      if (!accumulatedContent && !accumulatedReasoning) {
        accumulatedContent = 'Respons selesai tanpa konten tertulis.';
        useStore.setState((state) => ({
          messages: state.messages.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: accumulatedContent }
              : m
          ),
        }));
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Chat error:', errorMsg);
      addToast('error', 'Gagal mendapatkan respon AI');

      useStore.setState((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: `**Terjadi kendala saat menghubungi model:**\n\n${errorMsg}`,
              }
            : m
        ),
      }));
    } finally {
      setIsGenerating(false);
      // Simpan pesan asisten yang telah selesai ke database SQLite
      const finalMsg = useStore.getState().messages.find((m) => m.id === assistantMsgId);
      if (finalMsg && (finalMsg.content || finalMsg.reasoning)) {
        saveChatMessageToDb(finalMsg);
      }

      // Check planReviewPolicy when /plan command runs
      const isPlan = userMsg.content.trim().startsWith('/plan');
      if (isPlan) {
        const finalContent = finalMsg?.content || '';
        if (settings.planReviewPolicy === 'always_ask') {
          setPendingPlanApproval({
            id: `plan-${Date.now()}`,
            title: userMsg.content.replace(/^\/plan\s*/, '').slice(0, 40) || 'Implementation Plan',
            planContent: finalContent,
            status: 'pending',
            createdAt: new Date().toISOString(),
          });
          addToast('info', 'Rencana arsitektur dibuat. Menunggu persetujuan operator.');
        } else {
          addToast('success', 'Rencana disetujui otomatis sesuai kebijakan never_ask.');
          addLog({
            id: `plan-auto-${Date.now()}`,
            agent_name: 'Engine',
            level: 'INFO',
            message: `Plan policy is never_ask. Automatically approved plan: ${userMsg.content.slice(0, 40)}`,
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
          body: isPlan ? 'Rencana arsitektur siap ditinjau.' : 'Respons model telah selesai.',
        });
      }

      // Auto-trigger next queued message if settings.queuedMessages === 'queue'
      if (settings.queuedMessages === 'queue') {
        const nextMsg = processNextQueuedMessage();
        if (nextMsg) {
          setTimeout(() => {
            handleSendMessage(nextMsg);
          }, 100);
        }
      }
    }
  };

  const handleClearChat = () => {
    if (activeSessionId) {
      setMessages(messages.filter((m) => m.session_id !== activeSessionId));
      addToast('info', 'Percakapan berhasil dibersihkan.');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#212121] overflow-hidden">
      {/* Top Session Bar */}
      <div className="h-10 px-6 bg-[#212121] border-b border-[#262626] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-xs text-[#ececec]">
          <span className="font-medium truncate max-w-sm">
            {activeSessionId
              ? useStore.getState().sessions.find((s) => s.id === activeSessionId)?.title || 'Percakapan'
              : 'Percakapan Baru'}
          </span>
          <span className="text-[#707070]">•</span>
          <span className="text-[11px] font-mono text-[#b4b4b4] truncate max-w-[200px]">
            {selectedModel}
          </span>
        </div>

        <button
          onClick={handleClearChat}
          title="Bersihkan pesan di sesi ini"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-[#b4b4b4] hover:text-red-400 hover:bg-[#282828] border border-[#303030] transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          <span>Bersihkan</span>
        </button>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {currentMessages.length === 0 ? (
          <EmptyState
            title="Mulai Percakapan Baru"
            description="Ketik pesan untuk berinteraksi dengan AI, atau gunakan '/' untuk melihat jalan pintas perintah."
            actionLabel="Buka Studio"
            onAction={() => useStore.getState().setMode('build')}
            className="my-auto pt-16"
          />
        ) : (
          currentMessages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${convWidthClass} mx-auto w-full ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-[#2f2f2f] border border-[#383838] flex items-center justify-center text-[#ececec] shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className={`space-y-1 ${isUser ? 'max-w-[85%] items-end' : 'flex-1 min-w-0'}`}>
                  {/* Bubble / Stream content */}
                  {isUser ? (
                    <div className="p-3.5 px-4 rounded-2xl bg-[#2f2f2f] border border-[#383838] text-[#ececec]">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="text-[#ececec] py-1">
                      <FormattedMessage
                        content={msg.content}
                        reasoning={msg.reasoning}
                        verbose={settings.verboseAgentChat}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isGenerating && (
          <div className={`flex gap-3.5 ${convWidthClass} mx-auto w-full justify-start items-center`}>
            <div className="w-7 h-7 rounded-full bg-[#2f2f2f] border border-[#383838] flex items-center justify-center text-[#ececec] shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="py-2 flex items-center gap-2 text-xs text-[#b4b4b4]">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Memproses respons...</span>
            </div>
          </div>
        )}

        {pendingPlanApproval && (
          <div
            className={`p-4 rounded-2xl bg-[#1e222d] border border-blue-500/40 text-xs text-[#ececec] space-y-3 ${convWidthClass} mx-auto w-full`}
          >
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-blue-200 uppercase tracking-wide text-[11px] block">
                  Plan Review Required (HITL)
                </span>
                <span className="font-medium text-[#ececec] block">
                  {pendingPlanApproval.title}
                </span>
                <p className="text-[11px] text-[#b4b4b4]">
                  Kebijakan peninjauan rencana saat ini adalah always_ask. Berikan persetujuan untuk mengeksekusi rencana arsitektur ini.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2a3040]">
              <button
                type="button"
                onClick={() => resolvePlanApproval(false)}
                className="px-3 py-1.5 rounded-xl border border-[#404040] hover:bg-[#282828] text-xs font-medium text-[#b4b4b4] hover:text-[#ececec] transition-colors"
              >
                Tolak Rencana
              </button>
              <button
                type="button"
                onClick={() => {
                  const title = pendingPlanApproval.title;
                  resolvePlanApproval(true);
                  handleSendMessage(`Lanjutkan eksekusi rencana arsitektur: "${title}".`);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
              >
                Setujui dan Eksekusi
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Prompt Input Dock with Integrated Model Selector Inside */}
      <div className="p-4 bg-transparent shrink-0">
        <div className={`${convWidthClass} mx-auto w-full space-y-2`}>
          {/* Queued Messages Indicator */}
          {queuedMessagesBuffer.length > 0 && (
            <div className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-[#282828] border border-[#383838] text-xs text-[#b4b4b4]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="font-medium text-[#ececec]">
                  Antrean Pesan ({queuedMessagesBuffer.length}):
                </span>
                <span className="truncate max-w-xs text-[#b4b4b4]">
                  &quot;{queuedMessagesBuffer[0]}&quot;
                </span>
              </div>
              <span className="text-[11px] text-[#707070]">Diproses berurutan</span>
            </div>
          )}
          {/* Context Thresholding & Pruning Notice Banner */}
          {isContextCompressed && (
            <div className="px-3.5 py-2 rounded-2xl bg-[#2a2415] border border-[#784e12] flex items-center justify-between gap-3 text-xs text-[#fde047] animate-fadeIn">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#facc15]" />
                <span className="truncate">
                  Kapasitas konteks mencapai batas ({contextUsagePercent}%). Pesan terlama telah diringkas, kualitas ingatan topik lama kemungkinan menurun.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => createNewSession()}
                  className="px-2.5 py-1 rounded-lg bg-[#3a301a] hover:bg-[#4a3d20] border border-[#784e12] text-[#fef08a] font-medium transition-colors text-[11px]"
                >
                  Chat Baru
                </button>
                <button
                  type="button"
                  onClick={() => setContextCompressed(false)}
                  className="text-[#a16207] hover:text-[#fde047] transition-colors p-1"
                  title="Tutup Peringatan"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ChatGPT Capsule Prompt Input Container with Integrated Model Selector & Slash Command Popover */}
          <div className="relative rounded-3xl bg-[#2f2f2f] border border-[#383838] p-2.5 px-3.5 focus-within:border-[#4f4f4f] transition-colors">
            {isSlashOpen && (
              <SlashCommandPopover
                filter={slashFilter}
                selectedIndex={slashIndex}
                onSelect={executeSlashCommand}
                onClose={() => setIsSlashOpen(false)}
              />
            )}

            <textarea
              ref={promptInputRef}
              value={inputPrompt}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Kirim pesan ke AI atau ketik '/' untuk perintah..."
              rows={1}
              className="w-full bg-transparent border-none text-[#ececec] placeholder-[#707070] text-sm focus:outline-none resize-none px-2 py-0.5 leading-relaxed font-sans min-h-[28px] max-h-40"
            />

            <div className="flex items-center justify-between pt-2 border-t border-[#383838] mt-1">
              {/* Left Action Buttons: Integrated Model Selector Pill, Cari, Lampirkan */}
              <div className="flex items-center gap-1.5 relative" ref={modelMenuRef}>
                {/* Integrated Model Selector Pill */}
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
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono transition-all group ${
                      availableModels.length === 0
                        ? 'bg-[#212121] border-[#383838] text-[#707070] hover:text-[#b4b4b4] hover:border-[#4f4f4f]'
                        : 'bg-[#212121] hover:bg-[#262626] border-[#383838] text-[#ececec]'
                    }`}
                    title={availableModels.length === 0 ? 'Klik untuk mengatur API Key di Pengaturan' : 'Pilih Model AI'}
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${availableModels.length === 0 ? 'text-[#707070]' : 'text-[#ececec]'}`} />
                    <span className="max-w-[160px] truncate font-medium">
                      {selectedModel || (availableModels.length === 0 ? 'Atur API Key' : 'Pilih Model')}
                    </span>
                    {availableModels.length > 0 && (
                      <ChevronDown className="w-3 h-3 text-[#b4b4b4] group-hover:text-[#ececec] transition-transform" />
                    )}
                  </button>

                  {/* Model Selector Popover */}
                  {isModelMenuOpen && availableModels.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-2 w-80 max-h-96 rounded-2xl bg-[#262626] border border-[#383838] p-2.5 z-50 flex flex-col space-y-2 shadow-2xl">
                      <div className="flex items-center justify-between px-1 pb-1 border-b border-[#303030] text-xs">
                        <span className="font-semibold text-[#ececec]">Model Tersedia</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#b4b4b4] font-mono">
                            {filteredModels.length} model
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

                      {/* Category filter pills */}
                      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] no-scrollbar">
                        {[
                          { id: 'all', label: 'Semua' },
                          { id: 'gemini', label: 'Gemini' },
                          { id: 'claude', label: 'Claude' },
                          { id: 'openrouter', label: 'OpenRouter' },
                          { id: 'other', label: 'Lainnya' },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setModelCategoryFilter(cat.id as any)}
                            className={`px-2 py-0.5 rounded-lg font-medium transition-colors shrink-0 ${
                              modelCategoryFilter === cat.id
                                ? 'bg-[#383838] text-white font-semibold'
                                : 'text-[#888888] hover:text-[#ececec] hover:bg-[#2a2a2a]'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Scrollable Model List grouped by Endpoint with Accordion */}
                      <div className="flex-1 overflow-y-auto max-h-64 space-y-2 pr-1">
                        {filteredModels.length === 0 ? (
                          <div className="p-4 text-center text-xs text-[#b4b4b4]">
                            {availableModels.length === 0
                              ? 'Belum ada model terdeteksi dari endpoint API.'
                              : 'Tidak ada model yang cocok dengan filter atau pencarian.'}
                          </div>
                        ) : (
                          // Kelompokkan model berdasarkan endpoint_name
                          Object.entries(
                            filteredModels.reduce((acc, m) => {
                              const groupName = m.endpoint_name || 'Custom Endpoint';
                              if (!acc[groupName]) acc[groupName] = [];
                              acc[groupName].push(m);
                              return acc;
                            }, {} as Record<string, typeof filteredModels>)
                          ).map(([groupName, groupModels]) => {
                            const isExpanded = expandedEndpoints[groupName] ?? true;
                            const hasActiveModelInGroup = groupModels.some((m) => m.id === selectedModel);

                            return (
                              <div key={groupName} className="rounded-xl border border-[#303030] bg-[#1f1f1f] overflow-hidden">
                                {/* Group Header Accordion Button */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedEndpoints((prev) => ({
                                      ...prev,
                                      [groupName]: !isExpanded,
                                    }))
                                  }
                                  className="w-full px-3 py-1.5 flex items-center justify-between text-left bg-[#252525] hover:bg-[#2a2a2a] transition-colors border-b border-[#303030]/60"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <ChevronDown
                                      className={`w-3.5 h-3.5 text-[#b4b4b4] transition-transform ${
                                        isExpanded ? 'rotate-0' : '-rotate-90'
                                      }`}
                                    />
                                    <span className="text-xs font-semibold text-[#ececec] truncate">
                                      {groupName}
                                    </span>
                                    {hasActiveModelInGroup && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono text-[#707070] shrink-0">
                                    {groupModels.length} model
                                  </span>
                                </button>

                                {/* Group Model Items */}
                                {isExpanded && (
                                  <div className="p-1 space-y-0.5">
                                    {groupModels.map((m) => {
                                      const isSelected = m.id === selectedModel;
                                      const isActive = isModelActive(m.id);
                                      const isUnavailable = isModelUnavailable(m.id);

                                      return (
                                        <button
                                          key={m.id}
                                          onClick={() => handleSelectModel(m.id)}
                                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                            isSelected
                                              ? 'bg-[#2f2f2f] text-white border border-[#404040]'
                                              : 'hover:bg-[#252525] text-[#b4b4b4] hover:text-[#ececec]'
                                          }`}
                                        >
                                          <div className="truncate pr-2 flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-mono text-[11px] font-medium truncate">{m.id}</span>
                                              {isActive && (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-sans font-medium rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                                                  <Check className="w-2.5 h-2.5" />
                                                  <span>Aktif</span>
                                                </span>
                                              )}
                                              {isUnavailable && (
                                                <span
                                                  className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-sans font-medium rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0"
                                                  title="Model ini offline atau error dari upstream"
                                                >
                                                  <AlertTriangle className="w-2.5 h-2.5" />
                                                  <span>Offline</span>
                                                </span>
                                              )}
                                            </div>
                                            {m.context_length && (
                                              <div className="text-[9px] text-[#707070]">
                                                Context: {m.context_length.toLocaleString()} tokens
                                              </div>
                                            )}
                                          </div>
                                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsWebSearchActive(!isWebSearchActive)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    isWebSearchActive
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#383838]'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Cari</span>
                </button>

                <button
                  type="button"
                  onClick={() => setHasContextAttached(!hasContextAttached)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    hasContextAttached
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#383838]'
                  }`}
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Lampirkan</span>
                </button>
              </div>

              {/* ChatGPT Iconic Round Arrow Send Button */}
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputPrompt.trim() || isGenerating}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  inputPrompt.trim() && !isGenerating
                    ? 'bg-[#ececec] text-black hover:bg-white'
                    : 'bg-[#404040] text-[#707070] cursor-not-allowed'
                }`}
                title="Kirim pesan [Enter]"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatContainer;
