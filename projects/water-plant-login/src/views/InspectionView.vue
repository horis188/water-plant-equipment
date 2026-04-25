<template>
  <div class="ins-page">
    <TopNavBar />
    
    <!-- 页面标题区 -->
    <div class="ins-header">
      <div class="header-left">
        <h2 class="page-title">巡检保养</h2>
        <span class="page-date">{{ today }}</span>
      </div>
      <!-- 非管理员显示我的巡检统计 -->
      <div class="header-stats" v-if="currentUser?.role !== '系统管理人'">
        <div class="stat-pill stat-teal">
          <span class="stat-dot"></span>
          今日巡检 {{ myDoneCount }}/{{ myTasks.length }}
        </div>
        <div class="stat-pill stat-red">
          <span class="stat-dot"></span>
          有异常 {{ myAbnormalCount }}
        </div>
        <div class="stat-pill stat-orange">
          <span class="stat-dot"></span>
          待处理 {{ myPendingCount }}
        </div>
      </div>
      <!-- 管理员显示我的巡检统计 -->
      <div class="header-stats" v-else>
        <div class="stat-pill stat-teal">
          <span class="stat-dot"></span>
          今日巡检 {{ myDoneCount }}/{{ myTasks.length }}
        </div>
        <div class="stat-pill stat-red">
          <span class="stat-dot"></span>
          有异常 {{ myAbnormalCount }}
        </div>
        <div class="stat-pill stat-orange">
          <span class="stat-dot"></span>
          待处理 {{ myPendingCount }}
        </div>
      </div>
    </div>

    <!-- Tab 切换区 -->
    <div class="ins-tabs">
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'inspection' }"
        @click="activeTab = 'inspection'"
      >
        <span class="tab-icon">🔍</span>
        巡检计划
        <span class="tab-count">{{ myPendingCount }}</span>
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'maintenance' }"
        @click="activeTab = 'maintenance'"
      >
        <span class="tab-icon">🔧</span>
        保养计划
        <span class="tab-count" v-if="upcomingMaintCount > 0">{{ upcomingMaintCount }}</span>
      </button>
    </div>

    <!-- 巡检计划内容 -->
    <div v-show="activeTab === 'inspection'" class="tab-content">
      <!-- 管理按钮（仅管理员可见） -->
      <div class="section-toolbar" v-if="isAdmin">
        <button class="btn-admin" @click="showAdminPanel = !showAdminPanel">
          {{ showAdminPanel ? '收起计划管理' : '⚙️ 管理巡检计划' }}
        </button>
      </div>

      <!-- 计划管理面板（仅管理员） -->
      <div v-if="showAdminPanel && isAdmin" class="admin-panel">
        <div class="admin-panel-header">
          <span class="admin-title">巡检计划管理</span>
          <button class="btn-create-plan" @click="showCreateDialog = true">+ 新建计划</button>
        </div>
        <div v-if="plans.length === 0" class="plans-empty">暂无巡检计划，请创建</div>
        <div v-for="plan in plans" :key="plan.id" class="plan-item">
          <div class="plan-item-info">
            <span class="plan-item-name">{{ plan.name }}</span>
            <span class="plan-item-meta">📍{{ plan.location }} 🔄{{ cycleLabel(plan.cycle) }} 👤{{ getExecutorNames(plan) }}</span>
          </div>
          <div class="plan-item-actions">
            <button class="btn-plan-edit" @click="editPlan(plan)">编辑</button>
            <button class="btn-plan-delete" @click="deletePlan(plan.id)">删除</button>
          </div>
        </div>
      </div>

      <!-- 进度条 -->
      <div class="progress-section">
        <div class="progress-info">
          <span class="progress-label">我的巡检任务</span>
          <span class="progress-value">{{ myTasks.filter(t => t.is_completed).length }}/{{ myTasks.length }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: (myTasks.length > 0 ? Math.round(myTasks.filter(t => t.is_completed).length / myTasks.length * 100) : 0) + '%' }"></div>
        </div>
      </div>

      <!-- 我的任务列表 -->
      <div class="device-list">
        <div v-if="myTasks.length === 0" class="plans-empty">暂无待执行的巡检任务</div>
        <div 
          v-for="task in myTasks" 
          :key="task.plan_id + '-' + task.device_id" 
          class="device-card"
          :class="task.is_completed ? 'done' : 'pending'"
          @click="task.is_completed ? null : executeTask(task)"
          :style="{ cursor: task.is_completed ? 'default' : 'pointer' }"
        >
          <div class="card-check" :class="task.is_completed ? (task.has_abnormal ? 'abnormal' : 'done') : 'pending'">
            <svg v-if="task.is_completed && !task.has_abnormal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <path d="M5 13l4 4L19 7"/>
            </svg>
            <svg v-if="task.has_abnormal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="card-body">
            <div class="card-name">{{ task.device_name }}</div>
            <div class="card-location">
              <span class="loc-icon">📍</span>
              {{ task.location }} · {{ task.plan_name }}
            </div>
            <div v-if="task.check_content" class="task-check-items">
              <span v-for="(item, idx) in task.check_content.split('\n').filter(l => l.trim())" :key="idx" class="check-item-tag">{{ item }}</span>
            </div>
            <div v-if="!task.is_completed && task.remainingMs < Infinity" class="task-remaining" :class="task.remainingMs < 0 ? 'overdue' : task.remainingMs < 1800000 ? 'urgent' : ''">
              <span v-if="task.remainingMs < 0">已超时 {{ formatRemaining(-task.remainingMs) }}</span>
              <span v-else>剩余 {{ formatRemaining(task.remainingMs) }}</span>
            </div>
          </div>
          <div class="card-status" :class="task.is_completed ? (task.has_abnormal ? 'abnormal' : 'done') : 'pending'">
            {{ task.is_completed ? (task.has_abnormal ? '有异常' : '已完成') : '待执行' }}
          </div>
        </div>
      </div>
    </div>

    <!-- 新建/编辑计划弹窗 -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click.self="closeDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h3>{{ editingPlan ? '编辑巡检计划' : '新建巡检计划' }}</h3>
          <button class="dialog-close" @click="closeDialog">×</button>
        </div>
        <div class="dialog-body">
          <!-- 计划名称 + 执行人 -->
          <div class="form-row-two">
            <div class="form-col">
              <label>计划名称</label>
              <input v-model="planForm.name" type="text" placeholder="如：每日设备巡检" />
            </div>
            <div class="form-col">
              <label>执行角色</label>
              <select v-model="selectedRole" @change="selectedExecutorId = ''">
                <option value="">请选择角色</option>
                <option v-for="role in allRoles" :key="role" :value="role">{{ role }}</option>
              </select>
            </div>
            <div class="form-col">
              <label>选择执行人</label>
              <select v-model="selectedExecutorId" :disabled="!selectedRole">
                <option value="">请先选择角色</option>
                <option v-for="user in (usersByRole[selectedRole] || [])" :key="user.id" :value="user.id">{{ user.name }}</option>
              </select>
            </div>
          </div>
          <!-- 执行周期 -->
          <div class="form-row">
            <label>执行周期</label>
            <div class="cycle-options">
              <button v-for="opt in cycleOptions" :key="opt.value" class="cycle-btn" :class="{ active: planForm.cycle === opt.value }" @click="planForm.cycle = opt.value">{{ opt.label }}</button>
            </div>
            <div v-if="planForm.cycle === 'custom'" class="custom-times-wrap">
              <div class="custom-time-label">每日执行时间段：</div>
              <div v-for="(t, idx) in customTimes" :key="idx" class="custom-time-row">
                <input v-model="customTimes[idx].start" type="time" placeholder="开始时间" />
                <span class="time-sep">至</span>
                <input v-model="customTimes[idx].end" type="time" placeholder="结束时间" />
                <button class="btn-remove-time" @click="removeCustomTime(idx)">×</button>
              </div>
              <button class="btn-add-time" @click="addCustomTime">+ 添加时间段</button>
            </div>
          </div>
          <!-- 选择地点 -->
          <div class="form-row">
            <label>选择地点</label>
            <select v-model="planForm.location" @change="selectedDeviceIds = []">
              <option value="">请选择地点</option>
              <option v-for="loc in locations" :key="loc.id" :value="loc.name">{{ loc.name }}</option>
            </select>
          </div>
          <!-- 选择设备 -->
          <div class="form-row">
            <label>选择设备</label>
            <div class="device-selector">
              <div v-if="!planForm.location" class="selector-hint">请先选择地点</div>
              <div v-else class="available-devices">
                <div 
                  v-for="dev in filteredDevices" 
                  :key="dev.id" 
                  class="device-option" 
                  :class="{ selected: selectedDeviceIds.includes(dev.id) }"
                  @click="toggleDevice(dev)"
                >{{ dev.name }}</div>
              </div>
              <div v-if="selectedDeviceIds.length > 0" class="selected-count">已选 {{ selectedDeviceIds.length }} 台设备</div>
            </div>
          </div>
          <!-- 每台设备的巡检项 -->
          <div v-for="dev in selectedDevices" :key="dev.id" class="device-check-config">
            <div class="config-header">
              <span class="config-device">🖥️ {{ dev.name }}</span>
              <span class="config-location">📍 {{ dev.location }}</span>
            </div>
            <div class="config-items">
              <label>巡检内容（每行一项）：</label>
              <textarea 
                v-model="deviceCheckItems[dev.id]" 
                rows="4" 
                placeholder="每行一个检查项，例：
