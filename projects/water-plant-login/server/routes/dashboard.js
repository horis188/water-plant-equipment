// ====================================================================
// 驾驶舱数据大屏 API (P3.1 驾驶舱 P1)
// 前缀: /api/dashboard
// 一个接口返回所有大屏数据, 前端 30s 轮询 + SSE 事件触发重拉
// ====================================================================
import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import pool from '../db/mysql.js'

const router = express.Router()
router.use(requireAuth)

// ====================================================================
// GET /api/dashboard/overview
// 返回: 实时告警 / SLA 指标 / 巡检指标 / 工单趋势 / 班组对比
// ====================================================================
router.get('/overview', async (req, res) => {
  try {
    // ---------- 1. 实时告警 ----------
    const [deviceStats] = await pool.query(
      `SELECT
         SUM(CASE WHEN status = '1' THEN 1 ELSE 0 END) AS warning,
         SUM(CASE WHEN status = '2' THEN 1 ELSE 0 END) AS maintenance
       FROM devices`
    )
    const [woStats] = await pool.query(
      `SELECT
         SUM(CASE WHEN sla_breached = 1 AND status NOT IN ('closed', 'self_resolved', 'completed') THEN 1 ELSE 0 END) AS breached,
         SUM(CASE WHEN sla_due_at IS NOT NULL AND sla_due_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR)
                  AND status NOT IN ('closed', 'self_resolved', 'completed') THEN 1 ELSE 0 END) AS warning_2h
       FROM (
         SELECT id, status, sla_due_at, sla_breached FROM problem_orders
         UNION ALL
         SELECT id, status, sla_due_at, sla_breached FROM maintenance_orders
       ) t`
    )
    const [insOverdue] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM inspection_task_records WHERE status = 'pending' AND check_date < CURDATE()`
    )
    const [spLowStock] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM spareparts WHERE min_quantity > 0 AND quantity < min_quantity`
    )

    const realTimeAlerts = {
      device_warning: Number(deviceStats[0].warning) || 0,
      device_maintenance: Number(deviceStats[0].maintenance) || 0,
      workorder_sla_breached: Number(woStats[0].breached) || 0,
      workorder_sla_warning: Number(woStats[0].warning_2h) || 0,
      inspection_overdue: Number(insOverdue[0].cnt) || 0,
      sparepart_low_stock: Number(spLowStock[0].cnt) || 0
    }
    realTimeAlerts.total = Object.values(realTimeAlerts).reduce((a, b) => a + b, 0)

    // ---------- 2. SLA 指标 ----------
    // 全量 (已闭环 + 未闭环) 统计
    const [slaAgg] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM problem_orders) +
         (SELECT COUNT(*) FROM maintenance_orders) AS total,
         (SELECT COUNT(*) FROM problem_orders WHERE status IN ('closed', 'self_resolved')) +
         (SELECT COUNT(*) FROM maintenance_orders WHERE status IN ('completed', 'closed')) AS closed,
         (SELECT COUNT(*) FROM problem_orders WHERE sla_breached = 1) +
         (SELECT COUNT(*) FROM maintenance_orders WHERE sla_breached = 1) AS breached
       FROM DUAL`
    )
    const sla_total = Number(slaAgg[0].total) || 0
    const sla_closed = Number(slaAgg[0].closed) || 0
    const sla_breached = Number(slaAgg[0].breached) || 0
    const sla_metrics = {
      total_orders: sla_total,
      closed_orders: sla_closed,
      breached: sla_breached,
      achievement_rate: sla_closed > 0 ? Math.round(((sla_closed - sla_breached) / sla_closed) * 1000) / 10 : 100
    }

    // ---------- 3. 巡检指标 (今日) ----------
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const [insMetrics] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'completed' OR status = 'abnormal' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status = 'pending' AND check_date < CURDATE() THEN 1 ELSE 0 END) AS overdue
       FROM inspection_task_records
       WHERE check_date = CURDATE()`
    )
    const ins_total = Number(insMetrics[0].total) || 0
    const ins_completed = Number(insMetrics[0].completed) || 0
    const ins_overdue = Number(insMetrics[0].overdue) || 0
    const inspection_metrics = {
      today_total: ins_total,
      today_completed: ins_completed,
      today_overdue: ins_overdue,
      completion_rate: ins_total > 0 ? Math.round((ins_completed / ins_total) * 1000) / 10 : 100
    }

    // ---------- 4. 工单趋势 (7 天) ----------
    const trend = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
      const dStr = d.toISOString().slice(0, 10)
      const [row] = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM problem_orders WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)) AS problem_new,
           (SELECT COUNT(*) FROM maintenance_orders WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)) AS maint_new,
           (SELECT COUNT(*) FROM problem_orders WHERE closed_at >= ? AND closed_at < DATE_ADD(?, INTERVAL 1 DAY)) AS problem_closed,
           (SELECT COUNT(*) FROM maintenance_orders WHERE closed_at >= ? AND closed_at < DATE_ADD(?, INTERVAL 1 DAY)) AS maint_closed`,
        [d, d, d, d, d, d, d, d]
      )
      trend.push({
        date: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        new: Number(row[0].problem_new) + Number(row[0].maint_new),
        closed: Number(row[0].problem_closed) + Number(row[0].maint_closed)
      })
    }

    // ---------- 5. 班组对比 ----------
    const [teamStats] = await pool.query(
      `SELECT
         COALESCE(team, '未分班组') AS team,
         COUNT(*) AS total,
         SUM(CASE WHEN t.closed_at IS NOT NULL THEN 1 ELSE 0 END) AS closed,
         SUM(CASE WHEN t.sla_breached = 1 THEN 1 ELSE 0 END) AS breached,
         ROUND(AVG(CASE WHEN t.closed_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, t.created_at, t.closed_at) END)) AS avg_minutes
       FROM (
         SELECT team, created_at, closed_at, sla_breached FROM problem_orders
         UNION ALL
         SELECT team, created_at, closed_at, sla_breached FROM maintenance_orders
       ) t
       WHERE team IS NOT NULL
       GROUP BY team
       ORDER BY total DESC
       LIMIT 10`
    )

    res.json({
      generated_at: new Date().toISOString(),
      real_time_alerts: realTimeAlerts,
      sla_metrics,
      inspection_metrics,
      workorder_trend: trend,
      team_comparison: teamStats
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
