// 系统管理 API 调用封装 (P0-5: 注入 JWT Authorization 头, 取代明文 X-User-Id)
import { currentUser, authHeader } from './useDeviceStore'

const API_BASE = '/api/admin'

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { 'Content-Type': 'application/json', ...authHeader(extra) }
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) }
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data
}

export const adminApi = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body: any) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T = any>(path: string, body: any) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  del: <T = any>(path: string) => request<T>(path, { method: 'DELETE' })
}
