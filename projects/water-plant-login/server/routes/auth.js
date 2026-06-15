// ====================================================================
// 登录接口
// ====================================================================
import express from 'express'
import jwt from 'jsonwebtoken'
import pool from '../db/mysql.js'
import { JWT_SECRET, JWT_EXPIRES_IN } from '../auth_secret.js'

const router = express.Router()

// 登录: 校验用户名+密码, 返回 user 完整信息 + JWT token
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: '缺少用户名或密码' })
    }
    const [rows] = await pool.query(
      'SELECT id, username, name, role, role_id, team, member_name, avatar, password FROM users WHERE username = ?',
      [username]
    )
    if (!rows[0]) {
      return res.status(401).json({ error: '账号不存在' })
    }
    if (String(rows[0].password) !== String(password)) {
      return res.status(401).json({ error: '密码错误' })
    }
    // 默认 avatar: 取 name 第一个汉字
    let avatar = rows[0].avatar
    if (!avatar || avatar === '?') {
      avatar = rows[0].name ? rows[0].name.charAt(0) : '?'
    }
    // 不返回 password
    const { password: _, ...user } = rows[0]
    // 签发 JWT (P0-5 安全修复: 取代明文 X-User-Id header 验证)
    const token = jwt.sign(
      { userId: user.id, roleId: user.role_id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )
    res.json({ ...user, avatar, token })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
