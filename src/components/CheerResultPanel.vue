<script setup lang="ts">
import { Check, Clipboard, Download, Image as ImageIcon, RefreshCw } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
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
const showRefs = ref(true)

// ---- Manual editing state ----
const editingLine = ref('')
const editingCaption = ref('')

const selectedLine = computed(() => props.result.lines[selectedIndex.value] || props.result.lines[0] || '')
const combinedCopy = computed(() => `${editingLine.value}\n${editingCaption.value}`.trim())

/** Sync editing buffers from current result data */
function syncEditingFromResult() {
  editingLine.value = selectedLine.value
  editingCaption.value = props.result.emoji_caption
}

// On new report: reset selection, clear card, sync editing state
watch(() => props.result.report_id, () => {
  selectedIndex.value = 0
  card.value = null
  cardError.value = ''
  syncEditingFromResult()
}, { immediate: true })

// When switching line tab, sync editing buffer to the newly selected line
watch(selectedIndex, () => {
  syncEditingFromResult()
})

// ---- Debounced real-time preview ----
let renderTimer: ReturnType<typeof setTimeout> | null = null
const isAutoRefreshing = ref(false)

onBeforeUnmount(() => {
  if (renderTimer) clearTimeout(renderTimer)
})

function debouncedRender() {
  if (renderTimer) clearTimeout(renderTimer)
  isAutoRefreshing.value = true
  renderTimer = setTimeout(() => {
    handleRender().finally(() => {
      isAutoRefreshing.value = false
    })
  }, 500)
}

// Watch editing state → auto re-render when card already exists
watch([editingLine, editingCaption], ([newLine, newCap], [oldLine, oldCap]) => {
  if (!card.value) return
  if (newLine === oldLine && newCap === oldCap) return
  debouncedRender()
})

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
      line: editingLine.value,
      emojiCaption: editingCaption.value,
      refs: props.result.refs,
      sourceSnapshotAt: props.result.source_snapshot_at,
      checkin: props.checkin,
      showQr: showQr.value,
      showRefs: showRefs.value,
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
      <label class="edit-field-label">主文案（可编辑）</label>
      <textarea
        v-model="editingLine"
        class="line-editor"
        rows="3"
        maxlength="80"
        placeholder="编辑应援文案…"
      />
      <span class="edit-char-count">{{ editingLine.length }}/80</span>

      <label class="edit-field-label">心情标语（可编辑）</label>
      <input
        v-model="editingCaption"
        class="caption-editor"
        maxlength="30"
        placeholder="编辑心情标语…"
      />

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
        <p v-if="isAutoRefreshing && !cardLoading" class="auto-refresh-hint">正在同步预览…</p>
      </div>
      <div v-if="card" class="card-toggles">
        <label class="qr-toggle" :class="{ disabled: cardLoading }">
          <span class="toggle-track" role="switch" :aria-checked="showQr" tabindex="0" @click="cardLoading || (showQr = !showQr) || handleRender()">
            <input v-model="showQr" type="checkbox" :disabled="cardLoading" class="toggle-input" @change="handleRender" />
            <span class="toggle-thumb" />
          </span>
          <span class="toggle-label">显示二维码</span>
        </label>
        <label v-if="result.refs.length" class="qr-toggle" :class="{ disabled: cardLoading }">
          <span class="toggle-track" role="switch" :aria-checked="showRefs" tabindex="0" @click="cardLoading || (showRefs = !showRefs) || handleRender()">
            <input v-model="showRefs" type="checkbox" :disabled="cardLoading" class="toggle-input" @change="handleRender" />
            <span class="toggle-thumb" />
          </span>
          <span class="toggle-label">显示赛季数据</span>
        </label>
      </div>
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
