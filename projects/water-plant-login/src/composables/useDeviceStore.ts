import { ref, computed } from 'vue'

// ============ 当前登录用户 ============
const saved = sessionStorage.getItem('currentUser')
export const currentUser = ref<{ name: string; role: string; avatar: string; id: number; team?: string; member_name?: string }>(saved ? JSON.parse(saved) : { name: '张明', role: '运行班长', avatar: '张', id: 0 })

export function setCurrentUser(user: { name: string; role: string; avatar: string; id: number; team?: string; member_name?: string }) {
  currentUser.value = user
  sessionStorage.setItem('currentUser', JSON.stringify(user))
}

// ============ 当前班次全局状态(接班后更新,所有页面可用)============
export interface ShiftContext {
  team: string
  member_name: string
  shift_type: string
  role: string
  leader_name: string
}
const savedShift = sessionStorage.getItem('currentShiftContext')
export const currentShiftContext = ref<ShiftContext | null>(savedShift ? JSON.parse(savedShift) : null)

export function setCurrentShiftContext(shift: ShiftContext | null) {
  currentShiftContext.value = shift
  if (shift) sessionStorage.setItem('currentShiftContext', JSON.stringify(shift))
  else sessionStorage.removeItem('currentShiftContext')
}

// ============ 值班状态判断 ============
export const isOnDuty = computed(() => {
  const role = currentUser.value?.role
  if (!['值班岗位', '带班', '旧厂制水', '一期制水', '投药间值班', '新低值班', '新高值班'].includes(role)) return true  // 测试模式：非值班角色也允许
  return true  // 临时解除时间限制，方便测试
})

// ============ 设备基础数据（不含状态）============
// statusValue: 0=在用, 1=告警, 2=维修中
// DB里status存的是数字0/1/2，所以映射也用数字
const statusValueMap: Record<string, number> = { '0': 0, '1': 1, '2': 2 }
const statusLabelMap: Record<number, string> = { 0: '在用', 1: '告警', 2: '维修中' }

export const devices = ref<any[]>([])

export async function loadDevicesFromDB() {
  try {
    const res = await fetch('/api/devices')
    const dbDevices = await res.json()
    devices.value = dbDevices.map((d: any) => ({
      ...d,
      id: String(d.id),
      statusValue: statusValueMap[d.status] ?? 0
    }))
  } catch (err) {
    console.error('加载设备失败', err)
  }
}

// ============ 维修工单数据 ============
export const workOrders = ref([
  { id: 'WO-001', deviceId: 'D-005', title: '3号取水泵轴承更换', level: '紧急', status: '维修中', createTime: '2026-04-21 08:00', handler: '李伟' },
  { id: 'WO-002', deviceId: 'D-010', title: '脱水机滤带更换', level: '普通', status: '维修中', createTime: '2026-04-21 09:30', handler: '王强' },
  { id: 'WO-003', deviceId: 'D-003', title: '1号送水泵密封检修', level: '普通', status: '已完成', createTime: '2026-04-20 14:00', handler: '张明' },
  { id: 'WO-004', deviceId: 'D-007', title: '水质监测仪探头校准', level: '定期', status: '已完成', createTime: '2026-04-20 10:00', handler: '李伟' }
])

// ============ 告警记录 ============
export const alarms = ref([
  { id: 'A-001', deviceId: 'D-002', title: '2号取水泵运行时异响', time: '2026-04-22 09:00', resolved: false },
  { id: 'A-002', deviceId: 'D-006', title: '1号滤池风机振动偏大', time: '2026-04-21 08:30', resolved: false },
  { id: 'A-003', deviceId: 'D-003', title: '1号送水泵压力波动', time: '2026-04-20 16:00', resolved: true }
])

// ============ 动态计算设备状态（基于statusValue）============
// statusValue: 0=在用, 1=告警, 2=维修中
export const computedDeviceStatus = computed(() => {
  const map: Record<string, string> = {}
  for (const d of devices.value) {
    const statusMap: Record<number, string> = { 0: '在用', 1: '告警', 2: '维修中' }
    map[d.id] = statusMap[d.statusValue ?? 0] || '在用'
  }
  return map
})

// ============ 设备变动记录 ============
export interface DeviceChange {
  id: string
  name: string
  changeTime: string
  operator: string
  changes: { field: string; fieldLabel: string; oldValue: string; newValue: string }[]
}

export const deviceChangeLog = ref<DeviceChange[]>([])

// 添加设备变动记录（同时写入数据库）
export async function addDeviceChangeLogToDB(deviceId: string, deviceName: string, changeType: string, content: string, operator: string) {
  try {
    await fetch('/api/devices/changes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_name: deviceName, change_type: changeType, operator, content })
    })
  } catch (err) {
    console.error('写入设备变动记录失败', err)
  }
}

