<script setup lang="ts">
import { useRouter } from 'vue-router'
import WaterBackground from '../components/WaterBackground.vue'
import LoginCard from '../components/LoginCard.vue'
import { setCurrentUser, setCurrentShiftContext } from '../composables/useDeviceStore'

const router = useRouter()

const handleLogin = (user: { id: number; username: string; name: string; role: string; team?: string; member_name?: string; avatar?: string }) => {
  // 头像优先级: member_name 第一个汉字 > name 第一个汉字 > 账号 username 首字
  const memberFirst = user.member_name ? user.member_name.replace(/\s/g, '').charAt(0) : ''
  const nameFirst = user.name ? user.name.replace(/\s/g, '').charAt(0) : ''
  const avatar = memberFirst || nameFirst || user.username?.charAt(0) || '?'
  setCurrentUser({
    id: user.id,
    name: user.name,
    role: user.role,
    avatar,
    team: user.team,
    member_name: user.member_name
  })
  // 清空旧班次上下文, 让 MainDashboardView 重新加载
  setCurrentShiftContext(null)
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
