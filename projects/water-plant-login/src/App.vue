<script setup lang="ts">
// Root App component
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { currentUser, reloadPermissionCodes, clearPermissionCodes } from './composables/useDeviceStore'

const router = useRouter()

// P0-5: 全局 RBAC 变更推送
// 角色/权限被修改后, 后端通过 SSE 广播 rbac-update 事件
// 收到后判断是否影响当前用户, 决定是静默重拉还是迫退出
let rbacSource: EventSource | null = null

function setupRbacSSE() {
  if (rbacSource) rbacSource.close()
  // 使用相对路径走 vite 代理, 避免浏览器对绝对 URL 的直连限制
  rbacSource = new EventSource('/api/events')
  rbacSource.addEventListener('open', () => console.info('[RBAC-SSE] 连接已建立'))
  rbacSource.addEventListener('error', (e) => console.warn('[RBAC-SSE] 连接错误 (会自动重连)', e))
  rbacSource.addEventListener('rbac-update', async (e: MessageEvent) => {
    let payload: any = {}
    try { payload = JSON.parse(e.data) } catch {}
    const { action, roleId } = payload
    console.info(`[RBAC-SSE] 收到事件: action=${action} roleId=${roleId}`)
    const me = currentUser.value
    console.info(`[RBAC-SSE] 当前用户: id=${me?.id} role_id=${me?.role_id} role=${me?.role}`)
    if (!me?.id) { console.info('[RBAC-SSE] 未登录, 跳过'); return }
    // 不影响当前用户角色 → 静默
    if (me.role_id !== roleId) { console.info(`[RBAC-SSE] 不影响当前用户 (我 role_id=${me.role_id}, 事件 roleId=${roleId}), 跳过`); return }
    // 影响当前用户: 重拉权限码
    console.info('[RBAC-SSE] 影响当前用户, 开始重拉权限码...')
    const result = await reloadPermissionCodes()
    console.info(`[RBAC-SSE] reloadPermissionCodes 结果: ok=${result.ok} changed=${result.changed} reason=${result.reason || '无'}`)
    if (!result.ok) {
      console.warn('[RBAC-SSE] 权限重拉失败, 退出登录:', result.reason)
      clearPermissionCodes()
      sessionStorage.removeItem('currentUser')
      sessionStorage.removeItem('currentShiftContext')
      router.push('/login')
      return
    }
    if (result.changed) {
      console.info(`[RBAC-SSE] 权限已实时更新 (action=${action}, roleId=${roleId})`)
    } else {
      console.info(`[RBAC-SSE] 权限码未变化`)
    }
  })
}

onMounted(() => { setupRbacSSE() })
onUnmounted(() => { if (rbacSource) rbacSource.close() })
</script>

<template>
  <RouterView />
</template>

<style>
/* Global reset */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  line-height: 1.6;
  color: var(--color-text-primary);
  background: var(--color-bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  min-height: 100vh;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(30, 107, 184, 0.05);
}

::-webkit-scrollbar-thumb {
  background: rgba(30, 107, 184, 0.2);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(30, 107, 184, 0.4);
}

/* Selection color */
::selection {
  background: rgba(30, 107, 184, 0.2);
  color: inherit;
}
</style>
