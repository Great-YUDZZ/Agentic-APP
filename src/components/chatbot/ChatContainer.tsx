import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Globe,
  Paperclip,
  Check,
  ChevronDown,
  RotateCw,
  Search,
  Sparkles,
  AlertTriangle,
  X,
  Cpu,
  Mic,
  Square,
  Loader2,
  GitBranch,
  KeyRound,
  SlidersHorizontal,
  Copy,
  RotateCcw,
  Pencil,
} from 'lucide-react';
import { useVoiceRecorder } from '../../utils/audioRecorder';
import { useStore } from '../../store/useStore';
import { ChatMessage, AttachedFile, CodeChunkMatch } from '../../types';
import { EmptyState } from '../common/EmptyState';
import { AttachmentChips } from '../common/AttachmentChips';
import { processSelectedFiles, formatAttachedPrompt, pickNativeFiles } from '../../utils/fileUpload';
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
import { FormattedMessage } from '../common/FormattedMessage';
import { AgentMascot } from '../mascot/AgentMascot';

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
    isContextCompressed,
    contextUsagePercent,
    setContextCompressed,
    setContextUsagePercent,
    settings,
    isStreaming,
    setIsStreaming,
    isWorking,
    queuedMessagesBuffer,
    addQueuedMessage,
    processNextQueuedMessage,
    pendingPlanApproval,
    setPendingPlanApproval,
    resolvePlanApproval,
    forkSessionFromMessage,
    setLastTelemetry,
    selectSession,
    setSettingsOpen,
  } = useStore();

  const convWidthClass = getConversationWidthClass(settings?.conversationWidth);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isWebSearchActive, setIsWebSearchActive] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const res = await processSelectedFiles(files);
    if (res.error) {
      addToast('warning', res.error);
    }
    if (res.files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...res.files]);
      addToast('success', `${res.files.length} file berhasil dilampirkan.`);
    }
  };

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
          setInputPrompt(combined);
          addToast('success', `Suara berhasil ditranskripsi (${transcribedText.slice(0, 35)}...)`, 3000);
        }
      } catch (err: any) {
        addToast('error', `Gagal mentranskripsi suara: ${err?.message || err}`, 5000);
      }
    } else {
      try {
        preVoicePromptRef.current = inputPrompt;
        await startVoiceRecording({
          language: settings?.voiceInputLanguage || 'id',
          onInterimText: (interim) => {
            const base = preVoicePromptRef.current.trim();
            const combined = base ? `${base} ${interim}` : interim;
            setInputPrompt(combined);
          },
        });
      } catch (err: any) {
        addToast('error', `Gagal mengakses mikrofon: ${err?.message || err}`, 5000);
      }
    }
  };

  const handleCancelVoice = () => {
    cancelVoiceRecording();
    setInputPrompt(preVoicePromptRef.current);
  };

  const currentMessages = activeSessionId
    ? messages.filter((m) => m.session_id === activeSessionId)
    : [];

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setIsStreaming(false);
    useStore.getState().setAgentActiveEvent('default', 'on_idle');
    addToast('info', 'Respons AI dihentikan.');
  };

  const handleCopyMessage = (content: string, msgId: string) => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleRegenerate = (assistantMsgId: string) => {
    if (isGenerating || isStreaming) return;
    const currentMsgIndex = currentMessages.findIndex((m) => m.id === assistantMsgId);
    if (currentMsgIndex === -1) return;

    // Cari prompt pesan user sebelumnya
    let userPrompt = '';
    let userMsgIndex = -1;
    for (let i = currentMsgIndex - 1; i >= 0; i--) {
      if (currentMessages[i].role === 'user') {
        userPrompt = currentMessages[i].content;
        userMsgIndex = i;
        break;
      }
    }

    if (userMsgIndex === -1 || !userPrompt) return;

    // Hapus pesan user ini beserta respons asisten setelahnya
    const remainingMessages = currentMessages.slice(0, userMsgIndex);
    const otherSessionMessages = messages.filter((m) => m.session_id !== activeSessionId);
    setMessages([...otherSessionMessages, ...remainingMessages]);

    // Kirim ulang prompt user tersebut
    setTimeout(() => {
      handleSendMessage(userPrompt);
    }, 50);
  };

  const handleEditUserMessage = (userMsgId: string) => {
    if (isGenerating || isStreaming) return;
    const targetIndex = currentMessages.findIndex((m) => m.id === userMsgId);
    if (targetIndex === -1) return;

    const targetMsg = currentMessages[targetIndex];
    // Hapus pesan user dan seluruh pesan setelahnya
    const remainingMessages = currentMessages.slice(0, targetIndex);
    const otherSessionMessages = messages.filter((m) => m.session_id !== activeSessionId);
    setMessages([...otherSessionMessages, ...remainingMessages]);

    setInputPrompt(targetMsg.content);
    promptInputRef.current?.focus();
  };

  // Dengarkan tombol Esc untuk membatalkan respons AI yang sedang berjalan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (isGenerating || isStreaming)) {
        handleStopGenerating();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGenerating, isStreaming]);

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
    if (!rawText && attachedFiles.length === 0) return;

    const filesToAttach = [...attachedFiles];
    const fullPrompt = formatAttachedPrompt(rawText, filesToAttach);

    const isBusy = isGenerating || isStreaming || isWorking;
    if (isBusy && explicitText === undefined) {
      if (settings.queuedMessages === 'queue') {
        addQueuedMessage(fullPrompt);
        setInputPrompt('');
        setAttachedFiles([]);
        setIsSlashOpen(false);
        addToast('info', 'Pesan dan berkas ditambahkan ke antrean.');
        return;
      }
      // When settings.queuedMessages === 'immediate', send immediately without queuing
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
      content: fullPrompt,
      created_at: new Date().toISOString(),
      token_count: Math.ceil(fullPrompt.length / 4),
    };

    addMessage(userMsg);
    saveChatMessageToDb(userMsg);

    // Update judul sesi jika masih default "Obrolan Baru"
    const currentSession = sessions.find((s) => s.id === targetSessionId);
    if (!currentSession || currentSession.title === 'Obrolan Baru') {
      const summaryTitle = (rawText || filesToAttach[0]?.name || 'Obrolan').slice(0, 32);
      updateSessionTitle(targetSessionId, summaryTitle);
    }

    if (explicitText === undefined) {
      setInputPrompt('');
      setAttachedFiles([]);
      setIsSlashOpen(false);
    }
    setIsGenerating(true);
    setIsStreaming(true);
    useStore.getState().setAgentActiveEvent('default', 'on_thinking');

    const endpointConfig = resolveEndpointForModel(selectedModel, availableModels, apiKeys);

    if (!endpointConfig.apiKey.trim()) {
      addToast('error', 'API Key belum diatur. Buka menu Setting di sidebar untuk mengisi kunci.');
      setIsGenerating(false);
      setIsStreaming(false);
      useStore.getState().setAgentActiveEvent('default', 'on_error', 3000);
      return;
    }

    if (!selectedModel.trim()) {
      addToast('error', 'Belum ada model AI yang dipilih. Pastikan API Key aktif dan pilih model di dock bawah.');
      setIsGenerating(false);
      setIsStreaming(false);
      useStore.getState().setAgentActiveEvent('default', 'on_error', 3000);
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

    let hasError = false;
    try {
      let finalPromptForContext = userMsg.content;

      if (isWebSearchActive) {
        addToast('info', 'Mencari informasi aktual di internet...');
        const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
        if (isTauri) {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            const searchResult = await invoke<string>('perform_web_search', {
              query: rawText,
              maxChars: 4000,
            });
            if (searchResult && !searchResult.startsWith('Tidak ditemukan')) {
              finalPromptForContext = `${userMsg.content}\n\n[REFERENSI DARI WEB HASIL PENCARIAN TERAKTUAL]:\n${searchResult}\n\n(Gunakan referensi informasi di atas untuk menjawab dengan akurat, dan cantumkan tautan rujukan jika relevan.)`;
              addToast('success', 'Informasi web berhasil disematkan ke obrolan.');
            }
          } catch (searchErr) {
            console.warn('Gagal melakukan pencarian web:', searchErr);
            addToast('warning', 'Pencarian web gagal atau batas waktu tercapai.');
          }
        }
      }

      // Injeksi Konteks Codebase RAG (Otomatis atau via @codebase)
      const isExplicitCodebase = rawText.toLowerCase().includes('@codebase');
      const cleanSearchQuery = rawText.replace(/@codebase/gi, '').trim();

      if (
        typeof window !== 'undefined' &&
        '__TAURI_INTERNALS__' in window &&
        cleanSearchQuery.length >= 3
      ) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const matches = await invoke<CodeChunkMatch[]>('query_codebase_context', {
            query: cleanSearchQuery,
            maxChunks: 4,
          });

          if (matches && matches.length > 0 && (isExplicitCodebase || matches[0].score > 3.0)) {
            let codebaseContext = '\n\n=== KONTEKS CODEBASE PROYEK (RELEVAN) ===\n';
            for (const m of matches) {
              codebaseContext += `\n[Berkas: ${m.relative_path} (Baris ${m.start_line}-${m.end_line}) | Skor: ${m.score.toFixed(1)}]\n\`\`\`\n${m.content}\n\`\`\`\n`;
            }
            codebaseContext +=
              '=== AKHIR KONTEKS CODEBASE ===\n(Gunakan konteks codebase proyek di atas jika relevan untuk menjawab pertanyaan pengguna secara akurat.)';
            finalPromptForContext = `${finalPromptForContext}${codebaseContext}`;
            if (isExplicitCodebase) {
              addToast('info', `${matches.length} cuplikan kode dari proyek disematkan.`);
            }
          }
        } catch (codebaseErr) {
          console.warn('Gagal memindai konteks codebase RAG:', codebaseErr);
        }
      }

      const {
        messages: prunedMessages,
        isCompressed,
        usagePercent,
      } = preparePrunedContextMessages(
        currentMessages,
        finalPromptForContext,
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

      const startTimestamp = performance.now();
      let ttftRecorded = false;

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const chatUrl = getChatEndpoint(endpointConfig.baseUrl);
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${endpointConfig.apiKey}`,
        },
        body: JSON.stringify(requestPayload),
        signal: abortController.signal,
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

        if (!ttftRecorded) {
          const ttftMs = Math.round(performance.now() - startTimestamp);
          ttftRecorded = true;
          setLastTelemetry({
            ttftMs,
            totalLatencyMs: null,
          });
        }

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

      const totalLatencyMs = Math.round(performance.now() - startTimestamp);
      setLastTelemetry({
        ttftMs: ttftRecorded ? Math.round(performance.now() - startTimestamp) : null,
        totalLatencyMs,
      });

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
      if (abortControllerRef.current?.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        hasError = false;
        useStore.getState().setAgentActiveEvent('default', 'on_idle');
        return;
      }

      hasError = true;
      useStore.getState().setAgentActiveEvent('default', 'on_error', 4000);
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
      abortControllerRef.current = null;
      setIsGenerating(false);
      setIsStreaming(false);
      if (!hasError) {
        useStore.getState().setAgentActiveEvent('default', 'on_success', 2500);
      }
      // Simpan pesan asisten yang telah selesai ke database SQLite
      const finalMsg = useStore.getState().messages.find((m) => m.id === assistantMsgId);
      if (finalMsg && (finalMsg.content || finalMsg.reasoning)) {
        saveChatMessageToDb(finalMsg);
      }

      // Auto-detect artifacts if message contains code block or diagram
      const finalContent = finalMsg?.content || '';
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
                summary: 'Dibuat otomatis oleh asisten model',
              },
            ],
            currentVersionIndex: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sessionId: activeSessionId || undefined,
            messageId: assistantMsgId,
          });
        }
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
          const planTitle = userMsg.content.replace(/^\/plan\s*/, '').slice(0, 40) || 'Implementation Plan';
          setTimeout(() => {
            handleSendMessage(`Lanjutkan eksekusi rencana arsitektur: "${planTitle}".`);
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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#212121] overflow-hidden">
      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Fork Origin Notification Banner if session is forked */}
        {(() => {
          const curSession = sessions.find((s) => s.id === activeSessionId);
          if (curSession?.parent_session_id) {
            const parentSession = sessions.find((s) => s.id === curSession.parent_session_id);
            return (
              <div
                className={`flex items-center justify-between px-3.5 py-2 rounded-2xl bg-[#262626] border border-[#383838] text-xs text-[#b4b4b4] ${convWidthClass} mx-auto w-full`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <GitBranch className="w-3.5 h-3.5 text-[#ececec] shrink-0" />
                  <span className="truncate">
                    Sesi ini merupakan cabang dari:{' '}
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

        {currentMessages.length === 0 ? (
          <div className="my-auto flex flex-col items-center justify-center text-center p-6 space-y-4 pt-12">
            <AgentMascot roleOrId="default" size={92} />
            <EmptyState
              title="Mulai Percakapan Baru"
              description="Ketik pesan untuk berinteraksi dengan AI, atau gunakan '/' untuk melihat jalan pintas perintah."
              actionLabel="Buka Studio"
              onAction={() => useStore.getState().setMode('build')}
              className="pt-0"
            />
          </div>
        ) : (
          currentMessages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`group flex gap-3.5 ${convWidthClass} mx-auto w-full ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {!isUser && (
                  <div className="w-10 h-10 rounded-full bg-[#262626] border border-[#383838] flex items-center justify-center shrink-0 mt-0.5 overflow-hidden shadow-sm">
                    <AgentMascot roleOrId="default" size={40} />
                  </div>
                )}

                <div
                  className={`space-y-1 relative ${
                    isUser ? 'max-w-[85%] items-end flex flex-col' : 'flex-1 min-w-0'
                  }`}
                >
                  {/* Bubble / Stream content */}
                  {isUser ? (
                    <div className="p-3.5 px-4 rounded-2xl bg-[#2f2f2f] border border-[#383838] text-[#ececec] select-text">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed select-text">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="text-[#ececec] py-1 select-text">
                      {!msg.content && !msg.reasoning && isGenerating ? (
                        <div className="py-2 flex items-center gap-2 text-xs text-[#b4b4b4]">
                          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          <span>Memproses respons...</span>
                        </div>
                      ) : (
                        <FormattedMessage
                          content={msg.content}
                          reasoning={msg.reasoning}
                          verbose={settings.verboseAgentChat}
                        />
                      )}
                    </div>
                  )}

                  {/* Message Action Bar (Copy, Regenerate/Edit, Fork) */}
                  {isUser ? (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1.5 pt-0.5 select-none">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.content, msg.id)}
                        title="Salin pesan ini"
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
                      {!isGenerating && !isStreaming && (
                        <button
                          type="button"
                          onClick={() => handleEditUserMessage(msg.id)}
                          title="Edit pesan dan kirim ulang"
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[#262626] hover:bg-[#303030] text-[#707070] hover:text-[#ececec] border border-[#303030] hover:border-[#383838] transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => activeSessionId && forkSessionFromMessage(activeSessionId, msg.id)}
                        title="Cabangkan percakapan baru dari titik pesan ini"
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[#262626] hover:bg-[#303030] text-[#707070] hover:text-[#ececec] border border-[#303030] hover:border-[#383838] transition-colors"
                      >
                        <GitBranch className="w-3 h-3 text-[#b4b4b4]" />
                        <span>Cabangkan</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 pt-1 text-xs select-none">
                      {/* Tombol Salin Seluruh Output AI */}
                      {msg.content && (
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.content, msg.id)}
                          title="Salin seluruh isi jawaban ini"
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#262626] hover:bg-[#303030] text-[#b4b4b4] hover:text-[#ececec] border border-[#303030] hover:border-[#383838] transition-colors"
                        >
                          {copiedMsgId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#ececec]" />
                              <span>Tersalin!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Tombol Coba Lagi / Revert & Regenerate */}
                      {!isGenerating && !isStreaming && (
                        <button
                          type="button"
                          onClick={() => handleRegenerate(msg.id)}
                          title="Ulangi respons untuk giliran ini"
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#262626] hover:bg-[#303030] text-[#b4b4b4] hover:text-[#ececec] border border-[#303030] hover:border-[#383838] transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Coba Lagi</span>
                        </button>
                      )}

                      {/* Tombol Cabangkan / Fork */}
                      <button
                        type="button"
                        onClick={() => activeSessionId && forkSessionFromMessage(activeSessionId, msg.id)}
                        title="Cabangkan percakapan baru dari titik pesan ini"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#262626] hover:bg-[#303030] text-[#707070] hover:text-[#ececec] border border-[#303030] hover:border-[#383838] transition-colors"
                      >
                        <GitBranch className="w-3.5 h-3.5 text-[#b4b4b4]" />
                        <span>Cabangkan</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {pendingPlanApproval && (
          <div
            className={`p-4 rounded-2xl bg-[#1e1e1e] border border-[#383838] text-xs text-[#ececec] space-y-3 ${convWidthClass} mx-auto w-full`}
          >
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-[#ececec] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-[#ececec] uppercase tracking-wide text-[11px] block">
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
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#303030]">
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
                className="px-3.5 py-1.5 rounded-xl bg-[#ececec] hover:bg-white text-black text-xs font-semibold transition-colors"
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
                <span className="w-2 h-2 rounded-full bg-[#ececec] animate-pulse" />
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

          {/* ChatGPT Capsule Prompt Input Container with Drag-and-Drop & Attachment Chips */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-3xl bg-[#2f2f2f] border transition-colors p-2.5 px-3.5 ${
              isDragOver
                ? 'border-[#ececec] bg-[#333333]'
                : 'border-[#383838] focus-within:border-[#4f4f4f]'
            }`}
          >
            {/* Drag-over dropzone overlay */}
            {isDragOver && (
              <div className="absolute inset-0 rounded-3xl bg-[#212121]/90 border-2 border-dashed border-[#ececec] flex items-center justify-center z-30 pointer-events-none">
                <div className="flex items-center gap-2 text-xs font-medium text-[#ececec]">
                  <Paperclip className="w-4 h-4 animate-bounce" />
                  <span>Lepaskan berkas untuk melampirkan ke obrolan</span>
                </div>
              </div>
            )}

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="*/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Attachment Chips Preview */}
            <AttachmentChips
              files={attachedFiles}
              onRemove={(id) => setAttachedFiles((prev) => prev.filter((f) => f.id !== id))}
              className="mb-1.5"
            />

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
                    onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono transition-all group bg-[#212121] hover:bg-[#262626] border-[#383838] text-[#ececec]"
                    title="Pilih Model AI"
                  >
                    {availableModels.length === 0 ? (
                      <span className="w-2 h-2 rounded-full bg-amber-400/90 shrink-0" />
                    ) : (
                      <Cpu className="w-3.5 h-3.5 text-[#ececec]" />
                    )}
                    <span className="max-w-[160px] truncate font-medium">
                      {selectedModel || 'Pilih Model'}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 text-[#b4b4b4] group-hover:text-[#ececec] transition-transform ${
                        isModelMenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Model Selector Popover */}
                  {isModelMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-80 max-h-96 rounded-2xl bg-[#262626] border border-[#383838] p-2.5 z-50 flex flex-col space-y-2 shadow-2xl">
                      <div className="flex items-center justify-between px-1 pb-1 border-b border-[#303030] text-xs">
                        <span className="font-semibold text-[#ececec]">Pilih Model AI</span>
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

                      {/* Search inside models / enter custom model name */}
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#212121] border border-[#303030]">
                        <Search className="w-3.5 h-3.5 text-[#b4b4b4]" />
                        <input
                          type="text"
                          value={modelSearchQuery}
                          onChange={(e) => setModelSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && modelSearchQuery.trim()) {
                              handleSelectModel(modelSearchQuery.trim());
                            }
                          }}
                          placeholder="Cari atau ketik model..."
                          className="flex-1 bg-transparent border-none text-xs text-[#ececec] placeholder-[#707070] focus:outline-none"
                        />
                        {modelSearchQuery.trim() && (
                          <button
                            type="button"
                            onClick={() => handleSelectModel(modelSearchQuery.trim())}
                            className="px-2 py-0.5 rounded text-[10px] bg-[#383838] hover:bg-[#484848] text-[#ececec] transition-colors"
                          >
                            Pilih
                          </button>
                        )}
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
                        ) : filteredModels.length === 0 ? (
                          <div className="p-4 text-center text-xs text-[#b4b4b4] space-y-2">
                            <p>Tidak ada model yang cocok dengan pencarian.</p>
                            {modelSearchQuery.trim() && (
                              <button
                                type="button"
                                onClick={() => handleSelectModel(modelSearchQuery.trim())}
                                className="px-3 py-1 rounded-lg bg-[#383838] hover:bg-[#484848] text-[#ececec] text-xs font-mono"
                              >
                                Gunakan &quot;{modelSearchQuery.trim()}&quot;
                              </button>
                            )}
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
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#ececec] shrink-0" />
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
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-sans font-medium rounded-full bg-[#2f2f2f] text-[#ececec] border border-[#383838] shrink-0">
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
                                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[#ececec]" />}
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
                  onClick={handleAttachClick}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    attachedFiles.length > 0
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#383838]'
                  }`}
                  title="Lampirkan berkas dari komputer (atau tarik & lepas file ke kolom obrolan)"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Lampirkan</span>
                  {attachedFiles.length > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#ececec] text-[#171717] font-semibold">
                      {attachedFiles.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Voice Recording Active Timer Pill */}
                {isVoiceRecording && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full text-xs font-mono animate-pulse">
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

                {/* Mic Button (Harmonized w-8 h-8 rounded-full) */}
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
                      ? `Mengunduh model suara presisi tinggi (${voiceDownloadProgress.percent.toFixed(0)}%)...`
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

                {/* ChatGPT Iconic Round Send / Stop Button */}
                {isGenerating || isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStopGenerating}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-[#ececec] text-black hover:bg-white cursor-pointer"
                    title="Hentikan respons AI [Esc]"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!inputPrompt.trim()}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      inputPrompt.trim()
                        ? 'bg-[#ececec] text-black hover:bg-white'
                        : 'bg-[#404040] text-[#707070] cursor-not-allowed'
                    }`}
                    title={
                      isWorking && settings.queuedMessages === 'queue'
                        ? 'Masukkan ke antrean pesan [Enter]'
                        : 'Kirim pesan [Enter]'
                    }
                  >
                    <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatContainer;
