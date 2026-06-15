import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import pool from '../db/mysql.js'

const router = express.Router()

// P0-5 安全修复: 所有业务 API 强制登录
router.use(requireAuth)

// 获取所有设备
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM devices ORDER BY id DESC')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 新增设备
router.post('/', async (req, res) => {
  const { name, type, model, location, params, status, value, vendor, remark } = req.body
  try {
    const [result] = await pool.query(
      'INSERT INTO devices (name, type, model, location, params, status, value, vendor, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, type, model, location, params, status || '在用', value, vendor, remark]
    )
    res.json({ id: result.insertId, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 更新设备
router.put('/:id', async (req, res) => {
  const { name, type, model, location, params, status, value, vendor, remark } = req.body
  try {
    const updates = []
    const values = []
    if (name !== undefined) { updates.push('name=?'); values.push(name) }
    if (type !== undefined) { updates.push('type=?'); values.push(type) }
    if (model !== undefined) { updates.push('model=?'); values.push(model) }
    if (location !== undefined) { updates.push('location=?'); values.push(location) }
    if (params !== undefined) { updates.push('params=?'); values.push(params) }
    if (status !== undefined) {
      // 数字 0/1/2 转成字符串 在用/告警/维修中
      const statusMap = { 0: '在用', 1: '告警', 2: '维修中' }
      const strVal = typeof status === 'number' ? (statusMap[status] ?? status) : String(status)
      updates.push('status=?'); values.push(strVal)
    }
    if (value !== undefined) { updates.push('value=?'); values.push(value) }
    if (vendor !== undefined) { updates.push('vendor=?'); values.push(vendor) }
    if (remark !== undefined) { updates.push('remark=?'); values.push(remark) }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' })
    values.push(req.params.id)
    await pool.query(`UPDATE devices SET ${updates.join(', ')} WHERE id=?`, values)
    res.json({ id: req.params.id, ...req.body })
  } catch (err) {
    console.error('[devices PUT error]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// 删除设备
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM devices WHERE id=?', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 获取设备变动记录
router.get('/changes', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM device_changes ORDER BY id DESC LIMIT 100')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 批量更新设备状态
router.post('/batch-status', async (req, res) => {
  const { updates } = req.body // [{id, status}, ...]
  try {
    const statusMap = { '在用': 0, '告警': 1, '维修中': 2 }
    for (const u of updates) {
      const v = statusMap[u.status]
      if (v !== undefined) {
        await pool.query('UPDATE devices SET status = ? WHERE id = ?', [v, u.id])
      }
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 添加设备变动记录
router.post('/changes', async (req, res) => {
  const { device_name, change_type, operator, content } = req.body
  try {
    const [result] = await pool.query(
      'INSERT INTO device_changes (device_name, change_type, operator, content) VALUES (?, ?, ?, ?)',
      [device_name, change_type, operator, content]
    )
    res.json({ id: result.insertId, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router