轴承温度是否正常
运行时是否有异响
密封是否完好"
              ></textarea>
              <div v-if="deviceCheckItems[dev.id]" class="check-items-preview">
                <span v-for="(item, i) in deviceCheckItems[dev.id].split('\n').filter(l => l.trim())" :key="i" class="check-item-tag">{{ item }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-cancel" @click="closeDialog">取消</button>
          <button class="btn-confirm" @click="savePlan">{{ editingPlan ? '保存修改' : '创建计划' }}</button>
        </div>
      </div>
    </div>

    <!-- 巡检执行弹窗 -->
    <div v-if="showExecuteDialog" class="dialog-overlay" @click.self="showExecuteDialog = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>执行巡检</h3>
          <button class="dialog-close" @click="showExecuteDialog = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="execute-info">
            <div class="execute-device">{{ currentTask?.device_name }}</div>
            <div class="execute-plan">📍{{ currentTask?.location }} · {{ currentTask?.plan_name }}</div>
          </div>
          <div class="execute-checklist">
            <div v-for="(item, idx) in (currentTask?.check_content || '').split('\n').filter(l => l.trim())" :key="idx" class="check-row">
              <div class="check-box-wrap">
                <input type="checkbox" v-model="checkedItems" :value="item" :id="'check-' + idx" class="check-input" />
                <label :for="'check-' + idx" class="check-label">{{ item }}</label>
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
          <button class="btn-confirm" @click="submitTaskResult">提交巡检结果</button>
        </div>
      </div>
    </div>

    <!-- 保养计划内容 -->
    <div v-show="activeTab === 'maintenance'" class="tab-content">
      <!-- 保养概览 -->
      <div class="maint-overview">
        <div class="overview-card" v-for="stat in maintStats" :key="stat.label">
          <div class="overview-value">{{ stat.value }}</div>
          <div class="overview-label">{{ stat.label }}</div>
        </div>
      </div>

      <!-- 保养列表 -->
      <div class="maint-list">
        <div v-for="p in maintenancePlans" :key="p.id" class="maint-card">
          <div class="maint-left">
            <div class="maint-name">{{ p.name }}</div>
            <div class="maint-equip">{{ p.equipment }}</div>
          </div>
          <div class="maint-right">
            <div class="maint-date-row">
              <span class="date-label">下次保养</span>
              <span class="date-value">{{ p.nextDate }}</span>
            </div>
            <div class="maint-days-badge" :class="p.daysLeft <= 7 ? 'urgent' : 'normal'">
              {{ p.daysLeft }}天后
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import TopNavBar from '../components/TopNavBar.vue'
import { currentUser } from '../composables/useDeviceStore'

const API_BASE = '/api/inspection'
const isAdmin = computed(() => currentUser.value?.role === '系统管理人')

const today = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]}`
})

type InsStatus = 'done' | 'pending'
const statusLabel: Record<InsStatus, string> = { done: '已完成', pending: '待巡检' }

const activeTab = ref<'inspection' | 'maintenance'>('inspection')

// 管理员功能
const showAdminPanel = ref(false)
const showCreateDialog = ref(false)
const editingPlan = ref<any>(null)
const plans = ref<any[]>([])
const locations = ref<any[]>([])
const devices = ref<any[]>([])
const selectedDeviceIds = ref<number[]>([])
const deviceCheckItems = ref<Record<number, string>>({})
const usersByRole = ref<Record<string, any[]>>({})
const allRoles = ref<string[]>([])
const selectedExecutorId = ref<string>('')
const selectedRole = ref<string>('')

const currentTask = ref<any>(null)
const showExecuteDialog = ref(false)
const checkedItems = ref<string[]>([])
const hasAbnormal = ref(false)
const abnormalDesc = ref('')
const customTimes = ref<{start: string, end: string}[]>([])

const filteredDevices = computed(() => {
  if (!planForm.value.location) return devices.value
  return devices.value.filter(d => d.location === planForm.value.location)
})

const planForm = ref({
  name: '',
  location: '',
  cycle: 'daily',
  executor_role: ''
})

const cycleOptions = [
  { value: 'hourly', label: '每小时' },
  { value: 'two_hour', label: '每2小时' },
  { value: 'four_hour', label: '每4小时' },
  { value: 'eight_hour', label: '每8小时' },
  { value: 'weekly', label: '每周一次' },
  { value: 'custom', label: '自定义时间' }
]

const selectedDevices = computed(() =>
  devices.value.filter(d => selectedDeviceIds.value.includes(d.id))
)

function getExecutorNames(plan: any): string {
  try {
    const ids = JSON.parse(plan.executor_ids || '[]')
    const names: string[] = []
    for (const role in usersByRole.value) {
      for (const u of usersByRole.value[role]) {
        if (ids.includes(u.id)) names.push(u.name)
      }
    }
    return names.length > 0 ? names.join('、') : plan.executor_role || '未指定'
  } catch {
    return plan.executor_role || '未指定'
  }
}

function getExecutorRole(userId: number): string {
  for (const role in usersByRole.value) {
    const found = usersByRole.value[role].find((u: any) => u.id === userId)
    if (found) return role
  }
  return ''
}

function cycleLabel(cycle: string) {
  return cycleOptions.find(c => c.value === cycle)?.label || cycle
}

async function loadPlans() {
  try {
    const res = await fetch(`${API_BASE}/plans`)
    plans.value = await res.json()
  } catch (err) {
    console.error('加载巡检计划失败', err)
  }
}

async function loadLocations() {
  try {
    const res = await fetch('/api/devices')
    const allDevices = await res.json()
    const locSet = new Set<string>()
    for (const d of allDevices) {
      if (d.location) locSet.add(d.location)
    }
    locations.value = Array.from(locSet).map(name => ({ id: name, name }))
  } catch (err) {
    console.error('加载地点失败', err)
  }
}

const mockDevices = [
  { id: 1, name: '1号取水泵', location: '取水泵房' },
  { id: 2, name: '2号取水泵', location: '取水泵房' },
  { id: 3, name: '1号送水泵', location: '送水泵房' },
  { id: 4, name: '滤池1-4号', location: '滤池间' },
  { id: 5, name: '水质监测站', location: '监测中心' }
]

async function loadDevices() {
  try {
    const res = await fetch('/api/devices')
    const data = await res.json()
    devices.value = data.length > 0 ? data : mockDevices
  } catch {
    devices.value = mockDevices
  }
}

const mockUsers = {
  '带班': [{ id: 2, name: '张远', role: '带班' }],
  '值班岗位': [{ id: 3, name: '一期制水', role: '值班岗位' }],
  '维修组': [{ id: 4, name: '维修组', role: '维修组' }]
}

async function loadUsers() {
  try {
    const res = await fetch('/api/users')
    const allUsers = await res.json()
    if (allUsers && allUsers.length > 0) {
      const filtered = allUsers.filter((u: any) => u.role !== '系统管理人')
      const roleMap: Record<string, any[]> = {}
      for (const u of filtered) {
        if (!roleMap[u.role]) roleMap[u.role] = []
        roleMap[u.role].push(u)
      }
      usersByRole.value = roleMap
      allRoles.value = Object.keys(roleMap)
    }
  } catch (err) {
    console.error('加载用户失败', err)
  }
}

function toggleDevice(dev: any) {
  const idx = selectedDeviceIds.value.indexOf(dev.id)
  if (idx >= 0) {
    selectedDeviceIds.value.splice(idx, 1)
    delete deviceCheckItems.value[dev.id]
  } else {
    selectedDeviceIds.value.push(dev.id)
    deviceCheckItems.value[dev.id] = deviceCheckItems.value[dev.id] || ''
  }
}

function toggleExecutor(userId: number) {
  selectedExecutorId.value = String(userId)
}

function addCustomTime() {
  customTimes.value.push({ start: '', end: '' })
}

function removeCustomTime(idx: number) {
  customTimes.value.splice(idx, 1)
}

function editPlan(plan: any) {
  editingPlan.value = plan
  planForm.value = {
    name: plan.name,
    location: plan.location,
    cycle: plan.cycle,
    executor_role: plan.executor_role
  }
  // 解析执行人
  selectedRole.value = plan.executor_role || ''
  selectedExecutorId.value = plan.executor_ids ? String(JSON.parse(plan.executor_ids)[0]) : ''
  // 解析自定义时间
  customTimes.value = []
  if (plan.custom_times) {
    try {
          customTimes.value = plan.custom_times ? JSON.parse(plan.custom_times) : []
    } catch {}
  }
  selectedDeviceIds.value = plan.items?.map((it: any) => it.device_id) || []
  deviceCheckItems.value = {}
  plan.items?.forEach((it: any) => {
    deviceCheckItems.value[it.device_id] = it.check_content || ''
  })
  showCreateDialog.value = true
}

function closeDialog() {
  showCreateDialog.value = false
  editingPlan.value = null
  planForm.value = { name: '', location: '', cycle: 'daily', executor_role: '' }
  selectedDeviceIds.value = []
  deviceCheckItems.value = {}
  selectedExecutorId.value = ''
  selectedRole.value = ''
  customTimes.value = []
}

async function savePlan() {
  if (!planForm.value.name) {
    alert('请填写计划名称')
    return
  }
  if (!selectedRole.value) {
    alert('请选择执行角色')
    return
  }
  if (!selectedExecutorId.value) {
    alert('请选择执行人')
    return
  }
  if (!planForm.value.location) {
    alert('请选择地点')
    return
  }
  if (selectedDeviceIds.value.length === 0) {
    alert('请选择设备')
    return
  }
  
  const items = selectedDevices.value.map(dev => ({
    device_id: dev.id,
    device_name: dev.name,
    check_content: deviceCheckItems.value[dev.id] || ''
  }))
  
  const payload = {
    name: planForm.value.name,
    location: planForm.value.location,
    cycle: planForm.value.cycle,
    executor_role: selectedRole.value,
    device_ids: selectedDeviceIds.value,
    executor_ids: JSON.stringify([Number(selectedExecutorId.value)]),
    custom_times: JSON.stringify(customTimes.value),
    items
  }
  
  try {
    const url = editingPlan.value ? `${API_BASE}/plans/${editingPlan.value.id}` : `${API_BASE}/plans`
    const method = editingPlan.value ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HTTP ${res.status}: ${text}`)
    }
    await loadPlans()
    closeDialog()
  } catch (err) {
    console.error('保存失败:', err)
    const msg = err instanceof Error ? err.message : String(err)
    alert('保存失败：' + msg)
  }
}

