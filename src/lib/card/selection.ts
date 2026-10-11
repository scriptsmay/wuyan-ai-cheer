import type { Mood, CheerRef } from '../../types';
import { createRng, hashString, type CardRng } from './rng';

export type TemplateId =
  'note' | 'poster' | 'magazine' | 'dusk' | 'dawn' | 'signal' | 'pulse' | 'blueprint' | 'mist' | 'clipping';

/** 卡片取样的明暗外观，与站内主题（<html data-theme>）同源 */
export type CardAppearance = 'light' | 'dark';

/**
 * 心情 → 主模板家族（暗色外观，重构前的既有语义）：
 * - victory  大字报（色块冲击）
 * - daily    杂志留白
 * - low      暮色弥散（氛围感）
 * - hope     晨光弥散（渐变亮色）
 * 打卡卡固定便签风（note），不经过此表。
 */
export const MOOD_PRIMARY: Record<Mood, TemplateId> = {
  victory: 'poster',
  daily: 'magazine',
  low: 'dusk',
  hope: 'dawn',
};

/** 应援卡回落到深色 signal 模板的概率（品牌延续变体；仅暗色外观生效） */
export const SIGNAL_FALLBACK_WEIGHT = 0.2;

/**
 * 心情 → 主模板（亮色外观）：与 MOOD_PRIMARY 同构，但 low 换成亮色的 mist，
 * 避免「情绪低落 = 一定是深紫夜空」。候选池一律排除 signal / dusk 两套深色。
 */
export const LIGHT_PRIMARY: Record<Mood, TemplateId> = {
  victory: 'poster',
  daily: 'magazine',
  low: 'mist',
  hope: 'dawn',
};

export const LIGHT_PRIMARY_WEIGHT = 0.55;

/**
 * 亮色外观下主模板之外的轮换备选，权重为「剩余 1 - LIGHT_PRIMARY_WEIGHT」内部的
 *相对占比（同心情内两两之比即可，不要求和为 1）。
 */
export const LIGHT_ALTERNATES: Record<Mood, readonly (readonly [TemplateId, number])[]> = {
  victory: [
    ['clipping', 0.6],
    ['pulse', 0.4],
  ],
  daily: [
    ['pulse', 0.6],
    ['blueprint', 0.4],
  ],
  low: [
    ['blueprint', 0.6],
    ['pulse', 0.4],
  ],
  hope: [
    ['mist', 0.6],
    ['clipping', 0.4],
  ],
};

export interface SelectionInput {
  hasCheckin: boolean;
  mood?: Mood;
  variant?: number;
  /** 缺省按暗色处理，保持模板族重构时的既有分布 */
  appearance?: CardAppearance;
  /** 种子日期串（YYYY-MM-DD）：同一天同参数产出稳定，隔天自动换花样 */
  dateLabel: string;
}

/**
 * 种子刻意不含 appearance：切换站内主题只换候选池，不重洗装饰随机流，
 * 免得用户切个主题就看到同一张卡换了版式细节。
 */
export function buildSeed({ hasCheckin, mood, variant, dateLabel }: SelectionInput): string {
  const kind = hasCheckin ? 'checkin' : 'cheer';
  return [dateLabel, kind, mood ?? 'daily', variant ?? 0].join('|');
}

function resolveLightId(mood: Mood, rng: CardRng): TemplateId {
  const alternates = LIGHT_ALTERNATES[mood];
  const budget = 1 - LIGHT_PRIMARY_WEIGHT;
  const total = alternates.reduce((sum, [, weight]) => sum + weight, 0);
  return rng.weighted([
    [LIGHT_PRIMARY[mood], LIGHT_PRIMARY_WEIGHT],
    ...alternates.map(([id, weight]) => [id, (budget * weight) / total] as const),
  ]);
}

export function resolveTemplateId(input: SelectionInput): TemplateId {
  if (input.hasCheckin) return 'note';
  const mood: Mood = input.mood && input.mood in MOOD_PRIMARY ? input.mood : 'daily';
  const rng = createRng(`${buildSeed(input)}|template`);
  if (input.appearance === 'light') return resolveLightId(mood, rng);
  return rng.weighted([
    [MOOD_PRIMARY[mood], 1 - SIGNAL_FALLBACK_WEIGHT],
    ['signal', SIGNAL_FALLBACK_WEIGHT],
  ]);
}

