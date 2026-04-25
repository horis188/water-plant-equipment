import express from 'express'
import pool from '../db/mysql.js'

const router = express.Router()

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
    await pool.query(
      'UPDATE devices SET name=?, type=?, model=?, location=?, params=?, status=?, value=?, vendor=?, remark=? WHERE id=?',
      [name, type, model, location, params, status, value, vendor, remark, req.params.id]
    )
    res.json({ id: req.params.id, ...req.body })
  } catch (err) {
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