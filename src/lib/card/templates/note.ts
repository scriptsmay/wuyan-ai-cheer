import type { CardTemplate, TemplateContext } from '../types';
import {
  FAMILY_TITLE,
  FAMILY_WENKAI,
  buildQrImage,
  dayOfYear,
  drawGrain,
  drawHighlighter,
  drawQrFramed,
  drawRuns,
  drawTape,
  drawText,
  drawWobblyEllipse,
  fitText,
  formatDate,
  formatWeekday,
} from '../shared';

/* 打卡日签 · 手写便签风：奶油纸底 + 霞鹜文楷 + 和纸胶带 + 红笔手绘圈注 */

const PAPERS = ['#FAF3E3', '#FBF6EB', '#F8EFE0', '#FDF7EC'];
const TAPE_COLORS = [
  'rgba(255,209,102,0.85)',
  'rgba(244,162,186,0.8)',
  'rgba(126,201,229,0.75)',
  'rgba(178,219,151,0.8)',
];
const MARKERS = ['rgba(255,214,90,0.5)', 'rgba(122,194,255,0.38)', 'rgba(140,214,160,0.42)', 'rgba(255,150,170,0.42)'];
const INK = '#3B3A36';
const INK_SOFT = '#8A857B';
const RED_PEN = '#E15B4E';

function drawStarDoodle(ctx: TemplateContext['ctx'], x: number, y: number, r: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outer = (Math.PI / 2) * -1 + (i * 2 * Math.PI) / 5;
    const inner = outer + Math.PI / 5;
    const ox = x + Math.cos(outer) * r;
    const oy = y + Math.sin(outer) * r;
    const ix = x + Math.cos(inner) * r * 0.45;
    const iy = y + Math.sin(inner) * r * 0.45;
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHeartDoodle(ctx: TemplateContext['ctx'], x: number, y: number, r: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.85);
  ctx.bezierCurveTo(x - r * 1.35, y - r * 0.1, x - r * 0.55, y - r * 1.15, x, y - r * 0.35);
  ctx.bezierCurveTo(x + r * 0.55, y - r * 1.15, x + r * 1.35, y - r * 0.1, x, y + r * 0.85);
  ctx.stroke();
  ctx.restore();
}

