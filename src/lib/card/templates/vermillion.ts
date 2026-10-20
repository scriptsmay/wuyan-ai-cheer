import type { CardTemplate, TemplateContext } from '../types';
import { CARD_STAT_COUNT, heroEyebrowOf, selectVisibleRefs } from '../selection';
import {
  FAMILY_BODY,
  FAMILY_ENGLISH,
  FAMILY_MONO,
  FAMILY_TITLE,
  FAMILY_WENKAI,
  FAMILY_SUBTITLE,
  buildQrImage,
  drawHeroChips,
  drawQrFramed,
  drawRuns,
  fitText,
  formatDate,
  layoutCaption,
  roundRectPath,
} from '../shared';

/* 应援 · 釉里红：宣纸米底 + 釉里红大字 + 圆形朱印 + 右侧竖排「无言应援」+ 四角印刷角线。
   国风印章路线，标语用霞鹜文楷手写感收尾，与「胜利」的喜、电竞的燃同框。 */

// const PAPER = '#F5EDDC';
// const INK = '#3A2B24';
// const VERMILLION = '#C3392B';
// const WIN_HIGH = '#1F7A5C';
const PAPER = '#fffdf8';
const INK = '#3A2B24';
const VERMILLION = '#C3392B';
const WIN_HIGH = '#1F7A5C';

// 四角印刷角线、竖排侧栏、朱印的尺寸与位置常量
const MARGIN = 54;
const CORNER = 46;
const SEAL_R = 74;
const SEAL_CX = 1080 - 196 - SEAL_R; // = 810
const SEAL_CY = 106 + SEAL_R; // = 180
const STRIP_X = 1080 - 88; // 竖排侧栏右边界
const STRIP_TOP = 130;
const STRIP_H = 420;

async function drawCorners(ctx: CanvasRenderingContext2D): Promise<void> {
  ctx.save();
  ctx.strokeStyle = 'rgba(195,57,43,0.55)';
  ctx.lineWidth = 3;
  const arm = (x: number, y: number, dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
  };
  // 左上：右 + 下
  arm(MARGIN, MARGIN, CORNER, 0);
  arm(MARGIN, MARGIN, 0, CORNER);
  // 右上：左 + 下
  arm(1080 - MARGIN, MARGIN, -CORNER, 0);
  arm(1080 - MARGIN, MARGIN, 0, CORNER);
  // 左下：右 + 上
  arm(MARGIN, 1440 - MARGIN, CORNER, 0);
  arm(MARGIN, 1440 - MARGIN, 0, -CORNER);
  // 右下：左 + 上
  arm(1080 - MARGIN, 1440 - MARGIN, -CORNER, 0);
  arm(1080 - MARGIN, 1440 - MARGIN, 0, -CORNER);
  ctx.restore();
}

async function drawSideStrip(ctx: CanvasRenderingContext2D): Promise<void> {
  const text = '无言应援 · 信号站';
  const chars = Array.from(text);
  const font = `400 30px ${FAMILY_WENKAI}`;
  ctx.font = font;
  await document.fonts.load(font, text);
  ctx.save();
  // 右侧竖排朱印细线
  ctx.strokeStyle = 'rgba(195,57,43,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(STRIP_X, STRIP_TOP);
  ctx.lineTo(STRIP_X, STRIP_TOP + STRIP_H);
  ctx.stroke();
  // 竖排文字：自上而下逐字排（writing-mode: vertical-rl 语义）
  ctx.fillStyle = 'rgba(58,43,36,0.62)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = STRIP_X - 22;
  const step = 46;
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cx, STRIP_TOP + 24 + i * step);
  });
  ctx.restore();
}

