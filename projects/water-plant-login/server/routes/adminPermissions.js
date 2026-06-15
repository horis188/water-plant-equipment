// ====================================================================
// 权限点管理 API (P0-5)
// 前缀: /api/admin/permissions
// ====================================================================
import express from 'express'
import pool from '../db/mysql.js'
import { requirePermission } from '../middleware/requirePermission.js'

const router = express.Router()

async function safeQuery(sql, params = []) {
  const [rows] = await pool.query(sql, params)
  return rows
}

// 列出所有权限点 (按 module 分组, 含每个角色的勾选状态可选)
router.get('/', requirePermission('menu:admin_roles'), async (req, res) => {
  try {
    const { roleId } = req.query
    const perms = await safeQuery(
      `SELECT id, code, name, module, type, path, remark
       FROM permissions ORDER BY module, id`
    )
    if (!roleId) {
      // 不带 roleId: 只返回权限点本身
      return res.json({ rows: perms, total: perms.length })
    }
    // 带 roleId: 标记该角色已勾选的权限
    const checked = await safeQuery(
      `SELECT permission_id FROM role_permissions WHERE role_id = ?`,
      [parseInt(roleId)]
    )
    const checkedSet = new Set(checked.map(r => r.permission_id))
    const rows = perms.map(p => ({ ...p, checked: checkedSet.has(p.id) ? 1 : 0 }))
    res.json({ rows, total: rows.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
