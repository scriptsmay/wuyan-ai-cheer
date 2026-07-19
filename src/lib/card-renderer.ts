import QRCode from 'qrcode';
import type { CheerRef, Checkin, Mood } from '../types';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1440;

/**
 * 心情主题色（P8）：不同 mood 切换主强调色 primary 与辅色 secondary。
 * 与 web UI 的 mood tokens（tokens.css）保持一致，但在深色海报底（#0A0E1A）上
 * 做了可读性微调，例如 low 的紫色提亮到 #B49BE8，避免过暗。
 * onAccent 用于 pill 等实色块上的文字色。
 */
export interface CardTheme {
  primary: string;
  primaryRgb: string; // "r,g,b"，用于生成半透明结构色
  secondary: string;
  onAccent: string;
}

const MOOD_THEME: Record<Mood, CardTheme> = {
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

function resolveTheme(mood?: Mood): CardTheme {
  return (mood && MOOD_THEME[mood]) || MOOD_THEME.daily;
}

/**
 * 字体展示方案
 * - 主标题 / 主文案（有情绪的文字）：ZCOOL QingKe HuangYou（黄油体）
 * - 副标题（caption / 状态行的中文）：HarmonyOS Sans SC Medium
 * - 正文（标签、说明文字）：Source Han Sans（= Noto Sans SC）Regular
 * - 数字（日期、连续天数、时间、数据值）：JetBrains Mono
 * - 英文装饰（SIGNAL、ONLINE、KEEP GOING 等）：Inter
 *
 * 说明：
 * - HarmonyOS Sans SC 通过 `harmonyos-sans-sc-webfont-splitted` 按字形区间拆分为多子集，
 *   浏览器在绘制时会按实际文字按需拉取对应子集，不会一次性下载全部字形。
 * - 各字体族都带「Noto Sans SC / 系统字体」兜底，避免个别字形缺失时直接掉到默认字体。
 */
const FAMILY_TITLE = '"ZCOOL QingKe HuangYou"';
const FAMILY_SUBTITLE = '"HarmonyOS Sans SC", "Noto Sans SC", sans-serif';
const FAMILY_BODY = '"Noto Sans SC", sans-serif';
const FAMILY_MONO = '"JetBrains Mono", "Noto Sans SC", monospace';
const FAMILY_ENGLISH = '"Inter", "Noto Sans SC", sans-serif';

// 主标题（黄油体，仅 400 字重）
const FONT_TITLE_HEADER = `400 70px ${FAMILY_TITLE}`;
const FONT_TITLE_MAIN = `400 80px ${FAMILY_SUBTITLE}`;
// 英文装饰
const FONT_ENGLISH_HEADER = `600 26px ${FAMILY_ENGLISH}`;
const FONT_ENGLISH_EYEBROW = `600 24px ${FAMILY_ENGLISH}`;
const FONT_ENGLISH_META = `400 20px ${FAMILY_ENGLISH}`;
// const FONT_ENGLISH_LABEL = `600 20px ${FAMILY_ENGLISH}`;
const FONT_QR_LABEL = `400 18px ${FAMILY_ENGLISH}`;
// 副标题（HarmonyOS Sans SC Medium）
const FONT_SUBTITLE_CAPTION = `500 34px ${FAMILY_SUBTITLE}`;
// P6：状态行由 32px 降到 28px（弱化，不与主文案竞争）
const FONT_SUBTITLE_STATUS = `500 28px ${FAMILY_SUBTITLE}`;
const FONT_BADGE_UNIT = `500 26px ${FAMILY_SUBTITLE}`;
// 正文（Source Han Sans Regular）
const FONT_BODY_LABEL = `400 22px ${FAMILY_BODY}`;
// 数字（JetBrains Mono）
const FONT_MONO_STATUS = `500 28px ${FAMILY_MONO}`;
const FONT_MONO_VALUE = `700 38px ${FAMILY_MONO}`;
const FONT_MONO_META = `500 22px ${FAMILY_MONO}`;

interface CardInput {
  line: string;
  emojiCaption: string;
  refs: CheerRef[];
  sourceSnapshotAt: string;
  checkin?: Checkin;
  showQr?: boolean;
  // P8：心情，用于选取主题色；缺省按 daily
  mood?: Mood;
}

export interface RenderedCard {
  dataUrl: string;
  blob: Blob;
  filename: string;
}

export async function renderCheerCard(input: CardInput): Promise<RenderedCard> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器不支持 Canvas 导出');

  const theme = resolveTheme(input.mood);

  drawBackground(context, theme);
  await drawSignalHeader(context, theme, input.checkin);
  await drawMainCopy(context, theme, input.line, input.emojiCaption);
  await drawRefs(context, theme, input.refs);
  await drawFooter(context, theme, input);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('图片编码失败'))),
      'image/png',
    );
  });
  const date = formatDate(new Date());
  return {
    dataUrl: canvas.toDataURL('image/png'),
    blob,
    filename: `wuyan-cheer-${date}.png`,
  };
}

