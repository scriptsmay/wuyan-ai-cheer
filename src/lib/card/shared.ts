import QRCode from 'qrcode';
import type { HeroStat, Mood } from '../../types';
import type { CardAppearance } from './selection';
import type { CardTheme } from './types';
import type { CardRng } from './rng';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1440;

/**
 * 字体展示方案（与旧版一致，模板族共用）：
 * - 展示大字：ZCOOL QingKe HuangYou（黄油体）
 * - 手写正文：LXGW WenKai Screen（霞鹜文楷屏幕版）
 * - 副标题/状态行中文：HarmonyOS Sans SC Medium
 * - 标签说明：Noto Sans SC
 * - 数字：JetBrains Mono
 * - 英文装饰：Inter
 */
export const FAMILY_TITLE = '"ZCOOL QingKe HuangYou"';
export const FAMILY_SUBTITLE = '"HarmonyOS Sans SC", "Noto Sans SC", sans-serif';
export const FAMILY_BODY = '"Noto Sans SC", sans-serif';
export const FAMILY_MONO = '"JetBrains Mono", "Noto Sans SC", monospace';
export const FAMILY_ENGLISH = '"Inter", "Noto Sans SC", sans-serif';
export const FAMILY_WENKAI = '"LXGW WenKai Screen", "Noto Sans SC", sans-serif';

/**
 * 心情 → 强调色，分暗/亮两套。
 * DARK 沿用旧值（在深底上做过可读性微调，如 low 的紫提到 #B49BE8）；
 * LIGHT 与 tokens.css 的 [data-theme='light'] 情绪变量同源——霓虹青 #00D4FF 落在
 * 米白卡上对比度不足，亮色卡片必须换沉稳色，否则 pulse 这类强调色驱动的版式会糊。
 */
export const MOOD_THEME: Record<Mood, CardTheme> = {
  daily: {
    primary: '#00D4FF',
    primaryRgb: '0,212,255',
    secondary: '#FF9F4D',
    onAccent: '#0A0E1A',
  },
  victory: {
    primary: '#F4C95D',
    primaryRgb: '244,201,93',
    secondary: '#FF9F4D',
    onAccent: '#1B1405',
  },
  hope: {
    primary: '#FF7A7F',
    primaryRgb: '255,122,127',
    secondary: '#FFB777',
    onAccent: '#2A0B0C',
  },
  low: {
    primary: '#B49BE8',
    primaryRgb: '180,155,232',
    secondary: '#5DCAA5',
    onAccent: '#140B24',
  },
};

export const MOOD_THEME_LIGHT: Record<Mood, CardTheme> = {
  daily: {
    primary: '#007FA6',
    primaryRgb: '0,127,166',
    secondary: '#D9761F',
    onAccent: '#FFF7EF',
  },
  victory: {
    primary: '#A9760F',
    primaryRgb: '169,118,15',
    secondary: '#D9761F',
    onAccent: '#FFF8E8',
  },
  hope: {
    primary: '#E0464B',
    primaryRgb: '224,70,75',
    secondary: '#E08A3C',
    onAccent: '#FFF4F2',
  },
  low: {
    primary: '#6B4AA0',
    primaryRgb: '107,74,160',
    secondary: '#2F8E74',
    onAccent: '#F7F3FF',
  },
};

export function resolveTheme(mood?: Mood, appearance: CardAppearance = 'dark'): CardTheme {
  const palette = appearance === 'light' ? MOOD_THEME_LIGHT : MOOD_THEME;
  return palette[mood ?? 'daily'] ?? palette.daily;
}

/* ------------------------------------------------------------------ */
/* 基础绘制                                                            */
/* ------------------------------------------------------------------ */

/** 圆角矩形路径（arcTo 实现，兼容无 ctx.roundRect 的环境） */
export function roundRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + rr, y);
  context.arcTo(x + w, y, x + w, y + h, rr);
  context.arcTo(x + w, y + h, x, y + h, rr);
  context.arcTo(x, y + h, x, y, rr);
  context.arcTo(x, y, x + w, y, rr);
  context.closePath();
}

