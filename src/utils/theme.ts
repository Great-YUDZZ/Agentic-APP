export type AppTheme = 'system' | 'light' | 'dark';
export type AppContrast = 'default' | 'strong';

let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
let currentMediaQuery: MediaQueryList | null = null;

/**
 * Applies active theme and contrast classes to the document root and body elements.
 * When theme is 'system', dynamically listens for OS-level color scheme changes.
 */
export function applyTheme(theme: AppTheme, contrast: AppContrast): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const body = document.body;

  // Detach previous media query listener if attached
  if (currentMediaQuery && mediaQueryListener) {
    if (typeof currentMediaQuery.removeEventListener === 'function') {
      currentMediaQuery.removeEventListener('change', mediaQueryListener);
    } else {
      // Fallback for older WebKit / GTK environments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (currentMediaQuery as any).removeListener?.(mediaQueryListener);
    }
    mediaQueryListener = null;
    currentMediaQuery = null;
  }

  const applyClasses = (isDark: boolean) => {
    // Synchronize theme classes
    if (isDark) {
      root.classList.remove('theme-light');
      root.classList.add('theme-dark', 'dark');
      body.classList.remove('theme-light');
      body.classList.add('theme-dark', 'dark');
    } else {
      root.classList.remove('theme-dark', 'dark');
      root.classList.add('theme-light');
      body.classList.remove('theme-dark', 'dark');
      body.classList.add('theme-light');
    }

    // Synchronize contrast classes
    if (contrast === 'strong') {
      root.classList.add('contrast-strong');
      body.classList.add('contrast-strong');
    } else {
      root.classList.remove('contrast-strong');
      body.classList.remove('contrast-strong');
    }
  };

  if (theme === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      currentMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyClasses(currentMediaQuery.matches);

      mediaQueryListener = (e: MediaQueryListEvent) => {
        applyClasses(e.matches);
      };

      if (typeof currentMediaQuery.addEventListener === 'function') {
        currentMediaQuery.addEventListener('change', mediaQueryListener);
      } else {
        // Fallback for older WebKit / GTK environments
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (currentMediaQuery as any).addListener?.(mediaQueryListener);
      }
    } else {
      applyClasses(true);
    }
  } else {
    applyClasses(theme === 'dark');
  }
}