/* ------------------------------------------------------------------ */
/* 通用绘制工具                                                          */
/* ------------------------------------------------------------------ */

/** 圆角矩形路径（arcTo 实现，兼容无 ctx.roundRect 的环境） */
function roundRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
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

/** 生成一条正弦波 Path2D（供 P2/P4 调用） */
function buildSignalWavePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  yBaseline: number,
  width: number,
  amplitude: number,
  frequency: number,
  phase: number,
  samples = 240,
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

/** 放射光芒（streak>=100 金色环用） */
function drawRays(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  count: number,
  color: string,
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

// /** 小胶囊标签（P5 ref.source / tier marker 复用） */
// function drawPill(
//   context: CanvasRenderingContext2D,
//   cx: number,
//   baselineY: number,
//   text: string,
//   font: string,
//   textColor: string,
//   borderColor: string,
//   radius = 8,
//   height = 30,
// ): void {
//   context.save();
//   context.font = font;
//   const tw = context.measureText(text).width;
//   const w = tw + 28;
//   const x = cx - w / 2;
//   const y = baselineY - height + 9;
//   roundRectPath(context, x, y, w, height, radius);
//   context.lineWidth = 1;
//   context.strokeStyle = borderColor;
//   context.stroke();
//   context.textAlign = 'center';
//   context.fillStyle = textColor;
//   context.fillText(text, cx, baselineY);
//   context.restore();
// }

/* ------------------------------------------------------------------ */
/* 背景                                                                  */
/* ------------------------------------------------------------------ */

function drawBackground(context: CanvasRenderingContext2D, theme: CardTheme) {
  context.fillStyle = '#0A0E1A';
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // P4：斜线网格 alpha 由 0.12 降到 0.06，更克制；颜色跟随心情主色
  context.save();
  context.globalAlpha = 0.06;
  context.strokeStyle = theme.primary;
  context.lineWidth = 2;
  for (let y = 80; y < CARD_HEIGHT; y += 48) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(CARD_WIDTH, y - 120);
    context.stroke();
  }
  context.restore();

  // P4：横贯大地波（一条低透明度正弦波，置于主文案与 refs 之间的留白处）
  context.save();
  context.globalAlpha = 0.05;
  context.strokeStyle = theme.primary;
  context.lineWidth = 2;
  const wave = buildSignalWavePath(context, 0, 720, CARD_WIDTH, 60, 0.004, 0);
  context.stroke(wave);
  context.restore();

  context.fillStyle = '#10192B';
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(780, 0);
  context.lineTo(570, 350);
  context.lineTo(0, 470);
  context.closePath();
  context.fill();

  // 左上角双色装饰条：辅色 + 主色
  context.fillStyle = theme.secondary;
  context.fillRect(78, 122, 16, 180);
  context.fillStyle = theme.primary;
  context.fillRect(106, 122, 5, 120);
}

/* ------------------------------------------------------------------ */
/* Header（主标题 + 状态行 + P6 streak 徽章）                              */
/* ------------------------------------------------------------------ */

async function drawSignalHeader(
  context: CanvasRenderingContext2D,
  theme: CardTheme,
  checkin?: Checkin,
) {
  // 主标题：黄油体
  await drawText(
    context,
    checkin ? '每日加油信号' : '无言应援信号',
    144,
    190,
    FONT_TITLE_HEADER,
    '#DFFBFF',
  );
  // 英文装饰
  await drawText(
    context,
    'WUYAN / FAN SIGNAL STATION',
    146,
    244,
    FONT_ENGLISH_HEADER,
    '#7AA8B8',
  );

  if (checkin) {
    // 状态行：中文（副标题 HarmonyOS Sans Medium）+ 数字（JetBrains Mono）混合排版
    // 保留全部文字（date / streak / total_days），位置 y≈300 不覆盖 streak 徽章
    await drawRuns(context, buildCheckinRuns(checkin), 146, 300);
  }

  // P6：streak 徽章（右上角）
  await drawStreakBadge(context, theme, checkin);
}

