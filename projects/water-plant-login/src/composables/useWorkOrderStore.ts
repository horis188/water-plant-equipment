import { ref } from 'vue'
import { currentUser } from './useDeviceStore'

// ============ 工单类型定义 ============

export type ProblemStatus = 'pending' | 'self_resolved' | 'to_maintenance' | 'closed'
export type MaintenanceStatus = 'pending' | 'processing' | 'delay' | 'completed' | 'returned' | 'closed'
export type OrderLevel = 'light' | 'medium' | 'heavy'

export interface SparepartUsage {
  name: string
  quantity: number
  specs: string
}

export interface ProblemWorkOrder {
  id: string
  reporterId: string
  reporterName: string
  shiftId: string
  content: string
  images: string[]
  audios: string[]
  files: string[]
  status: ProblemStatus
  resolution?: string
  resolutionImages?: string[]
  createdAt: string
  closedAt?: string
}

export interface MaintenanceWorkOrder {
  id: string
  problemOrderId?: string
  content?: string
  level: OrderLevel
  assignerId: string
  assignerName: string
  handlerId?: string
  handlerName?: string
  participants: string[]
  status: MaintenanceStatus
  delayReason?: string
  delayDays: number
  sparepartUsage: SparepartUsage[]
  completionImages?: string[]
  completionNote?: string
  returnReason?: string
  returnImages?: string[]
  createdAt: string
  completedAt?: string
  closedAt?: string
}

export interface WorkOrderLog {
  id: string
  orderId: string
  orderType: 'problem' | 'maintenance'
  action: string
  operatorId: string
  operatorName: string
  content: string
  createdAt: string
}

// ============ 问题工单 Mock 数据 ============
export const problemOrders = ref<ProblemWorkOrder[]>([
  {
    id: 'PWO-001',
    reporterId: 'wxz',
    reporterName: '维修组',
    shiftId: 'SHIFT-001',
    content: '2号取水泵运行时异响，轴承可能损坏',
    images: [],
    audios: [],
    files: [],
    status: 'pending',
    createdAt: '2026-04-22 09:00'
  },
  {
    id: 'PWO-002',
    reporterId: 'zy',
    reporterName: '张远',
    shiftId: 'SHIFT-001',
    content: '加药间液位计读数偏低',
    images: [],
    audios: [],
    files: [],
    status: 'to_maintenance',
    createdAt: '2026-04-21 16:20'
  },
  {
    id: 'PWO-003',
    reporterId: 'yqzs',
    reporterName: '一期制水',
    shiftId: 'SHIFT-002',
    content: '滤池1号阀门操作卡顿',
    images: [],
    audios: [],
    files: [],
    status: 'self_resolved',
    resolution: '已清理阀门轴承杂物，调试后正常',
    resolutionImages: [],
    createdAt: '2026-04-20 14:30',
    closedAt: '2026-04-20 15:45'
  }
])

// ============ 维修工单 Mock 数据 ============
export const maintenanceOrders = ref<MaintenanceWorkOrder[]>([
  {
    id: 'MWO-001',
    problemOrderId: 'PWO-002',
    level: 'medium',
    assignerId: 'zy',
    assignerName: '张远',
    handlerId: 'wxz',
    handlerName: '维修组',
    participants: [],
    status: 'completed',
    delayDays: 0,
    sparepartUsage: [],
    createdAt: '2026-04-21 16:30'
  },
  {
    id: 'MWO-002',
    problemOrderId: 'PWO-001',
    level: 'heavy',
    assignerId: 'zy',
    assignerName: '张远',
    handlerId: undefined,
    handlerName: undefined,
    participants: [],
    status: 'pending',
    delayDays: 0,
    sparepartUsage: [],
    createdAt: '2026-04-22 09:15'
  },
  {
    id: 'MWO-003',
    level: 'light',
    assignerId: 'admin',
    assignerName: '管理员',
    handlerId: 'wxz',
    handlerName: '维修组',
    participants: ['李师傅', '王师傅'],
    status: 'delay',
    delayReason: '需要等待备件轴承到货',
    delayDays: 2,
    sparepartUsage: [{ name: '轴承 7310B', quantity: 2, specs: '哈尔滨轴承' }],
    createdAt: '2026-04-20 10:00'
  }
])

