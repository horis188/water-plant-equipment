<template>
  <div class="ins-page">
    <TopNavBar />
    <div class="ins-header">
      <div class="ins-title">
        <h2>设备巡检保养</h2>
        <span class="date">{{ today }}</span>
      </div>
      <div class="ins-stats">
        <span class="stat-badge stat-ok">今日巡检 {{ doneCount }}/{{ totalCount }}</span>
        <span class="stat-badge stat-warn" v-if="pendingCount > 0">待巡 {{ pendingCount }}</span>
      </div>
    </div>

    <div class="ins-section">
      <div class="section-title">巡检计划</div>
      <div class="ins-list">
        <div v-for="item in inspectionItems" :key="item.id" class="ins-item" :class="item.status" @click="toggleItem(item)">
          <div class="ins-check" :class="item.status">
            <svg v-if="item.status === 'done'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>
          </div>
          <div class="ins-info">
            <div class="ins-name">{{ item.name }}</div>
            <div class="ins-loc">{{ item.location }}</div>
          </div>
          <div class="ins-tag" :class="item.status">{{ statusLabel[item.status] }}</div>
        </div>
      </div>
    </div>

    <div class="ins-section">
      <div class="section-title">近期保养</div>
      <div class="maint-list">
        <div v-for="p in maintenancePlans" :key="p.id" class="maint-item">
          <div class="maint-name">{{ p.name }}</div>
          <div class="maint-date">{{ p.nextDate }}</div>
          <div class="maint-days">{{ p.daysLeft }}天</div>
        </div>
      </div>
    </div>

    <div class="ins-section">
      <div class="section-title">巡检历史</div>
      <table class="history-table">
        <thead><tr><th>设备</th><th>结果</th><th>时间</th><th>备注</th></tr></thead>
        <tbody>
          <tr v-for="r in history" :key="r.id">
            <td>{{ r.device }}</td>
            <td><span class="result-tag" :class="r.result">{{ resultLabel[r.result] }}</span></td>
            <td>{{ r.time }}</td>
            <td>{{ r.note || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import TopNavBar from '../components/TopNavBar.vue'

const today = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]}`
})

type InsStatus = 'done' | 'pending'
const statusLabel: Record<InsStatus, string> = { done: '已完成', pending: '待巡检' }
const resultLabel: Record<string, string> = { ok: '正常', warning: '异常', fault: '故障' }

const inspectionItems = ref([
  { id: 1, name: '1号取水泵', location: '取水泵房', status: 'done' as InsStatus },
  { id: 2, name: '2号取水泵', location: '取水泵房', status: 'done' as InsStatus },
  { id: 3, name: '1号送水泵', location: '送水泵房', status: 'done' as InsStatus },
  { id: 4, name: '滤池1-4号', location: '滤池间', status: 'pending' as InsStatus },
  { id: 5, name: '加药间设备', location: '加药间', status: 'pending' as InsStatus },
  { id: 6, name: '水质监测站', location: '监测中心', status: 'pending' as InsStatus },
])

const totalCount = computed(() => inspectionItems.value.length)
const doneCount = computed(() => inspectionItems.value.filter(i => i.status === 'done').length)
const pendingCount = computed(() => inspectionItems.value.filter(i => i.status === 'pending').length)

function toggleItem(item: typeof inspectionItems.value[0]) {
  if (item.status === 'pending') item.status = 'done'
}

const maintenancePlans = ref([
  { id: 1, name: '1号取水泵轴承更换', nextDate: '2026-04-28', daysLeft: 4 },
  { id: 2, name: '滤池滤料更换', nextDate: '2026-05-10', daysLeft: 16 },
  { id: 3, name: '送水泵密封检查', nextDate: '2026-04-30', daysLeft: 6 },
])

const history = ref([
  { id: 1, device: '3号取水泵', result: 'warning', time: '04-23 08:32', note: '温度略高' },
  { id: 2, device: '2号送水泵', result: 'ok', time: '04-23 08:45', note: '' },
  { id: 3, device: '配电室1号柜', result: 'fault', time: '04-23 09:30', note: '跳闸，已恢复' },
  { id: 4, device: '加药间1号计量泵', result: 'ok', time: '04-23 09:45', note: '' },
])
</script>

<style scoped>
.ins-page { min-height: 100vh; background: #e8f0f5; padding: 0 20px 40px; }
.ins-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 1px solid rgba(30,107,184,0.1); margin-bottom: 24px; }
.ins-title h2 { font-size: 22px; color: #1E6BB8; margin: 0 0 4px; }
.date { font-size: 13px; color: #4a6a7a; }
.ins-stats { display: flex; gap: 12px; }
.stat-badge { padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; }
.stat-ok { background: rgba(16,185,129,0.1); color: #10B981; border: 1px solid rgba(16,185,129,0.2); }
.stat-warn { background: rgba(245,158,11,0.1); color: #F59E0B; border: 1px solid rgba(245,158,11,0.2); }
.ins-section { background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 12px rgba(30,107,184,0.08); }
.section-title { font-size: 15px; font-weight: 600; color: #1A2A3A; margin-bottom: 14px; }
.ins-list { display: flex; flex-direction: column; gap: 8px; }
.ins-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; background: rgba(30,107,184,0.03); cursor: pointer; transition: all 0.2s; }
.ins-item:hover { background: rgba(30,107,184,0.07); }
.ins-check { width: 22px; height: 22px; border-radius: 50%; border: 2px solid rgba(30,107,184,0.25); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ins-check.done { background: #10B981; border-color: #10B981; color: white; }
.ins-check.done svg { width: 12px; height: 12px; }
.ins-check.pending { animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(30,107,184,0.3); } 50% { box-shadow: 0 0 0 4px rgba(30,107,184,0); } }
.ins-info { flex: 1; }
.ins-name { font-size: 14px; font-weight: 600; color: #1A2A3A; }
.ins-loc { font-size: 12px; color: #4a6a7a; margin-top: 2px; }
.ins-tag { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.ins-tag.done { background: rgba(16,185,129,0.12); color: #10B981; }
.ins-tag.pending { background: rgba(245,158,11,0.12); color: #F59E0B; }
.maint-list { display: flex; flex-direction: column; gap: 8px; }
.maint-item { display: flex; align-items: center; gap: 12px; padding: 10px; background: rgba(30,107,184,0.03); border-radius: 8px; }
.maint-name { flex: 1; font-size: 13px; font-weight: 600; color: #1A2A3A; }
.maint-date { font-size: 12px; color: #4a6a7a; }
.maint-days { font-size: 14px; font-weight: 700; color: #F59E0B; }
.history-table { width: 100%; border-collapse: collapse; }
.history-table th { padding: 8px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #4a6a7a; border-bottom: 1px solid rgba(30,107,184,0.08); }
.history-table td { padding: 10px 12px; border-bottom: 1px solid rgba(30,107,184,0.05); font-size: 13px; }
.result-tag { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
.result-tag.ok { background: rgba(16,185,129,0.12); color: #10B981; }
.result-tag.warning { background: rgba(245,158,11,0.12); color: #F59E0B; }
.result-tag.fault { background: rgba(239,68,68,0.12); color: #EF4444; }
</style>