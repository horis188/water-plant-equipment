<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import WaterBackground from '../components/WaterBackground.vue'
import DeviceDetailPanel from '../components/DeviceDetailPanel.vue'
import WorkOrderDetailPanel from '../components/WorkOrderDetailPanel.vue'
import { deviceStats, deviceListWithStatus, deviceChangeLog, currentUser, currentShiftContext, setCurrentShiftContext, loadDevicesFromDB, authHeader } from '../composables/useDeviceStore'
import { usePermission } from '../composables/usePermission'
import { useSSE } from '../composables/useSSE'
import { spareparts, loadSpareparts } from '../composables/useSparepartStore'
import { maintenanceOrders, loadAllWorkOrders } from '../composables/useWorkOrderStore'

const API_BASE = '/api/inspection'
const router = useRouter()
// P0-5: 权限钩子
const { has } = usePermission()

// 巡检任务（从后端实时加载）
const inspectionTasks = ref<any[]>([])
const showExecuteDialog = ref(false)
const currentTaskForDialog = ref<any>(null)
const checkedItems = ref<string[]>([])
const executeRemark = ref('')
const hasAbnormal = ref(false)
const abnormalDesc = ref('')
const abnormalImages = ref<string[]>([])

// 异常子弹窗
const showAbnormalDialog = ref(false)

// 图片灯箱 (跟工单页一致: 多图数组 + 翻页索引 + 点遮罩/X 关闭)
const lightboxImages = ref<string[]>([])
const lightboxIndex = ref(0)
function openLightbox(images: string[], idx = 0) {
  lightboxImages.value = images || []
  lightboxIndex.value = idx
}
function closeLightbox() { lightboxImages.value = []; lightboxIndex.value = 0 }
// 全局 Esc 关闭 (lightbox 打开时)
function onLightboxKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && lightboxImages.value.length) {
    e.stopPropagation()
    closeLightbox()
  } else if (e.key === 'ArrowLeft' && lightboxImages.value.length > 1) {
    lightboxIndex.value = (lightboxIndex.value - 1 + lightboxImages.value.length) % lightboxImages.value.length
  } else if (e.key === 'ArrowRight' && lightboxImages.value.length > 1) {
    lightboxIndex.value = (lightboxIndex.value + 1) % lightboxImages.value.length
  }
}
onMounted(() => window.addEventListener('keydown', onLightboxKeydown))
onUnmounted(() => window.removeEventListener('keydown', onLightboxKeydown))

const myTasks = computed(() => {
  return inspectionTasks.value
})

const myDoneCount = computed(() => myTasks.value.filter(t => t.is_completed).length)
const myOverdueCount = computed(() => myTasks.value.filter(t => !t.is_completed && t.remainingMs < 0).length)

const inspectionPlan = computed(() => ({
  total: myTasks.value.length,
  completed: myDoneCount.value,
  pending: myOverdueCount.value,
  recentItems: myTasks.value.slice(0, 8).map((t: any) => ({
    id: t.plan_id + '-' + t.device_id,
    task: t,
    name: t.device_name,
    status: t.is_completed ? (t.has_abnormal ? 'abnormal' : 'ok') : 'pending',
    deadline: t.remainingMs < 0 ? '已超时' : (t.remainingMs === Infinity ? '' : `剩余${formatRemaining(t.remainingMs)}`)
  }))
}))

async function loadInspectionTasks() {
  try {
    const res = await fetch(`${API_BASE}/pending-tasks?executor_id=${currentUser.value?.id}`)
    const tasks = await res.json()
    const now = Date.now()
    for (const t of tasks) {
      const planRes = await fetch(`${API_BASE}/plans/${t.plan_id}`)
      const plan = planRes.ok ? await planRes.json() : null
      t.remainingMs = getTaskRemainingMs(t, plan, now)
    }
    inspectionTasks.value = tasks
  } catch (err) {
    console.error('加载巡检任务失败', err)
  }
}

function getTaskRemainingMs(task: any, plan: any, now: number): number {
  if (task.is_completed) return Infinity
  const cycle = task.cycle
  if (cycle === 'hourly') return 3600000 - (now % 3600000)
  if (cycle === 'two_hour') return 7200000 - (now % 7200000)
  if (cycle === 'four_hour') return 14400000 - (now % 14400000)
  if (cycle === 'eight_hour') return 28800000 - (now % 28800000)
  if (cycle === 'custom' && plan?.custom_times) {
    const times = JSON.parse(plan.custom_times)
    if (times && times.length > 0) {
      const [sh, sm] = (times[0].start || '00:00').split(':').map(Number)
      const [eh, em] = (times[0].end || '23:59').split(':').map(Number)
      const start = new Date()
      start.setHours(sh, sm, 0, 0)
      const end = new Date()
      end.setHours(eh, em, 59, 999)
      if (now < start.getTime()) return start.getTime() - now
      if (now < end.getTime()) return end.getTime() - now
      return -(now - end.getTime())
    }
  }
  const [year, month, day] = new Date().toISOString().split('T')[0].split('-').map(Number)
  const midnight = new Date(year, month - 1, day, 23, 59, 59).getTime()
  return midnight + 999 - now
}

function goToExecute(item: any) {
  // 所有状态都能查看项目详情, 只有 pending 可以操作
  const task = item.task
  // 后端 abnormal_images 可能是 JSON 字符串, 解析成数组供模板使用
  if (task && task.abnormal_images) {
    if (typeof task.abnormal_images === 'string') {
      try { task.abnormal_images = JSON.parse(task.abnormal_images) } catch { task.abnormal_images = [] }
    }
    if (!Array.isArray(task.abnormal_images)) task.abnormal_images = []
  } else if (task) {
    task.abnormal_images = []
  }
  showExecuteDialog.value = true
  currentTaskForDialog.value = task
  // 预填上次的检查结果 (包括已完成的) - 已完成会显示勾上但 disabled
  if (task.results) {
    try { checkedItems.value = JSON.parse(task.results) } catch { checkedItems.value = [] }
  } else {
    checkedItems.value = []
  }
  // 预填备注
  executeRemark.value = task.remark || ''
}

// 设备 Modal
const showDeviceModal = ref(false)
const modalDevice = ref<any>(null)

// 工单 Modal
const showWorkOrderModal = ref(false)
const modalOrder = ref<any>(null)

// 打开设备详情弹窗
function openDeviceDetail(device: any) {
  modalDevice.value = device
  showDeviceModal.value = true
}

function closeDeviceModal() {
  showDeviceModal.value = false
  modalDevice.value = null
}

function onDeviceUpdated() {
  loadDevicesFromDB()
}

function onDeviceDeleted() {
  showDeviceModal.value = false
  modalDevice.value = null
  loadDevicesFromDB()
}

// modal 关闭后强制恢复 body 滚动 (修复 n-modal 关闭后滚动条不显示的 bug)
function onModalAfterLeave() {
  // 下一 tick 清理, 避免与 n-modal 自身逻辑冲突
  setTimeout(() => {
    document.documentElement.style.overflow = ''
    document.documentElement.style.overflowY = ''
    document.body.style.overflow = ''
    document.body.style.overflowY = ''
    document.body.style.paddingRight = ''
  }, 50)
}

// 打开工单详情弹窗
function openWorkOrderDetail(order: any) {
  modalOrder.value = order
  showWorkOrderModal.value = true
}

function closeWorkOrderModal() {
  showWorkOrderModal.value = false
  modalOrder.value = null
}

function onWorkOrderUpdated() {
  loadTodayWorkOrders()
  loadDevicesFromDB()
}

// 公告详情 (在主页打开 modal)
const noticeDetail = ref<any>(null)
const showNoticeDialog = ref(false)
function openNoticeDetail(notif: any) {
  // 备件低库存（具体备件）: 跳详情弹窗(带备件信息、颜色、触发时间)
  if (notif._category === 'low_stock' && notif.sparepart) {
    noticeDetail.value = notif
    showNoticeDialog.value = true
    return
  }
  // 设备告警/维修中: 优先跳工单详情弹窗（设备是告警/维修原因），找不到工单则兑底设备详情
  if (notif._category === 'device_alert') {
    if (notif.workOrder) {
      openWorkOrderDetail(notif.workOrder)
      return
    }
    if (notif.device) {
      openDeviceDetail(notif.device)
      return
    }
  }
  // 工单具体记录: 跳工单详情弹窗
  if (notif._category === 'workorder' && notif.workOrder) {
    openWorkOrderDetail(notif.workOrder)
    return
  }
  // 巡检超时: 跳巡检页（让用户能看到具体超时任务）
  if (notif._category === 'inspection') {
    router.push('/inspection')
    return
  }
  // 备件低库存汇总（无具体备件）: 弹汇总弹窗展示所有低库存备件，不跳路由
  if (notif._category === 'sparepart') {
    noticeDetail.value = { _category: 'low_stock_summary', type: 'warning', content: notif.content, time: notif.time }
    showNoticeDialog.value = true
    return
  }
  // 工单 SLA 汇总（没绑定具体工单）: 跳工单列表
  if (notif._category === 'workorder') {
    router.push('/workorder')
    return
  }
  // 其他: 默认弹窗
  noticeDetail.value = notif
  showNoticeDialog.value = true
}
function closeNoticeDetail() {
  showNoticeDialog.value = false
  noticeDetail.value = null
}
function noticeTypeLabel(type: string): string {
  const map: Record<string, string> = { warning: '告警', info: '提示', success: '成功', error: '错误' }
  return map[type] || type
}
// 低库存专用: 完整时间格式（年月日 时分秒）
function formatSparepartTime(t: any): string {
  if (!t) return '未记录'
  const d = new Date(t)
  if (isNaN(d.getTime())) return '未记录'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// 低库存汇总弹窗使用: 从 spareparts 中过滤出低库存备件
// 修复: 用 quantity < min_quantity（与后端 spareparts.js /low-stock-list 一致）, 不再硬编码 < 5
// 注意: 不过滤 lowStockExcludes（电机/水泵/阀门/仪表），汇总弹窗需与后端低库存计数完全对齐
const lowStockSummaryList = computed(() => {
  return spareparts.value
    .filter(sp => {
      const min = Number(sp.min_quantity) || 0
      return min > 0 && Number(sp.quantity) < min
    })
    .sort((a, b) => {
      // 按缺货严重度倒序
      const sa = (a.min_quantity || 5) - a.quantity
      const sb = (b.min_quantity || 5) - b.quantity
      return sb - sa
    })
})
const sparepartsInDialog = computed(() => {
  // 兼容点击弹窗时都拿同一份列表
  if (noticeDetail.value?._category === 'low_stock_summary') return lowStockSummaryList.value
  return []
})

// 从低库存汇总列表点击某条备件 → 进入具体备件详情弹窗
function openLowStockDetail(sp: any) {
  noticeDetail.value = {
    id: sp.id,
    type: 'warning',
    _category: 'low_stock',
    content: `备件「${sp.name}」库存不足，仅剩 ${sp.quantity} 件`,
    time: sp.last_low_stock_at ? new Date(sp.last_low_stock_at).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' }) : '未记录',
    sparepart: {
      id: sp.id,
      name: sp.name,
      type: sp.type,
      quantity: sp.quantity,
      min_quantity: sp.min_quantity || 5,
      location: sp.location,
      vendor: sp.vendor,
      last_low_stock_at: sp.last_low_stock_at
    }
  }
}

// 重置所有巡检相关状态
function resetExecuteState() {
  checkedItems.value = []
  executeRemark.value = ''
  hasAbnormal.value = false
  abnormalDesc.value = ''
  abnormalImages.value = []
  currentTaskForDialog.value = null
}

// 打开异常子弹窗 (主弹窗不关闭, 堆叠显示)
function openAbnormalDialog() {
  if (!currentTaskForDialog.value) return
  showAbnormalDialog.value = true
}

function closeAbnormalDialog() {
  showAbnormalDialog.value = false
}

// 异常图片上传 (不压缩, 直接传原图, 避免点击放大后模糊)
async function handleAbnormalImageUpload(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files || files.length === 0) return
  try {
    const remain = 6 - abnormalImages.value.length
    const fd = new FormData()
    for (const f of Array.from(files).slice(0, remain)) {
      // 原图直接传, 后端 multer 50MB 限额内
      fd.append('files', f, f.name)
    }
    const r = await fetch('/api/upload', { method: 'POST', body: fd })
    if (!r.ok) { alert('上传失败: ' + r.status); return }
    const data = await r.json()
    const urls = data.urls || []
    abnormalImages.value.push(...urls)
  } catch (err: any) {
    alert('上传失败: ' + err.message)
  } finally {
    // 清 input value 允许重复上传同一文件
    (e.target as HTMLInputElement).value = ''
  }
}

