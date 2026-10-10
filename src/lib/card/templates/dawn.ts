import type { CardTemplate, TemplateContext } from '../types';
import { selectVisibleRefs } from '../selection';
import {
  FAMILY_WENKAI,
  buildQrImage,
  drawBlobs,
  drawGrain,
  drawQrFramed,
  drawText,
  drawRuns,
  fitText,
  formatDate,
  roundRectPath,
} from '../shared';

/* 应援 · hope 晨光弥散：暖白晨光 + 彩色光斑 + 太阳云朵飞鸟 */

const BASES = ['#FFF3E9', '#FFEFEC', '#FFF8EE'];
const BLOB_COLORS = ['#FF9A76', '#FFC98A', '#8FD3F4', '#FFB3C1', '#FFE29A'];
const INK = '#4A2C23';
const CORAL = '#F2705F';

async function draw(ctx: TemplateContext): Promise<void> {
  const { ctx: context, rng, input } = ctx;

  context.fillStyle = rng.pick(BASES);
  context.fillRect(0, 0, 1080, 1440);
  drawBlobs(context, rng, {
    colors: BLOB_COLORS,
    count: [5, 7],
    alpha: [0.3, 0.5],
    radius: [280, 540],
  });
  drawGrain(context, rng, { density: 1200, alpha: 0.035, colors: ['#c98d6b'] });

  // 太阳：大光晕 + 柔和日芯
  const sx = rng.range(400, 680);
  const sy = rng.range(210, 300);
  const glow = context.createRadialGradient(sx, sy, 0, sx, sy, 240);
  glow.addColorStop(0, 'rgba(255,190,120,0.7)');
  glow.addColorStop(1, 'rgba(255,190,120,0)');
  context.fillStyle = glow;
  context.fillRect(sx - 240, sy - 240, 480, 480);
  context.fillStyle = 'rgba(255,178,94,0.9)';
  context.beginPath();
  context.arc(sx, sy, 58, 0, Math.PI * 2);
  context.fill();

  // 云朵（避开左上文字区）
  const cloudCount = rng.int(2, 3);
  for (let i = 0; i < cloudCount; i++) {
    const cx = rng.range(460, 980);
    const cy = rng.range(110, 420);
    const s = rng.range(0.7, 1.15);
    context.save();
    context.globalAlpha = 0.78;
    context.fillStyle = '#FFFFFF';
    context.beginPath();
    context.arc(cx, cy, 34 * s, 0, Math.PI * 2);
    context.arc(cx + 40 * s, cy + 8 * s, 26 * s, 0, Math.PI * 2);
    context.arc(cx - 40 * s, cy + 10 * s, 24 * s, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  // 飞鸟
  const birdCount = rng.int(2, 4);
  context.save();
  context.strokeStyle = 'rgba(90,60,50,0.5)';
  context.lineWidth = 3;
  context.lineCap = 'round';
  for (let i = 0; i < birdCount; i++) {
    const bx = rng.range(500, 940);
    const by = rng.range(110, 430);
    const s = rng.range(0.7, 1.2);
    context.beginPath();
    context.arc(bx - 14 * s, by, 14 * s, Math.PI * 1.15, Math.PI * 1.85);
    context.arc(bx + 14 * s, by, 14 * s, Math.PI * 1.15, Math.PI * 1.85);
    context.stroke();
  }
  context.restore();

  // 眉头 + 标题
  await drawText(
    context,
    'GOOD MORNING · NEW DAY',
    92,
    152,
    `600 24px "Inter", "Noto Sans SC", sans-serif`,
    'rgba(140,90,70,0.6)'
  );
  await drawText(context, '晨光应援信号', 92, 226, `400 46px ${FAMILY_WENKAI}`, INK);

  // 主文案
  const copyTop = 468;
  const fitted = await fitText(context, input.line, FAMILY_WENKAI, {
    maxWidth: 880,
    maxLines: 6,
    maxSize: 80,
    minSize: 48,
    lineHeightRatio: 1.36,
  });
  context.font = fitted.font;
  context.fillStyle = INK;
  fitted.lines.forEach((row, index) => context.fillText(row, 92, copyTop + index * fitted.lineHeight));

  // 心情标语：珊瑚实底 pill
  const copyBottom = copyTop + (fitted.lines.length - 1) * fitted.lineHeight;
  if (input.emojiCaption) {
    const font = `500 32px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif`;
    context.font = font;
    await document.fonts.load(font, input.emojiCaption);
    const tw = context.measureText(input.emojiCaption).width;
    const padX = 28;
    const h = 62;
    const captionGap = fitted.lines.length >= 5 ? 52 : 72;
    const top = Math.min(copyBottom + captionGap, 932);
    context.save();
    roundRectPath(context, 92, top, tw + padX * 2, h, h / 2);
    context.fillStyle = CORAL;
    context.fill();
    context.fillStyle = '#FFF6F0';
    context.textBaseline = 'middle';
    context.fillText(input.emojiCaption, 92 + padX, top + h / 2 + 2);
    context.restore();
  }

  // 赛季数据：暖白卡
  if (input.showRefs !== false && input.refs.length) {
    const visible = selectVisibleRefs(input.refs, rng, 2);
    for (const [i, ref] of visible.entries()) {
      const x = 92 + i * 464;
      const y = 1030;
      const w = 432;
      const h = 150;
      context.save();
      roundRectPath(context, x, y, w, h, 20);
      context.fillStyle = 'rgba(255,255,255,0.72)';
      context.fill();
      context.strokeStyle = 'rgba(210,140,110,0.35)';
      context.lineWidth = 1.5;
      context.stroke();
      context.restore();
      await drawText(context, ref.label, x + 34, y + 52, `400 24px "Noto Sans SC", sans-serif`, 'rgba(90,60,50,0.55)');
      const valueFont = `700 46px "JetBrains Mono", "Noto Sans SC", monospace`;
      context.font = valueFont;
      await document.fonts.load(valueFont, ref.value);
      context.fillStyle = '#E0532F';
      context.fillText(ref.value, x + 34, y + 112);
    }
  }

  // QR
  if (input.showQr !== false) {
    const qr = await buildQrImage('#4A2C23FF', '#FFFFFFFE');
    drawQrFramed(context, qr, {
      x: 812,
      y: 1244,
      size: 180,
      frameFill: '#FFFFFF',
      frameStroke: 'rgba(210,140,110,0.4)',
      radius: 16,
      shadow: true,
    });
    await drawText(
      context,
      '扫码接收今日元气',
      902,
      1228,
      `400 20px "Noto Sans SC", sans-serif`,
      'rgba(140,90,70,0.65)',
      'center'
    );
  }

  // 页脚
  const today = formatDate(new Date());
  await drawRuns(
    context,
    [
      { text: today, font: `500 22px "JetBrains Mono", "Noto Sans SC", monospace`, color: 'rgba(120,85,70,0.6)' },
      { text: ' · KPL无言应援信号站', font: `400 22px "Noto Sans SC", sans-serif`, color: 'rgba(120,85,70,0.6)' },
    ],
    92,
    1402
  );
}

export const dawnTemplate: CardTemplate = {
  id: 'dawn',
  name: '晨光弥散',
  draw,
};
