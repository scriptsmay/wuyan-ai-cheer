import type { CardTemplate, TemplateContext } from '../types';
import { selectVisibleRefs } from '../selection';
import {
  FAMILY_BODY,
  FAMILY_WENKAI,
  buildQrImage,
  dayOfYear,
  drawGrain,
  drawQrFramed,
  drawText,
  drawRuns,
  fitText,
  formatDate,
  roundRectPath,
  strokeText,
} from '../shared';

/* 应援 · daily 杂志留白风：米白底 + 细线框 + 大留白排版 + 单点缀色 */

const PAPERS = ['#F5F3EE', '#F7F5F0', '#F2F0EA'];
const ACCENTS = ['#C25E00', '#B4232A', '#23608F', '#2E7D4F'];
const INK = '#1C1C1C';

async function draw(ctx: TemplateContext): Promise<void> {
  const { ctx: context, rng, input, dateLabel } = ctx;
  const accent = rng.pick(ACCENTS);

  context.fillStyle = rng.pick(PAPERS);
  context.fillRect(0, 0, 1080, 1440);
  drawGrain(context, rng, { density: 900, alpha: 0.03, colors: ['#7a7264'] });

  // 细线框
  context.save();
  context.strokeStyle = 'rgba(26,26,26,0.65)';
  context.lineWidth = 1.5;
  context.strokeRect(56, 56, 1080 - 112, 1440 - 112);
  context.restore();

  // 巨型刊号水印（描边空心字）
  const issue = dayOfYear(dateLabel);
  await strokeText(
    context,
    `N°${issue}`,
    990,
    400,
    `800 200px "Inter", "Noto Sans SC", sans-serif`,
    'rgba(26,26,26,0.08)',
    2,
    'right'
  );

  // 刊头
  await drawText(context, 'WUYAN CHEER JOURNAL', 110, 152, `700 36px "Inter", "Noto Sans SC", sans-serif`, INK);
  await drawText(
    context,
    `VOL.${issue}`,
    970,
    150,
    `500 24px "JetBrains Mono", "Noto Sans SC", monospace`,
    'rgba(26,26,26,0.55)',
    'right'
  );
  context.strokeStyle = 'rgba(26,26,26,0.75)';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(110, 192);
  context.lineTo(970, 192);
  context.stroke();
  context.fillStyle = accent;
  context.fillRect(110, 188, 128, 6);

  // 眉头
  await drawText(context, '日常应援 · DAILY SIGNAL', 110, 282, `500 24px ${FAMILY_BODY}`, 'rgba(26,26,26,0.55)');
  context.fillStyle = accent;
  context.fillRect(110, 306, 26, 26);

  // 主文案：霞鹜文楷，大留白排版
  const copyTop = 436;
  const fitted = await fitText(context, input.line, FAMILY_WENKAI, {
    maxWidth: 860,
    maxLines: 6,
    maxSize: 88,
    minSize: 50,
    lineHeightRatio: 1.38,
  });
  context.font = fitted.font;
  context.fillStyle = INK;
  fitted.lines.forEach((row, index) => context.fillText(row, 110, copyTop + index * fitted.lineHeight));

  // 心情标语：细线框标签
  const copyBottom = copyTop + (fitted.lines.length - 1) * fitted.lineHeight;
  if (input.emojiCaption) {
    const font = `500 30px ${FAMILY_BODY}`;
    context.font = font;
    await document.fonts.load(font, input.emojiCaption);
    const tw = context.measureText(input.emojiCaption).width;
    const padX = 24;
    const h = 58;
    const captionGap = fitted.lines.length >= 5 ? 48 : 64;
    const top = Math.min(copyBottom + captionGap, 980);
    context.strokeStyle = accent;
    context.lineWidth = 1.5;
    roundRectPath(context, 110, top, tw + padX * 2, h, 6);
    context.stroke();
    context.fillStyle = INK;
    context.fillText(input.emojiCaption, 110 + padX, top + h / 2 + 10);
  }

  // 赛季数据：细分隔线 + 双列
  if (input.showRefs !== false && input.refs.length) {
    context.strokeStyle = 'rgba(26,26,26,0.6)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(110, 1074);
    context.lineTo(970, 1074);
    context.stroke();
    const visible = selectVisibleRefs(input.refs, rng, 2);
    for (const [i, ref] of visible.entries()) {
      const x = 110 + i * 450;
      await drawText(context, ref.label.toUpperCase(), x, 1128, `500 22px ${FAMILY_BODY}`, 'rgba(26,26,26,0.5)');
      const valueFont = `700 60px "JetBrains Mono", "Noto Sans SC", monospace`;
      context.font = valueFont;
      await document.fonts.load(valueFont, ref.value);
      context.fillStyle = i === 0 ? accent : INK;
      context.fillText(ref.value, x, 1196);
    }
  }

  // QR：细线白卡
  if (input.showQr !== false) {
    const qr = await buildQrImage('#1C1C1CFF', '#FFFFFFFE');
    drawQrFramed(context, qr, {
      x: 824,
      y: 1268,
      size: 148,
      frameFill: '#FFFFFF',
      frameStroke: 'rgba(26,26,26,0.4)',
      radius: 6,
    });
    await drawText(
      context,
      'SCAN · CHEER',
      898,
      1252,
      `500 17px "JetBrains Mono", "Noto Sans SC", monospace`,
      'rgba(26,26,26,0.5)',
      'center'
    );
  }

  // 页脚
  const today = formatDate(new Date());
  await drawRuns(
    context,
    [
      { text: 'KPL无言应援信号站', font: `500 22px ${FAMILY_BODY}`, color: 'rgba(26,26,26,0.6)' },
      {
        text: ` · ${today}`,
        font: `500 20px "JetBrains Mono", "Noto Sans SC", monospace`,
        color: 'rgba(26,26,26,0.45)',
      },
    ],
    110,
    1372
  );
}

export const magazineTemplate: CardTemplate = {
  id: 'magazine',
  name: '杂志留白',
  draw,
};
