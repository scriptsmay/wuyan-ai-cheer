import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  // harmonyos-sans-sc-webfont-splitted 的 package.json exports 仅暴露全量
  // index.css，这里用别名直接指向 Medium 字重的样式文件，绕过 exports 限制，
  // 让 Vite 正常打包该样式引用的 woff2 子集（与 @fontsource 处理方式一致）。
  resolve: {
    alias: {
      'harmonyos-sans-sc-webfont-splitted/dist/Medium.css': fileURLToPath(
        new URL(
          './node_modules/harmonyos-sans-sc-webfont-splitted/dist/Medium.css',
          import.meta.url,
        ),
      ),
    },
  },
  build: {
    target: 'es2020',
    sourcemap: true
  },
  server: {
    port: 5173,
    strictPort: true
  },
  preview: {
    port: 4173,
    strictPort: true
  }
})
