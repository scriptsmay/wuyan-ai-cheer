import { describe, expect, it } from 'vitest';
import { createRng } from '../src/lib/card/rng';
import {
  LIGHT_ALTERNATES,
  LIGHT_PRIMARY,
  MOOD_PRIMARY,
  SIGNAL_FALLBACK_WEIGHT,
  buildSeed,
  heroEyebrowOf,
  resolveTemplateId,
  selectVisibleRefs,
} from '../src/lib/card/selection';
import { TEMPLATES } from '../src/lib/card/templates';
import type { CheerRef } from '../src/types';

const DATE = '2026-10-06';
const MOODS = ['victory', 'daily', 'low', 'hope'] as const;
const DARK_ONLY: string[] = ['signal', 'dusk'];

function pick(mood: (typeof MOODS)[number], variant: number, appearance?: 'light' | 'dark') {
  return resolveTemplateId({ hasCheckin: false, mood, variant, dateLabel: DATE, appearance });
}

describe('card template selection', () => {
  it('always picks the note template for checkin cards', () => {
    for (const appearance of ['light', 'dark'] as const) {
      for (const variant of [0, 1, 7, 42]) {
        for (const mood of MOODS) {
          const id = resolveTemplateId({ hasCheckin: true, mood, variant, dateLabel: DATE, appearance });
          expect(id).toBe('note');
        }
      }
    }
  });

  it('dark appearance keeps the legacy behaviour: mood primary plus rare signal fallback', () => {
    for (const mood of MOODS) {
      const ids = Array.from({ length: 200 }, (_, variant) => pick(mood, variant, 'dark'));
      const primaryCount = ids.filter((id) => id === MOOD_PRIMARY[mood]).length;
      expect(primaryCount).toBeGreaterThan(120); // 名义权重 0.8
      expect(ids).toContain('signal');
      expect(primaryCount).toBeLessThan(200);
      // 深色主题下不投放亮色专属模板
      for (const id of ids) {
        expect(['pulse', 'blueprint', 'mist', 'clipping']).not.toContain(id);
      }
    }
  });

  it('light appearance never yields the dark-only templates', () => {
    for (const mood of MOODS) {
      const ids = Array.from({ length: 400 }, (_, variant) => pick(mood, variant, 'light'));
      for (const id of ids) {
        expect(DARK_ONLY).not.toContain(id);
      }
    }
  });

  it('light appearance favours the mood primary but still rotates the alternates', () => {
    for (const mood of MOODS) {
      const ids = Array.from({ length: 400 }, (_, variant) => pick(mood, variant, 'light'));
      const primaryCount = ids.filter((id) => id === LIGHT_PRIMARY[mood]).length;
      expect(primaryCount).toBeGreaterThan(160); // 名义权重 0.55 → 期望 220
      expect(primaryCount).toBeLessThan(280);
      for (const [alt] of LIGHT_ALTERNATES[mood]) expect(ids).toContain(alt);
      // 备选池本身不得含深色模板
      for (const [alt] of LIGHT_ALTERNATES[mood]) expect(DARK_ONLY).not.toContain(alt);
    }
  });

  it('gives the low mood a light companion template instead of the night sky', () => {
    expect(LIGHT_PRIMARY.low).toBe('mist');
    const ids = Array.from({ length: 200 }, (_, variant) => pick('low', variant, 'light'));
    expect(ids).not.toContain('dusk');
    expect(ids.filter((id) => id === 'mist').length).toBeGreaterThan(60);
  });

  it('omitting appearance falls back to the dark pool (legacy semantics)', () => {
    const ids = Array.from({ length: 200 }, (_, variant) => pick('daily', variant));
    for (const id of ids) expect(['magazine', 'signal']).toContain(id);
  });

  it('is deterministic for identical inputs', () => {
    const a = resolveTemplateId({ hasCheckin: false, mood: 'hope', variant: 3, dateLabel: DATE, appearance: 'light' });
    const b = resolveTemplateId({ hasCheckin: false, mood: 'hope', variant: 3, dateLabel: DATE, appearance: 'light' });
    expect(a).toBe(b);
  });

  it('falls back to daily for unknown moods', () => {
    const ids = Array.from({ length: 60 }, (_, variant) =>
      resolveTemplateId({ hasCheckin: false, mood: 'nope' as never, variant, dateLabel: DATE, appearance: 'dark' })
    );
    for (const id of ids) expect(['magazine', 'signal']).toContain(id);
  });

  it('builds seed from date / kind / mood / variant only (theme does not reshuffle decorations)', () => {
    expect(buildSeed({ hasCheckin: true, mood: 'daily', variant: 2, dateLabel: DATE })).toBe(`${DATE}|checkin|daily|2`);
    expect(buildSeed({ hasCheckin: false, variant: 0, dateLabel: DATE })).toBe(`${DATE}|cheer|daily|0`);
    expect(buildSeed({ hasCheckin: false, variant: 0, dateLabel: DATE, appearance: 'light' })).toBe(
      buildSeed({ hasCheckin: false, variant: 0, dateLabel: DATE, appearance: 'dark' })
    );
  });

  it('keeps the documented signal fallback weight', () => {
    expect(SIGNAL_FALLBACK_WEIGHT).toBe(0.2);
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
    {
      label: '常用英雄',
      value:
        '夏洛特（32局，胜率68.8%）、狂铁（26局，胜率69.2%）、马超（21局，胜率55.6%）、关羽（18局，胜率47.8%）、司空震（12局，胜率62.5%）',
      source: 'kpl',
    },
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

  it('never surfaces the merged hero blob, only a single parsed hero', () => {
    const rng = createRng('long-filter-test');
    for (let i = 0; i < 50; i++) {
      const res = selectVisibleRefs(mockRefs, rng, 2, 10);
      expect(res).toHaveLength(2);
      for (const ref of res) {
        expect(ref.value).not.toContain('、');
        expect(ref.value).not.toContain('（');
      }
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
    // 应该覆盖到多种指标（KDA, 胜率, MVP 次数, 场均助攻）与英雄条目
    expect(seenLabels.size).toBeGreaterThanOrEqual(4);
    expect(seenLabels.has('对局数')).toBe(false);
  });

  it('never puts a match-count metric on the card', () => {
    const counting: CheerRef[] = [
      { label: '当前赛季对局数', value: '9', source: 'season_summaries' },
      { label: '巅峰赛总场次', value: '128', source: 'kpl' },
      {
        label: '常用英雄（按出场数）',
        value: '狂铁（26局，胜率69.2%）、关羽（19局，胜率78.9%）',
        source: 'season_summaries',
      },
      { label: '当前赛季 KDA', value: '9.38', source: 'season_summaries' },
    ];
    for (const rng of [createRng('a'), createRng('b'), undefined]) {
      for (const ref of selectVisibleRefs(counting, rng, 2)) {
        expect(ref.label).not.toMatch(/对局数|场次/);
      }
    }
    // 「按出场数」是英雄条目的 label 后缀，不该被场次规则误伤
    expect(selectVisibleRefs(counting, undefined, 2).some((r) => r.hero?.name === '狂铁')).toBe(true);
  });

  it('rotates hero names across seeds and never picks two at once', () => {
    const seen = new Set<string>();
    for (let variant = 0; variant < 40; variant++) {
      const rng = createRng(`2026-10-10|cheer|daily|${variant}|dawn`);
      const res = selectVisibleRefs(mockRefs, rng, 2);
      expect(res.filter((r) => r.label === '常用英雄').length).toBeLessThanOrEqual(1);
      for (const item of res) if (item.hero) seen.add(item.hero.name);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('dedupes the split heroes even when the pool is smaller than count', () => {
    // 只有「常用英雄」一条、拆出 2 个英雄时条目数正好等于槽位数，
    // 走去重短路分支也要挡住同一个英雄占满两栏
    const loneHero: CheerRef[] = [
      { label: '常用英雄', value: '上官婉儿（128局，胜率100.0%）、狂铁（26局，胜率69.2%）', source: 'kpl' },
    ];
    const res = selectVisibleRefs(loneHero, undefined, 2);
    expect(res).toHaveLength(1);
    expect(res[0]?.hero?.name).toBe('上官婉儿');
  });

  it('parses games and win rate into hero chips', () => {
    const rng = createRng('hero-parse');
    const heroRefs: CheerRef[] = [
      {
        label: '常用英雄',
        value: '夏洛特（32局，胜率68.8%）、狂铁（26局，胜率69.2%）',
        source: 'kpl',
      },
      { label: 'KDA', value: '4.8', source: 'kpl' },
    ];
    const heroes = selectVisibleRefs(heroRefs, rng, 2).filter((r) => r.hero);
    expect(heroes.length).toBeGreaterThan(0);
    for (const ref of heroes) {
      expect(ref.hero?.games).toBeGreaterThanOrEqual(12);
      expect(ref.hero?.winRate).toBeGreaterThan(0);
      expect(ref.hero?.winRate).toBeLessThan(100);
    }
  });

  it('keeps a hero entry with name only when the backend omits details', () => {
    const refs: CheerRef[] = [
      { label: '常用英雄', value: '大乔、瑶、蔡文姬', source: 'kpl' },
      { label: 'KDA', value: '4.8', source: 'kpl' },
      { label: '胜率', value: '58.2%', source: 'kpl' },
    ];
    const picked = selectVisibleRefs(refs, createRng('name-only'), 2);
    const hero = picked.find((r) => r.hero);
    expect(hero?.value).toBe(hero?.hero?.name);
    expect(hero?.hero?.games).toBeUndefined();
    expect(hero?.hero?.winRate).toBeUndefined();
  });

  it('does not split values whose parentheses contain the separator', () => {
    const refs: CheerRef[] = [
      { label: '英雄池', value: '辅助（T0、T1）、对抗路（T2）', source: 'kpl' },
      { label: 'KDA', value: '4.8', source: 'kpl' },
      { label: '胜率', value: '58.2%', source: 'kpl' },
    ];
    const picked = selectVisibleRefs(refs, createRng('unbalanced'), 2);
    expect(picked.some((r) => r.value.includes('、'))).toBe(false);
    expect(picked.every((r) => r.hero === undefined)).toBe(true);
  });

  it('shortens the hero eyebrow for narrow slots', () => {
    expect(heroEyebrowOf({ label: '常用英雄（按出场数）', value: '夏洛特', source: 'kpl' })).toBe('常用英雄');
    expect(heroEyebrowOf({ label: '常用英雄', value: '夏洛特', source: 'kpl' })).toBe('常用英雄');
  });
});

describe('template registry', () => {
  const ALL_IDS = [
    'note',
    'poster',
    'magazine',
    'dusk',
    'dawn',
    'signal',
    'pulse',
    'blueprint',
    'mist',
    'clipping',
    'vermillion',
  ] as const;

  it('exposes all ten templates with draw functions', () => {
    for (const id of ALL_IDS) {
      expect(TEMPLATES[id]).toBeDefined();
      expect(typeof TEMPLATES[id].draw).toBe('function');
      expect(TEMPLATES[id].name).toBeTruthy();
    }
  });

  it('registers exactly the templates the selection tables can name', () => {
    const reachable = new Set<string>([
      ...Object.values(MOOD_PRIMARY),
      ...Object.values(LIGHT_PRIMARY),
      'note',
      'signal',
    ]);
    for (const alts of Object.values(LIGHT_ALTERNATES)) {
      for (const [id] of alts) reachable.add(id);
    }
    expect([...reachable].sort()).toEqual([...ALL_IDS].sort());
  });
});
