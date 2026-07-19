<script setup lang="ts">
import { computed, ref } from 'vue';
import { LogIn, LogOut, ShieldCheck, X } from 'lucide-vue-next';
import { completeAuthTransfer, startAuthTransfer } from '../lib/api';
import { getAuthSnapshot, signInWithPassword, signOut } from '../lib/cloudbase';

const props = defineProps<{
  open: boolean;
  mode: 'anonymous' | 'authenticated' | 'signed-out';
  username: string;
}>();
const emit = defineEmits<{ close: []; changed: [] }>();
const loginUsername = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');
const statusMessage = ref('');
const isAuthenticated = computed(() => props.mode === 'authenticated');

async function submit() {
  if (!loginUsername.value.trim() || !password.value) {
    errorMessage.value = '请输入用户名和密码';
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  statusMessage.value = '正在准备跨端同步…';
  try {
    const before = await getAuthSnapshot();
    const transfer =
      before.mode === 'anonymous' ? await startAuthTransfer() : null;
    await signInWithPassword(loginUsername.value.trim(), password.value);
    if (transfer) {
      statusMessage.value = '正在合并本端数据…';
      await completeAuthTransfer(transfer.ticket);
    }
    password.value = '';
    statusMessage.value = '登录成功，数据已同步';
    emit('changed');
    window.setTimeout(() => emit('close'), 500);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : '登录失败，请稍后重试';
    statusMessage.value = '';
  } finally {
    loading.value = false;
  }
}

async function logout() {
  loading.value = true;
  errorMessage.value = '';
  try {
    await signOut();
    emit('changed');
    emit('close');
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : '退出登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div
    v-if="open"
    class="auth-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="auth-title"
    @click.self="emit('close')"
  >
    <section class="auth-panel">
      <button
        class="icon-button auth-close"
        type="button"
        aria-label="关闭登录面板"
        @click="emit('close')"
      >
        <X :size="20" />
      </button>
      <span class="eyebrow"><ShieldCheck :size="18" /> 跨端同步</span>
      <h2 id="auth-title">
        {{ isAuthenticated ? '已登录同步账号' : '登录你的同步账号' }}
      </h2>
      <p v-if="isAuthenticated" class="auth-intro">
        当前账号
        <strong>{{ loginUsername || '正式用户' }}</strong> 已启用跨端同步。
      </p>
      <p v-else class="auth-intro">
        匿名使用无需登录。登录后，本端打卡和应援记录会迁移到管理员创建的账号。
      </p>

      <form v-if="!isAuthenticated" class="auth-form" @submit.prevent="submit">
        <label
          >用户名<input
            v-model="loginUsername"
            autocomplete="username"
            maxlength="64"
            placeholder="请输入用户名"
        /></label>
        <label
          >密码<input
            v-model="password"
            type="password"
            autocomplete="current-password"
            maxlength="128"
            placeholder="请输入密码"
        /></label>
        <button class="primary-button wide" type="submit" :disabled="loading">
          <LogIn :size="17" /> {{ loading ? '处理中…' : '登录并同步' }}
        </button>
      </form>
      <button
        v-else
        class="ghost-button wide"
        type="button"
        :disabled="loading"
        @click="logout"
      >
        <LogOut :size="17" /> 退出登录
      </button>
      <p v-if="statusMessage" class="auth-status">{{ statusMessage }}</p>
      <p v-if="errorMessage" class="auth-error" role="alert">
        {{ errorMessage }}
      </p>
      <small class="auth-note"
        >账号由管理员创建，不提供自助注册、手机号或短信登录。</small
      >
    </section>
  </div>
</template>
