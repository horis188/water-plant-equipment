// ====================================================================
// 工单模板 API (P2.1 工单 P1)
// 前缀: /api/workorder-templates
// ====================================================================
import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import pool from '../db/mysql.js'

const router = express.Router()

router.use(requireAuth)

// 列出模板 (支持 type 过滤, 默认仅启用的)
router.get('/', async (req, res) => {
  try {
    const { type, includeDisabled } = req.query
    const conditions = []
    const params = []
    if (type) { conditions.push('type = ?'); params.push(type) }
    if (includeDisabled !== '1') { conditions.push('enabled = 1') }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    const [rows] = await pool.query(
      `SELECT * FROM workorder_templates ${where} ORDER BY type, sort_order, id`,
      params
    )
    res.json({ rows, total: rows.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 创建模板
router.post('/', async (req, res) => {
  try {
    const { name, type, default_content, default_level = null, default_sla_hours = null, category = null, sort_order = 0 } = req.body
    if (!name || !type || !default_content) {
      return res.status(400).json({ error: 'name/type/default_content 必填' })
    }
    if (!['problem', 'maintenance'].includes(type)) {
      return res.status(400).json({ error: 'type 必须是 problem 或 maintenance' })
    }
    const [r] = await pool.query(
      `INSERT INTO workorder_templates (name, type, default_content, default_level, default_sla_hours, category, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, type, default_content, default_level, default_sla_hours, category, sort_order]
    )
    res.json({ success: true, id: r.insertId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 更新模板
router.put('/:id', async (req, res) => {
  try {
    const { name, default_content, default_level, default_sla_hours, category, sort_order, enabled } = req.body
    const fields = []
    const params = []
    if (name !== undefined) { fields.push('name = ?'); params.push(name) }
    if (default_content !== undefined) { fields.push('default_content = ?'); params.push(default_content) }
    if (default_level !== undefined) { fields.push('default_level = ?'); params.push(default_level) }
    if (default_sla_hours !== undefined) { fields.push('default_sla_hours = ?'); params.push(default_sla_hours) }
    if (category !== undefined) { fields.push('category = ?'); params.push(category) }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); params.push(sort_order) }
    if (enabled !== undefined) { fields.push('enabled = ?'); params.push(enabled ? 1 : 0) }
    if (!fields.length) return res.json({ success: true, noop: true })
    params.push(req.params.id)
    await pool.query(`UPDATE workorder_templates SET ${fields.join(', ')} WHERE id = ?`, params)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 启停 (切换 enabled)
router.patch('/:id/toggle', async (req, res) => {
  try {
    await pool.query(`UPDATE workorder_templates SET enabled = 1 - enabled WHERE id = ?`, [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 删除模板
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM workorder_templates WHERE id = ?`, [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
