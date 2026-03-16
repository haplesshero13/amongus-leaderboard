export type ThemeMode = 'light' | 'dark';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';
let hasManualThemeOverride = false;

export const THEME_INIT_SCRIPT = `
(() => {
  const theme = window.matchMedia('${DARK_MEDIA_QUERY}').matches ? 'dark' : 'light';

  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
})();
`.trim();

export function resolveThemeMode(): ThemeMode {
  if (typeof document !== 'undefined') {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }

  return getSystemThemeMode();
}

export function hasManualThemeModeOverride() {
  return hasManualThemeOverride;
}

export function applyThemeMode(themeMode: ThemeMode, source: 'manual' | 'system' = 'manual') {
  if (typeof document === 'undefined') {
    return;
  }

  hasManualThemeOverride = source === 'manual';
  document.documentElement.classList.toggle('dark', themeMode === 'dark');
  document.documentElement.style.colorScheme = themeMode;
}

export function getSystemThemeMode(): ThemeMode {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
  }

  return 'light';
}
