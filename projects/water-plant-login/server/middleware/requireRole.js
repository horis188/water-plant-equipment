// ====================================================================
// 角色守卫中间件
// 用法: router.use('/xxx', requireRole(['系统管理人', '带班']))
// 验签 + 检查用户角色是否在 allowedRoles 列表中
//
// 注: 当前项目未启用 JWT/Session, 此中间件作为基础防护层;
//     升级到完整鉴权时直接替换此文件即可, 调用方不变
// ====================================================================
import { requireAuth } from './requireAuth.js'

export function requireRole(allowedRoles) {
  return async (req, res, next) => {
    // 1. 先做 token 验签 + 拿 user
    await requireAuth(req, res, async (err) => {
      if (err) return // requireAuth 已经响应了
      if (res.headersSent) return
      // 2. 检查角色
      const userRole = req.currentUser?.role
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: `权限不足, 需要角色: ${allowedRoles.join('/')}, 当前: ${userRole}`
        })
      }
      next()
    })
  }
}
