import type { CardTemplate, TemplateContext } from '../types';
import { heroEyebrowOf, selectVisibleRefs } from '../selection';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  FAMILY_WENKAI,
  buildQrImage,
  drawBlobs,
  drawGrain,
  drawHeroChips,
  drawQrFramed,
  drawRuns,
  drawStars,
  drawText,
  fitText,
  formatDate,
  roundRectPath,
} from '../shared';

/* 应援 · 柔雾晨光：low 心情的亮色对应版——雾白薰衣草底，陪伴感但不压抑 */

const BASES = ['#F3F0FB', '#EFEAF8', '#F7F4FC'];
const BLOB_COLORS = ['#C9B8F0', '#F5C9DE', '#B8D8F5', '#D8C9F5', '#FFE7C2'];
const INK = '#3B3150';
const SOFT = 'rgba(96,80,132,0.62)';
const VIOLET = '#6B4AA0';

async function draw(ctx: TemplateContext): Promise<void> {
  const { ctx: context, rng, input, theme } = ctx;
  const base = rng.pick(BASES);

  context.fillStyle = base;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  drawBlobs(context, rng, {
    colors: BLOB_COLORS,
    count: [5, 7],
    alpha: [0.32, 0.52],
    radius: [300, 560],
  });

  // 柔日晕：dusk 月牙的亮色对应（不发光的月相，只剩一圈淡影）
  const mx = rng.range(680, 920);
  const my = rng.range(150, 290);
  const mr = 52;
  const halo = context.createRadialGradient(mx, my, 0, mx, my, mr * 3.2);
  halo.addColorStop(0, 'rgba(255,255,255,0.85)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = halo;
  context.fillRect(mx - mr * 3.2, my - mr * 3.2, mr * 6.4, mr * 6.4);
  context.fillStyle = 'rgba(197,180,230,0.55)';
  context.beginPath();
  context.arc(mx, my, mr, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = base;
  context.beginPath();
  context.arc(mx + mr * 0.44, my - mr * 0.16, mr * 0.86, 0, Math.PI * 2);
  context.fill();

  // 薄雾带
  const mistBands = rng.int(3, 4);
  context.save();
  for (let i = 0; i < mistBands; i++) {
    const y = rng.range(420, 1180);
    const w = rng.range(420, 760);
    const x = rng.range(60, CARD_WIDTH - w - 40);
    const grad = context.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = grad;
    context.globalAlpha = rng.range(0.35, 0.6);
    roundRectPath(context, x, y, w, rng.range(10, 22), 12);
    context.fill();
  }
  context.restore();

  drawStars(context, rng, { count: 34, color: VIOLET, maxY: 960 });
  drawGrain(context, rng, { density: 1100, alpha: 0.03, colors: ['#7b6aa0'] });

  // 眉头 + 标题
  await drawText(
    context,
    'SOFT LIGHT · STILL RECHARGING',
    92,
    152,
    `600 24px "Inter", "Noto Sans SC", sans-serif`,
    SOFT
  );
  await drawText(context, '柔雾陪伴信号', 92, 226, `400 46px ${FAMILY_WENKAI}`, INK);

  // 主文案
  const copyTop = 468;
  const fitted = await fitText(context, input.line, FAMILY_WENKAI, {
    maxWidth: 880,
    maxLines: 6,
    maxSize: 78,
    minSize: 48,
    lineHeightRatio: 1.36,
  });
  context.font = fitted.font;
  context.fillStyle = INK;
  fitted.lines.forEach((row, index) => context.fillText(row, 92, copyTop + index * fitted.lineHeight));
  const copyBottom = copyTop + (fitted.lines.length - 1) * fitted.lineHeight;

  // 心情标语：淡紫描边 pill（dusk 实底 pill 的亮色对应）
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
    context.fillStyle = 'rgba(255,255,255,0.68)';
    context.fill();
    context.strokeStyle = `rgba(${theme.primaryRgb},0.45)`;
    context.lineWidth = 1.5;
    context.stroke();
    context.fillStyle = VIOLET;
    context.textBaseline = 'middle';
    context.fillText(input.emojiCaption, 92 + padX, top + h / 2 + 2);
    context.restore();
  }

  // 赛季数据：白雾卡
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
      context.strokeStyle = 'rgba(160,140,200,0.34)';
      context.lineWidth = 1.5;
      context.stroke();
      context.restore();
      await drawText(
        context,
        ref.hero ? heroEyebrowOf(ref) : ref.label,
        x + 34,
        y + 52,
        `400 24px "Noto Sans SC", sans-serif`,
        SOFT
      );
      if (ref.hero) {
        await drawHeroChips(
          context,
          ref.hero,
          { x: x + 34, y: y + 68, w: w - 68, h: 66 },
          {
            nameSize: 32,
            metaSize: 22,
            nameColor: VIOLET,
            metaColor: SOFT,
            nameFill: 'rgba(107,74,160,0.10)',
            metaFill: 'rgba(59,49,80,0.05)',
            stroke: 'rgba(160,140,200,0.4)',
            highColor: '#2F8E74',
            nameFamily: FAMILY_WENKAI,
          }
        );
        continue;
      }
      const valueFont = `700 46px "JetBrains Mono", "Noto Sans SC", monospace`;
      context.font = valueFont;
      await document.fonts.load(valueFont, ref.value);
      context.fillStyle = VIOLET;
      context.fillText(ref.value, x + 34, y + 112);
    }
  }

  // QR
  if (input.showQr !== false) {
    const qr = await buildQrImage(`${INK}FF`, '#FFFFFFFE');
    drawQrFramed(context, qr, {
      x: 812,
      y: 1244,
      size: 180,
      frameFill: '#FFFFFF',
      frameStroke: 'rgba(160,140,200,0.36)',
      radius: 16,
      shadow: true,
    });
    await drawText(context, '扫码接收晚安信号', 902, 1228, `400 20px "Noto Sans SC", sans-serif`, SOFT, 'center');
  }

  // 页脚
  const today = formatDate(new Date());
  await drawRuns(
    context,
    [
      { text: today, font: `500 22px "JetBrains Mono", "Noto Sans SC", monospace`, color: SOFT },
      { text: ' · KPL无言应援信号站', font: `400 22px "Noto Sans SC", sans-serif`, color: SOFT },
    ],
    92,
    1402
  );
}

export const mistTemplate: CardTemplate = {
  id: 'mist',
  name: '柔雾晨光',
  draw,
};
