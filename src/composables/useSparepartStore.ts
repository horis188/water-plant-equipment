import { ref } from 'vue'
import { currentUser } from './useDeviceStore'

// ============ 备件类型（全局共享）============
export const sparepartTypes = ref<string[]>([
  '水泵配件', '电气元件', '阀门配件', '管道配件', '仪表配件', '机械密封', '轴承', '其他'
])

// ============ 备件数据 ============
export interface Sparepart {
  id: string
  name: string
  type: string
  quantity: number
  location: string
  vendor: string
  specs: string // 格式同设备参数：电压:220V,电流:10A...
}

export const spareparts = ref<Sparepart[]>([
  { id: 'SP-001', name: '1号取水泵机械密封', type: '机械密封', quantity: 8, location: 'A区-03-02', vendor: '上海机械密封厂', specs: '电压:-,电流:-,功率:-,管径:DN100,螺纹:-,长度:-' },
  { id: 'SP-002', name: '轴承 7310B', type: '轴承', quantity: 20, location: 'A区-03-05', vendor: '哈尔滨轴承', specs: '电压:-,电流:-,功率:-,管径:-,螺纹:-,长度:-' },
  { id: 'SP-003', name: '电磁流量计探头', type: '仪表配件', quantity: 5, location: 'B区-01-08', vendor: '哈希中国', specs: '电压:24V,电流:4-20mA,功率:-,管径:DN50,螺纹:-,长度:-' },
  { id: 'SP-004', name: '止回阀阀芯', type: '阀门配件', quantity: 12, location: 'B区-02-01', vendor: '上海阀门厂', specs: '电压:-,电流:-,功率:-,管径:DN80,螺纹:-,长度:-' },
  { id: 'SP-005', name: '水泵轴承组件', type: '水泵配件', quantity: 6, location: 'A区-04-03', vendor: '上海泵业', specs: '电压:-,电流:-,功率:15kW,管径:DN100,螺纹:-,长度:-' },
  { id: 'SP-006', name: '变频器模块', type: '电气元件', quantity: 3, location: 'C区-02-01', vendor: '西门子', specs: '电压:380V,电流:-,功率:15kW,管径:-,螺纹:-,长度:-' },
  { id: 'SP-007', name: 'pH传感器探头', type: '仪表配件', quantity: 4, location: 'B区-01-12', vendor: '哈希中国', specs: '电压:220V,电流:-,功率:-,管径:-,螺纹:-,长度:-' },
  { id: 'SP-008', name: '管道法兰垫片', type: '管道配件', quantity: 100, location: 'D区-01-15', vendor: '广州密封件厂', specs: '电压:-,电流:-,功率:-,管径:DN100,螺纹:-,长度:3mm' }
])

// ============ 出入仓记录 ============
export interface SparepartLog {
  id: string
  sparepartId: string
  sparepartName: string
  action: '出仓' | '入仓'
  quantity: number
  operator: string
  time: string
}

export const sparepartLogs = ref<SparepartLog[]>([])

// ============ 出入仓操作 ============
export function inoutSparepart(
  sparepartId: string,
  action: '出仓' | '入仓',
  quantity: number
): { success: boolean; error?: string } {
  const idx = spareparts.value.findIndex(s => s.id === sparepartId)
  if (idx === -1) return { success: false, error: '备件不存在' }

  const sp = spareparts.value[idx]
  if (action === '出仓') {
    if (sp.quantity < quantity) return { success: false, error: '库存不足' }
    sp.quantity -= quantity
  } else {
    sp.quantity += quantity
  }

  const now = new Date()
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  sparepartLogs.value.unshift({
    id: 'LOG-' + Date.now(),
    sparepartId,
    sparepartName: sp.name,
    action,
    quantity,
    operator: currentUser.value.name,
    time: timeStr
  })

  return { success: true }
}

// ============ 备件 CRUD ============
export function addSparepart(data: Omit<Sparepart, 'id'>) {
  const id = 'SP-' + String(Date.now()).slice(-6)
  spareparts.value.push({ ...data, id })
  return id
}

export function updateSparepart(id: string, data: Partial<Sparepart>) {
  const idx = spareparts.value.findIndex(s => s.id === id)
  if (idx !== -1) spareparts.value[idx] = { ...spareparts.value[idx], ...data }
}

export function deleteSparepart(id: string) {
  spareparts.value = spareparts.value.filter(s => s.id !== id)
}

export function addSparepartType(type: string) {
  if (type && !sparepartTypes.value.includes(type)) {
    sparepartTypes.value.push(type)
  }
}
