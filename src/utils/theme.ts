export type AppTheme = 'system' | 'light' | 'dark';
export type AppContrast = 'default' | 'strong';
export type DarkPreset = 'default' | 'charcoal' | 'oled';

let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
let currentMediaQuery: MediaQueryList | null = null;
let systemPollTimer: number | null = null;
let currentActiveTheme: AppTheme = 'system';
let currentActiveContrast: AppContrast = 'default';
let currentActiveDarkPreset: DarkPreset = 'default';

async function queryNativeSystemTheme(): Promise<'dark' | 'light'> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const detected = await invoke<string>('get_system_theme');
    if (detected === 'light' || detected === 'dark') {
      return detected;
    }
  } catch {
    // Fallback if not running in Tauri or IPC fails
  }

  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'dark';
}

function syncDomClasses(isDark: boolean, contrast: AppContrast, darkPreset: DarkPreset): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const body = document.body;

  // Clean previous preset classes
  root.classList.remove('preset-default', 'preset-charcoal', 'preset-oled');
  body.classList.remove('preset-default', 'preset-charcoal', 'preset-oled');

  if (isDark) {
    root.classList.remove('theme-light');
    root.classList.add('theme-dark', 'dark', `preset-${darkPreset}`);
    body.classList.remove('theme-light');
    body.classList.add('theme-dark', 'dark', `preset-${darkPreset}`);
  } else {
    root.classList.remove('theme-dark', 'dark', 'preset-default', 'preset-charcoal', 'preset-oled');
    root.classList.add('theme-light');
    body.classList.remove('theme-dark', 'dark', 'preset-default', 'preset-charcoal', 'preset-oled');
    body.classList.add('theme-light');
  }

  if (contrast === 'strong') {
    root.classList.add('contrast-strong');
    body.classList.add('contrast-strong');
  } else {
    root.classList.remove('contrast-strong');
    body.classList.remove('contrast-strong');
  }
}

/**
 * Applies active theme and contrast classes to the document root and body elements.
 * When theme is 'system', queries native OS color-scheme via Tauri IPC and falls back to matchMedia.
 */
export function applyTheme(
  theme: AppTheme,
  contrast: AppContrast,
  darkPreset: DarkPreset = 'default'
): void {
  if (typeof document === 'undefined') return;

  currentActiveTheme = theme;
  currentActiveContrast = contrast;
  currentActiveDarkPreset = darkPreset;

  // Clean up any existing listeners/intervals
  if (systemPollTimer !== null) {
    window.clearInterval(systemPollTimer);
    systemPollTimer = null;
  }

  if (currentMediaQuery && mediaQueryListener) {
    if (typeof currentMediaQuery.removeEventListener === 'function') {
      currentMediaQuery.removeEventListener('change', mediaQueryListener);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (currentMediaQuery as any).removeListener?.(mediaQueryListener);
    }
    mediaQueryListener = null;
    currentMediaQuery = null;
  }

  if (theme === 'system') {
    // 1. Immediate detection via native IPC / matchMedia
    queryNativeSystemTheme().then((mode) => {
      if (currentActiveTheme === 'system') {
        syncDomClasses(mode === 'dark', contrast, darkPreset);
      }
    });

    // 2. Browser matchMedia listener
    if (typeof window !== 'undefined' && window.matchMedia) {
      currentMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQueryListener = async () => {
        if (currentActiveTheme === 'system') {
          const mode = await queryNativeSystemTheme();
          syncDomClasses(mode === 'dark', currentActiveContrast, currentActiveDarkPreset);
        }
      };

      if (typeof currentMediaQuery.addEventListener === 'function') {
        currentMediaQuery.addEventListener('change', mediaQueryListener);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (currentMediaQuery as any).addListener?.(mediaQueryListener);
      }
    }

    // 3. Gentle background poll every 1.5s to track OS theme switches on Linux
    if (typeof window !== 'undefined') {
      systemPollTimer = window.setInterval(async () => {
        if (currentActiveTheme === 'system') {
          const mode = await queryNativeSystemTheme();
          syncDomClasses(mode === 'dark', currentActiveContrast, currentActiveDarkPreset);
        }
      }, 1500);
    }
  } else {
    syncDomClasses(theme === 'dark', contrast, darkPreset);
  }
}
