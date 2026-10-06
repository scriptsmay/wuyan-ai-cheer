/**
 * 卡片种子随机模块。
 * 同一 seed 字符串永远产出同一随机序列——卡片渲染是防抖实时重渲染的，
 * 背景与装饰必须在同一天内保持稳定，只随日期 / 卡片类型 / 心情 / 换一换计数变化。
 */

export interface CardRng {
  next(): number;
  /** [min, max) 浮点 */
  range(min: number, max: number): number;
  /** [min, max] 整数 */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** 按权重取值，entries 为 [值, 权重] 列表 */
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
  bool(probability?: number): boolean;
}

/** xmur3 字符串哈希，输出 32 位无符号种子 */
export function hashString(value: string): number {
  let h = 1779033703 ^ value.length;
  for (let i = 0; i < value.length; i++) {
    h = Math.imul(h ^ value.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32 PRNG */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seedSource: string): CardRng {
  const next = mulberry32(hashString(seedSource));
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
    weighted: <T>(entries: readonly (readonly [T, number])[]): T => {
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = next() * total;
      for (const [value, weight] of entries) {
        roll -= weight;
        if (roll < 0) return value;
      }
      return entries[entries.length - 1]![0];
    },
    bool: (probability = 0.5) => next() < probability,
  };
}