async function deletePlan(id: number) {
  if (!confirm('确认删除？')) return
  try {
    await fetch(`${API_BASE}/plans/${id}`, { method: 'DELETE' })
    await loadPlans()
  } catch (err) {
    console.error('删除失败', err)
  }
}

onMounted(async () => {
  await loadPlans()
  loadLocations()
  loadDevices()
  loadUsers()
  await loadMyTasks()
  const timer = setInterval(() => {
    const now = Date.now()
    for (const t of myTasks.value) {
      const plan = plans.value.find((p: any) => p.id === t.plan_id)
      t.remainingMs = getTaskRemainingMs(t, plan, now)
    }
  }, 60000)
  onUnmounted(() => clearInterval(timer))
})

const inspectionItems = ref<any[]>([])

const doneCount = computed(() => inspectionItems.value.filter(i => i.status === 'done').length)
const totalCount = computed(() => inspectionItems.value.length)
const pendingCount = computed(() => inspectionItems.value.filter(i => i.status === 'pending').length)
const myTasks = ref<any[]>([])

// 用 myTasks 统计
const myDoneCount = computed(() => myTasks.value.filter(t => t.is_completed).length)
const myPendingCount = computed(() => myTasks.value.filter(t => !t.is_completed).length)
const myAbnormalCount = computed(() => myTasks.value.filter(t => t.has_abnormal).length)

