import type { CardInput, CardTemplate, TemplateContext } from '../types';
import {
  FAMILY_HAND,
  buildQrImage,
  drawQrFramed,
  drawText,
  drawRuns,
  layoutCaption,
  loadImage,
} from '../shared';

/* 应援 · victory 大字报：摄影背景 + 心情标语 + 手绘感框线（柔和版） */

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

interface PosterLayout {
  /** 心情标语顶部锚定 y：原数据区位置，数据区移除后标语下移到此贴近底部 */
  statsY: number;
  captionMaxSize: number;
  captionMinSize: number;
}

const LANDSCAPE_LAYOUT: PosterLayout = {
  statsY: 1088,
  captionMaxSize: 42,
  captionMinSize: 28,
};

/**
 * 选手相片版式：心情标语锚定到原数据区位置（贴近底部），字号再降一档。
 */
const PORTRAIT_LAYOUT: PosterLayout = {
  statsY: 1290,
  captionMaxSize: 28,
  captionMinSize: 20,
};

interface LoadedPosterBg {
  image: HTMLImageElement | null;
  bg: PosterBg;
  /** 是否使用「选手相片」素材：决定人像/风景版式 */
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

async function draw(ctx: TemplateContext): Promise<void> {
  const { ctx: context, input, dateLabel } = ctx;
  const { image, bg, portrait } = await resolvePosterBg(input);
  const layout = portrait ? PORTRAIT_LAYOUT : LANDSCAPE_LAYOUT;

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

  // 顶部渐变压暗：保眉头可读；底部轻压暗：保页脚可读
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

  // ---- 心情标语排版（数据区移除后锚定到原数据区位置，贴近底部）----
  // 中文小字用 FAMILY_HAND：服务端 fonts 注入时可吃手写体（FAMILY_BODY 无占位名，注入无效）
  const caption = await layoutCaption(context, input.emojiCaption, FAMILY_HAND, {
    maxWidth: COPY_WIDTH - 60,
    maxSize: layout.captionMaxSize,
    minSize: layout.captionMinSize,
    lineHeightRatio: 1.3,
  });
  const captionTop = layout.statsY;

  // ---- 眉头（品牌）----
  await drawText(
    context,
    'VICTORY · KPL WUYAN',
    COPY_MARGIN,
    148,
    `700 26px "Inter", "Noto Sans SC", sans-serif`,
    'rgba(255,255,255,0.92)'
  );

  // ---- 心情标语：引用线式（左侧竖线 + 白字），长句折行时竖线随整块伸缩 ----
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
      `500 22px ${FAMILY_HAND}`,
      'rgba(255,255,255,0.85)',
      'center'
    );
  }

  const footerColor = 'rgba(255,255,255,0.78)';
  await drawRuns(
    context,
    [
      { text: dateLabel, font: `500 24px "JetBrains Mono", "Noto Sans SC", monospace`, color: footerColor },
      { text: ' · KPL无言应援信号站', font: `500 24px ${FAMILY_HAND}`, color: footerColor },
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
