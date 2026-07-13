<script setup lang="ts">
import { ArrowUpRight, Bot, CalendarCheck, RadioTower } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="home-hero page-section">
    <div class="hero-copy">
      <span class="eyebrow"><RadioTower :size="18" /> FAN SIGNAL / ONLINE</span>
      <h1>把想说的话，<br /><em>变成一张有信号的应援卡。</em></h1>
      <p>选择心情，生成基于真实赛季快照的应援文案；问问小秘书，获取赛事数据；保存图片后，由你自由分享微博、微信或粉丝群。</p>
      <div class="hero-meta">
        <span><b>3</b> 个功能</span>
        <span><b>1080 × 1440</b> PNG</span>
        <span><b>每日一次</b> 加油打卡</span>
      </div>
    </div>

    <div class="route-stack">
      <RouterLink class="route-card route-card-cheer" to="/cheer">
        <span class="route-index">01</span>
        <RadioTower :size="34" />
        <div><strong>生成应援信号</strong><small>四种心情 · AI 文案 · 轻量应援卡</small></div>
        <ArrowUpRight :size="24" />
      </RouterLink>
      <RouterLink class="route-card route-card-secretary" to="/secretary">
        <span class="route-index">02</span>
        <Bot :size="34" />
        <div><strong>智能问答</strong><small>AI 小秘书 · 赛事数据查询</small></div>
        <ArrowUpRight :size="24" />
      </RouterLink>
      <RouterLink class="route-card route-card-checkin" to="/checkin">
        <span class="route-index">03</span>
        <CalendarCheck :size="34" />
        <div><strong>完成每日加油</strong><small>同一匿名身份每日一次 · 连续天数</small></div>
        <ArrowUpRight :size="24" />
      </RouterLink>
    </div>
  </section>

  <!-- <section class="signal-manifesto page-section">
    <span>NO AUTO-POSTING</span>
  </section> -->
</template>