/**
 * P6 — streak 徽章
 * - 圆心 (885,230)，外环 R=110，径向渐变底 + 描边环
 * - 数字黄油体居中，单位「连续天」HarmonyOS 26
 * - 5 格信号强度条（filled = clamp(round(streak/20),1,5)）
 * - 场景差异：streak=1 绿点 NEW；>=7 橙色胶囊；>=100 金色环+光芒+金数字
 * - 无 checkin 时显示 NEW / 新信号 占位
 */
async function drawStreakBadge(
  context: CanvasRenderingContext2D,
  theme: CardTheme,
  checkin?: Checkin,
): Promise<void> {
  const cx = 885;
  const cy = 230;
  const R = 110;

  // 径向渐变底（跟随心情主色）
  const grad = context.createRadialGradient(cx, cy, 0, cx, cy, R);
  grad.addColorStop(0, `rgba(${theme.primaryRgb},0.18)`);
  grad.addColorStop(1, `rgba(${theme.primaryRgb},0)`);
  context.beginPath();
  context.arc(cx, cy, R, 0, Math.PI * 2);
  context.fillStyle = grad;
  context.fill();

  // 外环描边
  context.beginPath();
  context.arc(cx, cy, R, 0, Math.PI * 2);
  context.strokeStyle = `rgba(${theme.primaryRgb},0.5)`;
  context.lineWidth = 2;
  context.stroke();

  // 无 checkin：占位
  if (!checkin) {
    return;
  }

  const streak = checkin.streak;
  let numSize = 140;
  let numColor = theme.primary;

  // 金色段位（>=100）
  if (streak >= 100) {
    numColor = '#f4c95d';
    numSize = 132;
    context.beginPath();
    context.arc(cx, cy, R, 0, Math.PI * 2);
    context.strokeStyle = '#f4c95d';
    context.lineWidth = 3;
    context.stroke();
    drawRays(context, cx, cy, R, 8, '#f4c95d');
  }

  // 数字（黄油体，居中）
  const font = `400 ${numSize}px ${FAMILY_TITLE}`;
  await document.fonts.load(font, String(streak));
  context.save();
  context.textAlign = 'center';
  context.font = font;
  context.fillStyle = numColor;
  context.fillText(String(streak), cx, cy + numSize * 0.35);
  context.restore();

  // 单位
  await drawText(
    context,
    'DAY',
    cx,
    cy + 102,
    FONT_BADGE_UNIT,
    '#86A8B8',
    'center',
  );
}

/* ------------------------------------------------------------------ */
/* 主文案                                                                */
/* ------------------------------------------------------------------ */

async function drawMainCopy(
  context: CanvasRenderingContext2D,
  theme: CardTheme,
  line: string,
  emojiCaption: string,
) {
  // 英文装饰（跟随心情主色）
  await drawText(
    context,
    'SIGNAL / 01',
    92,
    415,
    FONT_ENGLISH_EYEBROW,
    theme.primary,
  );
  // 主文案：黄油体（大标题）
  context.font = FONT_TITLE_MAIN;
  await document.fonts.load(FONT_TITLE_MAIN, line);
  context.fillStyle = '#F5FBFF';
  // P1：wrapText maxWidth 由 840 提到 896（黄油体更宽，避免换行点漂移）
  const wrapped = wrapText(context, line, 896);
  const rendered = wrapped.slice(0, 4);
  rendered.forEach((row, index) =>
    context.fillText(row, 92, 520 + index * 106),
  );

  // P4：emojiCaption 做成情绪 pill（辅色实底 + onAccent 文字），动态 y
  const captionBaseline = 620 + (rendered.length - 1) * 106 + 96;
  await drawCaptionPill(context, theme, emojiCaption, 92, captionBaseline);
}

/** P4 — 情绪 pill：左对齐圆角实底徽章，宽度按文字自适应 */
async function drawCaptionPill(
  context: CanvasRenderingContext2D,
  theme: CardTheme,
  text: string,
  x: number,
  baselineY: number,
): Promise<void> {
  if (!text) return;
  context.font = FONT_SUBTITLE_CAPTION;
  await document.fonts.load(FONT_SUBTITLE_CAPTION, text);
  const tw = context.measureText(text).width;
  const padX = 28;
  const h = 62;
  const w = tw + padX * 2;
  const top = baselineY - 44; // 让文字在 pill 中垂直居中

  context.save();
  roundRectPath(context, x, top, w, h, h / 2);
  context.fillStyle = theme.secondary;
  context.fill();
  context.fillStyle = theme.onAccent;
  context.textBaseline = 'middle';
  context.fillText(text, x + padX, top + h / 2 + 2);
  context.restore();
}

