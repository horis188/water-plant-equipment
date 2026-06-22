<template>
  <div class="dashboard-page">
    <!-- TopNavBar 由 AdminLayout 提供, 这里不重复 -->
    <div class="dashboard-header">
      <h2 class="dashboard-title">📊 数据驾驶舱</h2>
      <div class="dashboard-meta">
        <span class="update-time">本地刷新: {{ lastUpdateTime }}</span>
        <span class="server-time" :title="'后端数据生成时间'">数据时间: {{ serverUpdateTime }}</span>
        <button class="refresh-btn" @click="loadOverview" :disabled="loading">🔄 刷新</button>
        <span class="auto-tip">每 30 秒自动刷新</span>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading && !data" class="loading-state">加载中...</div>

    <div v-else-if="data" class="dashboard-grid">
      <!-- 顶部 6 大健康指标 -->
      <div class="kpi-row">
        <div class="kpi-card" :class="{ alert: (data.real_time_alerts.total || 0) > 0 }" @click="goAlerts">
          <div class="kpi-label">总告警数</div>
          <div class="kpi-value" :style="{ color: (data.real_time_alerts.total || 0) > 0 ? '#ef4444' : '#22c55e' }">
            {{ data.real_time_alerts.total || 0 }}
          </div>
          <div class="kpi-sub">4 类合并: 设备/工单/巡检/备件</div>
        </div>
        <div class="kpi-card" :class="{ alert: data.sla_metrics.achievement_rate < 90 }" @click="$router.push('/workorder')">
          <div class="kpi-label">SLA 达成率</div>
          <div class="kpi-value" :style="{ color: rateColor(data.sla_metrics.achievement_rate, 90, 70) }">
            {{ data.sla_metrics.achievement_rate }}%
          </div>
          <div class="kpi-sub">总 {{ data.sla_metrics.total_orders }} / 闭环 {{ data.sla_metrics.closed_orders }} / 超时 {{ data.sla_metrics.breached }}</div>
        </div>
        <div class="kpi-card" :class="{ alert: data.inspection_metrics.completion_rate < 80 }" @click="$router.push('/inspection')">
          <div class="kpi-label">巡检完成率 (今日)</div>
          <div class="kpi-value" :style="{ color: rateColor(data.inspection_metrics.completion_rate, 80, 60) }">
            {{ data.inspection_metrics.completion_rate }}%
          </div>
          <div class="kpi-sub">完成 {{ data.inspection_metrics.today_completed }} / 今日 {{ data.inspection_metrics.today_total }} / 超时 {{ data.inspection_metrics.today_overdue }}</div>
        </div>
        <div class="kpi-card" :class="{ alert: data.sparepart_metrics.normal_rate < 80 }" @click="$router.push('/spareparts')">
          <div class="kpi-label">备件健康度</div>
          <div class="kpi-value" :style="{ color: rateColor(data.sparepart_metrics.normal_rate, 80, 60) }">
            {{ data.sparepart_metrics.normal_rate }}%
          </div>
          <div class="kpi-sub">总 {{ data.sparepart_metrics.total }} / 低库存 {{ data.sparepart_metrics.low_stock }}</div>
        </div>
        <div class="kpi-card" :class="{ alert: data.device_metrics.normal_rate < 80 }" @click="$router.push('/device/inuse')">
          <div class="kpi-label">设备正常率</div>
          <div class="kpi-value" :style="{ color: rateColor(data.device_metrics.normal_rate, 80, 60) }">
            {{ data.device_metrics.normal_rate }}%
          </div>
          <div class="kpi-sub">总 {{ data.device_metrics.total }} / 正常 {{ data.device_metrics.normal }} / 告警 {{ data.device_metrics.warning }} / 维修 {{ data.device_metrics.maintenance }}</div>
        </div>
        <div class="kpi-card" :class="{ alert: data.pending_workorders.total > 5 }" @click="$router.push('/workorder')">
          <div class="kpi-label">未处理工单</div>
          <div class="kpi-value" :style="{ color: data.pending_workorders.total > 5 ? '#facc15' : '#22c55e' }">
            {{ data.pending_workorders.total }}
          </div>
          <div class="kpi-sub">问题 {{ data.pending_workorders.problem }} / 维修 {{ data.pending_workorders.maintenance }}</div>
        </div>
      </div>

      <!-- 主体三列布局: 告警 / 工单趋势 / 巡检趋势 -->
      <div class="main-grid">
        <!-- 左列: 实时告警面板 (可点击) -->
        <div class="panel alert-panel">
          <div class="panel-header">
            <span class="panel-title">🚨 实时告警</span>
            <span class="panel-count">{{ data.real_time_alerts.total }} 项</span>
          </div>
          <div class="panel-body">
            <div v-if="data.real_time_alerts.device_warning > 0" class="alert-row clickable" @click="$router.push('/device/warning')">
              <span class="alert-icon" style="color:#facc15;">●</span>
              <span class="alert-label">设备告警</span>
              <span class="alert-value">{{ data.real_time_alerts.device_warning }}</span>
              <span class="alert-arrow">›</span>
            </div>
            <div v-if="data.real_time_alerts.device_maintenance > 0" class="alert-row clickable" @click="$router.push('/device/maintenance')">
              <span class="alert-icon" style="color:#fb923c;">●</span>
              <span class="alert-label">设备维修中</span>
              <span class="alert-value">{{ data.real_time_alerts.device_maintenance }}</span>
              <span class="alert-arrow">›</span>
            </div>
            <div v-if="data.real_time_alerts.workorder_sla_breached > 0" class="alert-row clickable" @click="$router.push('/workorder')">
              <span class="alert-icon" style="color:#ef4444;">●</span>
              <span class="alert-label">工单 SLA 超时</span>
              <span class="alert-value">{{ data.real_time_alerts.workorder_sla_breached }}</span>
              <span class="alert-arrow">›</span>
            </div>
            <div v-if="data.real_time_alerts.workorder_sla_warning > 0" class="alert-row clickable" @click="$router.push('/workorder')">
              <span class="alert-icon" style="color:#fb923c;">●</span>
              <span class="alert-label">工单 SLA 即将超时 (2h)</span>
              <span class="alert-value">{{ data.real_time_alerts.workorder_sla_warning }}</span>
              <span class="alert-arrow">›</span>
            </div>
            <div v-if="data.real_time_alerts.inspection_overdue > 0" class="alert-row clickable" @click="$router.push('/inspection')">
              <span class="alert-icon" style="color:#ef4444;">●</span>
              <span class="alert-label">巡检超时</span>
              <span class="alert-value">{{ data.real_time_alerts.inspection_overdue }}</span>
              <span class="alert-arrow">›</span>
            </div>
            <div v-if="data.real_time_alerts.sparepart_low_stock > 0" class="alert-row clickable" @click="$router.push('/spareparts')">
              <span class="alert-icon" style="color:#ef4444;">●</span>
              <span class="alert-label">备件低库存</span>
              <span class="alert-value">{{ data.real_time_alerts.sparepart_low_stock }}</span>
              <span class="alert-arrow">›</span>
            </div>
            <div v-if="data.real_time_alerts.total === 0" class="alert-empty">✅ 一切正常</div>
          </div>
        </div>

        <!-- 中列: 工单趋势 (堆叠) -->
        <div class="panel trend-panel">
          <div class="panel-header">
            <span class="panel-title">📈 工单趋势 (7 天)</span>
            <div class="chart-legend-mini">
              <span class="legend-item"><span class="legend-dot problem-color"></span>问题</span>
              <span class="legend-item"><span class="legend-dot maintenance-color"></span>维修</span>
            </div>
          </div>
          <div class="panel-body">
            <div v-if="data.workorder_trend && data.workorder_trend.length" class="trend-chart">
              <div class="chart-area">
                <div v-for="d in data.workorder_trend" :key="d.date" class="chart-bar-group">
                  <div class="bar-pair">
                    <!-- 新建堆叠: 问题(上) + 维修(下) -->
                    <div class="bar-stack" :style="{ height: getStackHeight(d.problem_new, d.maintenance_new, maxTrendValue) + 'px' }" :title="`新建 问题${d.problem_new} + 维修${d.maintenance_new}`">
                      <div class="stack-seg problem-color" :style="{ flex: d.problem_new || 0.0001 }"><span v-if="d.problem_new" class="bar-value">{{ d.problem_new }}</span></div>
                      <div class="stack-seg maintenance-color" :style="{ flex: d.maintenance_new || 0.0001 }"><span v-if="d.maintenance_new" class="bar-value">{{ d.maintenance_new }}</span></div>
                    </div>
                    <!-- 闭环堆叠 -->
                    <div class="bar-stack closed" :style="{ height: getStackHeight(d.problem_closed, d.maintenance_closed, maxTrendValue) + 'px' }" :title="`闭环 问题${d.problem_closed} + 维修${d.maintenance_closed}`">
                      <div class="stack-seg problem-color-closed" :style="{ flex: d.problem_closed || 0.0001 }"><span v-if="d.problem_closed" class="bar-value">{{ d.problem_closed }}</span></div>
                      <div class="stack-seg maintenance-color-closed" :style="{ flex: d.maintenance_closed || 0.0001 }"><span v-if="d.maintenance_closed" class="bar-value">{{ d.maintenance_closed }}</span></div>
                    </div>
                  </div>
                  <div class="bar-date">{{ d.date }}</div>
                </div>
              </div>
              <div class="chart-legend">
                <span class="legend-item"><span class="legend-dot problem-color"></span>问题</span>
                <span class="legend-item"><span class="legend-dot maintenance-color"></span>维修</span>
                <span class="legend-divider">|</span>
                <span class="legend-item"><span class="legend-dot bar-new-sample"></span>新建</span>
                <span class="legend-item"><span class="legend-dot bar-closed-sample"></span>闭环</span>
              </div>
            </div>
            <div v-else class="alert-empty">暂无趋势数据</div>
          </div>
        </div>

        <!-- 右列: 巡检趋势 -->
        <div class="panel inspection-trend-panel">
          <div class="panel-header">
            <span class="panel-title">🔍 巡检趋势 (7 天)</span>
          </div>
          <div class="panel-body">
            <div v-if="data.inspection_trend && data.inspection_trend.length" class="trend-chart">
              <div class="chart-area">
                <div v-for="d in data.inspection_trend" :key="d.date" class="chart-bar-group">
                  <div class="bar-pair">
                    <!-- 单柱: 总数(浅) + 完成(深) -->
                    <div class="bar inspection-bar" :style="{ height: getBarHeight(d.total, maxInsValue) + 'px' }" :title="`总数 ${d.total} / 完成 ${d.completed}`">
                      <div class="ins-fill" :style="{ height: d.total > 0 ? Math.round((d.completed / d.total) * 100) + '%' : '0%' }"></div>
                      <span class="bar-value">{{ d.completed }}/{{ d.total || 0 }}</span>
                    </div>
                  </div>
                  <div class="bar-date">{{ d.date }}</div>
                </div>
              </div>
              <div class="chart-legend">
                <span class="legend-item"><span class="legend-dot ins-fill-legend"></span>完成率</span>
                <span class="legend-item"><span class="legend-dot ins-bar-legend"></span>总数</span>
              </div>
            </div>
            <div v-else class="alert-empty">暂无巡检数据</div>
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
const serverUpdateTime = ref('-')