// 提交「完成巡检」: 全部勾选, 标记为正常
async function submitTaskComplete() {
  if (!currentTaskForDialog.value) return
  const task = currentTaskForDialog.value
  try {
    const r = await fetch(`${API_BASE}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: task.plan_id,
        device_id: task.device_id,
        device_name: task.device_name,
        executor_id: currentUser.value?.id,
        executor_name: currentUser.value?.name,
        results: checkedItems.value,
        remark: executeRemark.value,
        has_abnormal: false,
        abnormal_desc: '',
        status: 'completed'
      })
    })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    showExecuteDialog.value = false
    resetExecuteState()
    await loadInspectionTasks()
  } catch (err: any) {
    console.error('提交失败', err)
    alert('提交失败: ' + err.message)
  }
}

// 提交「上报异常」
async function submitTaskAbnormal() {
  if (!currentTaskForDialog.value) return
  if (!abnormalDesc.value.trim()) {
    alert('请填写异常描述')
    return
  }
  const task = currentTaskForDialog.value
  try {
    const r = await fetch(`${API_BASE}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: task.plan_id,
        device_id: task.device_id,
        device_name: task.device_name,
        executor_id: currentUser.value?.id,
        executor_name: currentUser.value?.name,
        results: checkedItems.value,
        remark: executeRemark.value,
        has_abnormal: true,
        abnormal_desc: abnormalDesc.value,
        abnormal_images: abnormalImages.value,
        status: 'abnormal'
      })
    })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    showAbnormalDialog.value = false
    showExecuteDialog.value = false
    resetExecuteState()
    await loadInspectionTasks()
  } catch (err: any) {
    console.error('提交异常失败', err)
    alert('提交失败: ' + err.message)
  }
}

// 保留原函数 (备用, 被新函数取代但避免引用报错)
async function submitTaskResultFromMain() {
  if (!currentTaskForDialog.value) return
  // 默认调用完成
  await submitTaskComplete()
}

function formatRemaining(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}小时${m}分`
  return `${m}分钟`
}

onMounted(async () => {
  await loadTeamMembers()
  loadInspectionTasks()
  await loadDevicesFromDB()
  await loadTodayWorkOrders()
  // 加载备件列表（供低库存汇总弹窗过滤本地使用，后端通知只给数量）
  loadSpareparts()
  await loadNotifications()
  loadLeaderShift()
  loadShiftFromAPI()
})

// P1: SSE 订阅 (用 useSSE composable, 共享单条连接)
useSSE('shift-update', async () => {
  await loadLeaderShift()
  await loadShiftFromAPI()
})
useSSE('handover-update', async () => {
  await loadLeaderShift()
  await loadShiftFromAPI()
})
// P1 示例: 设备状态变更 (问题工单 → 告警, 转维修 → 维修中, 闭环 → 在用)
useSSE('device-status-change', async (payload) => {
  console.info('[SSE] 设备状态变更:', payload)
  // loadDevicesFromDB 会更新 deviceListWithStatus, deviceStats 是 computed 自动重算
  await loadDevicesFromDB()
  await loadNotifications()
})
// P1: 工单变更
useSSE('workorder-update', async () => {
  await loadTodayWorkOrders()
  await loadNotifications()
})

onUnmounted(() => {
  // useSSE composable 自己处理清理
})

// 从API获取当班信息（统一班次：所有人显示同一个带班班组信息）
async function loadLeaderShift() {
  try {
    const r = await fetch('/api/handover/all-shifts?role=%E7%B3%BB%E7%BB%9F%E7%AE%A1%E7%90%86%E4%BA%BA&team=B%E7%8F%AD')
    const j = await r.json()
    const leaderEntry = (j.shifts || []).find((s: any) => s.role === '带班')
    const s = leaderEntry?.currentShift || null
    if (s) {
      leaderShift.value = {
        shiftPerson: s.leader_name || s.user_name || '',
        shiftDate: new Date().toLocaleDateString('zh-CN'),
        shiftTime: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        shiftTeam: s.team || '',
        shiftLeader: s.leader_name || '',
        shiftMember: s.member_name || ''
      }
    }
  } catch {}
}

async function loadShiftFromAPI() {
  if (!currentUser.value?.role) return
  try {
    const r = await fetch(`/api/handover/status?role=${encodeURIComponent(currentUser.value.role)}&userId=${currentUser.value.id}`)
    const data = await r.json()
    if (data.currentShift) {
      currentShift.value = {
        shiftPerson: data.currentShift.leader_name || data.currentShift.user_name || currentUser.value.name,
        shiftDate: new Date().toLocaleDateString('zh-CN'),
        shiftTime: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        shiftTeam: data.currentShift.team || '',
        shiftLeader: data.currentShift.leader_name || '',
        shiftMember: data.currentShift.member_name || ''
      }
      setCurrentShiftContext({
        team: data.currentShift.team || '',
        member_name: data.currentShift.member_name || '',
        shift_type: data.currentShift.shift_type || '',
        role: data.currentShift.role || '',
        leader_name: data.currentShift.leader_name || ''
      })
    } else {
      setCurrentShiftContext(null)
    }
  } catch {}
}

const workOrderNotifications = computed(() => {
  // 从今日工单派生: 紧急/超时/待处理, 最多 5 条
  return workOrders.value
    .filter(o => o.level === '紧急' || o.status === '待处理' || o.status === '延时')
    .slice(0, 5)
    .map(o => ({
      id: o.id,
      title: o.title,
      level: o.level,
      time: o.createTime
    }))
})

const handleLogout = () => {
  router.push('/')
}

const openWorkOrderCreateDialog = () => {
  if (['系统管理人', '带班', '维修组'].includes(currentUser.value?.role)) {
    router.push('/workorder?action=createMaintenance')
  } else {
    router.push('/workorder?action=createProblem')
  }
}

const showNotifications = ref(false)

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
}

// 功能导航 (P0-5: 按权限码过滤, 取代旧的 hideFor/roles 字符串判断)
const navItems = ref([
  { name: '驾驶舱',   path: '/main',         icon: '🚀', permission: 'menu:dashboard' },
  { name: '设备管理', path: '/device/inuse', icon: '🖥️', permission: 'menu:device' },
  { name: '巡检保养', path: '/inspection',   icon: '🔍', permission: 'menu:inspection' },
  { name: '备件仓库', path: '/spareparts',   icon: '📦', permission: 'menu:spareparts', roles: ['系统管理人', '维修组'] /* 带班、值班岗位不需备件仓库 */ },
  { name: '班组交接', path: '/handover',     icon: '🔄', permission: 'menu:handover' },
  { name: '维修工单', path: '/workorder',    icon: '🔧', permission: 'menu:workorder' },
  { name: '统计分析', path: '/asset',        icon: '💰', roles: ['系统管理人', '厂长'] /* 仅系统管理人+厂长可见 */ },
  { name: '系统管理', path: '/admin',        icon: '⚙️', permission: 'menu:admin', roles: ['系统管理人'] /* 仅系统管理人可见, 防误入 */ }
])

const activeNav = ref('驾驶舱')

const visibleNavItems = computed(() => navItems.value.filter(item => {
  if (item.permission && !has(item.permission)) return false
  if (item.roles && !item.roles.includes(currentUser.value?.role)) return false
  return true
}))

const handleNavClick = (item: any) => {
  activeNav.value = item.name
  router.push(item.path)
}

// 班组人员配置（从数据库加载）
const teamMembers = ref<Record<string, { member_name: string; leader_name: string }>>({})

async function loadTeamMembers() {
  try {
    const res = await fetch('/api/shift-teams')
    const data = await res.json()
    const map: Record<string, { member_name: string; leader_name: string }> = {}
    for (const t of data) {
      map[t.team_name] = { member_name: t.member_name, leader_name: t.leader_name }
    }
    teamMembers.value = map
  } catch (err) {
    console.error('加载班组信息失败', err)
  }
}

// 当值带班人
const currentShift = ref({
  shiftPerson: '',
  shiftDate: '2026-04-19',
  shiftTime: '08:00 - 20:00',
  shiftTeam: '',
  shiftLeader: '',
  shiftMember: ''
})

// 当前实际带班人（跨角色统一显示）
const leaderShift = ref({
  shiftPerson: '',
  shiftDate: '2026-04-19',
  shiftTime: '08:00 - 20:00',
  shiftTeam: '',
  shiftLeader: '',
  shiftMember: ''
})

// 设备概况统计（来自共享store）
const deviceStatsList = computed(() => [
  { label: '在用设备', value: deviceStats.value.inuse, total: deviceStats.value.total, unit: '台', status: 'online', path: '/device/inuse' },
  { label: '告警设备', value: deviceStats.value.warning, total: deviceStats.value.total, unit: '台', status: 'warning', path: '/device/inuse?status=告警' },
  { label: '维修设备', value: deviceStats.value.maintenance, total: deviceStats.value.total, unit: '台', status: 'maintenance', path: '/device/inuse?status=维修中' },
  { label: '设备变动', value: deviceChangeLog.value.length, total: deviceStats.value.total, unit: '台', status: 'changed', path: '/device/changes' }
])

// 设备列表（维修中优先，其次告警，最后在用，最多10条）
const statusPriority: Record<string, number> = { '维修中': 0, '告警': 1, '在用': 2 }
const deviceListSorted = computed(() => {
  return [...deviceListWithStatus.value]
    .sort((a, b) => (statusPriority[a.status] ?? 9) - (statusPriority[b.status] ?? 9))
    .slice(0, 6)
})

const workOrderPriority: Record<string, number> = { '处理中': 0, '待处理': 1, '已完成': 2, '紧急': 0, '中等': 1, '一般': 2 }
const workOrdersList = computed(() => {
  return [...workOrders.value]
    .sort((a, b) => {
      const statusDiff = (workOrderPriority[a.status] ?? 9) - (workOrderPriority[b.status] ?? 9)
      if (statusDiff !== 0) return statusDiff
      return (workOrderPriority[a.level] ?? 9) - (workOrderPriority[b.level] ?? 9)
    })
    .slice(0, 6)
})

// 今日工单（从后端 API 拉取）
const workOrders = ref<any[]>([])

const statusLabelMap: Record<string, string> = {
  pending: '待处理', to_maintenance: '处理中', delay: '延时',
  returned: '退回', completed: '已完成', closed: '已闭环', self_resolved: '已自处理'
}
const levelLabelMap: Record<string, { label: string; color: string }> = {
  heavy: { label: '紧急', color: '#EF4444' },
  medium: { label: '中等', color: '#F59E0B' },
  light: { label: '普通', color: '#1E6BB8' }
}
function deviceName(id: number | null | undefined): string {
  if (!id) return '--'
  // 注意: deviceListWithStatus 里 id 是 String (loadDevicesFromDB 转换), 工单里 device_id 是 number, 都转 string 再比
  const d = deviceListWithStatus.value.find(x => String(x.id) === String(id))
  return d?.name || `设备#${id}`
}
function mapWorkOrder(o: any, type: 'problem' | 'maintenance') {
  const lv = type === 'problem'
    ? { label: '紧急', color: '#EF4444' }
    : (levelLabelMap[o.level] || { label: '普通', color: '#1E6BB8' })
  return {
    id: type === 'problem' ? `PO-${o.id}` : `WO-${o.id}`,
    _type: type,
    _deviceId: o.device_id,  // 供通知公告通过设备 ID 查找对应工单
    _createdAtMs: new Date(o.created_at).getTime(),
    title: (o.content || '工单').slice(0, 30),
    device: deviceName(o.device_id),
    level: lv.label,
    levelColor: lv.color,
    createTime: new Date(o.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }),
    status: statusLabelMap[o.status] || o.status,
    handler: o.handler_name || o.assigner_name || o.user_name || '--'
  }
}
async function loadTodayWorkOrders() {
  try {
    const headers = authHeader()
    // 同步全量工单到 store (供 WorkOrderDetailPanel 查全量字段: last_action_at, handler_name, device_id 等)
    const { probs, maints } = await loadAllWorkOrders(headers)
    // 不只今日: 拉所有未闭环工单, 按创建时间倒序
    // 问题工单额外排除 to_maintenance (已转维修, 避免重复显示)
    const isProblemOpen = (s: string) => s === 'pending'
    const isMaintOpen = (s: string) => !['completed', 'closed'].includes(s)
    const list = [
      ...probs.filter((p: any) => isProblemOpen(p.status)).map((p: any) => mapWorkOrder(p, 'problem')),
      ...maints.filter((m: any) => isMaintOpen(m.status)).map((m: any) => mapWorkOrder(m, 'maintenance'))
    ]
    // 拿原数据按 created_at 倒序
    list.sort((a: any, b: any) => (b._createdAtMs || 0) - (a._createdAtMs || 0))
    workOrders.value = list
  } catch (err) {
    console.error('加载工单失败', err)
  }
}

