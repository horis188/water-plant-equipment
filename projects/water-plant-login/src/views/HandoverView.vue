<template>
  <div class="handover-page">
    <TopNavBar />
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">班组交接</h2>
        <span class="page-desc">{{ currentShiftLabel }}</span>
      </div>
      <div class="header-actions">
        <span class="shift-badge">{{ currentShiftType }}</span>
        <span class="team-badge">{{ currentTeam }}</span>
      </div>
    </div>

    <!-- 状态卡片行 -->
    <div class="status-cards-row" style="padding: 0 32px;">
      <div class="stat-card">
        <span class="stat-num" :class="tasksDone >= tasksTotal && tasksTotal > 0 ? 'stat-green' : 'stat-orange'">{{ tasksDone }}</span>
        <span class="stat-lbl">巡检完成</span>
      </div>
      <div class="stat-sep">/</div>
      <div class="stat-card">
        <span class="stat-num stat-gray">{{ tasksTotal }}</span>
        <span class="stat-lbl">巡检总数</span>
      </div>
      <div class="stat-sep">/</div>
      <div class="stat-card">
        <span class="stat-num" :class="workordersDone >= workordersTotal && workordersTotal > 0 ? 'stat-green' : 'stat-orange'">{{ workordersDone }}</span>
        <span class="stat-lbl">工单处理</span>
      </div>
      <div class="stat-sep">/</div>
      <div class="stat-card">
        <span class="stat-num stat-gray">{{ workordersTotal }}</span>
        <span class="stat-lbl">工单总数</span>
      </div>
    </div>

    <!-- 待接班提示 -->
    <div v-if="handoverStatus === 'pending' && lastHandover" class="pending-hint" style="padding: 0 32px;">
      <div class="pending-hint-icon">⏳</div>
      <div class="pending-hint-info">
        <div class="pending-hint-title">待 {{ lastHandover.taking_over_user || '某人' }} 接班</div>
        <div class="pending-hint-meta">
          {{ lastHandover.handing_over_user }} ({{ lastHandover.handing_over_role }}) 交班 · {{ lastHandover.shift_type }} {{ lastHandover.team }}
          · {{ formatTime(lastHandover.handover_time) }}
        </div>
        <div v-if="lastHandover.notes" class="pending-hint-notes">{{ lastHandover.notes }}</div>
      </div>
      <div class="pending-hint-actions">
        <button class="dm-btn dm-btn-confirm" @click="confirmTakeover" :disabled="!canTakeover">确认接班</button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div style="padding: 0 32px;">
      <!-- 上一班交接信息 -->
      <div v-if="lastHandover && handoverStatus !== 'pending'" class="info-card" style="margin-top: 20px;">
        <div class="card-header">
          <h3 class="card-title">上一班交接信息</h3>
          <span class="card-tag" :class="lastHandover.status === 'completed' ? 'tag-done' : 'tag-wait'">
            {{ lastHandover.status === 'completed' ? '已完成' : '待接班' }}
          </span>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">交班人</span>
            <span class="info-value">{{ lastHandover.handing_over_user }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">角色</span>
            <span class="info-value">{{ lastHandover.handing_over_role }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">班次</span>
            <span class="info-value">{{ lastHandover.shift_type }} · {{ lastHandover.team }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">交接时间</span>
            <span class="info-value">{{ formatTime(lastHandover.handover_time) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">任务状态</span>
            <span class="info-value" :class="lastHandover.tasks_status === 'completed' ? 'text-green' : 'text-orange'">
              {{ lastHandover.tasks_status === 'completed' ? '已完成' : '未完成' }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">工单状态</span>
            <span class="info-value" :class="lastHandover.workorders_status === 'completed' ? 'text-green' : 'text-orange'">
              {{ lastHandover.workorders_status === 'completed' ? '已完成' : '未完成' }}
            </span>
          </div>
        </div>
        <div v-if="lastHandover.notes" class="info-notes">
          <span class="info-label">值班纪事：</span>
          <div class="notes-box">{{ lastHandover.notes }}</div>
        </div>
      </div>

      <!-- 交班操作区 -->
      <div class="handover-form-card" style="margin-top: 20px;">
        <div class="card-header">
          <h3 class="card-title">交班信息</h3>
        </div>
        <div class="form-section">
          <div class="form-row-inline">
            <label class="form-label">选择班组</label>
            <div class="team-selector">
              <button v-for="t in teams" :key="t" class="team-btn" :class="{ active: selectedTeam === t }" @click="selectedTeam = t">{{ t }}</button>
            </div>
          </div>
          <div class="form-row">
            <label class="form-label">值班纪事</label>
            <textarea v-model="handoverNotes" class="form-textarea" :disabled="!isOnDuty" placeholder="记录本班重要事项..." rows="3"></textarea>
          </div>
          <div class="check-list">
            <div class="check-item" :class="{ done: tasksCompleted }">
              <span class="check-icon">{{ tasksCompleted ? '✅' : '⬜' }}</span>
              <span class="check-text">本班巡检任务 {{ tasksDone }}/{{ tasksTotal }} 完成</span>
            </div>
            <div class="check-item" :class="{ done: workordersCompleted }">
              <span class="check-icon">{{ workordersCompleted ? '✅' : '⬜' }}</span>
              <span class="check-text">本班工单 {{ workordersDone }}/{{ workordersTotal }} 处理</span>
            </div>
          </div>
          <div class="form-actions">
            <button class="dm-btn dm-btn-primary" @click="submitHandover" :disabled="!canHandover">
              交班处理
            </button>
          </div>
        </div>
      </div>

      <!-- 交接历史 -->
      <div class="history-card" style="margin-top: 20px; margin-bottom: 32px;">
        <div class="card-header">
          <h3 class="card-title">交接历史</h3>
        </div>
        <div v-if="history.length === 0" class="empty-state">
          <span class="empty-icon">📋</span>
          <p>暂无交接记录</p>
        </div>
        <div v-else class="history-list">
          <div v-for="record in history" :key="record.id" class="history-item">
            <div class="history-time">{{ formatTime(record.handover_time) }}</div>
            <div class="history-info">
              <span class="history-arrow">{{ record.handing_over_user }} → {{ record.taking_over_user || '待接班' }}</span>
              <span class="history-meta">{{ record.shift_type }} {{ record.team }} · {{ record.handing_over_role }}</span>
            </div>
            <span class="card-tag" :class="record.status === 'completed' ? 'tag-done' : 'tag-wait'">
              {{ record.status === 'completed' ? '已完成' : '待接班' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import TopNavBar from '../components/TopNavBar.vue'
import { currentUser, isOnDuty } from '../composables/useDeviceStore'

const API_BASE = '/api/handover'

// 班组和班次
const teams = ['A班', 'B班', 'C班', 'D班']

// 状态
const currentShiftType = ref('日班')
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
  return `${now.getMonth()+1}月${now.getDate()}日`
})

const canHandover = computed(() => {
  return tasksCompleted.value && workordersCompleted.value && selectedTeam.value
})

const canTakeover = computed(() => {
  return lastHandover.value &&
    (lastHandover.value.taking_over_user === currentUser.value?.name ||
     lastHandover.value.taking_over_role === currentUser.value?.role ||
     !lastHandover.value.taking_over_user)
})

// 判断当前应该哪个班在岗
function getCurrentShiftAndTeam(): { shift: string; team: string } {
  const now = new Date()
  const hour = now.getHours()
  let shift = '早班'
  if (hour >= 8 && hour < 16) shift = '日班'
  else if (hour >= 16 && hour < 23) shift = '夜班'
  else shift = '早班'

  // 简单轮转：按日期分配班组
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
  const roleIndex = ['系统管理人', '带班', '维修组', '值班岗位', '旧厂制水', '新低值班', '一期制水', '新高值班'].indexOf(currentUser.value?.role || '')
  const teamIndex = (dayOfYear + roleIndex) % 4
  const team = teams[teamIndex]

  return { shift, team }
}

// 加载数据
async function loadData() {
  if (!currentUser.value) return
  const role = currentUser.value.role

  try {
    const res = await fetch(`${API_BASE}/status?role=${encodeURIComponent(role)}&userId=${currentUser.value.id}`)
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
  if (!isOnDuty.value) { alert('非值班时间，无法交班'); return }
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
    handoverNotes.value = ''
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
    alert('接班成功，当前班次已开始')
    handoverStatus.value = 'completed'
    lastHandover.value = null
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
.handover-page {
  min-height: 100vh;
  background: #0f2d4a;
  padding: 0 0 40px;
}

.page-header {
  background: rgba(255,255,255,0.04);
  padding: 24px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header-left { display: flex; flex-direction: column; gap: 4px; }
.page-title { color: #fff; font-size: 22px; font-weight: 600; margin: 0; letter-spacing: 1px; }
.page-desc { color: rgba(255,255,255,0.75); font-size: 13px; }
.header-actions { display: flex; gap: 10px; align-items: center; }

.shift-badge, .team-badge {
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  background: rgba(45,212,191,0.15);
  color: #2dd4bf;
}

.status-cards-row {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 16px 24px;
  margin: 20px 32px;
}
.stat-card { display: flex; flex-direction: column; align-items: center; flex: 1; }
.stat-num { font-size: 28px; font-weight: 700; }
.stat-lbl { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 2px; }
.stat-sep { font-size: 22px; color: rgba(255,255,255,0.2); padding: 0 8px; }
.stat-green { color: #52c41a; }
.stat-orange { color: #fa8c16; }
.stat-gray { color: rgba(255,255,255,0.5); }

.pending-hint {
  display: flex;
  align-items: center;
  background: rgba(250,140,22,0.12);
  border: 1px solid rgba(250,140,22,0.3);
  border-radius: 10px;
  padding: 16px 20px;
  margin: 0 32px 16px;
  border-left: 4px solid #fa8c16;
}
.pending-hint-icon { font-size: 32px; margin-right: 16px; }
.pending-hint-info { flex: 1; }
.pending-hint-title { font-size: 16px; font-weight: 600; color: #fa8c16; }
.pending-hint-meta { font-size: 13px; color: rgba(255,255,255,0.5); margin-top: 4px; }
.pending-hint-notes { font-size: 13px; color: rgba(255,255,255,0.7); margin-top: 6px; background: rgba(255,255,255,0.08); padding: 8px; border-radius: 4px; }
.pending-hint-actions { margin-left: 20px; }

.info-card, .handover-form-card, .history-card {
  background: rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 20px 24px;
}
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.card-title { font-size: 16px; font-weight: 600; color: #fff; margin: 0; }
.card-tag {
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}
.tag-done { background: rgba(82,196,26,0.15); color: #52c41a; }
.tag-wait { background: rgba(250,173,20,0.15); color: #faad14; }

.info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.info-item { display: flex; flex-direction: column; gap: 3px; }
.info-label { font-size: 12px; color: rgba(255,255,255,0.45); }
.info-value { font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.9); }
.text-green { color: #52c41a; }
.text-orange { color: #fa8c16; }

.info-notes { margin-top: 14px; }
.notes-box {
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 14px;
  color: rgba(255,255,255,0.7);
  margin-top: 4px;
  line-height: 1.6;
}

.form-section {}
.form-row-inline { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.form-row { margin-bottom: 16px; }
.form-label { font-size: 14px; color: rgba(255,255,255,0.6); font-weight: 500; min-width: 70px; }
.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
  box-sizing: border-box;
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.85);
}
.form-textarea:focus { border-color: #40a9ff; outline: none; }

.team-selector { display: flex; gap: 10px; }
.team-btn {
  padding: 6px 20px;
  border: 2px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  background: rgba(255,255,255,0.06);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255,255,255,0.7);
  transition: all 0.2s;
}
.team-btn.active {
  border-color: #2dd4bf;
  background: rgba(45,212,191,0.15);
  color: #2dd4bf;
}

.check-list { margin-bottom: 20px; }
.check-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
  margin-bottom: 8px;
  font-size: 14px;
  color: rgba(255,255,255,0.6);
}
.check-item.done { background: rgba(82,196,26,0.12); color: #52c41a; }
.check-icon { font-size: 18px; }
.check-text {}

.form-actions { margin-top: 10px; }

.dm-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}
.dm-btn-primary { background: #1890ff; color: white; }
.dm-btn-primary:hover { background: #40a9ff; }
.dm-btn-primary:disabled { background: #d9d9d9; cursor: not-allowed; }
.dm-btn-confirm { background: #52c41a; color: white; }
.dm-btn-confirm:hover { background: #73d13d; }
.dm-btn-confirm:disabled { background: #d9d9d9; cursor: not-allowed; }

.empty-state { text-align: center; padding: 40px 0; color: rgba(255,255,255,0.4); }
.empty-icon { font-size: 48px; display: block; margin-bottom: 12px; }

.history-list {}
.history-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.history-item:last-child { border-bottom: none; }
.history-time { font-size: 13px; color: rgba(255,255,255,0.45); width: 90px; flex-shrink: 0; }
.history-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.history-arrow { font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.85); }
.history-meta { font-size: 12px; color: rgba(255,255,255,0.45); }
</style>