function goAlerts() {
  // 默认跳到工单页(最常用), 用户可在工单页看到全部告警
  // 也可以根据告警项数跳到不同页
}

async function loadOverview() {
  loading.value = true
  try {
    const r = await fetch('/api/dashboard/overview')
    if (!r.ok) return
    data.value = await r.json()
    const now = new Date()
    lastUpdateTime.value = now.toLocaleTimeString('zh-CN', { hour12: false })
    if (data.value?.generated_at) {
      const s = new Date(data.value.generated_at)
      serverUpdateTime.value = s.toLocaleTimeString('zh-CN', { hour12: false })
    }
  } catch (err) {
    console.error('加载驾驶舱数据失败', err)
  } finally {
    loading.value = false
  }
}

// 工具: 颜色按阈值 (>= 阈值高=绿, >=次阈值=黄, 否则红)
function rateColor(rate: number, good: number, mid: number): string {
  if (rate >= good) return '#22c55e'
  if (rate >= mid) return '#facc15'
  return '#ef4444'
}

const maxTrendValue = computed(() => {
  if (!data.value?.workorder_trend) return 1
  return Math.max(1, ...data.value.workorder_trend.flatMap((d: any) => [
    (d.problem_new || 0) + (d.maintenance_new || 0),
    (d.problem_closed || 0) + (d.maintenance_closed || 0)
  ]))
})