// 消息通知（从后端实时告警 + 设备/工单/备件名派生）
const notifications = ref<any[]>([])
async function loadNotifications() {
  try {
    const r = await fetch('/api/dashboard/overview', { headers: authHeader() })
    if (!r.ok) return
    const d = await r.json()
    const now = new Date()
    const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    const list: any[] = []
    let nid = 1
    const a = d.real_time_alerts || {}
    // 维修组只看到维修工单，问题工单对维修组隐藏
    const onlyMaintenance = currentUser.value.role === '维修组'
    // 设备告警 — 为每条设备告警/维修中查找对应的进行中工单
    const findOrderForDevice = (deviceId: any, preferType?: 'problem' | 'maintenance') => {
      const did = String(deviceId ?? '')
      // 优先选指定类型，其次按时间倒序
      const candidates = workOrders.value.filter(o => {
        if (String(o._deviceId ?? '') !== did) return false
        if (onlyMaintenance && o._type !== 'maintenance') return false
        return true
      })
      if (preferType) {
        const matched = candidates.find(o => o._type === preferType)
        if (matched) return matched
      }
      return candidates[0] || null
    }
    // 维修组能看到的工单池（仅维修工单）
    const workOrderPool = onlyMaintenance ? workOrders.value.filter(o => o._type === 'maintenance') : workOrders.value
    const warningDevices = deviceListWithStatus.value.filter(x => x.status === '告警')
    warningDevices.forEach(dev => list.push({
      id: nid++,
      type: 'warning',
      _category: 'device_alert',
      device: dev,
      workOrder: findOrderForDevice(dev.id, 'problem'),  // 告警设备优先关联问题工单
      content: `设备「${dev.name}」告警，请检查`,
      time
    }))
    // 设备维修中 - 优先关联维修工单
    const maintDevices = deviceListWithStatus.value.filter(x => x.status === '维修中')
    maintDevices.forEach(dev => list.push({
      id: nid++,
      type: 'warning',
      _category: 'device_alert',
      device: dev,
      workOrder: findOrderForDevice(dev.id, 'maintenance'),
      content: `设备「${dev.name}」维修中`,
      time
    }))
    // 工单 SLA 超时 - 找一张示例工单弹详情（维修组只看维修工单）
    if (a.workorder_sla_breached) {
      const sampleOrder = workOrderPool.find(o => o._type === 'maintenance' && o.status === 'delay') || workOrderPool[0]
      list.push({ id: nid++, type: 'warning', _category: 'workorder', workOrder: sampleOrder, content: `工单 SLA 超时 ${a.workorder_sla_breached} 个`, time })
    }
    if (a.workorder_sla_warning) list.push({ id: nid++, type: 'info', _category: 'workorder', workOrder: workOrderPool[0], content: `工单 SLA 即将超时 ${a.workorder_sla_warning} 个`, time })
    // 巡检超时 - 跳 /inspection
    if (a.inspection_overdue) list.push({ id: nid++, type: 'warning', _category: 'inspection', content: `巡检任务超时 ${a.inspection_overdue} 个`, time })
    // 备件低库存汇总 - 只对系统管理人 / 维修组可见
    if (['系统管理人', '维修组'].includes(currentUser.value.role) && a.sparepart_low_stock) {
      list.push({ id: nid++, type: 'warning', _category: 'sparepart', content: `备件低库存 ${a.sparepart_low_stock} 种`, time })
    }
    // 插入今日工单已完成的消息（维修组只看维修工单）
    const done = workOrderPool.filter(o => o.status === '已完成' || o.status === '已闭环' || o.status === '已自处理')
    done.slice(0, 3).forEach(o => list.push({ id: nid++, type: 'success', _category: 'workorder', workOrder: o, content: `工单「${o.title}」已处理完成`, time: o.createTime }))
    notifications.value = list
  } catch (err) {
    console.error('加载通知公告失败', err)
  }
}

// 低库存备件提醒（排除电机、水泵、阀门、仪表）
// 低库存备件类别过滤（电机/水泵/阀门/仪表）。统一不再过滤，避免与后端不一致
const lowStockExcludes: string[] = []
const lowStockNotifs = computed(() => {
  // 备件低库存只对系统管理人 / 维修组可见
  if (!['系统管理人', '维修组'].includes(currentUser.value.role)) return []
  return spareparts.value
    // 修复: 用 quantity < min_quantity（与后端一致）, 硬编码 < 5 会漏掉 min_quantity>5 的备件
    .filter(sp => {
      if (lowStockExcludes.some(e => sp.type?.includes(e))) return false
      const min = Number(sp.min_quantity) || 0
      return min > 0 && Number(sp.quantity) < min
    })
    .map(sp => ({
      id: sp.id,
      type: 'warning' as const,
      _category: 'low_stock' as const,
      content: `备件「${sp.name}」库存不足，仅剩 ${sp.quantity} 件`,
      time: sp.last_low_stock_at ? new Date(sp.last_low_stock_at).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' }) : '未记录',
      // 备件详情弹窗需要的额外字段
      sparepart: {
        id: sp.id,
        name: sp.name,
        type: sp.type,
        quantity: sp.quantity,
        min_quantity: sp.min_quantity || 5,
        location: sp.location,
        vendor: sp.vendor,
        last_low_stock_at: sp.last_low_stock_at
      }
    }))
})

