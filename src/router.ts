import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/cheer', name: 'cheer', component: () => import('./views/CheerView.vue') },
    { path: '/secretary', name: 'secretary', component: () => import('./views/SecretaryView.vue') },
    { path: '/checkin', name: 'checkin', component: () => import('./views/CheckinView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

// 仅 dev 构建注册模板预览页（生产树摇掉，不暴露入口）
if (import.meta.env.DEV) {
  router.addRoute({
    path: '/preview/cards',
    name: 'card-preview',
    component: () => import('./views/CardPreviewView.vue'),
  });
}
