<script setup lang="ts">
import { LogIn, Radio, ShieldCheck, UserRound } from "lucide-vue-next";
import { RouterLink, useRoute } from "vue-router";
import { onMounted, onUnmounted, ref } from "vue";
import AuthDialog from "./AuthDialog.vue";
import {
  getAuthSnapshot,
  onAuthChange,
  type AuthMode,
} from "../lib/auth";

const route = useRoute();
const authOpen = ref(false);
const authMode = ref<AuthMode>("signed-out");
const authUsername = ref("");

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

function handleAuthChange() {
  void refreshAuth();
}

function handleAuthChanged() {
  window.location.reload();
}

let unsubAuth: (() => void) | undefined;

onMounted(() => {
  void refreshAuth();
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
    @close="authOpen = false"
    @changed="handleAuthChanged"
  />
</template>
