import type { Mood, CheerRef } from '../../types';
import { createRng, hashString, type CardRng } from './rng';

export type TemplateId = 'note' | 'poster' | 'magazine' | 'dusk' | 'dawn' | 'signal';

/**
 * 心情 → 主模板家族：
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

/** 应援卡回落到深色 signal 模板的概率（品牌延续变体；调 0 即完全下线深色） */
export const SIGNAL_FALLBACK_WEIGHT = 0.2;

export interface SelectionInput {
  hasCheckin: boolean;
  mood?: Mood;
  variant?: number;
  /** 种子日期串（YYYY-MM-DD）：同一天同参数产出稳定，隔天自动换花样 */
  dateLabel: string;
}

export function buildSeed({ hasCheckin, mood, variant, dateLabel }: SelectionInput): string {
  const kind = hasCheckin ? 'checkin' : 'cheer';
  return [dateLabel, kind, mood ?? 'daily', variant ?? 0].join('|');
}

export function resolveTemplateId(input: SelectionInput): TemplateId {
  if (input.hasCheckin) return 'note';
  const mood: Mood = input.mood && input.mood in MOOD_PRIMARY ? input.mood : 'daily';
  const rng = createRng(`${buildSeed(input)}|template`);
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
 * 从可用 refs 池中确定性选取展示项（支持 PRNG 轮换）
 * 规则：
 * 1. refs 数量 <= count 时直接返回；
 * 2. 数量 > count 时：
 *    - 过滤出适合双列窄卡排版的指标（默认 value 长度 <= 10），避免常用英雄等长文案爆框；
 *    - 若过滤后候选项不足 count，回落使用全部 refs；
 *    - 使用 rng 进行 Fisher-Yates 洗牌抽样，保证同 seed 稳定且不重复。
 */
export function selectVisibleRefs(
  refs: readonly CheerRef[] | undefined,
  rng?: CardRng,
  count = 2,
  maxValueLength = 10
): CheerRef[] {
  if (!refs || refs.length === 0) return [];
  if (refs.length <= count) return [...refs];

  const candidatePool = refs.filter((r) => r.value.length <= maxValueLength);
  const pool = candidatePool.length >= count ? candidatePool : [...refs];

  if (!rng) {
    return pool.slice(0, count);
  }

  // 拷贝一份索引用于洗牌
  const indices = pool.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const temp = indices[i]!;
    indices[i] = indices[j]!;
    indices[j] = temp;
  }

  return indices.slice(0, count).map((idx) => pool[idx]!);
}
