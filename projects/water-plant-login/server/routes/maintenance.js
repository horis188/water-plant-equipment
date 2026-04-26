import express from 'express'
import pool from '../db/mysql.js'

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
      // 统计
      const [done] = await pool.query('SELECT COUNT(DISTINCT device_id) as cnt FROM maintenance_records WHERE plan_id = ? AND has_abnormal = 0', [plan.id])
      const [abnormal] = await pool.query('SELECT COUNT(DISTINCT device_id) as cnt FROM maintenance_records WHERE plan_id = ? AND has_abnormal = 1', [plan.id])
      plan.doneCount = done[0]?.cnt || 0
      plan.abnormalCount = abnormal[0]?.cnt || 0
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
    res.json({ success: true })
  } catch (err) {
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
  const { name, executor_role, executor_ids, device_name, device_type, check_content, cycle_type, cycle_value, has_third_party, third_party_name, items } = req.body
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [result] = await conn.query(
      `INSERT INTO maintenance_plans (name, executor_role, executor_ids, device_name, device_type, check_content, cycle_type, cycle_value, has_third_party, third_party_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, executor_role || '', executor_ids || '[]', device_name || '', device_type || '', check_content || '', cycle_type || 'month', cycle_value || 1, has_third_party ? 1 : 0, third_party_name || '']
    )
    const planId = result.insertId
    if (items && items.length > 0) {
      for (const item of items) {
        await conn.query(
          'INSERT INTO maintenance_items (plan_id, device_name, check_content) VALUES (?, ?, ?)',
          [planId, item.device_name || '', item.check_content || '']
        )
      }
    }
    await conn.commit()
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
  const { name, executor_role, executor_ids, device_name, device_type, check_content, cycle_type, cycle_value, has_third_party, third_party_name } = req.body
  try {
    await pool.query(
      `UPDATE maintenance_plans SET name=?, executor_role=?, executor_ids=?, device_name=?, device_type=?, check_content=?, cycle_type=?, cycle_value=?, has_third_party=?, third_party_name=? WHERE id=?`,
      [name, executor_role || '', executor_ids || '[]', device_name || '', device_type || '', check_content || '', cycle_type || 'month', cycle_value || 1, has_third_party ? 1 : 0, third_party_name || '', req.params.id]
    )
    res.json({ id: req.params.id, name })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 删除保养计划
router.delete('/plans/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM maintenance_items WHERE plan_id = ?', [req.params.id])
    await pool.query('DELETE FROM maintenance_plans WHERE id = ?', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router