<template>
  <div class="admin-page">
    <TopNavBar />
    <div class="admin-header">
      <h2 class="admin-title">⚙️ 系统管理</h2>
      <span class="admin-desc">基础数据 · 用户权限 · 业务配置</span>
    </div>

    <div class="admin-body">
      <!-- 左侧子菜单 -->
      <aside class="admin-sidebar">
        <div
          v-for="item in menuItems"
          :key="item.path"
          class="sidebar-item"
          :class="{ active: isActive(item.path) }"
          @click="$router.push(item.path)"
        >
          <span class="sidebar-icon">{{ item.icon }}</span>
          <span class="sidebar-text">{{ item.title }}</span>
          <span v-if="item.badge" class="sidebar-badge">{{ item.badge }}</span>
        </div>
      </aside>

      <!-- 右侧内容区 -->
      <main class="admin-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import TopNavBar from '../../components/TopNavBar.vue'
import { usePermission } from '../../composables/usePermission'

const route = useRoute()
const { has } = usePermission()

// 所有菜单项 (全量) - 根据当前用户权限码动态过滤显示
const allMenuItems = [
  { title: '岗位字典', path: '/admin/positions', icon: '👷', permission: 'menu:admin_positions' },
  { title: '班次时间', path: '/admin/shifts',    icon: '🕐', permission: 'menu:admin_shifts' },
  { title: '班组配置', path: '/admin/teams',     icon: '👥', permission: 'menu:admin_teams' },
  { title: '用户管理', path: '/admin/users',     icon: '👤', permission: 'menu:admin_users' },
  { title: '角色权限', path: '/admin/roles',     icon: '🔐', permission: 'menu:admin_roles', badge: 'P0-5' }
]

// 根据当前用户权限过滤可见的菜单项
const menuItems = computed(() => allMenuItems.filter(m => has(m.permission)))

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: #0f2d4a;
  padding-bottom: 40px;
}

.admin-header {
  background: rgba(255, 255, 255, 0.04);
  padding: 24px 32px;
  display: flex;
  align-items: baseline;
  gap: 16px;
  border-bottom: 1px solid rgba(45, 212, 191, 0.15);
}
.admin-title {
  color: #fff;
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  letter-spacing: 1px;
}
.admin-desc {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.admin-body {
  display: flex;
  gap: 16px;
  padding: 20px 32px;
  align-items: stretch;
}

.admin-sidebar {
  flex-shrink: 0;
  width: 200px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: fit-content;
  position: sticky;
  top: 20px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-weight: 500;
}
.sidebar-item:hover {
  background: rgba(45, 212, 191, 0.1);
  color: rgba(255, 255, 255, 0.95);
}
.sidebar-item.active {
  background: rgba(45, 212, 191, 0.18);
  color: #2dd4bf;
  border-left: 3px solid #2dd4bf;
  padding-left: 11px;
}

.sidebar-icon {
  font-size: 16px;
  line-height: 1;
}
.sidebar-text {
  flex: 1;
  white-space: nowrap;
}
.sidebar-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(250, 173, 20, 0.2);
  color: #faad14;
  font-weight: 600;
}

.admin-content {
  flex: 1;
  min-width: 0;
}
</style>
