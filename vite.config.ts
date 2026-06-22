import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // 加载 .env[.mode] 中的变量,以 VITE_ 开头的才会暴露给客户端
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.VITE_PORT) || 5175
  const apiBase = env.VITE_API_BASE || 'http://localhost:3000'

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    server: {
      port,
      host: true,
      proxy: {
        '/api': {
          target: apiBase,
          changeOrigin: true
        },
        // /uploads 静态文件代理到后端(图片/视频)
        '/uploads': {
          target: apiBase,
          changeOrigin: true
        }
      }
    }
  }
})
