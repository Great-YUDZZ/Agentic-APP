import React, { useState, useRef, useEffect } from 'react';
import {
  Layers,
  Users,
  Plus,
  ArrowUp,
  Sparkles,
  Bot,
  ChevronRight,
  ListTodo,
  CheckCircle2,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { FormattedMessage } from '../common/FormattedMessage';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { AgentCreatorModal } from '../agent/AgentCreatorModal';
import { DraftPlanTask } from '../../types';
import { getConversationWidthClass } from '../../utils/layout';

const EMPTY_SUGGESTIONS = [
  'Rancang aplikasi desktop manajemen proyek dengan Tauri 2.0, React 19, dan SQLite.',
  'Buat arsitektur REST API berkinerja tinggi dengan Rust Axum dan validasi data ketat.',
  'Desain orkestrasi bot multi-agen otonom untuk analisis data dan pelaporan otomatis.',
];

const PlanWorkspaceInner: React.FC = () => {
  const {
    buildDiscussion,
    customAgents,
    isOrchestratorThinking,
    sendPlanningMessage,
    autoSpawnRecommendedSquad,
    approveAndDispatchPlan,
    setBuildSubMode,
    settings,
  } = useStore();

  const [chatInput, setChatInput] = useState('');
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const planningMessages = buildDiscussion.planningMessages || [];
  const draftTasks = buildDiscussion.draftPlanTasks || [];
  const recommendedSquad = buildDiscussion.recommendedSquad || [];
  const needsSquad = customAgents.length < 2 || recommendedSquad.length > 0;

  const convWidthClass = getConversationWidthClass(settings?.conversationWidth);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [planningMessages, isOrchestratorThinking]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text || isOrchestratorThinking) return;

    setChatInput('');
    await sendPlanningMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getPriorityBadge = (priority: DraftPlanTask['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'text-rose-400 bg-rose-950/40 border-rose-800/40';
      case 'high':
        return 'text-amber-400 bg-amber-950/40 border-amber-800/40';
      case 'medium':
        return 'text-blue-400 bg-blue-950/40 border-blue-800/40';
      case 'low':
      default:
        return 'text-[#b4b4b4] bg-[#262626] border-[#383838]';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#212121] overflow-hidden select-text">
      {/* Header Banner Info */}
      <div className="px-6 py-3.5 bg-[#171717] border-b border-[#303030] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#212121] border border-[#303030] text-emerald-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-[#ececec]">Lead Orchestrator</h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-md bg-[#212121] text-emerald-400 border border-emerald-900/60">
                Built-in System Architect
              </span>
            </div>
            <p className="text-xs text-[#b4b4b4]">
              Sesi Perencanaan Proyek: Rumuskan arsitektur, tentukan peran tim, dan susun draf tugas.
            </p>
          </div>
        </div>

        {/* Phase Indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#707070] font-mono hidden sm:inline">Fase Aktif:</span>
          <div className="flex items-center p-1 rounded-xl bg-[#212121] border border-[#303030]">
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#2f2f2f] text-[#ececec] border border-[#383838] shadow-none"
            >
              Plan
            </button>
            <button
              type="button"
              onClick={() => setBuildSubMode('build')}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-[#707070] hover:text-[#b4b4b4] transition-colors"
            >
              Build
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className={`mx-auto space-y-6 ${convWidthClass}`}>
          {/* 1. Skuad Status & Rekomendasi Card */}
          {needsSquad ? (
            <div className="p-4 rounded-2xl bg-[#1e1e1e] border border-[#303030] space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#262626] border border-[#383838] text-[#ececec]">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-[#ececec]">
                      Rekomendasi Skuad Proyek
                    </h2>
                    <p className="text-xs text-[#707070]">
                      {customAgents.length < 2
                        ? 'Proyek membutuhkan minimal 2 agen kustom untuk menjalankan sesi Build Multi-Agent.'
                        : 'Lead Orchestrator merekomendasikan penyesuaian komposisi tim agen.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={autoSpawnRecommendedSquad}
                    className="px-3.5 py-1.5 rounded-xl bg-[#2f2f2f] hover:bg-[#383838] border border-[#444] text-xs font-medium text-[#ececec] transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Buat Tim Otomatis</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAgentModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#212121] hover:bg-[#2a2a2a] border border-[#303030] text-xs font-medium text-[#b4b4b4] hover:text-[#ececec] transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Buat Agen Manual</span>
                  </button>
                </div>
              </div>

              {recommendedSquad.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[#2a2a2a]">
                  {recommendedSquad.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-[#262626] border border-[#333333] space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: rec.avatar_color }}
                        />
                        <span className="text-xs font-medium text-[#ececec] truncate">
                          {rec.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#707070] line-clamp-2">
                        {rec.task_description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-[#707070] shrink-0">
                  Skuad Siap:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {customAgents.map((agent) => (
                    <span
                      key={agent.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#212121] border border-[#303030] text-xs text-[#ececec]"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: agent.avatar_color }}
                      />
                      <span>{agent.name}</span>
                      <span className="text-[10px] text-[#707070] font-mono">({agent.role})</span>
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAgentModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-[#212121] hover:bg-[#2a2a2a] border border-[#303030] text-[11px] text-[#b4b4b4] hover:text-[#ececec] transition-colors shrink-0"
              >
                + Tambah Agen
              </button>
            </div>
          )}

          {/* 2. Chat History Area */}
          {planningMessages.length === 0 ? (
            /* Empty State */
            <div className="py-12 sm:py-16 text-center space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-[#1e1e1e] border border-[#303030] flex items-center justify-center mx-auto text-emerald-400">
                <Bot className="w-6 h-6" />
              </div>

              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base font-semibold text-[#ececec]">
                  Mulai Sesi Perencanaan Bersama Lead Orchestrator
                </h3>
                <p className="text-xs text-[#b4b4b4] leading-relaxed">
                  Sampaikan target proyek, tumpukan teknologi, atau kebutuhan spesifik Anda.
                  Lead Orchestrator akan merumuskan spesifikasi arsitektur, rekomendasi peran tim,
                  serta memecah rencana ke dalam draf tugas siap eksekusi.
                </p>
              </div>

              <div className="max-w-lg mx-auto grid grid-cols-1 gap-2 pt-2 text-left">
                {EMPTY_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setChatInput(suggestion);
                      textareaRef.current?.focus();
                    }}
                    className="p-3 rounded-xl bg-[#1e1e1e] hover:bg-[#262626] border border-[#303030] text-xs text-[#b4b4b4] hover:text-[#ececec] transition-colors flex items-center justify-between group"
                  >
                    <span>{suggestion}</span>
                    <ChevronRight className="w-4 h-4 text-[#707070] group-hover:text-[#ececec] transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message List */
            <div className="space-y-4">
              {planningMessages.map((msg) => {
                const isUser = msg.agent_id === 'operator';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                  >
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs font-semibold text-[#ececec]">
                        {msg.agent_name}
                      </span>
                      <span className="text-[10px] text-[#707070] font-mono">
                        {msg.agent_role}
                      </span>
                      <span className="text-[10px] text-[#555]">
                        {msg.timestamp}
                      </span>
                    </div>

                    <div
                      className={`p-4 rounded-2xl text-xs leading-relaxed max-w-full sm:max-w-3xl border ${
                        isUser
                          ? 'bg-[#262626] border-[#383838] text-[#ececec]'
                          : 'bg-[#1a1a1a] border-[#2e2e2e] text-[#ececec]'
                      }`}
                    >
                      <FormattedMessage content={msg.content} />
                    </div>
                  </div>
                );
              })}

              {/* Loading Skeleton Boundary State */}
              {isOrchestratorThinking && (
                <div className="flex flex-col items-start space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs font-semibold text-emerald-400">
                      Lead Orchestrator
                    </span>
                    <span className="text-[10px] text-[#707070] font-mono">
                      Menganalisis arsitektur...
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#1a1a1a] border border-[#2e2e2e] w-full max-w-2xl space-y-2.5 animate-pulse">
                    <div className="h-3 bg-[#2a2a2a] rounded w-3/4" />
                    <div className="h-3 bg-[#2a2a2a] rounded w-5/6" />
                    <div className="h-3 bg-[#2a2a2a] rounded w-1/2" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Kartu Draf Rencana & Rincian Tugas */}
          {draftTasks.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#1e1e1e] border border-[#303030] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#262626] border border-[#383838] text-emerald-400">
                    <ListTodo className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#ececec]">
                      Draf Rencana & Rincian Tugas
                    </h3>
                    <p className="text-xs text-[#707070]">
                      {draftTasks.length} tugas teridentifikasi untuk didistribusikan ke tim agen.
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 px-2.5 py-1 rounded-md">
                  Status: Siap Disetujui
                </span>
              </div>

              {/* Task Cards List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {draftTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl bg-[#262626] border border-[#333333] space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-[#ececec] leading-snug">
                        {task.title}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border shrink-0 ${getPriorityBadge(
                          task.priority
                        )}`}
                      >
                        {task.priority}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-[#303030] text-[11px] text-[#707070]">
                      <span className="font-mono">Peran:</span>
                      <span className="text-[#b4b4b4]">{task.role_needed}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Primary Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={approveAndDispatchPlan}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#2f2f2f] hover:bg-[#383838] border border-[#444] text-xs font-semibold text-[#ececec] flex items-center justify-center gap-2 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Setujui & Bagikan Tugas ke Tim</span>
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Dock Input Chat Bawah */}
      <div className="p-4 bg-[#171717] border-t border-[#262626] shrink-0">
        <div className={`mx-auto space-y-2.5 ${convWidthClass}`}>
          <form
            onSubmit={handleSendMessage}
            className="rounded-2xl bg-[#212121] border border-[#303030] focus-within:border-[#444] p-3 transition-colors"
          >
            <textarea
              ref={textareaRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Sampaikan ide proyek, revisi arsitektur, atau instruksi ke Lead Orchestrator..."
              className="w-full bg-transparent text-xs text-[#ececec] placeholder-[#707070] focus:outline-none resize-none leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2 border-t border-[#2a2a2a]">
              {/* Phase Toggle Pill */}
              <div className="flex items-center p-0.5 rounded-lg bg-[#1a1a1a] border border-[#303030]">
                <button
                  type="button"
                  className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-[#2f2f2f] text-[#ececec] border border-[#383838]"
                >
                  Plan
                </button>
                <button
                  type="button"
                  onClick={() => setBuildSubMode('build')}
                  className="px-2.5 py-0.5 rounded-md text-[11px] font-medium text-[#707070] hover:text-[#b4b4b4] transition-colors"
                >
                  Build
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isOrchestratorThinking}
                  className="p-1.5 rounded-xl bg-[#2f2f2f] hover:bg-[#383838] disabled:opacity-40 border border-[#383838] text-[#ececec] transition-colors"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>

          {/* Shortcut Hint */}
          <div className="flex items-center justify-between text-[11px] text-[#707070] px-1">
            <span>Tekan Ctrl + Tab untuk beralih antara Plan dan Build</span>
            <span>Enter untuk kirim, Shift + Enter untuk baris baru</span>
          </div>
        </div>
      </div>

      {/* Manual Agent Creator Modal */}
      <AgentCreatorModal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
      />
    </div>
  );
};

export const PlanWorkspace: React.FC = () => {
  return (
    <ErrorBoundary fallbackTitle="Sesi Perencanaan Lead Orchestrator Mengalami Masalah">
      <PlanWorkspaceInner />
    </ErrorBoundary>
  );
};

export default PlanWorkspace;
