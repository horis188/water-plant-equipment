import { ref, computed } from 'vue'

// ============ 当前登录用户 ============
const saved = sessionStorage.getItem('currentUser')
export const currentUser = ref(saved ? JSON.parse(saved) : { name: '张明', role: '运行班长', avatar: '张' })

export function setCurrentUser(user: { name: string; role: string; avatar: string }) {
  currentUser.value = user
  sessionStorage.setItem('currentUser', JSON.stringify(user))
}

// ============ 设备基础数据（不含状态）============
export const devices = ref([
  { id: 'D-001', name: '1号取水泵', type: '水泵', model: 'WQ400-300-15', vendor: '上海泵业', location: '取水泵房', value: 125000, doc: 'WQ400说明书.pdf', remark: '轴承定期检查', params: '电压:380V,电流:30A,功率:15kW,管径:DN100' },
  { id: 'D-002', name: '2号取水泵', type: '水泵', model: 'WQ400-300-15', vendor: '上海泵业', location: '取水泵房', value: 125000, doc: 'WQ400说明书.pdf', remark: '', params: '电压:380V,电流:30A,功率:15kW,管径:DN100' },
  { id: 'D-003', name: '1号送水泵', type: '水泵', model: 'KDL250-400A', vendor: '凯德拉水泵', location: '送水泵房', value: 98000, doc: null, remark: '', params: '电压:380V,电流:22A,功率:11kW,管径:DN80' },
  { id: 'D-004', name: '2号送水泵', type: '水泵', model: 'KDL250-400A', vendor: '凯德拉水泵', location: '送水泵房', value: 98000, doc: null, remark: '', params: '电压:380V,电流:22A,功率:11kW,管径:DN80' },
  { id: 'D-005', name: '3号取水泵', type: '水泵', model: 'WQ400-300-15', vendor: '上海泵业', location: '取水泵房', value: 125000, doc: '维修手册.docx', remark: '轴承损坏维修中', params: '电压:380V,电流:30A,功率:15kW,管径:DN100' },
  { id: 'D-006', name: '1号滤池风机', type: '其他', model: 'BK-50', vendor: '安庆风机', location: '滤池车间', value: 35000, doc: null, remark: '', params: '电压:380V,电流:11A,功率:5.5kW,管径:DN50' },
  { id: 'D-007', name: '水质监测仪', type: '仪表', model: 'YSI-6600', vendor: '哈希中国', location: '中控室', value: 68000, doc: 'YSI操作手册.pdf', remark: '', params: '电压:220V,电流:2A,功率:0.5kW,管径:DN20' },
  { id: 'D-008', name: '1号配电柜', type: '其他', model: 'GGD-2000A', vendor: '正泰电器', location: '配电室', value: 45000, doc: '配电柜技术参数.doc', remark: '', params: '电压:380V,电流:2000A,功率:0kW,管径:-' },
  { id: 'D-009', name: '加药计量泵', type: '水泵', model: 'M-100', vendor: '德国威尔泵', location: '加药间', value: 22000, doc: null, remark: '流量异常', params: '电压:220V,电流:3.5A,功率:0.8kW,管径:DN15' },
  { id: 'D-010', name: '污泥脱水机', type: '其他', model: 'LD-200', vendor: '兴达环保', location: '污泥处理间', value: 150000, doc: '脱水机维护手册.pdf', remark: '', params: '电压:380V,电流:15A,功率:7.5kW,管径:DN100' },
  { id: 'D-011', name: '二氧化氯发生器', type: '仪表', model: 'CL-5000', vendor: '山东绿晨', location: '加药间', value: 38000, doc: null, remark: '', params: '电压:220V,电流:6A,功率:1.5kW,管径:DN25' },
  { id: 'D-012', name: '中控室工控机', type: '其他', model: 'IPC-610L', vendor: '研华科技', location: '中控室', value: 28000, doc: '工控机规格书.pdf', remark: '', params: '电压:220V,电流:1.5A,功率:0.3kW,管径:-' }
])

