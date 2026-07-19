---
author: agent
status: draft
title: 应援图片二维码显示开关设计
---

# 应援图片二维码显示开关设计

## 背景

wuyan-ai-cheer 的应援卡图片生成目前始终在右下角嵌入二维码（指向 `/cheer` 页面）。用户希望在 UI 中增加一个开关，允许在生成图片时选择不包含二维码。

## 需求

1. 在应援卡预览区域增加一个 Toggle 开关，控制二维码的显示/隐藏
2. 开关默认开启（显示二维码），与当前行为一致
3. 切换开关后自动重新合成图片
4. 隐藏二维码时，右上角 QR 位置留空，不影响其他元素位置

## 改动范围

### 1. `src/lib/card-renderer.ts`

- `CardInput` 接口新增 `showQr?: boolean` 字段（默认 `true`）
- `renderCheerCard` 将 `showQr` 传递给 `drawFooter`
- `drawFooter` 中条件执行 QR 码生成与绘制逻辑：
  - `input.showQr !== false` 时生成并绘制 QR 码
  - 无论 QR 显示与否，下方的「生成日期」和「AI 生成」文本始终渲染

### 2. `src/components/CheerResultPanel.vue`

- 新增 `showQr` ref，初始值为 `true`
- 在 `.card-image-wrap` 图片下方、下载按钮上方，插入 Toggle 开关
- Toggle 开关样式与现有暗色 neon 主题一致：
  - 开启：`var(--primary)`（`#00D4FF`）背景
  - 关闭：`var(--line)`（`#24435A`）背景
  - 滑块：纯白圆形
- 切换开关时自动调用 `handleRender()` 重新合成图片

## 不包含的内容

- 不改变二维码的内容和样式
- 不调整隐藏 QR 后的布局
- 不改动其他视图或组件