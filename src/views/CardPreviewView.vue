<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { renderCheerCard, type CardInput, type RenderedCard } from '../lib/card-renderer';
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
  /** 只属于某一明暗外观的模板：auto 档按原生外观渲染；两主题共用的模板留空，走 <html data-theme> 真实链路 */
  appearance?: CardInput['appearance'];
}

const ALL_CASES: CaseDef[] = [
  { key: 'note', label: 'note · 手写日签（打卡卡）', templateId: 'note', checkin: true, mood: 'daily' },
  { key: 'poster', label: 'poster · 大字报（victory）', templateId: 'poster', mood: 'victory' },
  { key: 'magazine', label: 'magazine · 杂志留白（daily）', templateId: 'magazine', mood: 'daily' },
  { key: 'dusk', label: 'dusk · 暮色弥散（low）', templateId: 'dusk', mood: 'low', appearance: 'dark' },
  { key: 'dawn', label: 'dawn · 晨光弥散（hope）', templateId: 'dawn', mood: 'hope' },
  { key: 'signal', label: 'signal · 深色信号（经典变体）', templateId: 'signal', mood: 'daily', appearance: 'dark' },
  { key: 'pulse', label: 'pulse · 亮色信号（daily）', templateId: 'pulse', mood: 'daily', appearance: 'light' },
  {
    key: 'blueprint',
    label: 'blueprint · 蓝图方格纸（daily）',
    templateId: 'blueprint',
    mood: 'daily',
    appearance: 'light',
  },
  { key: 'mist', label: 'mist · 柔雾晨光（low）', templateId: 'mist', mood: 'low', appearance: 'light' },
  {
    key: 'clipping',
    label: 'clipping · 清新剪报（victory）',
    templateId: 'clipping',
    mood: 'victory',
    appearance: 'light',
  },
];

const LINES: Record<string, string> = {
  note: '打卡第 87 天，习惯已经长在身上啦，今天也稳稳完成！',
  poster: '还记得无言关羽开大的那波绕后吗，19局78.9%的胜率不是白来的，每次想到那把刀落下来的瞬间都起鸡皮疙瘩',
  magazine: '今天也要按部就班地努力，稳稳地前进。',
  dusk: '低谷没关系，慢慢充电，星星会陪着我们。',
  dawn: '新的一天新的期待，阳光已经在路上了。',
  signal: '信号已就位，今天也要全力应援！',
  pulse: '应援信号满格，今天也要为无言大声打 call！',
  blueprint: '把每一次训练都画进结构图里，尺寸精准，进度可见。',
  mist: '今天电量只剩一格，那就先慢慢回血，光会等我们的。',
  clipping: '把这波连胜剪下来贴在墙上，抬头就能看见！',
};

const CAPTIONS: Record<string, string> = {
  note: '又是元气满满的一天',
  poster: '胜利是我们的',
  magazine: '稳稳的日常',
  dusk: '充电中，别催',
  dawn: '元气满格',
  signal: '保持在线',
  pulse: '满格在线',
  blueprint: '按图施工',
  mist: '慢慢回血',
  clipping: '剪下来收藏',
};

const REFS = [
  { label: '本赛季胜率', value: '58.2%', source: 'kpl' },
  { label: '登场次数', value: '126', source: 'kpl' },
  { label: '当前赛季 KDA', value: '4.8', source: 'kpl' },
  { label: 'MVP 次数', value: '18', source: 'kpl' },
  { label: '场均助攻', value: '8.2', source: 'kpl' },
  { label: '常用英雄', value: '鲁班大师、苏烈、张飞', source: 'kpl' },
];

const cards = ref<Record<string, RenderedCard | null>>({});
const globalVariant = ref(0);
const variants = ref<Record<string, number>>({});

/* auto = 不传 appearance，走 renderCheerCard 内部读取 <html data-theme> 的默认逻辑 */
type PreviewAppearance = 'auto' | 'light' | 'dark';
const APPEARANCES: PreviewAppearance[] = ['auto', 'light', 'dark'];
const appearance = ref<PreviewAppearance>('auto');

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
      appearance: appearance.value === 'auto' ? c.appearance : appearance.value,
      variant: variants.value[c.key] ?? globalVariant.value,
    });
  } catch (error) {
    console.error(`[preview] ${c.key} 渲染失败`, error);
  }
}

/** ?only=pulse 单看一个模板，方便逐张放大检查 */
const only = new URLSearchParams(window.location.search).get('only');
const cases = only ? ALL_CASES.filter((c) => c.key === only) : ALL_CASES;

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

watch(appearance, renderAll);

onMounted(renderAll);
</script>

<template>
  <section class="card-preview-page">
    <header class="preview-header">
      <h1>卡片模板预览（仅 dev 构建）</h1>
      <div class="preview-controls">
        <div class="seg" role="group" aria-label="明暗外观">
          <span>明暗外观</span>
          <div>
            <button
              v-for="opt in APPEARANCES"
              :key="opt"
              type="button"
              :class="{ 'is-on': appearance === opt }"
              @click="appearance = opt"
            >
              {{ opt }}
            </button>
          </div>
        </div>
        <button type="button" class="reroll-all" @click="rerollAll">换一批（variant {{ globalVariant }}）</button>
      </div>
    </header>
    <div class="preview-grid" :class="{ single: cases.length === 1 }">
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
  background: var(--bg);
  color: var(--text);
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
.preview-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}
.seg {
  display: flex;
  align-items: center;
  gap: 12px;
}
.seg > span {
  font-size: 12px;
  color: var(--text-dim);
}
.seg > div {
  display: flex;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}
.seg button {
  padding: 7px 14px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
}
.seg button + button {
  border-left: 1px solid var(--line);
}
.seg button.is-on {
  background: var(--primary);
  color: var(--on-primary);
}
.reroll-all {
  padding: 8px 18px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}
.preview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}
.preview-grid.single {
  grid-template-columns: minmax(0, 720px);
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
  color: var(--text-dim);
  font-size: 12px;
}
.rendering {
  display: grid;
  place-items: center;
  aspect-ratio: 3 / 4;
  border: 1px dashed var(--line);
  border-radius: 8px;
  color: var(--text-dim);
}
</style>
