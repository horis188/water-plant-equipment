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

    <!-- 右侧：消息 + 用户 -->
    <div class="nav-right">
      <div class="user-info">
        <span class="user-name">{{ currentUser.name }}</span>
        <span class="user-role">{{ currentUser.role }}</span>
      </div>
      <button class="logout-btn" @click="handleLogout">退出</button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const currentUser = ref({ name: '张明', role: '运行班长' })

const navItems = ref([
  { name: '驾驶舱', path: '/main', icon: '🚀' },
  { name: '设备管理', path: '/device/inuse', icon: '🖥️' },
  { name: '设备巡检', path: '/inspection', icon: '🔍' },
  { name: '备件仓库', path: '/spareparts', icon: '📦' },
  { name: '带班交接', path: '/handover', icon: '🔄' },
  { name: '维修工单', path: '/workorder', icon: '🔧' },
  { name: '设备价值', path: '/asset', icon: '💰' },
  { name: '系统管理', path: '/admin', icon: '⚙️' }
])

const activeNav = ref('设备管理')

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
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 64px;
  background: linear-gradient(160deg, rgba(15, 45, 75, 0.95) 0%, rgba(10, 35, 60, 0.9) 100%);
  border-bottom: 1px solid rgba(45, 212, 191, 0.2);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.company-logo {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.logo-svg {
  width: 100%;
  height: 100%;
}

.system-title {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  margin: 0;
}

.menu-nav {
  display: flex;
  gap: 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  color: rgba(255, 255, 255, 0.65);
  font-size: 13px;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.menu-item.active {
  background: rgba(45, 212, 191, 0.15);
  color: #2DD4BF;
}

.menu-icon {
  font-size: 15px;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.user-name {
  color: #fff;
  font-size: 14px;
}

.user-role {
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
}

.logout-btn {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #EF4444;
  font-size: 12px;
  padding: 6px 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.25);
}
</style>
