import type { CardTemplate, TemplateContext } from '../types';
import { heroEyebrowOf, selectVisibleRefs } from '../selection';
import {
  FAMILY_MONO,
  FAMILY_WENKAI,
  buildQrImage,
  dayOfYear,
  drawBlobs,
  drawGrain,
  drawHeroChips,
  drawQrFramed,
  drawText,
  fitText,
  formatDate,
  formatWeekday,
  layoutCaption,
  roundRectPath,
} from '../shared';

/* 札记 · 国风视觉版（journal）：宣纸白底 + 传统色 + 回纹带 / 朱丝栏竖排 /
 * 云纹分隔 / 窗棂格底纹 / 远山留白 / 朱砂方章 / 梅枝线稿。
 * 色值取自 chinese-style-visual-system 令牌；对比度硬规则：
 * 竹青 #6E7F63 对宣纸白仅 3.7:1，只用于装饰线，绝不进正文。 */

const PAPER = '#F3EFE6'; // 宣纸白 · 底
const RAISED = '#FBF8F1'; // 抬升面 · 卡内
const INK = '#23201C'; // 墨黑 · 正文标题 13.7:1
const INK_SOFT = '#5A544C'; // 淡墨 · 次级 6.4:1
const INK_FAINT = '#8A8275'; // 更淡墨 · 注释
const CINNABAR = '#9E3B2E'; // 朱砂 · 印章强调 6.6:1
const DAIQING = '#3D5A56'; // 黛青 · 远山
const ZHESHI = '#8A5A3B'; // 赭石 · 回纹 5.2:1
const ZHUQING = '#6E7F63'; // 竹青 · 仅装饰线
const LINE = '#C9C1B2';
const LINE_SOFT = '#DED7C8';

const TITLES = ['春深不见底', '稳字当头', '今日仍有光', '一局一春天', '慢慢也算数', '无声处有雷'];
const MARKS = ['无言应援', '对抗路一阵', 'KPL'];
const VERTICAL_TEXT = '于无声处听惊雷';

const CARD = { x: 120, y: 236, w: 800, h: 864 };
const STRIP_X = 1000;
const PAD = 48;
const CN_DIGITS = '〇一二三四五六七八九';

/** 阿拉伯数字 → 中文数字（「第二百九十三则」这类国风题识） */
function cnNumber(value: number): string {
  if (value < 10) return CN_DIGITS[value] ?? '〇';
  if (value < 20) return `十${value % 10 ? CN_DIGITS[value % 10] : ''}`;
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    return `${CN_DIGITS[tens]}十${ones ? CN_DIGITS[ones] : ''}`;
  }
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (rest === 0) return `${CN_DIGITS[hundreds]}百`;
  return `${CN_DIGITS[hundreds]}百${rest < 10 ? `零${CN_DIGITS[rest]}` : cnNumber(rest)}`;
}

/** 回纹带：页眉下缘 / 页脚上缘各一条，方折螺旋通栏 + 基线 */
function drawFretBand(
  ctx: TemplateContext['ctx'],
  x: number,
  y: number,
  width: number,
  color: string,
  alpha: number
): void {
  const s = 2.2;
  const count = Math.max(2, Math.round(width / (20 * s)));
  const step = width / count;
  const unit = step / (20 * s);
  const at = (offset: number) => x + offset * s * unit;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(x, y + 12 * s);
  ctx.lineTo(x + width, y + 12 * s);
  ctx.stroke();
  for (let i = 0; i < count; i++) {
    const base = i * 20;
    ctx.beginPath();
    ctx.moveTo(at(base + 2), y + 12 * s);
    ctx.lineTo(at(base + 2), y + 2 * s);
    ctx.lineTo(at(base + 12), y + 2 * s);
    ctx.lineTo(at(base + 12), y + 9 * s);
    ctx.lineTo(at(base + 6), y + 9 * s);
    ctx.lineTo(at(base + 6), y + 6 * s);
    ctx.lineTo(at(base + 9), y + 6 * s);
    ctx.stroke();
  }
  ctx.restore();
}