// 添加设备变动记录（仅前端内存）
export function addDeviceChangeLog(deviceId: string, change: { field: string; fieldLabel: string; oldValue: string; newValue: string }, operator: string) {
  const device = devices.value.find(d => d.id === deviceId)
  if (!device) return
  
  const now = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate().toString().padStart(2, '0'))}`
  
  deviceChangeLog.value = deviceChangeLog.value.filter(c => c.id !== deviceId)
  deviceChangeLog.value.unshift({
    id: deviceId,
    name: device.name,
    changeTime: `${dateStr} ${timeStr}`,
    operator,
    changes: [change]
  })
}

// 更新设备状态（根据工单状态）
export async function updateDeviceStatusByOrder(deviceId: string, newStatus: string, operator?: string) {
  if (!deviceId) return
  const device = devices.value.find(d => d.id === deviceId)
  if (!device) return
  
  // 状态映射: 在用=0, 告警=1, 维修中=2
  const statusMap: Record<string, number> = { '在用': 0, '告警': 1, '维修中': 2 }
  const newStatusValue = statusMap[newStatus] ?? 0
  const oldStatusValue = device.statusValue ?? 0
  
  if (oldStatusValue === newStatusValue) return
  
  // 记录设备变动（先记，等API成功后再改本地）
  const statusLabels: Record<number, string> = { 0: '在用', 1: '告警', 2: '维修中' }
  const changeLog = {
    field: 'status' as const,
    fieldLabel: '设备状态',
    oldValue: statusLabels[oldStatusValue] || '在用',
    newValue: newStatus
  }
  
  // 同步到数据库，成功后再更新本地，失败则回滚
  try {
    const res = await fetch(`/api/devices/${deviceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
    if (!res.ok) throw new Error('API失败')
    // API成功，更新本地
    device.statusValue = newStatusValue
    addDeviceChangeLog(deviceId, changeLog, operator || currentUser.value.name)
  } catch (err) {
    console.error('同步设备状态失败，已回滚', err)
    // 不做回滚（本地状态未变），仅提示
  }
}

// 解析参数字符串为各子字段
function parseParams(paramsStr: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!paramsStr) return result
  paramsStr.split(',').forEach(p => {
    const colonIdx = p.indexOf(':')
    if (colonIdx > 0) {
      const k = p.substring(0, colonIdx).trim()
      const v = p.substring(colonIdx + 1).trim()
      result[k] = v
    }
  })
  return result
}

// ============ CRUD 操作 ============
export async function addDevice(data: Omit<typeof devices.value[0], 'id'>) {
  const frontendId = 'D-' + String(Date.now()).slice(-6)
  const record = { ...data, id: frontendId, statusValue: statusValueMap[data.status] ?? 0 }
  devices.value.push(record)
  try {
    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const dbDevice = await res.json()
    const op = currentUser.value.name
    // 写入数据库变动记录
    const content = `设备名称:${data.name}|类型:${data.type}|型号:${data.model}|安装地点:${data.location}|厂家:${data.vendor}|价值:${data.value}`
    await addDeviceChangeLogToDB(String(dbDevice.id || frontendId), data.name, '新增', content, op)
  } catch (err) {
    console.error('新增设备失败', err)
  }
  return frontendId
}

export async function updateDevice(id: string, data: Partial<typeof devices.value[0]>, operator?: string) {
  const idx = devices.value.findIndex(d => d.id === id)
  if (idx !== -1) {
    const oldDevice = devices.value[idx]
    const changes: DeviceChange['changes'] = []

    // 基础字段对比
    const trackFields: { key: keyof typeof oldDevice; label: string }[] = [
      { key: 'name', label: '设备名称' },
      { key: 'type', label: '设备类型' },
      { key: 'model', label: '型号' },
      { key: 'vendor', label: '厂家' },
      { key: 'location', label: '安装地点' },
      { key: 'value', label: '价值金额' },
      { key: 'remark', label: '备注' }
    ]

    for (const { key, label } of trackFields) {
      const k = key as string
      const oldVal = String((oldDevice as any)[k] ?? '')
      const newVal = String((data as any)[k] ?? '')
      if (oldVal !== newVal) {
        changes.push({ field: k, fieldLabel: label, oldValue: oldVal || '-', newValue: newVal || '-' })
      }
    }

    // 参数字段逐子项对比
    if (data.params !== undefined && data.params !== oldDevice.params) {
      const oldParams = parseParams(oldDevice.params || '')
      const newParams = parseParams(data.params || '')
      const paramKeys = ['电压', '电流', '功率', '管径', '其他']
      for (const k of paramKeys) {
        if (oldParams[k] !== newParams[k]) {
          changes.push({ field: `params.${k}`, fieldLabel: k, oldValue: oldParams[k] || '-', newValue: newParams[k] || '-' })
        }
      }
    }

    if (changes.length > 0) {
      devices.value[idx] = { ...oldDevice, ...data }
      const d = devices.value[idx]
      const now = new Date()
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const op = operator || currentUser.value.name

      deviceChangeLog.value = deviceChangeLog.value.filter(c => c.id !== d.id)
      deviceChangeLog.value.unshift({
        id: d.id,
        name: d.name,
        changeTime: `${dateStr} ${timeStr}`,
        operator: op,
        changes
      })

      // 写入数据库变动记录
      const changeDetail = changes.map(c => `${c.fieldLabel}:${c.oldValue}→${c.newValue}`).join(' | ')
      await addDeviceChangeLogToDB(d.id, d.name, '修改', changeDetail, op)
    } else {
      devices.value[idx] = { ...oldDevice, ...data }
    }

    // 同步数据库
    try {
      const { id: _id, statusValue: _sv, ...putData } = devices.value[idx]
      await fetch(`/api/devices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(putData)
      })
    } catch (err) {
      console.error('更新设备失败', err)
    }
  }
}

export async function deleteDevice(id: string) {
  devices.value = devices.value.filter(d => d.id !== id)
  try {
    await fetch(`/api/devices/${id}`, { method: 'DELETE' })
  } catch (err) {
    console.error('删除设备失败', err)
  }
}

// ============ 带完整状态的设备列表 ============
export const deviceListWithStatus = computed(() => {
  return devices.value.map(d => ({
    ...d,
    status: computedDeviceStatus.value[d.id] || '在用'
  }))
})

// ============ 设备统计 ============
export const deviceStats = computed(() => {
  const list = deviceListWithStatus.value
  const total = list.length
  const inuse = list.filter(d => d.status === '在用').length
  const warning = list.filter(d => d.status === '告警').length
  const maintenance = list.filter(d => d.status === '维修中').length
  return { total, inuse, warning, maintenance }
})