// 维修工单延时提醒（带班可见）
const delayNotifs = computed(() => {
  if (currentUser.value.role !== '带班') return []
  return maintenanceOrders.value
    .filter(o => o.status === 'delay')
    .map(o => ({
      id: o.id,
      type: 'warning' as const,
      _category: 'workorder' as const,
      workOrder: o,
      content: `维修工单「${o.id}」申请延时：${o.delayReason || '未填写原因'}`,
      time: o.lastActionAt || ''
    }))
})
const allNotifs = computed(() => [...delayNotifs.value, ...lowStockNotifs.value, ...notifications.value])
const visibleNotifs = computed(() => allNotifs.value.slice(0, 4))
const expandedNotifs = computed(() => allNotifs.value.slice(0, 10))

const showAllNotifs = ref(false)

// 记录通知卡片的原始宽度，hover 展开时使用，保持宽度不变化
const notifCardStyle = ref<Record<string, string>>({})
function onNotifCardEnter(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  // 此时还未应用 expanded class, offsetWidth 为静态宽度
  notifCardStyle.value = { '--notif-w': el.offsetWidth + 'px' }
  showAllNotifs.value = true
}

const getStatusClass = (status: string) => {
  const map: Record<string, string> = {
    '在用': 'online',
    '告警': 'warning',
    '维修中': 'offline'
  }
  return `status-${map[status] || status}`
}

const getLevelClass = (level: string) => {
  return `level-${level.toLowerCase()}`
}
</script>

