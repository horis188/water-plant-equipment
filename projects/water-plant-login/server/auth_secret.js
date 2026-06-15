// JWT 签名密钥 (生产环境应该用环境变量)
// 当前项目阶段硬编码, 上线前需改为环境变量
export const JWT_SECRET = 'water-plant-rbac-2026-jwt-secret'
export const JWT_EXPIRES_IN = '8h'  // 一个班次
