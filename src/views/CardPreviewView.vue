<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { renderCheerCard, type CardInput, type RenderedCard } from '../lib/card-renderer';
import { CARD_STAT_COUNT, mergeCardRefs } from '../lib/card/selection';
import { generateCheer } from '../lib/api';
import type { AbilitiesDisplay, Checkin, CheerRef, Mood } from '../types';

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
  { key: 'poster', label: 'poster · 大字报（victory 旧版）', templateId: 'poster', mood: 'victory' },
  { key: 'vermillion', label: 'vermillion · 釉里红（victory 新版）', templateId: 'vermillion', mood: 'victory' },
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
  {
    key: 'journal',
    label: 'journal · 国风札记（daily）',
    templateId: 'journal',
    mood: 'daily',
    appearance: 'light',
  },
];

const DEFAULT_LINES: Record<string, string> = {
  note: '打卡第 87 天，习惯已经长在身上啦，今天也稳稳完成！',
  poster: '还记得无言关羽开大的那波绕后吗，19局78.9%的胜率不是白来的，每次想到那把刀落下来的瞬间都起鸡皮疙瘩',
  vermillion: '还记得无言关羽开大的那波绕后吗，19局78.9%的胜率不是白来的，每次想到那把刀落下来的瞬间都起鸡皮疙瘩',
  magazine: '今天也要按部就班地努力，稳稳地前进。',
  dusk: '低谷没关系，慢慢充电，星星会陪着我们。',
  dawn: '新的一天新的期待，阳光已经在路上了。',
  signal: '信号已就位，今天也要全力应援！',
  pulse: '应援信号满格，今天也要为无言大声打 call！',
  blueprint: '把每一次训练都画进结构图里，尺寸精准，进度可见。',
  mist: '今天电量只剩一格，那就先慢慢回血，光会等我们的。',
  clipping: '把这波连胜剪下来贴在墙上，抬头就能看见！',
  journal:
    '还记得春季赛那会儿吗，无言拿对抗路一阵的时候评论区全在刷「终于」，那种从质疑里慢慢磨出来的感觉，比数据本身还让人上头。',
};

const CAPTIONS: Record<string, string> = {
  note: '又是元气满满的一天',
  poster: '胜利是我们的',
  vermillion: '胜利是我们的',
  magazine: '稳稳的日常',
  dusk: '充电中，别催',
  dawn: '元气满格',
  signal: '保持在线',
  pulse: '满格在线',
  blueprint: '按图施工',
  mist: '慢慢回血',
  clipping: '剪下来收藏',
  journal: '周二早安☀️ 打卡完成，今天也是被无言稳到的一天🫶',
};

// 真实的 KSG.无言 对抗路英雄池与战绩兜底
const DEFAULT_REFS: CheerRef[] = [
  { label: '赛季胜率', value: '100%', source: 'season_summaries' },
  { label: '赛季KDA', value: '9.38', source: 'season_summaries' },
  { label: '赛季对局数', value: '9', source: 'season_summaries' },
  { label: '赛季MVP', value: '2', source: 'season_summaries' },
  { label: '赛季场均助攻', value: '5.78', source: 'season_summaries' },
  {
    label: '常用英雄（按出场数）',
    value:
      '夏洛特（32局，胜率68.8%）、狂铁（26局，胜率69.2%）、马超（22局，胜率45.5%）、关羽（19局，胜率78.9%）、司空震（17局，胜率41.2%）',
    source: 'season_summaries',
  },
];

// 后端 abilities_display 的实测样例：联盟综合评分 + 对抗路分榜前十
const DEFAULT_ABILITIES: AbilitiesDisplay = {
  score: 93.7,
  overall_rank: 1,
  position: '对抗路',
  position_rank: 1,
  fields: [
    { key: 'support_ability', label: '支援能力', score: 97, rank: 1 },
    { key: 'initiation', label: '开团能力', score: 94, rank: 1 },
    { key: 'map_control', label: '场面控制', score: 90, rank: 1 },
    { key: 'early_game', label: '前期表现', score: 88, rank: 1 },
    { key: 'late_game', label: '后期表现', score: 93, rank: 2 },
    { key: 'teamfight', label: '团战能力', score: 90, rank: 2 },
    { key: 'invasion_ability', label: '入侵能力', score: 86, rank: 2 },
    { key: 'durability', label: '生存能力', score: 72, rank: 2 },
    { key: 'damage_output', label: '输出能力', score: 93, rank: 3 },
    { key: 'economy', label: '经济发育', score: 86, rank: 3 },
  ],
};

const DEFAULT_SOURCE = '默认对抗路英雄池 + 能力分榜';

