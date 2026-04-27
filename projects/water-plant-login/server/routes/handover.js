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

    // 获取当前班次的巡检任务完成情况
    let tasksCompleted = true
    let tasksTotal = 0
    let tasksDone = 0

    // 获取当前班次的工单处理情况
    let workordersTotal = 0
    let workordersDone = 0

    res.json({
      lastHandover: lastRecord,
      currentShift,
      shiftTeams: ['A班', 'B班', 'C班', 'D班'],
      shiftTypes: [
        { type: '早班', start: '08:00', end: '16:00' },
        { type: '日班', start: '16:00', end: '23:00' },
        { type: '夜班', start: '23:00', end: '08:00' }
      ],
      tasksCompleted,
      tasksTotal,
      tasksDone,
      workordersTotal,
      workordersDone
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
    // 更新交接记录状态
    await pool.query(
      `UPDATE handover_records 
       SET taking_over_user = ?, taking_over_role = ?, status = 'completed'
       WHERE id = ?`,
      [takingOverUser, takingOverRole, handoverId]
    )

    // 记录新的班次开始
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

// 获取交接历史
router.get('/history', async (req, res) => {
  const { role, limit = 20 } = req.query
  if (!role) return res.status(400).json({ error: '缺少 role 参数' })

  try {
    const [records] = await pool.query(
      `SELECT * FROM handover_records 
       WHERE handing_over_role = ? OR taking_over_role = ?
       ORDER BY handover_time DESC LIMIT ?`,
      [role, role, Number(limit)]
    )
    res.json(records)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
