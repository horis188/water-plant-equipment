// 系统管理统一路由 (前缀 /api/admin)
// 所有路由默认需要 系统管理人 角色
import express from 'express'
import pool from '../db/mysql.js'
import { requireRole } from '../middleware/requireRole.js'
import adminRolesRouter from './adminRoles.js'
import adminPermissionsRouter from './adminPermissions.js'

const router = express.Router()
// 中间件不全局应用, 放在需要鉴权的路由上 (部分 GET 接口如 shifts 需公开可读)

// ========== 工具函数 ==========
async function safeQuery(sql, params = []) {
  const [rows] = await pool.query(sql, params)
  return rows
}

// ============================================================
// P0-1 岗位字典 /api/admin/positions
// ============================================================
router.get('/positions', async (req, res) => {
  try {
    const { keyword = '', enabled = '' } = req.query
    const conditions = []
    const params = []
    if (keyword) {
      conditions.push('(name LIKE ? OR code LIKE ? OR role LIKE ?)')
      const kw = `%${keyword}%`
      params.push(kw, kw, kw)
    }
    if (enabled !== '') {
      conditions.push('enabled = ?')
      params.push(enabled === '1' ? 1 : 0)
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    const rows = await safeQuery(`SELECT * FROM position_dict ${where} ORDER BY sort, id`, params)
    res.json({ rows, total: rows.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/positions', async (req, res) => {
  try {
    const { code, name, role, sort = 0, enabled = 1, description = null } = req.body
    if (!code || !name || !role) return res.status(400).json({ error: '编码/名称/角色 必填' })
    const r = await safeQuery(
      `INSERT INTO position_dict (code, name, role, sort, enabled, description) VALUES (?, ?, ?, ?, ?, ?)`,
      [code, name, role, sort, enabled ? 1 : 0, description]
    )
    res.json({ id: r.insertId, success: true })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '编码已存在' })
    res.status(500).json({ error: err.message })
  }
})

router.put('/positions/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { code, name, role, sort = 0, enabled = 1, description = null } = req.body
    if (!code || !name || !role) return res.status(400).json({ error: '编码/名称/角色 必填' })
    await safeQuery(
      `UPDATE position_dict SET code=?, name=?, role=?, sort=?, enabled=?, description=? WHERE id=?`,
      [code, name, role, sort, enabled ? 1 : 0, description, id]
    )
    res.json({ success: true })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '编码已存在' })
    res.status(500).json({ error: err.message })
  }
})