const maxInsValue = computed(() => {
  if (!data.value?.inspection_trend) return 1
  return Math.max(1, ...data.value.inspection_trend.map((d: any) => d.total || 0))
})

function getBarHeight(value: number, max: number): number {
  if (!value || !max) return 2
  return Math.max(2, Math.round((value / max) * 120))
}

function getStackHeight(a: number, b: number, max: number): number {
  const sum = (a || 0) + (b || 0)
  if (!sum || !max) return 0
  return Math.max(2, Math.round((sum / max) * 120))
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
  flex-wrap: wrap;
  gap: 10px;
}
.dashboard-title { font-size: 22px; font-weight: 600; margin: 0; color: #fff; letter-spacing: 1px; }
.dashboard-meta { display: flex; align-items: center; gap: 14px; font-size: 12px; color: rgba(255,255,255,0.55); flex-wrap: wrap; }
.update-time { color: rgba(255,255,255,0.6); }
.server-time { color: rgba(45, 212, 191, 0.85); font-family: ui-monospace, monospace; font-size: 11px; }
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
.refresh-btn:hover:not(:disabled) { background: rgba(45, 212, 191, 0.25); }

.loading-state { padding: 60px; text-align: center; color: rgba(255,255,255,0.5); }

.dashboard-grid { padding: 20px 32px; display: flex; flex-direction: column; gap: 20px; }

/* KPI 顶部行 (6 列) */
.kpi-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; }
@media (max-width: 1400px) { .kpi-row { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 900px) { .kpi-row { grid-template-columns: repeat(2, 1fr); } }
.kpi-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 16px 14px;
  text-align: center;
  transition: all 0.2s;
  cursor: pointer;
}
.kpi-card:hover { background: rgba(255, 255, 255, 0.08); transform: translateY(-2px); }
.kpi-card.alert { border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.06); }
.kpi-label { font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 6px; letter-spacing: 0.5px; }
.kpi-value { font-size: 32px; font-weight: 700; line-height: 1; margin-bottom: 6px; }
.kpi-sub { font-size: 10px; color: rgba(255,255,255,0.45); line-height: 1.4; }