// ============ 维修工单数据 ============
export const workOrders = ref([
  { id: 'WO-001', deviceId: 'D-005', title: '3号取水泵轴承更换', level: '紧急', status: '维修中', createTime: '2026-04-21 08:00', handler: '李伟' },
  { id: 'WO-002', deviceId: 'D-010', title: '脱水机滤带更换', level: '普通', status: '维修中', createTime: '2026-04-21 09:30', handler: '王强' },
  { id: 'WO-003', deviceId: 'D-003', title: '1号送水泵密封检修', level: '普通', status: '已完成', createTime: '2026-04-20 14:00', handler: '张明' },
  { id: 'WO-004', deviceId: 'D-007', title: '水质监测仪探头校准', level: '定期', status: '已完成', createTime: '2026-04-20 10:00', handler: '李伟' }
])

// ============ 告警记录 ============
export const alarms = ref([
  { id: 'A-001', deviceId: 'D-009', title: '加药计量泵流量异常', time: '2026-04-21 10:15', resolved: false },
  { id: 'A-002', deviceId: 'D-006', title: '1号滤池风机振动偏大', time: '2026-04-21 08:30', resolved: false },
  { id: 'A-003', deviceId: 'D-003', title: '1号送水泵压力波动', time: '2026-04-20 16:00', resolved: true }
])

// ============ 动态计算设备状态 ============
export const computedDeviceStatus = computed(() => {
  const map: Record<string, string> = {}
  for (const d of devices.value) {
    const hasActiveAlarm = alarms.value.some(a => a.deviceId === d.id && !a.resolved)
    if (hasActiveAlarm) { map[d.id] = '告警'; continue }
    const hasActiveWorkOrder = workOrders.value.some(w => w.deviceId === d.id && w.status === '维修中')
    if (hasActiveWorkOrder) { map[d.id] = '维修中'; continue }
    map[d.id] = '在用'
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

// ============ 设备关键词匹配 ============
// 从工单内容中识别设备ID
export function matchDeviceByContent(content: string): string | null {
  // 设备名称关键词映射
  const keywordMap: Record<string, string> = {
    '1号取水泵': 'D-001',
    '2号取水泵': 'D-002',
    '3号取水泵': 'D-005',
    '1号送水泵': 'D-003',
    '2号送水泵': 'D-004',
    '取水泵': 'D-001',  // 默认取水泵
    '送水泵': 'D-003',  // 默认送水泵
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
    if (content.includes(keyword)) {
      return deviceId
    }
  }
  return null
}

// 添加设备变动记录
export function addDeviceChangeLog(deviceId: string, change: { field: string; fieldLabel: string; oldValue: string; newValue: string }, operator: string) {
  const device = devices.value.find(d => d.id === deviceId)
  if (!device) return
  
  const now = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  
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
export function updateDeviceStatusByOrder(deviceId: string, newStatus: string, operator?: string) {
  if (!deviceId) return
  const device = devices.value.find(d => d.id === deviceId)
  if (!device) return
  const oldStatus = computedDeviceStatus.value[deviceId] || '在用'
  addDeviceChangeLog(deviceId, {
    field: 'status',
    fieldLabel: '设备状态',
    oldValue: oldStatus,
    newValue: newStatus
  }, operator || currentUser.value.name)
  // 创建或更新告警记录
  const existingAlarm = alarms.value.find(a => a.deviceId === deviceId && !a.resolved)
  if (!existingAlarm && newStatus !== '在用') {
    alarms.value.push({
      id: `A-${String(Date.now()).slice(-4)}`,
      deviceId,
      title: `设备状态变更为${newStatus}`,
      time: new Date().toLocaleString('zh-CN'),
      resolved: false
    })
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
export function addDevice(data: Omit<typeof devices.value[0], 'id'>) {
  const id = 'D-' + String(Date.now()).slice(-6)
  devices.value.push({ ...data, id })
  return id
}

export function updateDevice(id: string, data: Partial<typeof devices.value[0]>, operator?: string) {
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
      const oldVal = String(oldDevice[key] ?? '')
      const newVal = String(data[key] ?? '')
      if (oldVal !== newVal) {
        changes.push({ field: key, fieldLabel: label, oldValue: oldVal || '-', newValue: newVal || '-' })
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
    } else {
      devices.value[idx] = { ...oldDevice, ...data }
    }
  }
}

export function deleteDevice(id: string) {
  devices.value = devices.value.filter(d => d.id !== id)
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
