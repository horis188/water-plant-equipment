<script setup lang="ts">

import WaterBackground from '../components/WaterBackground.vue'
import LoginCard from '../components/LoginCard.vue'

const handleLogin = (data: { username: string; password: string; verifyCode: string }) => {
  console.log('Login data:', data)
  // TODO: Call actual login API
  alert(`登录成功！\n账号: ${data.username}`)
}
</script>

<template>
  <div class="login-page">
    <WaterBackground />

    <div class="login-container">
      <LoginCard @login="handleLogin" />
    </div>

    <!-- Water pipe footer decoration -->
    <div class="page-footer">
      <div class="pipe-system">
        <svg class="pipe-svg" viewBox="0 0 800 60" preserveAspectRatio="none">
          <!-- Main horizontal pipe -->
          <rect x="0" y="25" width="800" height="10" fill="#E8F4FC" rx="5"/>

          <!-- Vertical connectors -->
          <rect x="100" y="10" width="8" height="30" fill="#D1E3F0" rx="2"/>
          <rect x="300" y="35" width="8" height="25" fill="#D1E3F0" rx="2"/>
          <rect x="500" y="10" width="8" height="30" fill="#D1E3F0" rx="2"/>
          <rect x="700" y="35" width="8" height="25" fill="#D1E3F0" rx="2"/>

          <!-- Valve circles -->
          <circle cx="104" cy="10" r="8" fill="#1E6BB8" opacity="0.4"/>
          <circle cx="304" cy="60" r="8" fill="#2DD4BF" opacity="0.4"/>
          <circle cx="504" cy="10" r="8" fill="#1E6BB8" opacity="0.4"/>
          <circle cx="704" cy="60" r="8" fill="#2DD4BF" opacity="0.4"/>

          <!-- Flow arrows -->
          <path d="M150 30 L170 30 L165 25 M170 30 L165 35" stroke="#4A9BD9" stroke-width="2" fill="none" opacity="0.5"/>
          <path d="M350 50 L370 50 L365 45 M370 50 L365 55" stroke="#4A9BD9" stroke-width="2" fill="none" opacity="0.5"/>
          <path d="M550 30 L570 30 L565 25 M570 30 L565 35" stroke="#4A9BD9" stroke-width="2" fill="none" opacity="0.5"/>
          <path d="M750 50 L770 50 L765 45 M770 50 L765 55" stroke="#4A9BD9" stroke-width="2" fill="none" opacity="0.5"/>
        </svg>
      </div>
      <p class="copyright">© 2024 智慧水务管理系统</p>
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

.pipe-system {
  max-width: 800px;
  margin: 0 auto;
}

.pipe-svg {
  width: 100%;
  height: 60px;
}

.copyright {
  margin-top: 10px;
  font-size: 12px;
  color: var(--color-text-secondary);
  opacity: 0.7;
}
</style>
