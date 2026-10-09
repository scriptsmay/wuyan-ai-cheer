import { ref, readonly } from 'vue';
import {
  applyTheme,
  getStoredThemeMode,
  nextThemeMode,
  resolveTheme,
  storeThemeMode,
  type ResolvedTheme,
  type ThemeMode,
} from '../lib/theme';

/**
 * 模块级单例：全应用共享同一份主题状态，ThemeToggle 与任意消费者保持一致。
 */

const mode = ref<ThemeMode>(getStoredThemeMode());
const resolved = ref<ResolvedTheme>(resolveTheme(mode.value));

let initialized = false;
let transitionTimer: ReturnType<typeof setTimeout> | null = null;

function withTransition(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.add('theme-transition');
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => root.classList.remove('theme-transition'), 360);
}

function commit(next: ThemeMode): void {
  mode.value = next;
  storeThemeMode(next);
  resolved.value = applyTheme(next);
}

function handleSystemChange(): void {
  if (mode.value !== 'system') return;
  resolved.value = applyTheme('system');
}

function initTheme(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  resolved.value = applyTheme(mode.value);

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener?.('change', handleSystemChange);
}

export function useTheme() {
  initTheme();

  function setMode(next: ThemeMode): void {
    if (next === mode.value && resolved.value === resolveTheme(next)) return;
    withTransition();
    commit(next);
  }

  function cycle(): void {
    setMode(nextThemeMode(mode.value));
  }

  return {
    mode: readonly(mode),
    resolved: readonly(resolved),
    setMode,
    cycle,
  };
}