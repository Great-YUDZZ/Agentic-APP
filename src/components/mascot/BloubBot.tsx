import React, { useEffect, useRef, useState, useMemo, useId, useCallback } from 'react';
import {
  BotEngine,
  type BotFrame,
  DEMI_VIEWBOX,
  RAYON,
  SHAPE_BY_ID,
  COLOR_BY_ID,
  EXPRESSION_BY_ID,
  DEFAULT_SHAPE,
  DEFAULT_COLOR,
  DEFAULT_EXPRESSION,
  mixHex,
  NOTIF_BLUE,
  lookTarget,
  clamp,
  type GazeScript,
  type StateId,
} from './bloub';

export interface BloubBotProps {
  /** Diameter or width/height in px */
  size?: number;
  /** Shape identifier: 'cercle', 'carre_arrondi', 'galet', 'capsule', 'triangle', 'hexagone', 'nuage', 'goutte', 'pentagone', 'etoile' */
  shape?: string;
  /** Color identifier ('encre', 'ivoire', 'ardoise', etc.) or custom hex code ('#10b981') */
  color?: string;
  /** Idle expression: 'repos', 'joyeux', 'attentif', 'curieux', etc. */
  expression?: string;
  /** Active state animation: 'idle', 'orbit', 'notify', 'alert', 'exclaim', 'play', 'wink', 'wide', etc. */
  state?: StateId;
  /** Background canvas color for particle depth blending and opaque underlay */
  paper?: string;
  /** Freeze render at this timestamp in seconds (avoids rAF loop, perfect for thumbnails) */
  frozenAt?: number;
  /** Whether the mascot's eyes follow the mouse pointer */
  follow?: boolean;
  /** Custom scripted gaze function */
  gaze?: GazeScript | null;
  /** Optional CSS class */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
}

