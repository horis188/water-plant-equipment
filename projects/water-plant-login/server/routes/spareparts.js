import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import pool from '../db/mysql.js'
import { sseEmit } from '../events.js'

const router = express.Router()

// P0-5 安全修复: 所有业务 API 强制登录
router.use(requireAuth)

// ====================================================================
// P1: 低库存告警 (P2.3 备件 P1)
// 全局 Set 记录"已告警过的备件 ID", 防止重复 emit
// 当备件从非低库存 → 低库存时, 清掉 Set 记录, 允许下次再次告警
// ====================================================================
const lowStockNotified = new Set()
async function checkAndEmitLowStock(sparepart) {
  if (!sparepart) return
  const isLow = Number(sparepart.quantity) < Number(sparepart.min_quantity)
  const wasNotified = lowStockNotified.has(sparepart.id)
  if (isLow && !wasNotified) {
    lowStockNotified.add(sparepart.id)
    sseEmit('sparepart-low-stock', {
      sparepart_id: sparepart.id,
      name: sparepart.name,
      quantity: sparepart.quantity,
      min_quantity: sparepart.min_quantity,
      shortage: sparepart.min_quantity - sparepart.quantity
    })
  } else if (!isLow && wasNotified) {
    // 库存恢复, 清掉告警状态, 下次再低库存时可重新告警
    lowStockNotified.delete(sparepart.id)
  }
}

// 获取所有备件
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM spareparts ORDER BY id DESC')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 低库存列表 (P2.3)
router.get('/low-stock-list', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM spareparts WHERE min_quantity > 0 AND quantity < min_quantity ORDER BY (min_quantity - quantity) DESC`
    )
    res.json({
      count: rows.length,
      items: rows.map(r => ({ ...r, shortage: r.min_quantity - r.quantity }))
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 新增备件
router.post('/', async (req, res) => {
  const { name, type, quantity, min_quantity, location, vendor, specs, tech_docs } = req.body
  try {
    const techDocsJson = tech_docs ? JSON.stringify(tech_docs) : null
    const [result] = await pool.query(
      'INSERT INTO spareparts (name, type, quantity, min_quantity, location, vendor, specs, tech_docs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, type, quantity || 0, min_quantity || 0, location, vendor, specs, techDocsJson]
    )
    const newSp = { id: result.insertId, name, type, quantity: quantity || 0, min_quantity: min_quantity || 0 }
    await checkAndEmitLowStock(newSp)
    res.json({ id: result.insertId, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 更新备件
router.put('/:id', async (req, res) => {
  const { name, type, quantity, min_quantity, location, vendor, specs, tech_docs } = req.body
  try {
    const techDocsJson = tech_docs ? JSON.stringify(tech_docs) : null
    await pool.query(
      'UPDATE spareparts SET name=?, type=?, quantity=?, min_quantity=?, location=?, vendor=?, specs=?, tech_docs=? WHERE id=?',
      [name, type, quantity, min_quantity || 0, location, vendor, specs, techDocsJson, req.params.id]
    )
    await checkAndEmitLowStock({ id: parseInt(req.params.id), quantity, min_quantity: min_quantity || 0 })
    res.json({ id: req.params.id, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 删除备件
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM spareparts WHERE id=?', [req.params.id])
    lowStockNotified.delete(parseInt(req.params.id))  // 清理 Set
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
    // 检测低库存
    const [rows] = await pool.query('SELECT id, name, quantity, min_quantity FROM spareparts WHERE name = ?', [sparepart_name])
    if (rows[0]) await checkAndEmitLowStock(rows[0])
    res.json({ id: result.insertId, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
