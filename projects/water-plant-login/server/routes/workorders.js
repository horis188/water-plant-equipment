import express from 'express'
import pool from '../db/mysql.js'

const router = express.Router()

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
  const { content, reporter_name, images, videos, deviceId } = req.body
  try {
    const [result] = await pool.query(
      'INSERT INTO problem_orders (content, reporter_name, images, videos, device_id) VALUES (?, ?, ?, ?, ?)',
      [content, reporter_name, images, videos, deviceId || null]
    )
    res.json({ id: result.insertId, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 更新问题工单
router.put('/problem/:id', async (req, res) => {
  const { content, status, resolution, deviceId } = req.body
  try {
    const updates = []
    const values = []
    if (content !== undefined) { updates.push('content=?'); values.push(content) }
    if (status !== undefined) { updates.push('status=?'); values.push(status) }
    if (resolution !== undefined) { updates.push('resolution=?'); values.push(resolution) }
    if (deviceId !== undefined) { updates.push('device_id=?'); values.push(deviceId || null) }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' })
    values.push(req.params.id)
    await pool.query(`UPDATE problem_orders SET ${updates.join(', ')} WHERE id=?`, values)
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
  const { content, level, status, assigner_name, handler_name, problem_order_id, deviceId } = req.body
  try {
    const [result] = await pool.query(
      'INSERT INTO maintenance_orders (content, level, status, assigner_name, handler_name, problem_order_id, device_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [content, level || '普通', status || 'pending', assigner_name, handler_name, problem_order_id || null, deviceId || null]
    )
    res.json({ id: result.insertId, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 更新维修工单
router.put('/maintenance/:id', async (req, res) => {
  const { content, level, status, handler_name, return_reason } = req.body
  try {
    const updates = []
    const values = []
    if (content !== undefined) { updates.push('content=?'); values.push(content) }
    if (level !== undefined) { updates.push('level=?'); values.push(level) }
    if (status !== undefined) { updates.push('status=?'); values.push(status) }
    if (handler_name !== undefined) { updates.push('handler_name=?'); values.push(handler_name) }
    if (return_reason !== undefined) { updates.push('return_reason=?'); values.push(return_reason) }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' })
    values.push(req.params.id)
    await pool.query(`UPDATE maintenance_orders SET ${updates.join(', ')} WHERE id=?`, values)
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

export default router