<template>
  <div class="dashboard-page">
    <WaterBackground />

    <!-- 顶部导航栏 -->
    <header class="top-nav">
      <!-- 左侧：Logo -->
      <div class="nav-left">
        <div class="logo-area">
          <div class="company-logo">
            <svg class="logo-svg" viewBox="0 0 120 120">
              <rect x="4" y="4" width="112" height="112" rx="20" fill="#2a7ab8"/>
              <path d="M16 48 C28 56, 40 40, 60 40 C80 40, 92 52, 104 46" stroke="white" stroke-width="5" fill="none" stroke-linecap="round"/>
              <path d="M12 65 C26 75, 44 55, 64 55 C84 55, 96 72, 108 65" stroke="white" stroke-width="5" fill="none" stroke-linecap="round"/>
              <path d="M14 82 C26 90, 44 70, 64 70 C84 70, 96 86, 106 80" stroke="white" stroke-width="5" fill="none" stroke-linecap="round"/>
            </svg>
          </div>
          <h1 class="system-title">厂部设备管理平台</h1>
        </div>

        <!-- 功能导航菜单 -->
        <nav class="menu-nav">
          <div
            v-for="item in visibleNavItems"
            :key="item.name"
            class="menu-item"
            :class="{ active: activeNav === item.name }"
            @click="handleNavClick(item)"
          >
            <span class="menu-icon">{{ item.icon }}</span>
            <span class="menu-text">{{ item.name }}</span>
          </div>
        </nav>
      </div>

      <!-- 右侧：消息 + 用户 + 退出 -->
      <div class="nav-right">
        <!-- 消息提醒 -->
        <div class="notification-wrapper">
          <div class="notification-bell" @click="toggleNotifications">
            <span class="bell-icon">🔔</span>
            <span class="badge">{{ workOrderNotifications.length }}</span>
          </div>
          <div v-if="showNotifications" class="notification-dropdown">
            <div class="dropdown-title">工单推送</div>
            <div
              v-for="notif in workOrderNotifications"
              :key="notif.id"
              class="dropdown-item"
              :class="`level-${notif.level}`"
            >
              <div class="dropdown-item-title">{{ notif.title }}</div>
              <div class="dropdown-item-meta">
                <span class="level-tag">{{ notif.level }}</span>
                <span class="time">{{ notif.time }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 用户信息 -->
        <div class="user-info">
          <div class="user-avatar">{{ currentShiftContext?.team || currentUser.team || currentUser.avatar }}</div>
          <div class="user-detail">
            <span class="user-name">{{ currentShiftContext?.member_name || currentUser.name }}</span>
            <span class="user-role">{{ currentShiftContext ? currentShiftContext.team + ' · ' + currentShiftContext.shift_type : currentUser.role }}</span>
          </div>
        </div>

        <!-- 退出登录 -->
        <button class="logout-btn" @click="handleLogout">
          <span>退出</span>
        </button>
      </div>
    </header>

    <!-- 公告详情弹窗 -->
    <div v-if="showNoticeDialog && noticeDetail" class="dialog-overlay" @click.self="closeNoticeDetail">
      <div class="dialog dialog-notice-detail" :class="{ 'dialog-low-stock': noticeDetail._category === 'low_stock', 'dialog-low-stock-summary': noticeDetail._category === 'low_stock_summary' }">
        <div class="dialog-header">
          <h3>
            <span class="notif-type-badge" :class="`badge-${noticeDetail.type}`">{{ noticeTypeLabel(noticeDetail.type) }}</span>
            <span v-if="noticeDetail._category === 'low_stock'">备件低库存详情</span>
            <span v-else-if="noticeDetail._category === 'low_stock_summary'">备件低库存汇总</span>
            <span v-else>公告详情</span>
          </h3>
          <button class="dialog-close" @click="closeNoticeDetail">×</button>
        </div>
        <div class="dialog-body">
          <!-- 低库存专用模板: 具体某条备件的详情 -->
          <template v-if="noticeDetail._category === 'low_stock' && noticeDetail.sparepart">
            <div class="lowstock-hero">
              <div class="lowstock-icon">📦</div>
              <div class="lowstock-hero-text">
                <div class="lowstock-name">{{ noticeDetail.sparepart.name }}</div>
                <div class="lowstock-type">{{ noticeDetail.sparepart.type || '未分类' }}</div>
              </div>
            </div>

            <div class="lowstock-grid">
              <div class="lowstock-stat highlight-danger">
                <div class="lowstock-stat-label">当前存量</div>
                <div class="lowstock-stat-value">
                  <span class="big-num">{{ noticeDetail.sparepart.quantity }}</span>
                  <span class="unit">件</span>
                </div>
              </div>
              <div class="lowstock-stat">
                <div class="lowstock-stat-label">最低库存</div>
                <div class="lowstock-stat-value">
                  <span class="big-num">{{ noticeDetail.sparepart.min_quantity }}</span>
                  <span class="unit">件</span>
                </div>
              </div>
              <div class="lowstock-stat highlight-warn">
                <div class="lowstock-stat-label">缺口数量</div>
                <div class="lowstock-stat-value">
                  <span class="big-num">{{ Math.max(0, (noticeDetail.sparepart.min_quantity || 0) - (noticeDetail.sparepart.quantity || 0)) }}</span>
                  <span class="unit">件</span>
                </div>
              </div>
            </div>

            <div class="lowstock-info-list">
              <div class="lowstock-info-row">
                <span class="lowstock-info-key">存放位置</span>
                <span class="lowstock-info-val">{{ noticeDetail.sparepart.location || '未指定' }}</span>
              </div>
              <div class="lowstock-info-row">
                <span class="lowstock-info-key">供应商</span>
                <span class="lowstock-info-val">{{ noticeDetail.sparepart.vendor || '未指定' }}</span>
              </div>
              <div class="lowstock-info-row">
                <span class="lowstock-info-key">备件编号</span>
                <span class="lowstock-info-val">#{{ noticeDetail.sparepart.id }}</span>
              </div>
              <div class="lowstock-info-row">
                <span class="lowstock-info-key">🚨 触发报警时间</span>
                <span class="lowstock-info-val highlight-warn-text">{{ formatSparepartTime(noticeDetail.sparepart.last_low_stock_at) }}</span>
              </div>
            </div>

            <div class="lowstock-tip">
              建议及时补充库存或联系采购，避免影响维修响应。
            </div>
          </template>

          <!-- 低库存汇总模板: 展示所有低库存备件列表，点击进入详情 -->
          <template v-else-if="noticeDetail._category === 'low_stock_summary'">
            <div class="lowstock-summary-header">
              <span class="lowstock-summary-icon">📦</span>
              <span class="lowstock-summary-text">当前共有 <b class="highlight-warn-text">{{ sparepartsInDialog.length }}</b> 种备件低于安全库存</span>
            </div>
            <div class="lowstock-summary-list">
              <div
                v-for="sp in sparepartsInDialog"
                :key="sp.id"
                class="lowstock-summary-row"
                @click="openLowStockDetail(sp)"
              >
                <div class="lowstock-summary-left">
                  <div class="lowstock-summary-name">{{ sp.name }}</div>
                  <div class="lowstock-summary-meta">
                    <span>当前: <b class="highlight-danger">{{ sp.quantity }}</b> 件</span>
                    <span class="dot-sep">·</span>
                    <span>阈值: {{ sp.min_quantity }}</span>
                    <span class="dot-sep">·</span>
                    <span>🚨 {{ formatSparepartTime(sp.last_low_stock_at) }}</span>
                  </div>
                </div>
                <div class="lowstock-summary-arrow">查看详情 →</div>
              </div>
              <div v-if="sparepartsInDialog.length === 0" class="lowstock-summary-empty">暂无低库存备件</div>
            </div>
          </template>

          <!-- 通用模板: 其他类型公告 -->
          <template v-else>
            <div class="notice-detail-content">{{ noticeDetail.content }}</div>
            <div class="notice-detail-meta">
              <span class="notice-detail-time">🕐 {{ noticeDetail.time }}</span>
              <span v-if="noticeDetail.id" class="notice-detail-id">编号: {{ noticeDetail.id }}</span>
            </div>
          </template>
        </div>
        <div class="dialog-footer">
          <button class="btn-cancel" @click="closeNoticeDetail">关闭</button>
        </div>
      </div>
    </div>

    <!-- 执行巡检主弹窗 (n-modal 风格) -->
    <n-modal
      v-model:show="showExecuteDialog"
      :mask-closable="true"
      :on-after-leave="onModalAfterLeave"
      title="执行巡检"
      preset="card"
      class="detail-modal-shell"
      style="width: 600px;"
      :bordered="false"
      size="huge"
    >
      <div v-if="currentTaskForDialog" class="execute-modal-body">
        <!-- 任务信息 -->
        <div class="execute-info">
          <div class="execute-device-row">
            <span class="execute-device">{{ currentTaskForDialog.device_name }}</span>
            <span class="execute-task-id">#{{ currentTaskForDialog.plan_id }}-{{ currentTaskForDialog.device_id }}</span>
          </div>
          <div class="execute-plan">📍 {{ currentTaskForDialog.location || '--' }} · {{ currentTaskForDialog.plan_name }}</div>
        </div>

        <!-- 巡检项目 checklist -->
        <div class="execute-checklist">
          <div class="checklist-title">巡检项目</div>
          <div v-for="(item, idx) in (currentTaskForDialog.check_content || '').split('\n').filter((l: string) => l.trim())" :key="idx" class="check-row" :class="{ 'check-row-disabled': currentTaskForDialog?.is_completed }">
            <input type="checkbox" v-model="checkedItems" :value="item" :id="'mcheck-' + idx" class="check-input" :disabled="currentTaskForDialog?.is_completed" />
            <label :for="'mcheck-' + idx" class="check-label">{{ item }}</label>
          </div>
          <div v-if="!(currentTaskForDialog.check_content || '').trim()" class="checklist-empty">本任务无具体检查项</div>
        </div>

        <!-- 备注 -->
        <div class="execute-remark">
          <label class="remark-label">备注 (可选)</label>
          <textarea v-model="executeRemark" placeholder="如有需要请填写..." rows="2" class="remark-textarea" :disabled="currentTaskForDialog?.is_completed" />
        </div>

        <!-- 历史异常 (只读, 重新打开已异常的任务时显示) -->
        <div v-if="currentTaskForDialog?.abnormal_desc || (currentTaskForDialog?.abnormal_images && currentTaskForDialog.abnormal_images.length)" class="execute-history">
          <div class="history-title">⚠ 异常记录</div>
          <div v-if="currentTaskForDialog?.abnormal_desc" class="history-desc">
            {{ currentTaskForDialog.abnormal_desc }}
          </div>
          <div v-if="currentTaskForDialog?.abnormal_images && currentTaskForDialog.abnormal_images.length" class="history-images">
            <div v-for="(img, idx) in currentTaskForDialog.abnormal_images" :key="idx" class="history-img-link" @click="openLightbox(currentTaskForDialog.abnormal_images, idx)">
              <img :src="img" />
            </div>
          </div>
        </div>
      </div>

      <template #action>
        <div class="execute-modal-footer">
          <button class="dm-btn dm-btn-cancel" @click="showExecuteDialog = false">{{ currentTaskForDialog?.is_completed ? '关闭' : '取消' }}</button>
          <button v-if="!currentTaskForDialog?.is_completed" class="dm-btn dm-btn-danger" @click="openAbnormalDialog">⚠ 上报异常</button>
          <button v-if="!currentTaskForDialog?.is_completed" class="dm-btn dm-btn-primary" @click="submitTaskComplete">✓ 完成巡检</button>
          <span v-else class="execute-status-tag" :class="`status-${currentTaskForDialog?.status}`">
            {{ currentTaskForDialog?.status === 'abnormal' ? '⚠ 异常已上报' : '✓ 已完成' }}
          </span>
        </div>
      </template>
    </n-modal>

    <!-- 上报异常子弹窗 -->
    <n-modal
      v-model:show="showAbnormalDialog"
      :mask-closable="false"
      :on-after-leave="onModalAfterLeave"
      title="上报巡检异常"
      preset="card"
      class="detail-modal-shell"
      style="width: 560px;"
      :bordered="false"
      size="huge"
    >
      <div v-if="currentTaskForDialog" class="abnormal-modal-body">
        <div class="abnormal-task-info">
          <strong>{{ currentTaskForDialog.device_name }}</strong>
          <span class="abnormal-task-id">#{{ currentTaskForDialog.plan_id }}-{{ currentTaskForDialog.device_id }}</span>
        </div>
        <div class="abnormal-field">
          <label class="abnormal-field-label required">异常描述</label>
          <textarea v-model="abnormalDesc" placeholder="详细描述异常情况 (如: 压力偏高/漏水/异响 等)..." rows="4" class="abnormal-textarea" />
        </div>
        <div class="abnormal-field">
          <label class="abnormal-field-label">现场照片 (可选, 最多 6 张)</label>
          <div class="abnormal-images">
            <div v-for="(img, idx) in abnormalImages" :key="idx" class="abnormal-img-preview">
              <img :src="img" />
              <button class="abnormal-img-remove" @click="abnormalImages.splice(idx, 1)">×</button>
            </div>
            <label v-if="abnormalImages.length < 6" class="abnormal-img-upload">
              <input type="file" accept="image/*" multiple @change="handleAbnormalImageUpload" style="display:none" />
              <span>+ 拍照/上传</span>
            </label>
          </div>
        </div>
      </div>
      <template #action>
        <div class="execute-modal-footer">
          <button class="dm-btn dm-btn-cancel" @click="closeAbnormalDialog">取消</button>
          <button class="dm-btn dm-btn-danger" :disabled="!abnormalDesc.trim()" @click="submitTaskAbnormal">提交异常</button>
        </div>
      </template>
    </n-modal>

    <!-- 图片灯箱 (跟工单页统一风格: 固定遮罩 + 左右翻页 + 关闭)
         修复: 用 Teleport 传送到 body 根, 脱离 n-modal 父级 stacking context, 浮在最上层 -->
    <Teleport to="body">
      <div v-if="lightboxImages.length > 0" class="image-preview-mask" @click.self="closeLightbox">
        <button class="image-preview-close" @click="closeLightbox">×</button>
        <button v-if="lightboxImages.length > 1" class="image-preview-nav left" :disabled="lightboxIndex === 0" @click="lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length">‹</button>
        <div class="image-preview-content">
          <img :src="lightboxImages[lightboxIndex]" />
        </div>
        <button v-if="lightboxImages.length > 1" class="image-preview-nav right" :disabled="lightboxIndex === lightboxImages.length - 1" @click="lightboxIndex = (lightboxIndex + 1) % lightboxImages.length">›</button>
      </div>
    </Teleport>

    <!-- 第二行：左侧带班信息卡片 + 右侧通知公告卡片 -->
    <div class="info-row">
      <div class="info-cards-wrapper">
        <!-- 左侧：当值带班人卡片 -->
        <div class="shift-card">
          <div class="shift-content">
            <div class="shift-dot"></div>
            <div class="shift-info">
              <div class="shift-row">
                <span class="shift-name">{{ currentUser.name }}</span>
                <span class="shift-role">{{ currentUser.role }}</span>
              </div>
              <div class="shift-row shift-row-small">
                <span class="shift-info-label">当值带班</span>
                <span class="shift-person-name">{{ leaderShift.shiftMember || leaderShift.shiftLeader || leaderShift.shiftPerson }}</span>
                <span class="shift-sep-inline">|</span>
                <span class="shift-info-label">班组</span>
                <span class="shift-person-name">{{ leaderShift.shiftTeam }}</span>
              </div>
              <span class="shift-time">{{ leaderShift.shiftDate }}&nbsp;{{ leaderShift.shiftTime }}</span>
            </div>
          </div>
          <div class="shift-buttons">
            <button class="shift-btn" @click="openWorkOrderCreateDialog">生成工单</button>
            <button v-if="has('menu:handover')" class="shift-btn" @click="router.push('/handover')">班组交接</button>
          </div>
        </div>


        <!-- 中间：巡检任务 -->
        <div class="inspect-inline">
          <div class="inspect-header">
            <div class="inspect-header-left">
              <span class="inspect-label">🔍 巡检任务</span>
              <span class="inspect-stat done">{{ inspectionPlan.completed }}已完成</span>
              <span class="inspect-sep">/</span>
              <span class="inspect-stat overdue">{{ inspectionPlan.pending }}超时</span>
              <span class="inspect-sep">/</span>
              <span class="inspect-stat total">{{ inspectionPlan.total }}总数</span>
            </div>
            <button class="inspect-btn" @click="router.push('/inspection')">查看详情 →</button>
          </div>
          <div class="inspect-items">
            <div
              v-for="item in inspectionPlan.recentItems"
              :key="item.id"
              class="inspect-item"
              :class="item.status"
              @click="goToExecute(item)"
            >
              <div class="inspect-item-dot"></div>
              <span class="inspect-item-name">{{ item.name }}</span>
              <span class="inspect-item-deadline" :class="item.deadline === '已超时' ? 'overdue' : ''">{{ item.deadline }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：通知公告卡片 -->
      <div
        class="notif-card"
        :class="{ expanded: showAllNotifs }"
        :style="notifCardStyle"
        @mouseenter="onNotifCardEnter"
        @mouseleave="showAllNotifs = false"
      >
        <div class="notif-header">
          <span class="notif-label">通知公告</span>
          <a href="#/notifications" class="notif-more" @click.prevent>更多 →</a>
        </div>
        <div class="notif-list">
          <div
            v-for="notif in (showAllNotifs ? expandedNotifs : visibleNotifs)"
            :key="notif.id"
            class="notif-row clickable"
            :class="`notif-${notif.type}`"
            @click="openNoticeDetail(notif)"
          >
            <div class="notif-dot"></div>
            <span class="notif-text">{{ notif.content }}</span>
            <span class="notif-time">{{ notif.time }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 设备概况 -->
      <div class="section-title">
        <h2>设备概况</h2>
        <span class="refresh-hint">实时更新</span>
      </div>
      <div class="stats-grid">
        <div
          v-for="stat in deviceStatsList"
          :key="stat.label"
          class="stat-card"
          :class="`stat-${stat.status}`"
          @click="router.push(stat.path)"
        >
          <template v-if="stat.status !== 'changed'">
            <div class="stat-value">{{ stat.value }}<span class="stat-unit">{{ stat.unit }}</span></div>
          <div class="stat-label">{{ stat.label }}</div>
          <div class="stat-progress">
            <div class="progress-bar" :style="{ width: `${(stat.value / stat.total) * 100}%` }"></div>
          </div>
            <div class="stat-total">共 {{ stat.total }} {{ stat.unit }}</div>
          </template>
          <template v-else>
            <div class="change-log">
              <div v-for="change in deviceChangeLog" :key="change.id" class="change-item">
                <span class="change-name">{{ change.name }}</span>
                <span class="change-time">{{ change.changeTime }}</span>
              </div>
              <div v-if="deviceChangeLog.length === 0" class="change-empty">暂无变动记录</div>
            </div>
          </template>
        </div>
      </div>

      <!-- 设备列表 & 工单区域 -->
      <div class="two-column">
        <!-- 设备列表 -->
        <div class="panel device-panel">
          <div class="panel-header">
            <h3>设备状态</h3>
            <a href="#" class="more-link" @click.prevent="router.push('/device/inuse?sort=维修中,告警,在用')">查看全部 →</a>
          </div>
          <div class="device-list">
            <div
              v-for="device in deviceListSorted"
              :key="device.id"
              class="device-item clickable"
              @click="openDeviceDetail(device)"
            >
              <div class="device-icon" :class="getStatusClass(device.status)">
                <span v-if="device.status === '在用'">💧</span>
                <span v-else-if="device.status === '告警'">⚠️</span>
                <span v-else>🔧</span>
              </div>
              <div class="device-info">
                <div class="device-name">{{ device.name }}</div>
                <div class="device-id">{{ device.id }}</div>
              </div>
              <div class="device-status" :class="getStatusClass(device.status)">
                {{ device.status }}
              </div>
              <div class="device-temp">{{ device.type }}</div>
            </div>
          </div>
        </div>

        <!-- 维修工单 -->
        <div class="panel order-panel">
          <div class="panel-header">
            <h3>维修工单</h3>
            <a href="#" class="more-link" @click.prevent="router.push('/workorder')">查看全部 →</a>
          </div>
          <div class="order-list">
            <div
              v-for="order in workOrdersList"
              :key="order.id"
              class="order-item clickable"
              @click="openWorkOrderDetail(order)"
            >
              <div class="order-left">
                <div class="order-header">
                  <span class="order-id">{{ order.id }}</span>
                  <span class="order-level" :class="getLevelClass(order.level)">{{ order.level }}</span>
                </div>
                <div class="order-title">{{ order.title }}</div>
                <div class="order-meta">
                  <span>{{ order.device }}</span>
                  <span>{{ order.createTime }}</span>
                </div>
              </div>
              <div class="order-right">
                <div class="order-status" :class="`status-${order.status}`">{{ order.status }}</div>
                <div class="order-handler">{{ order.handler }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </main>

    <!-- 底部 -->
    <footer class="page-footer">
      <p>© 2024 广州市番禺水务股份有限公司</p>
    </footer>

    <!-- 设备详情弹窗 (加宽+加高, 让关联工单区能完整显示, 尽量不滚动) -->
    <n-modal
      v-model:show="showDeviceModal"
      :mask-closable="true"
      :on-after-leave="onModalAfterLeave"
      title="设备详情"
      class="detail-modal-shell"
      style="width: 900px; max-width: 95vw; max-height: 92vh;"
      :bordered="false"
      size="huge"
    >
      <DeviceDetailPanel
        v-if="modalDevice"
        :device="modalDevice"
        @close="closeDeviceModal"
        @updated="onDeviceUpdated"
        @deleted="onDeviceDeleted"
      />
    </n-modal>

    <!-- 工单详情弹窗 -->
    <n-modal
      v-model:show="showWorkOrderModal"
      :mask-closable="true"
      :on-after-leave="onModalAfterLeave"
      title="工单详情"
      class="detail-modal-shell"
      style="width: 800px;"
      :bordered="false"
      size="huge"
    >
      <WorkOrderDetailPanel
        v-if="modalOrder"
        :order-item="modalOrder"
        @close="closeWorkOrderModal"
        @updated="onWorkOrderUpdated"
      />
    </n-modal>
  </div>
</template>

<style scoped>
.dashboard-page {
  position: relative;
  min-height: 100vh;
  background: linear-gradient(160deg, #1a3a5c 0%, #2d5a7b 40%, #1e4a6e 70%, #153550 100%);
  z-index: 0;
}

/* 顶部导航 */
.top-nav {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0;
  height: 64px;
  background: rgba(15, 50, 80, 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(45, 212, 191, 0.2);
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 32px;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* Logo */
.logo-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.company-logo {
  display: flex;
  align-items: center;
  justify-content: center;
}

.company-logo .logo-svg {
  width: 36px;
  height: 36px;
  border-radius: 8px;
}

.system-title {
  font-size: 17px;
  font-weight: 600;
  color: #fff;
  margin: 0;
  letter-spacing: 1px;
}

/* 功能菜单 */
.menu-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 64px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: rgba(255, 255, 255, 0.65);
  font-size: 14px;
  font-weight: 500;
  height: 40px;
  position: relative;
}

.menu-item:hover {
  background: rgba(45, 212, 191, 0.12);
  color: rgba(255, 255, 255, 0.9);
}

.menu-item.active {
  color: #2DD4BF;
  background: rgba(45, 212, 191, 0.15);
}

.menu-item.active::after {
  content: '';
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 3px;
  background: #2DD4BF;
  border-radius: 2px 2px 0 0;
}

.menu-icon {
  font-size: 15px;
}

.menu-text {
  white-space: nowrap;
}

/* 退出按钮 */
.logout-btn {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #FCA5A5;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.22);
  border-color: rgba(239, 68, 68, 0.4);
}

/* 消息提醒下拉 */
.notification-wrapper {
  position: relative;
}

.notification-bell {
  position: relative;
  cursor: pointer;
  font-size: 20px;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.2s;
}

.notification-bell:hover {
  background: rgba(255, 255, 255, 0.1);
}

.notification-bell .badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background: #EF4444;
  color: #fff;
  font-size: 11px;
  padding: 2px 5px;
  border-radius: 10px;
  font-weight: 600;
}

.notification-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  width: 300px;
  background: rgba(15, 50, 80, 0.95);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 12px;
  backdrop-filter: blur(12px);
  overflow: hidden;
  z-index: 100;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.dropdown-title {
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  border-bottom: 1px solid rgba(45, 212, 191, 0.2);
  background: rgba(45, 212, 191, 0.1);
}

.dropdown-item {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: background 0.2s;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.dropdown-item-title {
  color: #fff;
  font-size: 14px;
  margin-bottom: 6px;
}

.dropdown-item-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.level-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.level-紧急 .level-tag {
  background: rgba(239, 68, 68, 0.25);
  color: #FCA5A5;
}

.level-普通 .level-tag {
  background: rgba(30, 107, 184, 0.25);
  color: #93C5FD;
}

.level-定期 .level-tag {
  background: rgba(45, 212, 191, 0.25);
  color: #2DD4BF;
}

.time {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

/* 用户信息 */
.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1E6BB8, #2DD4BF);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  border: 2px solid rgba(45, 212, 191, 0.4);
}

.user-detail {
  display: flex;
  flex-direction: column;
}

.user-name {
  color: #fff;
  font-weight: 600;
  font-size: 13px;
}

.user-role {
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
}

/* 第二行：三个独立卡片 */
.info-row {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 8px 24px 0px;
  background: linear-gradient(160deg, rgba(15, 45, 75, 0.7) 0%, rgba(10, 35, 60, 0.65) 100%);
  border-bottom: 1px solid rgba(45, 212, 191, 0.12);
}

.info-cards-wrapper {
  display: flex;
  gap: 16px;
  flex: 1;
  align-items: stretch;
}

.info-row-right {
  display: flex;
  flex: 1;
  justify-content: flex-end;
  align-items: stretch;
}

/* 左侧：当值带班人卡片 */
.shift-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 4px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.18);
  border-radius: 12px;
  padding: 8px 14px;
  flex-shrink: 0;
  width: 268px;
  height: 180px;
  align-self: flex-start;
}

.shift-content {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding-top: 0;
}

.shift-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2DD4BF;
  animation: pulse 2s ease-in-out infinite;
  flex-shrink: 0;
}

.shift-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: -21px;
}

.shift-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.shift-role-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.shift-row-small {
  flex-direction: row;
  gap: 8px;
  align-items: center;
}

.shift-sep-inline {
  color: rgba(255,255,255,0.3);
  font-size: 11px;
}
.shift-info-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.shift-name {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}

.shift-role {
  font-size: 12px;
  color: #2DD4BF;
  background: rgba(45, 212, 191, 0.15);
  padding: 2px 10px;
  border-radius: 12px;
  font-weight: 500;
}

.shift-person-name {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.shift-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.shift-buttons {
  display: flex;
  gap: 10px;
}

.shift-btn {
  flex: 1;
  padding: 6px 12px;
  background: rgba(45, 212, 191, 0.15);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #2DD4BF;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.shift-btn:hover {
  background: rgba(45, 212, 191, 0.25);
}



/* 中间：巡检任务（行内） */
.inspect-inline {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.15);
  border-radius: 10px;
  padding: 12px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: none;
  width: 610px;
  height: 180px;
  align-self: flex-start;
}

.inspect-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.inspect-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.inspect-label {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-right: 4px;
}

.inspect-stat {
  font-size: 12px;
  font-weight: 600;
}

.inspect-stat.done { color: #22C55E; }
.inspect-stat.overdue { color: #F97316; }
.inspect-stat.total { color: #06B6D4; }

.inspect-sep {
  color: #06B6D4;
  font-size: 12px;
  margin: 0 2px;
}

.inspect-btn {
  background: rgba(45, 212, 191, 0.12);
  border: 1px solid rgba(45, 212, 191, 0.3);
  color: #2DD4BF;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.inspect-btn:hover {
  background: rgba(45, 212, 191, 0.22);
}

.inspect-items {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-rows: minmax(32px, 1fr);
  gap: 2px 16px;
  align-content: start;
  flex: 1;
}

.inspect-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  cursor: pointer;
}

.inspect-item.pending:hover {
  background: rgba(255, 255, 255, 0.06);
}

.inspect-item-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.inspect-item.ok .inspect-item-dot { background: #22C55E; }
.inspect-item.abnormal .inspect-item-dot { background: #EF4444; }
.inspect-item.pending .inspect-item-dot { background: #F97316; }

.inspect-item-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inspect-item-deadline {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.inspect-item-deadline.overdue {
  color: #F97316;
  font-weight: 600;
}

.inspect-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
}

.inspect-count {
  font-size: 16px;
  font-weight: 700;
}

.inspect-slash {
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
}

.inspect-total {
  color: rgba(255, 255, 255, 0.5);
}

.inspect-sep {
  color: rgba(255, 255, 255, 0.25);
  font-size: 13px;
}

.inspect-pending-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.inspect-ok {
  color: #2DD4BF;
}

.inspect-pending-count {
  color: #EF4444;
}

/* 右侧：通知公告卡片 */
.notif-card {
  position: relative;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.15);
  border-radius: 12px;
  padding: 10px 16px;
  flex: 1;
  max-width: 480px;
  min-height: 90px;
  height: 180px;
  align-self: flex-start;
  transition: background 0.25s, box-shadow 0.25s, border-color 0.25s;
  z-index: 1;
}

.notif-card.expanded {
  /* 绝对定位脱离文档流：卡片在原位浮起来覆盖下方面板，不撑高 .info-row，不推下方的设备概况下移 */
  position: absolute;
  /* 跟 .info-row 的 padding (top:8px right:24px) 对齐，贴合原位 */
  top: 8px;
  right: 24px;
  /* 宽度保持静态原值（mouseenter 时记录到 CSS 变量），不会随 hover 变化 */
  width: var(--notif-w, 480px);
  height: auto;
  max-height: 360px;
  overflow-y: auto;
  background: rgba(15, 50, 80, 0.95);
  border-color: rgba(45, 212, 191, 0.5);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  z-index: 50;          /* 高过 .main-content (z:5) */
}

.notif-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.notif-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}


.notif-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notif-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
  overflow: hidden;
}

.notif-row:hover {
  background: rgba(255, 255, 255, 0.06);
}
.notif-row.clickable { cursor: pointer; }

.notif-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.notif-row.notif-warning .notif-dot { background: #F59E0B; }
.notif-row.notif-info .notif-dot { background: #60A5FA; }
.notif-row.notif-success .notif-dot { background: #2DD4BF; }

.notif-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-time {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
}

.notif-more {
  font-size: 11px;
  color: #2DD4BF;
  text-decoration: none;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.15s;
}

.notif-more:hover {
  background: rgba(45, 212, 191, 0.1);
}

/* 主内容区 */
.main-content {
  position: relative;
  z-index: 5;
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 32px 40px;
}

/* 当值带班人卡片 */
.shift-card {
  background: linear-gradient(135deg, rgba(30, 107, 184, 0.4), rgba(45, 212, 191, 0.3));
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 16px;
  padding: 24px 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
  backdrop-filter: blur(8px);
}

.shift-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 8px;
}

.shift-detail {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 6px;
}

.shift-name {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
}

.shift-role {
  font-size: 16px;
  color: #2DD4BF;
  background: rgba(45, 212, 191, 0.15);
  padding: 4px 12px;
  border-radius: 20px;
}

.shift-time {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.shift-status {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #2DD4BF;
  font-weight: 600;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2DD4BF;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.2); }
}

/* 区块标题 */
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-title h2 {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.refresh-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

/* 设备概况统计 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  backdrop-filter: blur(8px);
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}

.stat-unit {
  font-size: 14px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.6);
  margin-left: 4px;
}

.stat-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 12px;
}

.stat-progress {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s ease-out;
}

.stat-online .progress-bar { background: #2DD4BF; }
.stat-warning .progress-bar { background: #F59E0B; }
.stat-offline .progress-bar { background: #EF4444; }
.stat-ok .progress-bar { background: #10B981; }

.stat-total {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.stat-online { border-left: 3px solid #2DD4BF; }
.stat-warning { border-left: 3px solid #F59E0B; }
.stat-offline { border-left: 3px solid #EF4444; }
.stat-ok { border-left: 3px solid #10B981; }

.change-log {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.change-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
}

.change-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100px;
}

.change-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
}

.change-empty {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  padding: 8px 0;
}

/* 双列布局 */
.two-column {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 28px;
}

.panel {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  backdrop-filter: blur(8px);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.more-link {
  font-size: 13px;
  color: #2DD4BF;
  text-decoration: none;
  transition: opacity 0.2s;
}

.more-link:hover {
  opacity: 0.8;
}

/* 设备列表 */
.device-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.device-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  transition: background 0.2s;
}

.device-item:hover {
  background: rgba(0, 0, 0, 0.3);
}
.device-item.clickable { cursor: pointer; }

.device-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.device-icon.status-online { background: rgba(45, 212, 191, 0.2); }
.device-icon.status-warning { background: rgba(245, 158, 11, 0.2); }
.device-icon.status-offline { background: rgba(239, 68, 68, 0.2); }

.device-info {
  flex: 1;
}

.device-name {
  color: #fff;
  font-weight: 500;
  font-size: 14px;
}

.device-id {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.device-status {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.device-status.status-online {
  background: rgba(45, 212, 191, 0.2);
  color: #2DD4BF;
}

.device-status.status-warning {
  background: rgba(245, 158, 11, 0.2);
  color: #F59E0B;
}

.device-status.status-offline {
  background: rgba(239, 68, 68, 0.2);
  color: #EF4444;
}

.device-temp {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  min-width: 40px;
  text-align: right;
}

/* 工单列表 */
.order-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.order-item {
  display: flex;
  justify-content: space-between;
  padding: 14px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  transition: background 0.2s;
}

.order-item:hover {
  background: rgba(0, 0, 0, 0.3);
}
.order-item.clickable { cursor: pointer; }

.order-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.order-id {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-family: monospace;
}

.order-level {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.level-紧急 { background: rgba(239, 68, 68, 0.25); color: #FCA5A5; }
.level-中等 { background: rgba(245, 158, 11, 0.25); color: #FCD34D; }
.level-一般 { background: rgba(59, 130, 246, 0.25); color: #93C5FD; }
.level-普通 { background: rgba(30, 107, 184, 0.25); color: #93C5FD; }
.level-定期 { background: rgba(45, 212, 191, 0.25); color: #2DD4BF; }

.order-title {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.order-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.order-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.order-status {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.order-status.status-处理中 { background: rgba(245, 158, 11, 0.25); color: #FBBF24; font-weight: 600; }
.order-status.status-待处理 { background: rgba(30, 107, 184, 0.3); color: #93C5FD; font-weight: 600; }
.order-status.status-已完成 { background: rgba(16, 185, 129, 0.3); color: #6EE7B7; font-weight: 600; }
.order-status.status-延时 { background: rgba(234, 179, 8, 0.3); color: #FDE047; font-weight: 600; }
.order-status.status-退回 { background: rgba(239, 68, 68, 0.3); color: #FCA5A5; font-weight: 600; }
.order-status.status-已闭环 { background: rgba(16, 185, 129, 0.3); color: #6EE7B7; font-weight: 600; }
.order-status.status-已自处理 { background: rgba(139, 92, 246, 0.3); color: #C4B5FD; font-weight: 600; }

.order-handler {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);  /* 改亮: 0.4 → 0.85, 提升对比度 */
  font-weight: 500;
}

/* 快捷功能 */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}

.action-card {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 20px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}

.action-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--card-color);
  opacity: 0;
  transition: opacity 0.2s;
}

.action-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
  border-color: var(--card-color);
  background: rgba(255, 255, 255, 0.1);
}

.action-card:hover::before {
  opacity: 1;
}

.action-icon {
  font-size: 28px;
  margin-bottom: 10px;
}

.action-name {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
}

/* 通知公告 */
.notifications {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 24px;
}

.notif-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  border-left: 3px solid;
}

.notif-warning { border-left-color: #F59E0B; }
.notif-info { border-left-color: #1E6BB8; }
.notif-success { border-left-color: #10B981; }

.notif-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.notif-warning .notif-dot { background: #F59E0B; }
.notif-info .notif-dot { background: #1E6BB8; }
.notif-success .notif-dot { background: #10B981; }

.notif-content {
  flex: 1;
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
}

.notif-time {
  color: rgba(255, 255, 255, 0.35);
  font-size: 12px;
}

/* 底部 */
.page-footer {
  text-align: center;
  padding: 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.page-footer p {
  margin: 0;
}

/* 执行巡检弹窗 */
.execute-info {
  margin-bottom: 16px;
}

.execute-device {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.execute-plan {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.execute-checklist {
  margin-bottom: 16px;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  margin-bottom: 8px;
}

.check-box-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.check-input {
  width: 20px;
  height: 20px;
  min-width: 20px;
  accent-color: #2DD4BF;
  cursor: pointer;
}

.check-label {
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  cursor: pointer;
  flex: 1;
}

.abnormal-section {
  margin-top: 12px;
}

.abnormal-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 10px;
}

.abnormal-label input {
  width: 18px;
  height: 18px;
  accent-color: #fb923c;
}

.abnormal-section textarea {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(251, 146, 60, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 10px;
  font-size: 14px;
  resize: vertical;
  box-sizing: border-box;
}

.dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #0f3248;
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 12px;
  width: 520px;
  max-height: 80vh;
  overflow-y: auto;
}
.dialog-notice-detail { width: 480px; }
.dialog-low-stock { width: 560px; max-width: 95vw; }
.dialog-low-stock-summary { width: 600px; max-width: 95vw; }

/* ===== 低库存弹窗专用样式 ===== */
.lowstock-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(245, 158, 11, 0.12));
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 10px;
  margin-bottom: 18px;
}
.lowstock-icon { font-size: 36px; line-height: 1; }
.lowstock-hero-text { flex: 1; min-width: 0; }
.lowstock-name {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  word-break: break-all;
  line-height: 1.3;
}
.lowstock-type {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 4px;
}

.lowstock-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 18px;
}
.lowstock-stat {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px 8px;
  text-align: center;
}
.lowstock-stat.highlight-danger {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.5);
}
.lowstock-stat.highlight-warn {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.45);
}
.lowstock-stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 6px;
}
.lowstock-stat-value {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 3px;
}
.lowstock-stat-value .big-num {
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
  color: #fff;
}
.lowstock-stat.highlight-danger .big-num { color: #FCA5A5; }
.lowstock-stat.highlight-warn .big-num { color: #FCD34D; }
.lowstock-stat-value .unit {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.lowstock-info-list {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 4px 12px;
  margin-bottom: 14px;
}
.lowstock-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.06);
  font-size: 13px;
}
.lowstock-info-row:last-child { border-bottom: none; }
.lowstock-info-key {
  color: rgba(255, 255, 255, 0.55);
}
.lowstock-info-val {
  color: rgba(255, 255, 255, 0.85);
  text-align: right;
  word-break: break-all;
}
.highlight-warn-text {
  color: #FCD34D !important;
  font-weight: 600;
}

.lowstock-tip {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  background: rgba(45, 212, 191, 0.08);
  border-left: 3px solid #2DD4BF;
  padding: 8px 12px;
  border-radius: 4px;
  line-height: 1.6;
}

/* ===== 低库存汇总弹窗样式 ===== */
.lowstock-summary-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
}
.lowstock-summary-icon { font-size: 22px; }
.lowstock-summary-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
  /* 细滚动条，避免遮挡视觉 */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}
.lowstock-summary-list::-webkit-scrollbar { width: 6px; }
.lowstock-summary-list::-webkit-scrollbar-track { background: transparent; }
.lowstock-summary-list::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 3px; }
.lowstock-summary-list::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
.lowstock-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.lowstock-summary-row:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.5);
  /* 不用 transform 避免整体内容偏移 */
}
.lowstock-summary-row:active { /* noop */ }
.lowstock-summary-left { flex: 1; min-width: 0; }
.lowstock-summary-name {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
  word-break: break-all;
}
.lowstock-summary-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.lowstock-summary-meta b.highlight-danger { color: #FCA5A5; }
.dot-sep { color: rgba(255, 255, 255, 0.3); margin: 0 2px; }
.lowstock-summary-arrow {
  font-size: 13px;
  color: #2DD4BF;
  flex-shrink: 0;
  white-space: nowrap;
}
.lowstock-summary-empty {
  text-align: center;
  padding: 24px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}
.notif-type-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  margin-right: 8px;
  font-weight: 500;
}
.notif-type-badge.badge-warning { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
.notif-type-badge.badge-info { background: rgba(96, 165, 250, 0.2); color: #93c5fd; }
.notif-type-badge.badge-success { background: rgba(45, 212, 191, 0.2); color: #2dd4bf; }
.notif-type-badge.badge-error { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
.notice-detail-content {
  font-size: 16px;
  line-height: 1.7;
  color: rgba(255,255,255,0.92);
  padding: 12px 4px;
  white-space: pre-wrap;
  word-break: break-word;
}
.notice-detail-meta {
  display: flex;
  gap: 16px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.08);
  font-size: 12px;
  color: rgba(255,255,255,0.5);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(45, 212, 191, 0.1);
}

.dialog-header h3 {
  color: #fff;
  font-size: 18px;
  margin: 0;
}

.dialog-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 22px;
  cursor: pointer;
}

.dialog-body {
  padding: 20px 24px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgba(45, 212, 191, 0.1);
}

.btn-cancel {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.6);
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.btn-confirm {
  background: rgba(45, 212, 191, 0.15);
  border: 1px solid rgba(45, 212, 191, 0.4);
  color: #2DD4BF;
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.btn-confirm:hover {
  background: rgba(45, 212, 191, 0.25);
}
</style>

<style scoped>
/* ====== 执行巡检弹窗 (n-modal 内) ====== */
.execute-modal-body { padding: 4px 0 12px; }
.execute-info { background: rgba(45, 212, 191, 0.08); border: 1px solid rgba(45, 212, 191, 0.2); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
.execute-device-row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.execute-device { font-size: 16px; font-weight: 600; color: #fff; }
.execute-task-id { font-family: ui-monospace, monospace; font-size: 12px; color: rgba(255, 255, 255, 0.5); background: rgba(255, 255, 255, 0.05); padding: 2px 8px; border-radius: 4px; }
.execute-plan { font-size: 12px; color: rgba(255, 255, 255, 0.6); }
.execute-checklist { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.checklist-title { font-size: 12px; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; font-weight: 600; }
.check-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: rgba(255, 255, 255, 0.04); border-radius: 6px; cursor: pointer; }
.check-row:hover { background: rgba(255, 255, 255, 0.07); }
.check-input { width: 16px; height: 16px; cursor: pointer; accent-color: #2DD4BF; }
.check-label { color: rgba(255, 255, 255, 0.9); font-size: 14px; cursor: pointer; flex: 1; }
.checklist-empty { padding: 12px; text-align: center; color: rgba(255, 255, 255, 0.4); font-size: 13px; background: rgba(255, 255, 255, 0.02); border-radius: 6px; }
.check-row-disabled { opacity: 0.5; cursor: not-allowed; }
.check-row-disabled .check-input { cursor: not-allowed; }
.check-row-disabled .check-label { cursor: not-allowed; }
.remark-textarea:disabled { background: rgba(0, 0, 0, 0.15); color: rgba(255, 255, 255, 0.55); cursor: not-allowed; border-color: rgba(45, 212, 191, 0.1); }
.history-images { display: flex; flex-wrap: wrap; gap: 6px; max-height: 200px; overflow-y: auto; }
/* 异常记录区 (修复: 之前仅 .history-images 有样式, .execute-history/.history-title/.history-desc 三个类都漏了) */
.execute-history { margin-top: 14px; padding: 12px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 6px; }
.history-title { font-size: 13px; font-weight: 600; color: #FCA5A5; margin-bottom: 8px; }
.history-desc { font-size: 13px; color: rgba(255, 255, 255, 0.85); line-height: 1.5; padding: 8px 10px; background: rgba(0, 0, 0, 0.2); border-radius: 4px; margin-bottom: 8px; white-space: pre-wrap; word-break: break-word; }
.history-img-link { width: 44px; height: 44px; border-radius: 4px; overflow: hidden; cursor: pointer; border: 1px solid rgba(239, 68, 68, 0.3); flex-shrink: 0; transition: transform 0.15s; }
.history-img-link:hover { transform: scale(1.1); border-color: #EF4444; }
.history-img-link img { width: 100%; height: 100%; object-fit: cover; display: block; }

.execute-remark { margin-bottom: 12px; }
.remark-label { display: block; font-size: 12px; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 600; }
.remark-textarea { width: 100%; box-sizing: border-box; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(45, 212, 191, 0.2); border-radius: 6px; padding: 8px 10px; color: #fff; font-size: 13px; resize: vertical; font-family: inherit; }
.remark-textarea:focus { outline: none; border-color: #2DD4BF; }

.execute-modal-footer { display: flex; justify-content: flex-end; gap: 10px; }

/* ====== 异常子弹窗 ====== */
.abnormal-modal-body { padding: 4px 0 12px; }
.abnormal-task-info { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding: 10px 14px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; }
.abnormal-task-info strong { color: #fff; font-size: 14px; }
.abnormal-task-id { font-family: ui-monospace, monospace; font-size: 12px; color: rgba(255, 255, 255, 0.6); }
.abnormal-field { margin-bottom: 14px; }
.abnormal-field-label { display: block; font-size: 12px; color: rgba(255, 255, 255, 0.7); margin-bottom: 6px; font-weight: 500; }
.abnormal-field-label.required::after { content: ' *'; color: #EF4444; }
.abnormal-textarea { width: 100%; box-sizing: border-box; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 8px 10px; color: #fff; font-size: 13px; resize: vertical; font-family: inherit; }
.abnormal-textarea:focus { outline: none; border-color: #EF4444; }
.abnormal-images { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.abnormal-img-preview { position: relative; aspect-ratio: 1; border-radius: 6px; overflow: hidden; border: 1px solid rgba(45, 212, 191, 0.2); }
.abnormal-img-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
.abnormal-img-remove { position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; background: rgba(0, 0, 0, 0.6); border: none; color: #fff; border-radius: 50%; cursor: pointer; font-size: 14px; line-height: 1; }
.abnormal-img-remove:hover { background: rgba(239, 68, 68, 0.8); }
.abnormal-img-upload { display: flex; align-items: center; justify-content: center; aspect-ratio: 1; background: rgba(255, 255, 255, 0.04); border: 1px dashed rgba(45, 212, 191, 0.3); border-radius: 6px; cursor: pointer; color: rgba(255, 255, 255, 0.5); font-size: 13px; transition: all 0.15s; }
.abnormal-img-upload:hover { background: rgba(45, 212, 191, 0.08); border-color: #2DD4BF; color: #2DD4BF; }
.dm-btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
.execute-status-tag { padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; }
.execute-status-tag.status-completed { background: rgba(16, 185, 129, 0.2); color: #6EE7B7; }
.execute-status-tag.status-abnormal { background: rgba(239, 68, 68, 0.2); color: #FCA5A5; }

/* 图片灯箱 (修复: 之前漏了 CSS, 导致点击图片只空出块状区域, 关闭按钮也错位)
   z-index 9999 > n-modal 默认 2000, 浮在执行巡检弹窗之上 */
.image-preview-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center; }
.image-preview-content { max-width: 90vw; max-height: 90vh; }
.image-preview-content img { max-width: 100%; max-height: 90vh; object-fit: contain; }
.image-preview-close { position: absolute; top: 20px; right: 20px; width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.15); color: #fff; border: none; font-size: 18px; cursor: pointer; }
.image-preview-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.15); color: #fff; border: none; font-size: 24px; cursor: pointer; }
.image-preview-nav.left { left: 20px; }
.image-preview-nav.right { right: 20px; }
.image-preview-nav:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