/* ------------------------------------------------------------------ */
/* refs（数据引用）                                                      */
/* ------------------------------------------------------------------ */

async function drawRefs(
  context: CanvasRenderingContext2D,
  theme: CardTheme,
  refs: CheerRef[],
): Promise<void> {
  const visible = refs.slice(0, 2);

  // P3：refs 为空时画占位卡（频段刻度），不再直接 return
  if (visible.length === 0) {
    drawRefsPlaceholder(context, theme);
    return;
  }

  context.strokeStyle = '#25445A';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(92, 1094);
  context.lineTo(720, 1094);
  context.stroke();

  for (const [i, ref] of visible.entries()) {
    const x = 92 + i * 320;
    // 标签：正文（Source Han Sans Regular）
    await drawText(context, ref.label, x, 1142, FONT_BODY_LABEL, '#6F93A3');
    // 数值：数字（JetBrains Mono，跟随心情主色）
    context.font = FONT_MONO_VALUE;
    await document.fonts.load(FONT_MONO_VALUE, ref.value);
    context.fillStyle = theme.primary;
    context.fillText(ref.value, x, 1194);
    // // P5：数值下方画 source 小胶囊标签
    // const vw = context.measureText(ref.value).width;
    // drawPill(
    //   context,
    //   x + vw / 2,
    //   1232,
    //   ref.source,
    //   FONT_ENGLISH_META,
    //   '#577485',
    //   '#24435a',
    //   8,
    // );
  }
}

/** P3 — refs 空状态占位卡 */
function drawRefsPlaceholder(
  context: CanvasRenderingContext2D,
  theme: CardTheme,
): void {
  const x = 92;
  const y = 1094;
  const w = 896;
  const h = 104;
  const r = 18;

  roundRectPath(context, x, y, w, h, r);
  context.fillStyle = '#121d30';
  context.fill();
  context.lineWidth = 1;
  context.strokeStyle = 'rgba(36,67,90,0.5)';
  context.stroke();

  // 左侧 8 根等差高短横（频段刻度，跟随心情主色）
  context.save();
  context.strokeStyle = `rgba(${theme.primaryRgb},0.25)`;
  context.lineWidth = 4;
  const bx = 132;
  const by = y + 28;
  const bh = 48;
  const step = 12;
  for (let i = 0; i < 8; i++) {
    const barH = bh * (0.4 + (0.6 * i) / 7);
    const barX = bx + i * step;
    context.beginPath();
    context.moveTo(barX, by + (bh - barH));
    context.lineTo(barX, by + bh);
    context.stroke();
  }
  context.restore();

  // 居中文字
  context.save();
  context.textAlign = 'center';
  context.font = FONT_ENGLISH_META;
  context.fillStyle = '#577485';
  context.fillText(
    '信号频段采集中 · SIGNAL SPECTRUM STANDBY',
    x + w / 2,
    y + h / 2 + 7,
  );
  context.restore();
}

/* ------------------------------------------------------------------ */
/* Footer（QR + 数据读出）                                               */
/* ------------------------------------------------------------------ */

