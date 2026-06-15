<template>
  <div class="dashboard-page">
    <!-- TopNavBar 由 AdminLayout 提供, 这里不重复 -->
    <div class="dashboard-header">
      <h2 class="dashboard-title">📊 数据驾驶舱</h2>
      <div class="dashboard-meta">
        <span class="update-time">最后更新: {{ lastUpdateTime }}</span>
        <button class="refresh-btn" @click="loadOverview" :disabled="loading">🔄 刷新</button>
        <span class="auto-tip">每 30 秒自动刷新</span>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading && !data" class="loading-state">加载中...</div>

    <div v-else-if="data" class="dashboard-grid">
      <!-- 顶部 4 大健康指标 -->
      <div class="kpi-row">
        <div class="kpi-card" :class="{ alert: (data.real_time_alerts.total || 0) > 0 }">
          <div class="kpi-label">总告警数</div>
          <div class="kpi-value" :style="{ color: (data.real_time_alerts.total || 0) > 0 ? '#ef4444' : '#22c55e' }">
            {{ data.real_time_alerts.total || 0 }}
          </div>
          <div class="kpi-sub">4 类合并: 设备/工单/巡检/备件</div>
        </div>
        <div class="kpi-card" :class="{ alert: data.sla_metrics.achievement_rate < 90 }">
          <div class="kpi-label">SLA 达成率</div>
          <div class="kpi-value" :style="{ color: data.sla_metrics.achievement_rate >= 90 ? '#22c55e' : data.sla_metrics.achievement_rate >= 70 ? '#facc15' : '#ef4444' }">
            {{ data.sla_metrics.achievement_rate }}%
          </div>
          <div class="kpi-sub">{{ data.sla_metrics.closed_orders }} 闭环 / {{ data.sla_metrics.breached }} 超时</div>
        </div>
        <div class="kpi-card" :class="{ alert: data.inspection_metrics.completion_rate < 80 }">
          <div class="kpi-label">巡检完成率 (今日)</div>
          <div class="kpi-value" :style="{ color: data.inspection_metrics.completion_rate >= 80 ? '#22c55e' : data.inspection_metrics.completion_rate >= 60 ? '#facc15' : '#ef4444' }">
            {{ data.inspection_metrics.completion_rate }}%
          </div>
          <div class="kpi-sub">{{ data.inspection_metrics.today_completed }} / {{ data.inspection_metrics.today_total }} 项</div>
        </div>
        <div class="kpi-card" :class="{ alert: (data.real_time_alerts.sparepart_low_stock || 0) > 0 }">
          <div class="kpi-label">备件低库存</div>
          <div class="kpi-value" :style="{ color: (data.real_time_alerts.sparepart_low_stock || 0) > 0 ? '#ef4444' : '#22c55e' }">
            {{ data.real_time_alerts.sparepart_low_stock || 0 }}
          </div>
          <div class="kpi-sub">低于阈值的备件数</div>
        </div>
      </div>

      <!-- 主体三列布局 -->
      <div class="main-grid">
        <!-- 左列: 实时告警面板 -->
        <div class="panel alert-panel">
          <div class="panel-header">
            <span class="panel-title">🚨 实时告警</span>
            <span class="panel-count">{{ data.real_time_alerts.total }} 项</span>
          </div>
          <div class="panel-body">
            <div v-if="data.real_time_alerts.device_warning > 0" class="alert-row">
              <span class="alert-icon" style="color:#facc15;">●</span>
              <span class="alert-label">设备告警</span>
              <span class="alert-value">{{ data.real_time_alerts.device_warning }}</span>
            </div>
            <div v-if="data.real_time_alerts.device_maintenance > 0" class="alert-row">
              <span class="alert-icon" style="color:#fb923c;">●</span>
              <span class="alert-label">设备维修中</span>
              <span class="alert-value">{{ data.real_time_alerts.device_maintenance }}</span>
            </div>
            <div v-if="data.real_time_alerts.workorder_sla_breached > 0" class="alert-row">
              <span class="alert-icon" style="color:#ef4444;">●</span>
              <span class="alert-label">工单 SLA 超时</span>
              <span class="alert-value">{{ data.real_time_alerts.workorder_sla_breached }}</span>
            </div>
            <div v-if="data.real_time_alerts.workorder_sla_warning > 0" class="alert-row">
              <span class="alert-icon" style="color:#fb923c;">●</span>
              <span class="alert-label">工单 SLA 即将超时 (2h)</span>
              <span class="alert-value">{{ data.real_time_alerts.workorder_sla_warning }}</span>
            </div>
            <div v-if="data.real_time_alerts.inspection_overdue > 0" class="alert-row">
              <span class="alert-icon" style="color:#ef4444;">●</span>
              <span class="alert-label">巡检超时</span>
              <span class="alert-value">{{ data.real_time_alerts.inspection_overdue }}</span>
            </div>
            <div v-if="data.real_time_alerts.sparepart_low_stock > 0" class="alert-row">
              <span class="alert-icon" style="color:#ef4444;">●</span>
              <span class="alert-label">备件低库存</span>
              <span class="alert-value">{{ data.real_time_alerts.sparepart_low_stock }}</span>
            </div>
            <div v-if="data.real_time_alerts.total === 0" class="alert-empty">✅ 一切正常</div>
          </div>
        </div>

        <!-- 中列: 工单趋势图 -->
        <div class="panel trend-panel">
          <div class="panel-header">
            <span class="panel-title">📈 工单趋势 (7 天)</span>
          </div>
          <div class="panel-body">
            <div v-if="data.workorder_trend && data.workorder_trend.length" class="trend-chart">
              <!-- 手画柱状图: 每天 2 根 (新建 + 闭环) -->
              <div class="chart-area">
                <div v-for="d in data.workorder_trend" :key="d.date" class="chart-bar-group">
                  <div class="bar-pair">
                    <div class="bar bar-new" :style="{ height: getBarHeight(d.new, maxTrendValue) + 'px' }" :title="`新建 ${d.new}`">
                      <span class="bar-value">{{ d.new || '' }}</span>
                    </div>
                    <div class="bar bar-closed" :style="{ height: getBarHeight(d.closed, maxTrendValue) + 'px' }" :title="`闭环 ${d.closed}`">
                      <span class="bar-value">{{ d.closed || '' }}</span>
                    </div>
                  </div>
                  <div class="bar-date">{{ d.date }}</div>
                </div>
              </div>
              <div class="chart-legend">
                <span class="legend-item"><span class="legend-dot bar-new"></span>新建</span>
                <span class="legend-item"><span class="legend-dot bar-closed"></span>闭环</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部: 班组对比 -->
      <div class="panel team-panel">
        <div class="panel-header">
          <span class="panel-title">👥 班组对比</span>
        </div>
        <div class="panel-body">
          <div v-if="data.team_comparison && data.team_comparison.length" class="team-table">
            <table>
              <thead>
                <tr>
                  <th>班组</th>
                  <th>工单总数</th>
                  <th>已闭环</th>
                  <th>SLA 超时</th>
                  <th>闭环率</th>
                  <th>平均处理时长</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in data.team_comparison" :key="t.team">
                  <td><strong>{{ t.team }}</strong></td>
                  <td>{{ t.total }}</td>
                  <td>{{ t.closed }}</td>
                  <td :style="{ color: t.breached > 0 ? '#ef4444' : 'inherit' }">{{ t.breached }}</td>
                  <td>
                    <span :style="{ color: (Number(t.closed) / Number(t.total) * 100) >= 80 ? '#22c55e' : '#facc15' }">
                      {{ Math.round(Number(t.closed) / Number(t.total) * 100) }}%
                    </span>
                  </td>
                  <td>{{ t.avg_minutes ? formatMinutes(Number(t.avg_minutes)) : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="alert-empty">暂无班组数据</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// P3.1 驾驶舱数据大屏
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSSE } from '../../composables/useSSE'

const data = ref<any>(null)
const loading = ref(false)
const lastUpdateTime = ref('-')

async function loadOverview() {
  loading.value = true
  try {
    const r = await fetch('/api/dashboard/overview')
    if (!r.ok) return
    data.value = await r.json()
    const now = new Date()
    lastUpdateTime.value = now.toLocaleTimeString('zh-CN', { hour12: false })
  } catch (err) {
    console.error('加载驾驶舱数据失败', err)
  } finally {
    loading.value = false
  }
}

const maxTrendValue = computed(() => {
  if (!data.value?.workorder_trend) return 1
  return Math.max(1, ...data.value.workorder_trend.flatMap((d: any) => [d.new || 0, d.closed || 0]))
})

function getBarHeight(value: number, max: number): number {
  if (!value || !max) return 0
  return Math.max(2, Math.round((value / max) * 120))  // 120px 最大高度
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min} 分`
  if (min < 60 * 24) return `${Math.floor(min / 60)} 小时 ${min % 60} 分`
  return `${Math.floor(min / 60 / 24)} 天`
}

// 自动刷新: 每 30s
let autoTimer: any = null
function startAutoRefresh() {
  if (autoTimer) return
  autoTimer = setInterval(() => {
    if (!loading.value) loadOverview()
  }, 30000)
}
function stopAutoRefresh() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null }
}

// SSE 关键事件触发重拉
useSSE('device-status-change', () => loadOverview())
useSSE('workorder-update', () => loadOverview())
useSSE('inspection-task-overdue', () => loadOverview())
useSSE('sparepart-low-stock', () => loadOverview())

onMounted(() => {
  loadOverview()
  startAutoRefresh()
})
onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0a192f 0%, #0f2d4a 100%);
  padding-bottom: 40px;
  color: #fff;
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 32px 16px;
  border-bottom: 1px solid rgba(45, 212, 191, 0.15);
}
.dashboard-title { font-size: 22px; font-weight: 600; margin: 0; color: #fff; letter-spacing: 1px; }
.dashboard-meta { display: flex; align-items: center; gap: 14px; font-size: 12px; color: rgba(255,255,255,0.55); }
.update-time { color: rgba(255,255,255,0.6); }
.auto-tip { color: rgba(255,255,255,0.35); font-size: 11px; }
.refresh-btn {
  padding: 5px 12px;
  background: rgba(45, 212, 191, 0.15);
  color: #2dd4bf;
  border: 1px solid rgba(45, 212, 191, 0.4);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.loading-state { padding: 60px; text-align: center; color: rgba(255,255,255,0.5); }

.dashboard-grid { padding: 20px 32px; display: flex; flex-direction: column; gap: 20px; }

/* KPI 顶部行 */
.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.kpi-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 18px 20px;
  text-align: center;
  transition: all 0.2s;
}
.kpi-card.alert { border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.06); }
.kpi-label { font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 8px; letter-spacing: 0.5px; }
.kpi-value { font-size: 36px; font-weight: 700; line-height: 1; margin-bottom: 6px; }
.kpi-sub { font-size: 11px; color: rgba(255,255,255,0.45); }

/* 主体两列 */
.main-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; }
.panel { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
.panel-title { font-size: 14px; font-weight: 600; color: #2dd4bf; }
.panel-count { font-size: 12px; color: rgba(255,255,255,0.5); }
.panel-body { padding: 16px 18px; }

/* 告警面板 */
.alert-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
.alert-row:last-child { border-bottom: none; }
.alert-icon { font-size: 16px; }
.alert-label { flex: 1; color: rgba(255,255,255,0.85); font-size: 13px; }
.alert-value { font-size: 18px; font-weight: 700; color: rgba(255,255,255,0.95); min-width: 30px; text-align: right; }
.alert-empty { text-align: center; padding: 30px; color: #22c55e; font-size: 14px; }

/* 趋势图 */
.trend-chart { display: flex; flex-direction: column; gap: 12px; }
.chart-area { display: flex; align-items: flex-end; justify-content: space-around; height: 160px; padding: 0 8px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.chart-bar-group { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
.bar-pair { display: flex; gap: 4px; align-items: flex-end; height: 130px; }
.bar {
  width: 18px;
  background: rgba(45, 212, 191, 0.5);
  border-radius: 3px 3px 0 0;
  position: relative;
  transition: all 0.3s;
  min-height: 2px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 2px;
}
.bar-new { background: linear-gradient(180deg, #2dd4bf 0%, rgba(45, 212, 191, 0.4) 100%); }
.bar-closed { background: linear-gradient(180deg, #60a5fa 0%, rgba(96, 165, 250, 0.4) 100%); }
.bar-value { font-size: 10px; color: rgba(255,255,255,0.7); font-weight: 600; }
.bar-date { font-size: 11px; color: rgba(255,255,255,0.5); }
.chart-legend { display: flex; justify-content: center; gap: 20px; padding-top: 8px; font-size: 12px; color: rgba(255,255,255,0.7); }
.legend-item { display: flex; align-items: center; gap: 6px; }
.legend-dot { width: 12px; height: 12px; border-radius: 2px; }
.legend-dot.bar-new { background: #2dd4bf; }
.legend-dot.bar-closed { background: #60a5fa; }

/* 班组对比 */
.team-table { overflow-x: auto; }
.team-table table { width: 100%; border-collapse: collapse; font-size: 13px; }
.team-table th { padding: 10px 12px; text-align: left; color: rgba(255,255,255,0.6); font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 12px; }
.team-table td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.85); }
.team-table tbody tr:hover { background: rgba(255,255,255,0.03); }
</style>
