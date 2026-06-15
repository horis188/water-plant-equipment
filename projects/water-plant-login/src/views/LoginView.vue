<script setup lang="ts">
import { useRouter } from 'vue-router'
import WaterBackground from '../components/WaterBackground.vue'
import LoginCard from '../components/LoginCard.vue'
import { setCurrentUser, setCurrentShiftContext, setPermissionCodes, clearPermissionCodes } from '../composables/useDeviceStore'

const router = useRouter()

// 根据用户角色加载权限码到 store (P0-5)
async function loadPermissionCodes(user: { id: number; token?: string; role_id?: number; role: string }) {
  if (!user.role_id) {
    // 老用户未迁移成功: 角色字符串查不到 role_id, 拉不到权限码
    // 兑底: 把当前角色名作为唯一权限码, 保持代码能跑
    setPermissionCodes([user.role])
    return
  }
  try {
    const headers: Record<string, string> = {}
    if (user.token) headers['Authorization'] = `Bearer ${user.token}`
    const res = await fetch(`/api/admin/roles/${user.role_id}/permissions`, { headers })
    if (!res.ok) throw new Error('拉取权限失败')
    const data = await res.json()
    setPermissionCodes(data.codes || [])
  } catch (err) {
    console.warn('[P0-5] 权限码加载失败, 使用空集:', err)
    setPermissionCodes([])
  }
}

const handleLogin = async (user: { id: number; username: string; name: string; role: string; role_id?: number; team?: string; member_name?: string; avatar?: string; token?: string }) => {
  // 头像优先级: member_name 第一个汉字 > name 第一个汉字 > 账号 username 首字
  const memberFirst = user.member_name ? user.member_name.replace(/\s/g, '').charAt(0) : ''
  const nameFirst = user.name ? user.name.replace(/\s/g, '').charAt(0) : ''
  const avatar = memberFirst || nameFirst || user.username?.charAt(0) || '?'
  setCurrentUser({
    id: user.id,
    name: user.name,
    role: user.role,
    role_id: user.role_id,
    avatar,
    team: user.team,
    member_name: user.member_name,
    token: user.token  // P0-5: 保存 JWT 用于后续请求
  })
  // 清空旧班次上下文, 让 MainDashboardView 重新加载
  setCurrentShiftContext(null)
  // 加载当前用户的权限码 (P0-5)
  clearPermissionCodes()
  await loadPermissionCodes({ id: user.id, token: user.token, role_id: user.role_id, role: user.role })
  router.push('/dashboard')
}
</script>

<template>
  <div class="login-page">
    <WaterBackground />

    <div class="login-container">
      <LoginCard @login="handleLogin" />
    </div>

    <!-- Footer -->
    <div class="page-footer">
      <p class="copyright">© 2024 广州市番禺水务股份有限公司</p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.login-container {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 20px;
}

/* Footer */
.page-footer {
  position: relative;
  z-index: 5;
  width: 100%;
  padding: 20px;
  text-align: center;
}

.copyright {
  margin: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  letter-spacing: 1px;
}
</style>
