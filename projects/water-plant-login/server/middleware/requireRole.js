// 简易角色守卫中间件
// 用法: router.use(requireRole(['系统管理人']))
// 读取请求头 X-User-Id (数字), 后端反查 role
// 这样避免 HTTP header 不能直接传中文的限制
//
// 注: 当前项目未启用 JWT/Session, 此中间件作为基础防护层;
//     未来接入完整鉴权时直接替换此文件即可, 调用方不变
import pool from '../db/mysql.js'

export function requireRole(allowedRoles) {
  return async (req, res, next) => {
    try {
      const userId = parseInt(req.headers['x-user-id'])
      if (!userId) {
        return res.status(401).json({ error: '缺少用户标识 (X-User-Id header)' })
      }
      const [rows] = await pool.query('SELECT id, name, role FROM users WHERE id = ?', [userId])
      if (!rows[0]) {
        return res.status(401).json({ error: '用户不存在' })
      }
      if (!allowedRoles.includes(rows[0].role)) {
        return res.status(403).json({ error: `权限不足, 需要角色: ${allowedRoles.join('/')}, 当前: ${rows[0].role}` })
      }
      req.currentUser = rows[0]
      next()
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }
}
