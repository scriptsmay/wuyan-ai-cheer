<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { renderCheerCard, type RenderedCard } from '../lib/card-renderer';
import type { Checkin, Mood } from '../types';

/* 仅 dev 构建可用的模板预览页（路由在 router.ts 中按 import.meta.env.DEV 注册） */

const dateLabel = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());

function mockCheckin(): Checkin {
  const now = new Date().toISOString();
  return {
    _id: 'preview',
    date: dateLabel,
    tz: 'Asia/Shanghai',
    streak: 12,
    total_days: 87,
    created_at: now,
    updated_at: now,
  };
}

interface CaseDef {
  key: string;
  label: string;
  mood?: Mood;
  checkin?: boolean;
  templateId: string;
}

const cases: CaseDef[] = [
  { key: 'note', label: 'note · 手写日签（打卡卡）', templateId: 'note', checkin: true, mood: 'daily' },
  { key: 'poster', label: 'poster · 大字报（victory）', templateId: 'poster', mood: 'victory' },
  { key: 'magazine', label: 'magazine · 杂志留白（daily）', templateId: 'magazine', mood: 'daily' },
  { key: 'dusk', label: 'dusk · 暮色弥散（low）', templateId: 'dusk', mood: 'low' },
  { key: 'dawn', label: 'dawn · 晨光弥散（hope）', templateId: 'dawn', mood: 'hope' },
  { key: 'signal', label: 'signal · 深色信号（经典变体）', templateId: 'signal', mood: 'daily' },
];

const LINES: Record<string, string> = {
  note: '打卡第 87 天，习惯已经长在身上啦，今天也稳稳完成！',
  poster: '把胜利留在今天，把冠军写进赛季，冲呀！',
  magazine: '今天也要按部就班地努力，稳稳地前进。',
  dusk: '低谷没关系，慢慢充电，星星会陪着我们。',
  dawn: '新的一天新的期待，阳光已经在路上了。',
  signal: '信号已就位，今天也要全力应援！',
};

const CAPTIONS: Record<string, string> = {
  note: '又是元气满满的一天',
  poster: '胜利是我们的',
  magazine: '稳稳的日常',
  dusk: '充电中，别催',
  dawn: '元气满格',
  signal: '保持在线',
};

const REFS = [
  { label: '本赛季胜率', value: '58.2%', source: 'kpl' },
  { label: '登场次数', value: '126', source: 'kpl' },
];

const cards = ref<Record<string, RenderedCard | null>>({});
const globalVariant = ref(0);
const variants = ref<Record<string, number>>({});

async function renderCase(c: CaseDef): Promise<void> {
  try {
    cards.value[c.key] = await renderCheerCard({
      line: LINES[c.key] ?? '',
      emojiCaption: CAPTIONS[c.key] ?? '',
      refs: REFS,
      sourceSnapshotAt: '',
      showQr: true,
      showRefs: true,
      mood: c.mood,
      checkin: c.checkin ? mockCheckin() : undefined,
      templateId: c.templateId as never,
      variant: variants.value[c.key] ?? globalVariant.value,
    });
  } catch (error) {
    console.error(`[preview] ${c.key} 渲染失败`, error);
  }
}

async function renderAll(): Promise<void> {
  await Promise.all(cases.map((c) => renderCase(c)));
}

function reroll(c: CaseDef): void {
  variants.value[c.key] = (variants.value[c.key] ?? globalVariant.value) + 1;
  renderCase(c);
}

async function rerollAll(): Promise<void> {
  globalVariant.value += 1;
  variants.value = {};
  await renderAll();
}

onMounted(renderAll);
</script>

<template>
  <section class="card-preview-page">
    <header class="preview-header">
      <h1>卡片模板预览（仅 dev 构建）</h1>
      <button type="button" class="reroll-all" @click="rerollAll">换一批（variant {{ globalVariant }}）</button>
    </header>
    <div class="preview-grid">
      <figure v-for="c in cases" :key="c.key">
        <figcaption>{{ c.label }}</figcaption>
        <img v-if="cards[c.key]" :src="cards[c.key]!.dataUrl" :alt="c.label" @click="reroll(c)" />
        <p v-else class="rendering">渲染中…</p>
        <small>variant {{ variants[c.key] ?? globalVariant }} · 点击图片单独换一个</small>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.card-preview-page {
  min-height: 100vh;
  padding: 32px;
  background: #14161c;
  color: #e8e8e8;
}
.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.preview-header h1 {
  font-size: 20px;
}
.reroll-all {
  padding: 8px 18px;
  border: 1px solid #4a4f5c;
  border-radius: 8px;
  background: transparent;
  color: #e8e8e8;
  cursor: pointer;
}
.preview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}
.preview-grid figure {
  margin: 0;
}
.preview-grid figcaption {
  margin-bottom: 8px;
  font-size: 14px;
}
.preview-grid img {
  width: 100%;
  border-radius: 8px;
  cursor: pointer;
}
.preview-grid small {
  display: block;
  margin-top: 6px;
  color: #8a8f9c;
  font-size: 12px;
}
.rendering {
  display: grid;
  place-items: center;
  aspect-ratio: 3 / 4;
  border: 1px dashed #4a4f5c;
  border-radius: 8px;
  color: #8a8f9c;
}
</style>