async function loadMyTasks() {
  if (!currentUser.value) return
  const role = currentUser.value.role
  if (role === '系统管理人') return
  const userId = currentUser.value.id
  try {
    const res = await fetch(`${API_BASE}/pending-tasks?executor_role=${encodeURIComponent(role)}&executor_id=${userId}`)
    const tasks = await res.json()
    // 补充剩余时间（直接用task自带字段，不依赖plans查找）
    const now = Date.now()
    for (const t of tasks) {
      const plan = plans.value.find((p: any) => p.id === t.plan_id)
      const rem = getTaskRemainingMs(t, plan, now)
      console.log('[DEBUG loadMyTasks] now:', new Date(now).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}), 'plan id:', t.plan_id, 'cycle:', t.cycle, 'custom_times:', t.custom_times, 'rem:', Math.floor(rem/60000), 'min')
      t.remainingMs = rem
    }
    // 按剩余时间升序，再按任务名称升序
    tasks.sort((a: any, b: any) => {
      if (a.remainingMs !== b.remainingMs) return a.remainingMs - b.remainingMs
      return (a.plan_name || '').localeCompare(b.plan_name || '')
    })
    myTasks.value = tasks
  } catch (err) {
    console.error('加载任务失败', err)
  }
}

function getTaskRemainingMs(task: any, plan: any, now: number): number {
  if (task.is_completed) return Infinity
  const cycleMap: Record<string, number> = {
    'hourly': 60 * 60 * 1000,
    'two-hour': 2 * 60 * 60 * 1000,
    'four-hour': 4 * 60 * 60 * 1000,
    'eight-hour': 8 * 60 * 60 * 1000,
    'weekly': 7 * 24 * 60 * 60 * 1000,
  }
  const cycle = task.cycle || plan?.cycle
  const customTimes = task.custom_times || plan?.custom_times
  if (cycle === 'custom' && customTimes) {
    try {
      const times = JSON.parse(customTimes)
      if (Array.isArray(times) && times.length > 0) {
        const seg = times[0]
        const startStr = typeof seg === 'string' ? seg.split('-')[0].trim() : (seg.start || '')
        const endStr = typeof seg === 'string' ? seg.split('-')[1].trim() : (seg.end || '')
        const [sh, sm] = startStr.split(':').map(Number)
        const [eh, em] = endStr.split(':').map(Number)
        const nowD = new Date()
        // 计算窗口结束时间
        const endD = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate(), eh, em, 0)
        if (endD.getTime() <= nowD.getTime()) {
          // 窗口已过，算下一个周期（明天）
          endD.setDate(endD.getDate() + 1)
        }
        return endD.getTime() - now
      }
    } catch (e) { console.error('剩余时间计算错误', e) }
  }
  const interval = cycleMap[cycle] || (2 * 60 * 60 * 1000)
  if (task.record_created_at) {
    return new Date(task.record_created_at).getTime() + interval - now
  }
  const planCreated = plan?.created_at ? new Date(plan.created_at).getTime() : now
  return planCreated + interval - now
}

