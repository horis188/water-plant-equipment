/**
 * API 服务层 - 供水厂设备管理平台
 * 基于 Naive UI 的数据处理模块
 */

// ============= 类型定义 =============

export interface User {
  id: string
  name: string
  role: string
  department: string
}

export interface Device {
  id: string
  name: string
  type: string
  status: 'normal' | 'warning' | 'maintenance' | 'offline'
  location: string
  lastCheck: string
  nextCheck: string
}

export interface Sparepart {
  id: string
  name: string
  specs: string
  quantity: number
  unit: string
  location: string
  minStock: number
}

export interface WorkOrder {
  id: string
  type: 'problem' | 'maintenance'
  title: string
  content: string
  priority: 'low' | 'medium' | 'high'
  status: string
  reporter?: string
  handler?: string
  createdAt: string
  updatedAt?: string
}

// ============= API 配置 =============

// vite 环境变量 // @ts-ignore
const API_BASE = (import.meta as any).env?.VITE_API_BASE || '/api'

// ============= 请求工具 =============

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  })
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`)
  }
  
  return response.json()
}

// ============= API 方法 =============

// 用户相关
export const userApi = {
  login: (username: string, password: string) =>
    request<User>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  
  getCurrentUser: () =>
    request<User>('/auth/current'),
  
  logout: () =>
    request<void>('/auth/logout', { method: 'POST' })
}

// 设备相关
export const deviceApi = {
  list: (params?: { status?: string; type?: string }) =>
    request<Device[]>('/devices', { body: JSON.stringify(params) }),
  
  getById: (id: string) =>
    request<Device>(`/devices/${id}`),
  
  update: (id: string, data: Partial<Device>) =>
    request<Device>(`/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
}

// 备件相关
export const sparepartApi = {
  list: () =>
    request<Sparepart[]>('/spareparts'),
  
  getById: (id: string) =>
    request<Sparepart>(`/spareparts/${id}`),
  
  update: (id: string, data: Partial<Sparepart>) =>
    request<Sparepart>(`/spareparts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
}

// 工单相关
export const workOrderApi = {
  list: (params?: { type?: string; status?: string }) =>
    request<WorkOrder[]>('/workorders', { body: JSON.stringify(params) }),
  
  getById: (id: string) =>
    request<WorkOrder>(`/workorders/${id}`),
  
  create: (data: Partial<WorkOrder>) =>
    request<WorkOrder>('/workorders', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  update: (id: string, data: Partial<WorkOrder>) =>
    request<WorkOrder>(`/workorders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
}