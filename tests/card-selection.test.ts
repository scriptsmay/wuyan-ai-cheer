import { describe, expect, it } from 'vitest';
import { createRng } from '../src/lib/card/rng';
import { MOOD_PRIMARY, buildSeed, resolveTemplateId } from '../src/lib/card/selection';
import { TEMPLATES } from '../src/lib/card/templates';

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

describe('template registry', () => {
  it('exposes all six templates with draw functions', () => {
    for (const id of ['note', 'poster', 'magazine', 'dusk', 'dawn', 'signal'] as const) {
      expect(TEMPLATES[id]).toBeDefined();
      expect(typeof TEMPLATES[id].draw).toBe('function');
      expect(TEMPLATES[id].name).toBeTruthy();
    }
  });
});