/* 主体三列 */
.main-grid { display: grid; grid-template-columns: 1fr 1.4fr 1fr; gap: 20px; }
@media (max-width: 1200px) { .main-grid { grid-template-columns: 1fr; } }
.panel { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
.panel-title { font-size: 14px; font-weight: 600; color: #2dd4bf; }
.panel-count { font-size: 12px; color: rgba(255,255,255,0.5); }
.panel-body { padding: 16px 18px; }

/* 告警面板 */
.alert-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background 0.15s;
}
.alert-row:last-child { border-bottom: none; }
.alert-row.clickable { cursor: pointer; }
.alert-row.clickable:hover { background: rgba(45, 212, 191, 0.08); }
.alert-icon { font-size: 16px; }
.alert-label { flex: 1; color: rgba(255,255,255,0.85); font-size: 13px; }
.alert-value { font-size: 18px; font-weight: 700; color: rgba(255,255,255,0.95); min-width: 30px; text-align: right; }
.alert-arrow { color: rgba(255,255,255,0.3); font-size: 18px; line-height: 1; }
.alert-row.clickable:hover .alert-arrow { color: #2dd4bf; }
.alert-empty { text-align: center; padding: 30px; color: #22c55e; font-size: 14px; }

/* 趋势图 (通用) */
.trend-chart { display: flex; flex-direction: column; gap: 12px; }
.chart-area { display: flex; align-items: flex-end; justify-content: space-around; height: 160px; padding: 0 8px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.chart-bar-group { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
.bar-pair { display: flex; gap: 6px; align-items: flex-end; height: 130px; }
.bar-date { font-size: 11px; color: rgba(255,255,255,0.5); }
.chart-legend { display: flex; justify-content: center; align-items: center; gap: 14px; padding-top: 8px; font-size: 11px; color: rgba(255,255,255,0.7); flex-wrap: wrap; }
.chart-legend-mini { display: flex; gap: 10px; font-size: 11px; color: rgba(255,255,255,0.7); }
.legend-item { display: flex; align-items: center; gap: 5px; }
.legend-divider { color: rgba(255,255,255,0.3); }
.legend-dot { width: 12px; height: 12px; border-radius: 2px; }
.bar-value { font-size: 9px; color: rgba(255,255,255,0.85); font-weight: 600; }

/* 堆叠柱 */
.bar-stack {
  width: 22px;
  border-radius: 3px 3px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 2px;
  background: rgba(255,255,255,0.05);
}
.bar-stack.closed { opacity: 0.85; }
.stack-seg {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 1px;
  transition: flex 0.3s;
}
.problem-color { background: linear-gradient(180deg, #2dd4bf 0%, rgba(45, 212, 191, 0.4) 100%); }
.maintenance-color { background: linear-gradient(180deg, #60a5fa 0%, rgba(96, 165, 250, 0.4) 100%); }
.problem-color-closed { background: linear-gradient(180deg, rgba(45, 212, 191, 0.6) 0%, rgba(45, 212, 191, 0.2) 100%); }
.maintenance-color-closed { background: linear-gradient(180deg, rgba(96, 165, 250, 0.6) 0%, rgba(96, 165, 250, 0.2) 100%); }
.bar-new-sample { background: linear-gradient(180deg, #2dd4bf 0%, #60a5fa 100%); }
.bar-closed-sample { background: linear-gradient(180deg, rgba(45, 212, 191, 0.6) 0%, rgba(96, 165, 250, 0.6) 100%); }

/* 巡检柱 (单柱, 内填完成比例) */
.inspection-bar {
  width: 28px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px 3px 0 0;
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 2px;
  min-height: 2px;
}
.inspection-bar .ins-fill {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  background: linear-gradient(180deg, #10b981 0%, rgba(16, 185, 129, 0.3) 100%);
  border-radius: 3px 3px 0 0;
  transition: height 0.3s;
}
.inspection-bar .bar-value { position: relative; z-index: 1; font-size: 9px; }
.ins-fill-legend { background: linear-gradient(180deg, #10b981 0%, rgba(16, 185, 129, 0.3) 100%); }
.ins-bar-legend { background: rgba(255, 255, 255, 0.15); }

/* 班组对比 */
.team-table { overflow-x: auto; }
.team-table table { width: 100%; border-collapse: collapse; font-size: 13px; }
.team-table th { padding: 10px 12px; text-align: left; color: rgba(255,255,255,0.6); font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 12px; }
.team-table td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.85); }
.team-table tbody tr:hover { background: rgba(255,255,255,0.03); }
</style>