export const BloubBot: React.FC<BloubBotProps> = ({
  size = 120,
  shape = DEFAULT_SHAPE,
  color = DEFAULT_COLOR,
  expression = DEFAULT_EXPRESSION,
  state = 'idle',
  paper = '#212121',
  frozenAt,
  follow = false,
  gaze = null,
  className = '',
  style,
}) => {
  const reactId = useId();
  const uid = useMemo(() => `bb-${reactId.replace(/:/g, '')}`, [reactId]);
  const maskId = `mask-${uid}`;
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Compute resolved shape radii, ink color, and expression definition
  const shapeRadii = useMemo(() => SHAPE_BY_ID.get(shape)?.radii ?? null, [shape]);
  const inkColor = useMemo(() => {
    if (color && color.startsWith('#')) return color;
    return COLOR_BY_ID.get(color)?.hex ?? '#0a0a0c';
  }, [color]);
  const exprDef = useMemo(() => EXPRESSION_BY_ID.get(expression) ?? null, [expression]);

  // Engine instance preserved across renders
  const engineRef = useRef<BotEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new BotEngine(RAYON, state, shapeRadii, exprDef);
  }

  // Current sampled frame state
  const [frame, setFrame] = useState<BotFrame>(() =>
    engineRef.current!.sample(frozenAt ?? 0)
  );

  // Synchronize dynamic engine state when props change
  const clockRef = useRef<number>(0);
  const pointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const turnSinceRef = useRef<number>(0);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.state !== state) {
      engine.setState(state, clockRef.current);
      if (frozenAt !== undefined) {
        setFrame(engine.sample(frozenAt));
      }
    }
  }, [state, frozenAt]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setShape(shapeRadii, clockRef.current);
    if (frozenAt !== undefined) {
      setFrame(engine.sample(frozenAt));
    }
  }, [shapeRadii, frozenAt]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setExpression(exprDef, clockRef.current);
    if (frozenAt !== undefined) {
      setFrame(engine.sample(frozenAt));
    }
  }, [exprDef, frozenAt]);

  useEffect(() => {
    if (frozenAt !== undefined && engineRef.current) {
      setFrame(engineRef.current.sample(frozenAt));
    }
  }, [frozenAt]);

  // Pointer tracking handler
  const handlePointerMove = useCallback((e: PointerEvent) => {
    pointerPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerLeave = useCallback(() => {
    pointerPosRef.current = null;
  }, []);

  useEffect(() => {
    if (follow && frozenAt === undefined) {
      turnSinceRef.current = clockRef.current;
      window.addEventListener('pointermove', handlePointerMove, { passive: true });
      document.addEventListener('pointerleave', handlePointerLeave, { passive: true });
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerleave', handlePointerLeave);
        if (engineRef.current) {
          engineRef.current.setLook(null, clockRef.current);
        }
      };
    } else {
      if (engineRef.current) {
        engineRef.current.setLook(null, clockRef.current);
      }
    }
  }, [follow, frozenAt, handlePointerMove, handlePointerLeave]);

  // Main animation ticker loop
  useEffect(() => {
    if (frozenAt !== undefined) return;

    let rafId = 0;
    let lastTime = 0;

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.064) : 0;
      lastTime = now;
      clockRef.current += dt;
      const clock = clockRef.current;
      const engine = engineRef.current;
      if (!engine) return;

      // Pointer aim calculation
      if (follow && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const reach = 220;
        const p = pointerPosRef.current;
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const nx = p ? clamp((p.x - centerX) / reach, -1, 1) : 0;
        const ny = p ? clamp((p.y - centerY) / reach, -1, 1) : 0;

        engine.setLook(
          lookTarget({
            nx,
            ny,
            pointer: p !== null,
          }),
          clock
        );
      } else if (gaze) {
        engine.setLook(gaze(clock), clock, 1 / 60);
      }

      setFrame(engine.sample(clock));
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [frozenAt, follow, gaze]);

  const R = RAYON;
  const VB = DEMI_VIEWBOX;

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`${-VB} ${-VB} ${VB * 2} ${VB * 2}`}
      role="img"
      aria-label="Bot Mascot"
      className={`select-none shrink-0 ${className}`}
      style={style}
    >
      <defs>
        {/*
          Mata adalah lubang nyata pada mask tubuh siluet (seperti x.ai bot),
          sehingga otomatis terpotong ketika melirik ke tepi tubuh.
        */}
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={-VB}
          y={-VB}
          width={VB * 2}
          height={VB * 2}
        >
          <path d={frame.bodyPath} fill="#ffffff" />
          {frame.eyes.map((eye, i) => (
            <path
              key={i}
              d={eye.d}
              transform={eye.matrix}
              opacity={eye.alpha}
              fill="#000000"
            />
          ))}
          {frame.notch && (
            <circle
              cx={frame.notch.x}
              cy={frame.notch.y}
              r={frame.notch.r}
              fill="#000000"
            />
          )}
        </mask>

        {/* Gradien orbital rings */}
        {frame.arcs.map((arc) => (
          <linearGradient
            key={arc.id}
            id={`${uid}-${arc.id}`}
            gradientUnits="userSpaceOnUse"
            x1={arc.grad.x1}
            y1={arc.grad.y1}
            x2={arc.grad.x2}
            y2={arc.grad.y2}
          >
            {arc.grad.stops.map((c, i) => (
              <stop
                key={i}
                offset={i / (arc.grad.stops.length - 1)}
                stopColor={c}
              />
            ))}
          </linearGradient>
        ))}
      </defs>

      {/* Bagian belakang cincin orbit */}
      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path
            key={`b-${arc.id}`}
            d={arc.back}
            stroke={`url(#${uid}-${arc.id})`}
            strokeWidth={arc.width}
            opacity={arc.opacity}
          />
        ))}
      </g>

      {/* Partikel di belakang tubuh */}
      {frame.dotsBehind && (
        <g>
          {frame.dots.map((dot, i) => {
            const fill =
              dot.color ??
              (dot.depth === undefined
                ? inkColor
                : mixHex(paper, inkColor, dot.depth));
            if (dot.d) {
              return (
                <path
                  key={`pb-${i}`}
                  d={dot.d}
                  fill={fill}
                  opacity={dot.opacity}
                  transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${R})`}
                />
              );
            }
            return (
              <circle
                key={`pb-${i}`}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                fill={fill}
                opacity={dot.opacity}
              />
            );
          })}
        </g>
      )}

      {/* Siluet Tubuh */}
      <g opacity={frame.bodyAlpha}>
        {/* Lapisan dasar opaque untuk menahan cincin orbit belakang agar tidak tembus */}
        <path d={frame.bodyPath} fill={paper} />

        {/* Tubuh utama yang dilubangi oleh mask mata */}
        <path d={frame.bodyPath} fill={inkColor} mask={`url(#${maskId})`} />
      </g>

      {/* Partikel di depan tubuh */}
      {!frame.dotsBehind && (
        <g>
          {frame.dots.map((dot, i) => {
            const fill =
              dot.color ??
              (dot.depth === undefined
                ? inkColor
                : mixHex(paper, inkColor, dot.depth));
            if (dot.d) {
              return (
                <path
                  key={`pf-${i}`}
                  d={dot.d}
                  fill={fill}
                  opacity={dot.opacity}
                  transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${R})`}
                />
              );
            }
            return (
              <circle
                key={`pf-${i}`}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                fill={fill}
                opacity={dot.opacity}
              />
            );
          })}
        </g>
      )}

      {/* Notifikasi pastille pop di tepi tubuh */}
      {frame.notif && (
        <circle
          cx={frame.notif.x}
          cy={frame.notif.y}
          r={frame.notif.r}
          fill={NOTIF_BLUE}
        />
      )}

      {/* Bagian depan cincin orbit */}
      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path
            key={`f-${arc.id}`}
            d={arc.front}
            stroke={`url(#${uid}-${arc.id})`}
            strokeWidth={arc.width}
            opacity={arc.opacity}
          />
        ))}
      </g>
    </svg>
  );
};

export default BloubBot;
