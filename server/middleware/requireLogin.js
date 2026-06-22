// ====================================================================
// 登录态守卫中间件 (P0-5)
// 用法: router.get('/xxx', requireLogin, handler)
// 仅验证 token + 用户存在, 不要求具体权限码
// 用于: 登录后查自己权限码等基础接口
//
// 内部组合 requireAuth, 验签 + 查 user 一步完成
// ====================================================================
import { requireAuth } from './requireAuth.js'

export async function requireLogin(req, res, next) {
  return requireAuth(req, res, next)
}
