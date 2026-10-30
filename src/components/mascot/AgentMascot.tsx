import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useStore, DEFAULT_MASCOTS } from '../../store/useStore';
import {
  MascotConfig,
  MascotShape,
  MascotAnimation,
  MascotEvent,
} from '../../types';

interface AgentMascotProps {
  roleOrId?: string;
  config?: MascotConfig;
  animationOverride?: MascotAnimation;
  eventOverride?: MascotEvent;
  size?: number;
  className?: string;
  showBadge?: boolean;
}

// Menghitung apakah warna tubuh terang atau gelap agar mata selalu kontras tinggi
function getEyeFillColor(bodyColor: string): string {
  const hex = bodyColor.replace('#', '');
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? '#171717' : '#ffffff';
  }
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? '#171717' : '#ffffff';
  }
  return '#ffffff';
}

// Path SVG untuk ragam bentuk tubuh
function getShapePath(shape: MascotShape): string {
  switch (shape) {
    case 'circle':
      return 'M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10 Z';
    case 'squircle':
      return 'M 24 10 C 14 10 10 14 10 24 L 10 76 C 10 86 14 90 24 90 L 76 90 C 86 90 90 86 90 76 L 90 24 C 90 14 86 10 76 10 Z';
    case 'pebble':
      return 'M 50 10 C 76 10 90 28 88 54 C 86 78 68 90 48 90 C 24 90 10 74 12 48 C 14 24 28 10 50 10 Z';
    case 'capsule':
      return 'M 35 12 L 65 12 C 78 12 88 22 88 35 L 88 65 C 88 78 78 88 65 88 L 35 88 C 22 88 12 78 12 65 L 12 35 C 12 22 22 12 35 12 Z';
    case 'triangle':
      return 'M 50 12 C 55 12 60 16 86 68 C 91 78 84 88 74 88 L 26 88 C 16 88 9 78 14 68 L 40 12 C 45 12 47 12 50 12 Z';
    case 'hexagon':
      return 'M 50 10 L 84 29 C 88 31 90 35 90 40 L 90 60 C 90 65 88 69 84 71 L 50 90 C 47 91 43 91 40 89 L 16 71 C 12 69 10 65 10 60 L 10 40 C 10 35 12 31 16 29 L 40 10 C 43 9 47 9 50 10 Z';
    case 'cloud':
      return 'M 30 76 C 18 76 12 68 12 58 C 12 48 20 42 28 42 C 30 30 40 22 52 22 C 64 22 74 30 76 42 C 82 42 88 48 88 56 C 88 68 80 76 68 76 Z';
    case 'drop':
      return 'M 50 10 C 50 10 86 50 86 66 C 86 80 70 90 50 90 C 30 90 14 80 14 66 C 14 50 50 10 50 10 Z';
    default:
      return 'M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10 Z';
  }
}

