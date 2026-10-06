import type { Mood } from '../../types';
import { createRng, hashString } from './rng';

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
