<script setup lang="ts">
import { ShieldCheck, X } from 'lucide-vue-next'

defineProps<{ open: boolean }>()
defineEmits<{ accept: [] }>()
</script>

<template>
  <div v-if="open" class="privacy-backdrop" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
    <section class="privacy-panel">
      <button class="icon-button privacy-close" type="button" aria-label="同意并关闭" @click="$emit('accept')">
        <X :size="20" />
      </button>
      <span class="eyebrow"><ShieldCheck :size="18" /> 使用前说明</span>
      <h2 id="privacy-title">留下应援，不留下你的信息</h2>
      <p>应用会保存匿名会话标识、每日打卡记录，以及用于安全追溯的 AI 输入摘要与输出，正常保留 30 天。</p>
      <ul>
        <li>不采集真实姓名、手机号或账号数据。</li>
        <li>设备标识只用于连续打卡、限流和安全日志。</li>
        <li>图片在当前浏览器生成，不上传个人相册。</li>
      </ul>
      <button class="primary-button wide" type="button" @click="$emit('accept')">了解并开始</button>
    </section>
  </div>
</template>
