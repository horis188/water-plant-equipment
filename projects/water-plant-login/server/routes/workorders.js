import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import pool from '../db/mysql.js'
import { sseEmit } from '../events.js'

const router = express.Router()

// P0-5 安全修复: 所有业务 API 强制登录
router.use(requireAuth)

// ====================================================================
// P1: SLA 跟踪 (P2.1 工单 P1)
// SLA 规则 (单位: 小时):
//   问题工单: 8
//   维修工单: 轻=120 (5天), 中=48 (2天), 重=12
// ====================================================================
function getSlaHours(type, level) {
  if (type === 'problem') return 8
  if (type === 'maintenance') {
    if (level === '重' || level === 'urgent') return 12
    if (level === '中' || level === 'medium') return 48
    return 120  // 轻/普通 (5天)
  }
  return 24
}

function calcSlaDueAt(hours) {
  return new Date(Date.now() + hours * 3600 * 1000)
}

// 判断 SLA 状态: 'normal' / 'warning' (≤2h) / 'urgent' (≤30min) / 'breached'
function getSlaStatus(sla_due_at, status) {
  if (!sla_due_at) return 'none'
  if (['closed', 'completed', 'self_resolved'].includes(status)) return 'done'
  const now = Date.now()
  const due = new Date(sla_due_at).getTime()
  if (now >= due) return 'breached'
  const remainingMs = due - now
  if (remainingMs <= 30 * 60 * 1000) return 'urgent'  // 30 分钟内
  if (remainingMs <= 2 * 3600 * 1000) return 'warning'  // 2 小时内
  return 'normal'
}

// 把行里所有 JSON 字符串列安全地解析成对象/数组 (mysql2 默认把 JSON 列当字符串返回)
// 修复: images/videos 是 JSON 字符串, 前端 v-for 按字符迭代会渲染 "42 张无效图片" (实际是 length 46 - 4 = +42)
import { parseJsonFieldsInRows } from '../db/jsonFields.js'

