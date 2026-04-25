<template>
  <header class="top-nav">
    <!-- 左侧：Logo -->
    <div class="nav-left">
      <div class="logo-area">
        <div class="company-logo">
          <svg class="logo-svg" viewBox="0 0 120 120">
            <rect x="4" y="4" width="112" height="112" rx="20" fill="#2a7ab8"/>
            <path d="M16 48 C28 56, 40 40, 60 40 C80 40, 92 52, 104 46" stroke="white" stroke-width="5" fill="none" stroke-linecap="round"/>
            <path d="M12 65 C26 75, 44 55, 64 55 C84 55, 96 72, 108 65" stroke="white" stroke-width="5" fill="none" stroke-linecap="round"/>
            <path d="M14 82 C26 90, 44 70, 64 70 C84 70, 96 86, 106 80" stroke="white" stroke-width="5" fill="none" stroke-linecap="round"/>
          </svg>
        </div>
        <h1 class="system-title">厂部设备管理平台</h1>
      </div>

      <!-- 功能导航菜单 -->
      <nav class="menu-nav">
        <div
          v-for="item in navItems"
          :key="item.name"
          class="menu-item"
          :class="{ active: activeNav === item.name }"
          @click="handleNavClick(item)"
        >
          <span class="menu-icon">{{ item.icon }}</span>
          <span class="menu-text">{{ item.name }}</span>
        </div>
      </nav>
    </div>

    <!-- 右侧：消息 + 用户 + 退出 -->
    <div class="nav-right">
      <!-- 用户信息 -->
      <div class="user-info">
        <div class="user-avatar">{{ currentUser.avatar }}</div>
        <div class="user-detail">
          <span class="user-name">{{ currentUser.name }}</span>
          <span class="user-role">{{ currentUser.role }}</span>
        </div>
      </div>

      <!-- 退出登录 -->
      <button class="logout-btn" @click="handleLogout">
        <span>退出</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { currentUser } from '../composables/useDeviceStore'

const router = useRouter()
const route = useRoute()

// currentUser 来自 useDeviceStore，登录时由 LoginView 调用 setCurrentUser 更新

const navItems = ref([
  { name: '驾驶舱', path: '/main', icon: '🚀' },
  { name: '设备管理', path: '/device/inuse', icon: '🖥️' },
  { name: '巡检保养', path: '/inspection', icon: '🔍' },
  { name: '备件仓库', path: '/spareparts', icon: '📦' },
  { name: '带班交接', path: '/handover', icon: '🔄' },
  { name: '维修工单', path: '/workorder', icon: '🔧' },
  { name: '设备价值', path: '/asset', icon: '💰' },
  { name: '系统管理', path: '/admin', icon: '⚙️' }
])

const activeNav = ref('')
const pathToName: Record<string, string> = {
  '/spareparts': '备件仓库',
  '/device/inuse': '设备管理',
  '/device/warning': '设备管理',
  '/device/maintenance': '设备管理',
  '/device/changes': '设备管理',
  '/inspection': '巡检保养',
  '/main': '驾驶舱',
  '/dashboard': '驾驶舱',
  '/workorder': '维修工单'
}
activeNav.value = pathToName[route.path] || '设备管理'

function handleNavClick(item: any) {
  activeNav.value = item.name
  router.push(item.path)
}

function handleLogout() {
  router.push('/')
}
</script>

<style scoped>
.top-nav {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0;
  height: 64px;
  background: rgba(15, 50, 80, 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(45, 212, 191, 0.2);
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 32px;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.company-logo {
  display: flex;
  align-items: center;
  justify-content: center;
}

.company-logo .logo-svg {
  width: 36px;
  height: 36px;
  border-radius: 8px;
}

.system-title {
  font-size: 17px;
  font-weight: 600;
  color: #fff;
  margin: 0;
  letter-spacing: 1px;
}

.menu-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 64px;
  overflow-x: auto;
  flex-shrink: 0;
}

.menu-nav::-webkit-scrollbar {
  height: 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: rgba(255, 255, 255, 0.65);
  font-size: 14px;
  font-weight: 500;
  height: 40px;
  position: relative;
}

.menu-item:hover {
  background: rgba(45, 212, 191, 0.12);
  color: rgba(255, 255, 255, 0.9);
}

.menu-item.active {
  color: #2DD4BF;
  background: rgba(45, 212, 191, 0.15);
}

.menu-item.active::after {
  content: '';
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 3px;
  background: #2DD4BF;
  border-radius: 2px 2px 0 0;
}

.menu-icon {
  font-size: 15px;
  line-height: 1;
  vertical-align: middle;
}

.menu-text {
  white-space: nowrap;
  line-height: 1;
  vertical-align: middle;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(45, 212, 191, 0.25);
  color: #2DD4BF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}

.user-detail {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.user-name {
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}

.user-role {
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
}

.logout-btn {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #FCA5A5;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}
</style>
