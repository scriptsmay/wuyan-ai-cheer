import type { CardTemplate, TemplateContext } from '../types';
import { selectVisibleRefs } from '../selection';
import {
  CARD_HEIGHT,
  FAMILY_WENKAI,
  fitText,
  CARD_WIDTH,
  FAMILY_TITLE,
  buildQrImage,
  buildSignalWavePath,
  drawQrFramed,
  drawRays,
  drawRuns,
  drawText,
  formatDate,
  roundRectPath,
  wrapText,
} from '../shared';

const FONT_TITLE_HEADER = `400 70px ${FAMILY_TITLE}`;

/* 原深色科技风模板（signal）：整卡视觉与模板族重构前保持一致 */

function drawBackground(ctx: TemplateContext): void {
  const { ctx: context, theme } = ctx;
  context.fillStyle = '#0A0E1A';
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

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

  context.fillStyle = theme.secondary;
  context.fillRect(78, 122, 16, 180);
  context.fillStyle = theme.primary;
  context.fillRect(106, 122, 5, 120);
}

async function drawStreakBadge(ctx: TemplateContext): Promise<void> {
  const { ctx: context, theme, input, rng } = ctx;
  const cx = 885;
  const cy = 230;
  const R = 110;

  const grad = context.createRadialGradient(cx, cy, 0, cx, cy, R);
  grad.addColorStop(0, `rgba(${theme.primaryRgb},0.18)`);
  grad.addColorStop(1, `rgba(${theme.primaryRgb},0)`);
  context.beginPath();
  context.arc(cx, cy, R, 0, Math.PI * 2);
  context.fillStyle = grad;
  context.fill();

  context.beginPath();
  context.arc(cx, cy, R, 0, Math.PI * 2);
  context.strokeStyle = `rgba(${theme.primaryRgb},0.5)`;
  context.lineWidth = 2;
  context.stroke();

  const checkin = input.checkin;
  if (!checkin) {
    return;
  }

  const streak = checkin.total_days;
  let numSize = 140;
  let numColor = theme.primary;

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

  const font = `400 ${numSize}px ${FAMILY_TITLE}`;
  await document.fonts.load(font, String(streak));
  context.save();
  context.textAlign = 'center';
  context.font = font;
  context.fillStyle = numColor;
  context.fillText(String(streak), cx, cy + numSize * 0.35);
  context.restore();

  await drawText(
    context,
    'DAY',
    cx,
    cy + 102,
    `500 26px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif`,
    '#86A8B8',
    'center'
  );
}

