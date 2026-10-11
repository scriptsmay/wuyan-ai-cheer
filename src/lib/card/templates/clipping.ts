import type { CardTemplate, TemplateContext } from '../types';
import { heroEyebrowOf, selectVisibleRefs } from '../selection';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  FAMILY_BODY,
  FAMILY_TITLE,
  buildQrImage,
  dayOfYear,
  drawGrain,
  drawHalftone,
  drawHeroChips,
  drawQrFramed,
  drawRuns,
  drawText,
  drawTape,
  fitText,
  formatDate,
  roundRectPath,
  toRgb,
} from '../shared';

/* 应援 · 清新剪报：米白底 + 彩纸拼贴 + 套印错位大字 + 半调网点，risograph 手工感 */

const PAPERS = ['#FAF7F0', '#F7F3E9', '#FCF9F3'];
const INKS = ['#E4572E', '#2E8B8B', '#D94F87', '#3D7EA6', '#E8A33D'];
const PASTELS = ['#FFE3D6', '#DCF0EC', '#FBDDE8', '#DEEAF6', '#FFF0CF'];
const INK = '#26221C';
const SOFT = 'rgba(38,34,28,0.6)';

/** 撕边彩纸块：轻微旋转 + 边缘不规则缺角 */
function paperBlock(
  ctx: TemplateContext['ctx'],
  rng: TemplateContext['rng'],
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string
): void {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rng.range(-0.025, 0.025));
  ctx.shadowColor = 'rgba(60,40,20,0.14)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = fill;
  ctx.beginPath();
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const px = -w / 2 + (w * i) / steps;
    ctx.lineTo(px, -h / 2 + (i % 2 ? rng.range(-3, 3) : 0));
  }
  for (let i = 0; i <= steps; i++) {
    const py = -h / 2 + (h * i) / steps;
    ctx.lineTo(w / 2 + (i % 2 ? rng.range(-3, 3) : 0), py);
  }
  for (let i = steps; i >= 0; i--) {
    const px = -w / 2 + (w * i) / steps;
    ctx.lineTo(px, h / 2 + (i % 2 ? rng.range(-3, 3) : 0));
  }
  for (let i = steps; i >= 0; i--) {
    const py = -h / 2 + (h * i) / steps;
    ctx.lineTo(-w / 2 + (i % 2 ? rng.range(-3, 3) : 0), py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 虚线裁切框（数据剪贴块） */
function dashedChip(ctx: TemplateContext['ctx'], x: number, y: number, w: number, h: number, color: string): void {
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  roundRectPath(ctx, x, y, w, h, 10);
  ctx.stroke();
  ctx.restore();
}

async function draw(ctx: TemplateContext): Promise<void> {
  const { ctx: context, rng, input, dateLabel, theme } = ctx;
  const ink = rng.pick(INKS);
  const pastel = rng.pick(PASTELS);
  const pastelAlt = rng.pick(PASTELS);

  context.fillStyle = rng.pick(PAPERS);
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // 半调网点角部 + 主色块拼贴
  drawHalftone(context, rng, { x: 640, y: 60, w: 400, h: 260, step: 20, radius: 2.6, alpha: 0.12, color: ink });
  drawHalftone(context, rng, { x: 60, y: 1150, w: 300, h: 220, step: 24, radius: 2.2, alpha: 0.1, color: INK });
  paperBlock(context, rng, 612, 168, 400, 176, pastel);
  // 中缝右侧彩纸：填住主文案与数据块之间的留白，且始终避开文案与标语的可达范围
  paperBlock(context, rng, 660, 792, 300, 132, pastelAlt);
  // 数据块底下的垫纸：刻意让彩纸四周露出一圈撕边
  paperBlock(context, rng, 64, 1008, 400, 196, pastel);
  drawTape(context, rng, 700, 178, 150, 44, 'rgba(255,255,255,0.72)');
  drawTape(context, rng, 700, 800, 92, 30, 'rgba(255,255,255,0.66)');
  drawGrain(context, rng, { density: 1200, alpha: 0.04, colors: ['#8a7f6a', ink] });

  // 眉头
  await drawText(
    context,
    `CLIPPED FOR WUYAN · N°${dayOfYear(dateLabel)}`,
    92,
    150,
    `600 24px "Inter", "Noto Sans SC", sans-serif`,
    SOFT
  );
  await drawText(context, '今日剪报', 92, 232, `400 64px ${FAMILY_TITLE}`, INK);
  context.fillStyle = ink;
  context.fillRect(92, 252, 226, 10);

  // 主文案：套印错位（accent 副本垫底 + 墨黑正本）
  const copyTop = 420;
  const fitted = await fitText(context, input.line, FAMILY_TITLE, {
    maxWidth: 880,
    maxLines: 5,
    maxSize: 96,
    minSize: 46,
    lineHeightRatio: 1.26,
    weight: 400,
  });
  const offsetX = rng.range(5, 9);
  const offsetY = rng.range(4, 8);
  context.font = fitted.font;
  await document.fonts.load(fitted.font, input.line);
  fitted.lines.forEach((row, index) => {
    const baseline = copyTop + index * fitted.lineHeight;
    context.save();
    context.globalAlpha = 0.38;
    context.fillStyle = ink;
    context.fillText(row, 92 + offsetX, baseline + offsetY);
    context.restore();
    context.fillStyle = INK;
    context.fillText(row, 92, baseline);
  });
  const copyBottom = copyTop + (fitted.lines.length - 1) * fitted.lineHeight;

  // 心情标语：彩带剪贴条
  if (input.emojiCaption) {
    const font = `400 42px ${FAMILY_TITLE}`;
    context.font = font;
    await document.fonts.load(font, input.emojiCaption);
    const tw = context.measureText(input.emojiCaption).width;
    // 按行高留距，避免压住末行大字的全角标点下沉笔画
    const top = Math.min(copyBottom + fitted.lineHeight * 0.66 + 42, 982);
    context.save();
    context.fillStyle = ink;
    context.globalAlpha = 0.92;
    roundRectPath(context, 92, top - 42, tw + 56, 62, 8);
    context.fill();
    context.restore();
    context.font = font;
    context.fillStyle = '#FFF9F0';
    context.fillText(input.emojiCaption, 120, top);
    drawTape(context, rng, 152, top - 42, 96, 30, 'rgba(255,255,255,0.66)');
  }

  // 数据剪贴块
  if (input.showRefs !== false && input.refs.length) {
    const visible = selectVisibleRefs(input.refs, rng, 2);
    for (const [i, ref] of visible.entries()) {
      const x = 92 + i * 464;
      const y = 1040;
      const w = 432;
      const h = 148;
      context.save();
      context.fillStyle = 'rgba(255,255,255,0.75)';
      roundRectPath(context, x, y, w, h, 10);
      context.fill();
      context.restore();
      dashedChip(context, x, y, w, h, i === 0 ? ink : 'rgba(38,34,28,0.4)');
      await drawText(
        context,
        ref.hero ? heroEyebrowOf(ref) : ref.label,
        x + 28,
        y + 54,
        `400 24px ${FAMILY_BODY}`,
        SOFT
      );
      if (ref.hero) {
        await drawHeroChips(
          context,
          ref.hero,
          { x: x + 28, y: y + 68, w: w - 56, h: 64 },
          {
            nameSize: 30,
            metaSize: 21,
            nameColor: i === 0 ? ink : INK,
            metaColor: SOFT,
            nameFill: `rgba(${toRgb(theme.secondary)},0.18)`,
            metaFill: 'rgba(38,34,28,0.06)',
            stroke: 'rgba(38,34,28,0.3)',
            highColor: '#1F7A5C',
            radiusRatio: 0.18,
          }
        );
        continue;
      }
      const valueFont = `700 52px "JetBrains Mono", "Noto Sans SC", monospace`;
      context.font = valueFont;
      await document.fonts.load(valueFont, ref.value);
      context.fillStyle = i === 0 ? ink : INK;
      context.fillText(ref.value, x + 28, y + 116);
    }
  }

  // QR：白纸贴片 + 胶带
  if (input.showQr !== false) {
    paperBlock(context, rng, 800, 1226, 200, 200, '#FFFFFF');
    const qr = await buildQrImage(`${INK}FF`, '#FFFFFFFF');
    drawQrFramed(context, qr, { x: 822, y: 1248, size: 156, frameFill: '#FFFFFF', radius: 4 });
    drawTape(context, rng, 986, 1236, 92, 28, `rgba(${toRgb(theme.secondary)},0.5)`);
    await drawText(context, '扫码剪下这份应援', 898, 1214, `400 20px ${FAMILY_BODY}`, SOFT, 'center');
  }

  // 页脚
  const today = formatDate(new Date());
  await drawRuns(
    context,
    [
      { text: 'KPL无言应援信号站', font: `400 22px ${FAMILY_BODY}`, color: SOFT },
      {
        text: ` · ${today}`,
        font: `500 22px "JetBrains Mono", "Noto Sans SC", monospace`,
        color: 'rgba(38,34,28,0.45)',
      },
    ],
    92,
    1394
  );
}

export const clippingTemplate: CardTemplate = {
  id: 'clipping',
  name: '清新剪报',
  draw,
};
