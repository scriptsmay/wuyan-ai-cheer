import type { CardTemplate, TemplateContext } from '../types';
import { CARD_STAT_COUNT, heroEyebrowOf, selectVisibleRefs } from '../selection';
import {
  FAMILY_SUBTITLE,
  FAMILY_WENKAI,
  buildQrImage,
  drawBlobs,
  drawCaptionPill,
  drawGrain,
  drawHeroChips,
  drawQrFramed,
  drawStars,
  drawText,
  drawRuns,
  fitText,
  formatDate,
  layoutCaption,
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
  await drawText(context, '晚幕陪伴信号', 92, 226, `400 46px ${FAMILY_WENKAI}`, 'rgba(244,239,255,0.92)');

  // 主文案
  const copyTop = 468;
  const captionLimit = 1006;
  const captionGap = 72;
  const captionPadY = 15;
  const caption = await layoutCaption(context, input.emojiCaption, FAMILY_SUBTITLE, {
    maxWidth: 840,
    maxSize: 32,
    minSize: 22,
    lineHeightRatio: 1.35,
    weight: 500,
  });
  const fitted = await fitText(context, input.line, FAMILY_WENKAI, {
    maxWidth: 880,
    maxLines: 6,
    maxSize: 80,
    minSize: 48,
    lineHeightRatio: 1.36,
    maxHeight: captionLimit - copyTop - (caption.lines.length ? captionGap + caption.height + captionPadY * 2 : 0),
  });
  context.font = fitted.font;
  context.fillStyle = '#F4EFFF';
  fitted.lines.forEach((row, index) => context.fillText(row, 92, copyTop + index * fitted.lineHeight));

  // 心情标语：半透明紫 pill（长句自动折行）
  const copyBottom = copyTop + (fitted.lines.length - 1) * fitted.lineHeight;
  if (caption.lines.length) {
    drawCaptionPill(context, {
      x: 92,
      top: copyBottom + captionGap,
      layout: caption,
      padX: 28,
      padY: captionPadY,
      fill: 'rgba(142,124,195,0.26)',
      stroke: 'rgba(180,155,232,0.55)',
      strokeWidth: 1.5,
      color: '#D9CCF5',
    });
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
    const visible = selectVisibleRefs(input.refs, rng, CARD_STAT_COUNT);
    for (const [i, ref] of visible.entries()) {
      const x = 92 + i * 306;
      const y = 1030;
      const w = 282;
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
        ref.hero ? heroEyebrowOf(ref) : ref.label,
        x + 24,
        y + 48,
        `400 24px "Noto Sans SC", sans-serif`,
        'rgba(220,210,245,0.55)'
      );
      if (ref.hero) {
        await drawHeroChips(
          context,
          ref.hero,
          { x: x + 24, y: y + 62, w: w - 48, h: 74 },
          {
            nameSize: 32,
            metaSize: 22,
            nameColor: '#C9B8F0',
            metaColor: 'rgba(220,210,245,0.62)',
            nameFill: 'rgba(180,155,232,0.16)',
            metaFill: 'rgba(255,255,255,0.07)',
            stroke: 'rgba(255,255,255,0.16)',
            highColor: '#7FD8B0',
            nameFamily: FAMILY_WENKAI,
          }
        );
        continue;
      }
      const valueFont = `700 46px "JetBrains Mono", "Noto Sans SC", monospace`;
      context.font = valueFont;
      await document.fonts.load(valueFont, ref.value);
      context.fillStyle = '#C9B8F0';
      context.fillText(ref.value, x + 24, y + 112);
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
