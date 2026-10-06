import type { CardTemplate, TemplateContext } from '../types';
import {
  FAMILY_WENKAI,
  buildQrImage,
  drawBlobs,
  drawGrain,
  drawQrFramed,
  drawStars,
  drawText,
  drawRuns,
  fitText,
  formatDate,
  roundRectPath,
} from '../shared';

/* 应援 · low 暮色弥散：深紫夜空 + 弥散光斑 + 星点月亮 + 星座连线 */

const BASES = ['#1C1330', '#211741', '#191026'];
const BLOB_COLORS = ['#8E7CC3', '#C77DA8', '#5D6CC3', '#E8A0B8', '#4E5BA6'];

async function draw(ctx: TemplateContext): Promise<void> {
  const { ctx: context, rng, input } = ctx;
  const base = rng.pick(BASES);

  context.fillStyle = base;
  context.fillRect(0, 0, 1080, 1440);
  drawBlobs(context, rng, {
    colors: BLOB_COLORS,
    count: [5, 7],
    alpha: [0.28, 0.5],
    radius: [280, 560],
  });
  drawStars(context, rng, { count: 120, color: '#EDE6FF', maxY: 1000 });
  drawGrain(context, rng, { density: 1600, alpha: 0.05, colors: ['#FFFFFF'] });

  // 月牙（发光 + 双圆相减）
  const mx = rng.range(700, 950);
  const my = rng.range(150, 300);
  const mr = 46;
  const glow = context.createRadialGradient(mx, my, 0, mx, my, mr * 3.4);
  glow.addColorStop(0, 'rgba(242,233,216,0.4)');
  glow.addColorStop(1, 'rgba(242,233,216,0)');
  context.fillStyle = glow;
  context.fillRect(mx - mr * 3.4, my - mr * 3.4, mr * 6.8, mr * 6.8);
  context.fillStyle = '#F2E9D8';
  context.beginPath();
  context.arc(mx, my, mr, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = base;
  context.beginPath();
  context.arc(mx + mr * 0.42, my - mr * 0.18, mr * 0.86, 0, Math.PI * 2);
  context.fill();

  // 眉头 + 标题
  await drawText(
    context,
    'SOFT NIGHT · RECHARGING',
    92,
    152,
    `600 24px "Inter", "Noto Sans SC", sans-serif`,
    'rgba(200,190,240,0.55)'
  );
  await drawText(context, '低谷陪伴信号', 92, 226, `400 46px ${FAMILY_WENKAI}`, 'rgba(244,239,255,0.92)');

  // 主文案
  const fitted = await fitText(context, input.line, FAMILY_WENKAI, {
    maxWidth: 880,
    maxLines: 6,
    maxSize: 80,
    minSize: 54,
    lineHeightRatio: 1.42,
  });
  context.font = fitted.font;
  context.fillStyle = '#F4EFFF';
  const copyTop = 486;
  fitted.lines.forEach((row, index) => context.fillText(row, 92, copyTop + index * fitted.lineHeight));

  // 心情标语：半透明紫 pill
  const copyBottom = copyTop + (fitted.lines.length - 1) * fitted.lineHeight;
  if (input.emojiCaption) {
    const font = `500 32px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif`;
    context.font = font;
    await document.fonts.load(font, input.emojiCaption);
    const tw = context.measureText(input.emojiCaption).width;
    const padX = 28;
    const h = 62;
    const top = Math.min(copyBottom + 84, 966);
    context.save();
    roundRectPath(context, 92, top, tw + padX * 2, h, h / 2);
    context.fillStyle = 'rgba(142,124,195,0.26)';
    context.fill();
    context.strokeStyle = 'rgba(180,155,232,0.55)';
    context.lineWidth = 1.5;
    context.stroke();
    context.fillStyle = '#D9CCF5';
    context.textBaseline = 'middle';
    context.fillText(input.emojiCaption, 92 + padX, top + h / 2 + 2);
    context.restore();
  }

  // 星座连线涂鸦
  if (rng.bool(0.75)) {
    const points = Array.from({ length: rng.int(4, 6) }, () => ({
      x: rng.range(620, 980),
      y: rng.range(760, 980),
    }));
    context.save();
    context.strokeStyle = 'rgba(220,210,255,0.35)';
    context.lineWidth = 1.2;
    context.beginPath();
    points.forEach((p, i) => (i === 0 ? context.moveTo(p.x, p.y) : context.lineTo(p.x, p.y)));
    context.stroke();
    context.fillStyle = 'rgba(237,230,255,0.8)';
    for (const p of points) {
      context.beginPath();
      context.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  // 赛季数据：半透明玻璃卡
  if (input.showRefs !== false && input.refs.length) {
    const visible = input.refs.slice(0, 2);
    for (const [i, ref] of visible.entries()) {
      const x = 92 + i * 464;
      const y = 1030;
      const w = 432;
      const h = 150;
      context.save();
      roundRectPath(context, x, y, w, h, 20);
      context.fillStyle = 'rgba(255,255,255,0.06)';
      context.fill();
      context.strokeStyle = 'rgba(255,255,255,0.14)';
      context.lineWidth = 1.5;
      context.stroke();
      context.restore();
      await drawText(
        context,
        ref.label,
        x + 34,
        y + 52,
        `400 24px "Noto Sans SC", sans-serif`,
        'rgba(220,210,245,0.55)'
      );
      const valueFont = `700 46px "JetBrains Mono", "Noto Sans SC", monospace`;
      context.font = valueFont;
      await document.fonts.load(valueFont, ref.value);
      context.fillStyle = '#C9B8F0';
      context.fillText(ref.value, x + 34, y + 112);
    }
  }

  // QR
  if (input.showQr !== false) {
    const qr = await buildQrImage('#241A40FF', '#FFFFFFFE');
    drawQrFramed(context, qr, {
      x: 812,
      y: 1244,
      size: 180,
      frameFill: 'rgba(255,255,255,0.94)',
      radius: 16,
      shadow: true,
    });
    await drawText(
      context,
      '扫码接收晚安信号',
      902,
      1228,
      `400 20px "Noto Sans SC", sans-serif`,
      'rgba(220,210,245,0.6)',
      'center'
    );
  }

  // 页脚
  const today = formatDate(new Date());
  await drawRuns(
    context,
    [
      { text: today, font: `500 22px "JetBrains Mono", "Noto Sans SC", monospace`, color: 'rgba(230,225,250,0.45)' },
      { text: ' · KPL无言应援信号站', font: `400 22px "Noto Sans SC", sans-serif`, color: 'rgba(230,225,250,0.45)' },
    ],
    92,
    1402
  );
}

export const duskTemplate: CardTemplate = {
  id: 'dusk',
  name: '暮色弥散',
  draw,
};
