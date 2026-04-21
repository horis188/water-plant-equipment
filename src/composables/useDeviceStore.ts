import { ref, computed } from 'vue'

// ============ 设备基础数据（不含状态）============
export const devices = ref([
  { id: 'D-001', name: '1号取水泵', type: '水泵', model: 'WQ400-300-15', vendor: '上海泵业', location: '取水泵房', value: 125000, doc: 'WQ400说明书.pdf', remark: '轴承定期检查', params: { voltage: '380V', power: '15kW', current: '30A', pipeDiameter: 'DN100' } },
  { id: 'D-002', name: '2号取水泵', type: '水泵', model: 'WQ400-300-15', vendor: '上海泵业', location: '取水泵房', value: 125000, doc: 'WQ400说明书.pdf', remark: '', params: { voltage: '380V', power: '15kW', current: '30A', pipeDiameter: 'DN100' } },
  { id: 'D-003', name: '1号送水泵', type: '水泵', model: 'KDL250-400A', vendor: '凯德拉水泵', location: '送水泵房', value: 98000, doc: null, remark: '', params: { voltage: '380V', power: '11kW', current: '22A', pipeDiameter: 'DN80' } },
  { id: 'D-004', name: '2号送水泵', type: '水泵', model: 'KDL250-400A', vendor: '凯德拉水泵', location: '送水泵房', value: 98000, doc: null, remark: '', params: { voltage: '380V', power: '11kW', current: '22A', pipeDiameter: 'DN80' } },
  { id: 'D-005', name: '3号取水泵', type: '水泵', model: 'WQ400-300-15', vendor: '上海泵业', location: '取水泵房', value: 125000, doc: '维修手册.docx', remark: '轴承损坏维修中', params: { voltage: '380V', power: '15kW', current: '30A', pipeDiameter: 'DN100' } },
  { id: 'D-006', name: '1号滤池风机', type: '其他', model: 'BK-50', vendor: '安庆风机', location: '滤池车间', value: 35000, doc: null, remark: '', params: { voltage: '380V', power: '5.5kW', current: '11A', pipeDiameter: 'DN50' } },
  { id: 'D-007', name: '水质监测仪', type: '仪表', model: 'YSI-6600', vendor: '哈希中国', location: '中控室', value: 68000, doc: 'YSI操作手册.pdf', remark: '', params: { voltage: '220V', power: '0.5kW', current: '2A', pipeDiameter: 'DN20' } },
  { id: 'D-008', name: '1号配电柜', type: '其他', model: 'GGD-2000A', vendor: '正泰电器', location: '配电室', value: 45000, doc: '配电柜技术参数.doc', remark: '', params: { voltage: '380V', power: '0kW', current: '2000A', pipeDiameter: '-' } },
  { id: 'D-009', name: '加药计量泵', type: '水泵', model: 'M-100', vendor: '德国威尔泵', location: '加药间', value: 22000, doc: null, remark: '流量异常', params: { voltage: '220V', power: '0.8kW', current: '3.5A', pipeDiameter: 'DN15' } },
  { id: 'D-010', name: '污泥脱水机', type: '其他', model: 'LD-200', vendor: '兴达环保', location: '污泥处理间', value: 150000, doc: '脱水机维护手册.pdf', remark: '', params: { voltage: '380V', power: '7.5kW', current: '15A', pipeDiameter: 'DN100' } },
  { id: 'D-011', name: '二氧化氯发生器', type: '仪表', model: 'CL-5000', vendor: '山东绿晨', location: '加药间', value: 38000, doc: null, remark: '', params: { voltage: '220V', power: '1.5kW', current: '6A', pipeDiameter: 'DN25' } },
  { id: 'D-012', name: '中控室工控机', type: '其他', model: 'IPC-610L', vendor: '研华科技', location: '中控室', value: 28000, doc: '工控机规格书.pdf', remark: '', params: { voltage: '220V', power: '0.3kW', current: '1.5A', pipeDiameter: '-' } }
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

// ============ CRUD 操作 ============
export function addDevice(data: Omit<typeof devices.value[0], 'id'>) {
  const id = 'D-' + String(Date.now()).slice(-6)
  devices.value.push({ ...data, id })
  return id
}

export function updateDevice(id: string, data: Partial<typeof devices.value[0]>) {
  const idx = devices.value.findIndex(d => d.id === id)
  if (idx !== -1) devices.value[idx] = { ...devices.value[idx], ...data }
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
  return {
    total,
    inuse,
    warning,
    maintenance
  }
})