/** 云纹分隔：中央如意云头 + 两侧延伸细线 */
function drawCloudDivider(ctx: TemplateContext['ctx'], cx: number, cy: number, halfWidth: number): void {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.4;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(cx - halfWidth, cy);
  ctx.lineTo(cx - 74, cy);
  ctx.moveTo(cx + 74, cy);
  ctx.lineTo(cx + halfWidth, cy);
  ctx.stroke();
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx - 74, cy);
  ctx.bezierCurveTo(cx - 52, cy - 22, cx - 22, cy - 20, cx, cy - 4);
  ctx.bezierCurveTo(cx + 22, cy - 20, cx + 52, cy - 22, cx + 74, cy);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy + 9);
  ctx.bezierCurveTo(cx - 12, cy - 4, cx + 6, cy - 6, cx + 10, cy + 6);
  ctx.bezierCurveTo(cx + 12, cy + 13, cx + 3, cy + 16, cx - 2, cy + 12);
  ctx.stroke();
  ctx.restore();
}

/** 窗棂格底纹（纯线稿，全卡仅卡片左侧留白带一处） */
function drawLattice(
  ctx: TemplateContext['ctx'],
  x: number,
  y: number,
  w: number,
  h: number,
  alpha: number
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  const step = 46;
  ctx.beginPath();
  for (let px = x; px <= x + w; px += step) {
    ctx.moveTo(px, y);
    ctx.lineTo(px, y + h);
  }
  for (let py = y; py <= y + h; py += step) {
    ctx.moveTo(x, py);
    ctx.lineTo(x + w, py);
  }
  ctx.stroke();
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

/** 远山：一层山脊折线（山脚留纸白，不闭合） */
function drawRidge(
  ctx: TemplateContext['ctx'],
  rng: TemplateContext['rng'],
  x: number,
  baseY: number,
  w: number,
  height: number,
  alpha: number
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = DAIQING;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const peaks = rng.int(3, 4);
  const seg = w / peaks;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  for (let i = 0; i < peaks; i++) {
    const px = x + i * seg;
    ctx.lineTo(px + seg * rng.range(0.34, 0.5), baseY - height * rng.range(0.1, 0.28));
    ctx.lineTo(px + seg * rng.range(0.56, 0.68), baseY - height * rng.range(0.62, 1));
    ctx.lineTo(px + seg * rng.range(0.76, 0.9), baseY - height * rng.range(0.16, 0.42));
  }
  ctx.lineTo(x + w, baseY);
  ctx.stroke();
  ctx.restore();
}

/** 五瓣梅线稿 */
function blossom(ctx: TemplateContext['ctx'], cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    ctx.moveTo(cx + Math.cos(angle) * r * 0.5, cy + Math.sin(angle) * r * 0.5);
    ctx.arc(cx + Math.cos(angle) * r * 0.8, cy + Math.sin(angle) * r * 0.8, r * 0.46, 0, Math.PI * 2);
  }
  ctx.stroke();
}

/** 梅枝：主枝 + 侧枝 + 三朵梅，纯线稿 */
function drawPlumBranch(ctx: TemplateContext['ctx'], x: number, y: number, scale: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.3);
  ctx.scale(scale, scale);
  ctx.strokeStyle = ZHESHI;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(40, -26, 80, -34, 128, -62);
  ctx.moveTo(58, -36);
  ctx.bezierCurveTo(70, -56, 88, -66, 104, -70);
  ctx.moveTo(96, -50);
  ctx.bezierCurveTo(100, -68, 106, -80, 116, -88);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  blossom(ctx, 128, -62, 9);
  blossom(ctx, 104, -70, 7.5);
  blossom(ctx, 116, -88, 6.5);
  ctx.restore();
}

/** 朱砂方章：双描边刻印 + 竖排白字 */
async function drawSeal(
  ctx: TemplateContext['ctx'],
  cx: number,
  cy: number,
  size: number,
  text: string
): Promise<void> {
  const chars = Array.from(text);
  const step = (size - 20) / chars.length;
  const fontSize = Math.min(26, step * 0.94);
  const font = `400 ${fontSize}px ${FAMILY_WENKAI}`;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.globalAlpha = 0.92;
  roundRectPath(ctx, -size / 2, -size / 2, size, size, 4);
  ctx.fillStyle = CINNABAR;
  ctx.fill();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1.6;
  roundRectPath(ctx, -size / 2 + 7, -size / 2 + 7, size - 14, size - 14, 2);
  ctx.stroke();
  ctx.font = font;
  await document.fonts.load(font, text);
  ctx.fillStyle = PAPER;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  chars.forEach((char, i) => {
    ctx.fillText(char, 0, -size / 2 + 10 + step * (i + 0.5));
  });
  ctx.restore();
}

