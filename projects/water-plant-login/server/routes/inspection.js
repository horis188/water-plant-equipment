import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import pool from '../db/mysql.js'
import { sseEmit } from '../events.js'

const router = express.Router()

// P0-5 安全修复: 所有业务 API 强制登录
router.use(requireAuth)

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
    sseEmit('inspection-update', { plan_id: planId })
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
    sseEmit('inspection-update', { plan_id: Number(req.params.id) })
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
    sseEmit('inspection-update', { plan_id: Number(req.params.id) })
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
// 以 (plan_id, device_id, executor_id, shift_id) 为唯一键, 不同班次/不同人可独立保留
router.post('/records', async (req, res) => {
  const { plan_id, device_id, device_name, executor, executor_id, executor_name, results, has_abnormal, abnormal_desc, all_items, executor_role, shift_id: shiftIdFromBody } = req.body
  // 如果前端没传 shift_id, 兑底查当前 active shift
  let shift_id = shiftIdFromBody
  if (!shift_id && executor_name) {
    try {
      const [activeShifts] = await pool.query(
        `SELECT id FROM handover_shifts WHERE shift_end IS NULL AND user_name = ? ORDER BY shift_start DESC LIMIT 1`,
        [executor_name]
      )
      shift_id = activeShifts[0]?.id || null
    } catch {}
  }
  console.log('[DEBUG POST /records] plan_id:', plan_id, 'device_id:', device_id, 'executor_id:', executor_id, 'shift_id:', shift_id, 'has_abnormal:', has_abnormal)
  const check_date = new Date().toISOString().split('T')[0]
  const check_time = new Date().toTimeString().split(' ')[0]
  try {
    // 检查是否已有记录（同计划+设备+执行人+班次）
    // shift_id 为空时兑底按原逻辑 (兼容旧前端)
    const [existing] = await pool.query(
      `SELECT * FROM inspection_task_records 
       WHERE plan_id = ? AND device_id = ? AND executor_id = ?
         AND (shift_id = ? OR (shift_id IS NULL AND ? IS NULL))
       ORDER BY created_at DESC LIMIT 1`,
      [plan_id, device_id, executor_id, shift_id || null, shift_id || null]
    )

    // results 可能是前端传来的 JSON 字符串，也可能是对象，统一转为 JSON 字符串存储
    let resultsData = results
    if (typeof results === 'string') {
      try { resultsData = JSON.parse(results) } catch { resultsData = [] }
    }
    const newResults = JSON.stringify(Array.isArray(resultsData) ? resultsData : [])
    // 后端自己查 inspection_items 表获取完整的 check_content，不依赖前端 all_items
    let allItemsList = []
    try {
      const [itemRows] = await pool.query(
        'SELECT check_content FROM inspection_items WHERE plan_id = ? AND device_id = ? LIMIT 1',
        [plan_id, device_id]
      )
      if (itemRows.length > 0 && itemRows[0].check_content) {
        allItemsList = itemRows[0].check_content.split('\n').map(l => l.trim()).filter(Boolean)
      }
    } catch (e) { /* ignore */ }
    // 如果前端传了 all_items 且后端查不到，用前端的（兼容旧逻辑）
    if (allItemsList.length === 0 && Array.isArray(all_items)) {
      allItemsList = all_items.filter(l => l.trim())
    }
    const allDone = allItemsList.length > 0 && allItemsList.every(li => (resultsData || []).includes(li))
    // 有异常时直接标记为abnormal并终结任务，否则按全部完成判断
    const status = has_abnormal ? 'abnormal' : (allDone ? 'completed' : 'in_progress')

    if (existing.length > 0) {
      // 合并已有记录：追加新的检查项（不去重，保留所有历史）
      let existingResults = []
      try { existingResults = JSON.parse(existing[0].check_items || '[]') } catch {}
      const mergedResults = [...new Set([...existingResults, ...(Array.isArray(resultsData) ? resultsData : [])])]
      await pool.query(
        `UPDATE inspection_task_records SET check_items = ?, status = ?, has_abnormal = ?, abnormal_desc = ?, check_date = ?, check_time = ?, shift_id = ? WHERE id = ?`,
        [JSON.stringify(mergedResults), status, has_abnormal ? 1 : 0, abnormal_desc || null, check_date, check_time, shift_id || null, existing[0].id]
      )
      await pool.query('COMMIT')
      const [verify] = await pool.query('SELECT * FROM inspection_task_records WHERE id = ?', [existing[0].id])
      console.log('[DEBUG POST /records] UPDATE验证查询:', verify.map(r => ({id:r.id, status:r.status, executor_id:r.executor_id, plan_id:r.plan_id, device_id:r.device_id, check_items:r.check_items})))
      // 有异常时生成问题工单
      if (has_abnormal && abnormal_desc) {
        // 查当前执行人的 actual team/role（users 表）
        let executorTeam = null
        let executorRole = executor_role || null
        if (executor_id) {
          try {
            const [userRows] = await pool.query('SELECT team, role FROM users WHERE id = ?', [executor_id])
            if (userRows.length > 0) {
              if (!executorTeam) executorTeam = userRows[0].team
              if (!executorRole) executorRole = userRows[0].role
            }
          } catch {}
        }
        // fallback: 从 plans 查执行人角色
        if (!executorRole) {
          try {
            const [planRows] = await pool.query('SELECT executor_role FROM inspection_plans WHERE id = ?', [plan_id])
            if (planRows.length > 0) executorRole = planRows[0].executor_role
          } catch {}
        }
        // 查当前班次的 member_name（这个 executor 所在的班次）
        let executorMemberName = null
        try {
          const [shiftRows] = await pool.query(
            `SELECT member_name FROM handover_shifts WHERE shift_end IS NULL AND user_name = ? ORDER BY shift_start DESC LIMIT 1`,
            [executor_name || executor]
          )
          if (shiftRows[0]?.member_name) executorMemberName = shiftRows[0].member_name
        } catch {}
        const [poResult] = await pool.query(
          'INSERT INTO problem_orders (content, reporter_name, status, device_id, team, role, member_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [`【巡检异常】${device_name}：${abnormal_desc}`, executor_name || executor, 'pending', device_id, executorTeam, executorRole, executorMemberName]
        )
        const problemOrderId = poResult.insertId
        await pool.query('UPDATE inspection_task_records SET problem_order_id = ? WHERE id = ?', [problemOrderId, existing[0].id])
        if (device_id) await pool.query('UPDATE devices SET status = 1 WHERE id = ?', [device_id])
        sseEmit('inspection-update', { plan_id, device_id })
        sseEmit('device-status-change', { device_id, status: 1, source: 'inspection' })  // P1: P2.2 补全 (之前 P1.2-A TODO)
        sseEmit('problem-update', { id: problemOrderId })
        return res.json({ id: existing[0].id, status, problem_order_id: problemOrderId })
      }
      console.log('[DEBUG POST /records] UPDATE existing, id:', existing[0].id, 'status:', status)
      sseEmit('inspection-update', { plan_id, device_id })
      return res.json({ id: existing[0].id, status, merged: true })
    }

    // 新建记录
    const [result] = await pool.query(
      `INSERT INTO inspection_task_records (plan_id, device_id, device_name, executor_id, executor_name, shift_id, check_date, check_time, status, has_abnormal, abnormal_desc, check_items) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [plan_id, device_id, device_name, executor_id, executor_name || executor, shift_id || null, check_date, check_time, status, has_abnormal ? 1 : 0, abnormal_desc || null, newResults]
    )
    const recordId = result.insertId
    let problemOrderId = null
    if (has_abnormal && abnormal_desc) {
      // 查当前执行人的 actual team/role（users 表）
      let executorTeam = null
      let executorRole = executor_role || null
      if (executor_id) {
        try {
          const [userRows] = await pool.query('SELECT team, role FROM users WHERE id = ?', [executor_id])
          if (userRows.length > 0) {
            if (!executorTeam) executorTeam = userRows[0].team
            if (!executorRole) executorRole = userRows[0].role
          }
        } catch {}
      }
      // fallback: 从 plans 查执行人角色
      if (!executorRole) {
        try {
          const [planRows] = await pool.query('SELECT executor_role FROM inspection_plans WHERE id = ?', [plan_id])
          if (planRows.length > 0) executorRole = planRows[0].executor_role
        } catch {}
      }
      // 查当前班次的 member_name
      let executorMemberName = null
      try {
        const [shiftRows] = await pool.query(
          `SELECT member_name FROM handover_shifts WHERE shift_end IS NULL AND user_name = ? ORDER BY shift_start DESC LIMIT 1`,
          [executor_name || executor]
        )
        if (shiftRows[0]?.member_name) executorMemberName = shiftRows[0].member_name
      } catch {}
      const [poResult] = await pool.query(
        'INSERT INTO problem_orders (content, reporter_name, status, device_id, team, role, member_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [`【巡检异常】${device_name}：${abnormal_desc}`, executor_name || executor, 'pending', device_id, executorTeam, executorRole, executorMemberName]
      )
      problemOrderId = poResult.insertId
      await pool.query('UPDATE inspection_task_records SET problem_order_id = ? WHERE id = ?', [problemOrderId, recordId])
      if (device_id) await pool.query('UPDATE devices SET status = 1 WHERE id = ?', [device_id])
      sseEmit('device-status-change', { device_id, status: 1, source: 'inspection' })  // P1: P2.2 补全
    }
    console.log('[DEBUG POST /records] INSERT成功, recordId:', recordId, 'status:', status, 'newResults:', newResults)
    sseEmit('inspection-update', { plan_id, device_id })
    if (problemOrderId) sseEmit('problem-update', { id: problemOrderId })
    res.json({ id: recordId, problem_order_id: problemOrderId, status })
  } catch (err) {
    console.error('[DEBUG POST /records] 错误:', err.message)
    res.status(500).json({ error: err.message })
  }
})
router.get('/pending-tasks', async (req, res) => {
  const { executor_id } = req.query
  // 使用 BJT 日期（服务器时区是 Asia/Shanghai），避免 UTC 跨天问题
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  console.log('[DEBUG pending-tasks] executor_id:', executor_id, 'today:', today)
  try {
    // 查当前活跃班次 (取 id + shift_start)
    const [curShiftRows] = await pool.query(
      `SELECT id, shift_start FROM handover_shifts WHERE shift_end IS NULL ORDER BY shift_start DESC LIMIT 1`
    )
    const currentShiftId = curShiftRows[0]?.id || null
    const shiftStart = curShiftRows[0]?.shift_start
      ? new Date(curShiftRows[0].shift_start)
      : null
    // 按当前班次 shift_id 查 task records (不同班次独立保留)
    const taskRecords = currentShiftId
      ? (await pool.query(
          executor_id
            ? `SELECT * FROM inspection_task_records WHERE shift_id = ? AND executor_id = ?`
            : `SELECT * FROM inspection_task_records WHERE shift_id = ?`,
          executor_id ? [currentShiftId, executor_id] : [currentShiftId]
        ))[0]
      : (await pool.query(
          shiftStart
            ? `SELECT r.* FROM inspection_task_records r
               INNER JOIN (
                 SELECT plan_id, device_id, executor_id, MAX(updated_at) AS max_updated
                 FROM inspection_task_records
                 WHERE executor_id = ? AND updated_at >= ?
                 GROUP BY plan_id, device_id, executor_id
               ) latest ON r.plan_id = latest.plan_id AND r.device_id = latest.device_id
                 AND r.executor_id = latest.executor_id AND r.updated_at = latest.max_updated`
            : `SELECT r.* FROM inspection_task_records r
               INNER JOIN (
                 SELECT plan_id, device_id, executor_id, MAX(updated_at) AS max_updated
                 FROM inspection_task_records
                 WHERE executor_id = ? AND check_date = ?
                 GROUP BY plan_id, device_id, executor_id
               ) latest ON r.plan_id = latest.plan_id AND r.device_id = latest.device_id
                 AND r.executor_id = latest.executor_id AND r.updated_at = latest.max_updated`,
          shiftStart
            ? [executor_id, shiftStart]
            : [executor_id, today]
        ))[0]
    console.log('[DEBUG pending-tasks] taskRecords count:', taskRecords.length, 'currentShiftId:', currentShiftId)

    const recordMap = new Map()
    for (const r of taskRecords) {
      // 管理员视图（无executor_id）时，按 plan_id+device_id 匹配任意执行人的记录
      const key = executor_id
        ? `${r.plan_id}-${r.device_id}-${r.executor_id}`
        : `${r.plan_id}-${r.device_id}`
      recordMap.set(key, r)
    }
    console.log('[DEBUG pending-tasks] recordMap keys:', Array.from(recordMap.keys()))

    // P1: 超时检测 (P2.2 巡检 P1)
    // 判定规则: 任务仍 pending 且 check_date < today => 超时
    //          或 check_date == today 且距离班次起始超过 shift_hours + grace => 超时
    const SHIFT_HOURS = 8  // 单班次时长
    const GRACE_MIN = 30   // grace period
    const nowMs = now.getTime()
    const shiftStartMs = shiftStart ? shiftStart.getTime() : null
    const shiftCutoffMs = shiftStartMs ? shiftStartMs + (SHIFT_HOURS * 3600 + GRACE_MIN * 60) * 1000 : null
    // 内存 Set 记录已告警过的 task_id, 避免重复 emit SSE
    if (!global.__inspectionOverdueNotified) global.__inspectionOverdueNotified = new Set()
    const overdueNotified = global.__inspectionOverdueNotified

    const [plans] = await pool.query('SELECT * FROM inspection_plans')
    console.log('[DEBUG pending-tasks] plans count:', plans.length)
    const result = []
    for (const plan of plans) {
      let executorIds = []
      try { executorIds = JSON.parse(plan.executor_ids || '[]') } catch {}
      if (executor_id && executorIds.length > 0 && !executorIds.includes(Number(executor_id))) continue

      const [items] = await pool.query('SELECT * FROM inspection_items WHERE plan_id = ?', [plan.id])
      for (const item of items) {
        const key = executor_id
          ? `${plan.id}-${item.device_id}-${executor_id}`
          : `${plan.id}-${item.device_id}`
        const rec = recordMap.get(key)
        // P1: 计算 overdue
        const taskStatus = rec ? rec.status : 'pending'
        let isOverdue = false
        let overdueMinutes = 0
        if (taskStatus === 'pending' && rec) {
          const checkDateStr = rec.check_date ? String(rec.check_date).slice(0, 10) : null
          if (checkDateStr && checkDateStr < today) {
            // 昨天/更早的任务仍未完成 -> 严重超时
            isOverdue = true
            const checkDateMs = new Date(checkDateStr + 'T00:00:00').getTime()
            overdueMinutes = Math.round((nowMs - checkDateMs) / 60000)
          } else if (checkDateStr === today && shiftCutoffMs && nowMs > shiftCutoffMs) {
            // 本班次超时 (超过 8h + 30min grace)
            isOverdue = true
            overdueMinutes = Math.round((nowMs - shiftCutoffMs) / 60000)
          }
          // emit SSE 事件 (去重)
          if (isOverdue && !overdueNotified.has(rec.id)) {
            overdueNotified.add(rec.id)
            sseEmit('inspection-task-overdue', {
              record_id: rec.id,
              plan_id: plan.id,
              plan_name: plan.name,
              device_id: item.device_id,
              device_name: item.device_name,
              executor_id: rec.executor_id,
              executor_name: rec.executor_name,
              check_date: checkDateStr,
              overdue_minutes: overdueMinutes
            })
          }
        }
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
          all_items: (item.check_content || '').split('\n').map((l) => l.trim()).filter(Boolean),
          is_completed: !!(rec && (rec.status === 'completed' || rec.status === 'abnormal')),
          has_abnormal: rec ? rec.has_abnormal : 0,
          status: taskStatus,
          is_overdue: isOverdue,  // P1
          overdue_minutes: overdueMinutes,  // P1
          abnormal_desc: rec ? (rec.abnormal_desc || '') : '',
          results: rec ? (rec.check_items || '') : '',
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

// ====================================================================
// P1: 巡检超时列表 (P2.2 巡检 P1)
// GET /api/inspection/overdue-list
// 返回 check_date < today 且 status = pending 的任务
// (今天超时的也返回, 但单独标记)
// ====================================================================
router.get('/overdue-list', async (req, res) => {
  try {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const [rows] = await pool.query(
      `SELECT r.id, r.plan_id, r.device_id, r.device_name, r.executor_id, r.executor_name,
              r.check_date, r.check_time, r.status, r.created_at,
              p.name AS plan_name, p.location, p.cycle
       FROM inspection_task_records r
       LEFT JOIN inspection_plans p ON p.id = r.plan_id
       WHERE r.status = 'pending'
         AND r.check_date < ?
       ORDER BY r.check_date ASC, r.created_at ASC`,
      [today]
    )
    res.json({
      count: rows.length,
      items: rows.map(r => ({
        ...r,
        days_overdue: Math.floor((now.getTime() - new Date(r.check_date).getTime()) / (24 * 3600 * 1000))
      }))
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 初始化全部巡检数据（清空 plans、items、records）
router.post('/reset-all', async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query('DELETE FROM inspection_task_records')
    await conn.query('DELETE FROM inspection_items')
    await conn.query('DELETE FROM inspection_plans')
    await conn.query('DELETE FROM inspection_records')
    // 同时清空保养相关表
    await conn.query('DELETE FROM maintenance_records')
    await conn.query('DELETE FROM maintenance_plans')
    await conn.commit()
    sseEmit('inspection-update', {})
    res.json({ success: true, message: '巡检数据已全部清空' })
  } catch (err) {
    await conn.rollback()
    res.status(500).json({ error: err.message })
  } finally {
    conn.release()
  }
})

export default router