function formatRemaining(ms: number): string {
  if (ms < 0) ms = -ms
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}小时${m}分`
  return `${m}分钟`
}

async function executeTask(task: any) {
  // 弹出巡检执行对话框
  currentTask.value = task
  showExecuteDialog.value = true
}

function markTaskComplete(task: any, abnormal: boolean) {
  const t = myTasks.value.find(t => t.plan_id === task.plan_id && t.device_id === task.device_id)
  if (t) {
    t.is_completed = true
    t.has_abnormal = abnormal ? 1 : 0
  }
}

async function submitTaskResult() {
  if (!currentTask.value) return
  try {
    const res = await fetch(`${API_BASE}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: currentTask.value.plan_id,
        device_id: currentTask.value.device_id,
        device_name: currentTask.value.device_name,
        executor: currentUser.value?.name || '',
        executor_id: currentUser.value?.id || null,
        executor_name: currentUser.value?.name || '',
        results: JSON.stringify(checkedItems.value),
        has_abnormal: hasAbnormal.value ? 1 : 0,
        abnormal_desc: abnormalDesc.value
      })
    })
    if (!res.ok) throw new Error('提交失败')
    const data = await res.json()
    if (data.duplicate) {
      alert('该任务已在2小时内提交过，无需重复提交')
    } else {
      markTaskComplete(currentTask.value, hasAbnormal.value)
    }
    showExecuteDialog.value = false
    checkedItems.value = []
    hasAbnormal.value = false
    abnormalDesc.value = ''
    currentTask.value = null
    loadMyTasks()
  } catch (err) {
    console.error('提交失败', err)
    alert('提交失败，请重试')
  }
}

