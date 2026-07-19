<script setup lang="ts">
import { Check, Clipboard, Download, Image as ImageIcon, RefreshCw } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { copyText } from '../lib/clipboard'
import { downloadCard, requiresLongPressSave } from '../lib/download'
import { renderCheerCard, type RenderedCard } from '../lib/card-renderer'
import type { CheerResult, Checkin, Mood } from '../types'

const props = defineProps<{
  result: CheerResult
  checkin?: Checkin
  mood?: Mood
}>()
defineEmits<{ regenerate: [] }>()

const selectedIndex = ref(0)
const copied = ref(false)
const card = ref<RenderedCard | null>(null)
const cardLoading = ref(false)
const cardError = ref('')
const showQr = ref(true)

const selectedLine = computed(() => props.result.lines[selectedIndex.value] || props.result.lines[0] || '')
const combinedCopy = computed(() => `${selectedLine.value}\n${props.result.emoji_caption}`.trim())

watch(() => props.result.report_id, () => {
  selectedIndex.value = 0
  card.value = null
  cardError.value = ''
}, { immediate: true })

async function handleCopy() {
  await copyText(combinedCopy.value)
  copied.value = true
  window.setTimeout(() => { copied.value = false }, 1600)
}

async function handleRender() {
  cardLoading.value = true
  cardError.value = ''
  try {
    card.value = await renderCheerCard({
      line: selectedLine.value,
      emojiCaption: props.result.emoji_caption,
      refs: props.result.refs,
      sourceSnapshotAt: props.result.source_snapshot_at,
      checkin: props.checkin,
      showQr: showQr.value,
      mood: props.mood
    })
  } catch (error) {
    cardError.value = error instanceof Error ? error.message : '应援卡生成失败'
  } finally {
    cardLoading.value = false
  }
}

function handleDownload() {
  if (card.value) downloadCard(card.value)
}
</script>

<template>
  <section class="result-workbench">
    <div class="result-copy-column">
      <span class="eyebrow">SIGNAL RECEIVED / {{ result.lines.length }} LINES</span>
      <div class="line-tabs" role="tablist" aria-label="选择应援文案">
        <button
          v-for="(line, index) in result.lines"
          :key="`${result.report_id}-${index}`"
          :class="{ active: selectedIndex === index }"
          type="button"
          role="tab"
          @click="selectedIndex = index"
        >
          {{ String(index + 1).padStart(2, '0') }}
          <span>{{ line }}</span>
        </button>
      </div>
      <blockquote>{{ selectedLine }}</blockquote>
      <p class="emoji-caption">{{ result.emoji_caption }}</p>

      <dl v-if="result.refs.length" class="source-list">
        <div v-for="item in result.refs" :key="`${item.label}-${item.value}`">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>

      <div class="action-row">
        <button class="primary-button" type="button" @click="handleCopy">
          <Check v-if="copied" :size="18" />
          <Clipboard v-else :size="18" />
          {{ copied ? '已复制' : '复制文案' }}
        </button>
        <button class="ghost-button" type="button" @click="$emit('regenerate')">
          <RefreshCw :size="18" /> 再生成一次
        </button>
      </div>
    </div>

    <div class="card-preview-column">
      <div v-if="card" class="card-image-wrap">
        <img :src="card.dataUrl" alt="生成的 3:4 无言应援卡预览" />
        <p v-if="requiresLongPressSave()" class="save-hint">请长按上方图片保存到相册</p>
      </div>
      <label v-if="card" class="qr-toggle" :class="{ disabled: cardLoading }">
        <span class="toggle-track" role="switch" :aria-checked="showQr" tabindex="0" @click="cardLoading || (showQr = !showQr) || handleRender()">
          <input v-model="showQr" type="checkbox" :disabled="cardLoading" class="toggle-input" @change="handleRender" />
          <span class="toggle-thumb" />
        </span>
        <span class="toggle-label">显示二维码</span>
      </label>
      <button v-else class="card-placeholder" type="button" :disabled="cardLoading" @click="handleRender">
        <ImageIcon :size="44" />
        <strong>{{ cardLoading ? '正在合成 1080 × 1440 图片' : '点击生成应援卡' }}</strong>
        <small>{{ cardLoading ? '约需 2-5 秒' : '基于当前文案生成 3:4 图片' }}</small>
      </button>
      <p v-if="cardError" class="inline-error">{{ cardError }}</p>
      <button v-if="card && !requiresLongPressSave()" class="secondary-button wide" type="button" @click="handleDownload">
        <Download :size="18" /> 下载 PNG
      </button>
      <button v-if="card" class="text-button" type="button" @click="handleRender">按当前文案重新合成</button>
    </div>
  </section>
</template>
