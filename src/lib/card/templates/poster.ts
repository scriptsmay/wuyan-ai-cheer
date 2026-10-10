import type { CardTemplate, TemplateContext } from '../types';
import { selectVisibleRefs } from '../selection';
import {
  FAMILY_BODY,
  FAMILY_TITLE,
  buildQrImage,
  drawHalftone,
  drawQrFramed,
  drawText,
  drawRuns,
  fitText,
  formatDate,
  roundRectPath,
} from '../shared';

/* 应援 · victory 大字报：红黄撞色色块冲击 + 黄油体超大字 + 印刷网点质感 */

const RED = '#E0392F';
const RED_DEEP = '#C22F26';
const CREAM = '#F6EFE0';
const YELLOW = '#FFD23F';
const INK = '#1A1512';
const CREAM_TEXT = '#FFF6E5';

interface PosterVariant {
  /** 顶部主色块（0 到 topBottom 填 topColor） */
  topColor: string;
  topBottom: number;
  bottomColor: string;
  /** 底部色带（如黑条），null 无 */
  band: { color: string; from: number } | null;
  copyColor: string;
  shadowColor: string;
  halftoneColor: string;
  eyebrowColor: string;
  sealBg: string;
  sealText: string;
  /** y < zoneSplit 区域视为顶部色块区（决定 caption/正文配色） */
  zoneSplit: number;
  captionColor: string;
  captionBar: string;
}

const VARIANTS: PosterVariant[] = [
  {
    topColor: RED,
    topBottom: 900,
    bottomColor: CREAM,
    band: null,
    copyColor: CREAM_TEXT,
    shadowColor: YELLOW,
    halftoneColor: '#000000',
    eyebrowColor: YELLOW,
    sealBg: CREAM,
    sealText: RED,
    zoneSplit: 900,
    captionColor: CREAM_TEXT,
    captionBar: YELLOW,
  },
  {
    topColor: RED,
    topBottom: 1440,
    bottomColor: RED,
    band: { color: INK, from: 1150 },
    copyColor: CREAM_TEXT,
    shadowColor: YELLOW,
    halftoneColor: '#000000',
    eyebrowColor: YELLOW,
    sealBg: CREAM,
    sealText: RED,
    zoneSplit: 1150,
    captionColor: CREAM_TEXT,
    captionBar: YELLOW,
  },
  {
    topColor: INK,
    topBottom: 760,
    bottomColor: RED,
    band: null,
    copyColor: YELLOW,
    shadowColor: RED_DEEP,
    halftoneColor: CREAM,
    eyebrowColor: YELLOW,
    sealBg: YELLOW,
    sealText: INK,
    zoneSplit: 760,
    captionColor: CREAM_TEXT,
    captionBar: INK,
  },
];

async function drawSeal(ctx: TemplateContext, variant: PosterVariant): Promise<void> {
  const { ctx: context, rng } = ctx;
  const size = 128;
  const cx = 918;
  const cy = 196;
  context.save();
  context.translate(cx, cy);
  context.rotate(rng.range(-0.1, -0.04));
  context.shadowColor = 'rgba(0,0,0,0.25)';
  context.shadowBlur = 14;
  context.shadowOffsetY = 4;
  roundRectPath(context, -size / 2, -size / 2, size, size, 14);
  context.fillStyle = variant.sealBg;
  context.fill();
  context.restore();

  const sealFont = `400 74px ${FAMILY_TITLE}`;
  context.save();
  context.translate(cx, cy);
  context.rotate(rng.range(-0.08, -0.03));
  context.font = sealFont;
  await document.fonts.load(sealFont, '胜');
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = variant.sealText;
  context.fillText('胜', 0, 4);
  context.restore();
}

async function drawStats(ctx: TemplateContext, variant: PosterVariant, y: number): Promise<void> {
  const { ctx: context, input } = ctx;
  const onBand = variant.band && y >= variant.band.from;
  const labelColor = onBand ? 'rgba(246,239,224,0.65)' : 'rgba(26,21,18,0.6)';
  const valueColor = onBand ? CREAM_TEXT : INK;

  const visible = input.showRefs === false ? [] : selectVisibleRefs(input.refs, ctx.rng, 2);
  if (visible.length) {
    for (const [i, ref] of visible.entries()) {
      const x = 92 + i * 470;
      await drawText(context, ref.label, x, y - 46, `500 24px ${FAMILY_BODY}`, labelColor);
      const valueFont = `700 64px "JetBrains Mono", "Noto Sans SC", monospace`;
      context.font = valueFont;
      await document.fonts.load(valueFont, ref.value);
      context.fillStyle = valueColor;
      context.fillText(ref.value, x, y + 26);
    }
    return;
  }

  // 无数据：三色装饰条
  const colors = [variant.shadowColor, variant.eyebrowColor, onBand ? CREAM : INK];
  const widths = [150, 76, 30];
  let x = 92;
  for (const [i, w] of widths.entries()) {
    context.fillStyle = colors[i] ?? INK;
    context.globalAlpha = 0.9;
    context.fillRect(x, y - 18, w, 16);
    x += w + 26;
  }
  context.globalAlpha = 1;
}

