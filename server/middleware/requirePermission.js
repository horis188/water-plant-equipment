// ====================================================================
// 权限点守卫中间件 (P0-5 完整 RBAC)
// 用法: router.use('/some-path', requirePermission('menu:admin'))
//       router.post('/xxx', requirePermission('btn:role_create'), handler)
// 验签 + 反查用户角色 + 检查该角色是否有指定 permission_code
// 返回 403 + 缺少的 permission code
//
// 注: 当前项目未启用 JWT/Session, 此中间件作为基础防护层;
//     升级到完整鉴权时直接替换此文件即可, 调用方不变
// ====================================================================
import pool from '../db/mysql.js'
import { requireAuth } from './requireAuth.js'

export function requirePermission(permissionCode) {
  return async (req, res, next) => {
    // 1. 先做 token 验签 + 拿 user
    await requireAuth(req, res, async (err) => {
      if (err) return
      if (res.headersSent) return
      const user = req.currentUser
      if (!user.role_id) {
        return res.status(403).json({ error: `用户角色未配置, 当前: ${user.role || '未分配'}` })
      }
      // 2. 查该角色是否拥有指定权限
      try {
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
        next()
      } catch (e) {
        res.status(500).json({ error: e.message })
      }
    })
  }
}
