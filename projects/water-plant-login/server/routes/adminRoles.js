// ====================================================================
// 角色管理 API (P0-5 完整 RBAC)
// 前缀: /api/admin/roles
// ====================================================================
import express from 'express'
import pool from '../db/mysql.js'
import { requireRole } from '../middleware/requireRole.js'
import { requirePermission } from '../middleware/requirePermission.js'
import { requireLogin } from '../middleware/requireLogin.js'

const router = express.Router()

async function safeQuery(sql, params = []) {
  const [rows] = await pool.query(sql, params)
  return rows
}

// 列出所有角色 (含权限数 / 用户数)
router.get('/', requirePermission('menu:admin_roles'), async (req, res) => {
  try {
    const rows = await safeQuery(`
      SELECT r.id, r.code, r.name, r.description, r.is_system, r.enabled, r.sort_order,
             r.created_at, r.updated_at,
             (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS perm_count,
             (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count
      FROM roles r
      ORDER BY r.sort_order, r.id
    `)
    res.json({ rows, total: rows.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 角色详情
router.get('/:id', requirePermission('menu:admin_roles'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const [rows] = await safeQuery(`SELECT * FROM roles WHERE id = ?`, [id])
    if (!rows[0]) return res.status(404).json({ error: '角色不存在' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 新建角色
router.post('/', requirePermission('btn:role_create'), async (req, res) => {
  try {
    const { code, name, description = '', enabled = 1, sort_order = 0 } = req.body
    if (!code || !name) return res.status(400).json({ error: 'code 和 name 必填' })
    // code 唯一性
    const dup = await safeQuery(`SELECT id FROM roles WHERE code = ?`, [code])
    if (dup.length) return res.status(400).json({ error: `角色 code 已存在: ${code}` })
    const result = await safeQuery(
      `INSERT INTO roles (code, name, description, is_system, enabled, sort_order) VALUES (?, ?, ?, 0, ?, ?)`,
      [code, name, description, enabled ? 1 : 0, sort_order]
    )
    res.json({ success: true, id: result.insertId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 编辑角色
router.put('/:id', requirePermission('btn:role_edit'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { name, description, enabled, sort_order } = req.body
    const [cur] = await safeQuery(`SELECT * FROM roles WHERE id = ?`, [id])
    if (!cur[0]) return res.status(404).json({ error: '角色不存在' })
    // 系统角色: code 不可改; 名字/描述/启用/排序都可改
    const fields = []
    const params = []
    if (name !== undefined) { fields.push('name = ?'); params.push(name) }
    if (description !== undefined) { fields.push('description = ?'); params.push(description) }
    if (enabled !== undefined) { fields.push('enabled = ?'); params.push(enabled ? 1 : 0) }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); params.push(sort_order) }
    if (!fields.length) return res.json({ success: true, noop: true })
    params.push(id)
    await safeQuery(`UPDATE roles SET ${fields.join(', ')} WHERE id = ?`, params)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 启停角色
router.patch('/:id/toggle', requirePermission('btn:role_edit'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const [cur] = await safeQuery(`SELECT * FROM roles WHERE id = ?`, [id])
    if (!cur[0]) return res.status(404).json({ error: '角色不存在' })
    if (cur[0].is_system) {
      return res.status(400).json({ error: '系统内置角色不可停用' })
    }
    await safeQuery(`UPDATE roles SET enabled = 1 - enabled WHERE id = ?`, [id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 删除角色
router.delete('/:id', requirePermission('btn:role_delete'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const [cur] = await safeQuery(`SELECT * FROM roles WHERE id = ?`, [id])
    if (!cur[0]) return res.status(404).json({ error: '角色不存在' })
    if (cur[0].is_system) return res.status(400).json({ error: '系统内置角色不可删除' })
    // 检查是否有用户绑定
    const [userCount] = await safeQuery(`SELECT COUNT(*) AS cnt FROM users WHERE role_id = ?`, [id])
    if (userCount[0].cnt > 0) {
      return res.status(400).json({ error: `该角色有 ${userCount[0].cnt} 个用户, 请先转移` })
    }
    await safeQuery(`DELETE FROM role_permissions WHERE role_id = ?`, [id])
    await safeQuery(`DELETE FROM roles WHERE id = ?`, [id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 查询角色的权限码列表 (前端菜单过滤用, 任何登录用户都能查, 用于登录后加载自身权限)
router.get('/:id/permissions', requireLogin, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const rows = await safeQuery(
      `SELECT p.code FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ?`,
      [id]
    )
    res.json({ codes: rows.map(r => r.code) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 覆盖式保存角色的权限分配
router.put('/:id/permissions', requirePermission('btn:role_edit'), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { permission_ids = [] } = req.body
    const [cur] = await safeQuery(`SELECT * FROM roles WHERE id = ?`, [id])
    if (!cur[0]) return res.status(404).json({ error: '角色不存在' })
    // 事务: 先删后插
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query(`DELETE FROM role_permissions WHERE role_id = ?`, [id])
      if (permission_ids.length) {
        const values = permission_ids.map(pid => [id, pid])
        await conn.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ?`,
          [values]
        )
      }
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
    res.json({ success: true, count: permission_ids.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
