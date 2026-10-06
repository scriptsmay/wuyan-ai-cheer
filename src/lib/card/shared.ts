import QRCode from 'qrcode';
import type { Mood } from '../../types';
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

export function resolveTheme(mood?: Mood): CardTheme {
  return (mood && MOOD_THEME[mood]) || MOOD_THEME.daily;
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
  }
): Promise<FittedText> {
  const ratio = opts.lineHeightRatio ?? 1.32;
  const probeFont = `${opts.weight ?? 400} ${opts.minSize}px ${family}`;
  context.font = probeFont;
  await document.fonts.load(probeFont, text);
  for (let size = opts.maxSize; size >= opts.minSize; size -= 4) {
    const font = `${opts.weight ?? 400} ${size}px ${family}`;
    context.font = font;
    const wrapped = wrapText(context, text, opts.maxWidth);
    if (wrapped.length <= opts.maxLines) {
      return { lines: wrapped, font, size, lineHeight: Math.round(size * ratio) };
    }
  }
  const font = `${opts.weight ?? 400} ${opts.minSize}px ${family}`;
  context.font = font;
  return {
    lines: wrapText(context, text, opts.maxWidth).slice(0, opts.maxLines),
    font,
    size: opts.minSize,
    lineHeight: Math.round(opts.minSize * ratio),
  };
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
