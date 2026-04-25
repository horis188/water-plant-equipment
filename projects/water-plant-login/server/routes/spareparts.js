import express from 'express'
import pool from '../db/mysql.js'

const router = express.Router()

// 获取所有备件
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM spareparts ORDER BY id DESC')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 新增备件
router.post('/', async (req, res) => {
  const { name, type, quantity, location, vendor, specs } = req.body
  try {
    const [result] = await pool.query(
      'INSERT INTO spareparts (name, type, quantity, location, vendor, specs) VALUES (?, ?, ?, ?, ?, ?)',
      [name, type, quantity || 0, location, vendor, specs]
    )
    res.json({ id: result.insertId, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 更新备件
router.put('/:id', async (req, res) => {
  const { name, type, quantity, location, vendor, specs } = req.body
  try {
    await pool.query(
      'UPDATE spareparts SET name=?, type=?, quantity=?, location=?, vendor=?, specs=? WHERE id=?',
      [name, type, quantity, location, vendor, specs, req.params.id]
    )
    res.json({ id: req.params.id, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 删除备件
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM spareparts WHERE id=?', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 出入仓记录
router.get('/logs', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM sparepart_logs ORDER BY id DESC LIMIT 200')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 添加出入仓记录
router.post('/logs', async (req, res) => {
  const { sparepart_name, action, quantity, operator } = req.body
  try {
    const [result] = await pool.query(
      'INSERT INTO sparepart_logs (sparepart_name, action, quantity, operator) VALUES (?, ?, ?, ?)',
      [sparepart_name, action, quantity, operator]
    )
    // 同时更新备件库存
    const sign = action === '入仓' ? '+' : '-'
    await pool.query(`UPDATE spareparts SET quantity = quantity ${sign} ? WHERE name = ?`, [quantity, sparepart_name])
    res.json({ id: result.insertId, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router