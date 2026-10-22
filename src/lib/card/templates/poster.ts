import type { CardInput, CardTemplate, TemplateContext } from '../types';
import { CARD_STAT_COUNT, heroEyebrowOf, selectVisibleRefs } from '../selection';
import {
  FAMILY_BODY,
  FAMILY_WENKAI,
  HERO_CHIP_HEIGHT_RATIO,
  buildQrImage,
  drawHeroChips,
  drawQrFramed,
  drawText,
  drawRuns,
  fitText,
  inkCenterY,
  layoutCaption,
  loadImage,
  type HeroChipsStyle,
} from '../shared';

/* 应援 · victory 大字报：摄影背景 + 白色大字 + 手绘感框线（柔和版） */

const WHITE = '#FFFFFF';
const QRCODE_DARK = '#2A2521FF';
const QRCODE_LIGHT = '#FFFFFFFE';

interface PosterBg {
  src: string;
  /** 背景图焦点 y（0-1），cover 裁切时对齐该位置 */
  focusY: number;
  /** 顶部渐变压暗终止位置（0-1，相对卡高） */
  topShade: number;
}

const BACKGROUNDS: PosterBg[] = [
  { src: '/bg/poster-field.jpg', focusY: 0.5, topShade: 0.62 },
  // 暮色海面：上部天色浅淡，需更重的顶部压暗托住白字
  { src: '/bg/poster-dusk-sea.jpg', focusY: 1, topShade: 0.72 },
  // 海鸥涂鸦：深蓝天空白字对比好；主体在下半部，focusY 对齐底部
  { src: '/bg/poster-gull-sky.jpg', focusY: 1, topShade: 0.45 },
];

/** 文案区可用宽度（左右边距对称） */
const COPY_MARGIN = 88;
const COPY_WIDTH = 1080 - COPY_MARGIN * 2;

interface LoadedPosterBg {
  image: HTMLImageElement | null;
  bg: PosterBg;
  /** 是否使用「选手相片」素材：决定是否叠加文案暗衬 */
  portrait: boolean;
}

async function resolvePosterBg(input: CardInput): Promise<LoadedPosterBg> {
  const remote = input.background;
  if (remote?.src) {
    const focusY = Number.isFinite(remote.focusY) ? Math.min(1, Math.max(0, remote.focusY)) : 0.5;
    const image = await loadImage(remote.src).catch(() => null);
    // 人像素材取图失败（图床故障 / CORS 被拒）：回落本地风景图，不出空白卡
    if (image) return { image, bg: { src: remote.src, focusY, topShade: 0.58 }, portrait: true };
  }
  // 本地背景不参与随机：由 variant 决定，保证「换一换」必换背景
  // （两张图随机 pick 有 50% 概率停在原图，体验上等于没换）
  const bg = BACKGROUNDS[(input.variant ?? 0) % BACKGROUNDS.length]!;
  const image = await loadImage(bg.src).catch(() => null);
  return { image, bg, portrait: false };
}

/**
 * 人像背景的文案暗衬：左侧重、右侧透明，纵向两端羽化。
 * 横向淡出在离屏 canvas 上用 destination-in 合成，避免直接叠矩形出现硬边。
 */
function drawCopyScrim(context: CanvasRenderingContext2D, top: number, bottom: number): void {
  const width = 960;
  const height = Math.round(bottom - top);
  if (height <= 0) return;
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const layerCtx = layer.getContext('2d');
  if (!layerCtx) return;
  const vertical = layerCtx.createLinearGradient(0, 0, 0, height);
  vertical.addColorStop(0, 'rgba(16,12,9,0)');
  vertical.addColorStop(0.16, 'rgba(16,12,9,0.36)');
  vertical.addColorStop(0.84, 'rgba(16,12,9,0.36)');
  vertical.addColorStop(1, 'rgba(16,12,9,0)');
  layerCtx.fillStyle = vertical;
  layerCtx.fillRect(0, 0, width, height);
  const horizontal = layerCtx.createLinearGradient(0, 0, width, 0);
  horizontal.addColorStop(0, 'rgba(0,0,0,1)');
  horizontal.addColorStop(0.55, 'rgba(0,0,0,0.7)');
  horizontal.addColorStop(1, 'rgba(0,0,0,0)');
  layerCtx.globalCompositeOperation = 'destination-in';
  layerCtx.fillStyle = horizontal;
  layerCtx.fillRect(0, 0, width, height);
  context.drawImage(layer, 0, top);
}