async function drawSeal(ctx: CanvasRenderingContext2D): Promise<void> {
  ctx.save();
  ctx.translate(SEAL_CX, SEAL_CY);
  ctx.rotate((-6 * Math.PI) / 180);
  // 圆印主体
  ctx.beginPath();
  ctx.arc(0, 0, SEAL_R, 0, Math.PI * 2);
  ctx.fillStyle = VERMILLION;
  ctx.shadowColor = 'rgba(140,26,18,0.28)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  // 内圈描边（仿篆刻留白）
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(245,237,220,0.95)';
  ctx.beginPath();
  ctx.arc(0, 0, SEAL_R - 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(140,26,18,0.5)';
  ctx.beginPath();
  ctx.arc(0, 0, SEAL_R - 22, 0, Math.PI * 2);
  ctx.stroke();
  // 字
  const sealFont = `400 80px ${FAMILY_TITLE}`;
  ctx.font = sealFont;
  await document.fonts.load(sealFont, '胜');
  ctx.fillStyle = '#F8EFDC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('胜', 0, 4);
  ctx.restore();
}

async function drawStats(ctx: TemplateContext, y: number): Promise<void> {
  const { ctx: context, input } = ctx;
  const left = 92;
  const right = 988;

  // 顶部虚线收拢
  context.save();
  context.strokeStyle = 'rgba(58,43,36,0.4)';
  context.lineWidth = 1;
  context.setLineDash([8, 8]);
  context.beginPath();
  context.moveTo(left, y - 72);
  context.lineTo(right, y - 72);
  context.stroke();
  context.restore();

  const visible = input.showRefs === false ? [] : selectVisibleRefs(input.refs, ctx.rng, CARD_STAT_COUNT);
  if (!visible.length) {
    // 无数据：三色装饰条
    const colors = [VERMILLION, INK, WIN_HIGH];
    const widths = [150, 76, 30];
    let x = left;
    for (const [i, w] of widths.entries()) {
      context.fillStyle = colors[i] ?? INK;
      context.globalAlpha = 0.9;
      context.fillRect(x, y - 18, w, 16);
      x += w + 26;
    }
    context.globalAlpha = 1;
    return;
  }

  // 列距 306，带名次后缀的值（如 90(2nd)）等宽字下偏宽，上限 64px 并按 250px 列宽统一缩放
  const VALUE_MAX_SIZE = 64;
  const VALUE_MAX_WIDTH = 250;
  const valueFont = (size: number) => `700 ${size}px ${FAMILY_MONO}`;
  const plain = visible.filter((ref) => !ref.hero);
  await Promise.all(plain.map((ref) => document.fonts.load(valueFont(VALUE_MAX_SIZE), ref.value)));
  let valueSize = VALUE_MAX_SIZE;
  for (const ref of plain) {
    context.font = valueFont(VALUE_MAX_SIZE);
    const width = context.measureText(ref.value).width;
    if (width > VALUE_MAX_WIDTH) {
      valueSize = Math.min(valueSize, Math.floor((VALUE_MAX_SIZE * VALUE_MAX_WIDTH) / width));
    }
  }

  for (const [i, ref] of visible.entries()) {
    const x = left + i * 306;
    await drawText(
      context,
      ref.hero ? heroEyebrowOf(ref) : ref.label,
      x,
      y - 46,
      `500 23px ${FAMILY_SUBTITLE}`,
      'rgba(58,43,36,0.6)'
    );
    if (ref.hero) {
      await drawHeroChips(context, ref.hero, { x, y: y - 14, w: 282, h: 96 }, heroChipStyle());
      continue;
    }
    context.font = valueFont(valueSize);
    await document.fonts.load(context.font, ref.value);
    context.fillStyle = i === 0 ? VERMILLION : INK;
    context.textBaseline = 'alphabetic';
    context.fillText(ref.value, x, y + 24);
  }
}

function heroChipStyle() {
  return {
    nameSize: 32,
    metaSize: 22,
    nameColor: VERMILLION,
    metaColor: INK,
    nameFill: 'rgba(195,57,43,0.12)',
    metaFill: 'rgba(58,43,36,0.05)',
    stroke: 'rgba(58,43,36,0.35)',
    highColor: WIN_HIGH,
    radiusRatio: 0.16,
  };
}

async function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align?: CanvasTextAlign
): Promise<void> {
  if (!text) return;
  ctx.save();
  ctx.font = font;
  await document.fonts.load(font, text);
  ctx.fillStyle = color;
  if (align) ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
  ctx.restore();
}

