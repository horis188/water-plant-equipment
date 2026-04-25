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
  const { content, reporter_name, images, videos } = req.body
  try {
    const [result] = await pool.query(
      'INSERT INTO problem_orders (content, reporter_name, images, videos) VALUES (?, ?, ?, ?)',
      [content, reporter_name, images, videos]
    )
    res.json({ id: result.insertId, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 更新问题工单
router.put('/problem/:id', async (req, res) => {
  const { content, status, resolution } = req.body
  try {
    await pool.query(
      'UPDATE problem_orders SET content=?, status=?, resolution=? WHERE id=?',
      [content, status, resolution, req.params.id]
    )
    res.json({ id: req.params.id, ...req.body })
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
  const { content, level, status, assigner_name, handler_name } = req.body
  try {
    const [result] = await pool.query(
      'INSERT INTO maintenance_orders (content, level, status, assigner_name, handler_name) VALUES (?, ?, ?, ?, ?)',
      [content, level || '普通', status || 'pending', assigner_name, handler_name]
    )
    res.json({ id: result.insertId, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 更新维修工单
router.put('/maintenance/:id', async (req, res) => {
  const { content, level, status, handler_name } = req.body
  try {
    await pool.query(
      'UPDATE maintenance_orders SET content=?, level=?, status=?, handler_name=? WHERE id=?',
      [content, level, status, handler_name, req.params.id]
    )
    res.json({ id: req.params.id, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router