<script setup lang="ts">
import { useRouter } from 'vue-router'
import WaterBackground from '../components/WaterBackground.vue'
import LoginCard from '../components/LoginCard.vue'
import { setCurrentUser } from '../composables/useDeviceStore'

const router = useRouter()

const handleLogin = (data: { username: string; password: string; verifyCode: string }) => {
  const userMap: Record<string, { name: string; role: string; avatar: string; id: number }> = {
    'admin': { name: '管理员', role: '系统管理人', avatar: '管', id: 1 },
    'zy': { name: '张远', role: '带班', avatar: '远', id: 2 },
    'yqzs': { name: '一期制水', role: '值班岗位', avatar: '制', id: 3 },
    'wxz': { name: '维修组', role: '维修组', avatar: '维', id: 4 },
    'wy': { name: '王一', role: '带班', avatar: '王', id: 5 },
    'ce': { name: '陈二', role: '带班', avatar: '陈', id: 6 },
    'zs': { name: '张三', role: '旧厂制水', avatar: '张', id: 7 },
    'ls': { name: '李四', role: '投药间值班', avatar: '李', id: 8 }
  }
  const user = userMap[data.username]
  if (user) {
    setCurrentUser(user)
    router.push('/dashboard')
  }
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
