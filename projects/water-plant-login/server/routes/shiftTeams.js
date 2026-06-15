import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import pool from '../db/mysql.js'

const router = express.Router()

// P0-5 安全修复: 所有业务 API 强制登录
router.use(requireAuth)

// 获取所有班组信息
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM shift_teams ORDER BY id')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 更新班组信息
router.put('/:teamName', async (req, res) => {
  const { teamName } = req.params
  const { member_name, leader_name, shift_type } = req.body
  try {
    await pool.query(
      'UPDATE shift_teams SET member_name=?, leader_name=?, shift_type=? WHERE team_name=?',
      [member_name, leader_name, shift_type || '早班', teamName]
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router