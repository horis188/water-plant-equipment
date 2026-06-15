// ====================================================================
// 权限点守卫中间件 (P0-5 完整 RBAC)
// 用法: router.use('/some-path', requirePermission('menu:admin'))
//       router.post('/xxx', requirePermission('btn:role_create'), handler)
// 读取 X-User-Id header, 后端反查用户角色, 再查该角色是否有指定 permission_code
// 返回 403 + 缺少的 permission code
//
// 注: 当前项目未启用 JWT/Session, 此中间件作为基础防护层;
//     升级到完整鉴权时直接替换此文件即可, 调用方不变
// ====================================================================
import pool from '../db/mysql.js'

export function requirePermission(permissionCode) {
  return async (req, res, next) => {
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
      const user = rows[0]
      if (!user.role_id || !user.role_enabled) {
        return res.status(403).json({ error: `角色未配置或已停用, 当前: ${user.role || '未分配'}` })
      }
      // 查该角色是否拥有指定权限
      const [permRows] = await pool.query(
        `SELECT 1 FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = ? AND p.code = ?`,
        [user.role_id, permissionCode]
      )
      if (permRows.length === 0) {
        return res.status(403).json({
          error: `权限不足, 需要权限点: ${permissionCode}, 当前角色: ${user.role_code}`,
          need: permissionCode
        })
      }
      req.currentUser = {
        id: user.id, name: user.name,
        role: user.role, role_id: user.role_id, role_code: user.role_code
      }
      next()
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }
}
