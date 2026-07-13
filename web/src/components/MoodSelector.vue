<script setup lang="ts">
import { CircleDot, Flame, Radio, Trophy } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { Mood } from '../types'

defineProps<{ modelValue: Mood }>()
defineEmits<{ 'update:modelValue': [value: Mood] }>()

interface MoodOption {
  value: Mood
  title: string
  caption: string
  icon: Component
}

const options: MoodOption[] = [
  { value: 'victory', title: '胜利', caption: '把高光喊得更响', icon: Trophy },
  { value: 'low', title: '低谷', caption: '稳稳陪他找回节奏', icon: CircleDot },
  { value: 'daily', title: '日常', caption: '今天也在并肩', icon: Radio },
  { value: 'hope', title: '求胜', caption: '下一场全力冲锋', icon: Flame }
]
</script>

<template>
  <div class="mood-grid" role="radiogroup" aria-label="选择当前心情">
    <button
      v-for="option in options"
      :key="option.value"
      class="mood-option"
      :class="[`mood-${option.value}`, { selected: modelValue === option.value }]"
      type="button"
      role="radio"
      :aria-checked="modelValue === option.value"
      @click="$emit('update:modelValue', option.value)"
    >
      <component :is="option.icon" :size="24" />
      <span><strong>{{ option.title }}</strong><small>{{ option.caption }}</small></span>
    </button>
  </div>
</template>
