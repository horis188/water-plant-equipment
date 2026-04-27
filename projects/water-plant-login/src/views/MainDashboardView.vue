<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import WaterBackground from '../components/WaterBackground.vue'
import { deviceStats, deviceListWithStatus, deviceChangeLog, currentUser } from '../composables/useDeviceStore'
import { spareparts } from '../composables/useSparepartStore'
import { maintenanceOrders } from '../composables/useWorkOrderStore'

const API_BASE = '/api/inspection'
const router = useRouter()

// 巡检任务（从后端实时加载）
const inspectionTasks = ref<any[]>([])
const showExecuteDialog = ref(false)
const currentTaskForDialog = ref<any>(null)
const checkedItems = ref<string[]>([])
const hasAbnormal = ref(false)
const abnormalDesc = ref('')

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
  if (item.status !== 'pending') return
  const task = item.task
  showExecuteDialog.value = true
  currentTaskForDialog.value = task
}

async function submitTaskResultFromMain() {
  if (!currentTaskForDialog.value) return
  try {
    await fetch(`${API_BASE}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: currentTaskForDialog.value.plan_id,
        device_id: currentTaskForDialog.value.device_id,
        device_name: currentTaskForDialog.value.device_name,
        executor_id: currentUser.value?.id,
        executor_name: currentUser.value?.name,
        results: checkedItems.value,
        has_abnormal: hasAbnormal.value,
        abnormal_desc: abnormalDesc.value
      })
    })
    showExecuteDialog.value = false
    checkedItems.value = []
    hasAbnormal.value = false
    abnormalDesc.value = ''
    currentTaskForDialog.value = null
    await loadInspectionTasks()
  } catch (err) {
    console.error('提交失败', err)
    alert('提交失败')
  }
}

function formatRemaining(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}小时${m}分`
  return `${m}分钟`
}

onMounted(() => {
  loadInspectionTasks()
})

const workOrderNotifications = ref([
  { id: 1, title: '3号取水泵温度异常', level: '紧急', time: '09:23' },
  { id: 2, title: '1号滤池滤料更换', level: '普通', time: '08:00' },
  { id: 3, title: '水质监测设备校准', level: '定期', time: '10:00' }
])

const handleLogout = () => {
  router.push('/')
}

const showNotifications = ref(false)

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
}

// 功能导航
const navItems = ref([
  { name: '驾驶舱', path: '/main', icon: '🚀' },
  { name: '设备管理', path: '/device/inuse', icon: '🖥️' },
  { name: '巡检保养', path: '/inspection', icon: '🔍' },
  { name: '备件仓库', path: '/spareparts', icon: '📦' },
  { name: '班组交接', path: '/handover', icon: '🔄' },
  { name: '维修工单', path: '/workorder', icon: '🔧' },
  { name: '统计分析', path: '/asset', icon: '💰' },
  { name: '系统管理', path: '/admin', icon: '⚙️' }
])

const activeNav = ref('驾驶舱')

const handleNavClick = (item: any) => {
  activeNav.value = item.name
  router.push(item.path)
}

// 当值带班人
const currentShift = ref({
  shiftPerson: '张远',
  shiftDate: '2026-04-19',
  shiftTime: '08:00 - 20:00'
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

// 今日工单
const workOrders = ref([
  { id: 'WO-2026041901', title: '3号取水泵温度异常', device: '3号取水泵', level: '紧急', levelColor: '#EF4444', createTime: '09:23', status: '处理中', handler: '李伟' },
  { id: 'WO-2026041902', title: '1号滤池滤料更换', device: '1号滤池', level: '一般', levelColor: '#93C5FD', createTime: '08:00', status: '待处理', handler: '--' },
  { id: 'WO-2026041903', title: '加药间2号计量泵检修', device: '加药间', level: '普通', levelColor: '#1E6BB8', createTime: '07:30', status: '已完成', handler: '王强' },
  { id: 'WO-2026041904', title: '水质监测设备校准', device: '水质监测站', level: '中等', levelColor: '#F59E0B', createTime: '10:00', status: '待处理', handler: '--' }
])

// 消息通知
const notifications = ref([
  { id: 1, type: 'warning', content: '3号取水泵温度超过75°C，请及时处理', time: '09:23' },
  { id: 2, type: 'info', content: '今日设备巡检计划已完成 42/60 项', time: '10:30' },
  { id: 3, type: 'success', content: '加药间2号计量泵检修完成', time: '08:45' },
  { id: 4, type: 'info', content: '1号滤池滤料更换工单待处理', time: '08:00' },
  { id: 5, type: 'warning', content: '2号送水泵压力异常，请检查', time: '11:15' },
  { id: 6, type: 'success', content: '水质监测设备校准完成', time: '14:00' },
  { id: 7, type: 'info', content: '下周设备保养计划已排定', time: '15:30' },
  { id: 8, type: 'warning', content: '加药间液位计读数偏低', time: '16:20' },
  { id: 9, type: 'info', content: '备件仓库新到一批滤芯', time: '09:00' },
  { id: 10, type: 'success', content: '4号取水泵维修工单已结单', time: '17:00' }
])

// 低库存备件提醒（排除电机、水泵、阀门、仪表）
const lowStockExcludes = ['电机', '水泵', '阀门', '仪表']
const lowStockNotifs = computed(() => {
  if (currentUser.value.role !== '系统管理人') return []
  return spareparts.value
    .filter(sp => !lowStockExcludes.some(e => sp.type.includes(e)) && sp.quantity < 5)
    .map(sp => ({
      id: sp.id,
      type: 'warning' as const,
      content: `备件「${sp.name}」库存不足，仅剩 ${sp.quantity} 件`,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
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
      content: `维修工单「${o.id}」申请延时：${o.delayReason}`,
      time: ''
    }))
})
const allNotifs = computed(() => [...delayNotifs.value, ...lowStockNotifs.value, ...notifications.value])
const visibleNotifs = computed(() => allNotifs.value.slice(0, 4))
const expandedNotifs = computed(() => allNotifs.value.slice(0, 10))

const showAllNotifs = ref(false)

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
            v-for="item in navItems"
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
          <div class="user-avatar">{{ currentUser.team || currentUser.avatar }}</div>
          <div class="user-detail">
            <span class="user-name">{{ currentUser.name }}</span>
            <span class="user-role">{{ currentUser.role }}</span>
          </div>
        </div>

        <!-- 退出登录 -->
        <button class="logout-btn" @click="handleLogout">
          <span>退出</span>
        </button>
      </div>
    </header>

    <!-- 执行巡检弹窗（从主页直接弹出） -->
    <div v-if="showExecuteDialog" class="dialog-overlay" @click.self="showExecuteDialog = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>执行巡检</h3>
          <button class="dialog-close" @click="showExecuteDialog = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="execute-info">
            <div class="execute-device">{{ currentTaskForDialog?.device_name }}</div>
            <div class="execute-plan">📍{{ currentTaskForDialog?.location }} · {{ currentTaskForDialog?.plan_name }}</div>
          </div>
          <div class="execute-checklist">
            <div v-for="(item, idx) in (currentTaskForDialog?.check_content || '').split('\n').filter((l: string) => l.trim())" :key="idx" class="check-row">
              <div class="check-box-wrap">
                <input type="checkbox" v-model="checkedItems" :value="item" :id="'mcheck-' + idx" class="check-input" />
                <label :for="'mcheck-' + idx" class="check-label">{{ item }}</label>
              </div>
            </div>
          </div>
          <div class="abnormal-section">
            <label class="abnormal-label">
              <input type="checkbox" v-model="hasAbnormal" class="check-input" />
              <span>发现异常</span>
            </label>
            <textarea v-if="hasAbnormal" v-model="abnormalDesc" placeholder="描述异常情况..." rows="3"></textarea>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-cancel" @click="showExecuteDialog = false">取消</button>
          <button class="btn-confirm" @click="submitTaskResultFromMain">提交巡检结果</button>
        </div>
      </div>
    </div>

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
                <span class="shift-person-name">{{ currentShift.shiftPerson }}</span>
              </div>
              <span class="shift-time">{{ currentShift.shiftDate }}&nbsp;{{ currentShift.shiftTime }}</span>
            </div>
          </div>
          <div class="shift-buttons">
            <button class="shift-btn">生成工单</button>
            <button class="shift-btn" @click="router.push('/handover')">班组交接</button>
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
        @mouseenter="showAllNotifs = true"
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
            class="notif-row"
            :class="`notif-${notif.type}`"
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
              class="device-item"
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
            <a href="#" class="more-link">查看全部 →</a>
          </div>
          <div class="order-list">
            <div
              v-for="order in workOrdersList"
              :key="order.id"
              class="order-item"
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
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.shift-row-small {
  gap: 8px;
  align-items: center;
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
  position: absolute;
  right: 24px;
  top: 0;
  width: 490px;
  background: rgba(15, 50, 80, 0.9);
  border-color: rgba(45, 212, 191, 0.4);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  z-index: 100;
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

.order-status.status-处理中 { background: rgba(245, 158, 11, 0.2); color: #F59E0B; }
.order-status.status-待处理 { background: rgba(30, 107, 184, 0.2); color: #93C5FD; }
.order-status.status-已完成 { background: rgba(16, 185, 129, 0.2); color: #6EE7B7; }

.order-handler {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
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
