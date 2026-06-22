import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import naive from 'naive-ui'
import { currentUser } from './composables/useDeviceStore'
import './styles/variables.css'
import './assets/main.css'

// ====================================================================
// P0-5 安全修复: 全局 fetch wrapper, 自动注入 Authorization Bearer token
// 取代之前所有 X-User-Id header (可被伪造)
// 业务 API (除 /api/auth/login 公开) 都要求有效 token
// ====================================================================
const originalFetch = window.fetch.bind(window)
window.fetch = async (input: any, init: RequestInit = {}) => {
  // 1. 提取 URL
  let url = ''
  if (typeof input === 'string') {
    url = input
  } else if (input instanceof URL) {
    url = input.toString()
  } else if (input && typeof input === 'object' && 'url' in input) {
    url = (input as Request).url
  }

  // 2. /api/auth/login 公开, 不注入 token (登录时还没 token)
  const isPublicAuth = url.includes('/api/auth/login') || url.includes('/api/auth/logout')
  if (isPublicAuth) {
    return originalFetch(input as any, init)
  }

  // 3. 同源 /api 请求, 自动注入 Bearer token
  const isApiCall = url.includes('/api/')
  if (isApiCall) {
    const token = currentUser.value?.token
    if (token) {
      const headers = new Headers(init.headers || {})
      // 不覆盖已有 Authorization (避免覆盖自定义测试)
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`)
      }
      init = { ...init, headers }
    }
  }

  return originalFetch(input as any, init)
}

// 启动时从 sessionStorage 强制同步 currentUser (修复 useDeviceStore 模块顶层
// 副作用导致的 ref 旧值问题: 刷新页面后 ref 不会重新读 sessionStorage)
const savedUser = sessionStorage.getItem('currentUser')
if (savedUser) {
  try { currentUser.value = JSON.parse(savedUser) } catch {}
}

const app = createApp(App)

app.use(router)
app.use(naive)

app.mount('#app')