// ============ 操作日志 ============
export const workOrderLogs = ref<WorkOrderLog[]>([])

// ============ 方法 ============

export function addProblemOrder(order: Omit<ProblemWorkOrder, 'id' | 'createdAt'>) {
  const id = `PWO-${String(problemOrders.value.length + 1).padStart(3, '0')}`
  problemOrders.value.push({
    ...order,
    id,
    createdAt: new Date().toLocaleString('zh-CN')
  })
  addLog({
    orderId: id,
    orderType: 'problem',
    action: '创建问题工单',
    operatorId: order.reporterId,
    operatorName: order.reporterName,
    content: order.content
  })
  return id
}

export function updateProblemOrder(id: string, data: Partial<ProblemWorkOrder>) {
  const idx = problemOrders.value.findIndex(o => o.id === id)
  if (idx !== -1) {
    problemOrders.value[idx] = { ...problemOrders.value[idx], ...data }
  }
}

export function addMaintenanceOrder(order: Omit<MaintenanceWorkOrder, 'id' | 'createdAt'>) {
  const id = `MWO-${String(maintenanceOrders.value.length + 1).padStart(3, '0')}`
  maintenanceOrders.value.push({
    ...order,
    id,
    createdAt: new Date().toLocaleString('zh-CN')
  })
  addLog({
    orderId: id,
    orderType: 'maintenance',
    action: '生成维修工单',
    operatorId: order.assignerId,
    operatorName: order.assignerName,
    content: `生成${levelLabel(order.level)}级维修工单`
  })
  return id
}

export function updateMaintenanceOrder(id: string, data: Partial<MaintenanceWorkOrder>) {
  const idx = maintenanceOrders.value.findIndex(o => o.id === id)
  if (idx !== -1) {
    maintenanceOrders.value[idx] = { ...maintenanceOrders.value[idx], ...data }
  }
}

export function addLog(log: Omit<WorkOrderLog, 'id' | 'createdAt'>) {
  const id = `LOG-${String(workOrderLogs.value.length + 1).padStart(3, '0')}`
  workOrderLogs.value.push({
    ...log,
    id,
    createdAt: new Date().toLocaleString('zh-CN')
  })
}

export function levelLabel(level: OrderLevel): string {
  const map: Record<OrderLevel, string> = { light: '轻', medium: '中', heavy: '重' }
  return map[level]
}

export function statusLabel(status: ProblemStatus | MaintenanceStatus): string {
  const map: Record<string, string> = {
    pending: '待确认',
    self_resolved: '已自行解决',
    to_maintenance: '转维修',
    processing: '处理中',
    delay: '延时中',
    completed: '已完成待审核',
    returned: '已退回',
    closed: '已闭环'
  }
  return map[status] || status
}

export function statusColor(status: ProblemStatus | MaintenanceStatus): string {
  const map: Record<string, string> = {
    pending: '#F59E0B',
    self_resolved: '#10B981',
    to_maintenance: '#8B5CF6',
    processing: '#3B82F6',
    delay: '#EAB308',
    completed: '#A855F7',
    returned: '#EF4444',
    closed: '#10B981'
  }
  return map[status] || '#6B7280'
}

// 获取当前用户可见的工单（根据角色）
export function getOrdersByRole() {
  const role = currentUser.value.role
  const userId = currentUser.value.name

  const problem = problemOrders.value.filter(o => {
    if (role === '系统管理人') return true
    if (role === '带班') return o.status === 'pending' || o.reporterName === userId
    if (role === '维修组') return o.reporterName === userId
    if (role === '值班岗位') return o.reporterName === userId
    return false
  })

  const maintenance = maintenanceOrders.value.filter(o => {
    if (role === '系统管理人') return true
    if (role === '带班') return o.assignerName === userId || o.status === 'completed'
    if (role === '维修组') return !o.handlerId || o.handlerName === userId
    return false
  })

  return { problem, maintenance }
}
