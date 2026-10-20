import type { CardTemplate, TemplateContext } from '../types';
import { CARD_STAT_COUNT, heroEyebrowOf, selectVisibleRefs } from '../selection';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  FAMILY_SUBTITLE,
  FAMILY_WENKAI,
  HERO_CHIP_HEIGHT_RATIO,
  buildQrImage,
  buildSignalWavePath,
  drawCaptionPill,
  drawGrain,
  drawHeroChips,
  drawQrFramed,
  drawRuns,
  drawText,
  fitText,
  formatDate,
  inkCenterY,
  layoutCaption,
  roundRectPath,
  type HeroChipsStyle,
} from '../shared';

/* 应援 · 亮色信号：signal 的浅色孪生，保留斜网格 / 正弦波 / 频段刻度这套科技语言 */

const BASES = ['#EEF4F9', '#F2F7FB', '#E9F1F8'];
const INK = '#0B2130';
const MUTED = '#45657A';
const DIM = '#6F8BA0';
const LINE = '#CBDCEA';

const FONT_TITLE_HEADER = `400 70px ${FAMILY_WENKAI}`;
const FONT_EN = `600 26px "Inter", "Noto Sans SC", sans-serif`;
const FONT_SUB = `500 28px "HarmonyOS Sans SC", "Noto Sans SC", sans-serif`;
const FONT_MONO = `500 28px "JetBrains Mono", "Noto Sans SC", monospace`;

function drawBackground(ctx: TemplateContext): void {
  const { ctx: context, theme, rng } = ctx;
  context.fillStyle = rng.pick(BASES);
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // 斜向网格：signal 同构，但把霓虹青换成沉稳青并压暗透明度
  context.save();
  context.globalAlpha = 0.16;
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
  context.globalAlpha = 0.18;
  context.strokeStyle = theme.primary;
  context.lineWidth = 2;
  context.stroke(buildSignalWavePath(context, 0, 726, CARD_WIDTH, 58, 0.004, 0));
  context.restore();

  // 左上切角色块（signal 的 #10192B 楔形对应物）
  context.fillStyle = 'rgba(198,220,236,0.55)';
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(780, 0);
  context.lineTo(570, 350);
  context.lineTo(0, 470);
  context.closePath();
  context.fill();

  // 左侧双色信号条
  context.fillStyle = theme.secondary;
  context.fillRect(78, 122, 16, 180);
  context.fillStyle = theme.primary;
  context.fillRect(106, 122, 5, 120);

  drawGrain(context, rng, { density: 900, alpha: 0.028, colors: ['#4d6b82'] });
}

