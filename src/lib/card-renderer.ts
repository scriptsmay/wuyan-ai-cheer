import QRCode from 'qrcode';
import type { CheerRef, Checkin } from '../types';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1440;

/**
 * 字体展示方案
 * - 主标题（有情绪的标题，如「继续坚持」「加油」）：ZCOOL QingKe HuangYou（黄油体）
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
const FONT_TITLE_MAIN = `400 88px ${FAMILY_SUBTITLE}`;
// 英文装饰
const FONT_ENGLISH_HEADER = `600 26px ${FAMILY_ENGLISH}`;
const FONT_ENGLISH_EYEBROW = `600 24px ${FAMILY_ENGLISH}`;
// 副标题（HarmonyOS Sans SC Medium）
const FONT_SUBTITLE_CAPTION = `500 34px ${FAMILY_SUBTITLE}`;
const FONT_SUBTITLE_STATUS = `500 32px ${FAMILY_SUBTITLE}`;
// 正文（Source Han Sans Regular）
const FONT_BODY_LABEL = `400 22px ${FAMILY_BODY}`;
// 数字（JetBrains Mono）
const FONT_MONO_STATUS = `500 32px ${FAMILY_MONO}`;
const FONT_MONO_VALUE = `700 38px ${FAMILY_MONO}`;
const FONT_MONO_META = `500 22px ${FAMILY_MONO}`;

interface CardInput {
  line: string;
  emojiCaption: string;
  refs: CheerRef[];
  sourceSnapshotAt: string;
  checkin?: Checkin;
  showQr?: boolean;
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

  drawBackground(context);
  await drawSignalHeader(context, input.checkin);
  await drawMainCopy(context, input.line, input.emojiCaption);
  await drawRefs(context, input.refs);
  await drawFooter(context, input);

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

function drawBackground(context: CanvasRenderingContext2D) {
  context.fillStyle = '#0A0E1A';
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  context.save();
  context.globalAlpha = 0.12;
  context.strokeStyle = '#00D4FF';
  context.lineWidth = 2;
  for (let y = 80; y < CARD_HEIGHT; y += 48) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(CARD_WIDTH, y - 120);
    context.stroke();
  }
  context.restore();

  context.fillStyle = '#10192B';
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(780, 0);
  context.lineTo(570, 350);
  context.lineTo(0, 470);
  context.closePath();
  context.fill();

  context.fillStyle = '#FF9F4D';
  context.fillRect(78, 122, 16, 180);
  context.fillStyle = '#00D4FF';
  context.fillRect(106, 122, 5, 120);
}

async function drawSignalHeader(
  context: CanvasRenderingContext2D,
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
    await drawRuns(context, buildCheckinRuns(checkin), 146, 300);
  }
}

async function drawMainCopy(
  context: CanvasRenderingContext2D,
  line: string,
  emojiCaption: string,
) {
  // 英文装饰
  await drawText(
    context,
    'SIGNAL / 01',
    92,
    515,
    FONT_ENGLISH_EYEBROW,
    '#00D4FF',
  );
  // 主标题：黄油体（大标题）
  context.font = FONT_TITLE_MAIN;
  await document.fonts.load(FONT_TITLE_MAIN, line);
  context.fillStyle = '#F5FBFF';
  const rows = wrapText(context, line, 840);
  rows
    .slice(0, 4)
    .forEach((row, index) => context.fillText(row, 92, 620 + index * 106));

  // 副标题（caption）：HarmonyOS Sans SC Medium
  await drawText(
    context,
    emojiCaption,
    96,
    1030,
    FONT_SUBTITLE_CAPTION,
    '#FFB777',
  );
}

async function drawRefs(context: CanvasRenderingContext2D, refs: CheerRef[]) {
  const visible = refs.slice(0, 2);
  if (visible.length === 0) return;
  context.strokeStyle = '#25445A';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(92, 1094);
  context.lineTo(720, 1094);
  context.stroke();

  for (const ref of visible) {
    const x = 92 + visible.indexOf(ref) * 320;
    // 标签：正文（Source Han Sans Regular）
    await drawText(context, ref.label, x, 1142, FONT_BODY_LABEL, '#6F93A3');
    // 数值：数字（JetBrains Mono，带电子设备气质）
    await drawText(context, ref.value, x, 1194, FONT_MONO_VALUE, '#00D4FF');
  }
}

async function drawFooter(context: CanvasRenderingContext2D, input: CardInput) {
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
    context.fillStyle = '#F5FBFF';
    context.fillRect(812, 1170, 188, 188);
    context.drawImage(qr, 818, 1176, 176, 176);
  }

  // 生成日期：正文 + 数字 混合
  const today = formatDate(new Date());
  await drawRuns(
    context,
    [
      { text: '生成日期 ', font: FONT_BODY_LABEL, color: '#587483' },
      { text: today, font: FONT_MONO_META, color: '#587483' },
    ],
    92,
    1320,
  );
  // 时间戳：数字（JetBrains Mono）
  await drawText(
    context,
    '无言信号应援站',
    92,
    1390,
    FONT_MONO_META,
    '#7AA8B8',
  );
}

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
): Promise<void> {
  context.font = font;
  await document.fonts.load(font, text);
  context.fillStyle = color;
  context.fillText(text, x, y);
}

function buildCheckinRuns(checkin: Checkin): GlyphRun[] {
  const color = '#00D4FF';
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

// export function formatDateTime(value: number | string): string {
//   if (value === '' || value === null || value === undefined) return '-';

//   const timestamp = typeof value === 'number' ? value : Date.parse(value);
//   if (Number.isNaN(timestamp)) return '-';

//   return new Intl.DateTimeFormat('zh-CN', {
//     timeZone: 'Asia/Shanghai',
//     year: 'numeric',
//     month: '2-digit',
//     day: '2-digit',
//     hour: '2-digit',
//     minute: '2-digit',
//   }).format(new Date(timestamp));
// }
