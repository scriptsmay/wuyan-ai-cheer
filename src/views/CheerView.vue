<script setup lang="ts">
import { RadioTower, Send } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import MoodSelector from '../components/MoodSelector.vue'
import StatusPanel from '../components/StatusPanel.vue'
import CheerResultPanel from '../components/CheerResultPanel.vue'
import { ApiError, generateCheer, getConfig } from '../lib/api'
import { getDailyUsage, incrementDailyUsage, usageKey } from '../lib/usage-limit'
import type { AppConfig, CheerResult, Mood, UiStatus } from '../types'

const mood = ref<Mood>('daily')
const customText = ref('')
const status = ref<UiStatus>('idle')
const message = ref('')
const result = ref<CheerResult | null>(null)
const lastRequestId = ref('')

const dailyLimit = ref(10)
const usedCount = ref(0)
const limitReached = computed(() => usedCount.value >= dailyLimit.value)
const cheerRemaining = computed(() => dailyLimit.value - usedCount.value)

onMounted(() => {
  loadUsage()
  loadConfig()
})

function loadUsage() {
  usedCount.value = getDailyUsage(usageKey('cheer'))
}

async function loadConfig() {
  try {
    const config: AppConfig = await getConfig()
    if (config.cheer_daily_limit) {
      dailyLimit.value = config.cheer_daily_limit
    }
  } catch { /* use default limit */ }
}

const remaining = computed(() => 120 - Array.from(customText.value).length)

async function submit(regenerate = false) {
  if (status.value === 'loading') return

  if (limitReached.value) {
    status.value = 'rate-limited'
    message.value = `今日生成次数已用完（${dailyLimit.value}次），请明日再来`
    return
  }

  status.value = 'loading'
  message.value = ''
  const requestId = regenerate || !lastRequestId.value ? crypto.randomUUID() : lastRequestId.value
  lastRequestId.value = requestId
  try {
    const next = await generateCheer(mood.value, customText.value.trim(), requestId)
    if (!next.lines.length) {
      status.value = 'empty'
      message.value = '模型没有返回可用文案，请换一种心情再试。'
      return
    }
    result.value = next
    usedCount.value = incrementDailyUsage(usageKey('cheer'))
    status.value = 'success'
  } catch (error) {
    if (error instanceof ApiError) {
      message.value = `${error.message}${error.requestId ? `（请求 ${error.requestId.slice(0, 8)}）` : ''}`
      status.value = error.code === 'RATE_LIMITED'
        ? 'rate-limited'
        : error.code === 'NETWORK_ERROR'
          ? 'network-error'
          : 'service-error'
    } else {
      message.value = error instanceof Error ? error.message : '生成失败，请稍后重试'
      status.value = 'service-error'
    }
  }
}
</script>

<template>
  <section class="page-section tool-layout">
    <aside class="tool-intro">
      <span class="eyebrow"><RadioTower :size="18" /> SIGNAL GENERATOR</span>
      <h1>今天，想把哪一种心情传给无言？</h1>
      <p>具体战绩与英雄只会引用接口返回的数据来源。没有数据时，生成纯情绪应援，不用虚构数字填满卡片。</p>
      <ol class="step-rail">
        <li class="active"><b>01</b><span>选择心情</span></li>
        <li :class="{ active: customText.length > 0 }"><b>02</b><span>补一句想说的话</span></li>
        <li :class="{ active: status === 'success' }"><b>03</b><span>保存图片 / 复制文案</span></li>
      </ol>
    </aside>

    <div class="tool-stage">
      <section class="input-panel">
        <label class="field-label">01 / 心情频道</label>
        <MoodSelector v-model="mood" />

        <label class="field-label" for="custom-text">02 / 想补充的话 <span>可选</span></label>
        <div class="textarea-wrap">
          <textarea id="custom-text" v-model="customText" maxlength="120" placeholder="例如：今天也会在台下为你加油。" />
          <span :class="{ warning: remaining < 15 }">{{ remaining }}</span>
        </div>

        <button class="primary-button submit-button" type="button" :disabled="status === 'loading'" @click="submit(true)">
          <Send :size="19" /> {{ status === 'loading' ? '正在接通信号' : '生成应援文案' }}
        </button>
        <p v-if="status !== 'loading'" class="usage-hint">
          <span v-if="!limitReached">今日剩余 {{ cheerRemaining }}/{{ dailyLimit }} 次</span>
          <span v-else class="usage-hint-limit">今日次数已用完</span>
        </p>
      </section>

      <StatusPanel
        v-if="status !== 'success'"
        :status="status"
        :message="message || undefined"
        :retryable="status === 'network-error' || status === 'service-error' || status === 'empty'"
        @retry="submit(false)"
      />
      <CheerResultPanel v-if="result" v-show="status === 'success'" :result="result" :mood="mood" @regenerate="submit(true)" />
    </div>
  </section>
</template>
