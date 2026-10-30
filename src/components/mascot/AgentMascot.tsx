import React, { useMemo } from 'react';
import { useStore, DEFAULT_MASCOTS } from '../../store/useStore';
import {
  MascotConfig,
  MascotAnimation,
  MascotEvent,
} from '../../types';
import { BloubBot } from './BloubBot';
import { type StateId } from './bloub';

interface AgentMascotProps {
  roleOrId?: string;
  config?: MascotConfig;
  animationOverride?: MascotAnimation;
  eventOverride?: MascotEvent;
  size?: number;
  className?: string;
  showBadge?: boolean;
  follow?: boolean;
  frozenAt?: number;
}

// Konversi nama bentuk lama ke ID bentuk resmi Bloub
function mapShapeToBloub(shape: string): string {
  switch (shape) {
    case 'circle':
      return 'cercle';
    case 'squircle':
      return 'carre_arrondi';
    case 'pebble':
      return 'galet';
    case 'hexagon':
      return 'hexagone';
    case 'cloud':
      return 'nuage';
    case 'drop':
      return 'goutte';
    default:
      return shape;
  }
}

// Konversi nama ekspresi lama ke ID ekspresi resmi Bloub
function mapExpressionToBloub(expression: string): string {
  switch (expression) {
    case 'neutral':
      return 'repos';
    case 'attentive':
      return 'attentif';
    case 'happy':
      return 'joyeux';
    case 'curious':
      return 'curieux';
    case 'proud':
      return 'repos';
    case 'thinking':
      return 'attentif';
    case 'wink':
      return 'clin_d_oeil';
    case 'sleepy':
      return 'endormi';
    case 'angry':
      return 'colere';
    default:
      return expression;
  }
}

// Konversi state lama ke State ID resmi Bloub
function mapAnimationToBloub(anim: string): StateId {
  switch (anim) {
    case 'thinking':
      return 'orbit';
    default:
      return anim as StateId;
  }
}

export const AgentMascot: React.FC<AgentMascotProps> = ({
  roleOrId = 'default',
  config: directConfig,
  animationOverride,
  eventOverride,
  size = 32,
  className = '',
  showBadge = false,
  follow,
  frozenAt,
}) => {
  const settings = useStore((s) => s.settings);
  const activeAgentEvents = useStore((s) => s.activeAgentEvents);

  // Ambil konfigurasi maskot dari props, store, atau fallback default
  const config: MascotConfig = useMemo(() => {
    if (directConfig) return directConfig;
    const storeMascots = settings.agentMascots || DEFAULT_MASCOTS;
    return storeMascots[roleOrId] || storeMascots['default'] || DEFAULT_MASCOTS.default;
  }, [directConfig, settings.agentMascots, roleOrId]);

  // Tentukan event aktif saat ini
  const activeEvent: MascotEvent = useMemo(() => {
    if (eventOverride) return eventOverride;
    return activeAgentEvents[roleOrId] || 'on_idle';
  }, [eventOverride, activeAgentEvents, roleOrId]);

  // Tentukan animasi / state Bloub yang harus dimainkan
  const activeAnimation: StateId = useMemo(() => {
    if (animationOverride) return mapAnimationToBloub(animationOverride);
    if (config.events && config.events[activeEvent]) {
      return mapAnimationToBloub(config.events[activeEvent]);
    }
    return 'idle';
  }, [animationOverride, config.events, activeEvent]);

  const bloubShape = useMemo(() => mapShapeToBloub(config.shape), [config.shape]);
  const bloubExpression = useMemo(() => mapExpressionToBloub(config.expression), [config.expression]);

  const shouldFollow = follow !== undefined ? follow : (config.follow ?? false);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <BloubBot
        size={size}
        shape={bloubShape}
        color={config.color}
        expression={bloubExpression}
        state={activeAnimation}
        follow={shouldFollow}
        frozenAt={frozenAt}
        className="w-full h-full"
      />

      {/* Indikator Badge Reaktif Opsional */}
      {showBadge && activeEvent !== 'on_idle' && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#212121] ${
            activeEvent === 'on_thinking'
              ? 'bg-sky-400 animate-pulse'
              : activeEvent === 'on_error'
              ? 'bg-rose-500 animate-bounce'
              : activeEvent === 'on_approval'
              ? 'bg-amber-400 animate-ping'
              : activeEvent === 'on_success'
              ? 'bg-emerald-400'
              : 'bg-indigo-400'
          }`}
        />
      )}
    </div>
  );
};

export default AgentMascot;
