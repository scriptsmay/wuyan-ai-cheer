<script setup lang="ts">
import { LogIn, Radio, ShieldCheck, UserRound } from "lucide-vue-next";
import { RouterLink, useRoute } from "vue-router";
import { onMounted, onUnmounted, ref } from "vue";
import AuthDialog from "./AuthDialog.vue";
import { verifySession } from "../lib/api";
import {
  getAuthSnapshot,
  onAuthChange,
  type AuthMode,
  type AuthChangeReason,
} from "../lib/auth";

const route = useRoute();
const authOpen = ref(false);
const authMode = ref<AuthMode>("signed-out");
const authUsername = ref("");
const sessionExpired = ref(false);

async function refreshAuth() {
  try {
    const snapshot = await getAuthSnapshot();
    authMode.value = snapshot.mode;
    authUsername.value = snapshot.username;
  } catch {
    authMode.value = "signed-out";
    authUsername.value = "";
  }
}

/**
 * 初始化时主动向服务端验证 token 是否有效。
 * - 401: apiRequest 内部已调用 clearStoredAuth + emitAuthChange('expired')，
 *        事件监听器会自动刷新 UI 并弹出登录框，这里无需额外处理。
 * - 网络错误: 保持缓存的登录态，不因网络波动强制登出。
 * - 成功: 用服务端返回的用户名刷新本地缓存（防止 localStorage 过期数据）。
 */
async function initAuth() {
  await refreshAuth();
  if (authMode.value !== "authenticated") return;
  try {
    const result = await verifySession();
    if (result.username) authUsername.value = result.username;
  } catch {
    // 401 已由 apiRequest 处理；其他错误静默忽略，保持缓存状态
  }
}

function handleAuthChange(reason?: AuthChangeReason) {
  void refreshAuth();
  if (reason === "expired") {
    sessionExpired.value = true;
    authOpen.value = true;
  }
}

function handleAuthClose() {
  authOpen.value = false;
  sessionExpired.value = false;
}

function handleAuthChanged() {
  window.location.reload();
}

let unsubAuth: (() => void) | undefined;

onMounted(() => {
  void initAuth();
  unsubAuth = onAuthChange(handleAuthChange);
});
onUnmounted(() => unsubAuth?.());
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
        <RouterLink :class="{ active: route.name === 'cheer' }" to="/cheer">
          生成应援
        </RouterLink>
        <RouterLink
          :class="{ active: route.name === 'secretary' }"
          to="/secretary"
        >
          智能问答
        </RouterLink>
        <RouterLink :class="{ active: route.name === 'checkin' }" to="/checkin">
          每日打卡
        </RouterLink>
      </nav>
      <button
        class="security-chip auth-trigger"
        type="button"
        @click="authOpen = true"
      >
        <UserRound v-if="authMode === 'authenticated'" :size="15" />
        <ShieldCheck v-else :size="15" />
        {{
          authMode === "authenticated" ? authUsername || "已登录" : "登录账号"
        }}
        <LogIn v-if="authMode !== 'authenticated'" :size="14" />
      </button>
    </header>

    <main>
      <slot />
    </main>

    <footer class="site-footer">
      <span>AI 生成内容仅用于粉丝应援，请理性表达。</span>
      <span>图片与文案由用户自主保存发布</span>
    </footer>
  </div>
  <AuthDialog
    :open="authOpen"
    :mode="authMode"
    :username="authUsername"
    :expired="sessionExpired"
    @close="handleAuthClose"
    @changed="handleAuthChanged"
  />
</template>
