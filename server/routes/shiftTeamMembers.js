import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import pool from '../db/mysql.js'

const router = express.Router()

// P0-5 安全修复: 所有业务 API 强制登录
router.use(requireAuth)

// 按班组获取岗位人员列表（可选按 member_type 过滤：值班/带班）
router.get('/:teamName', async (req, res) => {
  const { teamName } = req.params
  const { member_type } = req.query
  try {
    let sql = 'SELECT * FROM shift_team_members WHERE team_name = ?'
    const params = [teamName]
    if (member_type) {
      sql += ' AND member_type = ?'
      params.push(member_type)
    }
    sql += ' ORDER BY id'
    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 新增岗位人员（初始化数据用）
router.post('/', async (req, res) => {
  const { team_name, member_name } = req.body
  try {
    await pool.query(
      'INSERT IGNORE INTO shift_team_members (team_name, member_name) VALUES (?, ?)',
      [team_name, member_name]
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
