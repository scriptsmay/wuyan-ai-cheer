<script setup lang="ts">
import { Radio, ShieldCheck } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="app-frame">
    <div class="ambient-grid" aria-hidden="true" />
    <header class="site-header">
      <RouterLink class="brand-lockup" to="/" aria-label="返回首页">
        <span class="brand-mark"><Radio :size="22" /></span>
        <span>
          <strong>无言应援信号站</strong>
          <small>WUYAN FAN SIGNAL</small>
        </span>
      </RouterLink>
      <nav aria-label="主导航">
        <RouterLink :class="{ active: route.name === 'cheer' }" to="/cheer">生成应援</RouterLink>
        <RouterLink :class="{ active: route.name === 'secretary' }" to="/secretary">智能问答</RouterLink>
        <RouterLink :class="{ active: route.name === 'checkin' }" to="/checkin">每日打卡</RouterLink>
      </nav>
      <span class="security-chip"><ShieldCheck :size="15" /> 匿名会话</span>
    </header>

    <main>
      <slot />
    </main>

    <footer class="site-footer">
      <span>AI 生成内容仅用于粉丝应援，请理性表达。</span>
      <span>图片与文案由用户自主保存发布</span>
    </footer>
  </div>
</template>