async function drawQuoteMarks(context: CanvasRenderingContext2D, x: number, y: number, color: string): Promise<void> {
  const font = `400 96px ${FAMILY_WENKAI}`;
  context.font = font;
  await document.fonts.load(font, '“');
  context.fillStyle = color;
  context.fillText('“', x, y);
}

async function drawStats(ctx: TemplateContext, y: number): Promise<void> {
  const { ctx: context, input } = ctx;
  const labelColor = 'rgba(255,255,255,0.66)';
  const valueColor = WHITE;

  const visible = input.showRefs === false ? [] : selectVisibleRefs(input.refs, ctx.rng, CARD_STAT_COUNT);
  if (visible.length) {
    // 胶囊首行与数字墨迹共用中线，整组从该中线向下排，避免沉到数字下方
    const valueFont = `700 64px "JetBrains Mono", "Noto Sans SC", monospace`;
    const sample = visible.find((ref) => !ref.hero)?.value ?? '0';
    context.font = valueFont;
    await document.fonts.load(valueFont, sample);
    const valueCenterY = inkCenterY(context, sample, y + 26, 64);
    const chipStyle: HeroChipsStyle = {
      nameSize: 32,
      metaSize: 22,
      nameColor: WHITE,
      metaColor: 'rgba(255,255,255,0.92)',
      nameFill: 'rgba(255,255,255,0.14)',
      metaFill: 'rgba(255,255,255,0.08)',
      stroke: 'rgba(255,255,255,0.42)',
      highColor: '#8FE0B8',
      radiusRatio: 0.16,
      valign: 'top',
    };
    const chipTop = valueCenterY - Math.round(chipStyle.nameSize * HERO_CHIP_HEIGHT_RATIO) / 2;

    for (const [i, ref] of visible.entries()) {
      const x = 92 + i * 306;
      await drawText(
        context,
        ref.hero ? heroEyebrowOf(ref) : ref.label,
        x,
        y - 46,
        `500 24px ${FAMILY_BODY}`,
        labelColor
      );
      if (ref.hero) {
        await drawHeroChips(context, ref.hero, { x, y: chipTop, w: 282, h: 96 }, chipStyle);
        continue;
      }
      context.font = valueFont;
      await document.fonts.load(valueFont, ref.value);
      context.fillStyle = valueColor;
      context.fillText(ref.value, x, y + 26);
    }
    return;
  }

  // 无数据：白色装饰短线
  const widths = [120, 56, 24];
  let x = 92;
  for (const w of widths) {
    context.globalAlpha = 0.72;
    context.fillStyle = WHITE;
    context.fillRect(x, y - 8, w, 6);
    x += w + 24;
  }
  context.globalAlpha = 1;
}