/** 暴露给测试：确认模板选择用的哈希与 rng 同源且稳定 */
export function selectionHash(value: string): number {
  return hashString(value);
}

/**
 * 把「常用英雄」这类合并字段拆成可独立参与抽取的条目。
 *
 * 后端把出场前 5 的英雄拼成一条 value（线上实测 81 字，如
 * 「夏洛特（32局，胜率68.8%）、狂铁（26局，胜率69.2%）、…」）。该值远超
 * maxValueLength，会被 selectVisibleRefs 整体滤掉，卡片上永远看不到英雄数据。
 *
 * 这里按顿号拆成单英雄并剥掉括号详情（只剩「夏洛特」2-3 字），使每个英雄
 * 成为一个独立候选：既消掉了超长字段，又让「取到英雄」变成一件有随机性的事
 * —— 同一天不同 seed 会抽到不同英雄，而不是永远固定前 5 个。
 */
function expandHeroRefs(refs: readonly CheerRef[]): CheerRef[] {
  const out: CheerRef[] = [];
  for (const ref of refs) {
    const parts = ref.value.includes('、') ? ref.value.split('、') : [];
    const bare = parts
      .map((part) => part.trim().replace(/（[^）]*）\s*$/, '').trim())
      .filter((name) => name.length > 0);
    // 拆不出干净的英雄名（无顿号、或剥完不成词）就保持原样，交给长度过滤兜底
    if (bare.length < 2) {
      out.push(ref);
      continue;
    }
    // label 带上英雄名：否则多条候选同名，页面渲染 key 与「抽出的两项不同」判重都会撞
    for (const name of bare) out.push({ ...ref, label: `${ref.label}·${name}`, value: name });
  }
  return out;
}

/** 拆分条目的 label 形如「常用英雄（按出场数）·夏洛特」，取中点前一段作为来源分组键。 */
function groupKeyOf(ref: CheerRef): string {
  const idx = ref.label.indexOf('·');
  return idx === -1 ? ref.label : ref.label.slice(0, idx);
}

/**
 * 抽取时保证一次只出一个同来源的条目（如两个英雄同时上卡会重复且不合语义）。
 */
function pickDistinct<T>(pool: readonly T[], count: number, rng: CardRng | undefined, keyOf: (item: T) => string): T[] {
  const picked: T[] = [];
  const used = new Set<string>();
  const rest = [...pool];
  while (picked.length < count && rest.length > 0) {
    const idx = rng ? rng.int(0, rest.length - 1) : 0;
    const item = rest[idx]!;
    const key = keyOf(item);
    if (used.has(key)) {
      rest.splice(idx, 1);
      continue;
    }
    used.add(key);
    picked.push(item);
    rest.splice(idx, 1);
  }
  return picked;
}

/**
 * 从可用 refs 池中确定性选取展示项（支持 PRNG 轮换）
 * 规则：
 * 1. 条目数量 <= count 时直接返回；
 * 2. 数量 > count 时：
 *    - 「常用英雄」等合并字段先拆成单英雄条目（见 expandHeroRefs）；
 *    - 过滤出适合双列窄卡排版的指标（默认 value 长度 <= 10），避免超长文案爆框；
 *    - 若过滤后候选项不足 count，回落使用全部条目；
 *    - 按来源分组去重后随机抽样，保证同 seed 稳定、不重复、且不出现同类两条。
 */
export function selectVisibleRefs(
  refs: readonly CheerRef[] | undefined,
  rng?: CardRng,
  count = 2,
  maxValueLength = 10
): CheerRef[] {
  if (!refs || refs.length === 0) return [];
  const expanded = expandHeroRefs(refs);
  if (expanded.length <= count) return [...expanded];

  const candidatePool = expanded.filter((r) => r.value.length <= maxValueLength);
  const pool = candidatePool.length >= count ? candidatePool : [...expanded];

  return pickDistinct(pool, count, rng, groupKeyOf);
}
