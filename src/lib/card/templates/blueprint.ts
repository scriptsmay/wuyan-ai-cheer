import type { CheerRef } from '../../../types';
import type { CardTemplate, TemplateContext } from '../types';
import { heroEyebrowOf, selectVisibleRefs } from '../selection';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  FAMILY_BODY,
  FAMILY_MONO,
  FAMILY_SUBTITLE,
  buildQrImage,
  dayOfYear,
  drawHeroChips,
  drawQrFramed,
  drawRuns,
  drawText,
  fitText,
  formatDate,
  roundRectPath,
} from '../shared';

/* 应援 · 蓝图方格纸：浅灰底 + 双尺度工程网格 + 标注尺寸线 + 右下角标题栏 */

// const BASES = ['#F4F7FA', '#EFF4F9', '#EDF3F8'];
const BASES = ['#F4F7FA', '#fdfdfd', '#FFFFFF'];
const INK = '#0B2130';
const MUTED = '#45657A';
const DIM = '#7593A8';
const FRAME = 'rgba(11,33,48,0.45)';

const GRID_MINOR = 24;
const GRID_MAJOR = 120;

function drawGrid(ctx: CanvasRenderingContext2D, rgb: string): void {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(${rgb},0.07)`;
  for (let x = 0; x <= CARD_WIDTH; x += GRID_MINOR) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CARD_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= CARD_HEIGHT; y += GRID_MINOR) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_WIDTH, y);
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(${rgb},0.16)`;
  for (let x = 0; x <= CARD_WIDTH; x += GRID_MAJOR) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CARD_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= CARD_HEIGHT; y += GRID_MAJOR) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFrame(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.strokeStyle = FRAME;
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, CARD_WIDTH - 96, CARD_HEIGHT - 96);
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(11,33,48,0.22)';
  ctx.strokeRect(62, 62, CARD_WIDTH - 124, CARD_HEIGHT - 124);
  ctx.restore();

  // 角部定位十字
  ctx.save();
  ctx.strokeStyle = FRAME;
  ctx.lineWidth = 1.5;
  const corners: [number, number][] = [
    [48, 48],
    [CARD_WIDTH - 48, 48],
    [48, CARD_HEIGHT - 48],
    [CARD_WIDTH - 48, CARD_HEIGHT - 48],
  ];
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy);
    ctx.lineTo(cx + 14, cy);
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx, cy + 14);
    ctx.stroke();
  }
  ctx.restore();
}

function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 11 * dir, y - 5);
  ctx.lineTo(x - 11 * dir, y + 5);
  ctx.closePath();
  ctx.fill();
}

/** 水平尺寸线：两端箭头 + 界线 + 居中编号 */
function dimensionH(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, label: string): void {
  ctx.save();
  ctx.strokeStyle = DIM;
  ctx.fillStyle = DIM;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  for (const x of [x1, x2]) {
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 8);
    ctx.stroke();
  }
  arrowHead(ctx, x1, y, -1);
  arrowHead(ctx, x2, y, 1);
  ctx.font = `500 18px ${FAMILY_MONO}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = MUTED;
  ctx.fillText(label, (x1 + x2) / 2, y - 12);
  ctx.restore();
}

/** 垂直尺寸线 */
function dimensionV(ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number, label: string): void {
  ctx.save();
  ctx.strokeStyle = DIM;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2);
  ctx.stroke();
  for (const y of [y1, y2]) {
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x + 8, y);
    ctx.stroke();
  }
  ctx.fillStyle = DIM;
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x - 5, y1 + 11);
  ctx.lineTo(x + 5, y1 + 11);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y2);
  ctx.lineTo(x - 5, y2 - 11);
  ctx.lineTo(x + 5, y2 - 11);
  ctx.closePath();
  ctx.fill();
  ctx.font = `500 18px ${FAMILY_MONO}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(label, x + 14, (y1 + y2) / 2);
  ctx.restore();
}

/** 引出线标注：圆点 + 折线 + 文本 */
function leader(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 40, y - 34);
  ctx.lineTo(x + 150, y - 34);
  ctx.stroke();
  ctx.font = `500 20px ${FAMILY_MONO}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(label, x + 46, y - 42);
  ctx.restore();
}

async function drawSpecTable(ctx: CanvasRenderingContext2D, refs: CheerRef[], accent: string): Promise<void> {
  const x = 96;
  const w = 640;
  const y = 1032;
  ctx.save();
  ctx.strokeStyle = FRAME;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x, y - 46, w, 46 * (refs.length + 1) + 8);
  ctx.restore();
  ctx.save();
  ctx.font = `600 20px ${FAMILY_MONO}`;
  ctx.fillStyle = MUTED;
  ctx.fillText('SEASON SPEC', x + 16, y - 16);
  ctx.restore();

  for (const [i, ref] of refs.entries()) {
    const rowY = y + i * 46;
    ctx.save();
    ctx.strokeStyle = 'rgba(11,33,48,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, rowY + 46);
    ctx.lineTo(x + w, rowY + 46);
    ctx.stroke();
    ctx.font = `400 22px ${FAMILY_BODY}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(ref.hero ? heroEyebrowOf(ref) : ref.label, x + 16, rowY + 30);
    ctx.restore();
    if (ref.hero) {
      // 胶囊右对齐到数值列边界，与其余行的等宽数字同一基线
      await drawHeroChips(
        ctx,
        ref.hero,
        { x: x + w - 16, y: rowY + 2, w: 400, h: 42 },
        {
          nameSize: 24,
          metaSize: 18,
          align: 'right',
          nameColor: i === 0 ? accent : INK,
          metaColor: DIM,
          nameFill: 'rgba(11,33,48,0.08)',
          metaFill: 'rgba(11,33,48,0.04)',
          stroke: 'rgba(11,33,48,0.28)',
          highColor: '#1F7A5C',
          nameFamily: FAMILY_SUBTITLE,
          radiusRatio: 0.2,
        }
      );
      continue;
    }
    ctx.save();
    ctx.font = `700 30px ${FAMILY_MONO}`;
    ctx.fillStyle = i === 0 ? accent : INK;
    ctx.textAlign = 'right';
    ctx.fillText(ref.value, x + w - 16, rowY + 32);
    ctx.restore();
  }
}

