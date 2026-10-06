import type { CheerRef, Checkin, Mood } from '../../types';
import type { CardRng } from './rng';
import type { TemplateId } from './selection';
/**
 * 心情主题色：不同 mood 切换主强调色 primary 与辅色 secondary。
 * 与 web UI 的 mood tokens（tokens.css）保持一致；深色模板（signal）上做过
 * 可读性微调（例如 low 的紫色提亮到 #B49BE8）。浅色模板可自行派生印刷友好色。
 * onAccent 用于 pill 等实色块上的文字色。
 */
export interface CardTheme {
  primary: string;
  primaryRgb: string; // "r,g,b"，用于生成半透明结构色
  secondary: string;
  onAccent: string;
}

export interface CardInput {
  line: string;
  emojiCaption: string;
  refs: CheerRef[];
  sourceSnapshotAt: string;
  checkin?: Checkin;
  showQr?: boolean;
  showRefs?: boolean;
  // 心情，用于选取主题色与主模板；缺省按 daily
  mood?: Mood;
  // 换一换计数：同一天内主动换样式时递增，参与种子派生
  variant?: number;
  // 强制指定模板（dev 预览页用；生产 UI 不传，走种子选择）
  templateId?: TemplateId;
}

export interface RenderedCard {
  dataUrl: string;
  blob: Blob;
  filename: string;
}

export interface TemplateContext {
  ctx: CanvasRenderingContext2D;
  input: CardInput;
  rng: CardRng;
  theme: CardTheme;
  /** 卡片展示日期（打卡卡取 checkin.date，应援卡取当天），YYYY-MM-DD */
  dateLabel: string;
}

export interface CardTemplate {
  id: TemplateId;
  name: string;
  draw(context: TemplateContext): Promise<void>;
}
