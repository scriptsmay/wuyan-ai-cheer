import type { CardTemplate, TemplateContext } from '../types';
import { heroEyebrowOf, selectVisibleRefs } from '../selection';
import {
  FAMILY_ENGLISH,
  FAMILY_MONO,
  FAMILY_WENKAI,
  buildQrImage,
  dayOfYear,
  drawBlobs,
  drawGrain,
  drawHeroChips,
  drawHighlighter,
  drawQrFramed,
  drawRays,
  drawRuns,
  drawTape,
  drawText,
  fitText,
  formatDate,
  formatWeekday,
  layoutCaption,
  roundRectPath,
} from '../shared';

/* 小红书札记 · 文艺风（journal）：奶油纸底 + 淡彩晕染 + 樱花花瓣 + 和纸胶带
 * + 便签白卡（抬头/标题/正文/引用块/话题标签）+ 右侧竖排题字 + 手账贴纸数据区。
 * 亮色专属模板：只进 LIGHT_ALTERNATES，暗色外观不会抽到它。 */

const PAPER = '#F6F0E2';
const CARD_PAPER = '#FFFDF6';
const INK = '#3F3931';
const INK_SOFT = '#8A8072';
const ACCENT = '#C05B3F'; // 哑光朱砂
const ACCENT_DEEP = '#A34A31';
const SAGE = '#8B9B7E';
const PETAL_COLORS = ['#E7B9B2', '#DFA6A6', '#EFCFC8', '#E3C1CF'];
const TAPE_COLORS = [
  'rgba(228,196,168,0.55)',
  'rgba(200,214,190,0.55)',
  'rgba(230,186,178,0.5)',
  'rgba(214,205,226,0.5)',
];
const TITLES = ['和无言有关的日常', '被稳到的一天', '春日心动纪要', '今日份小上头', '一点心动记录'];
const TAGS = ['#无言应援', '#KPL', '#春日纪要'];
const VERTICAL_TEXT = '于无声处听惊雷';

/* 版式常量 */
const CARD = { x: 120, y: 296, w: 800, h: 804 };
const STRIP_X = 1000;
const PAD = 48;

/** 花瓣（尖端两端的扁叶形，樱花瓣意象） */
function drawPetal(
  ctx: TemplateContext['ctx'],
  x: number,
  y: number,
  size: number,
  rotation: number,
  color: string,
  alpha: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.95, -size * 0.55, size * 0.95, size * 0.55, 0, size);
  ctx.bezierCurveTo(-size * 0.95, size * 0.55, -size * 0.95, -size * 0.55, 0, -size);
  ctx.fill();
  ctx.restore();
}

/** 四角星芒小涂鸦 */
function drawSparkle(
  ctx: TemplateContext['ctx'],
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();
  ctx.restore();
}

/** 卡片右下角的小芽叶涂鸦 */
function drawSprout(ctx: TemplateContext['ctx'], x: number, y: number): void {
  ctx.save();
  ctx.strokeStyle = SAGE;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - 4, y - 18, x, y - 34);
  ctx.stroke();
  ctx.restore();
  drawPetal(ctx, x - 12, y - 22, 15, -0.7, SAGE, 0.85);
  drawPetal(ctx, x + 12, y - 28, 13, 0.7, SAGE, 0.7);
}

/** 日期串 → 「2026.10.20」 */
function dottedDate(dateLabel: string): string {
  return dateLabel.replaceAll('-', '.');
}

