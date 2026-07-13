<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterView } from 'vue-router'
import AppShell from './components/AppShell.vue'
import PrivacyNotice from './components/PrivacyNotice.vue'

const privacyOpen = ref(false)

onMounted(() => {
  privacyOpen.value = localStorage.getItem('wuyan-privacy-accepted') !== '1'
})

function acceptPrivacy() {
  localStorage.setItem('wuyan-privacy-accepted', '1')
  privacyOpen.value = false
}
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
  <PrivacyNotice :open="privacyOpen" @accept="acceptPrivacy" />
</template>
