import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { type StateId } from './bloub';

interface UseMascotAutonomousOptions {
  enabled?: boolean;
  idleThresholdMs?: number; // default: 20_000 (20 detik)
  sleepThresholdMs?: number; // default: 60_000 (60 detik)
  isSystemBusy?: boolean; // Jika agen sedang thinking/executing, tunda idle/sleep
}

export interface UseMascotAutonomousReturn {
  autonomousState: StateId | null;
  triggerClick: () => void;
  triggerHover: () => void;
  isSleeping: boolean;
}

const FIDGET_STATES: StateId[] = ['wink', 'play', 'orbit', 'wide'];

export function useMascotAutonomous({
  enabled = true,
  idleThresholdMs = 20_000,
  sleepThresholdMs = 60_000,
  isSystemBusy = false,
}: UseMascotAutonomousOptions = {}): UseMascotAutonomousReturn {
  const [autonomousState, setAutonomousState] = useState<StateId | null>(null);
  const [isSleeping, setIsSleeping] = useState<boolean>(false);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fidgetIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transientTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSleepingRef = useRef<boolean>(false);
  isSleepingRef.current = isSleeping;

  const isBusyRef = useRef<boolean>(false);
  isBusyRef.current = isSystemBusy;

  const lastActivityRef = useRef<number>(Date.now());
  const lastThrottleRef = useRef<number>(0);

  // Ambil state toasts untuk pemicu notifikasi lembut
  const toasts = useStore((s) => s.toasts);
  const previousToastLengthRef = useRef<number>(toasts.length);

  // Fungsi utilitas untuk memainkan animasi transien (sementara)
  const playTransientAnimation = useCallback((state: StateId, durationMs: number, onComplete?: () => void) => {
    if (transientTimeoutRef.current) {
      clearTimeout(transientTimeoutRef.current);
      transientTimeoutRef.current = null;
    }
    setAutonomousState(state);
    transientTimeoutRef.current = setTimeout(() => {
      transientTimeoutRef.current = null;
      if (onComplete) {
        onComplete();
      } else {
        setAutonomousState(null);
      }
    }, durationMs);
  }, []);

  // Jadwalkan siklus fidget santai saat idle tahap 1 (antara 20s hingga 60s)
  const scheduleNextFidget = useCallback(() => {
    if (fidgetIntervalRef.current) {
      clearTimeout(fidgetIntervalRef.current);
      fidgetIntervalRef.current = null;
    }

    // Interval acak antara 12 sampai 18 detik
    const delay = Math.floor(12_000 + Math.random() * 6_000);
    fidgetIntervalRef.current = setTimeout(() => {
      if (!isSleepingRef.current && !isBusyRef.current) {
        const randomState = FIDGET_STATES[Math.floor(Math.random() * FIDGET_STATES.length)];
        playTransientAnimation(randomState, 2_000, () => {
          setAutonomousState(null);
          scheduleNextFidget();
        });
      }
    }, delay);
  }, [playTransientAnimation]);

  // Reset timer inaktivitas
  const resetTimers = useCallback(() => {
    if (!enabled) return;

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (fidgetIntervalRef.current) clearTimeout(fidgetIntervalRef.current);

    // Jika sedang sibuk (thinking/error/dll), jangan hitung idle
    if (isBusyRef.current) return;

    // Timer Idle Tahap 1: Mulai siklus fidget
    idleTimerRef.current = setTimeout(() => {
      scheduleNextFidget();
    }, idleThresholdMs);

    // Timer Idle Tahap 2: Tidur lelap
    sleepTimerRef.current = setTimeout(() => {
      if (!isBusyRef.current) {
        if (fidgetIntervalRef.current) clearTimeout(fidgetIntervalRef.current);
        if (transientTimeoutRef.current) clearTimeout(transientTimeoutRef.current);
        setIsSleeping(true);
        setAutonomousState('sleep');
      }
    }, sleepThresholdMs);
  }, [enabled, idleThresholdMs, sleepThresholdMs, scheduleNextFidget]);

  // Penangan aktivitas pengguna (mouse / keyboard / touch)
  const handleUserActivity = useCallback(() => {
    const now = Date.now();
    // Throttle 300ms untuk performa tinggi
    if (now - lastThrottleRef.current < 300) return;
    lastThrottleRef.current = now;
    lastActivityRef.current = now;

    // Jika maskot sedang tertidur lelap, bangunkan dengan lembut
    if (isSleepingRef.current) {
      setIsSleeping(false);
      playTransientAnimation('wide', 1_200, () => {
        setAutonomousState(null);
      });
    }

    resetTimers();
  }, [playTransientAnimation, resetTimers]);

  // Deteksi event global untuk pelacakan inaktivitas
  useEffect(() => {
    if (!enabled) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (fidgetIntervalRef.current) clearTimeout(fidgetIntervalRef.current);
      if (transientTimeoutRef.current) clearTimeout(transientTimeoutRef.current);
      setAutonomousState(null);
      setIsSleeping(false);
      return;
    }

    resetTimers();

    const eventNames: (keyof WindowEventMap)[] = ['pointermove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    eventNames.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    return () => {
      eventNames.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (fidgetIntervalRef.current) clearTimeout(fidgetIntervalRef.current);
      if (transientTimeoutRef.current) clearTimeout(transientTimeoutRef.current);
    };
  }, [enabled, handleUserActivity, resetTimers]);

  // Pantau perubahan status sistem (jika sedang sibuk, tunda atau batalkan tidur)
  useEffect(() => {
    if (isSystemBusy) {
      if (isSleepingRef.current) {
        setIsSleeping(false);
        setAutonomousState(null);
      }
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (fidgetIntervalRef.current) clearTimeout(fidgetIntervalRef.current);
    } else {
      resetTimers();
    }
  }, [isSystemBusy, resetTimers]);

  // Pantau penambahan notifikasi / toast baru
  useEffect(() => {
    if (!enabled) return;

    if (toasts.length > previousToastLengthRef.current) {
      // Ada toast baru yang masuk
      if (isSleepingRef.current) {
        setIsSleeping(false);
      }
      // Reaksi lembut notifikasi pop selama 2 detik
      playTransientAnimation('notify', 2_000, () => {
        setAutonomousState(null);
        resetTimers();
      });
    }
    previousToastLengthRef.current = toasts.length;
  }, [toasts, enabled, playTransientAnimation, resetTimers]);

  // Trigger klik pengguna pada maskot
  const triggerClick = useCallback(() => {
    if (!enabled) return;
    if (isSleepingRef.current) {
      setIsSleeping(false);
    }
    playTransientAnimation('play', 1_500, () => {
      setAutonomousState(null);
      resetTimers();
    });
  }, [enabled, playTransientAnimation, resetTimers]);

  // Trigger hover pengguna pada maskot
  const triggerHover = useCallback(() => {
    if (!enabled) return;
    // Jika tidak sedang tidur dan tidak sedang menjalankan animasi transien lain
    if (!isSleepingRef.current && !transientTimeoutRef.current) {
      playTransientAnimation('wink', 1_200, () => {
        setAutonomousState(null);
      });
    }
  }, [enabled, playTransientAnimation]);

  return {
    autonomousState,
    triggerClick,
    triggerHover,
    isSleeping,
  };
}