async function draw(ctx: TemplateContext): Promise<void> {
  const { ctx: context, rng, input } = ctx;
  const variant = rng.pick(VARIANTS);

  // 底色 + 顶部色块 + 底部色带
  context.fillStyle = variant.bottomColor;
  context.fillRect(0, 0, 1080, 1440);
  context.fillStyle = variant.topColor;
  context.fillRect(0, 0, 1080, variant.topBottom);
  if (variant.band) {
    context.fillStyle = variant.band.color;
    context.fillRect(0, variant.band.from, 1080, 1440 - variant.band.from);
  }
  drawHalftone(context, rng, {
    x: 0,
    y: 0,
    w: 1080,
    h: variant.topBottom,
    step: 26,
    radius: 2.4,
    alpha: 0.09,
    color: variant.halftoneColor,
  });

  // 眉头
  await drawText(
    context,
    'VICTORY · KPL WUYAN',
    92,
    152,
    `700 27px "Inter", "Noto Sans SC", sans-serif`,
    variant.eyebrowColor
  );
  await drawSeal(ctx, variant);

  // 主文案：黄油体特大字 + 错位套印阴影。
  // 兼顾短句震撼大字与长句（50字+）完整容纳不截断：
  // maxLines 开放至 5 行，minSize 降至 58px；根据总行数与可用高度动态反推字号上限与行距
  const copyTop = 336;
  const captionGap = 88;
  const captionMax = 880;
  const availableHeight = captionMax - captionGap - copyTop;
  let fitted = await fitText(context, input.line, FAMILY_TITLE, {
    maxWidth: 900,
    maxLines: 5,
    maxSize: 148,
    minSize: 58,
    lineHeightRatio: 1.2,
    weight: 400,
  });
  if (fitted.lines.length >= 4) {
    const linesCount = fitted.lines.length;
    const maxAllowedSize = Math.floor(availableHeight / Math.max(linesCount - 1, 1) / 1.18);
    if (fitted.size > maxAllowedSize) {
      fitted = await fitText(context, input.line, FAMILY_TITLE, {
        maxWidth: 900,
        maxLines: 5,
        maxSize: Math.max(maxAllowedSize, 58),
        minSize: 58,
        lineHeightRatio: 1.18,
        weight: 400,
      });
    }
  }
  const offsetX = rng.range(5, 8);
  const offsetY = rng.range(4, 7);
  context.font = fitted.font;
  await document.fonts.load(fitted.font, input.line);
  fitted.lines.forEach((row, index) => {
    const baseline = copyTop + index * fitted.lineHeight;
    context.fillStyle = variant.shadowColor;
    context.fillText(row, 90 + offsetX, baseline + offsetY);
    context.fillStyle = variant.copyColor;
    context.fillText(row, 90, baseline);
  });

  // 心情标语 + 强调色条
  const copyBottom = copyTop + (fitted.lines.length - 1) * fitted.lineHeight;
  const captionY = Math.min(copyBottom + captionGap, captionMax);
  if (input.emojiCaption) {
    const font = `400 50px ${FAMILY_TITLE}`;
    context.font = font;
    await document.fonts.load(font, input.emojiCaption);
    context.fillStyle = variant.captionColor;
    context.fillText(input.emojiCaption, 92, captionY);
    context.fillStyle = variant.captionBar;
    context.fillRect(92, captionY + 20, Math.min(context.measureText(input.emojiCaption).width + 8, 640), 12);
  }

  // 数据区（在底色区）
  const statsY = variant.band ? 1064 : 1088;
  await drawStats(ctx, variant, statsY);

  // QR + 页脚
  const qrZone = variant.band ? variant.band.color : variant.bottomColor;
  if (input.showQr !== false) {
    const qr = await buildQrImage('#1A1512FF', '#FFFFFFFE');
    const qrY = variant.band ? 1196 : 1236;
    drawQrFramed(context, qr, {
      x: 856,
      y: qrY,
      size: 168,
      frameFill: '#FFFFFF',
      radius: 10,
    });
    await drawText(
      context,
      '扫码接收胜利信号',
      940,
      qrY - 16,
      `500 22px ${FAMILY_BODY}`,
      qrZone === INK ? 'rgba(246,239,224,0.8)' : 'rgba(26,21,18,0.7)',
      'center'
    );
  }

  const today = formatDate(new Date());
  const footerColor = variant.band ? 'rgba(246,239,224,0.75)' : 'rgba(26,21,18,0.65)';
  await drawRuns(
    context,
    [
      { text: today, font: `500 24px "JetBrains Mono", "Noto Sans SC", monospace`, color: footerColor },
      { text: ' · KPL无言应援信号站', font: `500 24px ${FAMILY_BODY}`, color: footerColor },
    ],
    92,
    variant.band ? 1392 : 1408
  );
}

export const posterTemplate: CardTemplate = {
  id: 'poster',
  name: '大字报',
  draw,
};
