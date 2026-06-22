import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import pool from '../db/mysql.js'

const router = express.Router()

// P0-5 安全修复: 所有业务 API 强制登录
router.use(requireAuth)

// 获取所有用户
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, name, role, avatar FROM users ORDER BY role, id')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 按角色获取用户
router.get('/by-role/:role', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, name, role, avatar FROM users WHERE role = ? ORDER BY id', [req.params.role])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 获取所有角色分类
router.get('/roles', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT DISTINCT role FROM users ORDER BY role')
    res.json(rows.map(r => r.role))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router