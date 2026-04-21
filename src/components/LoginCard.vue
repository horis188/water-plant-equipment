<script setup lang="ts">
import { ref } from 'vue'
import WaterInput from './WaterInput.vue'
import WaterButton from './WaterButton.vue'
import VerifyCode from './VerifyCode.vue'

const emit = defineEmits<{
  login: [data: { username: string; password: string; verifyCode: string }]
}>()

// Form data
const username = ref('')
const password = ref('')
const verifyCode = ref('')
const rememberMe = ref(false)

// Errors
const usernameError = ref('')
const passwordError = ref('')
const verifyCodeError = ref('')

// Loading
const isLoading = ref(false)

// Validate form
const validate = () => {
  let valid = true

  if (!username.value) {
    usernameError.value = '请输入账号'
    valid = false
  } else if (username.value.length < 4) {
    usernameError.value = '账号至少4个字符'
    valid = false
  } else {
    usernameError.value = ''
  }

  if (!password.value) {
    passwordError.value = '请输入密码'
    valid = false
  } else if (password.value.length < 6) {
    passwordError.value = '密码至少6个字符'
    valid = false
  } else {
    passwordError.value = ''
  }

  if (!verifyCode.value) {
    verifyCodeError.value = '请输入验证码'
    valid = false
  } else if (verifyCode.value.length !== 4) {
    verifyCodeError.value = '验证码4个字符'
    valid = false
  } else {
    verifyCodeError.value = ''
  }

  return valid
}

// Handle submit
const handleSubmit = async () => {
  if (!validate()) return

  isLoading.value = true

  await new Promise(resolve => setTimeout(resolve, 1500))

  const mockSuccess = username.value === 'admin' && password.value === 'admin123'

  if (mockSuccess) {
    emit('login', {
      username: username.value,
      password: password.value,
      verifyCode: verifyCode.value
    })
  } else {
    verifyCodeError.value = '验证码错误'
    verifyCode.value = ''
  }

  isLoading.value = false
}
</script>

<template>
  <div class="login-card">
    <!-- Glow effect -->
    <div class="card-glow"></div>

    <!-- Logo and title -->
    <div class="card-header">
      <div class="logo-container">
        <svg class="logo-svg" viewBox="0 0 120 120">
          <!-- Rounded square -->
          <rect x="4" y="4" width="112" height="112" rx="20" fill="#2a7ab8"/>
          <!-- Top wave - break on right: drop -> rise -> drop -->
          <path d="M16 48 C28 56, 40 40, 60 40 C80 40, 92 52, 104 46" 
                stroke="white" stroke-width="5" fill="none" stroke-linecap="round"/>
          <!-- Middle wave - continuous: same pattern -->
          <path d="M12 65 C26 75, 44 55, 64 55 C84 55, 96 72, 108 65" 
                stroke="white" stroke-width="5" fill="none" stroke-linecap="round"/>
          <!-- Bottom wave - break on left: same pattern -->
          <path d="M14 82 C26 90, 44 70, 64 70 C84 70, 96 86, 106 80" 
                stroke="white" stroke-width="5" fill="none" stroke-linecap="round"/>
        </svg>
      </div>
      <h1 class="title">供水厂设备管理平台</h1>
      <p class="subtitle">Water Plant Equipment Management</p>
    </div>

    <!-- Login form -->
    <form class="login-form" @submit.prevent="handleSubmit">
      <!-- Username -->
      <WaterInput
        v-model="username"
        type="text"
        placeholder="请输入账号"
        icon="user"
        :error="usernameError"
      />

      <!-- Password -->
      <WaterInput
        v-model="password"
        type="password"
        placeholder="请输入密码"
        icon="lock"
        :error="passwordError"
      />

      <!-- Verify code row -->
      <div class="verify-row">
        <WaterInput
          v-model="verifyCode"
          type="text"
          placeholder="验证码"
          icon="verify"
          :error="verifyCodeError"
          class="verify-input"
        />
        <VerifyCode class="verify-component" />
      </div>

      <!-- Remember & forgot -->
      <div class="form-options">
        <label class="remember">
          <input type="checkbox" v-model="rememberMe" />
          <span class="checkmark"></span>
          <span class="label">记住账号</span>
        </label>
        <a href="#" class="forgot-link">忘记密码？</a>
      </div>

      <!-- Submit button -->
      <WaterButton :loading="isLoading" @click="handleSubmit">
        登 录
      </WaterButton>
    </form>

    <!-- Footer decoration -->
    <div class="card-footer">
      <svg class="pipe-decoration" viewBox="0 0 300 20" preserveAspectRatio="none">
        <path d="M0 10 Q75 0, 150 10 T300 10" stroke="#D1E3F0" stroke-width="2" fill="none"/>
        <circle cx="0" cy="10" r="4" fill="#1E6BB8" opacity="0.3"/>
        <circle cx="150" cy="10" r="6" fill="#2DD4BF" opacity="0.3"/>
        <circle cx="300" cy="10" r="4" fill="#1E6BB8" opacity="0.3"/>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.login-card {
  position: relative;
  width: 420px;
  max-width: 95%;
  padding: 40px;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(12px);
  z-index: 10;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Header */
.card-header {
  text-align: center;
  margin-bottom: 32px;
  animation: fadeInDown 0.6s ease-out 0.2s both;
}

@keyframes fadeInDown {
  0% {
    opacity: 0;
    transform: translateY(-20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.logo-container {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.logo-svg {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  animation: logoFloat 3s ease-in-out infinite;
}

@keyframes logoFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.title {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-primary-dark);
  margin: 0 0 8px 0;
}

.subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  letter-spacing: 1px;
}

/* Form */
.login-form {
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.6s ease-out 0.4s both;
}

@keyframes fadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

.verify-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 20px;
}

.verify-input {
  flex: 1;
  margin-bottom: 0;
}

/* Options row */
.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

/* Remember checkbox */
.remember {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  transition: color var(--transition-fast);
}

.remember:hover {
  color: var(--color-primary);
}

.remember input {
  display: none;
}

.checkmark {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  position: relative;
  transition: all var(--transition-fast);
}

.remember input:checked + .checkmark {
  background: var(--color-primary);
  border-color: var(--color-primary);
  transform: scale(1.1);
}

.remember input:checked + .checkmark::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 5px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  animation: checkPop 0.2s ease-out;
}

@keyframes checkPop {
  0% { transform: rotate(45deg) scale(0); }
  50% { transform: rotate(45deg) scale(1.2); }
  100% { transform: rotate(45deg) scale(1); }
}

/* Forgot link */
.forgot-link {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  text-decoration: none;
  transition: all var(--transition-fast);
  position: relative;
}

.forgot-link::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 1px;
  background: var(--color-primary);
  transition: width var(--transition-fast);
}

.forgot-link:hover::after {
  width: 100%;
}

.forgot-link:hover {
  color: var(--color-primary-light);
}

/* Footer decoration */
.card-footer {
  margin-top: 24px;
  display: flex;
  justify-content: center;
  animation: fadeIn 0.6s ease-out 0.6s both;
}

.pipe-decoration {
  width: 200px;
  height: 20px;
}
</style>