/** 正弦波 Path2D */
export function buildSignalWavePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  yBaseline: number,
  width: number,
  amplitude: number,
  frequency: number,
  phase: number,
  samples = 240
): Path2D {
  const path = new Path2D();
  for (let i = 0; i <= samples; i++) {
    const px = x + (width * i) / samples;
    const py = yBaseline + amplitude * Math.sin(frequency * (px - x) + phase);
    if (i === 0) path.moveTo(px, py);
    else path.lineTo(px, py);
  }
  return path;
}

/** 放射光芒 */
export function drawRays(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  count: number,
  color: string
): void {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.globalAlpha = 0.6;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count;
    const r1 = radius + 6;
    const r2 = radius + 28;
    context.beginPath();
    context.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    context.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    context.stroke();
  }
  context.restore();
}

/** '#RRGGBB' → 'r,g,b' */
export function toRgb(color: string): string {
  const value = color.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/* ------------------------------------------------------------------ */
/* 文本                                                                */
/* ------------------------------------------------------------------ */

export interface GlyphRun {
  text: string;
  font: string;
  color: string;
}

/** 同一行内不同片段使用不同字体，依次横向排布；返回结束光标 x */
export async function drawRuns(
  context: CanvasRenderingContext2D,
  runs: GlyphRun[],
  x: number,
  y: number
): Promise<number> {
  await Promise.all(runs.map((run) => document.fonts.load(run.font, run.text)));
  let cursor = x;
  for (const run of runs) {
    context.font = run.font;
    context.fillStyle = run.color;
    context.fillText(run.text, cursor, y);
    cursor += context.measureText(run.text).width;
  }
  return cursor;
}

export async function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align?: CanvasTextAlign
): Promise<void> {
  if (!text) return;
  context.save();
  context.font = font;
  await document.fonts.load(font, text);
  context.fillStyle = color;
  if (align) context.textAlign = align;
  context.fillText(text, x, y);
  context.restore();
}

/** 描边文字（用于杂志风水印大字等） */
export async function strokeText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  lineWidth = 1.5,
  align?: CanvasTextAlign
): Promise<void> {
  context.save();
  context.font = font;
  await document.fonts.load(font, text);
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  if (align) context.textAlign = align;
  context.strokeText(text, x, y);
  context.restore();
}

/** 行首禁排的中文标点（避头点规则：这些字符不允许开启新行） */
const LINE_START_FORBIDDEN = '，。！？、；：）」』】》…—,.!?;:)%”';

