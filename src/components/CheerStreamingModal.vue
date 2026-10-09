<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Sparkles, ChevronDown, ChevronUp, X, Loader2 } from 'lucide-vue-next';
import type { CheerResult } from '../types';

interface Props {
  isOpen: boolean;
  mood: string;
  isLoading?: boolean;
  retryMessage?: string;
  thinkingText?: string;
  streamingText?: string;
  isComplete?: boolean;
  result?: CheerResult | null;
  errorMessage?: string;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  retryMessage: '',
  thinkingText: '',
  streamingText: '',
  isComplete: false,
  result: null,
  errorMessage: '',
});

const emit = defineEmits<{
  close: [];
}>();

const showThinking = ref(false);

const thinkingLines = computed(() => {
  if (!props.thinkingText) return [];
  // 清理多余的 { 符号并分割成行
  const cleaned = props.thinkingText.replace(/\{/g, '').replace(/\}/g, '');
  return cleaned.split('\n').filter((line: string) => line.trim());
});

const displayLines = computed(() => {
  if (!props.streamingText) return [];
  // 清理多余的 { 符号并分割成行
  const cleaned = props.streamingText.replace(/\{/g, '').replace(/\}/g, '');
  return cleaned.split('\n').filter((line: string) => line.trim());
});

const showCompleteButton = computed(() => props.isComplete && props.result);

function handleClose() {
  if (!props.isLoading) {
    emit('close');
  }
}

onMounted(() => {
  // ESC 键关闭
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.isOpen && !props.isLoading) {
      handleClose();
    }
  };
  window.addEventListener('keydown', handleEscape);
  return () => window.removeEventListener('keydown', handleEscape);
});
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="handleClose">
      <div class="modal-container" role="dialog" aria-modal="true">
        <!-- 头部 -->
        <header class="modal-header">
          <div class="header-left">
            <Sparkles :size="20" class="sparkle-icon" />
            <span class="header-title">AI 应援文案生成中</span>
          </div>
          <button v-if="!isLoading" class="close-button" type="button" aria-label="关闭" @click="handleClose">
            <X :size="20" />
          </button>
          <span v-else class="connecting-indicator">
            <Loader2 :size="16" class="spin" />
            正在建立连接...
          </span>
        </header>

        <!-- 内容区 -->
        <div class="modal-body">
          <!-- 思考过程区 -->
          <div v-if="thinkingText || retryMessage" class="thinking-section">
            <button type="button" class="thinking-toggle" @click="showThinking = !showThinking">
              <span class="thinking-label">
                <span class="thinking-dot" />
                AI 构思中...
              </span>
              <span class="toggle-hint">
                {{ showThinking ? '收起' : '展开' }}
                <ChevronDown v-if="!showThinking" :size="16" />
                <ChevronUp v-else :size="16" />
              </span>
            </button>

            <!-- 重试提示 -->
            <div v-if="retryMessage" class="retry-message">
              {{ retryMessage }}
            </div>

            <!-- 思考内容折叠区 -->
            <Transition name="thinking-expand">
              <div v-if="showThinking" class="thinking-content">
                <p v-for="(line, idx) in thinkingLines" :key="idx" class="thinking-line">
                  {{ line }}
                </p>
              </div>
            </Transition>
          </div>

          <!-- 打字机输出区 -->
          <div class="typewriter-section">
            <div class="typewriter-lines">
              <p v-for="(line, idx) in displayLines" :key="idx" class="typewriter-line">
                {{ line }}
                <span v-if="idx === displayLines.length - 1 && isLoading" class="cursor">|</span>
              </p>
            </div>

            <!-- 完成态提示 -->
            <Transition name="complete-fade">
              <div v-if="isComplete" class="complete-badge">
                <Sparkles :size="16" />
                <span>应援文案生成完毕</span>
              </div>
            </Transition>
          </div>

          <!-- 错误信息 -->
          <div v-if="errorMessage" class="error-section">
            <p class="error-message">{{ errorMessage }}</p>
          </div>
        </div>

        <!-- 底部操作区 -->
        <footer class="modal-footer">
          <button v-if="showCompleteButton" type="button" class="primary-button complete-button" @click="handleClose">
            查看完整文案
          </button>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: var(--overlay);
  backdrop-filter: blur(14px) saturate(1.2);
  animation: overlay-in 0.2s ease-out;
}

