// ====================================================================
// 登录态守卫中间件 (P0-5)
// 用法: router.get('/xxx', requireLogin, handler)
// 仅验证 X-User-Id 存在 + 用户存在, 不要求具体权限码
// 用于: 登录后查自己权限码等基础接口
// ====================================================================
import pool from '../db/mysql.js'

export async function requireLogin(req, res, next) {
  try {
    const userId = parseInt(req.headers['x-user-id'])
    if (!userId) {
      return res.status(401).json({ error: '缺少用户标识 (X-User-Id header)' })
    }
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.role, u.role_id,
              r.code AS role_code, r.enabled AS role_enabled
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [userId]
    )
    if (!rows[0]) {
      return res.status(401).json({ error: '用户不存在' })
    }
    req.currentUser = {
      id: rows[0].id, name: rows[0].name,
      role: rows[0].role, role_id: rows[0].role_id, role_code: rows[0].role_code
    }
    next()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