export function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const character of Array.from(text)) {
    const candidate = current + character;
    if (context.measureText(candidate).width > maxWidth && current) {
      // 标点悬尾：禁排字符不换行，允许略超出右边距
      if (LINE_START_FORBIDDEN.includes(character) && current.length >= 2) {
        current = candidate;
        continue;
      }
      lines.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface FittedText {
  lines: string[];
  font: string;
  size: number;
  lineHeight: number;
}

/**
 * 自适应字号排版：从 maxSize 逐级缩小，直到换行数 ≤ maxLines；
 * 返回行数组与绘制参数。放不下时按 minSize 截断到 maxLines。
 * maxHeight 传入正文可用高度时，会为下方标语预留空间（按基线跨度计算）。
 */
export async function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  family: string,
  opts: {
    maxWidth: number;
    maxLines: number;
    maxSize: number;
    minSize: number;
    lineHeightRatio?: number;
    weight?: number;
    /** 正文可用高度（首行基线到末行基线的跨度），超出时继续缩字号或减行 */
    maxHeight?: number;
  }
): Promise<FittedText> {
  const ratio = opts.lineHeightRatio ?? 1.32;
  const probeFont = `${opts.weight ?? 400} ${opts.minSize}px ${family}`;
  context.font = probeFont;
  await document.fonts.load(probeFont, text);
  const fitsHeight = (lineCount: number, lineHeight: number): boolean =>
    opts.maxHeight === undefined || (lineCount - 1) * lineHeight <= opts.maxHeight;
  for (let size = opts.maxSize; size >= opts.minSize; size -= 4) {
    const font = `${opts.weight ?? 400} ${size}px ${family}`;
    context.font = font;
    const wrapped = wrapText(context, text, opts.maxWidth);
    const lineHeight = Math.round(size * ratio);
    if (wrapped.length <= opts.maxLines && fitsHeight(wrapped.length, lineHeight)) {
      return { lines: wrapped, font, size, lineHeight };
    }
  }
  const font = `${opts.weight ?? 400} ${opts.minSize}px ${family}`;
  context.font = font;
  const lineHeight = Math.round(opts.minSize * ratio);
  // 兜底也优先遵守高度：先按 maxHeight 压行数，再受 maxLines 约束
  const heightLines = opts.maxHeight === undefined ? opts.maxLines : Math.floor(opts.maxHeight / lineHeight) + 1;
  const cappedLines = Math.max(1, Math.min(opts.maxLines, heightLines));
  return {
    lines: wrapText(context, text, opts.maxWidth).slice(0, cappedLines),
    font,
    size: opts.minSize,
    lineHeight,
  };
}

/* ------------------------------------------------------------------ */
/* 心情标语                                                            */
/* ------------------------------------------------------------------ */

export interface CaptionLayout extends FittedText {
  /** 最宽一行的像素宽度 */
  width: number;
  /** 文本块视觉高度：(行数 - 1) × 行高 + 字号 */
  height: number;
}

/**
 * 标语排版：与正文共用自适应逻辑，但限制在 1~2 行、独立的字号区间，
 * 避免长句在卡面右侧被硬截断。空文案返回零尺寸。
 */
export async function layoutCaption(
  context: CanvasRenderingContext2D,
  text: string,
  family: string,
  opts: {
    maxWidth: number;
    maxLines?: number;
    maxSize: number;
    minSize: number;
    lineHeightRatio?: number;
    weight?: number;
  }
): Promise<CaptionLayout> {
  const trimmed = text?.trim();
  if (!trimmed) {
    return { lines: [], font: '', size: 0, lineHeight: 0, width: 0, height: 0 };
  }
  const fitted = await fitText(context, trimmed, family, {
    maxWidth: opts.maxWidth,
    maxLines: opts.maxLines ?? 2,
    maxSize: opts.maxSize,
    minSize: opts.minSize,
    lineHeightRatio: opts.lineHeightRatio ?? 1.3,
    weight: opts.weight,
  });
  context.font = fitted.font;
  const width = fitted.lines.reduce((max, row) => Math.max(max, context.measureText(row).width), 0);
  return { ...fitted, width, height: (fitted.lines.length - 1) * fitted.lineHeight + fitted.size };
}

export interface CaptionPillOptions {
  /** 左对齐时为左边界；center 对齐时为水平中心 */
  x: number;
  /** 胶囊顶边 */
  top: number;
  layout: CaptionLayout;
  padX: number;
  padY: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  color: string;
  align?: 'left' | 'center';
}

/** 绘制多行标语胶囊，返回胶囊底边 y（供后续元素继续向下排） */
export function drawCaptionPill(context: CanvasRenderingContext2D, opts: CaptionPillOptions): number {
  const { layout } = opts;
  if (!layout.lines.length) return opts.top;
  const w = layout.width + opts.padX * 2;
  const h = layout.height + opts.padY * 2;
  const x = opts.align === 'center' ? opts.x - w / 2 : opts.x;
  context.save();
  if (opts.fill || opts.stroke) {
    roundRectPath(context, x, opts.top, w, h, opts.radius ?? h / 2);
    if (opts.fill) {
      context.fillStyle = opts.fill;
      context.fill();
    }
    if (opts.stroke) {
      context.strokeStyle = opts.stroke;
      context.lineWidth = opts.strokeWidth ?? 2;
      context.stroke();
    }
  }
  context.font = layout.font;
  context.fillStyle = opts.color;
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  const firstCenter = opts.top + opts.padY + layout.size / 2;
  layout.lines.forEach((row, i) => context.fillText(row, x + opts.padX, firstCenter + i * layout.lineHeight));
  context.restore();
  return opts.top + h;
}

/* ------------------------------------------------------------------ */
/* 英雄战绩胶囊                                                        */
/* ------------------------------------------------------------------ */

/** 胜率配色强调阈值：≥60% 走强强调色，其余用常规数值色 */
export const WIN_RATE_HIGH = 60;
/** 胜率低于等于此值时不展示胜率胶囊（应援卡不呈现「低于五成」的战绩） */
export const WIN_RATE_MIN_DISPLAY = 50;

/** 可上卡的胜率；五成及以下（或后端未给）返回 null，胶囊排布随之收敛 */
export function winRateForDisplay(hero: HeroStat): number | null {
  return hero.winRate === undefined || hero.winRate <= WIN_RATE_MIN_DISPLAY ? null : hero.winRate;
}

export interface HeroChipsStyle {
  /** 名字胶囊字号；空间不足时整套字号会按比例下调，不会溢出 box */
  nameSize: number;
  /** 局数 / 胜率胶囊字号 */
  metaSize: number;
  nameColor: string;
  metaColor: string;
  nameFill: string;
  metaFill: string;
  /** 胶囊描边色，缺省不描边 */
  stroke?: string;
  /** winRate ≥ WIN_RATE_HIGH 时的胜率文字色 */
  highColor?: string;
  /** 名字字体，缺省展示大字（黄油体） */
  nameFamily?: string;
  /** 圆角 / 高度比：0.5 为全圆胶囊（缺省），方角版式给 0.14 */
  radiusRatio?: number;
  /** 'right' 时 box.x 当作右边界，整组向左生长（便签卡右对齐数值列用） */
  align?: 'left' | 'right';
}

interface HeroChip {
  text: string;
  size: number;
  color: string;
  fill: string;
  font: string;
  /** 实测胶囊宽度 */
  w: number;
  /** 胶囊高度 */
  h: number;
}

async function measureHeroChip(
  context: CanvasRenderingContext2D,
  text: string,
  size: number,
  weight: number,
  family: string,
  color: string,
  fill: string
): Promise<HeroChip> {
  const font = `${weight} ${size}px ${family}`;
  context.font = font;
  await document.fonts.load(font, text);
  const padX = Math.round(size * 0.46);
  return {
    text,
    size,
    color,
    fill,
    font,
    w: Math.round(context.measureText(text).width) + padX * 2,
    h: Math.round(size * 1.68),
  };
}

/**
 * 英雄战绩胶囊：把「夏洛特 / 32局 / 胜率68.8%」三个字段排进一块窄槽。
 *
 * 排版按「字号优先、行数其次」逐级试排：先要单行带「胜率」二字的全量文案，
 * 放不下就省掉「胜率」前缀（% 号自证含义），再放不下就拆成名字一行、
 * 局数与胜率一行。各模板槽宽从 300（signal）到 470（poster）都能容下。
 * 胜率不上图形，只靠字号与配色强调（≥WIN_RATE_HIGH 用 highColor）；
 * 低于 WIN_RATE_MIN_DISPLAY 的胜率不渲染，排布自动收敛为「名字 + N局」。
 *
 * 返回胶囊组实际占用的底部 y，便于模板判断是否顶到面板边界。
 */
export async function drawHeroChips(
  context: CanvasRenderingContext2D,
  hero: HeroStat,
  box: { x: number; y: number; w: number; h: number },
  style: HeroChipsStyle
): Promise<number> {
  const winRate = winRateForDisplay(hero);

  let last: { rows: HeroChip[][]; block: HeroBlock; gap: number; rowGap: number } | null = null;
  for (const scale of HERO_CHIP_SCALES) {
    for (const rows of await heroChipLayouts(context, hero, style, scale, winRate)) {
      const gap = Math.round(style.metaSize * scale * 0.5);
      const rowGap = Math.round(style.metaSize * scale * 0.42);
      const block = measureBlock(rows, gap, rowGap);
      last = { rows, block, gap, rowGap };
      if (block.w <= box.w && block.h <= box.h) {
        return paintChips(context, rows, block, box, style, gap, rowGap);
      }
    }
  }
  // 全档都塞不进（极窄槽）：也要把英雄画出来，允许纵向溢出面板
  if (last) return paintChips(context, last.rows, last.block, box, style, last.gap, last.rowGap);
  return box.y;
}

/** 逐级试排的字号比例：先保字大，再保行少 */
const HERO_CHIP_SCALES = [1, 0.88, 0.78, 0.7];

interface HeroBlock {
  w: number;
  h: number;
}

/**
 * 按「单行全量 → 单行省「胜率」前缀 → 两行 → 三行」的顺序给出候选排布。
 * 同字号下候选去重（无胜率时前两种排布等价），空行会被剔除。
 */
async function heroChipLayouts(
  context: CanvasRenderingContext2D,
  hero: HeroStat,
  style: HeroChipsStyle,
  scale: number,
  winRate: number | null
): Promise<HeroChip[][][]> {
  const nameSize = Math.round(style.nameSize * scale);
  const metaSize = Math.round(style.metaSize * scale);
  const name = await measureHeroChip(
    context,
    hero.name,
    nameSize,
    400,
    style.nameFamily ?? FAMILY_TITLE,
    style.nameColor,
    style.nameFill
  );
  const games =
    hero.games === undefined
      ? null
      : await measureHeroChip(context, `${hero.games}局`, metaSize, 500, FAMILY_BODY, style.metaColor, style.metaFill);
  const rateColor =
    winRate !== null && winRate >= WIN_RATE_HIGH ? (style.highColor ?? style.metaColor) : style.metaColor;
  const rate = async (text: string) =>
    measureHeroChip(context, text, metaSize, 700, FAMILY_MONO, rateColor, style.metaFill);
  const rateLong = winRate === null ? null : await rate(`胜率${winRate}%`);
  const rateShort = winRate === null ? null : await rate(`${winRate}%`);

  const meta = (chip: HeroChip | null) => [games, chip].filter((c): c is HeroChip => c !== null);
  const layouts: HeroChip[][][] = [];
  const seen = new Set<string>();
  const push = (rows: HeroChip[][]) => {
    const cleaned = rows.filter((row) => row.length > 0);
    if (cleaned.length === 0) return;
    const key = cleaned.map((row) => row.map((chip) => chip.text).join('+')).join('|');
    if (seen.has(key)) return;
    seen.add(key);
    layouts.push(cleaned);
  };
  push([[name, ...meta(rateLong)]]);
  push([[name, ...meta(rateShort)]]);
  push([[name], meta(rateLong)]);
  push([[name], meta(rateShort)]);
  push([[name], meta(null), rateShort ? [rateShort] : []]);
  return layouts;
}

function measureBlock(rows: HeroChip[][], gap: number, rowGap: number): HeroBlock {
  let w = 0;
  let h = 0;
  for (const [i, row] of rows.entries()) {
    w = Math.max(w, rowWidth(row, gap));
    h += Math.max(...row.map((chip) => chip.h)) + (i > 0 ? rowGap : 0);
  }
  return { w, h };
}

function rowWidth(row: HeroChip[], gap: number): number {
  return row.reduce((sum, chip) => sum + chip.w, 0) + gap * Math.max(row.length - 1, 0);
}

/** 落笔绘制，返回胶囊组底部 y。左对齐时各行共享左边界，右对齐共享右边界。 */
function paintChips(
  context: CanvasRenderingContext2D,
  rows: HeroChip[][],
  block: HeroBlock,
  box: { x: number; y: number; w: number; h: number },
  style: HeroChipsStyle,
  gap: number,
  rowGap: number
): number {
  const top = Math.max(box.y, box.y + (box.h - block.h) / 2);
  let rowTop = top;
  context.save();
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const row of rows) {
    const rowH = Math.max(...row.map((chip) => chip.h));
    let cursor = style.align === 'right' ? box.x - rowWidth(row, gap) : box.x;
    for (const chip of row) {
      // 同行胶囊统一取本行最高者的框高：字号保留层级，上下沿对齐，
      // 否则小胶囊会短一截、文字还落在框外偏下，排出来是「从高到低」的锯齿
      roundRectPath(context, cursor, rowTop, chip.w, rowH, rowH * (style.radiusRatio ?? 0.5));
      context.fillStyle = chip.fill;
      context.fill();
      if (style.stroke) {
        context.lineWidth = 1;
        context.strokeStyle = style.stroke;
        context.stroke();
      }
      context.font = chip.font;
      context.fillStyle = chip.color;
      context.fillText(chip.text, cursor + chip.w / 2, rowTop + rowH / 2);
      cursor += chip.w + gap;
    }
    rowTop += rowH + rowGap;
  }
  context.restore();
  return rowTop - rowGap;
}

