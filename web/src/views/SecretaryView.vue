<script setup lang="ts">
import { Bot, RadioTower, Send } from 'lucide-vue-next'
import { computed, nextTick, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ApiError, askQuestion, getConfig } from '../lib/api'
import { getDailyUsage, incrementDailyUsage, usageKey } from '../lib/usage-limit'
import type { ChatMessage } from '../types'

const messages = ref<ChatMessage[]>([])
const inputValue = ref('')
const loading = ref(false)
const dailyLimit = ref(10)
const usedCount = ref(0)
const chatEl = ref<HTMLElement | null>(null)

const limitReached = computed(() => usedCount.value >= dailyLimit.value)
const remaining = computed(() => dailyLimit.value - usedCount.value)

const quickQuestions = [
  '他KDA多少',
  '胜率多少',
  '最近状态怎么样',
  '常用英雄有哪些',
  '今天有比赛吗',
  '直播时间是什么时候'
]

onMounted(async () => {
  addAiMessage('你好！我是无言小秘书，随时为你解答关于无言的赛事数据问题～')
  loadLocalUsage()
  await loadConfig()
  await scrollToBottom()
})

function loadLocalUsage() {
  usedCount.value = getDailyUsage(usageKey('ask'))
}

async function loadConfig() {
  try {
    const config = await getConfig()
    if (config && config.ask_daily_limit) {
      dailyLimit.value = config.ask_daily_limit
    }
  } catch {
    // use default limit
  }
}

async function sendMessage() {
  if (!inputValue.value.trim() || loading.value) return

  if (limitReached.value) {
    inputValue.value = ''
    addAiMessage(`今日提问次数已达上限（${dailyLimit.value}次），请明日再来～`)
    return
  }

  const q = inputValue.value.trim()
  inputValue.value = ''
  loading.value = true

  addUserMessage(q)

  try {
    const res = await askQuestion(q, crypto.randomUUID())
    incrementDailyUsage(usageKey('ask'))
    usedCount.value = getDailyUsage(usageKey('ask'))
    addAiMessage(res.answer || '暂无回答')
  } catch (err) {
    let errorMsg = '小秘书暂时开小差，稍后再试～'
    if (err instanceof ApiError) {
      if (err.status === 429 || err.code === 'RATE_LIMITED') {
        errorMsg = '今日 AI 调用已达上限，请明日再来'
        usedCount.value = dailyLimit.value
      } else if (err.code === 'NETWORK_ERROR') {
        errorMsg = '网络连接失败，请检查网络后重试'
      }
    } else if (err instanceof Error && err.message.includes('404')) {
      errorMsg = '暂无相关数据'
    }
    addAiMessage(errorMsg)
  } finally {
    loading.value = false
  }
}

function handleQuickQuestion(question: string) {
  inputValue.value = question
  sendMessage()
}

function addUserMessage(content: string) {
  messages.value.push({ id: Date.now().toString(), type: 'user', content })
  scrollToBottom()
}

function addAiMessage(content: string) {
  messages.value.push({ id: Date.now().toString(), type: 'ai', content })
  scrollToBottom()
}

async function scrollToBottom() {
  await nextTick()
  if (chatEl.value) {
    chatEl.value.scrollTop = chatEl.value.scrollHeight
  }
}
</script>

<template>
  <section class="page-section secretary-layout">
    <div class="chat-container">
      <div class="chat-header">
        <div class="avatar-wrap">
          <Bot :size="38" />
        </div>
        <div class="header-info">
          <h2>无言小秘书</h2>
          <p>AI 回答基于真实赛事数据，仅供参考</p>
        </div>
      </div>

      <div ref="chatEl" class="chat-messages">
        <div class="message-list">
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="message-item"
          >
            <div v-if="msg.type === 'ai'" class="ai-content">
              <div class="ai-avatar">
                <Bot :size="22" />
              </div>
              <div class="ai-bubble">
                <p class="bubble-text">{{ msg.content }}</p>
              </div>
            </div>
            <div v-else class="user-content">
              <div class="user-bubble">
                <p class="bubble-text">{{ msg.content }}</p>
              </div>
            </div>
          </div>

          <div v-if="loading" class="loading-item">
            <div class="ai-avatar">
              <Bot :size="22" />
            </div>
            <div class="loading-bubble">
              <div class="loading-dots">
                <span class="dot" />
                <span class="dot" />
                <span class="dot" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="quick-chips">
        <button
          v-for="q in quickQuestions"
          :key="q"
          class="chip"
          type="button"
          @click="handleQuickQuestion(q)"
        >
          {{ q }}
        </button>
      </div>

      <div class="func-bar">
        <RouterLink class="func-item" to="/cheer">
          <RadioTower :size="18" />
          <span>AI 应援</span>
        </RouterLink>
      </div>

      <div class="input-area">
        <input
          v-model="inputValue"
          class="input-field"
          type="text"
          placeholder="问问小秘书..."
          @keyup.enter="sendMessage"
        />
        <button
          class="send-btn"
          type="button"
          :disabled="!inputValue || loading"
          @click="sendMessage"
        >
          <Send :size="18" />
        </button>
      </div>
      <div class="usage-hint">
        <span v-if="!limitReached">今日剩余 {{ remaining }}/{{ dailyLimit }} 次</span>
        <span v-else class="limit-reached">今日次数已用完</span>
      </div>
    </div>
  </section>
</template>