// 响应式数据源与控制
const activeRefs = ref<CheerRef[]>([...DEFAULT_REFS]);
const activeAbilities = ref<AbilitiesDisplay | null>(DEFAULT_ABILITIES);
const activeSnapshotAt = ref<string>('');
const dataSourceStatus = ref<'default' | 'online_overview' | 'ai_generated'>('default');
const dataSourceDetail = ref<string>(DEFAULT_SOURCE);

/** 卡片真实候选池：结构化能力在前，赛季统计/英雄在后，供模板抽 3 项 */
const mergedRefs = computed(() => mergeCardRefs(activeRefs.value, activeAbilities.value));

// 线上 AI 生成状态
const isGeneratingAi = ref(false);
const isLoadingOverview = ref(false);
const aiMood = ref<Mood>('daily');
const aiLines = ref<string[]>([]);
const aiCaption = ref<string>('');
const selectedAiLineIndex = ref<number>(-1); // -1 轮流分配，>=0 统一样式

const cards = ref<Record<string, RenderedCard | null>>({});
const globalVariant = ref(0);
const variants = ref<Record<string, number>>({});

/* auto = 不传 appearance，走 renderCheerCard 内部读取 <html data-theme> 的默认逻辑 */
type PreviewAppearance = 'auto' | 'light' | 'dark';
const APPEARANCES: PreviewAppearance[] = ['auto', 'light', 'dark'];
const appearance = ref<PreviewAppearance>('auto');

function getLineForCase(caseKey: string, index: number): string {
  if (selectedAiLineIndex.value >= 0 && aiLines.value[selectedAiLineIndex.value]) {
    return aiLines.value[selectedAiLineIndex.value] ?? '';
  }
  if (aiLines.value.length > 0) {
    return aiLines.value[index % aiLines.value.length] ?? '';
  }
  return DEFAULT_LINES[caseKey] ?? '';
}