async function draw(ctx: TemplateContext): Promise<void> {
  const { ctx: context, rng, input, dateLabel } = ctx;
  const checkin = input.checkin;

  // 纸底 + 点阵格 + 颗粒
  context.fillStyle = rng.pick(PAPERS);
  context.fillRect(0, 0, 1080, 1440);
  context.save();
  context.fillStyle = 'rgba(96,84,60,0.12)';
  for (let gy = 46; gy < 1440; gy += 46) {
    for (let gx = 46; gx < 1080; gx += 46) {
      context.beginPath();
      context.arc(gx, gy, 1.6, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
  drawGrain(context, rng, { density: 1400, alpha: 0.045, colors: ['#8a7a5c', '#b5a487'] });

  // 顶部和纸胶带（日期写在胶带上，同角度旋转）
  const tapeRotation = rng.range(-0.06, 0.06);
  drawTape(context, rng, 250, 128, 320, 58, rng.pick(TAPE_COLORS), tapeRotation);
  const tapeFont = `500 25px "JetBrains Mono", "Noto Sans SC", monospace`;
  context.save();
  context.translate(250, 128);
  context.rotate(tapeRotation);
  context.font = tapeFont;
  await document.fonts.load(tapeFont, dateLabel);
  context.fillStyle = 'rgba(60,50,35,0.85)';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`${dateLabel} · ${formatWeekday(new Date())}`, 0, 1);
  context.restore();

  // 右上角手绘贴纸（星星 / 爱心 / 笑脸随机）
  const sticker = rng.int(0, 2);
  if (sticker === 0) drawStarDoodle(context, 940, 132, 40, RED_PEN);
  else if (sticker === 1) drawHeartDoodle(context, 940, 128, 34, RED_PEN);
  else {
    context.save();
    context.strokeStyle = RED_PEN;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(940, 132, 36, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = RED_PEN;
    context.beginPath();
    context.arc(926, 122, 4.5, 0, Math.PI * 2);
    context.arc(954, 122, 4.5, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(940, 130, 20, 0.25 * Math.PI, 0.75 * Math.PI);
    context.stroke();
    context.restore();
  }

  // 标题 + 红笔波浪线
  await drawText(context, '今天也要加油呀', 100, 262, `400 54px ${FAMILY_WENKAI}`, INK);
  context.save();
  context.strokeStyle = RED_PEN;
  context.lineWidth = 4;
  context.lineCap = 'round';
  context.beginPath();
  const ux = 102;
  const uy = 288;
  for (let i = 0; i <= 40; i++) {
    const px = ux + (i / 40) * 330;
    const py = uy + Math.sin(i * 0.8) * 4;
    if (i === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.stroke();
  context.restore();

  // 连续天数：红笔手绘圈注（无打卡数据时跳过）
  if (checkin) {
    const cx = 872;
    const cy = 424;
    drawWobblyEllipse(context, rng, cx, cy, 168, 108, RED_PEN, 6, 1);
    if (rng.bool(0.6))
      drawWobblyEllipse(
        context,
        rng,
        cx + rng.range(-8, 8),
        cy + rng.range(-6, 6),
        172,
        112,
        'rgba(225,91,78,0.35)',
        3,
        1
      );
    const numFont = `400 118px ${FAMILY_TITLE}`;
    context.font = numFont;
    await document.fonts.load(numFont, String(checkin.streak));
    context.textAlign = 'center';
    context.fillStyle = RED_PEN;
    context.fillText(String(checkin.streak), cx, cy + 34);
    context.textAlign = 'left';
    await drawText(context, '连续打卡', cx, cy + 76, `400 27px ${FAMILY_WENKAI}`, INK_SOFT, 'center');
  }

  // 主文案（霞鹜文楷，自适应字号）
  const fitted = await fitText(context, input.line, FAMILY_WENKAI, {
    maxWidth: 880,
    maxLines: 5,
    maxSize: 80,
    minSize: 54,
    lineHeightRatio: 1.42,
  });
  context.font = fitted.font;
  context.fillStyle = INK;
  const copyTop = 648;
  // 荧光笔垫在第一行底下
  const marker = rng.pick(MARKERS);
  if (fitted.lines.length) {
    const firstWidth = Math.min(context.measureText(fitted.lines[0] ?? '').width, 880);
    drawHighlighter(context, rng, 96, copyTop - fitted.size * 0.86, firstWidth + 24, fitted.size * 1.04, marker);
  }
  fitted.lines.forEach((row, index) => context.fillText(row, 100, copyTop + index * fitted.lineHeight));

  // 心情标语：文楷 + 红笔下划
  const copyBottom = copyTop + (fitted.lines.length - 1) * fitted.lineHeight;
  const captionY = Math.min(copyBottom + 96, 1020);
  if (input.emojiCaption) {
    const captionFont = `400 44px ${FAMILY_WENKAI}`;
    context.font = captionFont;
    await document.fonts.load(captionFont, input.emojiCaption);
    const tw = context.measureText(input.emojiCaption).width;
    context.fillStyle = INK;
    context.fillText(input.emojiCaption, 100, captionY);
    context.save();
    context.strokeStyle = 'rgba(225,91,78,0.7)';
    context.lineWidth = 3.5;
    context.beginPath();
    context.moveTo(100, captionY + 16);
    for (let i = 0; i <= 24; i++) {
      const px = 100 + (i / 24) * Math.min(tw + 20, 720);
      const py = captionY + 16 + Math.sin(i * 0.9) * 3;
      context.lineTo(px, py);
    }
    context.stroke();
    context.restore();
  }

  // 小备忘（赛季数据）：点线引导 + 手写数值
  if (input.showRefs !== false && input.refs.length) {
    const listTop = 1120;
    await drawText(context, '—— 今日小记 ——', 100, listTop - 24, `400 28px ${FAMILY_WENKAI}`, INK_SOFT);
    const visible = input.refs.slice(0, 2);
    for (const [i, ref] of visible.entries()) {
      const rowY = listTop + 46 + i * 78;
      await drawText(context, ref.label, 104, rowY, `400 32px ${FAMILY_WENKAI}`, INK);
      const valueFont = `700 40px "JetBrains Mono", "Noto Sans SC", monospace`;
      context.font = valueFont;
      await document.fonts.load(valueFont, ref.value);
      const vw = context.measureText(ref.value).width;
      context.fillStyle = RED_PEN;
      context.fillText(ref.value, 690 - vw, rowY);
      // 点线引导
      context.save();
      context.strokeStyle = 'rgba(90,80,60,0.4)';
      context.lineWidth = 2;
      context.setLineDash([2, 10]);
      context.beginPath();
      context.moveTo(150, rowY - 6);
      context.lineTo(660 - vw, rowY - 6);
      context.stroke();
      context.restore();
    }
  } else {
    // 无数据时画一条手绘分隔线占位
    context.save();
    context.strokeStyle = 'rgba(90,80,60,0.35)';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(104, 1150);
    context.quadraticCurveTo(540, 1168, 976, 1146);
    context.stroke();
    context.restore();
  }

  // QR：白卡 + 顶部胶带
  if (input.showQr !== false) {
    const qr = await buildQrImage('#3B3A36FF', '#FFFFFFFE');
    drawQrFramed(context, qr, {
      x: 852,
      y: 1226,
      size: 168,
      frameFill: '#FFFFFF',
      frameStroke: 'rgba(90,80,60,0.25)',
      radius: 10,
      shadow: true,
    });
    drawTape(context, rng, 936, 1224, 130, 36, rng.pick(TAPE_COLORS), rng.range(-0.08, 0.08));
    await drawText(context, '扫码来打卡', 936, 1428, `400 24px ${FAMILY_WENKAI}`, INK_SOFT, 'center');
  }

  // 页脚
  const today = formatDate(new Date());
  await drawRuns(
    context,
    [
      { text: `第 ${dayOfYear(dateLabel)} 天 · `, font: `400 24px ${FAMILY_WENKAI}`, color: INK_SOFT },
      { text: 'KPL无言应援信号站', font: `400 26px ${FAMILY_WENKAI}`, color: INK_SOFT },
      { text: ` · ${today}`, font: `500 22px "JetBrains Mono", "Noto Sans SC", monospace`, color: INK_SOFT },
    ],
    100,
    1418
  );

  // 散落小涂鸦（星星 / 爱心随机点缀）
  if (rng.bool(0.7))
    drawStarDoodle(context, rng.range(640, 1000), rng.range(880, 1020), rng.range(14, 24), 'rgba(242,183,5,0.75)');
  if (rng.bool(0.5))
    drawHeartDoodle(context, rng.range(680, 1000), rng.range(940, 1060), rng.range(12, 20), 'rgba(225,91,78,0.55)');
}

export const noteTemplate: CardTemplate = {
  id: 'note',
  name: '手写日签',
  draw,
};
