// 渲染宿主：仅供服务端无头浏览器出卡，不加载 Vue App。
// 引入与卡片渲染器相同的字体集，暴露 window.__wuyanRender 供 browserless 调页执行。
// 字体按需加载由 renderCheerCard 内部的 document.fonts.load 触发，此处只需声明 @font-face。
import '@fontsource/noto-sans-sc/chinese-simplified-400.css';
import '@fontsource/noto-sans-sc/chinese-simplified-500.css';
import '@fontsource/noto-sans-sc/chinese-simplified-700.css';
import '@fontsource/noto-sans-sc/latin-400.css';
import '@fontsource/noto-sans-sc/latin-500.css';
import '@fontsource/noto-sans-sc/latin-700.css';
import '@fontsource/zcool-qingke-huangyou/chinese-simplified-400.css';
import '@fontsource/zcool-qingke-huangyou/latin-400.css';
import 'lxgw-wenkai-screen-webfont/lxgwwenkaiscreen.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import 'harmonyos-sans-sc-webfont-splitted/dist/Medium.css';
import { renderCheerCard } from './lib/card';
import type { CardInput, RenderedCard } from './lib/card/types';

declare global {
  interface Window {
    __wuyanRender?: (input: CardInput) => Promise<RenderedCard>;
  }
}

window.__wuyanRender = renderCheerCard;
