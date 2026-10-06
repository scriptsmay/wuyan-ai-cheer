/**
 * 卡片渲染入口（薄转发层）。
 * 实现已模板族化：src/lib/card/ 下按「类型 × 心情 → 模板 + 种子随机」分发，
 * 本文件仅保留既有导出路径，调用方（CheerResultPanel 等）无需改动 import。
 */
export { CARD_HEIGHT, CARD_WIDTH } from './card/shared';
export { renderCheerCard } from './card';
export type { CardInput, RenderedCard } from './card/types';