@keyframes overlay-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-container {
  width: 90%;
  max-width: 640px;
  max-height: 80vh;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 1px 0 var(--inset-highlight) inset,
    var(--shadow-float);
  animation: modal-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--line-soft);
  background: color-mix(in srgb, var(--primary) 7%, transparent);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sparkle-icon {
  color: var(--secondary);
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--secondary) 55%, transparent));
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: 0.02em;
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  background: var(--card-strong);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.close-button:hover {
  color: var(--text);
  border-color: var(--primary);
  transform: scale(1.05);
}

.connecting-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--secondary);
  font-size: 14px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

/* 思考区 */
.thinking-section {
  margin-bottom: 20px;
}

.thinking-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  background: color-mix(in srgb, var(--primary) 5%, transparent);
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.thinking-toggle:hover {
  background: color-mix(in srgb, var(--primary) 9%, transparent);
  border-color: var(--line);
}

.thinking-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.thinking-dot {
  width: 6px;
  height: 6px;
  background: var(--secondary);
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

.toggle-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  opacity: 0.7;
}

.retry-message {
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--secondary) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--secondary) 32%, transparent);
  color: var(--secondary);
  font-size: 14px;
}

.thinking-content {
  margin-top: 12px;
  padding: 16px;
  border-radius: 10px;
  background: var(--bg);
  border: 1px solid var(--line-soft);
}

.thinking-line {
  margin: 0;
  padding: 4px 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
  border-bottom: 1px solid var(--hairline);
}

.thinking-line:last-child {
  border-bottom: none;
}

/* 打字机区 */
.typewriter-section {
  position: relative;
  padding: 24px;
  border-radius: 16px;
  background: var(--bg);
  border: 1px solid var(--line-soft);
  min-height: 200px;
}

.typewriter-lines {
  font-size: 15px;
  line-height: 1.8;
  color: var(--text);
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
}

.typewriter-line {
  margin: 0;
  padding: 4px 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
}

.cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: linear-gradient(180deg, var(--secondary) 0%, var(--primary) 100%);
  margin-left: 2px;
  animation: blink 1s step-end infinite;
  vertical-align: text-bottom;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.complete-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--success) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--success) 30%, transparent);
  color: var(--success);
  font-size: 14px;
  font-weight: 500;
}

/* 错误区 */
.error-section {
  margin-top: 16px;
  padding: 16px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
}

.error-message {
  margin: 0;
  color: var(--danger);
  font-size: 14px;
}

/* 底部 */
.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--line-soft);
  background: color-mix(in srgb, var(--primary) 5%, transparent);
}

.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 14px 24px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: linear-gradient(135deg, var(--primary-soft) 0%, var(--primary) 100%);
  color: var(--on-primary);
  box-shadow: var(--glow-btn);
}

.primary-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 26px color-mix(in srgb, var(--primary) 45%, transparent);
}

.primary-button:active {
  transform: translateY(0);
}

/* 动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-container {
  animation: modal-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-leave-active .modal-container {
  animation: modal-out 0.2s ease-in;
}

@keyframes modal-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

.thinking-expand-enter-active,
.thinking-expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.thinking-expand-enter-from,
.thinking-expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.thinking-expand-enter-to,
.thinking-expand-leave-from {
  opacity: 1;
  max-height: 500px;
}

.complete-fade-enter-active {
  animation: complete-in 0.3s ease-out;
}

@keyframes complete-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 响应式 */
@media (max-width: 480px) {
  .modal-container {
    width: 95%;
    max-height: 90vh;
    border-radius: 16px;
  }

  .modal-header {
    padding: 16px 20px;
  }

  .modal-body {
    padding: 20px;
  }

  .typewriter-section {
    padding: 16px;
    min-height: 150px;
  }
}
</style>