export const AgentMascot: React.FC<AgentMascotProps> = ({
  roleOrId = 'default',
  config: directConfig,
  animationOverride,
  eventOverride,
  size = 32,
  className = '',
  showBadge = true,
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

  // Tentukan animasi yang harus dimainkan
  const activeAnimation: MascotAnimation = useMemo(() => {
    if (animationOverride) return animationOverride;
    if (config.events && config.events[activeEvent]) {
      return config.events[activeEvent];
    }
    return 'idle';
  }, [animationOverride, config.events, activeEvent]);

  // State untuk kedipan mata natural saat idle
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    if (!config.animate || activeAnimation !== 'idle') {
      setIsBlinking(false);
      return;
    }
    let timeoutId: NodeJS.Timeout;
    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
        const nextInterval = 3000 + Math.random() * 4000;
        timeoutId = setTimeout(triggerBlink, nextInterval);
      }, 160);
    };
    timeoutId = setTimeout(triggerBlink, 2500 + Math.random() * 2000);
    return () => clearTimeout(timeoutId);
  }, [config.animate, activeAnimation]);

  const eyeColor = useMemo(() => getEyeFillColor(config.color), [config.color]);
  const shapePath = useMemo(() => getShapePath(config.shape), [config.shape]);

  // Render mata berdasarkan ekspresi & animasi aktif
  const renderEyes = () => {
    // 1. Animasi Thinking: Tiga titik dinamis atau mata melihat ke atas
    if (activeAnimation === 'thinking') {
      return (
        <g transform="translate(0, -4)">
          <motion.circle
            cx="36"
            cy="46"
            r="4.5"
            fill={eyeColor}
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
          />
          <motion.circle
            cx="50"
            cy="44"
            r="4.5"
            fill={eyeColor}
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
          />
          <motion.circle
            cx="64"
            cy="46"
            r="4.5"
            fill={eyeColor}
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
          />
        </g>
      );
    }

    // 2. Animasi Alert: Mata melotot dengan tanda seru di atas atau pupil fokus
    if (activeAnimation === 'alert' || activeAnimation === 'exclaim') {
      return (
        <g>
          {/* Mata Terbelalak */}
          <ellipse cx="38" cy="50" rx="6" ry="11" fill={eyeColor} />
          <ellipse cx="62" cy="50" rx="6" ry="11" fill={eyeColor} />
          {/* Tanda Seru Aksen Alert */}
          {activeAnimation === 'alert' && (
            <motion.g
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <rect x="47.5" y="18" width="5" height="15" rx="2.5" fill="#ef4444" />
              <circle cx="50" cy="38" r="2.8" fill="#ef4444" />
            </motion.g>
          )}
        </g>
      );
    }

    // 3. Animasi Wide Eyes
    if (activeAnimation === 'wide') {
      return (
        <g>
          <ellipse cx="37" cy="48" rx="8" ry="12" fill={eyeColor} />
          <ellipse cx="63" cy="48" rx="8" ry="12" fill={eyeColor} />
          {/* Pantulan cahaya pupil */}
          <circle cx="39" cy="45" r="2.5" fill={config.color} />
          <circle cx="65" cy="45" r="2.5" fill={config.color} />
        </g>
      );
    }

    // 4. Animasi Wink
    if (activeAnimation === 'wink') {
      return (
        <g>
          <ellipse cx="38" cy="48" rx="5" ry="9" fill={eyeColor} />
          <path
            d="M 56 49 Q 63 53 70 49"
            stroke={eyeColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      );
    }

    // 5. Animasi Sleep
    if (activeAnimation === 'sleep') {
      return (
        <g>
          <path
            d="M 32 50 Q 38 54 44 50"
            stroke={eyeColor}
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 56 50 Q 62 54 68 50"
            stroke={eyeColor}
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          {/* ZZZ Melayang */}
          <motion.text
            x="68"
            y="32"
            fill={eyeColor}
            fontSize="10"
            fontWeight="bold"
            animate={{ opacity: [0, 1, 0], y: [32, 22] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            z
          </motion.text>
        </g>
      );
    }

    // 6. Animasi Play (Ceria Senyum)
    if (activeAnimation === 'play') {
      return (
        <g>
          <path
            d="M 32 46 Q 38 40 44 46"
            stroke={eyeColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 56 46 Q 62 40 68 46"
            stroke={eyeColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 44 56 Q 50 62 56 56"
            stroke={eyeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      );
    }

    // 7. Ekspresi Dasar saat Idle / Lainnya
    const scaleY = isBlinking ? 0.1 : 1;

    switch (config.expression) {
      case 'happy':
        return (
          <g>
            <path
              d="M 32 48 Q 38 42 44 48"
              stroke={eyeColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 56 48 Q 62 42 68 48"
              stroke={eyeColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        );
      case 'curious':
        return (
          <g>
            <ellipse cx="38" cy="46" rx="5" ry="9" fill={eyeColor} />
            <ellipse cx="62" cy="50" rx="6" ry="7" fill={eyeColor} />
          </g>
        );
      case 'proud':
        return (
          <g>
            <path
              d="M 33 46 L 43 49"
              stroke={eyeColor}
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              d="M 67 46 L 57 49"
              stroke={eyeColor}
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              d="M 46 56 Q 50 59 54 56"
              stroke={eyeColor}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        );
      case 'thinking':
        return (
          <g>
            <ellipse cx="40" cy="44" rx="4.5" ry="8" fill={eyeColor} />
            <ellipse cx="64" cy="44" rx="4.5" ry="8" fill={eyeColor} />
          </g>
        );
      case 'wink':
        return (
          <g>
            <ellipse cx="38" cy="48" rx="5" ry="9" fill={eyeColor} />
            <path
              d="M 56 49 Q 63 53 70 49"
              stroke={eyeColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        );
      case 'sleepy':
        return (
          <g>
            <path
              d="M 32 50 L 44 50"
              stroke={eyeColor}
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              d="M 56 50 L 68 50"
              stroke={eyeColor}
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </g>
        );
      case 'angry':
        return (
          <g>
            <path
              d="M 33 44 L 43 48"
              stroke={eyeColor}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M 67 44 L 57 48"
              stroke={eyeColor}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <ellipse cx="39" cy="50" rx="4" ry="6" fill={eyeColor} />
            <ellipse cx="61" cy="50" rx="4" ry="6" fill={eyeColor} />
          </g>
        );
      case 'attentive':
        return (
          <motion.g animate={{ scaleY }} transition={{ duration: 0.1 }}>
            <ellipse cx="38" cy="48" rx="6" ry="10" fill={eyeColor} />
            <ellipse cx="62" cy="48" rx="6" ry="10" fill={eyeColor} />
          </motion.g>
        );
      case 'neutral':
      default:
        return (
          <motion.g animate={{ scaleY }} transition={{ duration: 0.1 }}>
            <ellipse cx="38" cy="48" rx="5" ry="9" fill={eyeColor} />
            <ellipse cx="62" cy="48" rx="5" ry="9" fill={eyeColor} />
          </motion.g>
        );
    }
  };

  // Variasi animasi pergerakan tubuh utama
  const bodyAnimationVariants: Record<string, any> = {
    idle: config.animate
      ? {
          y: [0, -2.5, 0],
          transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
        }
      : {},
    thinking: config.animate
      ? {
          rotate: [-1.5, 1.5, -1.5],
          y: [0, -1.5, 0],
          transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
        }
      : {},
    alert: config.animate
      ? {
          scaleY: [1, 0.9, 1.08, 1],
          y: [0, 2, -4, 0],
          transition: { duration: 0.5, repeat: 2 },
        }
      : {},
    notify: config.animate
      ? {
          rotate: [0, -3, 3, 0],
          scale: [1, 1.05, 1],
          transition: { duration: 0.6 },
        }
      : {},
    exclaim: config.animate
      ? {
          y: [0, -6, 0],
          transition: { duration: 0.4 },
        }
      : {},
    sleep: config.animate
      ? {
          scale: [1, 0.97, 1],
          transition: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
        }
      : {},
    play: config.animate
      ? {
          rotate: [-4, 4, -4],
          y: [0, -3, 0],
          transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
        }
      : {},
    orbit: config.animate
      ? {
          y: [0, -2, 0],
          transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
        }
      : {},
    wink: config.animate
      ? {
          scale: [1, 1.06, 1],
          transition: { duration: 0.4 },
        }
      : {},
    wide: config.animate
      ? {
          scale: [1, 1.08, 1],
          transition: { duration: 0.4 },
        }
      : {},
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <motion.svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="overflow-visible"
        animate={bodyAnimationVariants[activeAnimation] || bodyAnimationVariants.idle}
      >
        {/* Cincin Partikel untuk Animasi Orbit */}
        {activeAnimation === 'orbit' && config.animate && (
          <motion.ellipse
            cx="50"
            cy="52"
            rx="46"
            ry="18"
            fill="none"
            stroke={config.color}
            strokeWidth="2"
            strokeDasharray="8 6"
            opacity="0.8"
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '50px 52px' }}
          />
        )}

        {/* Tubuh Maskot Utama */}
        <motion.path
          d={shapePath}
          fill={config.color}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
        />

        {/* Mata dan Ekspresi */}
        {renderEyes()}

        {/* Aksesori Badge untuk Animasi Notification */}
        {activeAnimation === 'notify' && showBadge && (
          <motion.circle
            cx="80"
            cy="20"
            r="8"
            fill="#3b82f6"
            stroke="#171717"
            strokeWidth="2.5"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.25, 1] }}
            transition={{ duration: 0.35, type: 'spring' }}
          />
        )}
      </motion.svg>
    </div>
  );
};
