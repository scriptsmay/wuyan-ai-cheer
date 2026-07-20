import '@fontsource/noto-sans-sc/chinese-simplified-400.css'
import '@fontsource/noto-sans-sc/chinese-simplified-500.css'
import '@fontsource/noto-sans-sc/chinese-simplified-700.css'
import '@fontsource/noto-sans-sc/latin-400.css'
import '@fontsource/noto-sans-sc/latin-500.css'
import '@fontsource/noto-sans-sc/latin-700.css'
import '@fontsource/zcool-qingke-huangyou/chinese-simplified-400.css'
import '@fontsource/zcool-qingke-huangyou/latin-400.css'
// 霞鹜文楷屏幕版（LXGW WenKai Screen，主文案正文）。仅引入 screen 常规子集 CSS，
// 该包按 unicode-range 拆分为 97 个子集，运行时仅按需拉取用到的字形块。
// （注意：不要引聚合的 style.css，它还会额外拉入 gb / r 变体）
import 'lxgw-wenkai-screen-webfont/lxgwwenkaiscreen.css'
// 卡片图片生成器专用字体（按字体展示方案引入）
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
// HarmonyOS Sans SC Medium（副标题）。该包按字形区间拆分为多子集，
// 浏览器仅在渲染时按需拉取对应子集，不会一次性下载全部字形。
// （经 vite.config.ts 别名绕过该包 exports 限制，仅引入 Medium 字重）
import 'harmonyos-sans-sc-webfont-splitted/dist/Medium.css'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './styles/tokens.css'
import './styles/base.css'

createApp(App).use(router).mount('#app')