async function draw(ctx: TemplateContext): Promise<void> {
  const { ctx: context, theme, input, rng, dateLabel } = ctx;

  context.fillStyle = rng.pick(BASES);
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  drawGrid(context, theme.primaryRgb);
  drawFrame(context);

  // 图头
  await drawText(
    context,
    `DWG NO. ${String(dayOfYear(dateLabel)).padStart(3, '0')} / KPL WUYAN`,
    96,
    150,
    `600 24px ${FAMILY_MONO}`,
    theme.primary
  );
  await drawText(context, '今日加油卡片', 96, 224, `400 52px ${FAMILY_SUBTITLE}`, INK);
  dimensionH(context, 96, 984, 262, 'SPAN 888');

  // 主文案（图纸正文用中等重量无衬线，读起来像规格说明）
  const copyTop = 384;
  const fitted = await fitText(context, input.line, FAMILY_SUBTITLE, {
    maxWidth: 720,
    maxLines: 6,
    maxSize: 62,
    minSize: 40,
    lineHeightRatio: 1.42,
    weight: 500,
  });
  context.font = fitted.font;
  context.fillStyle = INK;
  fitted.lines.forEach((row, index) => context.fillText(row, 96, copyTop + index * fitted.lineHeight));
  const copyBottom = copyTop + (fitted.lines.length - 1) * fitted.lineHeight;

  leader(context, 600, copyBottom + 96, 'CHEER.LINE', theme.primary);
  dimensionV(context, 860, copyTop - 56, Math.min(copyBottom + 6, 960), `H=${Math.round(copyBottom - copyTop + 112)}`);

  // 心情标语：描边规格标签
  if (input.emojiCaption) {
    const font = `500 26px ${FAMILY_SUBTITLE}`;
    context.font = font;
    await document.fonts.load(font, input.emojiCaption);
    const tw = context.measureText(input.emojiCaption).width;
    const top = Math.min(copyBottom + 78, 1000);
    context.save();
    roundRectPath(context, 96, top - 34, tw + 132, 52, 6);
    context.strokeStyle = theme.secondary;
    context.lineWidth = 1.6;
    context.stroke();
    context.font = `600 20px ${FAMILY_MONO}`;
    context.fillStyle = theme.secondary;
    context.fillText('MOOD', 112, top);
    context.font = font;
    context.fillStyle = INK;
    context.fillText(input.emojiCaption, 184, top + 1);
    context.restore();
  }

  // 规格表
  if (input.showRefs !== false && input.refs.length) {
    await drawSpecTable(context, selectVisibleRefs(input.refs, rng, 2, 12), theme.primary);
  } else {
    dimensionH(context, 96, 736, 1060, 'AWAITING TELEMETRY');
  }

  // 右下标题栏（工程图 signature block）+ QR
  if (input.showQr !== false) {
    const bx = 776;
    const by = 1116;
    const bw = 256;
    const bh = 232;
    context.save();
    context.fillStyle = 'rgba(255,255,255,0.86)';
    context.strokeStyle = FRAME;
    context.lineWidth = 1.6;
    roundRectPath(context, bx, by, bw, bh, 10);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(bx, by + 42);
    context.lineTo(bx + bw, by + 42);
    context.stroke();
    context.restore();

    context.save();
    context.font = `600 20px ${FAMILY_MONO}`;
    context.fillStyle = MUTED;
    context.fillText('SCAN / RECEIVE', bx + 16, by + 28);
    context.restore();

    const qr = await buildQrImage(`${INK}FF`, '#FFFFFFFF');
    drawQrFramed(context, qr, { x: bx + 44, y: by + 62, size: 168, frameFill: '#FFFFFF', radius: 6 });
  }

  // 页脚（图框内左下）
  const today = formatDate(new Date());
  await drawRuns(
    context,
    [
      { text: `DATE ${today}`, font: `500 22px ${FAMILY_MONO}`, color: DIM },
      { text: '   KPL无言应援信号站', font: `400 22px ${FAMILY_BODY}`, color: DIM },
      { text: '   REV A', font: `500 22px ${FAMILY_MONO}`, color: theme.primary },
    ],
    96,
    1384
  );
}

export const blueprintTemplate: CardTemplate = {
  id: 'blueprint',
  name: '蓝图方格纸',
  draw,
};
