import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import pool from '../db/mysql.js'
import { sseEmit } from '../events.js'

const router = express.Router()

// P0-5 安全修复: 所有业务 API 强制登录
router.use(requireAuth)

// 获取问题工单
router.get('/problem', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM problem_orders ORDER BY id DESC')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 创建问题工单
router.post('/problem', async (req, res) => {
  const { content, reporter_name, images, videos, deviceId, team, role, member_name } = req.body
  try {
    const [result] = await pool.query(
      'INSERT INTO problem_orders (content, reporter_name, images, videos, device_id, team, role, member_name, last_action_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [content, reporter_name, images, videos, deviceId || null, team || null, role || null, member_name || null]
    )
    res.json({ id: result.insertId, ...req.body })
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
    const [result] = await pool.query(
      'INSERT INTO maintenance_orders (content, level, status, assigner_name, handler_name, problem_order_id, device_id, team, role, user_name, reporter_name, member_name, last_action_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [content, level || '普通', status || 'pending', assigner_name, handler_name, problem_order_id || null, resolvedDeviceId, team || null, role || null, user_name || null, resolvedReporter, member_name || null]
    )
    // 创建时设备设为维修中
    if (resolvedDeviceId) {
      await pool.query('UPDATE devices SET status = 2 WHERE id = ?', [resolvedDeviceId])
      sseEmit('device-status-change', { device_id: resolvedDeviceId, status: 2 })
    }
    sseEmit('maintenance-update', { id: result.insertId })
    res.json({ id: result.insertId, ...req.body })
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

export default router