async function draw(ctx: TemplateContext): Promise<void> {
  const { ctx: context, rng, input, dateLabel } = ctx;
  const issue = dayOfYear(dateLabel);
  const weekday = formatWeekday(new Date(`${dateLabel}T12:00:00+08:00`));

  /* ---------- 纸底：奶油纸 + 淡彩水彩晕染 + 颗粒 + 暗角 ---------- */
  context.fillStyle = PAPER;
  context.fillRect(0, 0, 1080, 1440);
  drawBlobs(context, rng, {
    colors: ['#E7B9B2', '#A9B89A', '#B9C6D8'],
    count: [3, 5],
    alpha: [0.05, 0.085],
    radius: [240, 460],
    padding: 140,
  });
  drawGrain(context, rng, { density: 800, alpha: 0.035, colors: ['#8a7a5c'] });
  const vignette = context.createRadialGradient(540, 720, 480, 540, 720, 920);
  vignette.addColorStop(0, 'rgba(96,72,40,0)');
  vignette.addColorStop(1, 'rgba(96,72,40,0.07)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, 1080, 1440);

  /* ---------- 散落花瓣与星芒（只落在纸边留白带，不压卡片文字） ---------- */
  const petalSpots: [number, number][] = [
    [452, 168],
    [588, 108],
    [712, 186],
    [1002, 236],
    [1012, 380],
    [948, 268],
    [64, 428],
    [82, 706],
    [56, 986],
    [978, 812],
    [1012, 906],
    [940, 990],
    [196, 1318],
    [322, 1362],
    [420, 1272],
  ];
  const petalCount = rng.int(7, Math.min(10, petalSpots.length));
  for (let i = 0; i < petalCount; i++) {
    const [px, py] = rng.pick(petalSpots);
    drawPetal(
      context,
      px + rng.range(-8, 8),
      py + rng.range(-8, 8),
      rng.range(9, 18),
      rng.range(0, Math.PI),
      rng.pick(PETAL_COLORS),
      rng.range(0.45, 0.72)
    );
  }
  drawSparkle(context, 88, 286, 7, SAGE, 0.6);
  drawSparkle(context, 1032, 300, 6, ACCENT, 0.55);
  drawSparkle(context, 968, 1410, 6, SAGE, 0.6);

  /* ---------- 页眉：札记徽章 + 编号 / 右侧日期 + 小太阳 ---------- */
  context.save();
  context.translate(178, 112);
  context.rotate(-0.05);
  roundRectPath(context, -59, -29, 118, 58, 16);
  context.fillStyle = ACCENT;
  context.fill();
  context.restore();
  await drawText(context, '札记', 178, 121, `500 30px ${FAMILY_WENKAI}`, '#FFFDF6', 'center');
  await drawText(context, `No.${issue}`, 256, 120, `500 24px ${FAMILY_MONO}`, INK_SOFT);

  await drawText(context, dottedDate(dateLabel), 960, 104, `500 30px ${FAMILY_MONO}`, INK, 'right');
  await drawText(context, weekday, 960, 148, `400 26px ${FAMILY_WENKAI}`, INK_SOFT, 'right');
  context.save();
  context.fillStyle = 'rgba(192,91,63,0.75)';
  context.beginPath();
  context.arc(700, 100, 14, 0, Math.PI * 2);
  context.fill();
  context.restore();
  drawRays(context, 700, 100, 14, 8, 'rgba(192,91,63,0.55)');

  // 页眉分隔线
  context.save();
  context.strokeStyle = 'rgba(63,57,49,0.14)';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(120, 210);
  context.lineTo(960, 210);
  context.stroke();
  context.restore();

  /* ---------- 右侧竖排题字（与卡片纵向居中对齐） ---------- */
  context.save();
  context.strokeStyle = 'rgba(63,57,49,0.28)';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(STRIP_X, 430);
  context.lineTo(STRIP_X, 450);
  context.moveTo(STRIP_X, 836);
  context.lineTo(STRIP_X, 856);
  context.stroke();
  context.restore();
  context.save();
  context.translate(STRIP_X, 464);
  context.rotate(Math.PI / 4);
  context.fillStyle = ACCENT;
  context.fillRect(-4.5, -4.5, 9, 9);
  context.restore();
  for (const [i, char] of Array.from(VERTICAL_TEXT).entries()) {
    await drawText(context, char, STRIP_X, 512 + i * 50, `400 34px ${FAMILY_WENKAI}`, 'rgba(63,57,49,0.75)', 'center');
  }

  /* ---------- 便签白卡 ---------- */
  context.save();
  context.shadowColor = 'rgba(70,52,30,0.13)';
  context.shadowBlur = 28;
  context.shadowOffsetY = 10;
  roundRectPath(context, CARD.x, CARD.y, CARD.w, CARD.h, 20);
  context.fillStyle = CARD_PAPER;
  context.fill();
  context.restore();
  context.save();
  roundRectPath(context, CARD.x + 16, CARD.y + 16, CARD.w - 32, CARD.h - 32, 14);
  context.strokeStyle = 'rgba(192,91,63,0.22)';
  context.lineWidth = 1;
  context.stroke();
  context.restore();

  // 抬头行：英文刊头 + 右侧特辑名
  const textX = CARD.x + PAD;
  const textRight = CARD.x + CARD.w - PAD;
  await drawText(context, 'WUYAN CHEER NOTE', textX, CARD.y + 60, `600 22px ${FAMILY_ENGLISH}`, INK_SOFT);
  await drawText(context, '· 春日特辑 ·', textRight, CARD.y + 60, `400 24px ${FAMILY_WENKAI}`, SAGE, 'right');
  context.save();
  context.strokeStyle = 'rgba(63,57,49,0.14)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(textX, CARD.y + 84);
  context.lineTo(textRight, CARD.y + 84);
  context.stroke();
  context.fillStyle = ACCENT;
  context.fillRect(textX, CARD.y + 82.5, 44, 3);
  context.restore();

  // 标题（文艺池随机）+ 荧光笔垫
  const title = rng.pick(TITLES);
  const titleFont = `500 50px ${FAMILY_WENKAI}`;
  context.font = titleFont;
  await document.fonts.load(titleFont, title);
  const titleWidth = context.measureText(title).width;
  drawHighlighter(context, rng, textX - 10, CARD.y + 156 - 46, titleWidth + 30, 58, 'rgba(229,183,177,0.5)');
  await drawText(context, title, textX, CARD.y + 156, titleFont, INK);
  drawSparkle(context, 812, CARD.y + 128, 8, SAGE, 0.65);
  drawSparkle(context, 846, CARD.y + 174, 6, ACCENT, 0.55);

  /* ---------- 正文 + 引用块标语 + 话题标签（高度自上而下反推，保证不溢卡） ---------- */
  const copyTop = CARD.y + 244;
  const captionGap = 52;
  const tagGap = 36;
  const tagHeight = 44;
  const cardBottomPad = 28;
  const tagTopLimit = CARD.y + CARD.h - cardBottomPad - tagHeight;
  const caption = await layoutCaption(context, input.emojiCaption, FAMILY_WENKAI, {
    maxWidth: 600,
    maxSize: 34,
    minSize: 26,
    lineHeightRatio: 1.35,
  });
  const captionZone = caption.lines.length ? caption.height + 36 : 0;
  const copyMaxHeight = tagTopLimit - tagGap - captionZone - captionGap - copyTop;
  const fitted = await fitText(context, input.line, FAMILY_WENKAI, {
    maxWidth: 640,
    maxLines: 6,
    maxSize: 52,
    minSize: 40,
    lineHeightRatio: 1.42,
    maxHeight: copyMaxHeight,
  });
  context.font = fitted.font;
  context.fillStyle = INK;
  fitted.lines.forEach((row, index) => context.fillText(row, textX, copyTop + index * fitted.lineHeight));

  // 引用块：左侧朱砂竖条 + 淡彩底
  const copyBottom = fitted.lines.length ? copyTop + (fitted.lines.length - 1) * fitted.lineHeight : copyTop;
  if (caption.lines.length) {
    const capTop = copyBottom + captionGap;
    const capH = caption.height + 36;
    context.save();
    roundRectPath(context, textX, capTop, caption.width + 60, capH, 12);
    context.fillStyle = 'rgba(192,91,63,0.06)';
    context.fill();
    roundRectPath(context, textX, capTop, 7, capH, 3.5);
    context.fillStyle = ACCENT;
    context.fill();
    context.font = caption.font;
    context.fillStyle = INK;
    context.textBaseline = 'top';
    caption.lines.forEach((row, index) => context.fillText(row, textX + 32, capTop + 18 + index * caption.lineHeight));
    context.restore();
  }

  // 话题标签（小红书签名式 chip 行）
  const tagTop = copyBottom + captionGap + captionZone + tagGap;
  if (tagTop + tagHeight <= CARD.y + CARD.h - cardBottomPad) {
    const tagFont = `400 24px ${FAMILY_WENKAI}`;
    context.font = tagFont;
    await document.fonts.load(tagFont, TAGS.join(''));
    let cursor = textX;
    context.save();
    context.textBaseline = 'middle';
    for (const tag of TAGS) {
      const w = context.measureText(tag).width + 42;
      roundRectPath(context, cursor, tagTop, w, tagHeight, 22);
      context.fillStyle = 'rgba(192,91,63,0.10)';
      context.fill();
      context.font = tagFont;
      context.fillStyle = ACCENT_DEEP;
      context.textAlign = 'center';
      context.fillText(tag, cursor + w / 2, tagTop + tagHeight / 2 + 1);
      context.textAlign = 'left';
      cursor += w + 16;
    }
    context.restore();
  }

  // 卡片右下角小芽
  drawSprout(context, CARD.x + CARD.w - 54, CARD.y + CARD.h - 48);

  // 卡内小落款（编辑细节，填补底部空带）
  await drawText(
    context,
    `NO.${issue} · ${dottedDate(dateLabel)}`,
    textX,
    CARD.y + CARD.h - 20,
    `500 18px ${FAMILY_MONO}`,
    'rgba(63,57,49,0.4)'
  );

  /* ---------- 手账贴纸：赛季数据 ---------- */
  const stickerY = 1124;
  const stickerH = 118;
  const visible = input.showRefs !== false ? selectVisibleRefs(input.refs, rng, 2) : [];
  if (visible.length) {
    const stickerW = 400;
    const xs = visible.length === 1 ? [340] : [120, 556];
    for (const [i, ref] of visible.entries()) {
      const cx = xs[i]! + stickerW / 2;
      const cy = stickerY + stickerH / 2;
      context.save();
      context.translate(cx, cy);
      context.rotate(rng.range(-0.02, 0.02));
      roundRectPath(context, -stickerW / 2, -stickerH / 2, stickerW, stickerH, 18);
      context.fillStyle = 'rgba(255,253,246,0.94)';
      context.fill();
      context.save();
      context.setLineDash([7, 6]);
      context.strokeStyle = 'rgba(192,91,63,0.5)';
      context.lineWidth = 1.5;
      context.stroke();
      context.restore();
      drawTape(context, rng, 0, -stickerH / 2 - 4, 96, 26, rng.pick(TAPE_COLORS), rng.range(-0.12, 0.12));
      await drawText(
        context,
        ref.hero ? heroEyebrowOf(ref) : ref.label,
        -stickerW / 2 + 34,
        -stickerH / 2 + 46,
        `400 26px ${FAMILY_WENKAI}`,
        INK_SOFT
      );
      if (ref.hero) {
        await drawHeroChips(
          context,
          ref.hero,
          { x: -stickerW / 2 + 28, y: -stickerH / 2 + 28, w: stickerW - 56, h: 76 },
          {
            nameSize: 30,
            metaSize: 20,
            nameColor: ACCENT,
            metaColor: INK_SOFT,
            nameFill: 'rgba(192,91,63,0.10)',
            metaFill: 'rgba(63,57,49,0.06)',
            stroke: 'rgba(192,91,63,0.35)',
            highColor: '#3E7A5E',
            nameFamily: FAMILY_WENKAI,
            radiusRatio: 0.3,
          }
        );
      } else {
        await drawText(
          context,
          ref.value,
          -stickerW / 2 + 34,
          -stickerH / 2 + 102,
          `700 46px ${FAMILY_MONO}`,
          i === 0 ? ACCENT : INK
        );
      }
      context.restore();
    }
  } else {
    // 无数据：虚线分隔 + 小字
    context.save();
    context.strokeStyle = 'rgba(63,57,49,0.3)';
    context.lineWidth = 1.5;
    context.setLineDash([7, 7]);
    context.beginPath();
    context.moveTo(120, 1180);
    context.lineTo(960, 1180);
    context.stroke();
    context.restore();
    await drawText(context, '· 今日数据休息 ·', 540, 1170, `400 22px ${FAMILY_WENKAI}`, INK_SOFT, 'center');
  }

  /* ---------- 二维码：白卡 + 顶部胶带 ---------- */
  if (input.showQr !== false) {
    const qr = await buildQrImage('#3F3931FF', '#FFFDF7FF');
    drawQrFramed(context, qr, {
      x: 856,
      y: 1262,
      size: 128,
      frameFill: CARD_PAPER,
      frameStroke: 'rgba(63,57,49,0.28)',
      radius: 14,
    });
    drawTape(context, rng, 920, 1256, 104, 30, rng.pick(TAPE_COLORS), rng.range(-0.08, 0.08));
    await drawText(context, '扫码 · 一起打卡', 920, 1408, `400 22px ${FAMILY_WENKAI}`, INK_SOFT, 'center');
  }

  /* ---------- 页脚 ---------- */
  const today = formatDate(new Date());
  await drawRuns(
    context,
    [
      { text: 'KPL无言应援信号站', font: `400 24px ${FAMILY_WENKAI}`, color: INK_SOFT },
      { text: ` · ${today}`, font: `500 20px ${FAMILY_MONO}`, color: 'rgba(63,57,49,0.45)' },
    ],
    120,
    1416
  );
}

export const journalTemplate: CardTemplate = {
  id: 'journal',
  name: '文艺札记',
  draw,
};