function toggleItem(item: any) {
  item.status = item.status === 'done' ? 'pending' : 'done'
}

const maintenancePlans = ref([
  { id: 1, name: '月度保养', equipment: '1号取水泵', nextDate: '2026-05-01', daysLeft: 6 },
  { id: 2, name: '季度保养', equipment: '2号送水泵', nextDate: '2026-05-15', daysLeft: 20 },
  { id: 3, name: '半年保养', equipment: '滤池组', nextDate: '2026-04-28', daysLeft: 3 },
  { id: 4, name: '年度保养', equipment: '水质监测设备', nextDate: '2026-06-10', daysLeft: 46 },
])

const upcomingMaintCount = computed(() => maintenancePlans.value.filter(p => p.daysLeft <= 7).length)

const maintStats = computed(() => [
  { label: '计划总数', value: maintenancePlans.value.length },
  { label: '本周到期', value: maintenancePlans.value.filter(p => p.daysLeft <= 7).length },
  { label: '本月到期', value: maintenancePlans.value.filter(p => p.daysLeft <= 30).length },
  { label: '已逾期', value: maintenancePlans.value.filter(p => p.daysLeft < 0).length },
])
</script>

<style scoped>
.ins-page {
  min-height: 100vh;
  background: #0f2d4a;
  padding: 0 0 40px;
}

