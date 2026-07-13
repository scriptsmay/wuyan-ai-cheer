<script setup lang="ts">
import { CalendarCheck, Image as ImageIcon, RadioTower } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import CheerResultPanel from '../components/CheerResultPanel.vue'
import StatusPanel from '../components/StatusPanel.vue'
import { ApiError, createCheckin, generateCheer, getCheckinStats, getMyCheckin, getMyCheckinReport } from '../lib/api'
import type { CheerResult, CheckinResult, CheckinStats, MyCheckin, UiStatus } from '../types'

const me = ref<MyCheckin | null>(null)
const stats = ref<CheckinStats | null>(null)
const result = ref<CheckinResult | null>(null)
const cheer = ref<CheerResult | null>(null)
const status = ref<UiStatus>('loading')
const message = ref('')

onMounted(load)

async function load() {
  status.value = 'loading'
  try {
    const [nextMe, nextStats] = await Promise.all([getMyCheckin(), getCheckinStats()])
    me.value = nextMe
    stats.value = nextStats
    status.value = 'idle'
  } catch (error) {
    handleError(error)
  }
}

async function checkIn(regenerate = false) {
  if (status.value === 'loading') return
  status.value = 'loading'
  try {
    const requestId = crypto.randomUUID()
    const nextCheer = !regenerate && cheer.value
      ? cheer.value
      : await generateCheer('daily', '今天也来完成每日加油打卡', requestId)
    const nextResult = await createCheckin(nextCheer.report_id)
    cheer.value = nextCheer
    result.value = nextResult
    me.value = {
      checked_in_today: true,
      streak: nextResult.checkin.streak,
      total_days: nextResult.checkin.total_days,
      today: nextResult.checkin
    }
    if (stats.value) stats.value.today_count = nextResult.today_count
    status.value = 'success'
  } catch (error) {
    handleError(error)
  }
}

async function viewTodayReport() {
  if (status.value === 'loading') return
  status.value = 'loading'
  try {
    const report = await getMyCheckinReport()
    cheer.value = report
    result.value = {
      checkin: me.value!.today!,
      already_checked_in: true,
      today_count: stats.value?.today_count ?? 0
    }
    status.value = 'success'
  } catch (error) {
    handleError(error)
  }
}

function handleError(error: unknown) {
  if (error instanceof ApiError) {
    message.value = error.message
    status.value = error.code === 'RATE_LIMITED'
      ? 'rate-limited'
      : error.code === 'NETWORK_ERROR'
        ? 'network-error'
        : 'service-error'
  } else {
    message.value = error instanceof Error ? error.message : '打卡服务暂时不可用'
    status.value = 'service-error'
  }
}
</script>

<template>
  <section class="page-section checkin-layout">
    <div class="checkin-hero">
      <span class="eyebrow"><CalendarCheck :size="18" /> DAILY SIGNAL</span>
      <h1>今天的加油，<br />由你按下发送键。</h1>
      <p>进入页面不会自动写入。点击后由服务端按北京时间自然日记账，同一匿名身份一天只增加一次。</p>

      <div class="stat-strip">
        <div><span>今日信号</span><b>{{ stats?.today_count ?? '—' }}</b><small>人</small></div>
        <div><span>连续加油</span><b>{{ me?.streak ?? '—' }}</b><small>天</small></div>
        <div><span>累计加油</span><b>{{ me?.total_days ?? '—' }}</b><small>天</small></div>
      </div>

      <button class="checkin-trigger" type="button" :disabled="status === 'loading'" @click="checkIn(false)">
        <RadioTower :size="31" />
        <span>
          <strong>{{ me?.checked_in_today ? '重新生成今日加油卡' : '发送今日加油信号' }}</strong>
          <small>{{ me?.checked_in_today ? '会生成新文案，但不会重复增加打卡统计' : '生成文案后完成一次幂等打卡' }}</small>
        </span>
      </button>
    </div>

    <div class="checkin-stage">
      <StatusPanel
        v-if="status !== 'success'"
        :status="status"
        :title="me?.checked_in_today ? '今日已经打过卡' : undefined"
        :message="message || (me?.checked_in_today ? '可以查看今日卡片，或点击重新生成（统计不会重复增加）。' : undefined)"
        :retryable="status === 'network-error' || status === 'service-error'"
        @retry="load"
      >
        <template #action>
          <button
            v-if="me?.checked_in_today && me?.today?.report_id"
            class="ghost-button compact"
            type="button"
            :disabled="status === 'loading'"
            @click="viewTodayReport"
          >
            <ImageIcon :size="16" /> 查看今日卡片
          </button>
        </template>
      </StatusPanel>
      <CheerResultPanel
        v-if="cheer && result"
        :result="cheer"
        :checkin="result.checkin"
        @regenerate="checkIn(true)"
      />
    </div>
  </section>
</template>