async function draw(ctx: TemplateContext): Promise<void> {
  const { ctx: context, input, dateLabel } = ctx;
  const { image, bg, portrait } = await resolvePosterBg(input);

  // ---- 背景：cover 铺满 + 上下渐变压暗 ----
  if (image) {
    const scale = Math.max(1080 / image.width, 1440 / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    const x = (1080 - w) / 2;
    const yMax = 1440 - h;
    const y = yMax * bg.focusY;
    context.drawImage(image, x, y, w, h);
  } else {
    // 背景缺失兜底：柔和中性底色
    context.fillStyle = '#5E7A8C';
    context.fillRect(0, 0, 1080, 1440);
  }

  // 顶部渐变压暗：保大字可读；底部轻压暗：保数据/页脚可读
  const topShadeEnd = 1440 * bg.topShade;
  const topShade = context.createLinearGradient(0, 0, 0, topShadeEnd);
  topShade.addColorStop(0, 'rgba(20,16,12,0.34)');
  topShade.addColorStop(1, 'rgba(20,16,12,0)');
  context.fillStyle = topShade;
  context.fillRect(0, 0, 1080, topShadeEnd);

  const bottomShade = context.createLinearGradient(0, 940, 0, 1440);
  bottomShade.addColorStop(0, 'rgba(20,16,12,0)');
  bottomShade.addColorStop(1, `rgba(20,16,12,${portrait ? 0.58 : 0.42})`);
  context.fillStyle = bottomShade;
  context.fillRect(0, 940, 1080, 500);

  // ---- 文案排版（先算后画：暗衬范围依赖实际行数）----
  const copyTop = 430;
  const captionLimit = 1000;
  const captionGap = 84;
  const caption = await layoutCaption(context, input.emojiCaption, FAMILY_BODY, {
    maxWidth: COPY_WIDTH - 60,
    maxSize: 42,
    minSize: 28,
    lineHeightRatio: 1.3,
  });
  const fitted = await fitText(context, input.line, FAMILY_WENKAI, {
    maxWidth: COPY_WIDTH,
    maxLines: 5,
    maxSize: 132,
    minSize: 56,
    lineHeightRatio: 1.28,
    weight: 400,
    maxHeight: captionLimit - copyTop - (caption.lines.length ? captionGap + caption.height : 0),
  });

  // 人像背景：文案层下方铺一层柔和暗衬，浅色衣服/复杂人脸前也读得清
  if (portrait) {
    const copyBottom = copyTop + (fitted.lines.length - 1) * fitted.lineHeight;
    const captionBottom = caption.lines.length
      ? copyBottom + captionGap + (caption.lines.length - 1) * caption.lineHeight + caption.size
      : copyBottom;
    drawCopyScrim(context, 264, Math.min(1016, captionBottom + 36));
  }

  // ---- 眉头（品牌）----
  await drawText(
    context,
    'VICTORY · KPL WUYAN',
    COPY_MARGIN,
    148,
    `700 26px "Inter", "Noto Sans SC", sans-serif`,
    'rgba(255,255,255,0.92)'
  );

  // ---- 主文案：文楷白字 + 细描边（保证任何背景上可读），手绘引号点题 ----
  await drawQuoteMarks(context, COPY_MARGIN - 10, 316, 'rgba(255,255,255,0.85)');

  context.font = fitted.font;
  await document.fonts.load(fitted.font, input.line);
  fitted.lines.forEach((row, index) => {
    const baseline = copyTop + index * fitted.lineHeight;
    // 极轻落影 + 细描边：仅保证复杂背景上的可读性，不形成重影
    context.shadowColor = portrait ? 'rgba(16,12,9,0.45)' : 'rgba(20,16,12,0.35)';
    context.shadowBlur = portrait ? 16 : 10;
    context.shadowOffsetY = 2;
    context.fillStyle = WHITE;
    context.fillText(row, COPY_MARGIN, baseline);
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
  });

  // ---- 心情标语：引用线式（左侧竖线 + 白字），长句折行时竖线随整块伸缩 ----
  const copyBottom = copyTop + (fitted.lines.length - 1) * fitted.lineHeight;
  const captionTop = copyBottom + captionGap;
  if (caption.lines.length) {
    context.save();
    context.font = caption.font;
    await document.fonts.load(caption.font, caption.lines.join(''));
    context.fillStyle = 'rgba(255,255,255,0.94)';
    context.textBaseline = 'top';
    caption.lines.forEach((row, index) =>
      context.fillText(row, COPY_MARGIN + 26, captionTop + index * caption.lineHeight)
    );
    context.fillStyle = 'rgba(255,255,255,0.55)';
    context.fillRect(COPY_MARGIN, captionTop, 4, caption.height);
    context.restore();
  }

  // ---- 数据区 ----
  await drawStats(ctx, 1088);

  // // ---- 日期（右下，参考图样式）----
  // const today = formatDate(new Date());
  // const dateText = today.slice(5).replace('-', '.');
  // const dateFont = `600 76px "Inter", "Noto Sans SC", sans-serif`;
  // context.font = dateFont;
  // await document.fonts.load(dateFont, dateText);
  // context.fillStyle = 'rgba(255,255,255,0.95)';
  // context.textAlign = 'right';
  // context.fillText(dateText, 988, 1156);
  // context.font = `400 26px ${FAMILY_BODY}`;
  // await document.fonts.load(`400 26px ${FAMILY_BODY}`, '星期一');
  // const weekday = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', weekday: 'short' }).format(new Date());
  // context.fillText(`(${weekday})`, 988, 1198);
  // context.textAlign = 'left';

  // ---- QR + 页脚 ----
  if (input.showQr !== false) {
    const qr = await buildQrImage(QRCODE_DARK, QRCODE_LIGHT);
    drawQrFramed(context, qr, {
      x: 856,
      y: 1236,
      size: 168,
      frameFill: '#FFFFFF',
      radius: 10,
    });
    await drawText(
      context,
      '扫码接收胜利信号',
      940,
      1220,
      `500 22px ${FAMILY_BODY}`,
      'rgba(255,255,255,0.85)',
      'center'
    );
  }

  const footerColor = 'rgba(255,255,255,0.78)';
  await drawRuns(
    context,
    [
      { text: dateLabel, font: `500 24px "JetBrains Mono", "Noto Sans SC", monospace`, color: footerColor },
      { text: ' · KPL无言应援信号站', font: `500 24px ${FAMILY_BODY}`, color: footerColor },
    ],
    92,
    1404
  );
}

export const posterTemplate: CardTemplate = {
  id: 'poster',
  name: '大字报',
  draw,
};
