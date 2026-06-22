// ====================================================================
// JWT 鉴权中间件 (P0-5 安全修复)
// 用法: router.get('/xxx', requireAuth, handler)
//       router.use('/xxx', requireAuth)
// 读取 Authorization: Bearer <token> 头, 验 JWT, 查 DB 拿用户信息
// 验签失败返回 401, 用户/角色被禁用返回 403
// 成功后挂载: req.currentUser = { id, name, role, role_id, role_code, role_enabled }
//
// 注: 这是 X-User-Id header 伪造身份的安全修复
//     升级到完整 Session/Redis 时直接替换此文件即可, 调用方不变
// ====================================================================
import jwt from 'jsonwebtoken'
import pool from '../db/mysql.js'
import { JWT_SECRET } from '../auth_secret.js'

export async function requireAuth(req, res, next) {
  try {
    // 1. 提取 token
    const auth = req.headers['authorization'] || ''
    const match = auth.match(/^Bearer\s+(.+)$/i)
    if (!match) {
      return res.status(401).json({ error: '缺少 Authorization Bearer token' })
    }
    const token = match[1]

    // 2. 验签
    let payload
    try {
      payload = jwt.verify(token, JWT_SECRET)
    } catch (err) {
      const reason = err.name === 'TokenExpiredError' ? 'token 已过期' : 'token 无效'
      return res.status(401).json({ error: reason })
    }

    // 3. 反查 DB 拿最新用户信息 (角色被停用/用户被删除 → 拒绝)
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.role, u.role_id,
              r.code AS role_code, r.enabled AS role_enabled
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [payload.userId]
    )
    if (!rows[0]) {
      return res.status(401).json({ error: '用户不存在' })
    }
    const user = rows[0]
    if (user.role_id && !user.role_enabled) {
      return res.status(403).json({ error: `角色已停用, 当前: ${user.role}` })
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