async function draw(ctx: TemplateContext): Promise<void> {
  const { ctx: context, theme, input, rng } = ctx;
  drawBackground(ctx);

  // Header
  await drawText(context, input.checkin ? '每日加油信号' : '无言应援信号', 144, 190, FONT_TITLE_HEADER, '#DFFBFF');
  await drawText(
    context,
    'KPL WUYAN / FAN SIGNAL STATION',
    146,
    244,
    `600 26px "Inter", "Noto Sans SC", sans-serif`,
    '#7AA8B8'
  );

  if (input.checkin) {
    const statusColor = '#8DBFD0';
    const fontMono = `500 28px "JetBrains Mono", "Noto Sans SC", monospace`;
    const fontSub = `500 28px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif`;
    await drawRuns(
      context,
      [
        { text: input.checkin.date, font: fontMono, color: statusColor },
        { text: '  ·  连续 ', font: fontSub, color: statusColor },
        { text: String(input.checkin.streak), font: fontMono, color: statusColor },
        { text: ' 天  ·  累计 ', font: fontSub, color: statusColor },
        { text: String(input.checkin.total_days), font: fontMono, color: statusColor },
        { text: ' 天', font: fontSub, color: statusColor },
      ],
      146,
      300
    );
  }

  await drawStreakBadge(ctx);

  // 主文案：自适应字号排版，支持 50+ 字长句
  await drawText(context, 'SIGNAL / 01', 92, 415, `600 24px "Inter", "Noto Sans SC", sans-serif`, theme.primary);
  const copyTop = 504;
  const fitted = await fitText(context, input.line, FAMILY_WENKAI, {
    maxWidth: 896,
    maxLines: 5,
    maxSize: 80,
    minSize: 52,
    lineHeightRatio: 1.34,
  });
  context.font = fitted.font;
  context.fillStyle = '#F5FBFF';
  fitted.lines.forEach((row, index) => context.fillText(row, 92, copyTop + index * fitted.lineHeight));

  // 情绪 pill
  if (input.emojiCaption) {
    const font = `500 34px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif`;
    context.font = font;
    await document.fonts.load(font, input.emojiCaption);
    const tw = context.measureText(input.emojiCaption).width;
    const padX = 28;
    const h = 62;
    const w = tw + padX * 2;
    const copyBottom = copyTop + (fitted.lines.length - 1) * fitted.lineHeight;
    const captionGap = fitted.lines.length >= 5 ? 44 : 64;
    const top = Math.min(copyBottom + captionGap, 1000);
    context.save();
    roundRectPath(context, 92, top, w, h, h / 2);
    context.fillStyle = theme.secondary;
    context.fill();
    context.fillStyle = theme.onAccent;
    context.textBaseline = 'middle';
    context.fillText(input.emojiCaption, 92 + padX, top + h / 2 + 2);
    context.restore();
  }

  // refs
  if (input.showRefs !== false) {
    const visible = selectVisibleRefs(input.refs, rng, 2);
    if (visible.length === 0) {
      // 空状态占位卡（频段刻度）
      const x = 92;
      const y = 1094;
      const w = 896;
      const h = 104;
      roundRectPath(context, x, y, w, h, 18);
      context.fillStyle = '#121d30';
      context.fill();
      context.lineWidth = 1;
      context.strokeStyle = 'rgba(36,67,90,0.5)';
      context.stroke();
      context.save();
      context.strokeStyle = `rgba(${theme.primaryRgb},0.25)`;
      context.lineWidth = 4;
      const bx = 132;
      const by = y + 28;
      const bh = 48;
      const step = 12;
      for (let i = 0; i < 8; i++) {
        const barH = bh * (0.4 + (0.6 * i) / 7);
        context.beginPath();
        context.moveTo(bx + i * step, by + (bh - barH));
        context.lineTo(bx + i * step, by + bh);
        context.stroke();
      }
      context.restore();
      context.save();
      context.textAlign = 'center';
      context.font = `400 20px "Inter", "Noto Sans SC", sans-serif`;
      context.fillStyle = '#577485';
      context.fillText('信号频段采集中 · SIGNAL SPECTRUM STANDBY', x + w / 2, y + h / 2 + 7);
      context.restore();
    } else {
      context.strokeStyle = '#25445A';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(92, 1094);
      context.lineTo(720, 1094);
      context.stroke();

      for (const [i, ref] of visible.entries()) {
        const x = 92 + i * 320;
        await drawText(context, ref.label, x, 1142, `400 22px "Noto Sans SC", sans-serif`, '#6F93A3');
        context.font = `700 38px "JetBrains Mono", "Noto Sans SC", monospace`;
        await document.fonts.load(`700 38px "JetBrains Mono", "Noto Sans SC", monospace`, ref.value);
        context.fillStyle = theme.primary;
        context.fillText(ref.value, x, 1194);
      }
    }
  }

  // Footer：QR + 生成日期
  if (input.showQr !== false) {
    const qr = await buildQrImage('#0A0E1AFF', '#F5FBFFFF');
    drawQrFramed(context, qr, {
      x: 812,
      y: 1170,
      size: 196,
      frameFill: '#10182a',
      frameStroke: 'rgba(36,67,90,0.5)',
      accentStroke: `rgba(${theme.primaryRgb},0.35)`,
      shadow: true,
    });
    await drawText(
      context,
      '扫码接收今日信号',
      910,
      1160,
      `400 18px "Inter", "Noto Sans SC", sans-serif`,
      '#9FB4C0',
      'center'
    );
  }

  const today = formatDate(new Date());
  const darkColor = '#587483';
  await drawRuns(
    context,
    [
      { text: '生成日期 ： ', font: `400 22px "Noto Sans SC", sans-serif`, color: darkColor },
      { text: today, font: `500 22px "JetBrains Mono", "Noto Sans SC", monospace`, color: darkColor },
      { text: ' · ', font: `500 22px "JetBrains Mono", "Noto Sans SC", monospace`, color: darkColor },
      { text: 'KPL无言应援信号站', font: `500 22px "JetBrains Mono", "Noto Sans SC", monospace`, color: darkColor },
    ],
    92,
    1360
  );
}

export const signalTemplate: CardTemplate = {
  id: 'signal',
  name: '深色信号（经典）',
  draw,
};
