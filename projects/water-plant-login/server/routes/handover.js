import express from 'express'
import pool from '../db/mysql.js'

const router = express.Router()

// 获取当前班组的交接状态
router.get('/status', async (req, res) => {
  const { role, userId } = req.query
  if (!role) return res.status(400).json({ error: '缺少 role 参数' })

  try {
    // 查找该角色最近一次交接记录
    const [records] = await pool.query(
      `SELECT * FROM handover_records 
       WHERE (handing_over_role = ? OR taking_over_role = ?) 
       ORDER BY handover_time DESC LIMIT 1`,
      [role, role]
    )
    const lastRecord = records[0] || null

    // 查找当前班次信息（谁在班上）
    const [shifts] = await pool.query(
      `SELECT * FROM handover_shifts 
       WHERE role = ? AND shift_end IS NULL 
       ORDER BY shift_start DESC LIMIT 1`,
      [role]
    )
    const currentShift = shifts[0] || null

    // 查找上一班的工单
    let lastWorkorders = []
    if (lastRecord) {
      const shiftWindow = lastRecord.shift_type === '早班'
        ? `DATE_SUB('${lastRecord.handover_time}', INTERVAL 9 HOUR)`
        : lastRecord.shift_type === '日班'
        ? `DATE_SUB('${lastRecord.handover_time}', INTERVAL 8 HOUR)`
        : `DATE_SUB('${lastRecord.handover_time}', INTERVAL 8 HOUR)`

      const [wo1] = await pool.query(
        `SELECT id, content, status, '问题工单' as type, created_at FROM problem_orders 
         WHERE reporter_name = ? AND created_at >= ${shiftWindow} AND created_at <= ?`,
        [lastRecord.handing_over_user, lastRecord.handover_time]
      )
      const [wo2] = await pool.query(
        `SELECT id, content, status, '维修工单' as type, created_at FROM maintenance_orders 
         WHERE assigner_name = ? AND created_at >= ${shiftWindow} AND created_at <= ?`,
        [lastRecord.handing_over_user, lastRecord.handover_time]
      )
      lastWorkorders = [...wo1, ...wo2]
    }

    res.json({
      lastHandover: lastRecord ? { ...lastRecord, workorders: lastWorkorders } : null,
      currentShift,
      shiftTeams: ['A班', 'B班', 'C班', 'D班'],
      shiftTypes: [
        { type: '早班', start: '08:00', end: '16:00' },
        { type: '日班', start: '16:00', end: '23:00' },
        { type: '夜班', start: '23:00', end: '08:00' }
      ],
      tasksCompleted: true,
      tasksTotal: 0,
      tasksDone: 0,
      workordersTotal: 0,
      workordersDone: 0
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 交班操作
router.post('/handover', async (req, res) => {
  const { handingOverUser, handingOverRole, shiftType, team, notes, tasksStatus, workordersStatus } = req.body
  try {
    const [result] = await pool.query(
      `INSERT INTO handover_records (handing_over_user, handing_over_role, shift_type, team, handover_time, notes, tasks_status, workorders_status, status)
       VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, 'pending')`,
      [handingOverUser, handingOverRole, shiftType, team, notes || '', tasksStatus || '', workordersStatus || '']
    )
    res.json({ id: result.insertId, status: 'pending' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 接班操作
router.post('/takeover', async (req, res) => {
  const { takingOverUser, takingOverRole, handoverId } = req.body
  try {
    await pool.query(
      `UPDATE handover_records 
       SET taking_over_user = ?, taking_over_role = ?, status = 'completed'
       WHERE id = ?`,
      [takingOverUser, takingOverRole, handoverId]
    )
    const [record] = await pool.query(`SELECT shift_type, team FROM handover_records WHERE id = ?`, [handoverId])
    if (record[0]) {
      const shiftStart = new Date()
      await pool.query(
        `INSERT INTO handover_shifts (role, user_id, user_name, shift_type, team, shift_start) VALUES (?, ?, ?, ?, ?, ?)`,
        [takingOverRole, takingOverUser, takingOverUser, record[0].shift_type, record[0].team, shiftStart]
      )
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 获取交接历史（支持查询过滤）
router.get('/history', async (req, res) => {
  const { role, shift_type, team, user, start_date, end_date, limit = 50 } = req.query
  if (!role) return res.status(400).json({ error: '缺少 role 参数' })

  try {
    let where = `(handing_over_role = ? OR taking_over_role = ?)`
    const params = [role, role]

    if (shift_type) { where += ` AND shift_type = ?`; params.push(shift_type) }
    if (team) { where += ` AND team = ?`; params.push(team) }
    if (user) { where += ` AND (handing_over_user = ? OR taking_over_user = ?)`; params.push(user, user) }
    if (start_date) { where += ` AND handover_time >= ?`; params.push(start_date) }
    if (end_date) { where += ` AND handover_time <= ?`; params.push(end_date + ' 23:59:59') }

    params.push(Number(limit))

    const [records] = await pool.query(
      `SELECT * FROM handover_records WHERE ${where} ORDER BY handover_time DESC LIMIT ?`,
      params
    )
    res.json(records)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