router.patch('/positions/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params
    await safeQuery(`UPDATE position_dict SET enabled = 1 - enabled WHERE id = ?`, [id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/positions/:id', async (req, res) => {
  try {
    const { id } = req.params
    // 检查是否被 users 引用
    const [refs] = await pool.query(`SELECT COUNT(*) as cnt FROM users WHERE role = (SELECT role FROM position_dict WHERE id = ?)`, [id])
    if (refs[0].cnt > 0) return res.status(400).json({ error: '该岗位有用户引用, 不能删除 (可停用)' })
    await safeQuery(`DELETE FROM position_dict WHERE id = ?`, [id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// P0-2 班次时间配置 /api/admin/shifts
// GET 公开 (供 HandoverView 等业务页面读), 写操作需要管理员
// ============================================================
router.get('/shifts', async (req, res) => {
  try {
    const rows = await safeQuery(`SELECT * FROM shift_config ORDER BY sort, id`)
    res.json({ rows, total: rows.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 写操作: 要求系统管理人
router.post('/shifts', requireRole(['系统管理人']), async (req, res) => {
  try {
    const { name, start_time, end_time, cross_day = 0, sort = 0, enabled = 1, description = null } = req.body
    if (!name || !start_time || !end_time) return res.status(400).json({ error: '班次名/开始/结束时间 必填' })
    const r = await safeQuery(
      `INSERT INTO shift_config (name, start_time, end_time, cross_day, sort, enabled, description) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, start_time, end_time, cross_day ? 1 : 0, sort, enabled ? 1 : 0, description]
    )
    res.json({ id: r.insertId, success: true })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '班次名已存在' })
    res.status(500).json({ error: err.message })
  }
})

router.put('/shifts/:id', requireRole(['系统管理人']), async (req, res) => {
  try {
    const { id } = req.params
    const { name, start_time, end_time, cross_day = 0, sort = 0, enabled = 1, description = null } = req.body
    if (!name || !start_time || !end_time) return res.status(400).json({ error: '班次名/开始/结束时间 必填' })
    await safeQuery(
      `UPDATE shift_config SET name=?, start_time=?, end_time=?, cross_day=?, sort=?, enabled=?, description=? WHERE id=?`,
      [name, start_time, end_time, cross_day ? 1 : 0, sort, enabled ? 1 : 0, description, id]
    )
    res.json({ success: true })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '班次名已存在' })
    res.status(500).json({ error: err.message })
  }
})

router.patch('/shifts/:id/toggle', requireRole(['系统管理人']), async (req, res) => {
  try {
    await safeQuery(`UPDATE shift_config SET enabled = 1 - enabled WHERE id = ?`, [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/shifts/:id', requireRole(['系统管理人']), async (req, res) => {
  try {
    await safeQuery(`DELETE FROM shift_config WHERE id = ?`, [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// P0-3 班组配置 /api/admin/teams + members
// GET 公开 (供 HandoverView / 驾驶舱 等业务页用), 写要求管理员
// ============================================================
router.get('/teams', async (req, res) => {
  try {
    const rows = await safeQuery(`SELECT t.*,
      (SELECT COUNT(*) FROM shift_team_members WHERE team_name = t.team_name) AS member_count,
      (SELECT COUNT(*) FROM users WHERE team = t.team_name) AS user_count
      FROM shift_teams t ORDER BY t.id`)
    res.json({ rows, total: rows.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/teams', requireRole(['系统管理人']), async (req, res) => {
  try {
    const { team_name, member_name, leader_name, shift_type = '早班' } = req.body
    if (!team_name) return res.status(400).json({ error: '班组名必填' })
    const r = await safeQuery(
      `INSERT INTO shift_teams (team_name, member_name, leader_name, shift_type) VALUES (?, ?, ?, ?)`,
      [team_name, member_name || '', leader_name || '', shift_type]
    )
    res.json({ id: r.insertId, success: true })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '班组名已存在' })
    res.status(500).json({ error: err.message })
  }
})

router.put('/teams/:name', requireRole(['系统管理人']), async (req, res) => {
  try {
    const { name } = req.params
    const { member_name, leader_name, shift_type } = req.body
    await safeQuery(
      `UPDATE shift_teams SET member_name=?, leader_name=?, shift_type=? WHERE team_name=?`,
      [member_name || '', leader_name || '', shift_type || '早班', name]
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/teams/:name', requireRole(['系统管理人']), async (req, res) => {
  try {
    const { name } = req.params
    const [memberCount] = await pool.query('SELECT COUNT(*) as cnt FROM shift_team_members WHERE team_name = ?', [name])
    if (memberCount[0].cnt > 0) return res.status(400).json({ error: `该班组有 ${memberCount[0].cnt} 名成员, 请先移除成员` })
    const [userCount] = await pool.query('SELECT COUNT(*) as cnt FROM users WHERE team = ?', [name])
    if (userCount[0].cnt > 0) return res.status(400).json({ error: `该班组被 ${userCount[0].cnt} 名用户引用, 请先调整用户` })
    await safeQuery('DELETE FROM shift_teams WHERE team_name = ?', [name])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ===== 成员管理 =====
router.get('/teams/:name/members', async (req, res) => {
  try {
    const { name } = req.params
    const { member_type } = req.query
    let sql = 'SELECT * FROM shift_team_members WHERE team_name = ?'
    const params = [name]
    if (member_type) { sql += ' AND member_type = ?'; params.push(member_type) }
    // 排序: 先带班后值班, 同类型内按 id 升序
    sql += " ORDER BY CASE member_type WHEN '带班' THEN 0 ELSE 1 END, id"
    const rows = await safeQuery(sql, params)
    res.json({ rows, total: rows.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/teams/:name/members', requireRole(['系统管理人']), async (req, res) => {
  try {
    const { name } = req.params
    const { member_name, member_type = '值班' } = req.body
    if (!member_name) return res.status(400).json({ error: '成员姓名必填' })
    const [exist] = await pool.query('SELECT id FROM shift_team_members WHERE team_name=? AND member_name=? AND member_type=?', [name, member_name, member_type])
    if (exist[0]) return res.status(400).json({ error: '该成员已存在' })
    const r = await safeQuery(
      `INSERT INTO shift_team_members (team_name, member_name, member_type) VALUES (?, ?, ?)`,
      [name, member_name, member_type]
    )
    res.json({ id: r.insertId, success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/teams/members/:id', requireRole(['系统管理人']), async (req, res) => {
  try {
    const { id } = req.params
    const { member_name, member_type } = req.body
    await safeQuery(
      `UPDATE shift_team_members SET member_name=?, member_type=? WHERE id=?`,
      [member_name, member_type, id]
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/teams/members/:id', requireRole(['系统管理人']), async (req, res) => {
  try {
    const { id } = req.params
    await safeQuery('DELETE FROM shift_team_members WHERE id = ?', [id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// P0-4 用户管理 /api/admin/users
// 全部要求系统管理人
// ============================================================
router.get('/users', requireRole(['系统管理人']), async (req, res) => {
  try {
    const { keyword = '', role = '', team = '', enabled = '', page = 1, pageSize = 20 } = req.query
    const conditions = []
    const params = []
    if (keyword) {
      conditions.push('(u.username LIKE ? OR u.name LIKE ? OR u.member_name LIKE ?)')
      const kw = `%${keyword}%`
      params.push(kw, kw, kw)
    }
    if (role) { conditions.push('u.role = ?'); params.push(role) }
    if (team) { conditions.push('u.team = ?'); params.push(team) }
    if (enabled !== '') { conditions.push('u.enabled = ?'); params.push(enabled === '1' ? 1 : 0) }
    // 注: users 表无 enabled 字段, 启停状态从 password 包含 'disabled_' 前缀判断 (沿用项目习惯)
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    // 总数
    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM users u ${where}`, params)
    const total = countRows[0]?.total || 0
    // 分页数据
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.max(1, Math.min(100, parseInt(pageSize)))
    const limit = Math.max(1, Math.min(100, parseInt(pageSize)))
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.name, u.role, u.team, u.member_name, u.avatar, u.created_at, u.enabled
       FROM users u ${where} ORDER BY u.id LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )
    res.json({ rows, total, page: parseInt(page), pageSize: limit })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/users', requireRole(['系统管理人']), async (req, res) => {
  try {
    const { username, password, name, role, team = null, member_name = null, avatar = null, enabled = 1 } = req.body
    if (!username || !password || !name || !role) {
      return res.status(400).json({ error: '账号/密码/姓名/角色 必填' })
    }
    // 默认头像: 取 name 第一个汉字
    const finalAvatar = (avatar && avatar !== '?') ? avatar : name.charAt(0)
    const r = await safeQuery(
      `INSERT INTO users (username, password, name, role, team, member_name, avatar, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, password, name, role, team, member_name, finalAvatar, enabled ? 1 : 0]
    )
    res.json({ id: r.insertId, success: true })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '账号已存在' })
    res.status(500).json({ error: err.message })
  }
})

router.put('/users/:id', requireRole(['系统管理人']), async (req, res) => {
  try {
    const { id } = req.params
    const { name, role, avatar, enabled, password } = req.body
    // 可选更新: 密码
    if (password) {
      await safeQuery(`UPDATE users SET password=? WHERE id=?`, [password, id])
    }
    // team / member_name 不在编辑中修改, 交由交接班流程
    const finalAvatar = (avatar && avatar !== '?') ? avatar : null
    await safeQuery(
      `UPDATE users SET name=?, role=?, avatar=COALESCE(?, avatar), enabled=? WHERE id=?`,
      [name, role, finalAvatar, enabled ? 1 : 0, id]
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/users/:id/toggle', requireRole(['系统管理人']), async (req, res) => {
  try {
    const { id } = req.params
    // 不允许停用 admin
    if (parseInt(id) === 1) return res.status(400).json({ error: '不能停用超级管理员' })
    // 不允许停用自己
    const reqUserId = parseInt(req.headers['x-user-id'] || '0')
    if (parseInt(id) === reqUserId) return res.status(400).json({ error: '不能停用自己' })
    await safeQuery(`UPDATE users SET enabled = 1 - enabled WHERE id = ?`, [id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/users/:id/reset-password', requireRole(['系统管理人']), async (req, res) => {
  try {
    const { id } = req.params
    const { password = '123456' } = req.body
    await safeQuery(`UPDATE users SET password=? WHERE id=?`, [password, id])
    res.json({ success: true, new_password: password })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/users/:id', requireRole(['系统管理人']), async (req, res) => {
  try {
    const { id } = req.params
    const userId = parseInt(id)
    // 不能删 admin
    if (userId === 1) return res.status(400).json({ error: '不能删除超级管理员' })
    // 不能删自己
    const reqUserId = parseInt(req.headers['x-user-id'] || '0')
    if (userId === reqUserId) return res.status(400).json({ error: '不能删除自己' })
    // 检查引用
    const [handover] = await pool.query('SELECT COUNT(*) as cnt FROM handover_records WHERE handing_over_user_id = ? OR taking_over_user_id = ?', [id, id])
    if (handover[0].cnt > 0) return res.status(400).json({ error: `该用户有 ${handover[0].cnt} 条交接记录, 请先处理` })
    await safeQuery(`DELETE FROM users WHERE id = ?`, [id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// P0-5 角色与权限 (子路由挂载)
// ============================================================
router.use('/roles', adminRolesRouter)
router.use('/permissions', adminPermissionsRouter)

// ============================================================
// 模块状态 (供 P0 总览/调试用)
// ============================================================
router.get('/_status', (req, res) => {
  res.json({
    module: 'admin',
    role: req.headers['x-user-role'] || 'unknown',
    routes: {
      positions: '已实现 (P0-1)',
      shifts: '已实现 (P0-2)',
      teams: '已实现 (P0-3)',
      users: '已实现 (P0-4)',
      roles: '已实现 (P0-5)'
    }
  })
})

export default router
