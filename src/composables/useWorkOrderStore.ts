import { ref } from 'vue'
import { currentUser, devices, updateDeviceStatusByOrder } from './useDeviceStore'

// ============ 设备关键词匹配 ============
export function matchDeviceByContent(content: string): string | null {
  const keywordMap: Record<string, string> = {
    '1号取水泵': 'D-001',
    '2号取水泵': 'D-002',
    '3号取水泵': 'D-005',
    '1号送水泵': 'D-003',
    '2号送水泵': 'D-004',
    '取水泵': 'D-001',
    '送水泵': 'D-003',
    '滤池风机': 'D-006',
    '1号滤池': 'D-006',
    '水质监测仪': 'D-007',
    '1号配电柜': 'D-008',
    '加药计量泵': 'D-009',
    '污泥脱水机': 'D-010',
    '脱水机': 'D-010',
    '二氧化氯发生器': 'D-011',
    '中控室工控机': 'D-012',
    '工控机': 'D-012',
  }
  for (const [keyword, deviceId] of Object.entries(keywordMap)) {
    if (content.includes(keyword)) return deviceId
  }
  return null
}

// 初始化设备状态（根据已有工单数据）
// 优先级：维修中 > 告警 > 在用
export function initDeviceStatusFromWorkOrders() {
  // 收集所有设备的工单状态
  const deviceStatusMap: Record<string, number> = {} // 0=在用, 1=告警, 2=维修中
  
  // 处理维修工单：有维修工单(任意状态) -> 维修中（最高优先级）
  for (const order of maintenanceOrders.value) {
    let deviceId: string | null = null
    if (order.problemOrderId) {
      const po = problemOrders.value.find(p => p.id === order.problemOrderId)
      deviceId = po?.deviceId || null
    } else {
      deviceId = matchDeviceByContent(order.content || '')
    }
    if (deviceId) {
      deviceStatusMap[deviceId] = 2 // 维修中
    }
  }
  
  // 处理问题工单：pending状态 -> 告警（只有设备还不是维修中时才设置）
  for (const order of problemOrders.value) {
    if (order.status === 'pending' && order.deviceId) {
      if (!deviceStatusMap[order.deviceId]) { // 只有在没有更高优先级状态时才设置
        deviceStatusMap[order.deviceId] = 1 // 告警
      }
    }
  }
  
  // 应用到设备
  for (const [deviceId, status] of Object.entries(deviceStatusMap)) {
    const device = devices.value.find(d => d.id === deviceId)
    if (device) {
      device.statusValue = status
    }
  }
}

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
  deviceId?: string  // 关联设备ID
  reporterId: string
  reporterName: string
  shiftId: string
  content: string
  images: string[]
  videos: string[]
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
    deviceId: 'D-002',
    reporterId: 'wxz',
    reporterName: '维修组',
    shiftId: 'SHIFT-001',
    content: '2号取水泵运行时异响，轴承可能损坏',
    images: [],
    videos: [],
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
    videos: [],
    status: 'to_maintenance',
    createdAt: '2026-04-21 16:20'
  },
  {
    id: 'PWO-003',
    deviceId: 'D-006',
    reporterId: 'yqzs',
    reporterName: '一期制水',
    shiftId: 'SHIFT-002',
    content: '滤池1号阀门操作卡顿',
    images: [],
    videos: [],
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
    content: '加药间液位计故障检修',
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
    content: '2号取水泵轴承损坏，需要更换维修',
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
    content: '3号取水泵电机温度异常，需要检修',
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
  
  // 从内容中匹配设备
  const deviceId = matchDeviceByContent(order.content)
  
  const newOrder: ProblemWorkOrder = {
    ...order,
    id,
    deviceId: deviceId || undefined,
    createdAt: new Date().toLocaleString('zh-CN')
  }
  problemOrders.value.push(newOrder)
  
  // 如果匹配到设备，更新设备状态为告警
  if (deviceId) {
    updateDeviceStatusByOrder(deviceId, '告警', order.reporterName)
  }
  
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
