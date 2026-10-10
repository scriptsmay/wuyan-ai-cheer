import { describe, expect, it } from 'vitest';
import { createRng } from '../src/lib/card/rng';
import { MOOD_PRIMARY, buildSeed, resolveTemplateId, selectVisibleRefs } from '../src/lib/card/selection';
import { TEMPLATES } from '../src/lib/card/templates';
import type { CheerRef } from '../src/types';

const DATE = '2026-10-06';
const MOODS = ['victory', 'daily', 'low', 'hope'] as const;

describe('card template selection', () => {
  it('always picks the note template for checkin cards', () => {
    for (const variant of [0, 1, 7, 42]) {
      for (const mood of MOODS) {
        expect(resolveTemplateId({ hasCheckin: true, mood, variant, dateLabel: DATE })).toBe('note');
      }
    }
  });

  it('maps each mood to its primary family for most variants and keeps signal as a rare fallback', () => {
    for (const mood of MOODS) {
      const ids = Array.from({ length: 200 }, (_, variant) =>
        resolveTemplateId({ hasCheckin: false, mood, variant, dateLabel: DATE })
      );
      const primaryCount = ids.filter((id) => id === MOOD_PRIMARY[mood]).length;
      expect(primaryCount).toBeGreaterThan(120); // 名义权重 0.8
      expect(ids).toContain('signal');
      expect(primaryCount).toBeLessThan(200);
    }
  });

  it('is deterministic for identical inputs', () => {
    const a = resolveTemplateId({ hasCheckin: false, mood: 'hope', variant: 3, dateLabel: DATE });
    const b = resolveTemplateId({ hasCheckin: false, mood: 'hope', variant: 3, dateLabel: DATE });
    expect(a).toBe(b);
  });

  it('falls back to daily for unknown moods', () => {
    const ids = Array.from({ length: 50 }, (_, variant) =>
      resolveTemplateId({ hasCheckin: false, mood: 'nope' as never, variant, dateLabel: DATE })
    );
    for (const id of ids) expect(['magazine', 'signal']).toContain(id);
  });

  it('builds seed from date / kind / mood / variant', () => {
    expect(buildSeed({ hasCheckin: true, mood: 'daily', variant: 2, dateLabel: DATE })).toBe(`${DATE}|checkin|daily|2`);
    expect(buildSeed({ hasCheckin: false, variant: 0, dateLabel: DATE })).toBe(`${DATE}|cheer|daily|0`);
  });
});

describe('card rng', () => {
  it('produces identical sequences for identical seeds', () => {
    const a = createRng('seed-x');
    const b = createRng('seed-x');
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
  });

  it('keeps int/pick/range within bounds', () => {
    const rng = createRng('bounds');
    for (let i = 0; i < 200; i++) {
      const value = rng.int(3, 9);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(9);
      const ranged = rng.range(-2, 5);
      expect(ranged).toBeGreaterThanOrEqual(-2);
      expect(ranged).toBeLessThan(5);
      expect(rng.pick(['a', 'b', 'c'])).toMatch(/^[abc]$/);
    }
  });

  it('weighted pick stays within the value set', () => {
    const rng = createRng('weighted');
    const picks = Array.from({ length: 100 }, () =>
      rng.weighted([
        ['x', 0.8],
        ['y', 0.2],
      ] as const)
    );
    for (const p of picks) expect(['x', 'y']).toContain(p);
    expect(picks).toContain('x');
    expect(picks).toContain('y');
  });
});

describe('selectVisibleRefs', () => {
  const mockRefs: CheerRef[] = [
    { label: 'KDA', value: '4.8', source: 'kpl' },
    { label: '胜率', value: '58.2%', source: 'kpl' },
    { label: '对局数', value: '412', source: 'kpl' },
    { label: 'MVP 次数', value: '18', source: 'kpl' },
    { label: '场均助攻', value: '8.2', source: 'kpl' },
    { label: '常用英雄', value: '鲁班大师、苏烈、张飞、牛魔、盾山', source: 'kpl' },
  ];

  it('returns empty array when input is undefined or empty', () => {
    expect(selectVisibleRefs(undefined)).toEqual([]);
    expect(selectVisibleRefs([])).toEqual([]);
  });

  it('returns all items when length <= count', () => {
    const small = mockRefs.slice(0, 2);
    expect(selectVisibleRefs(small, undefined, 2)).toEqual(small);
    expect(selectVisibleRefs(mockRefs.slice(0, 1), undefined, 2)).toEqual(mockRefs.slice(0, 1));
  });

  it('returns first count items when rng is not provided', () => {
    const res = selectVisibleRefs(mockRefs, undefined, 2);
    expect(res).toHaveLength(2);
    expect(res[0]?.label).toBe('KDA');
    expect(res[1]?.label).toBe('胜率');
  });

  it('filters out overly long values when enough short items exist', () => {
    const rng = createRng('long-filter-test');
    for (let i = 0; i < 50; i++) {
      const res = selectVisibleRefs(mockRefs, rng, 2, 10);
      expect(res).toHaveLength(2);
      expect(res.map((r) => r.label)).not.toContain('常用英雄');
    }
  });

  it('falls back to include long values if candidates are fewer than count', () => {
    const onlyLongRefs: CheerRef[] = [
      { label: '英雄1', value: '超长英雄名字描述文本', source: 'kpl' },
      { label: '英雄2', value: '另一个超长英雄名字描述', source: 'kpl' },
      { label: '英雄3', value: '第三个超长英雄名字描述', source: 'kpl' },
    ];
    const rng = createRng('fallback-test');
    const res = selectVisibleRefs(onlyLongRefs, rng, 2, 5);
    expect(res).toHaveLength(2);
  });

  it('is deterministic for the same rng seed', () => {
    const rng1 = createRng('test-seed-123');
    const rng2 = createRng('test-seed-123');
    const res1 = selectVisibleRefs(mockRefs, rng1, 2);
    const res2 = selectVisibleRefs(mockRefs, rng2, 2);
    expect(res1).toEqual(res2);
  });

  it('rotates across different data items over multiple seeds', () => {
    const seenLabels = new Set<string>();
    for (let variant = 0; variant < 30; variant++) {
      const rng = createRng(`2026-10-10|cheer|daily|${variant}|dawn`);
      const res = selectVisibleRefs(mockRefs, rng, 2);
      expect(res).toHaveLength(2);
      // 保证抽出的两项不同
      expect(res[0]?.label).not.toBe(res[1]?.label);
      for (const item of res) seenLabels.add(item.label);
    }
    // 应该覆盖到除了长文本以外的多种指标（KDA, 胜率, 对局数, MVP 次数, 场均助攻）
    expect(seenLabels.size).toBeGreaterThanOrEqual(4);
  });
});

describe('template registry', () => {
  it('exposes all six templates with draw functions', () => {
    for (const id of ['note', 'poster', 'magazine', 'dusk', 'dawn', 'signal'] as const) {
      expect(TEMPLATES[id]).toBeDefined();
      expect(typeof TEMPLATES[id].draw).toBe('function');
      expect(TEMPLATES[id].name).toBeTruthy();
    }
  });
});