async function draw(ctx: TemplateContext): Promise<void> {
  const { ctx: context, input } = ctx;

  // 宣纸米底
  context.fillStyle = PAPER;
  context.fillRect(0, 0, 1080, 1440);

  // 四角印刷角线
  await drawCorners(context);

  // 眉头
  await drawText(context, 'VICTORY · KPL WUYAN', 92, 150, `700 25px ${FAMILY_ENGLISH}`, VERMILLION);

  // 圆形朱印
  await drawSeal(context);

  // 右侧竖排侧栏
  await drawSideStrip(context);

  // 主文案：黄油体釉里红 + 墨色错位投影。
  // canvas 没有 text-wrap: balance，末行孤字（如「瘩」独行）单独回收：
  // 逐档收窄 maxWidth 重排，直到末行 ≥2 字或遍历完保留原排。
  const copyTop = 330;
  const captionLimit = 1000;
  const captionGap = 78;
  const caption = await layoutCaption(context, input.emojiCaption, FAMILY_WENKAI, {
    maxWidth: 880,
    maxSize: 48,
    minSize: 30,
    lineHeightRatio: 1.3,
  });
  const FIT_OPTS = {
    maxLines: 5,
    maxSize: 84,
    minSize: 58,
    lineHeightRatio: 1.3,
    weight: 400,
    maxHeight: captionLimit - copyTop - (caption.lines.length ? captionGap + caption.height : 0),
  };
  let fitted = await fitText(context, input.line, FAMILY_TITLE, {
    ...FIT_OPTS,
    maxWidth: 800,
  });
  if (fitted.lines.length > 1 && (fitted.lines.at(-1) ?? '').length === 1) {
    for (const width of [780, 760, 740, 720, 700, 680]) {
      const retry = await fitText(context, input.line, FAMILY_TITLE, { ...FIT_OPTS, maxWidth: width });
      if ((retry.lines.at(-1) ?? '').length > 1) {
        fitted = retry;
        break;
      }
    }
  }
  context.font = fitted.font;
  await document.fonts.load(fitted.font, input.line);
  fitted.lines.forEach((row, index) => {
    const baseline = copyTop + index * fitted.lineHeight;
    context.fillStyle = 'rgba(58,43,36,0.16)';
    context.fillText(row, 90 + 5, baseline + 5);
    context.fillStyle = VERMILLION;
    context.fillText(row, 90, baseline);
  });

  // 心情标语：霞鹜文楷 + 朱印色条（长句折行，色条压在第一行上方）
  const copyBottom = copyTop + (fitted.lines.length - 1) * fitted.lineHeight;
  const captionTop = copyBottom + captionGap;
  if (caption.lines.length) {
    context.fillStyle = VERMILLION;
    roundRectPath(context, 92, captionTop - 20, 52, 10, 5);
    context.fill();
    context.save();
    context.font = caption.font;
    await document.fonts.load(caption.font, caption.lines.join(''));
    context.fillStyle = INK;
    context.textBaseline = 'top';
    caption.lines.forEach((row, index) => context.fillText(row, 92, captionTop + index * caption.lineHeight));
    context.restore();
  }

  // 数据区
  await drawStats(ctx, 1096);

  // QR + 页脚
  if (input.showQr !== false) {
    const qr = await buildQrImage('#3A2B24FF', '#FFFFFFFF');
    const qrSize = 150;
    const qrX = 1080 - 92 - qrSize; // 838
    const qrY = 1210;
    drawQrFramed(context, qr, {
      x: qrX,
      y: qrY,
      size: qrSize,
      frameFill: '#FFFFFF',
      radius: 10,
      shadow: true,
    });
    await drawText(
      context,
      '扫码接收胜利信号',
      qrX + qrSize / 2,
      qrY - 16,
      `500 22px ${FAMILY_BODY}`,
      'rgba(58,43,36,0.75)',
      'center'
    );
  }

  const today = formatDate(new Date());
  await drawRuns(
    context,
    [
      { text: today, font: `500 24px ${FAMILY_MONO}`, color: 'rgba(58,43,36,0.65)' },
      { text: ' · KPL无言应援信号站', font: `500 24px ${FAMILY_BODY}`, color: 'rgba(58,43,36,0.65)' },
    ],
    92,
    1352
  );
}

export const vermillionTemplate: CardTemplate = {
  id: 'vermillion',
  name: '釉里红',
  draw,
};
