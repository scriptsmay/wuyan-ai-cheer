<script setup lang="ts">
import { AlertTriangle, LoaderCircle, RadioTower, RefreshCw } from 'lucide-vue-next'
import type { UiStatus } from '../types'

defineProps<{
  status: UiStatus
  title?: string
  message?: string
  retryable?: boolean
}>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <section class="status-panel" :class="`status-${status}`" aria-live="polite">
    <LoaderCircle v-if="status === 'loading'" class="spin" :size="30" />
    <AlertTriangle v-else-if="status === 'rate-limited' || status === 'network-error' || status === 'service-error'" :size="30" />
    <RadioTower v-else :size="30" />
    <div>
      <strong>{{ title || (status === 'loading' ? '信号生成中' : '等待你的应援信号') }}</strong>
      <p>{{ message || (status === 'loading' ? '正在读取最新数据并组织文案，最长等待 20 秒。' : '选择一种心情，生成可复制的文案和 3:4 应援卡。') }}</p>
    </div>
    <button v-if="retryable" class="ghost-button compact" type="button" @click="$emit('retry')">
      <RefreshCw :size="16" /> 重试
    </button>
    <slot name="action" />
  </section>
</template>
