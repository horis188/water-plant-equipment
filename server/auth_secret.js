// JWT 签名密钥 - 生产环境必须通过环境变量注入
// .env 模板见项目根 .env.example
const _secret = process.env.JWT_SECRET
if (!_secret) {
  console.warn('[auth] JWT_SECRET 未设置,使用开发默认值(生产环境强烈建议设置)')
}

export const JWT_SECRET = _secret || 'dev-insecure-secret-please-replace'
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'  // 一个班次