/** 右侧同心环标：signal 圆形徽章的亮色对应（无打卡数据时纯图形） */
function drawRingMark(ctx: TemplateContext): void {
  const { ctx: context, theme } = ctx;
  const cx = 885;
  const cy = 232;
  const rings = [110, 78, 46];
  context.save();
  rings.forEach((r, index) => {
    context.beginPath();
    context.arc(cx, cy, r, 0, Math.PI * 2);
    context.strokeStyle = `rgba(${theme.primaryRgb},${0.5 - index * 0.12})`;
    context.lineWidth = index === 0 ? 2 : 1.5;
    context.stroke();
  });
  // 刻度点
  context.fillStyle = `rgba(${theme.primaryRgb},0.75)`;
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12;
    context.beginPath();
    context.arc(cx + Math.cos(a) * 94, cy + Math.sin(a) * 94, i % 3 === 0 ? 4 : 2.2, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  context.save();
  context.textAlign = 'center';
  context.font = `700 26px "Inter", "Noto Sans SC", sans-serif`;
  context.fillStyle = theme.primary;
  context.fillText('KPL', cx, cy + 9);
  context.restore();
}

/** 频段刻度空态卡 */
function drawSpectrumStandby(ctx: TemplateContext, theme: TemplateContext['theme']): void {
  const { ctx: context } = ctx;
  const x = 92;
  const y = 1094;
  const w = 896;
  const h = 104;
  context.save();
  roundRectPath(context, x, y, w, h, 18);
  context.fillStyle = 'rgba(255,255,255,0.78)';
  context.fill();
  context.lineWidth = 1.5;
  context.strokeStyle = LINE;
  context.stroke();
  context.restore();

  context.save();
  context.strokeStyle = `rgba(${theme.primaryRgb},0.6)`;
  context.lineWidth = 4;
  const bx = 132;
  const by = y + 28;
  const bh = 48;
  for (let i = 0; i < 8; i++) {
    const barH = bh * (0.4 + (0.6 * i) / 7);
    context.beginPath();
    context.moveTo(bx + i * 12, by + (bh - barH));
    context.lineTo(bx + i * 12, by + bh);
    context.stroke();
  }
  context.restore();

  context.save();
  context.textAlign = 'center';
  context.font = `400 20px "Inter", "Noto Sans SC", sans-serif`;
  context.fillStyle = DIM;
  context.fillText('信号频段采集中 · SIGNAL SPECTRUM STANDBY', x + w / 2, y + h / 2 + 7);
  context.restore();
}

async function draw(ctx: TemplateContext): Promise<void> {
  const { ctx: context, theme, input, rng } = ctx;
  drawBackground(ctx);

  await drawText(context, '无言应援信号', 144, 190, FONT_TITLE_HEADER, INK);
  await drawText(context, 'KPL WUYAN / FAN SIGNAL STATION', 146, 244, FONT_EN, MUTED);
  drawRingMark(ctx);

  // 主文案
  await drawText(context, 'SIGNAL / 01', 92, 415, `600 24px "Inter", "Noto Sans SC", sans-serif`, theme.primary);
  const copyTop = 504;
  const captionLimit = 1070;
  const captionGap = 64;
  const captionPadY = 15;
  const caption = await layoutCaption(context, input.emojiCaption, FAMILY_SUBTITLE, {
    maxWidth: 840,
    maxSize: 34,
    minSize: 24,
    lineHeightRatio: 1.35,
    weight: 500,
  });
  const fitted = await fitText(context, input.line, FAMILY_WENKAI, {
    maxWidth: 896,
    maxLines: 5,
    maxSize: 78,
    minSize: 50,
    lineHeightRatio: 1.34,
    maxHeight: captionLimit - copyTop - (caption.lines.length ? captionGap + caption.height + captionPadY * 2 : 0),
  });
  context.font = fitted.font;
  context.fillStyle = INK;
  fitted.lines.forEach((row, index) => context.fillText(row, 92, copyTop + index * fitted.lineHeight));

  // 情绪 pill（长句自动折行）
  const copyBottom = copyTop + (fitted.lines.length - 1) * fitted.lineHeight;
  if (caption.lines.length) {
    drawCaptionPill(context, {
      x: 92,
      top: copyBottom + captionGap,
      layout: caption,
      padX: 28,
      padY: captionPadY,
      fill: theme.secondary,
      color: theme.onAccent,
    });
  }

  // 赛季数据
  if (input.showRefs !== false) {
    const visible = selectVisibleRefs(input.refs, rng, CARD_STAT_COUNT);
    if (visible.length === 0) {
      drawSpectrumStandby(ctx, theme);
    } else {
      context.strokeStyle = LINE;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(92, 1094);
      context.lineTo(720, 1094);
      context.stroke();

      // 胶囊首行与数字墨迹共用中线，整组从该中线向下排，避免沉到数字下方
      const valueFont = `700 38px "JetBrains Mono", "Noto Sans SC", monospace`;
      const sample = visible.find((ref) => !ref.hero)?.value ?? '0';
      context.font = valueFont;
      await document.fonts.load(valueFont, sample);
      const valueCenterY = inkCenterY(context, sample, 1194, 38);
      const chipStyle: HeroChipsStyle = {
        nameSize: 28,
        metaSize: 20,
        nameColor: theme.primary,
        metaColor: DIM,
        nameFill: `rgba(${theme.primaryRgb},0.12)`,
        metaFill: 'rgba(11,33,48,0.05)',
        stroke: LINE,
        highColor: '#1F7A5C',
        nameFamily: FAMILY_WENKAI,
        valign: 'top',
      };
      const chipTop = valueCenterY - Math.round(chipStyle.nameSize * HERO_CHIP_HEIGHT_RATIO) / 2;

      for (const [i, ref] of visible.entries()) {
        const x = 92 + i * 216;
        await drawText(
          context,
          ref.hero ? heroEyebrowOf(ref) : ref.label,
          x,
          1142,
          `400 22px "Noto Sans SC", sans-serif`,
          DIM
        );
        if (ref.hero) {
          await drawHeroChips(context, ref.hero, { x, y: chipTop, w: 196, h: 88 }, chipStyle);
          continue;
        }
        context.font = valueFont;
        await document.fonts.load(valueFont, ref.value);
        context.fillStyle = theme.primary;
        context.fillText(ref.value, x, 1194);
      }
    }
  }

  // QR
  if (input.showQr !== false) {
    const qr = await buildQrImage(`${INK}FF`, '#FFFFFFFF');
    drawQrFramed(context, qr, {
      x: 812,
      y: 1170,
      size: 196,
      frameFill: '#FFFFFF',
      frameStroke: LINE,
      accentStroke: `rgba(${theme.primaryRgb},0.4)`,
      shadow: true,
    });
    await drawText(
      context,
      '扫码接收今日信号',
      910,
      1160,
      `400 18px "Inter", "Noto Sans SC", sans-serif`,
      MUTED,
      'center'
    );
  }

  // 页脚
  const today = formatDate(new Date());
  await drawRuns(
    context,
    [
      { text: '生成日期 ： ', font: `400 22px "Noto Sans SC", sans-serif`, color: DIM },
      { text: today, font: FONT_MONO, color: DIM },
      { text: ' · ', font: FONT_MONO, color: DIM },
      { text: 'KPL无言应援信号站', font: FONT_SUB, color: DIM },
    ],
    92,
    1360
  );
}

export const pulseTemplate: CardTemplate = {
  id: 'pulse',
  name: '亮色信号',
  draw,
};