/* 页面标题区 */
.ins-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px 20px;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 16px;
}

.page-title {
  color: #fff;
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  letter-spacing: 1px;
}

.page-date {
  color: rgba(255, 255, 255, 0.45);
  font-size: 13px;
}

.header-stats {
  display: flex;
  gap: 12px;
}

.stat-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.stat-teal {
  background: rgba(45, 212, 191, 0.15);
  color: #2DD4BF;
  border: 1px solid rgba(45, 212, 191, 0.3);
}

.stat-orange {
  background: rgba(251, 146, 60, 0.15);
  color: #fb923c;
  border: 1px solid rgba(251, 146, 60, 0.3);
}

.stat-red {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.stat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

/* Tab 切换 */
.ins-tabs {
  display: flex;
  gap: 4px;
  padding: 0 32px 20px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.55);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
}

.tab-btn.active {
  background: rgba(45, 212, 191, 0.15);
  color: #2DD4BF;
  border: 1px solid rgba(45, 212, 191, 0.3);
}

.tab-icon {
  font-size: 15px;
}

.tab-count {
  background: rgba(251, 146, 60, 0.2);
  color: #fb923c;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

/* 管理员工具栏 */
.section-toolbar {
  margin-bottom: 16px;
}

.btn-admin {
  background: rgba(45, 212, 191, 0.1);
  border: 1px solid rgba(45, 212, 191, 0.3);
  color: #2DD4BF;
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.btn-admin:hover {
  background: rgba(45, 212, 191, 0.2);
}

/* 管理面板 */
.admin-panel {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.admin-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.admin-title {
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

.btn-create-plan {
  background: rgba(45, 212, 191, 0.15);
  border: 1px solid rgba(45, 212, 191, 0.4);
  color: #2DD4BF;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.plans-empty {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  text-align: center;
  padding: 20px 0;
}

.plan-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  margin-bottom: 8px;
}

.plan-item:last-child { margin-bottom: 0; }

.plan-item-name {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  display: block;
  margin-bottom: 4px;
}

.plan-item-meta {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
}

.plan-item-actions {
  display: flex;
  gap: 8px;
}

.btn-plan-edit, .btn-plan-delete {
  background: none;
  border: 1px solid;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.btn-plan-edit {
  border-color: rgba(45, 212, 191, 0.4);
  color: #2DD4BF;
}

.btn-plan-delete {
  border-color: rgba(239, 68, 68, 0.4);
  color: #FCA5A5;
}

/* 弹窗 */
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
  width: 680px;
  max-height: 85vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  border-bottom: 1px solid rgba(45, 212, 191, 0.1);
}

.dialog-header h3 {
  color: #fff;
  font-size: 17px;
  margin: 0;
}

.dialog-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 22px;
  cursor: pointer;
}

.dialog-body { padding: 20px 22px; }

.form-row-two {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.form-col label {
  display: block;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  margin-bottom: 7px;
}

.form-col input {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 9px 12px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-col select {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 9px 12px;
  font-size: 14px;
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%232DD4BF' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}

.form-col select option {
  background: #0f2d4a;
  color: #fff;
  padding: 8px;
}

.form-col select optgroup {
  background: rgba(45, 212, 191, 0.15);
  color: #2DD4BF;
  font-weight: 600;
}

.form-col select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-row select {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 9px 12px;
  font-size: 14px;
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%232DD4BF' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}

.form-row select option {
  background: #0f2d4a;
  color: #fff;
}

.form-row select optgroup {
  background: rgba(45, 212, 191, 0.15);
  color: #2DD4BF;
  font-weight: 600;
}

.form-row {
  margin-bottom: 16px;
}

.form-row label {
  display: block;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  margin-bottom: 7px;
}

.form-row input,
.form-row select,
.form-row textarea {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 9px 12px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-row textarea { resize: vertical; }

.cycle-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.cycle-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(45, 212, 191, 0.2);
  color: rgba(255, 255, 255, 0.6);
  padding: 5px 13px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.cycle-btn.active {
  background: rgba(45, 212, 191, 0.15);
  border-color: #2DD4BF;
  color: #2DD4BF;
}

.device-selector {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(45, 212, 191, 0.15);
  border-radius: 8px;
  padding: 12px;
}

.available-devices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.device-option {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.device-option.selected {
  background: rgba(45, 212, 191, 0.15);
  border-color: #2DD4BF;
  color: #2DD4BF;
}

.selected-count {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.device-check-config {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(45, 212, 191, 0.1);
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
}

.config-header {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.config-device {
  color: #2DD4BF;
  font-size: 13px;
  font-weight: 500;
}

.config-location {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.config-items label {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  margin-bottom: 5px;
  display: block;
}

.config-items textarea {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 6px;
  color: #fff;
  padding: 8px 10px;
  font-size: 13px;
  resize: vertical;
  box-sizing: border-box;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 15px 22px;
  border-top: 1px solid rgba(45, 212, 191, 0.1);
}

.btn-cancel {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.6);
  padding: 7px 18px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.btn-confirm {
  background: rgba(45, 212, 191, 0.15);
  border: 1px solid rgba(45, 212, 191, 0.4);
  color: #2DD4BF;
  padding: 7px 18px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.btn-confirm:hover { background: rgba(45, 212, 191, 0.25); }

/* 内容区 */
.tab-content {
  padding: 0 32px;
}

/* 进度条 */
.progress-section {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.progress-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.progress-value {
  color: #2DD4BF;
  font-size: 13px;
  font-weight: 600;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2DD4BF, #06B6D4);
  border-radius: 3px;
  transition: width 0.4s ease;
}

/* 设备卡片列表 */
.device-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.device-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.device-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(45, 212, 191, 0.2);
}

.device-card.done { opacity: 0.65; }

.card-check {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-check.done {
  background: rgba(45, 212, 191, 0.2);
  color: #2DD4BF;
}

.card-check.abnormal {
  background: rgba(251, 146, 60, 0.2);
  color: #fb923c;
}

.card-check.pending {
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.card-body { flex: 1; }

.card-name {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.card-location {
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.loc-icon { font-size: 11px; }

.card-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.card-status.abnormal {
  background: rgba(251, 146, 60, 0.15);
  color: #fb923c;
}

.card-status.pending {
  background: rgba(251, 146, 60, 0.15);
  color: #fb923c;
}

/* 保养概览 */
.maint-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.overview-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 14px 16px;
  text-align: center;
}

.overview-value {
  color: #2DD4BF;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}

.overview-label {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

/* 保养列表 */
.maint-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.maint-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
}

.maint-name {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.maint-equip {
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
}

.maint-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.maint-date-row { text-align: right; }

.date-label {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  display: block;
  margin-bottom: 2px;
}

.date-value {
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
}

.maint-days-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.maint-days-badge.normal {
  background: rgba(45, 212, 191, 0.15);
  color: #2DD4BF;
}

.maint-days-badge.urgent {
  background: rgba(251, 146, 60, 0.15);
  color: #fb923c;
}

/* 自定义时间 */
.custom-times-wrap {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.custom-time-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.custom-time-row input {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 6px 10px;
  font-size: 14px;
  width: 140px;
}

.btn-remove-time {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #FCA5A5;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-add-time {
  background: rgba(45, 212, 191, 0.1);
  border: 1px dashed rgba(45, 212, 191, 0.3);
  color: rgba(45, 212, 191, 0.7);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

/* 设备选项 */
.device-option {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  padding: 7px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.device-option.selected {
  background: rgba(45, 212, 191, 0.15);
  border-color: #2DD4BF;
  color: #2DD4BF;
}

.dev-name {
  font-weight: 500;
}

.dev-loc {
  font-size: 11px;
  opacity: 0.6;
}

/* 巡检项预览 */
.check-items-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.check-item-tag {
  background: rgba(45, 212, 191, 0.1);
  border: 1px solid rgba(45, 212, 191, 0.25);
  color: #2DD4BF;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
}

/* 执行人选择器 */
.executor-selector {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(45, 212, 191, 0.15);
  border-radius: 8px;
  padding: 14px;
}

.role-group {
  margin-bottom: 14px;
}

.role-group:last-child { margin-bottom: 0; }

.role-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.role-check-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.role-check-wrap input {
  width: 16px;
  height: 16px;
  accent-color: #2DD4BF;
}

.role-name {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}

.role-count {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.role-users {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-left: 24px;
}

.user-chip {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.user-chip:hover {
  background: rgba(255, 255, 255, 0.1);
}

.user-chip.selected {
  background: rgba(45, 212, 191, 0.2);
  border-color: #2DD4BF;
  color: #2DD4BF;
}

.no-roles {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  text-align: center;
  padding: 16px;
}

/* 巡检执行弹窗 */
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

/* 任务列表中的检查项标签 */
.task-check-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.task-check-items .check-item-tag {
  font-size: 10px;
  padding: 2px 6px;
}

.task-remaining {
  font-size: 11px;
  color: #888;
  margin-top: 4px;
}
.task-remaining.urgent {
  color: #ff6b00;
}
.task-remaining.overdue {
  color: #e53e3e;
  font-weight: bold;
}
</style>