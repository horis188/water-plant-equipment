import { ref } from 'vue'
import { currentUser, devices, updateDeviceStatusByOrder } from './useDeviceStore'

// ============ 设备关键词匹配 ============
export function matchDeviceByContent(content: string): string | null {
  const keywordMap: Record<string, string> = {
    '7#低压取水泵': '8',
    '1号取水泵': '1',
    '2号取水泵': '2',
    '3号取水泵': '5',
    '1#送水泵': '7',
    '2号送水泵': '4',
    '1号送水泵': '3',
    '取水泵': '1',
    '送水泵': '3',
    '滤池风机': '6',
    '1号滤池': '6',
    '水质监测仪': '5',
    '水质监测站': '5',
    '1号配电柜': '8',
    '加药计量泵': '9',
    '污泥脱水机': '10',
    '脱水机': '10',
    '二氧化氯发生器': '11',
    '中控室工控机': '12',
    '工控机': '12',
  }
  for (const [keyword, deviceId] of Object.entries(keywordMap)) {
    if (content.includes(keyword)) return deviceId
  }
  return null
}

// 初始化设备状态（根据已有工单数据）
// 优先级：维修中 > 告警 > 在用
// 计算完后批量写DB，确保刷新后状态不丢失
export async function initDeviceStatusFromWorkOrders() {
  console.log('[DEBUG] initDeviceStatusFromWorkOrders called')
  console.log('[DEBUG] devices:', devices.value.map(d => ({ id: d.id, name: d.name, statusValue: d.statusValue })))
  console.log('[DEBUG] problemOrders:', problemOrders.value.map(o => ({ id: o.id, content: o.content, status: o.status, deviceId: o.deviceId })))
  const deviceStatusMap: Record<string, number> = {} // 0=在用, 1=告警, 2=维修中
  const statusLabels: Record<number, string> = { 0: '在用', 1: '告警', 2: '维修中' }

  // 处理维修工单：有未闭环维修工单(任意状态) -> 维修中
  for (const order of maintenanceOrders.value) {
    if (order.status === 'closed' || order.status === 'completed') continue
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

  // 处理问题工单：pending状态 -> 告警
  for (const order of problemOrders.value) {
    if (order.status === 'pending' && order.deviceId) {
      if (!deviceStatusMap[order.deviceId]) {
        deviceStatusMap[order.deviceId] = 1 // 告警
      }
    }
  }
  console.log('[DEBUG] deviceStatusMap:', deviceStatusMap)

  // 应用到设备：工单涉及的设备按规则算，其他设备默认在用
  const updates: { id: string; status: string }[] = []
  for (const device of devices.value) {
    if (deviceStatusMap[device.id] !== undefined) {
      // 有工单的设备按规则
      if (device.statusValue !== deviceStatusMap[device.id]) {
        device.statusValue = deviceStatusMap[device.id]
        updates.push({ id: device.id, status: statusLabels[deviceStatusMap[device.id]] })
      }
    } else {
      // 没有活跃工单的设备 -> 在用
      if (device.statusValue !== 0) {
        device.statusValue = 0
        updates.push({ id: device.id, status: '在用' })
      }
    }
  }
  console.log('[DEBUG] after apply:', devices.value.filter(d => d.statusValue !== 0).map(d => ({ id: d.id, name: d.name, statusValue: d.statusValue })))

  // 批量写DB
  if (updates.length > 0) {
    try {
      await fetch('/api/devices/batch-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })
    } catch (err) {
      console.error('[DEBUG] batch-status写DB失败', err)
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
  team?: string
  role?: string
  memberName?: string
  member_name?: string
  closedAt?: string
  lastActionAt?: string
  sla_due_at?: string  // P1: SLA 截止时间
  sla_hours?: number   // P1: SLA 时长
}

export interface MaintenanceWorkOrder {
  id: string
  problemOrderId?: string | null
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
  delayImages?: string[]
  sparepartUsage: SparepartUsage[]
  completionImages?: string[]
  completionNote?: string
  returnReason?: string
  returnImages?: string[]
  sla_due_at?: string  // P1: SLA 截止时间
  sla_hours?: number   // P1: SLA 时长
  createdAt: string
  completedAt?: string
  closedAt?: string
  team?: string
  role?: string
  user_name?: string
  reporterName?: string
  memberName?: string
  lastActionAt?: string
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

// ============ 问题工单（从数据库同步）============
export const problemOrders = ref<ProblemWorkOrder[]>([])

// ============ 维修工单（从数据库同步）============
export const maintenanceOrders = ref<MaintenanceWorkOrder[]>([])

// 一次性从后端拉全量工单到 store (供 dashboard 弹窗/详情页使用)
// 后端返回 snake_case 字段, 这里转换为 camelCase 以匹配 WorkOrder 接口和模板
function mapProblemOrder(o: any) {
  return {
    ...o,
    reporterName: o.reporter_name || '',
    memberName: o.member_name || '',
    images: Array.isArray(o.images) ? o.images : [],
    videos: Array.isArray(o.videos) ? o.videos : [],
    resolutionImages: Array.isArray(o.resolution_images) ? o.resolution_images : [],
    createdAt: o.created_at ? new Date(o.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '',
    lastActionAt: o.last_action_at ? new Date(o.last_action_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '',
    closedAt: o.closed_at ? new Date(o.closed_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : ''
  }
}
function mapMaintenanceOrder(o: any) {
  return {
    ...o,
    id: String(o.id),
    assignerName: o.assigner_name || '',
    handlerName: o.handler_name || '',
    problemOrderId: o.problem_order_id || null,
    participants: Array.isArray(o.participants) ? o.participants : [],
    delayImages: Array.isArray(o.delay_images) ? o.delay_images : [],
    delayReason: o.delay_reason || '',  // 修复: 后端返回 delay_reason, 前端需要驼峰映射
    sparepartUsage: Array.isArray(o.sparepart_usage) ? o.sparepart_usage : [],
    returnImages: Array.isArray(o.return_images) ? o.return_images : [],
    completionImages: Array.isArray(o.completion_images) ? o.completion_images : [],
    reporterName: o.reporter_name || '',
    memberName: o.member_name || '',
    createdAt: o.created_at ? new Date(o.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '',
    lastActionAt: o.last_action_at ? new Date(o.last_action_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '',
    closedAt: o.closed_at ? new Date(o.closed_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : ''
  }
}

export async function loadAllWorkOrders(headers: Record<string, string> = {}) {
  try {
    const [probRes, maintRes] = await Promise.all([
      fetch('/api/workorders/problem', { headers }),
      fetch('/api/workorders/maintenance', { headers })
    ])
    const [probs, maints] = await Promise.all([probRes.json(), maintRes.json()])
    problemOrders.value = Array.isArray(probs) ? probs.map(mapProblemOrder) : []
    maintenanceOrders.value = Array.isArray(maints) ? maints.map(mapMaintenanceOrder) : []
    return { probs: problemOrders.value, maints: maintenanceOrders.value }
  } catch (err) {
    console.error('加载工单到 store 失败', err)
    return { probs: [], maints: [] }
  }
}

// ============ 操作日志 ============
export const workOrderLogs = ref<WorkOrderLog[]>([])

// ============ 方法 ============

export function addProblemOrder(order: Omit<ProblemWorkOrder, 'id' | 'createdAt'>) {
  const id = `PWO-${String(problemOrders.value.length + 1).padStart(3, '0')}`
  
  // 优先用表单传入的deviceId，否则从内容中匹配
  const matchedDeviceId = matchDeviceByContent(order.content)
  const deviceId = order.deviceId || matchedDeviceId || undefined
  
  const newOrder: ProblemWorkOrder = {
    ...order,
    id,
    deviceId,
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
  
  // 同步到后端
  fetch('/api/workorders/problem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: order.content,
      reporter_name: order.reporterName,
      images: order.images,
      videos: order.videos,
      deviceId: order.deviceId || null,
      team: order.team || null,
      role: order.role || null,
      member_name: order.member_name || null
    })
  }).catch(err => console.error('同步问题工单失败', err))
  
  return id
}

export async function recreateProblemFromMaintenance(problemOrderId: string) {
  try {
    const res = await fetch('/api/workorders/recreate-problem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_order_id: problemOrderId })
    })
    if (!res.ok) throw new Error('重建问题工单失败')
    const data = await res.json()
    // 从原问题工单复制内容新建本地记录
    const orig = problemOrders.value.find(p => String(p.id) === String(problemOrderId))
    if (orig) {
      problemOrders.value.push({
        id: String(data.id),
        reporterId: orig.reporterId,
        reporterName: orig.reporterName,
        content: orig.content + ' [退回重开]',
        status: 'pending',
        shiftId: '',
        deviceId: orig.deviceId,
        images: [],
        videos: [],
        createdAt: new Date().toLocaleString('zh-CN'),
        resolution: ''
      })
    }
  } catch (err) {
    console.error('重建问题工单失败', err)
  }
}

export async function updateProblemOrder(id: string, data: Partial<ProblemWorkOrder>) {
  const updateData: Record<string, any> = {}
  if (data.content !== undefined) updateData.content = data.content
  if (data.status !== undefined) updateData.status = data.status
  if (data.resolution !== undefined) updateData.resolution = data.resolution
  if (data.resolutionImages !== undefined) updateData.resolutionImages = data.resolutionImages
  if (data.closedAt !== undefined) updateData.closedAt = data.closedAt
  if (data.deviceId !== undefined) updateData.deviceId = data.deviceId
  if (Object.keys(updateData).length === 0) return
  try {
    const res = await fetch(`/api/workorders/problem/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    })
    if (!res.ok) throw new Error('API失败')
    // API成功后再更新本地
    const idx = problemOrders.value.findIndex(o => o.id === id)
    if (idx !== -1) {
      problemOrders.value[idx] = { ...problemOrders.value[idx], ...data }
    }
  } catch (err) {
    console.error('同步问题工单失败', err)
  }
}

export async function addMaintenanceOrder(order: Omit<MaintenanceWorkOrder, 'id' | 'createdAt'>) {
  const id = `MWO-${String(maintenanceOrders.value.length + 1).padStart(3, '0')}`
  const newOrder = {
    ...order,
    id,
    createdAt: new Date().toLocaleString('zh-CN')
  }
  try {
    const res = await fetch('/api/workorders/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: order.content,
        level: order.level,
        status: order.status,
        assigner_name: order.assignerName,
        handler_name: order.handlerName || null,
        problem_order_id: order.problemOrderId || null,
        team: order.team || null,
        role: order.role || null,
        user_name: order.user_name || order.assignerName,
        reporter_name: (order as any).reporterName || null,
        member_name: (order as any).memberName || null
      })
    })
    if (!res.ok) throw new Error('API失败')
    // API成功后再写入本地
    maintenanceOrders.value.push(newOrder)
  } catch (err) {
    console.error('同步维修工单失败', err)
  }
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

export async function updateMaintenanceOrder(id: string, data: Partial<MaintenanceWorkOrder>) {
  // 同步到数据库，只同步有值的字段
  const updateData: Record<string, any> = {}
  if (data.content !== undefined) updateData.content = data.content
  if (data.level !== undefined) updateData.level = data.level
  if (data.status !== undefined) updateData.status = data.status
  if (data.handlerName !== undefined) updateData.handler_name = data.handlerName
  if (data.returnReason !== undefined) updateData.return_reason = data.returnReason
  if (data.returnImages !== undefined) updateData.return_images = data.returnImages
  if (data.participants !== undefined) updateData.participants = data.participants
  if (data.completionNote !== undefined) updateData.completion_note = data.completionNote
  if (data.completionImages !== undefined) updateData.completion_images = data.completionImages
  if (data.sparepartUsage !== undefined) updateData.sparepart_usage = data.sparepartUsage
  if (data.delayImages !== undefined) updateData.delay_images = data.delayImages
  if (data.delayReason !== undefined) updateData.delay_reason = data.delayReason
  if (data.delayDays !== undefined) updateData.delay_days = data.delayDays
  if (data.completedAt !== undefined) updateData.completed_at = data.completedAt
  if (data.problemOrderId !== undefined) updateData.problem_order_id = data.problemOrderId
  if (data.closedAt !== undefined) updateData.closed_at = data.closedAt  // 修复: 闭环时同步 closed_at
  if (Object.keys(updateData).length === 0) return
  try {
    const res = await fetch(`/api/workorders/maintenance/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    })
    if (!res.ok) throw new Error('API失败')
    // API成功后再更新本地
    const idx = maintenanceOrders.value.findIndex(o => o.id === id)
    if (idx !== -1) {
      maintenanceOrders.value[idx] = { ...maintenanceOrders.value[idx], ...data }
    }
  } catch (err) {
    console.error('同步维修工单失败', err)
  }
}

export async function deleteProblemOrder(id: string) {
  problemOrders.value = problemOrders.value.filter(o => o.id !== id)
  try {
    await fetch(`/api/workorders/problem/${id}`, { method: 'DELETE' })
  } catch (err) {
    console.error('删除问题工单失败', err)
  }
}

export async function deleteMaintenanceOrder(id: string) {
  maintenanceOrders.value = maintenanceOrders.value.filter(o => o.id !== id)
  try {
    await fetch(`/api/workorders/maintenance/${id}`, { method: 'DELETE' })
  } catch (err) {
    console.error('删除维修工单失败', err)
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
