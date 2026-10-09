/**
 * 主题核心逻辑（纯函数，无框架依赖，便于单测）。
 *
 * - 用户偏好在 localStorage['wuyan-theme'] 中持久化：'light' | 'dark' | 'system'
 * - 解析后的实际主题写入 <html data-theme>：'light' | 'dark'
 * - 'system' 模式下跟随 prefers-color-scheme 实时变化
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'wuyan-theme';

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  dark: '#0a0e1a',
  light: '#eef4f9',
};

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function getStoredThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

export function storeThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // 隐私模式等场景下 localStorage 不可用，忽略即可
  }
}

export function prefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return prefersDark() ? 'dark' : 'light';
  return mode;
}

/** 将主题写入 DOM，并同步 <meta name="theme-color">。返回解析后的主题。 */
export function applyTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(mode);
  if (typeof document === 'undefined') return resolved;

  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themeMode = mode;
  root.style.colorScheme = resolved;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[resolved]);

  return resolved;
}

const CYCLE_ORDER: ThemeMode[] = ['system', 'light', 'dark'];

/** 三态循环切换顺序：system → light → dark → system */
export function nextThemeMode(mode: ThemeMode): ThemeMode {
  const index = CYCLE_ORDER.indexOf(mode);
  return CYCLE_ORDER[(index + 1) % CYCLE_ORDER.length] ?? 'system';
}