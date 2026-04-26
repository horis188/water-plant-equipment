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

// 添加地点
router.post('/locations', async (req, res) => {
  const { name } = req.body
  try {
    const [result] = await pool.query('INSERT INTO locations (name) VALUES (?)', [name])
    res.json({ id: result.insertId, name })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 获取所有巡检计划（含巡检项）
router.get('/plans', async (req, res) => {
  try {
    const [plans] = await pool.query('SELECT * FROM inspection_plans ORDER BY id DESC')
    for (const plan of plans) {
      const [items] = await pool.query('SELECT * FROM inspection_items WHERE plan_id = ?', [plan.id])
      plan.items = items
    }
    res.json(plans)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 获取单个巡检计划
router.get('/plans/:id', async (req, res) => {
  try {
    const [plans] = await pool.query('SELECT * FROM inspection_plans WHERE id = ?', [req.params.id])
    if (plans.length === 0) return res.status(404).json({ error: '计划不存在' })
    const [items] = await pool.query('SELECT * FROM inspection_items WHERE plan_id = ?', [req.params.id])
    res.json({ ...plans[0], items })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 创建巡检计划
router.post('/plans', async (req, res) => {
  const { name, location, device_ids, cycle, executor_ids, custom_times, executor_role, custom_type, items } = req.body
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [result] = await conn.query(
      'INSERT INTO inspection_plans (name, location, device_ids, cycle, executor_role, executor_ids, custom_times, custom_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, location, JSON.stringify(device_ids), cycle, executor_role || '', executor_ids || '[]', custom_times || '[]', custom_type || 'daily']
    )
    const planId = result.insertId
    if (items && items.length > 0) {
      for (const item of items) {
        await conn.query(
          'INSERT INTO inspection_items (plan_id, device_id, device_name, check_content) VALUES (?, ?, ?, ?)',
          [planId, item.device_id, item.device_name, item.check_content]
        )
      }
    }
    await conn.commit()
    res.json({ id: planId, name, location, cycle, executor_role, executor_ids, custom_times, items })
  } catch (err) {
    await conn.rollback()
    res.status(500).json({ error: err.message })
  } finally {
    conn.release()
  }
})

// 更新巡检计划
router.put('/plans/:id', async (req, res) => {
  const { name, location, cycle, executor_role, executor_ids, custom_times, custom_type, items } = req.body
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query(
      'UPDATE inspection_plans SET name=?, location=?, cycle=?, executor_role=?, executor_ids=?, custom_times=?, custom_type=? WHERE id=?',
      [name, location, cycle, executor_role || '', executor_ids || '[]', custom_times || '[]', custom_type || 'daily', req.params.id]
    )
    // 删除旧巡检项，插入新
    await conn.query('DELETE FROM inspection_items WHERE plan_id = ?', [req.params.id])
    if (items && items.length > 0) {
      for (const item of items) {
        await conn.query(
          'INSERT INTO inspection_items (plan_id, device_id, device_name, check_content) VALUES (?, ?, ?, ?)',
          [req.params.id, item.device_id, item.device_name, item.check_content]
        )
      }
    }
    await conn.commit()
    res.json({ id: req.params.id, name, location, cycle, executor_role })
  } catch (err) {
    await conn.rollback()
    res.status(500).json({ error: err.message })
  } finally {
    conn.release()
  }
})

// 删除巡检计划
router.delete('/plans/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM inspection_items WHERE plan_id = ?', [req.params.id])
    await pool.query('DELETE FROM inspection_plans WHERE id = ?', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 获取巡检执行记录
router.get('/records', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM inspection_records ORDER BY id DESC LIMIT 200')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 提交巡检结果 → 写入 inspection_task_records
router.post('/records', async (req, res) => {
  const { plan_id, device_id, device_name, executor, executor_id, executor_name, results, has_abnormal, abnormal_desc } = req.body
  const check_date = new Date().toISOString().split('T')[0]
  const check_time = new Date().toTimeString().split(' ')[0]
  try {
    // 检查2小时内是否已有记录（同计划+设备+执行人+2小时窗口）
    const [existing] = await pool.query(
      `SELECT id FROM inspection_task_records WHERE plan_id = ? AND device_id = ? AND executor_id = ? AND TIMESTAMPDIFF(HOUR, created_at, NOW()) < 2`,
      [plan_id, device_id, executor_id]
    )
    if (existing.length > 0) {
      return res.json({ id: existing[0].id, duplicate: true })
    }
    const [result] = await pool.query(
      `INSERT INTO inspection_task_records (plan_id, device_id, device_name, executor_id, executor_name, check_date, check_time, status, has_abnormal, abnormal_desc, check_items) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [plan_id, device_id, device_name, executor_id, executor_name || executor, check_date, check_time, has_abnormal ? 'abnormal' : 'completed', has_abnormal ? 1 : 0, abnormal_desc || null, JSON.stringify(results)]
    )
    const recordId = result.insertId
    let problemOrderId = null
    if (has_abnormal && abnormal_desc) {
      const [poResult] = await pool.query(
        'INSERT INTO problem_orders (content, reporter_name, status) VALUES (?, ?, ?)',
        [`【巡检异常】${device_name}：${abnormal_desc}`, executor_name || executor, 'pending']
      )
      problemOrderId = poResult.insertId
      await pool.query('UPDATE inspection_task_records SET problem_order_id = ? WHERE id = ?', [problemOrderId, recordId])
    }
    res.json({ id: recordId, problem_order_id: problemOrderId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 获取执行人的巡检任务（含已完成状态）
router.get('/pending-tasks', async (req, res) => {
  const { executor_id } = req.query
  const today = new Date().toISOString().split('T')[0]
  try {
    const [taskRecords] = executor_id
      ? await pool.query('SELECT * FROM inspection_task_records WHERE executor_id = ? AND check_date = ?', [executor_id, today])
      : await pool.query('SELECT * FROM inspection_task_records WHERE check_date = ?', [today])

    const recordMap = new Map()
    for (const r of taskRecords) {
      recordMap.set(`${r.plan_id}-${r.device_id}-${r.executor_id}`, r)
    }

    const [plans] = await pool.query('SELECT * FROM inspection_plans')
    const result = []
    for (const plan of plans) {
      let executorIds = []
      try { executorIds = JSON.parse(plan.executor_ids || '[]') } catch {}
      if (executor_id && executorIds.length > 0 && !executorIds.includes(Number(executor_id))) continue

      const [items] = await pool.query('SELECT * FROM inspection_items WHERE plan_id = ?', [plan.id])
      for (const item of items) {
        const rec = recordMap.get(`${plan.id}-${item.device_id}-${executor_id}`)
        result.push({
          plan_id: plan.id,
          plan_name: plan.name,
          location: plan.location,
          cycle: plan.cycle,
          executor_role: plan.executor_role,
          custom_times: plan.custom_times,
          custom_type: plan.custom_type || 'daily',
          device_id: item.device_id,
          device_name: item.device_name,
          check_content: item.check_content,
          is_completed: !!rec,
          has_abnormal: rec ? rec.has_abnormal : 0,
          status: rec ? rec.status : 'pending',
          abnormal_desc: rec ? (rec.abnormal_desc || '') : '',
          record_id: rec ? rec.id : null,
          record_created_at: rec ? rec.created_at : null
        })
      }
    }
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router