// 获取问题工单
router.get('/problem', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM problem_orders ORDER BY id DESC')
    parseJsonFieldsInRows(rows, ['images', 'videos', 'resolution_images'])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 创建问题工单
router.post('/problem', async (req, res) => {
  const { content, reporter_name, images, videos, deviceId, team, role, member_name } = req.body
  try {
    // P1: SLA 计算
    const slaHours = getSlaHours('problem')
    const slaDueAt = calcSlaDueAt(slaHours)
    const [result] = await pool.query(
      'INSERT INTO problem_orders (content, reporter_name, images, videos, device_id, team, role, member_name, last_action_at, sla_due_at, sla_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)',
      [content, reporter_name, images, videos, deviceId || null, team || null, role || null, member_name || null, slaDueAt, slaHours]
    )
    sseEmit('workorder-update', { type: 'problem', id: result.insertId, action: 'created' })
    res.json({ id: result.insertId, ...req.body, sla_due_at: slaDueAt, sla_hours: slaHours })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 更新问题工单
router.put('/problem/:id', async (req, res) => {
  const { content, status, resolution, resolutionImages, deviceId, closedAt } = req.body
  try {
    const updates = []
    const values = []
    if (content !== undefined) { updates.push('content=?'); values.push(content) }
    if (status !== undefined) { updates.push('status=?'); values.push(status) }
    if (resolution !== undefined) { updates.push('resolution=?'); values.push(resolution) }
    if (resolutionImages !== undefined) { updates.push('resolution_images=?'); values.push(resolutionImages) }
    if (deviceId !== undefined) { updates.push('device_id=?'); values.push(deviceId || null) }
    if (closedAt !== undefined) { updates.push('closed_at=?'); values.push(closedAt) }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' })
    // 每次更新都滚动更新 last_action_at
    updates.push('last_action_at=NOW()')
    values.push(req.params.id)
    await pool.query(`UPDATE problem_orders SET ${updates.join(', ')} WHERE id=?`, values)

    // 问题工单自处理/闭环时，同步更新关联的维修工单状态
    if (status === 'self_resolved' || status === 'closed') {
      const [mos] = await pool.query('SELECT id FROM maintenance_orders WHERE problem_order_id = ?', [req.params.id])
      if (mos.length > 0) {
        await pool.query('UPDATE maintenance_orders SET status = ? WHERE id = ?', [status, mos[0].id])
        sseEmit('workorder-update', { type: 'maintenance', id: Number(mos[0].id) })
      }
    }

    sseEmit('workorder-update', { type: 'problem', id: Number(req.params.id) })
    res.json({ id: req.params.id, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 删除问题工单
router.delete('/problem/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM problem_orders WHERE id=?', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 获取维修工单
router.get('/maintenance', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM maintenance_orders ORDER BY id DESC')
    parseJsonFieldsInRows(rows, ['completion_images', 'delay_images', 'sparepart_usage', 'return_images'])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 创建维修工单
router.post('/maintenance', async (req, res) => {
  const { content, level, status, assigner_name, handler_name, problem_order_id, deviceId, team, role, user_name, reporter_name, member_name } = req.body
  try {
    // 优先从问题工单获取 device_id
    let resolvedDeviceId = deviceId || null
    if (!resolvedDeviceId && problem_order_id) {
      const [pos] = await pool.query('SELECT device_id FROM problem_orders WHERE id = ?', [problem_order_id])
      if (pos.length > 0) resolvedDeviceId = pos[0].device_id
    }
    // 优先从问题工单获取 reporter_name
    let resolvedReporter = reporter_name || null
    if (!resolvedReporter && problem_order_id) {
      const [pos] = await pool.query('SELECT reporter_name FROM problem_orders WHERE id = ?', [problem_order_id])
      if (pos.length > 0) resolvedReporter = pos[0].reporter_name
    }
    // P1: SLA 计算 (根据等级)
    const slaHours = getSlaHours('maintenance', level)
    const slaDueAt = calcSlaDueAt(slaHours)
    const [result] = await pool.query(
      'INSERT INTO maintenance_orders (content, level, status, assigner_name, handler_name, problem_order_id, device_id, team, role, user_name, reporter_name, member_name, last_action_at, sla_due_at, sla_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)',
      [content, level || '普通', status || 'pending', assigner_name, handler_name, problem_order_id || null, resolvedDeviceId, team || null, role || null, user_name || null, resolvedReporter, member_name || null, slaDueAt, slaHours]
    )
    // 创建时设备设为维修中
    if (resolvedDeviceId) {
      await pool.query('UPDATE devices SET status = 2 WHERE id = ?', [resolvedDeviceId])
      sseEmit('device-status-change', { device_id: resolvedDeviceId, status: 2 })
    }
    sseEmit('maintenance-update', { id: result.insertId })
    sseEmit('workorder-update', { type: 'maintenance', id: result.insertId, action: 'created' })
    res.json({ id: result.insertId, ...req.body, sla_due_at: slaDueAt, sla_hours: slaHours })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 更新维修工单
router.put('/maintenance/:id', async (req, res) => {
  const { content, level, status, handler_name, return_reason, participants, completion_note, completion_images, sparepart_usage, completed_at, delay_images, delay_reason, delay_days } = req.body
  try {
    const updates = []
    const values = []
    if (content !== undefined) { updates.push('content=?'); values.push(content) }
    if (level !== undefined) { updates.push('level=?'); values.push(level) }
    if (status !== undefined) { updates.push('status=?'); values.push(status) }
    if (handler_name !== undefined) { updates.push('handler_name=?'); values.push(handler_name) }
    if (return_reason !== undefined) { updates.push('return_reason=?'); values.push(return_reason) }
    if (participants !== undefined) { updates.push('participants=?'); values.push(JSON.stringify(participants)) }
    if (completion_note !== undefined) { updates.push('completion_note=?'); values.push(completion_note) }
    if (completion_images !== undefined) { updates.push('completion_images=?'); values.push(JSON.stringify(completion_images)) }
    if (sparepart_usage !== undefined) { updates.push('sparepart_usage=?'); values.push(JSON.stringify(sparepart_usage)) }
    if (delay_images !== undefined) { updates.push('delay_images=?'); values.push(JSON.stringify(delay_images)) }
    if (delay_reason !== undefined) { updates.push('delay_reason=?'); values.push(delay_reason) }
    if (delay_days !== undefined) { updates.push('delay_days=?'); values.push(delay_days) }
    if (completed_at !== undefined) { updates.push('completed_at=?'); values.push(completed_at) }
    if (req.body.problem_order_id !== undefined) { updates.push('problem_order_id=?'); values.push(req.body.problem_order_id) }
    if (req.body.closed_at !== undefined) { updates.push('closed_at=?'); values.push(req.body.closed_at) }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' })
    // 每次更新都滚动更新 last_action_at
    updates.push('last_action_at=NOW()')
    values.push(req.params.id)
    await pool.query(`UPDATE maintenance_orders SET ${updates.join(', ')} WHERE id=?`, values)

    // 维修工单被退回 → 设备状态改为维修中（工单还在进行中）
    if (status === 'returned') {
      const [orders] = await pool.query('SELECT device_id, problem_order_id FROM maintenance_orders WHERE id = ?', [req.params.id])
      if (orders.length > 0 && orders[0].device_id) {
        await pool.query('UPDATE devices SET status = 2 WHERE id = ?', [orders[0].device_id])
        sseEmit('device-status-change', { device_id: orders[0].device_id, status: 2 })
      } else if (orders.length > 0 && orders[0].problem_order_id) {
        const [pos] = await pool.query('SELECT device_id FROM problem_orders WHERE id = ?', [orders[0].problem_order_id])
        if (pos.length > 0 && pos[0].device_id) {
          await pool.query('UPDATE devices SET status = 2 WHERE id = ?', [pos[0].device_id])
          sseEmit('device-status-change', { device_id: pos[0].device_id, status: 2 })
        }
      }
    }

    // 维修工单完成/闭环 → 重置设备状态为正常(0)
    if (status === 'completed' || status === 'closed') {
      const [orders] = await pool.query('SELECT device_id, problem_order_id FROM maintenance_orders WHERE id = ?', [req.params.id])
      if (orders.length > 0) {
        let devId = orders[0].device_id
        if (!devId && orders[0].problem_order_id) {
          const [pos] = await pool.query('SELECT device_id FROM problem_orders WHERE id = ?', [orders[0].problem_order_id])
          if (pos.length > 0) devId = pos[0].device_id
        }
        if (devId) {
          const [activeOrders] = await pool.query(
            'SELECT id FROM maintenance_orders WHERE device_id = ? AND id != ? AND status NOT IN (?, ?)',
            [devId, req.params.id, 'completed', 'closed']
          )
          if (activeOrders.length === 0) {
            await pool.query('UPDATE devices SET status = 0 WHERE id = ?', [devId])
            sseEmit('device-status-change', { device_id: devId, status: 0 })
          }
        }
      }
    }

    sseEmit('workorder-update', { type: 'maintenance', id: Number(req.params.id) })
    res.json({ id: req.params.id, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 删除维修工单
router.delete('/maintenance/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM maintenance_orders WHERE id=?', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 维修工单退回时，重建问题工单
router.post('/recreate-problem', async (req, res) => {
  const { problem_order_id } = req.body
  if (!problem_order_id) return res.status(400).json({ error: '缺少 problem_order_id' })
  try {
    const [pos] = await pool.query('SELECT device_id, content, reporter_name FROM problem_orders WHERE id = ?', [problem_order_id])
    if (pos.length === 0) return res.status(404).json({ error: '原问题工单不存在' })
    const po = pos[0]
    const [result] = await pool.query(
      'INSERT INTO problem_orders (content, reporter_name, status, device_id) VALUES (?, ?, ?, ?)',
      [po.content + ' [退回重开]', po.reporter_name || '系统', 'pending', po.device_id]
    )
    res.json({ id: result.insertId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ====================================================================
// P1: SLA 状态查询 (P2.1 工单 P1)
// 返回即将超时 (2h 内) + 已超时的未关闭工单
// 前端用于“工单告警面板”或列表顶部高亮
// ====================================================================
router.get('/sla-status', async (req, res) => {
  try {
    // 1. 问题工单 SLA 状态
    const [problemRows] = await pool.query(
      `SELECT id, content, status, device_id, team, member_name, created_at, sla_due_at, sla_hours
       FROM problem_orders
       WHERE sla_due_at IS NOT NULL
         AND status NOT IN ('closed', 'self_resolved')
       ORDER BY sla_due_at ASC`
    )
    // 2. 维修工单 SLA 状态
    const [maintRows] = await pool.query(
      `SELECT id, content, level, status, device_id, team, member_name, created_at, sla_due_at, sla_hours
       FROM maintenance_orders
       WHERE sla_due_at IS NOT NULL
         AND status NOT IN ('completed', 'closed')
       ORDER BY sla_due_at ASC`
    )
    // 3. 计算状态
    const enrich = (row, type) => ({
      ...row,
      type,
      sla_status: getSlaStatus(row.sla_due_at, row.status),
      minutes_remaining: row.sla_due_at ? Math.round((new Date(row.sla_due_at).getTime() - Date.now()) / 60000) : null
    })
    const all = [...problemRows.map(r => enrich(r, 'problem')), ...maintRows.map(r => enrich(r, 'maintenance'))]
    const breached = all.filter(r => r.sla_status === 'breached')
    const urgent = all.filter(r => r.sla_status === 'urgent')
    const warning = all.filter(r => r.sla_status === 'warning')
    res.json({
      total: all.length,
      breached: { count: breached.length, items: breached },
      urgent: { count: urgent.length, items: urgent },
      warning: { count: warning.length, items: warning },
      normal: { count: all.length - breached.length - urgent.length - warning.length }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ====================================================================
// P1: 工单统计面板 (P2.1 工单 P1)
// GET /api/workorders/stats?days=7 (默认 7 天窗口)
// 返回: 今日 / 总计 / SLA / 按状态 / 按类型 / 按班组 / 平均处理时长
// ====================================================================
router.get('/stats', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 90)
    const since = new Date(Date.now() - days * 24 * 3600 * 1000)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    // 今日新建 (两表合并)
    const [todayNew] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM problem_orders WHERE created_at >= ?) +
         (SELECT COUNT(*) FROM maintenance_orders WHERE created_at >= ?) AS cnt`,
      [todayStart, todayStart]
    )
    // 今日闭环
    const [todayClosed] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM problem_orders WHERE closed_at >= ?) +
         (SELECT COUNT(*) FROM maintenance_orders WHERE closed_at >= ?) AS cnt`,
      [todayStart, todayStart]
    )
    // 总未闭环
    const [openCount] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM problem_orders WHERE status NOT IN ('closed', 'self_resolved')) +
         (SELECT COUNT(*) FROM maintenance_orders WHERE status NOT IN ('completed', 'closed')) AS cnt`
    )
    // 超 SLA 数 (未关闭且已超时)
    const [slaBreached] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM problem_orders WHERE sla_due_at < NOW() AND status NOT IN ('closed', 'self_resolved')) +
         (SELECT COUNT(*) FROM maintenance_orders WHERE sla_due_at < NOW() AND status NOT IN ('completed', 'closed')) AS cnt`
    )
    // 即将超时 (2h 内未关闭)
    const twoHoursLater = new Date(Date.now() + 2 * 3600 * 1000)
    const [slaWarning] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM problem_orders WHERE sla_due_at BETWEEN NOW() AND ? AND status NOT IN ('closed', 'self_resolved')) +
         (SELECT COUNT(*) FROM maintenance_orders WHERE sla_due_at BETWEEN NOW() AND ? AND status NOT IN ('completed', 'closed')) AS cnt`,
      [twoHoursLater, twoHoursLater]
    )
    // 平均处理时长 (分钟, 仅已闭环)
    const [avgMinutes] = await pool.query(
      `SELECT
         (SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, COALESCE(closed_at, NOW()))) FROM problem_orders WHERE status IN ('closed', 'self_resolved')) AS p_avg,
         (SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, COALESCE(closed_at, NOW()))) FROM maintenance_orders WHERE status IN ('completed', 'closed')) AS m_avg`
    )
    const pAvg = avgMinutes[0].p_avg
    const mAvg = avgMinutes[0].m_avg
    const overallAvg = (pAvg && mAvg) ? Math.round((pAvg + mAvg) / 2) : (pAvg || mAvg || null)

    // 按状态 (问题工单)
    const [problemByStatus] = await pool.query(
      `SELECT status, COUNT(*) AS cnt FROM problem_orders WHERE created_at >= ? GROUP BY status`, [since]
    )
    // 按状态 (维修工单)
    const [maintByStatus] = await pool.query(
      `SELECT status, COUNT(*) AS cnt FROM maintenance_orders WHERE created_at >= ? GROUP BY status`, [since]
    )
    // 按班组 (问题工单)
    const [problemByTeam] = await pool.query(
      `SELECT team, COUNT(*) AS cnt FROM problem_orders WHERE created_at >= ? AND team IS NOT NULL GROUP BY team ORDER BY cnt DESC`, [since]
    )
    // 按班组 (维修工单)
    const [maintByTeam] = await pool.query(
      `SELECT team, COUNT(*) AS cnt FROM maintenance_orders WHERE created_at >= ? AND team IS NOT NULL GROUP BY team ORDER BY cnt DESC`, [since]
    )

    res.json({
      window_days: days,
      today: {
        new: todayNew[0].cnt,
        closed: todayClosed[0].cnt,
        new_minus_closed: todayNew[0].cnt - todayClosed[0].cnt
      },
      open: openCount[0].cnt,
      sla: {
        breached: slaBreached[0].cnt,
        warning_2h: slaWarning[0].cnt
      },
      avg_minutes: {
        problem: pAvg ? Math.round(pAvg) : null,
        maintenance: mAvg ? Math.round(mAvg) : null,
        overall: overallAvg
      },
      by_status: {
        problem: problemByStatus,
        maintenance: maintByStatus
      },
      by_team: {
        problem: problemByTeam,
        maintenance: maintByTeam
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router