async function renderCase(c: CaseDef, index: number = 0): Promise<void> {
  try {
    cards.value[c.key] = await renderCheerCard({
      line: getLineForCase(c.key, index),
      emojiCaption: aiCaption.value || CAPTIONS[c.key] || '',
      refs: activeRefs.value,
      abilitiesDisplay: activeAbilities.value,
      sourceSnapshotAt: activeSnapshotAt.value,
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
  await Promise.all(cases.map((c, i) => renderCase(c, i)));
}

function reroll(c: CaseDef): void {
  const idx = cases.findIndex((item) => item.key === c.key);
  variants.value[c.key] = (variants.value[c.key] ?? globalVariant.value) + 1;
  renderCase(c, idx >= 0 ? idx : 0);
}

async function rerollAll(): Promise<void> {
  globalVariant.value += 1;
  variants.value = {};
  await renderAll();
}

/** 拉取线上最新真实 KPL 概览数据 */
async function fetchOnlineOverview(): Promise<boolean> {
  isLoadingOverview.value = true;
  try {
    const res = await fetch('/api/overview');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const ov = json.data?.overview;
    if (!ov) throw new Error('无效的概览数据');
    const cs = ov.current_season || {};
    const heroTop = (ov.hero_top || []) as Array<{ hero_name: string; battles: number; win_rate: string }>;
    const heroStr = heroTop
      .slice(0, 5)
      .map((h) => `${h.hero_name}（${h.battles}局，胜率${h.win_rate}）`)
      .join('、');
    const newRefs: CheerRef[] = [];
    if (cs.kda_ratio) newRefs.push({ label: '赛季 KDA', value: String(cs.kda_ratio), source: 'season_summaries' });
    if (cs.win_rate) newRefs.push({ label: '赛季胜率', value: String(cs.win_rate), source: 'season_summaries' });
    if (cs.battles) newRefs.push({ label: '赛季对局数', value: String(cs.battles), source: 'season_summaries' });
    if (cs.mvp) newRefs.push({ label: '赛季 MVP', value: String(cs.mvp), source: 'season_summaries' });
    if (cs.avg_assists)
      newRefs.push({ label: '赛季场均助攻', value: String(cs.avg_assists), source: 'season_summaries' });
    if (heroStr) newRefs.push({ label: '常用英雄（按出场数）', value: heroStr, source: 'season_summaries' });

    activeRefs.value = newRefs;
    activeAbilities.value = DEFAULT_ABILITIES;
    activeSnapshotAt.value = json.data?.updated_at || '';
    dataSourceStatus.value = 'online_overview';
    dataSourceDetail.value = `线上 KPL 数据（${json.data?.season || '当前赛季'}）+ 能力分榜样例`;
    return true;
  } catch (err) {
    console.warn('[preview] 获取线上概览失败，使用对抗路兜底数据', err);
    return false;
  } finally {
    isLoadingOverview.value = false;
  }
}

/** 触发线上 AI 真实生成接口 */
async function triggerAiCheer(): Promise<void> {
  isGeneratingAi.value = true;
  try {
    const reqId = crypto.randomUUID();
    const result = await generateCheer(aiMood.value, '', reqId);
    if (result && Array.isArray(result.lines) && result.lines.length > 0) {
      aiLines.value = result.lines;
      aiCaption.value = result.emoji_caption || '';
      selectedAiLineIndex.value = -1;
      if (Array.isArray(result.refs) && result.refs.length > 0) {
        activeRefs.value = result.refs;
      }
      activeAbilities.value = result.abilities_display ?? null;
      activeSnapshotAt.value = result.source_snapshot_at || '';
      dataSourceStatus.value = 'ai_generated';
      dataSourceDetail.value = `线上 AI 生成（${result.report_id.slice(0, 8)}…${activeAbilities.value ? ' · 含能力分榜' : ' · 无能力分榜'}）`;
      await renderAll();
    }
  } catch (err) {
    console.error('[preview] 线上 AI 生成失败', err);
    alert('线上 AI 生成调用失败，请查看控制台日志');
  } finally {
    isGeneratingAi.value = false;
  }
}

/** 恢复默认对抗路兜底数据 */
async function resetToDefault(): Promise<void> {
  activeRefs.value = [...DEFAULT_REFS];
  activeAbilities.value = DEFAULT_ABILITIES;
  activeSnapshotAt.value = '';
  aiLines.value = [];
  aiCaption.value = '';
  selectedAiLineIndex.value = -1;
  dataSourceStatus.value = 'default';
  dataSourceDetail.value = DEFAULT_SOURCE;
  await renderAll();
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/** 切换选中的特定 AI 文案 */
function selectAiLine(idx: number): void {
  selectedAiLineIndex.value = idx;
  renderAll();
}

watch(appearance, renderAll);

onMounted(async () => {
  // 页面进入时优先尝试联网拉取真实 KPL 数据
  await fetchOnlineOverview();
  await renderAll();
});
</script>

<template>
  <section class="card-preview-page">
    <header class="preview-header">
      <div class="header-title-box">
        <h1>卡片模板预览（仅 dev 构建）</h1>
        <div class="data-source-badge" :class="dataSourceStatus">
          <span class="dot"></span>
          <span>{{ dataSourceDetail }}</span>
        </div>
      </div>

      <div class="preview-controls">
        <!-- 线上 AI 真实生成操作 -->
        <div class="ai-group">
          <select v-model="aiMood" class="mood-select" title="选择 AI 生成心情">
            <option value="daily">日常 (daily)</option>
            <option value="victory">胜利 (victory)</option>
            <option value="low">低谷 (low)</option>
            <option value="hope">期待 (hope)</option>
          </select>
          <button type="button" class="btn-action primary" :disabled="isGeneratingAi" @click="triggerAiCheer">
            {{ isGeneratingAi ? '生成中…' : '✨ 线上 AI 实时生成' }}
          </button>
        </div>

        <button
          type="button"
          class="btn-action"
          :disabled="isLoadingOverview"
          title="拉取线上 /api/overview 真实对局数据"
          @click="
            async () => {
              await fetchOnlineOverview();
              await renderAll();
            }
          "
        >
          {{ isLoadingOverview ? '同步中…' : '🔄 同步 KPL 赛事' }}
        </button>

        <button v-if="dataSourceStatus !== 'default'" type="button" class="btn-action reset" @click="resetToDefault">
          重置
        </button>

        <div class="seg" role="group" aria-label="明暗外观">
          <span>外观</span>
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

        <button type="button" class="btn-action reroll-all" @click="rerollAll">换一批 (v{{ globalVariant }})</button>
      </div>
    </header>

    <!-- 线上 AI 生成的多条文案切换器 -->
    <div v-if="aiLines.length > 0" class="ai-lines-panel">
      <div class="panel-header">
        <span class="caption-tag">{{ aiCaption || 'AI 生成' }}</span>
        <span class="panel-hint">点击句子统一样式预览，或切回「轮流分配」：</span>
      </div>
      <div class="lines-chips">
        <button type="button" class="chip" :class="{ active: selectedAiLineIndex === -1 }" @click="selectAiLine(-1)">
          🔀 各卡片轮流分配
        </button>
        <button
          v-for="(line, idx) in aiLines"
          :key="idx"
          type="button"
          class="chip line-chip"
          :class="{ active: selectedAiLineIndex === idx }"
          :title="line"
          @click="selectAiLine(idx)"
        >
          <span class="idx">{{ idx + 1 }}</span>
          <span class="text">{{ line }}</span>
        </button>
      </div>
    </div>

    <!-- 结构化能力数据校验条：完整分数与名次集中这里，卡面能力项带名次后缀 -->
    <div v-if="activeAbilities" class="abilities-bar">
      <span class="refs-title">能力分榜：</span>
      <span class="ability-summary">
        {{ activeAbilities.position || '' }}综合评分 <strong>{{ formatScore(activeAbilities.score) }}</strong>
        <template v-if="activeAbilities.overall_rank"> · 全联盟第{{ activeAbilities.overall_rank }}</template>
        <template v-if="activeAbilities.position_rank"> · 同位置第{{ activeAbilities.position_rank }}</template>
      </span>
      <span v-for="field in activeAbilities.fields" :key="field.key" class="ref-badge ability-badge">
        {{ field.label }} <strong>{{ formatScore(field.score) }}</strong>
        <em>第{{ field.rank }}</em>
      </span>
    </div>

    <!-- 卡片真实候选池（结构化能力 + 赛季统计 + 英雄），模板从池中抽 3 项 -->
    <div class="refs-preview-bar">
      <span class="refs-title">候选池 {{ mergedRefs.length }} 项（每卡抽 {{ CARD_STAT_COUNT }}）：</span>
      <span
        v-for="(refItem, rIdx) in mergedRefs"
        :key="rIdx"
        class="ref-badge"
        :class="{ ability: refItem.source === 'abilities_display' }"
      >
        <strong>{{ refItem.label }}:</strong> {{ refItem.value }}
      </span>
    </div>

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
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.header-title-box {
  display: flex;
  align-items: center;
  gap: 12px;
}
.header-title-box h1 {
  font-size: 20px;
  margin: 0;
}
.data-source-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--line);
}
.data-source-badge .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-dim);
}
.data-source-badge.online_overview {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.3);
  color: #10b981;
}
.data-source-badge.online_overview .dot {
  background: #10b981;
}
.data-source-badge.ai_generated {
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.4);
  color: #8b5cf6;
}
.data-source-badge.ai_generated .dot {
  background: #8b5cf6;
}
.preview-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.ai-group {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mood-select {
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-card, var(--bg));
  color: var(--text);
  font-size: 13px;
  outline: none;
}
.btn-action {
  padding: 7px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-action:hover:not(:disabled) {
  border-color: var(--text-muted);
  background: rgba(125, 125, 125, 0.08);
}
.btn-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-action.primary {
  background: #6366f1;
  border-color: #6366f1;
  color: #fff;
  font-weight: 500;
}
.btn-action.primary:hover:not(:disabled) {
  background: #4f46e5;
}
.btn-action.reset {
  color: var(--text-dim);
}
.seg {
  display: flex;
  align-items: center;
  gap: 8px;
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
  padding: 6px 12px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}
.seg button + button {
  border-left: 1px solid var(--line);
}
.seg button.is-on {
  background: var(--primary);
  color: var(--on-primary);
}
.ai-lines-panel {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: rgba(125, 125, 125, 0.05);
  border: 1px solid var(--line);
  border-radius: 10px;
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.caption-tag {
  font-size: 13px;
  font-weight: 600;
  color: #8b5cf6;
}
.panel-hint {
  font-size: 12px;
  color: var(--text-dim);
}
.lines-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  max-width: 320px;
}
.chip:hover {
  border-color: var(--text-muted);
}
.chip.active {
  background: #6366f1;
  border-color: #6366f1;
  color: #fff;
}
.chip .idx {
  font-weight: 700;
  opacity: 0.8;
}
.chip .text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.abilities-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  padding: 8px 12px;
  background: rgba(99, 102, 241, 0.06);
  border: 1px solid rgba(99, 102, 241, 0.22);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-dim);
}
.ability-summary {
  font-weight: 600;
  color: var(--text-muted);
}
.ability-summary strong {
  color: #6366f1;
  font-size: 13px;
}
.ability-badge {
  background: rgba(99, 102, 241, 0.1);
}
.ability-badge strong {
  color: var(--text);
}
.ability-badge em {
  font-style: normal;
  opacity: 0.7;
}
.refs-preview-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  padding: 8px 12px;
  background: rgba(125, 125, 125, 0.03);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-dim);
  overflow-x: auto;
  white-space: nowrap;
}
.refs-title {
  font-weight: 600;
  color: var(--text-muted);
  flex-shrink: 0;
}
.ref-badge {
  padding: 2px 8px;
  background: rgba(125, 125, 125, 0.06);
  border-radius: 4px;
  flex-shrink: 0;
}
.ref-badge.ability {
  background: rgba(99, 102, 241, 0.08);
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