async function draw(ctx: TemplateContext): Promise<void> {
  const { ctx: context, rng, input, dateLabel } = ctx;
  const issue = dayOfYear(dateLabel);
  const weekday = formatWeekday(new Date(`${dateLabel}T12:00:00+08:00`));

  /* ---------- 宣纸底 + 黛青/赭石水墨晕染 + 颗粒 + 暗角 ---------- */
  context.fillStyle = PAPER;
  context.fillRect(0, 0, 1080, 1440);
  drawBlobs(context, rng, {
    colors: [DAIQING, ZHESHI, DAIQING, ZHESHI],
    count: [3, 4],
    alpha: [0.08, 0.12],
    radius: [300, 520],
    padding: 120,
  });
  drawGrain(context, rng, { density: 760, alpha: 0.03, colors: ['#6b6252'] });
  const vignette = context.createRadialGradient(540, 700, 500, 540, 700, 940);
  vignette.addColorStop(0, 'rgba(70,60,40,0)');
  vignette.addColorStop(1, 'rgba(70,60,40,0.06)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, 1080, 1440);

  // 窗棂格底纹（左侧留白带，全卡仅此一处）+ 右上梅枝
  drawLattice(context, 46, 262, 58, 816, 0.45);
  drawPlumBranch(context, 612, 150, 0.72);

  /* ---------- 页眉：小方印 + 刊头大字 + 题识 + 回纹带 ---------- */
  await drawSeal(context, 144, 92, 50, '无言');
  await drawText(context, '今日札记', 186, 106, `500 42px ${FAMILY_WENKAI}`, INK);
  await drawText(
    context,
    `NO.${issue} · ${dateLabel.replaceAll('-', '.')} · ${weekday}`,
    186,
    142,
    `500 20px ${FAMILY_MONO}`,
    INK_FAINT
  );
  await drawText(
    context,
    `第${cnNumber(issue)}则`,
    960,
    106,
    `400 26px ${FAMILY_WENKAI}`,
    INK_SOFT,
    'right'
  );
  drawFretBand(context, 80, 168, 920, ZHESHI, 0.55);

  /* ---------- 朱丝栏 + 竖排题字 ---------- */
  context.save();
  context.globalAlpha = 0.32;
  context.strokeStyle = CINNABAR;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(952, 300);
  context.lineTo(952, 764);
  context.moveTo(1048, 300);
  context.lineTo(1048, 764);
  context.stroke();
  context.restore();
  context.save();
  context.translate(1000, 336);
  context.rotate(Math.PI / 4);
  context.fillStyle = CINNABAR;
  context.fillRect(-4.5, -4.5, 9, 9);
  context.restore();
  for (const [i, char] of Array.from(VERTICAL_TEXT).entries()) {
    await drawText(context, char, STRIP_X, 508 + i * 46, `400 34px ${FAMILY_WENKAI}`, INK_SOFT, 'center');
  }

  /* ---------- 宣纸抬升卡 + 双线框 ---------- */
  context.save();
  context.shadowColor = 'rgba(60,50,34,0.12)';
  context.shadowBlur = 24;
  context.shadowOffsetY = 8;
  roundRectPath(context, CARD.x, CARD.y, CARD.w, CARD.h, 8);
  context.fillStyle = RAISED;
  context.fill();
  context.restore();
  context.save();
  context.strokeStyle = ZHESHI;
  context.globalAlpha = 0.55;
  context.lineWidth = 1;
  roundRectPath(context, CARD.x, CARD.y, CARD.w, CARD.h, 8);
  context.stroke();
  context.globalAlpha = 1;
  context.strokeStyle = LINE;
  roundRectPath(context, CARD.x + 11, CARD.y + 11, CARD.w - 22, CARD.h - 22, 5);
  context.stroke();
  context.restore();

  const textX = CARD.x + PAD;
  const textRight = CARD.x + CARD.w - PAD;

  // 眉题
  await drawText(context, '手录 · 无言应援札记', textX, CARD.y + 60, `400 26px ${FAMILY_WENKAI}`, INK_SOFT);
  await drawText(context, '春日特辑', textRight, CARD.y + 60, `400 24px ${FAMILY_WENKAI}`, INK_FAINT, 'right');
  context.save();
  context.strokeStyle = LINE;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(textX, CARD.y + 84);
  context.lineTo(textRight, CARD.y + 84);
  context.stroke();
  context.restore();

  // 标题 + 朱砂/竹青短线（国风「句读」；竹青仅作装饰线，不写正文）
  const title = rng.pick(TITLES);
  await drawText(context, title, textX, CARD.y + 152, `500 56px ${FAMILY_WENKAI}`, INK);
  context.save();
  context.fillStyle = CINNABAR;
  context.fillRect(textX, CARD.y + 170, 104, 4);
  context.fillStyle = ZHUQING;
  context.fillRect(textX + 112, CARD.y + 170, 32, 4);
  context.restore();

  /* ---------- 正文 + 引用块 + 题识 + 方章 ---------- */
  const copyTop = CARD.y + 248;
  const captionGap = 52;
  const markGap = 34;
  const markHeight = 40;
  const cardBottomPad = 30;
  const markBottomLimit = CARD.y + CARD.h - cardBottomPad;
  const markTopLimit = markBottomLimit - markHeight;
  const caption = await layoutCaption(context, input.emojiCaption, FAMILY_WENKAI, {
    maxWidth: 600,
    maxSize: 34,
    minSize: 26,
    lineHeightRatio: 1.4,
  });
  const captionZone = caption.lines.length ? caption.height + 36 : 0;
  const copyMaxHeight = markTopLimit - markGap - captionZone - captionGap - copyTop;
  const fitted = await fitText(context, input.line, FAMILY_WENKAI, {
    maxWidth: 640,
    maxLines: 6,
    maxSize: 50,
    minSize: 40,
    lineHeightRatio: 1.52,
    maxHeight: copyMaxHeight,
  });
  context.font = fitted.font;
  context.fillStyle = INK;
  fitted.lines.forEach((row, index) => context.fillText(row, textX, copyTop + index * fitted.lineHeight));

  // 引用块：朱砂竖条 + 赭石淡底
  const copyBottom = fitted.lines.length ? copyTop + (fitted.lines.length - 1) * fitted.lineHeight : copyTop;
  if (caption.lines.length) {
    const capTop = copyBottom + captionGap;
    const capH = caption.height + 36;
    context.save();
    roundRectPath(context, textX, capTop, caption.width + 60, capH, 6);
    context.fillStyle = 'rgba(138,90,59,0.06)';
    context.fill();
    roundRectPath(context, textX, capTop, 7, capH, 3.5);
    context.fillStyle = CINNABAR;
    context.fill();
    context.font = caption.font;
    context.fillStyle = INK;
    context.textBaseline = 'top';
    caption.lines.forEach((row, index) => context.fillText(row, textX + 32, capTop + 18 + index * caption.lineHeight));
    context.restore();
  }

  // 题识：朱砂细框小签（方角，替代圆角话题 chip）
  const markTop = copyBottom + captionGap + captionZone + markGap;
  if (markTop + markHeight <= markBottomLimit) {
    const markFont = `400 24px ${FAMILY_WENKAI}`;
    context.font = markFont;
    await document.fonts.load(markFont, MARKS.join(''));
    let cursor = textX;
    context.save();
    context.textBaseline = 'middle';
    for (const mark of MARKS) {
      const w = context.measureText(mark).width + 34;
      roundRectPath(context, cursor, markTop, w, markHeight, 4);
      context.fillStyle = 'rgba(158,59,46,0.05)';
      context.fill();
      context.strokeStyle = CINNABAR;
      context.globalAlpha = 0.45;
      context.lineWidth = 1;
      context.stroke();
      context.globalAlpha = 1;
      context.fillStyle = CINNABAR;
      context.textAlign = 'center';
      context.fillText(mark, cursor + w / 2, markTop + markHeight / 2 + 1);
      context.textAlign = 'left';
      cursor += w + 14;
    }
    context.restore();
  }

  // 卡内右下朱砂方章
  await drawSeal(context, CARD.x + CARD.w - 76, CARD.y + CARD.h - 96, 92, '今日札记');

  /* ---------- 笺格数据区（方角双线，不用胶带贴纸） ---------- */
  const slipY = 1114;
  const slipH = 106;
  const visible = input.showRefs !== false ? selectVisibleRefs(input.refs, rng, 2) : [];
  if (visible.length) {
    const slipW = 400;
    const xs = visible.length === 1 ? [340] : [120, 556];
    for (const [i, ref] of visible.entries()) {
      const x = xs[i]!;
      const y = slipY;
      context.save();
      roundRectPath(context, x, y, slipW, slipH, 6);
      context.fillStyle = RAISED;
      context.fill();
      context.strokeStyle = LINE;
      context.lineWidth = 1;
      context.stroke();
      roundRectPath(context, x + 7, y + 7, slipW - 14, slipH - 14, 3);
      context.strokeStyle = LINE_SOFT;
      context.stroke();
      context.restore();
      await drawText(
        context,
        ref.hero ? heroEyebrowOf(ref) : ref.label,
        x + 34,
        y + 44,
        `400 25px ${FAMILY_WENKAI}`,
        INK_SOFT
      );
      if (ref.hero) {
        await drawHeroChips(
          context,
          ref.hero,
          { x: x + 28, y: y + 26, w: slipW - 56, h: 72 },
          {
            nameSize: 30,
            metaSize: 20,
            nameColor: CINNABAR,
            metaColor: INK_SOFT,
            nameFill: 'rgba(158,59,46,0.07)',
            metaFill: 'rgba(61,90,86,0.07)',
            stroke: 'rgba(61,90,86,0.35)',
            highColor: DAIQING,
            nameFamily: FAMILY_WENKAI,
            radiusRatio: 0.12,
          }
        );
      } else {
        await drawText(
          context,
          ref.value,
          x + 34,
          y + 94,
          `700 44px ${FAMILY_MONO}`,
          i === 0 ? CINNABAR : INK
        );
      }
    }
  } else {
    context.save();
    context.globalAlpha = 0.75;
    context.strokeStyle = LINE;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(120, slipY + slipH / 2);
    context.lineTo(960, slipY + slipH / 2);
    context.stroke();
    context.restore();
    await drawText(
      context,
      '· 今日数据休息 ·',
      540,
      slipY + slipH / 2 - 14,
      `400 24px ${FAMILY_WENKAI}`,
      INK_FAINT,
      'center'
    );
  }

  /* ---------- 云纹分隔 + 远山留白 ---------- */
  drawCloudDivider(context, 540, 1252, 290);
  drawRidge(context, rng, 100, 1360, 640, 84, 0.1);
  drawRidge(context, rng, 84, 1360, 672, 62, 0.16);
  drawRidge(context, rng, 132, 1360, 580, 40, 0.14);

  /* ---------- 二维码 ---------- */
  if (input.showQr !== false) {
    const qr = await buildQrImage('#23201CFF', '#FBF8F1FF');
    drawQrFramed(context, qr, {
      x: 836,
      y: 1236,
      size: 124,
      frameFill: RAISED,
      frameStroke: LINE,
      radius: 6,
    });
  }

  /* ---------- 页脚：回纹带 + 居中落款 ---------- */
  drawFretBand(context, 80, 1372, 920, ZHESHI, 0.55);
  const footerRuns = [
    { text: 'KPL无言应援信号站', font: `400 22px ${FAMILY_WENKAI}` },
    { text: ' · 扫码一同应援 · ', font: `400 22px ${FAMILY_WENKAI}` },
    { text: formatDate(new Date()), font: `500 19px ${FAMILY_MONO}` },
  ];
  await Promise.all(footerRuns.map((run) => document.fonts.load(run.font, run.text)));
  let footerWidth = 0;
  for (const run of footerRuns) {
    context.font = run.font;
    footerWidth += context.measureText(run.text).width;
  }
  let cursor = 540 - footerWidth / 2;
  context.save();
  context.fillStyle = INK_FAINT;
  context.textAlign = 'left';
  for (const run of footerRuns) {
    context.font = run.font;
    context.fillText(run.text, cursor, 1424);
    cursor += context.measureText(run.text).width;
  }
  context.restore();
}

export const journalTemplate: CardTemplate = {
  id: 'journal',
  name: '国风札记',
  draw,
};