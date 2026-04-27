<template>
  <div class="handover-page">
    <div class="page-header" style="padding: 24px 32px 20px;">
      <div class="header-left">
        <h2 class="page-title">班组交接</h2>
        <span class="page-desc">{{ currentShiftLabel }}</span>
      </div>
    </div>

    <div class="handover-content" style="padding: 0 32px;">
      <!-- 当前状态卡片 -->
      <div class="status-cards">
        <div class="status-card">
          <div class="status-label">当前班次</div>
          <div class="status-value">{{ currentShiftType }}</div>
        </div>
        <div class="status-card">
          <div class="status-label">当前班组</div>
          <div class="status-value">{{ currentTeam }}</div>
        </div>
        <div class="status-card">
          <div class="status-label">本班巡检</div>
          <div class="status-value" :class="tasksDone >= tasksTotal ? 'done' : 'pending'">
            {{ tasksDone }}/{{ tasksTotal }} 完成
          </div>
        </div>
        <div class="status-card">
          <div class="status-label">本班工单</div>
          <div class="status-value" :class="workordersDone >= workordersTotal ? 'done' : 'pending'">
            {{ workordersDone }}/{{ workordersTotal }} 处理
          </div>
        </div>
      </div>

      <!-- 交接状态显示 -->
      <div v-if="handoverStatus === 'pending'" class="handover-pending-card">
        <div class="handover-pending-header">
          <span class="pending-icon">⏳</span>
          <span class="pending-text">待{{ lastHandover?.handing_over_user }}接班</span>
        </div>
        <div class="handover-pending-info">
          <p>交班人：{{ lastHandover?.handing_over_user }} ({{ lastHandover?.handing_over_role }})</p>
          <p>交班时间：{{ formatTime(lastHandover?.handover_time) }}</p>
          <p>班次：{{ lastHandover?.shift_type }} ({{ lastHandover?.team }})</p>
          <p v-if="lastHandover?.notes">值班纪事：{{ lastHandover.notes }}</p>
        </div>
        <div class="handover-actions">
          <button class="btn-confirm" @click="confirmTakeover" :disabled="!canTakeover">确认接班</button>
        </div>
      </div>

      <!-- 正常交班/接班界面 -->
      <div v-else class="handover-main-card">
        <!-- 上一班交接信息 -->
        <div v-if="lastHandover" class="last-handover-section">
          <h3 class="section-title">上一班交接信息</h3>
          <div class="handover-info-grid">
            <div class="info-item">
              <span class="info-label">交班人</span>
              <span class="info-value">{{ lastHandover.handing_over_user }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">班次</span>
              <span class="info-value">{{ lastHandover.shift_type }} {{ lastHandover.team }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">交班时间</span>
              <span class="info-value">{{ formatTime(lastHandover.handover_time) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">任务状态</span>
              <span class="info-value" :class="lastHandover.tasks_status === 'completed' ? 'text-success' : 'text-warning'">
                {{ lastHandover.tasks_status === 'completed' ? '已完成' : '未完成' }}
              </span>
            </div>
          </div>
          <div v-if="lastHandover.notes" class="handover-notes">
            <span class="info-label">值班纪事：</span>
            <p class="notes-content">{{ lastHandover.notes }}</p>
          </div>
        </div>

        <!-- 交班表单 -->
        <div class="handover-form-section">
          <h3 class="section-title">交班信息</h3>
          <div class="form-row">
            <label>选择班组</label>
            <div class="team-selector">
              <button v-for="t in teams" :key="t" class="team-btn" :class="{ active: selectedTeam === t }" @click="selectedTeam = t">{{ t }}</button>
            </div>
          </div>
          <div class="form-row">
            <label>值班纪事</label>
            <textarea v-model="handoverNotes" rows="4" placeholder="记录本班重要事项..."></textarea>
          </div>
          <div class="handover-checklist">
            <div class="check-item" :class="{ done: tasksCompleted }">
              <span class="check-icon">{{ tasksCompleted ? '✅' : '⬜' }}</span>
              <span>本班巡检任务 {{ tasksDone }}/{{ tasksTotal }} 完成</span>
            </div>
            <div class="check-item" :class="{ done: workordersCompleted }">
              <span class="check-icon">{{ workordersCompleted ? '✅' : '⬜' }}</span>
              <span>本班工单 {{ workordersDone }}/{{ workordersTotal }} 处理</span>
            </div>
          </div>
          <div class="handover-actions">
            <button class="btn-primary" @click="submitHandover" :disabled="!canHandover">交班处理</button>
          </div>
        </div>
      </div>

      <!-- 交接历史 -->
      <div class="history-section">
        <h3 class="section-title">交接历史</h3>
        <div v-if="history.length === 0" class="empty-state">
          <span class="empty-icon">📋</span>
          <p>暂无交接记录</p>
        </div>
        <div v-else class="history-list">
          <div v-for="record in history" :key="record.id" class="history-item">
            <div class="history-time">{{ formatTime(record.handover_time) }}</div>
            <div class="history-info">
              <span>{{ record.handing_over_user }} → {{ record.taking_over_user || '待接班' }}</span>
              <span class="history-shift">{{ record.shift_type }} {{ record.team }}</span>
            </div>
            <div class="history-status" :class="record.status">{{ record.status === 'completed' ? '已完成' : '待接班' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { currentUser } from '../composables/useDeviceStore'


const API_BASE = '/api/handover'

// 班组和班次
const teams = ['A班', 'B班', 'C班', 'D班']
const shiftTypes = [
  { type: '早班', start: '08:00', end: '16:00', startHour: 8, endHour: 16 },
  { type: '日班', start: '16:00', end: '23:00', startHour: 16, endHour: 23 },
  { type: '夜班', start: '23:00', end: '08:00', startHour: 23, endHour: 8, overnight: true }
]

// 状态
const currentShiftType = ref('早班')
const currentTeam = ref('A班')
const selectedTeam = ref('A班')
const handoverNotes = ref('')
const handoverStatus = ref<'idle' | 'pending' | 'completed'>('idle')
const lastHandover = ref<any>(null)
const history = ref<any[]>([])

// 巡检/工单状态
const tasksTotal = ref(0)
const tasksDone = ref(0)
const workordersTotal = ref(0)
const workordersDone = ref(0)

// 计算属性
const tasksCompleted = computed(() => tasksDone.value >= tasksTotal.value && tasksTotal.value > 0)
const workordersCompleted = computed(() => workordersDone.value >= workordersTotal.value && workordersTotal.value > 0)

const currentShiftLabel = computed(() => {
  const now = new Date()
  return `${now.getMonth()+1}月${now.getDate()}日 ${currentShiftType.value} ${currentTeam.value}`
})

const canHandover = computed(() => {
  return tasksCompleted.value && workordersCompleted.value && selectedTeam.value
})

const canTakeover = computed(() => {
  return currentUser.value?.role === lastHandover.value?.taking_over_role
})

// 判断当前应该哪个班在岗
function getCurrentShiftAndTeam(): { shift: string; team: string } {
  const now = new Date()
  const hour = now.getHours()
  let shift = '早班'
  if (hour >= 16 && hour < 23) shift = '日班'
  else if (hour >= 23 || hour < 8) shift = '夜班'

  // 简单轮转：按日期和角色分配
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
  const roleIndex = ['系统管理人', '带班', '维修组', '值班岗位'].indexOf(currentUser.value?.role || '')
  const teamIndex = (dayOfYear + roleIndex) % 4
  const team = teams[teamIndex]

  return { shift, team }
}

// 加载数据
async function loadData() {
  if (!currentUser.value) return
  const role = currentUser.value.role

  try {
    const res = await fetch(`${API_BASE}/status?role=${encodeURIComponent(role)}`)
    const data = await res.json()

    if (data.lastHandover) {
      lastHandover.value = data.lastHandover
      handoverStatus.value = data.lastHandover.status === 'pending' ? 'pending' : 'idle'
    }

    tasksTotal.value = data.tasksTotal || 0
    tasksDone.value = data.tasksDone || 0
    workordersTotal.value = data.workordersTotal || 0
    workordersDone.value = data.workordersDone || 0

    const { shift, team } = getCurrentShiftAndTeam()
    currentShiftType.value = shift
    currentTeam.value = team

    // 加载历史
    const histRes = await fetch(`${API_BASE}/history?role=${encodeURIComponent(role)}`)
    history.value = await histRes.json()
  } catch (err) {
    console.error('加载交接数据失败', err)
  }
}

// 交班
async function submitHandover() {
  if (!canHandover.value) {
    alert('请先完成本班巡检和工单任务')
    return
  }
  try {
    const res = await fetch(`${API_BASE}/handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handingOverUser: currentUser.value?.name,
        handingOverRole: currentUser.value?.role,
        shiftType: currentShiftType.value,
        team: selectedTeam.value,
        notes: handoverNotes.value,
        tasksStatus: tasksCompleted.value ? 'completed' : 'pending',
        workordersStatus: workordersCompleted.value ? 'completed' : 'pending'
      })
    })
    if (!res.ok) throw new Error('交班失败')
    alert('交班成功')
    handoverStatus.value = 'pending'
    await loadData()
  } catch (err) {
    console.error('交班失败', err)
    alert('交班失败，请重试')
  }
}

// 接班
async function confirmTakeover() {
  if (!lastHandover.value) return
  try {
    const res = await fetch(`${API_BASE}/takeover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        takingOverUser: currentUser.value?.name,
        takingOverRole: currentUser.value?.role,
        handoverId: lastHandover.value.id
      })
    })
    if (!res.ok) throw new Error('接班失败')
    alert('接班成功')
    handoverStatus.value = 'completed'
    await loadData()
  } catch (err) {
    console.error('接班失败', err)
    alert('接班失败，请重试')
  }
}

// 格式化时间
function formatTime(timeStr: string): string {
  if (!timeStr) return '-'
  const d = new Date(timeStr)
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.handover-page { min-height: 100vh; background: #f5f7fa; }

.status-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.status-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}
.status-label { color: #666; font-size: 14px; margin-bottom: 8px; }
.status-value { font-size: 24px; font-weight: bold; color: #333; }
.status-value.done { color: #52c41a; }
.status-value.pending { color: #faad14; }

.handover-pending-card {
  background: #fffbeb;
  border: 2px solid #faad14;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}
.handover-pending-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  font-weight: bold;
  color: #d48806;
  margin-bottom: 16px;
}
.pending-icon { font-size: 28px; }
.handover-pending-info p { margin: 8px 0; color: #666; }
.handover-actions { margin-top: 20px; }

.handover-main-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}
.section-title { font-size: 18px; font-weight: bold; margin-bottom: 16px; color: #333; }

.last-handover-section { margin-bottom: 24px; }
.handover-info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.info-item { display: flex; flex-direction: column; gap: 4px; }
.info-label { color: #999; font-size: 12px; }
.info-value { font-size: 16px; font-weight: 500; }
.text-success { color: #52c41a; }
.text-warning { color: #faad14; }

.handover-notes { margin-top: 12px; }
.notes-content { background: #f5f7fa; padding: 12px; border-radius: 6px; margin-top: 4px; color: #666; }

.handover-form-section {}
.form-row { margin-bottom: 20px; }
.form-row label { display: block; margin-bottom: 8px; font-weight: 500; }
.form-row textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; resize: vertical; }

.team-selector { display: flex; gap: 12px; }
.team-btn {
  padding: 8px 24px;
  border: 2px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-weight: 500;
}
.team-btn.active { border-color: #1890ff; background: #e6f7ff; color: #1890ff; }

.handover-checklist { margin: 20px 0; }
.check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  margin-bottom: 8px;
  color: #666;
}
.check-item.done { background: #f6ffed; color: #52c41a; }
.check-icon { font-size: 18px; }

.handover-actions { display: flex; gap: 12px; }
.btn-primary, .btn-confirm {
  padding: 10px 32px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  font-weight: 500;
}
.btn-primary { background: #1890ff; color: white; }
.btn-primary:disabled { background: #ccc; cursor: not-allowed; }
.btn-confirm { background: #52c41a; color: white; }
.btn-confirm:disabled { background: #ccc; cursor: not-allowed; }

.history-section { background: white; border-radius: 12px; padding: 24px; }
.history-list { margin-top: 12px; }
.history-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
}
.history-item:last-child { border-bottom: none; }
.history-time { color: #999; font-size: 13px; width: 100px; }
.history-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.history-shift { color: #999; font-size: 13px; }
.history-status { font-size: 13px; padding: 2px 10px; border-radius: 4px; }
.history-status.completed { background: #f6ffed; color: #52c41a; }
.history-status.pending { background: #fffbe6; color: #faad14; }

.empty-state { text-align: center; padding: 40px; color: #999; }
.empty-icon { font-size: 48px; display: block; margin-bottom: 12px; }
</style>
