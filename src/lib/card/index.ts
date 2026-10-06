import { createRng } from './rng';
import { buildSeed, resolveTemplateId } from './selection';
import { CARD_HEIGHT, CARD_WIDTH, formatDate, resolveTheme } from './shared';
import { TEMPLATES } from './templates';
import type { CardInput, RenderedCard, TemplateContext } from './types';

export async function renderCheerCard(input: CardInput): Promise<RenderedCard> {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器不支持 Canvas 导出');

  const dateLabel = input.checkin?.date ?? formatDate(new Date());
  const selection = { hasCheckin: !!input.checkin, mood: input.mood, variant: input.variant, dateLabel };
  const templateId = input.templateId && TEMPLATES[input.templateId] ? input.templateId : resolveTemplateId(selection);
  const template = TEMPLATES[templateId];
  if (!template) throw new Error(`未知卡片模板：${templateId}`);

  const theme = resolveTheme(input.mood);
  const rng = createRng(`${buildSeed(selection)}|${templateId}`);
  const templateContext: TemplateContext = { ctx: context, input, rng, theme, dateLabel };

  await template.draw(templateContext);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('图片编码失败'))), 'image/png');
  });
  return {
    dataUrl: canvas.toDataURL('image/png'),
    blob,
    filename: `wuyan-cheer-${formatDate(new Date())}.png`,
  };
}