async function drawFooter(
  context: CanvasRenderingContext2D,
  theme: CardTheme,
  input: CardInput,
) {
  // 圆角 QR 卡（替换原先的白块 fillRect）
  if (input.showQr !== false) {
    const siteUrl = new URL(
      '/cheer',
      import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin,
    ).toString();
    const qrDataUrl = await QRCode.toDataURL(siteUrl, {
      width: 176,
      margin: 1,
      color: { dark: '#0A0E1AFF', light: '#F5FBFFFF' },
    });
    const qr = await loadImage(qrDataUrl);

    // 容器卡（带阴影）
    context.save();
    context.shadowBlur = 30;
    context.shadowColor = 'rgba(0,0,0,0.4)';
    roundRectPath(context, 812, 1170, 196, 196, 18);
    context.fillStyle = '#10182a';
    context.fill();
    context.restore();

    // 卡边框
    roundRectPath(context, 812, 1170, 196, 196, 18);
    context.lineWidth = 1;
    context.strokeStyle = 'rgba(36,67,90,0.5)';
    context.stroke();

    // QR（圆角裁剪）
    context.save();
    roundRectPath(context, 822, 1180, 176, 176, 12);
    context.clip();
    context.drawImage(qr, 822, 1180, 176, 176);
    context.restore();

    // 内描边（跟随心情主色，与主体建立关联）
    roundRectPath(context, 822, 1180, 176, 176, 12);
    context.lineWidth = 1;
    context.strokeStyle = `rgba(${theme.primaryRgb},0.35)`;
    context.stroke();

    // 顶部标签（对比度提升）
    await drawText(
      context,
      '扫码接收今日信号',
      910,
      1160,
      FONT_QR_LABEL,
      '#9FB4C0',
      'center',
    );
  }

  // [deleted] P5：数据读出 —— 快照时间（sourceSnapshotAt）；P7 对比度提升
  // if (input.sourceSnapshotAt) {
  //   await drawText(
  //     context,
  //     `快照 ${formatDateTime(input.sourceSnapshotAt)}`,
  //     92,
  //     1270,
  //     FONT_ENGLISH_META,
  //     '#7E9AAA',
  //   );
  // }

  // P7：底部文字对比度提升（原 #587483 在深底上偏暗，保存到相册后更难辨认）
  const today = formatDate(new Date());
  const darkColor = '#587483';
  await drawRuns(
    context,
    [
      { text: '生成日期 ： ', font: FONT_BODY_LABEL, color: darkColor },
      { text: today, font: FONT_MONO_META, color: darkColor },
      { text: ' · ', font: FONT_MONO_META, color: darkColor },
      { text: '无言应援信号站', font: FONT_MONO_META, color: darkColor },
    ],
    92,
    1360,
  );
  // // 时间戳：数字（JetBrains Mono）
  // await drawText(
  //   context,
  //   '无言应援信号站',
  //   92,
  //   1390,
  //   FONT_MONO_META,
  //   '#9FB4C0',
  // );
}

/* ------------------------------------------------------------------ */
/* 文本 / 排版工具                                                       */
/* ------------------------------------------------------------------ */

/**
 * 绘制一段「字形区间混合」文本：同一行内不同片段可使用不同字体，
 * 依次横向排布。用于在中文句子中把数字单独用等宽字体渲染。
 */
interface GlyphRun {
  text: string;
  font: string;
  color: string;
}

async function drawRuns(
  context: CanvasRenderingContext2D,
  runs: GlyphRun[],
  x: number,
  y: number,
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

async function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align?: CanvasTextAlign,
): Promise<void> {
  context.save();
  context.font = font;
  await document.fonts.load(font, text);
  context.fillStyle = color;
  if (align) context.textAlign = align;
  context.fillText(text, x, y);
  context.restore();
}

function buildCheckinRuns(checkin: Checkin): GlyphRun[] {
  // P6：状态行降级为柔和青灰（原 #00D4FF 过跳，抢主文案焦点）
  const color = '#8DBFD0';
  return [
    { text: checkin.date, font: FONT_MONO_STATUS, color },
    { text: '  ·  连续 ', font: FONT_SUBTITLE_STATUS, color },
    { text: String(checkin.streak), font: FONT_MONO_STATUS, color },
    { text: ' 天  ·  累计 ', font: FONT_SUBTITLE_STATUS, color },
    { text: String(checkin.total_days), font: FONT_MONO_STATUS, color },
    { text: ' 天', font: FONT_SUBTITLE_STATUS, color },
  ];
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = '';
  for (const character of Array.from(text)) {
    const candidate = current + character;
    if (context.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('二维码绘制失败'));
    image.src = src;
  });
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replaceAll('/', '-');
}

// /** P5 — 把快照时间戳格式化为 YYYY-MM-DD HH:mm（Asia/Shanghai） */
// function formatDateTime(value: string): string {
//   if (!value) return '-';
//   const ts = Date.parse(value);
//   if (Number.isNaN(ts)) return value;
//   return new Intl.DateTimeFormat('en-CA', {
//     timeZone: 'Asia/Shanghai',
//     year: 'numeric',
//     month: '2-digit',
//     day: '2-digit',
//     hour: '2-digit',
//     minute: '2-digit',
//     hour12: false,
//   })
//     .format(new Date(ts))
//     .replace(', ', ' ');
// }
