import express from 'express'
import pool from '../db/mysql.js'
import { sseEmit } from '../events.js'

const router = express.Router()

// 获取所有地点
router.get('/locations', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM locations ORDER BY id')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 获取所有保养计划（含保养项和执行统计）
router.get('/plans', async (req, res) => {
  try {
    const [plans] = await pool.query('SELECT * FROM maintenance_plans ORDER BY id DESC')
    for (const plan of plans) {
      const [items] = await pool.query('SELECT * FROM maintenance_items WHERE plan_id = ?', [plan.id])
      plan.items = items
      // 解析执行人名称（兼容字符串和数组格式）
      try {
        const rawIds = plan.executor_ids
        const ids = Array.isArray(rawIds) ? rawIds : JSON.parse(rawIds || '[]')
        if (ids.length > 0) {
          const [users] = await pool.query(`SELECT name FROM users WHERE id = ?`, [ids[0]])
          plan.executor_name = users[0]?.name || plan.executor_role
        } else {
          plan.executor_name = plan.executor_role
        }
      } catch { plan.executor_name = plan.executor_role }
      // 按设备最新记录状态统计（每个设备只算一次，取最新记录的状态）
      const [statusRows] = await pool.query(`
        SELECT device_id, has_abnormal FROM maintenance_records r1
        WHERE plan_id = ? AND record_time = (
          SELECT MAX(record_time) FROM maintenance_records r2 WHERE r2.plan_id = r1.plan_id AND r2.device_id = r1.device_id
        )
      `, [plan.id])
      const deviceStatusMap = {}
      for (const row of statusRows) { deviceStatusMap[row.device_id] = row.has_abnormal }
      const statusValues = Object.values(deviceStatusMap)
      plan.doneCount = statusValues.filter(v => v === 0).length
      plan.abnormalCount = statusValues.filter(v => v === 1).length
      plan.totalCount = items.length
      // 计算剩余时间
      plan.remainingMs = calcRemainingMs(plan)
    }
    res.json(plans)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function calcRemainingMs(plan) {
  if (!plan.next_execute_time) return null
  const next = new Date(plan.next_execute_time).getTime()
  const now = Date.now()
  return next - now
}

// 提交保养记录
router.post('/records', async (req, res) => {
  const { plan_id, device_id, device_name, executor_id, executor_name, results, has_abnormal, abnormal_desc } = req.body
  try {
    await pool.query(
      'INSERT INTO maintenance_records (plan_id, device_id, device_name, executor_id, executor_name, results, has_abnormal, abnormal_desc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [plan_id, device_id || null, device_name || '', executor_id || null, executor_name || '', JSON.stringify(results || []), has_abnormal ? 1 : 0, abnormal_desc || '']
    )
    // 保养异常 → 设备状态变为维修中
    if (has_abnormal && device_id) {
      await pool.query('UPDATE devices SET status = 2 WHERE id = ?', [device_id])
    }
    // 更新计划下次执行时间
    const [plans] = await pool.query('SELECT cycle_type, cycle_value FROM maintenance_plans WHERE id = ?', [plan_id])
    if (plans.length > 0) {
      const { cycle_type, cycle_value } = plans[0]
      const now = new Date()
      let next = new Date(now)
      if (cycle_type === 'day') next.setDate(now.getDate() + (cycle_value || 1))
      else if (cycle_type === 'week') next.setDate(now.getDate() + (cycle_value || 1) * 7)
      else if (cycle_type === 'month') next.setMonth(now.getMonth() + (cycle_value || 1))
      else if (cycle_type === 'year') next.setFullYear(now.getFullYear() + (cycle_value || 1))
      await pool.query('UPDATE maintenance_plans SET next_execute_time = ? WHERE id = ?', [next.toISOString().slice(0, 19).replace('T', ' '), plan_id])
    }
    sseEmit('maintenance-update', { plan_id, device_id })
    res.json({ success: true })
  } catch (err) {
    console.error('[POST /records error]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// 获取保养计划的执行记录
router.get('/records/:planId', async (req, res) => {
  try {
    const [records] = await pool.query('SELECT * FROM maintenance_records WHERE plan_id = ? ORDER BY record_time DESC', [req.params.planId])
    // 按 device_id 分组，只保留最新一条
    const latestMap = new Map()
    for (const r of records) {
      const key = r.device_id
      if (!latestMap.has(key)) latestMap.set(key, r)
    }
    const latestByDevice = Array.from(latestMap.values())
    res.json(latestByDevice)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 创建保养计划
router.post('/plans', async (req, res) => {
  const { name, executor_role, executor_ids, location, device_name, device_type, check_content, cycle_type, cycle_value, has_third_party, third_party_name, items } = req.body
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    // 计算下次执行时间 = 当前时间 + 周期
    const now = new Date()
    let next = new Date(now)
    const cv = cycle_value || 1
    if (cycle_type === 'day') next.setDate(now.getDate() + cv)
    else if (cycle_type === 'week') next.setDate(now.getDate() + cv * 7)
    else if (cycle_type === 'month') next.setMonth(now.getMonth() + cv)
    else if (cycle_type === 'year') next.setFullYear(now.getFullYear() + cv)
    else next.setMonth(now.getMonth() + cv) // 默认月

    const [result] = await conn.query(
      `INSERT INTO maintenance_plans (name, executor_role, executor_ids, location, device_name, device_type, check_content, cycle_type, cycle_value, has_third_party, third_party_name, next_execute_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, executor_role || '', executor_ids || '[]', location || '', device_name || '', device_type || '', check_content || '', cycle_type || 'month', cycle_value || 1, has_third_party ? 1 : 0, third_party_name || '', next.toISOString().slice(0, 19).replace('T', ' ')]
    )
    const planId = result.insertId
    if (items && items.length > 0) {
      for (const item of items) {
        await conn.query(
          'INSERT INTO maintenance_items (plan_id, device_id, device_name, check_content) VALUES (?, ?, ?, ?)',
          [planId, item.device_id || null, item.device_name || '', item.check_content || '']
        )
      }
    }
    await conn.commit()
    sseEmit('maintenance-update', { plan_id: planId })
    res.json({ id: planId, name, executor_role, device_name, device_type, cycle_type, cycle_value, has_third_party, third_party_name })
  } catch (err) {
    await conn.rollback()
    res.status(500).json({ error: err.message })
  } finally {
    conn.release()
  }
})

// 更新保养计划
router.put('/plans/:id', async (req, res) => {
  const { name, executor_role, executor_ids, location, device_name, device_type, check_content, cycle_type, cycle_value, has_third_party, third_party_name, items } = req.body
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query(
      `UPDATE maintenance_plans SET name=?, executor_role=?, executor_ids=?, location=?, device_name=?, device_type=?, check_content=?, cycle_type=?, cycle_value=?, has_third_party=?, third_party_name=? WHERE id=?`,
      [name, executor_role || '', executor_ids || '[]', location || '', device_name || '', device_type || '', check_content || '', cycle_type || 'month', cycle_value || 1, has_third_party ? 1 : 0, third_party_name || '', req.params.id]
    )
    // 更新保养项：先删后插
    await conn.query('DELETE FROM maintenance_items WHERE plan_id = ?', [req.params.id])
    if (items && items.length > 0) {
      for (const item of items) {
        await conn.query(
          'INSERT INTO maintenance_items (plan_id, device_id, device_name, check_content) VALUES (?, ?, ?, ?)',
          [req.params.id, item.device_id || null, item.device_name || '', item.check_content || '']
        )
      }
    }
    await conn.commit()
    sseEmit('maintenance-update', { plan_id: Number(req.params.id) })
    res.json({ id: req.params.id, name })
  } catch (err) {
    await conn.rollback()
    res.status(500).json({ error: err.message })
  } finally {
    conn.release()
  }
})

// 删除保养计划
router.delete('/plans/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM maintenance_items WHERE plan_id = ?', [req.params.id])
    await pool.query('DELETE FROM maintenance_plans WHERE id = ?', [req.params.id])
    sseEmit('maintenance-update', { plan_id: Number(req.params.id) })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router