/* ------------------------------------------------------------------ */
/* 质感装饰                                                            */
/* ------------------------------------------------------------------ */

export interface BlobOptions {
  colors: string[];
  count: [number, number];
  /** [alphaMin, alphaMax] */
  alpha: [number, number];
  /** 半径范围 px */
  radius: [number, number];
  /** 色斑中心距画布边缘的最小距离 */
  padding?: number;
}

/** 弥散光斑：若干大半径低透明径向渐变（blob 法模拟 mesh gradient，无需 filter） */
export function drawBlobs(ctx: CanvasRenderingContext2D, rng: CardRng, opts: BlobOptions): void {
  const count = rng.int(opts.count[0], opts.count[1]);
  const padding = opts.padding ?? 0;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const cx = rng.range(padding, CARD_WIDTH - padding);
    const cy = rng.range(padding, CARD_HEIGHT - padding);
    const r = rng.range(opts.radius[0], opts.radius[1]);
    const color = rng.pick(opts.colors);
    const alpha = rng.range(opts.alpha[0], opts.alpha[1]);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(${toRgb(color)},${alpha})`);
    grad.addColorStop(1, `rgba(${toRgb(color)},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
}

/** 细颗粒噪点，防色带 + 纸感/胶片感 */
export function drawGrain(
  ctx: CanvasRenderingContext2D,
  rng: CardRng,
  opts: { density?: number; alpha?: number; colors?: string[] }
): void {
  const density = opts.density ?? 2200;
  const alpha = opts.alpha ?? 0.05;
  const colors = opts.colors ?? ['#000000'];
  ctx.save();
  for (let i = 0; i < density; i++) {
    ctx.globalAlpha = rng.range(alpha * 0.4, alpha);
    ctx.fillStyle = rng.pick(colors);
    ctx.fillRect(rng.range(0, CARD_WIDTH), rng.range(0, CARD_HEIGHT), rng.range(1, 2.4), rng.range(1, 2.4));
  }
  ctx.restore();
}

/** 星点（夜色模板用）：少量带十字光芒 */
export function drawStars(
  ctx: CanvasRenderingContext2D,
  rng: CardRng,
  opts: { count?: number; color?: string; maxY?: number }
): void {
  const count = opts.count ?? 110;
  const color = opts.color ?? '#EDE6FF';
  const maxY = opts.maxY ?? CARD_HEIGHT;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = rng.range(20, CARD_WIDTH - 20);
    const y = rng.range(20, maxY);
    const r = rng.range(1, 3);
    ctx.globalAlpha = rng.range(0.15, 0.7);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (rng.bool(0.12)) {
      ctx.globalAlpha = rng.range(0.2, 0.5);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      const len = rng.range(6, 14);
      ctx.beginPath();
      ctx.moveTo(x - len, y);
      ctx.lineTo(x + len, y);
      ctx.moveTo(x, y - len);
      ctx.lineTo(x, y + len);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 手绘抖动椭圆（红笔圈注打卡天数等） */
export function drawWobblyEllipse(
  ctx: CanvasRenderingContext2D,
  rng: CardRng,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  lineWidth = 5,
  turns = 1
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  const startAngle = rng.range(0, Math.PI * 2);
  const points = 26 * turns;
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const t = startAngle + (i / 26) * Math.PI * 2;
    const wobble = 1 + rng.range(-0.055, 0.055);
    const px = cx + Math.cos(t) * rx * wobble;
    const py = cy + Math.sin(t) * ry * wobble;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

/** 和纸胶带：半透明斜贴矩形 + 轻微阴影 */
export function drawTape(
  ctx: CanvasRenderingContext2D,
  rng: CardRng,
  cx: number,
  cy: number,
  w: number,
  h: number,
  color: string,
  rotation?: number
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation ?? rng.range(-0.09, 0.09));
  ctx.globalAlpha = 0.82;
  ctx.shadowColor = 'rgba(60,40,20,0.18)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  // 两端撕裂口（与胶带同色系的锯齿缺角，画成背景不可知的小三角暗角）
  ctx.shadowColor = 'transparent';
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  const notch = h * 0.32;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(-w / 2 + notch, -h / 2);
  ctx.lineTo(-w / 2, -h / 2 + notch);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w / 2, h / 2);
  ctx.lineTo(w / 2 - notch, h / 2);
  ctx.lineTo(w / 2, h / 2 - notch);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 半透明荧光笔划痕：垫在文字底下 */
export function drawHighlighter(
  ctx: CanvasRenderingContext2D,
  rng: CardRng,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rng.range(-0.02, 0.02));
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = color;
  // 两段错位矩形模拟手扫痕
  ctx.fillRect(-w / 2, -h / 2, w * 0.72, h);
  ctx.fillRect(-w / 2 + w * 0.2, -h / 2 + h * 0.08, w * 0.8, h * 0.84);
  ctx.restore();
}

/** 半调网点（印刷质感） */
export function drawHalftone(
  ctx: CanvasRenderingContext2D,
  rng: CardRng,
  opts: { x: number; y: number; w: number; h: number; step?: number; radius?: number; alpha?: number; color?: string }
): void {
  const step = opts.step ?? 22;
  const alpha = opts.alpha ?? 0.08;
  const color = opts.color ?? '#000000';
  ctx.save();
  ctx.fillStyle = color;
  for (let py = opts.y; py < opts.y + opts.h; py += step) {
    for (let px = opts.x + ((py / step) % 2 === 0 ? 0 : step / 2); px < opts.x + opts.w; px += step) {
      ctx.globalAlpha = rng.range(alpha * 0.4, alpha);
      ctx.beginPath();
      ctx.arc(px, py, rng.range(opts.radius ?? 2.2, (opts.radius ?? 2.2) * 1.6), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* QR                                                                 */
/* ------------------------------------------------------------------ */

export function getSiteUrl(): string {
  return new URL('/cheer', import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin).toString();
}

export async function buildQrImage(dark = '#0A0E1AFF', light = '#FFFFFFFF'): Promise<HTMLImageElement> {
  const dataUrl = await QRCode.toDataURL(getSiteUrl(), {
    width: 320,
    margin: 1,
    color: { dark, light },
  });
  return loadImage(dataUrl);
}

export interface QrFrameOptions {
  x: number;
  y: number;
  size: number;
  frameFill: string;
  frameStroke?: string;
  accentStroke?: string;
  radius?: number;
  shadow?: boolean;
}

/** 圆角白卡 + 内嵌二维码（各模板共用骨架，配色由模板给） */
export function drawQrFramed(ctx: CanvasRenderingContext2D, qr: HTMLImageElement, opts: QrFrameOptions): void {
  const { x, y, size } = opts;
  const r = opts.radius ?? 18;
  ctx.save();
  if (opts.shadow) {
    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
  }
  roundRectPath(ctx, x, y, size, size, r);
  ctx.fillStyle = opts.frameFill;
  ctx.fill();
  ctx.restore();

  if (opts.frameStroke) {
    roundRectPath(ctx, x, y, size, size, r);
    ctx.lineWidth = 1;
    ctx.strokeStyle = opts.frameStroke;
    ctx.stroke();
  }

  const inset = Math.round(size * 0.051);
  const inner = size - inset * 2;
  ctx.save();
  roundRectPath(ctx, x + inset, y + inset, inner, inner, Math.round(r * 0.67));
  ctx.clip();
  ctx.drawImage(qr, x + inset, y + inset, inner, inner);
  ctx.restore();

  if (opts.accentStroke) {
    roundRectPath(ctx, x + inset, y + inset, inner, inner, Math.round(r * 0.67));
    ctx.lineWidth = 1;
    ctx.strokeStyle = opts.accentStroke;
    ctx.stroke();
  }
}

/* ------------------------------------------------------------------ */
/* 日期                                                                */
/* ------------------------------------------------------------------ */

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replaceAll('/', '-');
}

export function formatWeekday(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', weekday: 'long' }).format(date);
}

/** '2026-10-06' → 一年中的第几天（杂志刊号用） */
export function dayOfYear(dateLabel: string): number {
  const [year, month, day] = dateLabel.split('-').map(Number);
  if (!year || !month || !day) return 1;
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / 86400000) + 1;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('二维码绘制失败'));
    image.src = src;
  });
}
