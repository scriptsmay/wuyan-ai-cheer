import type { Mood, CheerRef, HeroStat } from '../../types';
import { createRng, hashString, type CardRng } from './rng';

export type TemplateId =
  | 'note'
  | 'poster'
  | 'magazine'
  | 'dusk'
  | 'dawn'
  | 'signal'
  | 'pulse'
  | 'blueprint'
  | 'mist'
  | 'clipping'
  | 'vermillion';

/** 卡片取样的明暗外观，与站内主题（<html data-theme>）同源 */
export type CardAppearance = 'light' | 'dark';

/**
 * 心情 → 主模板家族（暗色外观，重构前的既有语义）：
 * - victory  釉里红（宣纸朱印国风，原大字报 redesign）
 * - daily    杂志留白
 * - low      暮色弥散（氛围感）
 * - hope     晨光弥散（渐变亮色）
 * 打卡卡固定便签风（note），不经过此表。
 */
export const MOOD_PRIMARY: Record<Mood, TemplateId> = {
  victory: 'vermillion',
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
  victory: 'vermillion',
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
    ['poster', 0.3],
    ['clipping', 0.2],
    ['pulse', 0.1],
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
 * 把「常用英雄」这类合并字段拆成可独立参与抽取的条目，并保留括号里的战绩。
 *
 * 后端把出场前 5 的英雄拼成一条 value（线上实测 81 字，如
 * 「夏洛特（32局，胜率68.8%）、狂铁（26局，胜率69.2%）、…」）。该值远超
 * maxValueLength，会被 selectVisibleRefs 整体滤掉，卡片上永远看不到英雄数据。
 *
 * 按顿号拆成单英雄后，`（32局，胜率68.8%）`不再被剥掉丢弃，而是解析进
 * `hero` 字段：value 只剩「夏洛特」这种短词（英雄因此能进候选池、并按 seed
 * 轮换），完整的局数与胜率交给卡片的英雄胶囊区渲染。
 */

/** `夏洛特（32局，胜率68.8%）` → 名字 + 括号内详情 */
const HERO_DETAIL = /^(?<name>[^（）()]+?)\s*[（(](?<body>[^（）)]*)[）)]\s*$/;

function parseHeroPart(part: string): HeroStat | null {
  const trimmed = part.trim();
  if (!trimmed) return null;
  const matched = HERO_DETAIL.exec(trimmed);
  if (!matched) {
    // 无括号详情也算合法英雄（后端可能只给名字），但纯符号串不行
    return /^[^（）()、，,.\s]+$/.test(trimmed) ? { name: trimmed } : null;
  }
  const name = matched.groups?.name?.trim();
  const body = matched.groups?.body ?? '';
  if (!name) return null;
  const games = /(\d+)\s*局/.exec(body)?.[1];
  const winRate = /(\d+(?:\.\d+)?)\s*%/.exec(body)?.[1];
  const hero: HeroStat = { name };
  if (games) hero.games = Number(games);
  if (winRate) hero.winRate = Number(winRate);
  return hero;
}

/** 括号被顿号劈开（如「英雄池（T0、T1）」）时不做拆分，交给长度过滤兜底 */
function hasUnbalancedParen(part: string): boolean {
  const open = (part.match(/[（(]/g) ?? []).length;
  const close = (part.match(/[）)]/g) ?? []).length;
  return open !== close;
}

function splitHeroRefs(refs: readonly CheerRef[]): CheerRef[] {
  const out: CheerRef[] = [];
  for (const ref of refs) {
    const parts = ref.value.split('、');
    const heroes = parts.some(hasUnbalancedParen)
      ? []
      : parts.map(parseHeroPart).filter((hero): hero is HeroStat => hero !== null);
    // 拆不出干净的英雄名（无顿号、或剥完不成词）就保持原样
    if (heroes.length < 2) {
      out.push(ref);
      continue;
    }
    // label 保持原样：同一来源的多条候选共享 label，pickDistinct 的分组去重
    // 才能挡住「两个英雄同时上卡」
    for (const hero of heroes) out.push({ ...ref, value: hero.name, hero });
  }
  return out;
}

/**
 * 英雄条目的抬头文案：去掉「（按出场数）」这类括号补充，只留「常用英雄」，
 * 让标题行短到能塞进窄槽；局数与胜率走英雄区自己的胶囊文案。
 */
export function heroEyebrowOf(ref: CheerRef): string {
  return ref.label.replace(/[（(][^）)]*[）)]/g, '').trim() || ref.label;
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
 * 场次统计不上卡：应援卡要的是「多强」，不是「打了多少把」（赛季对局数往往只有个位数，
 * 出现在卡面上反而泄气）。只匹配 label，英雄条目的 label 常带「（按出场数）」，不受影响。
 */
const HIDDEN_METRIC_LABEL = /对局数|总局数|场次/;

/**
 * 从可用 refs 池中确定性选取展示项（支持 PRNG 轮换）
 * 规则：
 * 0. 先剔除场次类条目（见 HIDDEN_METRIC_LABEL）；
 * 1. 条目数量 <= count 时按 label 去重后原序返回（同批英雄拆出的多条共享 label，
 *    不去重会让同一个英雄占满两栏）；
 * 2. 数量 > count 时：
 *    - 「常用英雄」等合并字段先拆成单英雄条目（见 splitHeroRefs）；
 *    - 过滤出适合双列窄卡排版的指标（默认 value 长度 <= 10），避免超长文案爆框；
 *      英雄条目拆分后 value 只剩英雄名，天然通过此过滤；
 *    - 若过滤后候选项不足 count，回落使用全部条目；
 *    - 按 label 分组去重后随机抽样，保证同 seed 稳定、不重复、且一次只上一个英雄。
 */
export function selectVisibleRefs(
  refs: readonly CheerRef[] | undefined,
  rng?: CardRng,
  count = 2,
  maxValueLength = 10
): CheerRef[] {
  if (!refs || refs.length === 0) return [];
  const usable = refs.filter((ref) => !HIDDEN_METRIC_LABEL.test(ref.label));
  const expanded = splitHeroRefs(usable);
  if (expanded.length <= count) return pickDistinct(expanded, count, undefined, (ref) => ref.label);

  const candidatePool = expanded.filter((r) => r.value.length <= maxValueLength);
  const pool = candidatePool.length >= count ? candidatePool : [...expanded];

  return pickDistinct(pool, count, rng, (ref) => ref.label);
}
