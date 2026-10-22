import React from 'react';
import { Clock, Layers } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { calculateSessionTelemetry } from '../../utils/contextManager';

interface ContextTelemetryBarProps {
  draftPrompt?: string;
  isProcessing?: boolean;
}

export const ContextTelemetryBar: React.FC<ContextTelemetryBarProps> = ({
  draftPrompt = '',
  isProcessing = false,
}) => {
  const {
    messages,
    activeSessionId,
    selectedModel,
    availableModels,
    lastTelemetry,
  } = useStore();

  const currentMessages = activeSessionId
    ? messages.filter((m) => m.session_id === activeSessionId)
    : messages;

  const telemetry = calculateSessionTelemetry(
    currentMessages,
    draftPrompt,
    selectedModel,
    availableModels,
    lastTelemetry
  );

  const formatTokens = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const getMeterBgClass = (percent: number) => {
    if (percent >= 85) return 'bg-[#ef4444]';
    if (percent >= 60) return 'bg-[#eab308]';
    return 'bg-[#ececec]';
  };

  return (
    <div className="flex items-center justify-between px-3.5 py-1.5 rounded-2xl bg-[#262626] border border-[#383838] text-[11px] text-[#b4b4b4] font-mono select-none">
      {/* Left: Context Meter Progress Bar */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0 text-[#ececec]">
          <Layers className="w-3.5 h-3.5 text-[#b4b4b4]" />
          <span className="font-sans font-medium text-[11px]">Context</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Progress bar container */}
          <div className="w-16 sm:w-24 h-1.5 rounded-full bg-[#171717] border border-[#303030] overflow-hidden shrink-0">
            <div
              className={`h-full rounded-full transition-all duration-300 ${getMeterBgClass(
                telemetry.usagePercent
              )}`}
              style={{ width: `${Math.max(4, telemetry.usagePercent)}%` }}
            />
          </div>

          <span className="text-[10px] text-[#ececec] font-medium">
            {telemetry.usagePercent}%
          </span>
          <span className="text-[9px] text-[#707070] hidden md:inline">
            ({formatTokens(telemetry.totalSessionTokens)}/{formatTokens(telemetry.contextLimit)})
          </span>
        </div>
      </div>

      {/* Right: In/Out Tokens & Latency Telemetry */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Token Counts In / Out */}
        <div className="flex items-center gap-2">
          <span title="Input Tokens (Riwayat + Prompt)" className="text-[#ececec]">
            <span className="text-[#707070]">In:</span> {formatTokens(telemetry.inputTokens)}
          </span>
          <span className="text-[#383838]">|</span>
          <span title="Output Tokens (Respons Model)" className="text-[#ececec]">
            <span className="text-[#707070]">Out:</span> {formatTokens(telemetry.outputTokens)}
          </span>
        </div>

        <span className="text-[#383838]">|</span>

        {/* Latency Status */}
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-[#707070]" />
          {isProcessing ? (
            <span className="text-[10px] text-amber-400 animate-pulse font-sans">
              Mengukur...
            </span>
          ) : telemetry.totalLatencyMs !== null ? (
            <div className="flex items-center gap-1 text-[10px]">
              {telemetry.ttftMs !== null && (
                <span title="Time To First Token (Latensi Pertama)">
                  <span className="text-[#707070]">TTFT:</span> {telemetry.ttftMs}ms
                </span>
              )}
              {telemetry.ttftMs !== null && <span className="text-[#383838]">•</span>}
              <span title="Total Waktu Respons Model">
                <span className="text-[#707070]">Total:</span>{' '}
                {telemetry.totalLatencyMs >= 1000
                  ? `${(telemetry.totalLatencyMs / 1000).toFixed(1)}s`
                  : `${telemetry.totalLatencyMs}ms`}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-[#707070] font-sans">Siap</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContextTelemetryBar;
