<script setup lang="ts">

import WaterBackground from '../components/WaterBackground.vue'
import LoginCard from '../components/LoginCard.vue'

const handleLogin = (data: { username: string; password: string; verifyCode: string }) => {
  console.log('Login data:', data)
  alert(`登录成功！\n账号: ${data.username}`)
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
