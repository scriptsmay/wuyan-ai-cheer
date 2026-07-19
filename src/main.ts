import '@fontsource/noto-sans-sc/chinese-simplified-400.css'
import '@fontsource/noto-sans-sc/chinese-simplified-500.css'
import '@fontsource/noto-sans-sc/chinese-simplified-700.css'
import '@fontsource/noto-sans-sc/latin-400.css'
import '@fontsource/noto-sans-sc/latin-500.css'
import '@fontsource/noto-sans-sc/latin-700.css'
import '@fontsource/zcool-qingke-huangyou/chinese-simplified-400.css'
import '@fontsource/zcool-qingke-huangyou/latin-400.css'
// 卡片图片生成器专用字体（按字体展示方案引入）
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
// HarmonyOS Sans SC Medium（副标题）。该包按字形区间拆分为多子集，
// 浏览器仅在渲染时按需拉取对应子集，不会一次性下载全部字形。
// 注：原包的 exports 仅暴露全量 index.css，这里改用本地裁剪后的
// Medium 字重样式（woff2 仍引用 node_modules 内文件，不额外提交二进制）。
import './styles/harmonyos-medium.css'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './styles/tokens.css'
import './styles/base.css'

createApp(App).use(router).mount('#app')
