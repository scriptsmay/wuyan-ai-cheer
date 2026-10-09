import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  getStoredThemeMode,
  isThemeMode,
  nextThemeMode,
  prefersDark,
  resolveTheme,
  storeThemeMode,
  THEME_STORAGE_KEY,
} from '../src/lib/theme';

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-mode');
    document.documentElement.style.colorScheme = '';
    mockMatchMedia(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('isThemeMode 只接受 light / dark / system', () => {
    expect(isThemeMode('light')).toBe(true);
    expect(isThemeMode('dark')).toBe(true);
    expect(isThemeMode('system')).toBe(true);
    expect(isThemeMode('blue')).toBe(false);
    expect(isThemeMode(null)).toBe(false);
    expect(isThemeMode(undefined)).toBe(false);
  });

  it('默认 system，读写可往返，非法值回退 system', () => {
    expect(getStoredThemeMode()).toBe('system');

    storeThemeMode('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(getStoredThemeMode()).toBe('light');

    localStorage.setItem(THEME_STORAGE_KEY, 'garbage');
    expect(getStoredThemeMode()).toBe('system');
  });

  it('system 模式跟随系统偏好', () => {
    mockMatchMedia(true);
    expect(prefersDark()).toBe(true);
    expect(resolveTheme('system')).toBe('dark');

    mockMatchMedia(false);
    expect(prefersDark()).toBe(false);
    expect(resolveTheme('system')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('applyTheme 写入 data-theme / data-theme-mode / colorScheme', () => {
    mockMatchMedia(false);
    expect(applyTheme('system')).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.themeMode).toBe('system');

    expect(applyTheme('dark')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('nextThemeMode 按 system → light → dark 循环', () => {
    expect(nextThemeMode('system')).toBe('light');
    expect(nextThemeMode('light')).toBe('dark');
    expect(nextThemeMode('dark')).toBe('system');
  });
});