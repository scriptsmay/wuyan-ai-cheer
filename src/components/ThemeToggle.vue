<script setup lang="ts">
import { computed } from 'vue';
import { Monitor, Moon, Sun } from '@lucide/vue';
import type { Component } from 'vue';
import { useTheme } from '../composables/useTheme';
import type { ThemeMode } from '../lib/theme';

const { mode, cycle } = useTheme();

const PRESETS: Record<ThemeMode, { icon: Component; label: string; hint: string }> = {
  system: { icon: Monitor, label: '自动', hint: '跟随系统' },
  light: { icon: Sun, label: '浅色', hint: '浅色主题' },
  dark: { icon: Moon, label: '深色', hint: '深色主题' },
};

const current = computed(() => PRESETS[mode.value]);
</script>

<template>
  <button
    class="theme-toggle"
    type="button"
    :title="`主题：${current.hint}（点击切换）`"
    :aria-label="`当前主题 ${current.hint}，点击切换主题`"
    @click="cycle"
  >
    <component :is="current.icon" :size="15" />
    <span>{{ current.label }}</span>
  </button>
</template>