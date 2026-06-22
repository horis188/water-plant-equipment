import { ref } from 'vue'
import { currentUser, authHeader } from './useDeviceStore'

// ============ 备件类型（全局共享）============
export const sparepartTypes = ref<string[]>([
  '水泵配件', '电气元件', '阀门配件', '管道配件', '仪表配件', '机械密封', '轴承', '其他'
])

// ============ 备件数据（从后端加载, 不再硬编码）============
export interface Sparepart {
  id: number
  name: string
  type: string
  quantity: number
  min_quantity: number   // 报警阈值: 库存低于此值触发低库存告警
  location: string
  vendor: string
  specs: string
  tech_docs?: TechDoc[]  // 技术文档文件列表
  created_at?: string
  updated_at?: string
  last_low_stock_at?: string  // 首次触发低库存告警的时间 (后端 spareparts.js 写入)
}

export interface TechDoc {
  url: string
  name: string
  size: number
  uploaded_at?: string
  uploaded_by?: string
}

// 初始为空, 由 loadSpareparts() 拉取
export const spareparts = ref<Sparepart[]>([])

// ============ 加载备件列表（从后端）============
export async function loadSpareparts() {
  try {
    const r = await fetch('/api/spareparts/', { headers: authHeader() })
    if (!r.ok) return
    spareparts.value = await r.json()
  } catch (err) {
    console.error('加载备件失败', err)
  }
}

// ============ 出入仓记录 ============
export interface SparepartLog {
  id: number | string
  sparepartId: number | string
  sparepartName: string
  action: '出仓' | '入仓'
  quantity: number
  operator: string
  time: string
}

export const sparepartLogs = ref<SparepartLog[]>([])

// 加载出入仓记录
export async function loadSparepartLogs() {
  try {
    const r = await fetch('/api/spareparts/logs', { headers: authHeader() })
    if (!r.ok) return
    sparepartLogs.value = await r.json()
  } catch (err) {
    console.error('加载出入仓记录失败', err)
  }
}

// ============ 出入仓操作（后端 API）============
export async function inoutSparepart(
  sparepartId: number,
  action: '出仓' | '入仓',
  quantity: number
): Promise<{ success: boolean; error?: string }> {
  const sp = spareparts.value.find(s => s.id === sparepartId)
  if (!sp) return { success: false, error: '备件不存在' }
  if (action === '出仓' && sp.quantity < quantity) {
    return { success: false, error: '库存不足' }
  }
  try {
    // 1. 写日志
    const r = await fetch('/api/spareparts/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({
        sparepart_id: sparepartId,
        action,
        quantity,
        operator: currentUser.value?.name || '未知'
      })
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      return { success: false, error: err.error || `HTTP ${r.status}` }
    }
    // 2. 更新库存数量
    const newQty = action === '出仓' ? sp.quantity - quantity : sp.quantity + quantity
    await updateSparepart(sparepartId, { quantity: newQty })
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// ============ 备件 CRUD（后端 API）============
export async function addSparepart(data: Omit<Sparepart, 'id' | 'created_at' | 'updated_at'>) {
  try {
    const r = await fetch('/api/spareparts/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(data)
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${r.status}`)
    }
    await loadSpareparts()  // 重新拉取列表
    return true
  } catch (err) {
    console.error('新增备件失败:', err)
    throw err
  }
}

export async function updateSparepart(id: number, data: Partial<Sparepart>) {
  try {
    const r = await fetch(`/api/spareparts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(data)
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${r.status}`)
    }
    // 局部更新避免重拉
    const idx = spareparts.value.findIndex(s => s.id === id)
    if (idx !== -1) spareparts.value[idx] = { ...spareparts.value[idx], ...data }
    return true
  } catch (err) {
    console.error('更新备件失败:', err)
    throw err
  }
}

export async function deleteSparepart(id: number) {
  try {
    const r = await fetch(`/api/spareparts/${id}`, {
      method: 'DELETE',
      headers: authHeader()
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${r.status}`)
    }
    spareparts.value = spareparts.value.filter(s => s.id !== id)
  } catch (err) {
    console.error('删除备件失败:', err)
    throw err
  }
}

export function addSparepartType(type: string) {
  if (type && !sparepartTypes.value.includes(type)) {
    sparepartTypes.value.push(type)
  }
}
