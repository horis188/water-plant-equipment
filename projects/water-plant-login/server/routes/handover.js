import express from 'express'
import pool from '../db/mysql.js'
import { sseEmit } from '../events.js'

const router = express.Router()

// 初始化:确保表结构正确(兼容旧数据库)
async function initTables() {
  try {
    // 创建 duty_notes 表(如果不存在)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS duty_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team VARCHAR(10) NOT NULL COMMENT '班组:A班/B班/C班/D班',
        role VARCHAR(50) NOT NULL COMMENT '角色',
        shift_type VARCHAR(20) NOT NULL COMMENT '班次类型:日班/夜班/早班',
        member_name VARCHAR(50) DEFAULT NULL COMMENT '岗位人员姓名',
        date DATE NOT NULL COMMENT '日期',
        notes TEXT COMMENT '值班纪事内容',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_duty_note (team, role, date, shift_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    // 创建 inspection_plans 表(如果不存在)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inspection_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL COMMENT '计划名称',
        location VARCHAR(200) DEFAULT NULL COMMENT '地点',
        device_ids JSON DEFAULT NULL COMMENT '设备ID列表',
        cycle VARCHAR(50) DEFAULT 'daily' COMMENT '执行周期',
        executor_role VARCHAR(100) DEFAULT NULL COMMENT '执行角色',
        executor_ids VARCHAR(500) DEFAULT '[]' COMMENT '执行人ID列表(JSON)',
        custom_times JSON DEFAULT '[]' COMMENT '自定义时间段',
        custom_type VARCHAR(50) DEFAULT 'daily' COMMENT '自定义周期类型',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    // 创建 inspection_items 表(如果不存在)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inspection_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_id INT NOT NULL COMMENT '所属计划ID',
        device_id INT DEFAULT NULL COMMENT '设备ID',
        device_name VARCHAR(200) DEFAULT NULL COMMENT '设备名称',
        check_content TEXT COMMENT '巡检内容',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    // 创建 inspection_task_records 表(如果不存在)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inspection_task_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_id INT NOT NULL COMMENT '计划ID',
        device_id INT DEFAULT NULL COMMENT '设备ID',
        device_name VARCHAR(200) DEFAULT NULL COMMENT '设备名称',
        executor_id INT DEFAULT NULL COMMENT '执行人ID',
        executor_name VARCHAR(100) DEFAULT NULL COMMENT '执行人姓名',
        check_date DATE DEFAULT NULL COMMENT '巡检日期',
        check_time TIME DEFAULT NULL COMMENT '巡检时间',
        status VARCHAR(20) DEFAULT 'pending' COMMENT '状态',
        has_abnormal TINYINT DEFAULT 0 COMMENT '是否有异常',
        abnormal_desc TEXT COMMENT '异常描述',
        check_items JSON DEFAULT NULL COMMENT '已检查项(JSON)',
        problem_order_id INT DEFAULT NULL COMMENT '关联问题工单ID',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    // 创建 inspection_records 表(如果不存在)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inspection_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_id INT DEFAULT NULL,
        device_id INT DEFAULT NULL,
        executor VARCHAR(100) DEFAULT NULL,
        check_date DATE DEFAULT NULL,
        check_time TIME DEFAULT NULL,
        results JSON DEFAULT NULL,
        has_abnormal TINYINT DEFAULT 0,
        abnormal_desc TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    // 创建 maintenance_plans 表(如果不存在)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS maintenance_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL COMMENT '计划名称',
        executor_role VARCHAR(100) DEFAULT NULL COMMENT '执行角色',
        executor_ids VARCHAR(500) DEFAULT '[]' COMMENT '执行人ID列表(JSON)',
        location VARCHAR(200) DEFAULT NULL COMMENT '地点',
        device_name VARCHAR(200) DEFAULT NULL COMMENT '设备名称',
        device_type VARCHAR(100) DEFAULT NULL COMMENT '设备类型',
        check_content TEXT COMMENT '保养内容',
        cycle_type VARCHAR(50) DEFAULT 'day' COMMENT '周期类型',
        cycle_value INT DEFAULT 1 COMMENT '周期值',
        has_third_party TINYINT DEFAULT 0 COMMENT '是否有第三方',
        third_party_name VARCHAR(200) DEFAULT NULL COMMENT '第三方名称',
        next_execute_time DATETIME DEFAULT NULL COMMENT '下次执行时间',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    // 创建 maintenance_items 表(如果不存在)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS maintenance_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_id INT NOT NULL COMMENT '所属计划ID',
        device_id INT DEFAULT NULL COMMENT '设备ID',
        device_name VARCHAR(200) DEFAULT NULL COMMENT '设备名称',
        check_content TEXT COMMENT '保养内容',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    // 创建 maintenance_records 表(如果不存在)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS maintenance_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_id INT NOT NULL COMMENT '计划ID',
        device_id INT DEFAULT NULL COMMENT '设备ID',
        device_name VARCHAR(200) DEFAULT NULL COMMENT '设备名称',
        executor_id INT DEFAULT NULL COMMENT '执行人ID',
        executor_name VARCHAR(100) DEFAULT NULL COMMENT '执行人姓名',
        results JSON DEFAULT NULL COMMENT '检查结果',
        has_abnormal TINYINT DEFAULT 0 COMMENT '是否有异常',
        abnormal_desc TEXT COMMENT '异常描述',
        record_time DATETIME DEFAULT NULL COMMENT '记录时间',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    // 创建 problem_orders 表(如果不存在)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS problem_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        content TEXT COMMENT '问题描述',
        images JSON DEFAULT NULL COMMENT '图片列表',
        videos JSON DEFAULT NULL COMMENT '视频列表',
        reporter_name VARCHAR(100) DEFAULT NULL COMMENT '报告人姓名',
        device_id INT DEFAULT NULL COMMENT '设备ID',
        status VARCHAR(20) DEFAULT 'pending' COMMENT '状态',
        team VARCHAR(10) DEFAULT NULL COMMENT '班组',
        role VARCHAR(50) DEFAULT NULL COMMENT '角色',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    // 创建 maintenance_orders 表(如果不存在)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS maintenance_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        content TEXT COMMENT '工单内容',
        level VARCHAR(20) DEFAULT '普通' COMMENT '级别',
        status VARCHAR(20) DEFAULT 'pending' COMMENT '状态',
        assigner_name VARCHAR(100) DEFAULT NULL COMMENT '指派人',
        handler_name VARCHAR(100) DEFAULT NULL COMMENT '处理人',
        problem_order_id INT DEFAULT NULL COMMENT '关联问题工单ID',
        device_id INT DEFAULT NULL COMMENT '设备ID',
        return_reason TEXT COMMENT '退回原因',
        return_images JSON DEFAULT NULL COMMENT '退回图片',
        team VARCHAR(10) DEFAULT NULL COMMENT '班组',
        role VARCHAR(50) DEFAULT NULL COMMENT '角色',
        user_name VARCHAR(100) DEFAULT NULL COMMENT '创建人',
        participants JSON DEFAULT NULL COMMENT '参与人员',
        completion_note TEXT DEFAULT NULL COMMENT '完成备注',
        completion_images JSON DEFAULT NULL COMMENT '完成图片',
        sparepart_usage JSON DEFAULT NULL COMMENT '备件使用',
        completed_at DATETIME DEFAULT NULL COMMENT '完成时间',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    // 为已有表补充新字段(检查列是否存在再添加,兼容旧版 MySQL)
    async function addColumnIfNotExists(table, column, definition) {
      try {
        // 检查列是否存在
        const [colCheck] = await pool.query(
          `SELECT COUNT(*) AS c FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
          [table, column]
        )
        if (colCheck[0]?.c > 0) return // 已存在,跳过
        await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
        console.log(`[DB] 已添加列 ${table}.${column}`)
      } catch (err) {
        console.error(`[DB] 添加列 ${table}.${column} 失败:`, err.message)
      }
    }
    try {
      await addColumnIfNotExists('maintenance_orders', 'participants', 'JSON DEFAULT NULL')
      await addColumnIfNotExists('maintenance_orders', 'completion_note', 'TEXT DEFAULT NULL')
      await addColumnIfNotExists('maintenance_orders', 'completion_images', 'JSON DEFAULT NULL')
      await addColumnIfNotExists('maintenance_orders', 'sparepart_usage', 'JSON DEFAULT NULL')
      await addColumnIfNotExists('maintenance_orders', 'completed_at', 'DATETIME DEFAULT NULL')
      await addColumnIfNotExists('maintenance_orders', 'user_name', 'VARCHAR(100) DEFAULT NULL')
      await addColumnIfNotExists('maintenance_orders', 'team', 'VARCHAR(10) DEFAULT NULL')
      await addColumnIfNotExists('maintenance_orders', 'role', 'VARCHAR(50) DEFAULT NULL')
      await addColumnIfNotExists('handover_records', 'handing_over_member', 'VARCHAR(50) DEFAULT NULL COMMENT \'交班岗位人员\'')
      await addColumnIfNotExists('problem_orders', 'member_name', 'VARCHAR(50) DEFAULT NULL COMMENT \'创建时岗位人员姓名\'')
      await addColumnIfNotExists('maintenance_orders', 'member_name', 'VARCHAR(50) DEFAULT NULL COMMENT \'创建时岗位人员姓名\'')
    } catch (_) { /* 列可能已存在 */ }
    console.log('[DB] 表结构初始化完成')
  } catch (err) {
    console.error('[DB] 表初始化失败', err.message)
  }
}
initTables()

function fmtDate(d) {
  // 服务器时区为 Asia/Shanghai (BJT),使用本地方法即可获得 BJT 日期
  // 原 +8h 实现重复加了时区偏移,导致日期偏后一天
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtDateTime(d) {
  // 服务器时区为 BJT,使用本地方法
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const allTeams = ['A班', 'B班', 'C班', 'D班']

// 中间件:打印请求
function logReq(name) {
  return (req, res, next) => {
    console.log(`[${name}]`, req.method, req.path, req.query)
    next()
  }
}

// ---- 状态接口(值班岗 / 带班 / 系统管理员) ----
router.get('/status', async (req, res) => {
  try {
    const { role, userId, team, date } = req.query
    if (!role) return res.status(400).json({ error: '缺少 role 参数' })

    const targetDate = date || fmtDate(new Date())
    const today = targetDate

    // 1. 查询当前有效班次
    // 优先按 role 查;本系统中 LoginView 里的 yqzs 等账号 role='值班岗位',
    // 但 handover_shifts.role 已是细分岗位(一期制水/旧厂制水...),查不到时
    // 兑底按 userId -> users.name -> handover_shifts.user_name 查
    let currentShift = null
    const [shiftsByRole] = await pool.query(
      `SELECT * FROM handover_shifts WHERE shift_end IS NULL AND role = ? ORDER BY shift_start DESC LIMIT 1`,
      [role]
    )
    if (shiftsByRole[0]) {
      currentShift = shiftsByRole[0]
    } else if (userId) {
      const [users] = await pool.query(`SELECT name, username FROM users WHERE id = ?`, [userId])
      if (users[0]) {
        const u = users[0]
        // 兑底查: user_name = users.name 或 role = users.name 或 user_id = users.username
        const [shiftsByName] = await pool.query(
          `SELECT * FROM handover_shifts WHERE shift_end IS NULL AND (user_name = ? OR role = ? OR user_id = ?) ORDER BY shift_start DESC LIMIT 1`,
          [u.name, u.name, u.username]
        )
        currentShift = shiftsByName[0] || null
      }
    }

    // 查询当前班次今天已保存的纪事(用于填充当前班次纪事编辑器, 而不是上一班的)
    let currentDutyNotes = null
    if (currentShift) {
      const todayDate = fmtDate(new Date())
      const [cdn] = await pool.query(
        `SELECT notes, member_name, team, role, shift_type, date, updated_at FROM duty_notes
         WHERE team = ? AND role = ? AND shift_type = ? AND date = ? LIMIT 1`,
        [currentShift.team, currentShift.role, currentShift.shift_type, todayDate]
      )
      if (cdn[0] && cdn[0].notes && cdn[0].notes.trim()) currentDutyNotes = cdn[0]
    }

    // 2. 查询当前班次开始的交接记录(当前用户是否已经接班)
    let handoverStatus = 'idle'
    let lastHandover = null
    let pendingHandover = null
    let lastDutyNotes = null
    let lastShiftTasks = { done: 0, total: 0, abnormal: 0, abnormalList: [], allList: [] }
    let lastShiftWorkorders = { created: [], completed: [], inProgress: [] }

    if (currentShift) {
      // 查找"上一班交接":当前班次的接班交接(taking_over_user = current_user)
      // 这条记录是上一班交班给本人时创建的,handing_over_user/member 就是上一班的人
      // 不适用 fallback (会取到其他岗位的记录)
      let prevHandoverRows = []
      if (currentShift.user_name) {
        const [intakeRows] = await pool.query(
          `SELECT * FROM handover_records
           WHERE taking_over_user = ? AND status = 'completed'
           ORDER BY handover_time DESC LIMIT 1`,
          [currentShift.user_name]
        )
        prevHandoverRows = intakeRows
      }
      const handoverRows = prevHandoverRows
      if (handoverRows[0]) {
        lastHandover = handoverRows[0]
        handoverStatus = lastHandover.status || 'idle'
      } else {
        handoverStatus = 'idle'
      }
      // 上一班次的窗口:从交班时间前 12 小时到交班时间（覆盖任意班次跨天场景）
      // 注意:handover_records.shift_start 字段是接班时间(不是上一班次开始时间),所以不能用作 winStart
      const winEnd = new Date(lastHandover?.handover_time || currentShift.shift_start)
      const winStart = new Date(winEnd.getTime() - 12 * 3600000)
      // 上一班次对应的日期(按 BJT 取 handover_time 的日期)
      const prevDate = fmtDate(winEnd)
      // 上一班次的值班纪事(按 prevDate 查询,不是 today)
      if (lastHandover) {
        const [notes] = await pool.query(
          `SELECT notes, member_name FROM duty_notes WHERE team = ? AND role = ? AND date = ? AND shift_type = ?`,
          [lastHandover.team, lastHandover.handing_over_role, prevDate, lastHandover.shift_type]
        )
        if (notes[0] && notes[0].notes && notes[0].notes.trim()) lastDutyNotes = notes[0]
      }

      // 上一班次的巡检任务: 按上一班次日期 + 当前班账号 查
      // (避免依赖 shift_id, 因为交班人周海洋的班次可能不在 handover_shifts 表里)
      const [shiftTasks] = await pool.query(
        `SELECT r.*, i.device_name, p.name as plan_name, p.location as plan_location
         FROM inspection_task_records r
         LEFT JOIN inspection_items i ON r.device_id = i.device_id AND r.plan_id = i.plan_id
         LEFT JOIN inspection_plans p ON r.plan_id = p.id
         WHERE r.check_date = ? AND r.executor_name = ?`,
        [prevDate, currentShift.user_name]
      )
      console.log('[DEBUG /status lastShiftTasks] prevDate:', prevDate, 'executor_name:', currentShift.user_name, 'count:', shiftTasks.length)
      lastShiftTasks.total = shiftTasks.length
      lastShiftTasks.done = shiftTasks.filter((t) => t.status === 'completed' || t.status === 'abnormal').length
      lastShiftTasks.abnormal = shiftTasks.filter((t) => t.has_abnormal === 1).length
      lastShiftTasks.abnormalList = shiftTasks.filter((t) => t.has_abnormal === 1)
      lastShiftTasks.allList = shiftTasks // 完整列表(包括已完成、异常、待执行)

      // 上一班次的工单情况（用 prevDate，不用 today；时间窗口用 created_at）
      // 按 team + 接管前 12h 查(不限于交班人,整个上一班次班组的工单)
      const prevTeam = lastHandover?.team || currentShift.team
      // 问题工单：按 team + 时间窗口查
      const woQuery = `SELECT * FROM problem_orders WHERE DATE(created_at) = ? AND team = ? AND created_at >= ? AND created_at <= ?`
      const woParams = [prevDate, prevTeam, fmtDateTime(winStart), fmtDateTime(winEnd)]
      const [woRows] = await pool.query(woQuery, woParams)
      // 维护工单：同样按 team + 时间窗口查
      const maintQuery = `SELECT * FROM maintenance_orders WHERE DATE(created_at) = ? AND team = ? AND created_at >= ? AND created_at <= ?`
      const maintParams = [prevDate, prevTeam, fmtDateTime(winStart), fmtDateTime(winEnd)]
      const [maintWoRows] = await pool.query(maintQuery, maintParams)
      const allWosRaw = [
        ...woRows.map((w) => ({ ...w, type: '问题工单' })),
        ...maintWoRows.map((w) => ({ ...w, type: '维修工单' }))
      ]
      // 问题工单转维修后只显示维修工单:problem 状态=to_maintenance 且 id 在维修工单的 problem_order_id 中
      const maintProblemMap = {}
      for (const w of allWosRaw) {
        if (w.type === '维修工单' && w.problem_order_id) {
          maintProblemMap[w.problem_order_id] = w
        }
      }
      // 补全查找:to_maintenance 问题工单如果未被窗口内维修工单替代,
      // 则查询该问题工单关联的最新维修工单(不限时间窗口)作为替代
      const problemIdsNeedReplace = allWosRaw
        .filter(w => w.type === '问题工单' && w.status === 'to_maintenance' && !maintProblemMap[w.id])
        .map(w => w.id)
      if (problemIdsNeedReplace.length > 0) {
        const [latestMaint] = await pool.query(
          `SELECT * FROM maintenance_orders WHERE problem_order_id IN (${problemIdsNeedReplace.map(() => '?').join(',')}) ORDER BY id DESC`,
          problemIdsNeedReplace
        )
        for (const m of latestMaint || []) {
          if (m.problem_order_id) {
            maintProblemMap[m.problem_order_id] = { ...m, type: '维修工单' }
          }
        }
      }
      const allWos = []
      const replacedMaintIds = new Set()
      for (const w of allWosRaw) {
        if (w.type === '问题工单' && w.status === 'to_maintenance' && maintProblemMap[w.id]) {
          allWos.push({ ...maintProblemMap[w.id], _from_problem: true })
          replacedMaintIds.add(maintProblemMap[w.id].id)
        } else if (w.type === '维修工单' && replacedMaintIds.has(w.id)) {
          // 被作为替代的维修工单跳过
          continue
        } else {
          allWos.push(w)
        }
      }
      // 标记:这些工单都是上一班值班期间由上一班创建的(查询已按时间窗口+人员过滤)
      for (const w of allWos) w.isCreatedInLastShift = true
      // 去重:问题工单和维修工单 ID 可能碰撞,按 (id, type) 组合去重,保留第一个出现的
      const seenKey = new Set()
      const allWosDedup = allWos.filter((w) => {
        const key = `${w.id}-${w.type}`
        if (seenKey.has(key)) return false
        seenKey.add(key)
        return true
      })
      // 新建 = 上一班期间创建的所有工单(不限当前状态)
      lastShiftWorkorders.created = allWosDedup
      lastShiftWorkorders.completed = allWos.filter((w) => ['completed', 'closed', 'self_resolved'].includes(w.status))
      // inProgress 包含:processing/delay/returned/to_maintenance(问题工单转维修中)
      lastShiftWorkorders.inProgress = allWos.filter((w) => ['processing', 'delay', 'returned', 'to_maintenance'].includes(w.status))
    } else {
      // 未接班状态:按角色查找待接班记录
      const [pendingHandoverRows] = await pool.query(
        `SELECT * FROM handover_records WHERE handing_over_role = ? AND status = 'pending' ORDER BY handover_time DESC LIMIT 1`,
        [role]
      )
      if (pendingHandoverRows[0]) {
        pendingHandover = pendingHandoverRows[0]
        handoverStatus = 'pending'
        // pending 状态下也按 prevDate(handover_time 的 BJT 日期)查值班纪事
        const pendingPrevDate = fmtDate(new Date(pendingHandover.handover_time))
        const [notes] = await pool.query(
          `SELECT notes, member_name FROM duty_notes WHERE team = ? AND role = ? AND date = ? AND shift_type = ?`,
          [pendingHandover.team, pendingHandover.handing_over_role, pendingPrevDate, pendingHandover.shift_type]
        )
        if (notes[0] && notes[0].notes && notes[0].notes.trim()) lastDutyNotes = notes[0]
      }
    }

    // 3. 查询当前用户的任务统计
    let tasksDone = 0, tasksTotal = 0, tasksAbnormal = 0
    let workordersDone = 0, workordersTotal = 0
    if (userId) {
      const [taskRows] = await pool.query(
        `SELECT is_completed, has_abnormal FROM v_inspection_user_tasks WHERE executor_id = ? AND check_date = ?`,
        [userId, today]
      )
      tasksTotal = taskRows.length
      tasksDone = taskRows.filter(r => r.is_completed).length
      tasksAbnormal = taskRows.filter(r => r.has_abnormal).length
      const [woRows] = await pool.query(
        `SELECT status FROM problem_orders WHERE DATE(created_at) = ? AND reporter_name = (SELECT name FROM users WHERE id = ?)`,
        [today, userId]
      )
      const [maintWoRows] = await pool.query(
        `SELECT status FROM maintenance_orders WHERE DATE(created_at) = ? AND (handler_name = (SELECT name FROM users WHERE id = ?) OR assigner_name = (SELECT name FROM users WHERE id = ?))`,
        [today, userId, userId]
      )
      const allWo = [...woRows, ...maintWoRows]
      workordersTotal = allWo.length
      workordersDone = allWo.filter(w => ['completed', 'closed', 'self_resolved'].includes(w.status)).length
    }

    // 4. 查询已接班但未交班的情况
    const [completedHandover] = await pool.query(
      `SELECT h.*, u.name as taking_over_user_name
       FROM handover_records h
       LEFT JOIN users u ON h.taking_over_user = u.id
       WHERE h.status = 'completed'
       AND DATE(h.handover_time) = ?
       ORDER BY h.handover_time DESC LIMIT 1`,
      [today]
    )

    // 5. 管理员/带班:按岗位人员分组统计
    let perPersonStats = null
    if (['带班', '系统管理人'].includes(role)) {
      const shiftTeam = currentShift?.team || lastHandover?.team || team || 'A班'
      if (shiftTeam) {
        const [members] = await pool.query(
          `SELECT member_name FROM shift_team_members WHERE team_name = ? AND member_type = '值班'`,
          [shiftTeam]
        )
        // 当前班次的时间窗口:从接管时间到现在（不是上一班的 winStart/winEnd）
        const winStart = currentShift && lastHandover
          ? new Date(lastHandover.handover_time)
          : currentShift
            ? new Date(currentShift.shift_start)
            : new Date(Date.now() - 12 * 3600000)
        const winEnd = new Date()


        perPersonStats = await Promise.all(members.map(async (m) => {
          const memberName = m.member_name
          // 巡检任务
          const [taskRows] = await pool.query(
            `SELECT r.*, i.device_name, p.name as plan_name
             FROM inspection_task_records r
             JOIN inspection_items i ON r.device_id = i.device_id AND r.plan_id = i.plan_id
             JOIN inspection_plans p ON r.plan_id = p.id
             WHERE r.executor_name = ? AND r.check_date = ? AND r.created_at >= ? AND r.created_at <= ?`,
            [memberName, today, fmtDateTime(winStart), fmtDateTime(winEnd)]
          )
          const abnormalList = taskRows.filter((t) => t.has_abnormal)
          const allTasksList = taskRows // 完整列表
          // 问题工单（按 member_name 匹配,而不是 reporter_name）
          const [woRows] = await pool.query(
            `SELECT * FROM problem_orders WHERE member_name = ? AND DATE(created_at) = ? AND created_at >= ? AND created_at <= ?`,
            [memberName, today, fmtDateTime(winStart), fmtDateTime(winEnd)]
          )
          // 维修工单（按 member_name 匹配,而不是 reporter_name）
          const [maintRows] = await pool.query(
            `SELECT * FROM maintenance_orders WHERE member_name = ? AND DATE(created_at) = ? AND created_at >= ? AND created_at <= ?`,
            [memberName, today, fmtDateTime(winStart), fmtDateTime(winEnd)]
          )
          const allWosRaw = [...woRows, ...maintRows].map((w) => ({ ...w, woType: w.content ? 'problem' : 'maintenance' }))
          // 问题工单转维修后只显示维修工单:按 problem_order_id 匹配
          const maintProblemMap2 = {}
          for (const w of allWosRaw) {
            if (w.woType === 'maintenance' && w.problem_order_id) {
              maintProblemMap2[w.problem_order_id] = w
            }
          }
          // 补全查找:to_maintenance 问题工单未被窗口内维修工单替代的,查最新维修工单(不限窗口)
          const problemIdsNeedReplace2 = allWosRaw
            .filter(w => w.woType === 'problem' && w.status === 'to_maintenance' && !maintProblemMap2[w.id])
            .map(w => w.id)
          if (problemIdsNeedReplace2.length > 0) {
            const [latestMaint2] = await pool.query(
              `SELECT * FROM maintenance_orders WHERE problem_order_id IN (${problemIdsNeedReplace2.map(() => '?').join(',')}) ORDER BY id DESC`,
              problemIdsNeedReplace2
            )
            for (const m of latestMaint2 || []) {
              if (m.problem_order_id) {
                maintProblemMap2[m.problem_order_id] = { ...m, woType: 'maintenance' }
              }
            }
          }
          const allWos = []
          const replacedMaintIds2 = new Set()
          for (const w of allWosRaw) {
            if (w.woType === 'problem' && w.status === 'to_maintenance' && maintProblemMap2[w.id]) {
              allWos.push({ ...maintProblemMap2[w.id], _from_problem: true })
              replacedMaintIds2.add(maintProblemMap2[w.id].id)
            } else if (w.woType === 'maintenance' && replacedMaintIds2.has(w.id)) {
              continue
            } else {
              allWos.push(w)
            }
          }
          // 去重:问题工单和维修工单 ID 可能碰撞,按 (id, woType) 组合去重
          const seenKey2 = new Set()
          const allWosDedup2 = allWos.filter((w) => {
            const key = `${w.id}-${w.woType}`
            if (seenKey2.has(key)) return false
            seenKey2.add(key)
            return true
          }).map(w => ({ ...w, type: w.woType === 'maintenance' ? '维修工单' : '问题工单' }))
          return {
            memberName,
            tasks: {
              total: taskRows.length,
              done: taskRows.filter((t) => t.status === 'completed' || t.status === 'abnormal').length,
              abnormal: abnormalList.length,
              abnormalList,
              allList: allTasksList
            },
            workorders: {
              // 新建 = 上一班期间创建的所有工单(不限状态,查询已按时间窗口+人员过滤)
              created: allWosDedup2,
              completed: allWosDedup2.filter((w) => ['completed', 'closed', 'self_resolved'].includes(w.status)),
              inProgress: allWosDedup2.filter((w) => ['processing', 'delay', 'returned', 'to_maintenance'].includes(w.status))
            }
          }
        }))
      }
    }

    res.json({
      currentShift,
      handoverStatus,
      lastHandover,
      pendingHandover,
      lastDutyNotes,
      currentDutyNotes,
      tasksDone,
      tasksTotal,
      tasksAbnormal,
      workordersDone,
      workordersTotal,
      lastShiftTasks,
      lastShiftWorkorders,
      completedHandover: completedHandover[0] || null,
      perPersonStats
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- 全部岗位概览(仅系统管理员/带班可用) ----
// 返回当班 team 下所有岗位(active shifts)的概要信息
router.get('/all-shifts', async (req, res) => {
  try {
    const { role, team } = req.query
    if (!role) return res.status(400).json({ error: '缺少 role 参数' })
    if (!['系统管理人', '带班'].includes(role)) {
      return res.status(403).json({ error: '仅系统管理员/带班可访问全部岗位' })
    }
    const targetTeam = team || 'A班'

    // 查当班 active shifts(该 team 下)
    const [shifts] = await pool.query(
      `SELECT * FROM handover_shifts WHERE shift_end IS NULL AND team = ? ORDER BY shift_start DESC`,
      [targetTeam]
    )
    if (shifts.length === 0) return res.json({ team: targetTeam, shifts: [] })

    // 为每个 shift 查上一班交接、任务数、工单数
    const shiftContexts = await Promise.all(shifts.map(async (shift) => {
      // 上一班交接(取 taking_over_user = shift.user_name 的完成交接)
      let lastHandover = null
      if (shift.user_name) {
        const [rows] = await pool.query(
          `SELECT * FROM handover_records
           WHERE taking_over_user = ? AND status = 'completed'
           ORDER BY handover_time DESC LIMIT 1`,
          [shift.user_name]
        )
        if (rows[0]) lastHandover = rows[0]
      }
      // 值班纪事(按 prevDate)
      let lastDutyNotes = null
      if (lastHandover) {
        const prevDate = fmtDate(new Date(lastHandover.handover_time))
        const [notes] = await pool.query(
          `SELECT notes, member_name FROM duty_notes WHERE team = ? AND role = ? AND date = ? AND shift_type = ? LIMIT 1`,
          [lastHandover.team, lastHandover.handing_over_role, prevDate, lastHandover.shift_type]
        )
        if (notes[0] && notes[0].notes && notes[0].notes.trim()) lastDutyNotes = notes[0]
      }
      // 巡检任务(上一班时间窗口)
      let tasksCount = { total: 0, done: 0, abnormal: 0 }
      let workordersCount = { total: 0, inProgress: 0, completed: 0 }
      if (lastHandover) {
        const winEnd = new Date(lastHandover.handover_time)
        const winStart = new Date(winEnd.getTime() - 12 * 3600000)
        const prevDate = fmtDate(winEnd)
        const [shiftTasks] = await pool.query(
          `SELECT status, has_abnormal FROM inspection_task_records
           WHERE check_date = ? AND executor_name = ? AND updated_at >= ? AND updated_at <= ?`,
          [prevDate, shift.role, fmtDateTime(winStart), fmtDateTime(winEnd)]
        )
        tasksCount.total = shiftTasks.length
        tasksCount.done = shiftTasks.filter((t) => t.status === 'completed' || t.status === 'abnormal').length
        tasksCount.abnormal = shiftTasks.filter((t) => t.has_abnormal === 1).length

        // 上一班工单
        const [woRows] = await pool.query(
          `SELECT status FROM problem_orders WHERE DATE(created_at) = ? AND team = ? AND created_at >= ? AND created_at <= ?`,
          [prevDate, lastHandover.team, fmtDateTime(winStart), fmtDateTime(winEnd)]
        )
        const [maintRows] = await pool.query(
          `SELECT status FROM maintenance_orders WHERE DATE(created_at) = ? AND team = ? AND created_at >= ? AND created_at <= ?`,
          [prevDate, lastHandover.team, fmtDateTime(winStart), fmtDateTime(winEnd)]
        )
        const allWo = [...woRows, ...maintRows]
        workordersCount.total = allWo.length
        workordersCount.completed = allWo.filter((w) => ['completed', 'closed', 'self_resolved'].includes(w.status)).length
        workordersCount.inProgress = allWo.filter((w) => ['processing', 'delay', 'returned', 'to_maintenance'].includes(w.status)).length
      }
      return {
        role: shift.role,
        positionName: shift.role,
        currentShift: shift,
        lastHandover,
        lastDutyNotes,
        tasksCount,
        workordersCount
      }
    }))

    res.json({ team: targetTeam, shifts: shiftContexts })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- 系统管理员专属概览页面 ----
// 返回:
// - 当天全公司工单统计(新建/问题/维修/已完成)
// - 当天全公司巡检任务统计(总数/已完成/异常)
// - 当前值班班组的各岗位事务卡片(纪事/巡检/工单)
router.get('/admin-overview', async (req, res) => {
  try {
    const { role, date } = req.query
    if (!['系统管理人', '带班'].includes(role)) return res.status(403).json({ error: '仅系统管理员/带班可访问' })

    const targetDate = date || fmtDate(new Date())
    const today = targetDate

    // 1+2. 工单和巡检统计改为从 positions 聚合(与下面卡片数据保持一致)
    let statsWoTotal = 0, statsWoProblem = 0, statsWoMaint = 0, statsWoCompleted = 0, statsWoInProgress = 0
    let statsTaskTotal = 0, statsTaskDone = 0, statsTaskAbnormal = 0

    // 3. 当前值班班组的各岗位事务
    // “当前值班的班组”=从 handover_records 最新 status=completed 中取 team
    // 合并 handover_shifts 中 active 的 team (保证 active shifts 一定被包含)
    let currentTeams = []
    const [lastCompleted] = await pool.query(
      `SELECT team, MAX(handover_time) as last_time FROM handover_records WHERE status = 'completed' AND team IS NOT NULL GROUP BY team ORDER BY last_time DESC LIMIT 5`
    )
    currentTeams = lastCompleted.map(r => r.team).filter(Boolean)
    // 合并 active shifts 的 team
    const [activeShifts] = await pool.query(
      `SELECT DISTINCT team FROM handover_shifts WHERE shift_end IS NULL AND team IS NOT NULL`
    )
    for (const r of activeShifts) {
      if (r.team && !currentTeams.includes(r.team)) currentTeams.push(r.team)
    }
    if (currentTeams.length === 0) currentTeams = ['A班']

    const positions = []
    for (const t of currentTeams) {
      // 该班组下的 active shifts
      const [shifts] = await pool.query(
        `SELECT * FROM handover_shifts WHERE team = ? AND shift_end IS NULL ORDER BY shift_start DESC`,
        [t]
      )
      for (const shift of shifts) {
        let lastHandover = null
        if (shift.user_name) {
          const [rows] = await pool.query(
            `SELECT * FROM handover_records
             WHERE taking_over_user = ? AND status = 'completed'
             ORDER BY handover_time DESC LIMIT 1`,
            [shift.user_name]
          )
          if (rows[0]) lastHandover = rows[0]
        }

        // 岗位纪事(当前班该 role 的 notes)
        const [notesRows] = await pool.query(
          `SELECT notes, member_name FROM duty_notes
           WHERE team = ? AND role = ? AND date = ? AND shift_type = ?
           ORDER BY updated_at DESC LIMIT 1`,
          [t, shift.role, today, shift.shift_type]
        )
        const notes = notesRows[0] && notesRows[0].notes && notesRows[0].notes.trim()
          ? notesRows[0]
          : null

        // 巡检任务: 采用 plan + execution record 合并计算 (与 /api/inspection/pending-tasks 一致)
        // 1. 找出分给该岗位账号的 plans (按 user_id 查 users, 再查 plans.executor_ids 包含该 id)
        const [shiftUserRows] = await pool.query(
          `SELECT id FROM users WHERE name = ? LIMIT 1`,
          [shift.user_name]
        )
        const shiftUserId = shiftUserRows[0]?.id
        let plansForPos = []
        if (shiftUserId) {
          const [allPlans] = await pool.query(`SELECT * FROM inspection_plans`)
          plansForPos = allPlans.filter(p => {
            try {
              const ids = JSON.parse(p.executor_ids || '[]')
              return Array.isArray(ids) && ids.includes(Number(shiftUserId))
            } catch { return false }
          })
        }
        // 2. 该 shift_id 下的执行记录 (每个班次独立)
        const [todayRecords] = await pool.query(
          `SELECT r.*, i.device_name, p.name as plan_name
           FROM inspection_task_records r
           LEFT JOIN inspection_items i ON r.device_id = i.device_id AND r.plan_id = i.plan_id
           LEFT JOIN inspection_plans p ON r.plan_id = p.id
           WHERE r.shift_id = ? AND r.executor_id = ?`,
          [shift.id, shiftUserId]
        )
        // 3. 取每个 plan+device 最新一条记录
        const latestByKey = new Map()
        for (const r of todayRecords) {
          const k = `${r.plan_id}-${r.device_id}`
          if (!latestByKey.has(k) || new Date(r.updated_at) > new Date(latestByKey.get(k).updated_at)) {
            latestByKey.set(k, r)
          }
        }
        // 4. 合并出任务列表: 总数 = plans 的 items 数; 完成 = 有 record 且 completed|abnormal
        const posTasks = []
        for (const plan of plansForPos) {
          const [items] = await pool.query(`SELECT * FROM inspection_items WHERE plan_id = ?`, [plan.id])
          for (const item of items) {
            const k = `${plan.id}-${item.device_id}`
            const rec = latestByKey.get(k)
            const baseInfo = {
              plan_id: plan.id,
              plan_name: plan.name,
              location: plan.location,
              cycle: plan.cycle,
              custom_type: plan.custom_type,
              custom_times: plan.custom_times,
              device_id: item.device_id,
              device_name: item.device_name,
              check_content: item.check_content
            }
            if (rec) {
              posTasks.push({ ...baseInfo, ...rec, status: rec.status, has_abnormal: rec.has_abnormal, is_pending: false })
            } else {
              posTasks.push({ ...baseInfo, status: 'pending', has_abnormal: 0, is_pending: true })
            }
          }
        }

        // 工单窗口起止 (与原逻辑一致)
        let positionTaskWinStart = shift.shift_start
        if (lastHandover?.handover_time) {
          positionTaskWinStart = new Date(lastHandover.handover_time)
        }
        const positionTaskWinEnd = new Date()

        // 工单(从当前班开始的窗口, 按 team + role 过滤到具体岗位)
        const [posWo] = await pool.query(
          `SELECT * FROM problem_orders WHERE DATE(created_at) = ? AND team = ? AND role = ? AND created_at >= ? AND created_at <= ?`,
          [today, t, shift.role, fmtDateTime(positionTaskWinStart), fmtDateTime(positionTaskWinEnd)]
        )
        const [posMaint] = await pool.query(
          `SELECT * FROM maintenance_orders WHERE DATE(created_at) = ? AND team = ? AND role = ? AND created_at >= ? AND created_at <= ?`,
          [today, t, shift.role, fmtDateTime(positionTaskWinStart), fmtDateTime(positionTaskWinEnd)]
        )
        const posAllWosRaw = [
          ...posWo.map((w) => ({ ...w, type: '问题工单' })),
          ...posMaint.map((w) => ({ ...w, type: '维修工单' }))
        ]
        const posMaintMap = {}
        for (const w of posAllWosRaw) {
          if (w.type === '维修工单' && w.problem_order_id) posMaintMap[w.problem_order_id] = w
        }
        const posProblemNeedReplace = posAllWosRaw
          .filter((w) => w.type === '问题工单' && w.status === 'to_maintenance' && !posMaintMap[w.id])
          .map((w) => w.id)
        if (posProblemNeedReplace.length > 0) {
          const [latest] = await pool.query(
            `SELECT * FROM maintenance_orders WHERE problem_order_id IN (${posProblemNeedReplace.map(() => '?').join(',')}) ORDER BY id DESC`,
            posProblemNeedReplace
          )
          for (const m of latest || []) {
            if (m.problem_order_id) posMaintMap[m.problem_order_id] = { ...m, type: '维修工单' }
          }
        }
        const posAllWos = []
        const posReplaced = new Set()
        for (const w of posAllWosRaw) {
          if (w.type === '问题工单' && w.status === 'to_maintenance' && posMaintMap[w.id]) {
            posAllWos.push({ ...posMaintMap[w.id], _from_problem: true })
            posReplaced.add(posMaintMap[w.id].id)
          } else if (w.type === '维修工单' && posReplaced.has(w.id)) {
            continue
          } else {
            posAllWos.push(w)
          }
        }
        const seenK = new Set()
        const posAllWosDedup = posAllWos.filter((w) => {
          const k = `${w.id}-${w.type}`
          if (seenK.has(k)) return false
          seenK.add(k)
          return true
        })

        // 合并继承的工单(接班时从上一班继承的),标记 _inherited
        const inheritedWosRaw = (() => {
          if (!shift.inherited_workorders) return []
          try {
            const arr = typeof shift.inherited_workorders === 'string'
              ? JSON.parse(shift.inherited_workorders) : shift.inherited_workorders
            return Array.isArray(arr) ? arr : []
          } catch { return [] }
        })()
        const inheritedTagged = inheritedWosRaw.map(w => ({
          ...w,
          type: w.wo_type === 'maintenance' ? '维修工单' : '问题工单',
          _inherited: true
        }))
        // 优先继承工单(去重: 如果同 id+type 已存在则跳过)
        const finalWos = []
        const finalSeenK = new Set()
        for (const w of [...inheritedTagged, ...posAllWosDedup]) {
          const k = `${w.id}-${w.type}`
          if (finalSeenK.has(k)) continue
          finalSeenK.add(k)
          finalWos.push(w)
        }

        positions.push({
          role: shift.role,
          team: t,
          shiftType: shift.shift_type,
          memberName: shift.member_name,
          userName: shift.user_name,
          leaderName: shift.leader_name,
          notes,
          lastHandover,
          tasks: {
            total: posTasks.length,
            done: posTasks.filter((x) => x.status === 'completed' || x.status === 'abnormal').length,
            abnormal: posTasks.filter((x) => x.has_abnormal === 1).length,
            abnormalList: posTasks.filter((x) => x.has_abnormal === 1),
            allList: posTasks
          },
          workorders: {
            created: finalWos,
            completed: finalWos.filter((w) => ['completed', 'closed', 'self_resolved'].includes(w.status)),
            inProgress: finalWos.filter((w) => ['processing', 'delay', 'returned', 'to_maintenance'].includes(w.status))
          }
        })
        // 聚合到 stats
        // newTotal 只算“新建”的 (不含继承的 inherited_workorders)
        statsWoTotal += posAllWosDedup.length
        // problemOrders / maintenanceOrders 包含继承工单 (类型分类按全部计算)
        for (const w of finalWos) {
          if (w.type === '问题工单') statsWoProblem++
          else if (w.type === '维修工单') statsWoMaint++
        }
        // completed / inProgress 包含继承工单
        statsWoCompleted += finalWos.filter((w) => ['completed', 'closed', 'self_resolved'].includes(w.status)).length
        statsWoInProgress += finalWos.filter((w) => ['processing', 'delay', 'returned', 'to_maintenance'].includes(w.status)).length
        statsTaskTotal += posTasks.length
        statsTaskDone += posTasks.filter((t) => t.status === 'completed' || t.status === 'abnormal').length
        statsTaskAbnormal += posTasks.filter((t) => t.has_abnormal === 1).length
      }
    }

    const workorderStats = {
      newTotal: statsWoTotal,
      problemOrders: statsWoProblem,
      maintenanceOrders: statsWoMaint,
      completed: statsWoCompleted,
      inProgress: statsWoInProgress
    }
    const taskStats = {
      total: statsTaskTotal,
      done: statsTaskDone,
      abnormal: statsTaskAbnormal
    }

    res.json({
      date: today,
      workorderStats,
      taskStats,
      positions
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 新建交接记录
router.post('/', async (req, res) => {
  try {
    const {
      handing_over_user, handingOverUser,
      handing_over_role, handingOverRole,
      handing_over_member, handingOverMember,
      taking_over_user, takingOverUser,
      taking_over_role, takingOverRole,
      taking_over_member, takingOverMember,
      shift_type, shiftType,
      team,
      handover_time,
      shift_start, shiftStart,
      shift_end, shiftEnd,
      notes,
      tasks_status, tasksStatus,
      workorders_status, workordersStatus
    } = req.body
    // 兼容 snake_case 和 camelCase
    const finalHandingOverUser = handing_over_user ?? handingOverUser
    const finalHandingOverRole = handing_over_role ?? handingOverRole
    const finalHandingOverMember = handing_over_member ?? handingOverMember
    const finalTakingOverUser = taking_over_user ?? takingOverUser
    const finalTakingOverRole = taking_over_role ?? takingOverRole
    const finalTakingOverMember = taking_over_member ?? takingOverMember
    const finalShiftType = shift_type ?? shiftType
    const finalShiftStart = shift_start ?? shiftStart
    const finalShiftEnd = shift_end ?? shiftEnd
    const finalTasksStatus = tasks_status ?? tasksStatus
    const finalWorkordersStatus = workorders_status ?? workordersStatus
    // 同一时刻同一角色只能有一个 pending 状态的交接记录
    if (finalHandingOverRole && finalShiftType && team) {
      const [existing] = await pool.query(
        `SELECT id FROM handover_records WHERE handing_over_role = ? AND shift_type = ? AND team = ? AND status = 'pending' LIMIT 1`,
        [finalHandingOverRole, finalShiftType, team]
      )
      if (existing[0]) {
        return res.status(409).json({ error: '已有待接班的交接记录,请先完成交接' })
      }
    }
    const [result] = await pool.query(
      `INSERT INTO handover_records (handing_over_user, handing_over_role, taking_over_user, taking_over_role, taking_over_member, shift_type, team, handover_time, shift_start, shift_end, notes, tasks_status, workorders_status, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [finalHandingOverUser, finalHandingOverRole, finalTakingOverUser || null, finalTakingOverRole || null, finalTakingOverMember || null, finalShiftType, team, handover_time || new Date(), finalShiftStart || null, finalShiftEnd || null, notes || '', finalTasksStatus || 'pending', finalWorkordersStatus || 'pending']
    )
    sseEmit('handover-update', { id: result.insertId })
    res.json({ id: result.insertId, status: 'pending' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 确认接班(通过 /takeover 路径,handoverId 在 body 中)
router.post('/takeover', async (req, res) => {
  const { handoverId, taking_over_user, takingOverUser, taking_over_role, takingOverRole, taking_over_member, takingOverMember, taking_over_team, takingOverTeam, shift_start, shiftStart, notes } = req.body
  if (!handoverId) return res.status(400).json({ error: '缺少 handoverId' })
  // 兼容 snake_case 和 camelCase
  const finalTakingOverUser = taking_over_user ?? takingOverUser
  const finalTakingOverRole = taking_over_role ?? takingOverRole
  const finalTakingOverMember = taking_over_member ?? takingOverMember
  const finalTakingOverTeam = taking_over_team ?? takingOverTeam
  const finalShiftStart = shift_start ?? shiftStart
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query(
      `UPDATE handover_records SET status = 'completed', taking_over_user = ?, taking_over_role = ?, taking_over_member = ?, shift_start = ?, notes = CONCAT(IFNULL(notes, ''), '\n', IFNULL(?, '')) WHERE id = ?`,
      [finalTakingOverUser, finalTakingOverRole, finalTakingOverMember || null, finalShiftStart || new Date(), notes || '', handoverId]
    )
    const [rows] = await conn.query(`SELECT * FROM handover_records WHERE id = ?`, [handoverId])
    const handover = rows[0]
    if (handover) {
      // 确定新班次的班组:优先用 takingOverTeam(用户选择),否则 fallback 到 handover.team
      // 如果传了 takingOverTeam,需要验证该 member 确实属于该班组
      const newShiftTeam = finalTakingOverTeam || handover.team
      if (finalTakingOverMember) {
        const [memberCheck] = await conn.query(
          `SELECT team_name FROM shift_team_members WHERE member_name = ? AND team_name = ? LIMIT 1`,
          [finalTakingOverMember, newShiftTeam]
        )
        if (!memberCheck[0]) {
          await conn.rollback()
          return res.status(400).json({ error: `${finalTakingOverMember} 不属于 ${newShiftTeam}` })
        }
      }
      // 查询该班组的带班人(来自 shift_teams 表的 leader_name)
      const [teamRow] = await conn.query(
        `SELECT leader_name FROM shift_teams WHERE team_name = ? LIMIT 1`,
        [newShiftTeam]
      )
      const newShiftLeaderName = teamRow[0]?.leader_name || null
      // 关闭旧班次(同一班组、角色、班次的未关闭班次)
      await conn.query(
        `UPDATE handover_shifts SET shift_end = ? WHERE role = ? AND shift_type = ? AND team = ? AND shift_end IS NULL`,
        [finalShiftStart || new Date(), handover.handing_over_role, handover.shift_type, handover.team]
      )
      const today = fmtDate(new Date())
      // 继承进行中工单:使用交班方班组(handover.team)查询
      // 这样跨班组接班时也能继承上一班留下的未完成工单
      const inheritTeam = handover.team
      // 继承未开始 + 进行中的工单
      const [inheritedProblemOrders] = await conn.query(
        `SELECT * FROM problem_orders WHERE team = ? AND status IN ('pending', 'processing', 'delay', 'to_maintenance')`,
        [inheritTeam]
      )
      const [inheritedMaintOrders] = await conn.query(
        `SELECT * FROM maintenance_orders WHERE team = ? AND status IN ('pending', 'processing', 'delay', 'returned')`,
        [inheritTeam]
      )
      // 合并: 只继承未完成的问题工单(非 to_maintenance) + 维修工单
      // to_maintenance 问题工单已转维修, 不再作为问题工单继承(避免重复统计)
      const inheritedWorkorders = []
      for (const p of inheritedProblemOrders) {
        if (p.status !== 'to_maintenance') {
          inheritedWorkorders.push({ ...p, wo_type: 'problem' })
        }
      }
      for (const m of inheritedMaintOrders) {
        inheritedWorkorders.push({ ...m, wo_type: 'maintenance' })
      }
      const [shiftResult] = await conn.query(
        `INSERT INTO handover_shifts (role, user_id, user_name, member_name, leader_name, shift_type, team, shift_start, inherited_workorders)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [handover.taking_over_role, finalTakingOverUser, finalTakingOverUser, finalTakingOverMember || null, newShiftLeaderName, handover.shift_type, newShiftTeam, finalShiftStart || new Date(), JSON.stringify(inheritedWorkorders)]
      )
      if (notes) {
        await conn.query(
          `INSERT INTO duty_notes (team, role, shift_type, member_name, date, notes) VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE notes = ?`,
          [newShiftTeam, handover.taking_over_role, handover.shift_type, finalTakingOverMember || null, today, notes, notes]
        )
      }
      const [newShift] = await conn.query(`SELECT * FROM handover_shifts WHERE id = ?`, [shiftResult.insertId])
      await conn.commit()
      sseEmit('handover-update', { id: Number(handoverId) })
      sseEmit('shift-update', {})
      res.json({ id: Number(handoverId), status: 'completed', currentShift: newShift[0] || null, inheritedWorkorders })
    } else {
      await conn.rollback()
      res.status(404).json({ error: '交接记录不存在' })
    }
  } catch (err) {
    await conn.rollback()
    res.status(500).json({ error: err.message })
  } finally {
    conn.release()
  }
})

// 确认接班(RESTful 路径)
router.post('/:id/confirm', async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const { taking_over_user, takingOverUser, taking_over_role, takingOverRole, taking_over_member, takingOverMember, taking_over_team, takingOverTeam, shift_start, shiftStart, notes } = req.body
    // 兼容 snake_case 和 camelCase
    const finalTakingOverUser = taking_over_user ?? takingOverUser
    const finalTakingOverRole = taking_over_role ?? takingOverRole
    const finalTakingOverMember = taking_over_member ?? takingOverMember
    const finalTakingOverTeam = taking_over_team ?? takingOverTeam
    const finalShiftStart = shift_start ?? shiftStart
    // 更新交接记录状态
    await conn.query(
      `UPDATE handover_records SET status = 'completed', taking_over_user = ?, taking_over_role = ?, taking_over_member = ?, shift_start = ?, notes = CONCAT(IFNULL(notes, ''), '\n', IFNULL(?, '')) WHERE id = ?`,
      [finalTakingOverUser, finalTakingOverRole, finalTakingOverMember || null, finalShiftStart || new Date(), notes || '', req.params.id]
    )
    // 获取当前交接记录
    const [rows] = await conn.query(`SELECT * FROM handover_records WHERE id = ?`, [req.params.id])
    const handover = rows[0]
    if (handover) {
      // 确定新班次的班组:优先用 takingOverTeam,否则 fallback 到 handover.team
      const newShiftTeam = finalTakingOverTeam || handover.team
      if (finalTakingOverMember) {
        const [memberCheck] = await conn.query(
          `SELECT team_name FROM shift_team_members WHERE member_name = ? AND team_name = ? LIMIT 1`,
          [finalTakingOverMember, newShiftTeam]
        )
        if (!memberCheck[0]) {
          await conn.rollback()
          return res.status(400).json({ error: `${finalTakingOverMember} 不属于 ${newShiftTeam}` })
        }
      }
      const [teamRow] = await conn.query(
        `SELECT leader_name FROM shift_teams WHERE team_name = ? LIMIT 1`,
        [newShiftTeam]
      )
      const newShiftLeaderName = teamRow[0]?.leader_name || null
      // 关闭旧班次(同一班组、角色、班次的未关闭班次)
      await conn.query(
        `UPDATE handover_shifts SET shift_end = ? WHERE role = ? AND shift_type = ? AND team = ? AND shift_end IS NULL`,
        [finalShiftStart || new Date(), handover.handing_over_role, handover.shift_type, handover.team]
      )
      // 继承上一班次的进行中工单(problem_orders 和 maintenance_orders)
      const today = fmtDate(new Date())
      const [inheritedProblemOrders] = await conn.query(
        `SELECT * FROM problem_orders WHERE team = ? AND status IN ('pending', 'processing', 'delay', 'to_maintenance')`,
        [handover.team]
      )
      const [inheritedMaintOrders] = await conn.query(
        `SELECT * FROM maintenance_orders WHERE team = ? AND status IN ('pending', 'processing', 'delay', 'returned')`,
        [handover.team]
      )
      const inheritedWorkorders = [
        ...inheritedProblemOrders.map(w => ({ ...w, wo_type: 'problem' })),
        ...inheritedMaintOrders.map(w => ({ ...w, wo_type: 'maintenance' }))
      ]
      // 写入新的班次记录
      await conn.query(
        `INSERT INTO handover_shifts (role, user_id, user_name, member_name, leader_name, shift_type, team, shift_start, inherited_workorders)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [handover.taking_over_role, finalTakingOverUser, finalTakingOverUser, finalTakingOverMember || null, newShiftLeaderName, handover.shift_type, newShiftTeam, finalShiftStart || new Date(), JSON.stringify(inheritedWorkorders)]
      )
      // 写入值班纪事
      if (notes) {
        await conn.query(
          `INSERT INTO duty_notes (team, role, shift_type, member_name, date, notes) VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE notes = ?`,
          [newShiftTeam, handover.taking_over_role, handover.shift_type, finalTakingOverMember || null, today, notes, notes]
        )
      }
    }
    await conn.commit()
    sseEmit('handover-update', { id: Number(req.params.id) })
    sseEmit('shift-update', {})
    res.json({ id: Number(req.params.id), status: 'completed' })
  } catch (err) {
    await conn.rollback()
    res.status(500).json({ error: err.message })
  } finally {
    conn.release()
  }
})

// 交班
router.post('/shift/:id/surrender', async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const { handover_time, shift_end, notes, tasks_status, workorders_status } = req.body
    // 关闭当前班次
    await conn.query(
      `UPDATE handover_shifts SET shift_end = ? WHERE id = ?`,
      [shift_end || new Date(), req.params.id]
    )
    // 更新交接记录的备注和状态
    const [shifts] = await conn.query(`SELECT * FROM handover_shifts WHERE id = ?`, [req.params.id])
    const shift = shifts[0]
    if (shift) {
      const [handover] = await conn.query(
        `SELECT * FROM handover_records WHERE handing_over_role = ? AND shift_type = ? AND team = ? AND status = 'pending' ORDER BY handover_time DESC LIMIT 1`,
        [shift.role, shift.shift_type, shift.team]
      )
      if (handover[0]) {
        // 已有 pending 记录:更新
        await conn.query(
          `UPDATE handover_records SET handover_time = ?, notes = CONCAT(IFNULL(notes, ''), '\n', IFNULL(?, '')), tasks_status = ?, workorders_status = ? WHERE id = ?`,
          [handover_time || new Date(), notes || '', tasks_status || 'pending', workorders_status || 'pending', handover[0].id]
        )
        sseEmit('handover-update', { id: handover[0].id })
      } else {
        // 没有 pending 记录:新建
        const [result] = await conn.query(
          `INSERT INTO handover_records (handing_over_user, handing_over_role, handing_over_member, shift_type, team, handover_time, shift_start, notes, tasks_status, workorders_status, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [shift.user_name, shift.role, shift.member_name || null, shift.shift_type, shift.team, handover_time || new Date(), shift.shift_start, notes || '', tasks_status || 'pending', workorders_status || 'pending']
        )
        sseEmit('handover-update', { id: result.insertId })
      }
    }
    await conn.commit()
    sseEmit('shift-update', {})
    res.json({ success: true })
  } catch (err) {
    await conn.rollback()
    res.status(500).json({ error: err.message })
  } finally {
    conn.release()
  }
})

// 获取历史交接记录
// 系统管理员：可传任意 role/team 查看所有岗位的历史(用于历史交接记录页面)
// 其他角色：保持原逻辑(查本角色参与的交接)
router.get('/history', async (req, res) => {
  try {
    const { role, team, taking_over_team, start_date, end_date, shift_type, user, handing_over_user, taking_over_user, viewerRole, limit, offset } = req.query
    const isAdmin = ['系统管理人', '带班'].includes(viewerRole) || ['系统管理人', '带班'].includes(role)
    if (!role && !isAdmin) return res.status(400).json({ error: '缺少 role 参数' })

    // 分页参数
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit) || 10))
    const pageOffset = Math.max(0, parseInt(offset) || 0)

    // 时间范围:默认 7 天,前端传 start_date/end_date 优先
    let startTime
    if (start_date) {
      startTime = new Date(start_date + 'T00:00:00')
    } else {
      startTime = new Date(Date.now() - 7 * 24 * 3600000)
    }
    const endTime = end_date ? new Date(end_date + 'T23:59:59') : new Date()

    // 动态构建 WHERE(班组可选,默认查全部)
    const conditions = [
      "h.status = 'completed'",
      'h.handover_time >= ?',
      'h.handover_time <= ?'
    ]
    const params = [fmtDateTime(startTime), fmtDateTime(endTime)]
    if (role && !isAdmin) {
      conditions.unshift('(h.handing_over_role = ? OR h.taking_over_role = ?)')
      params.unshift(role, role)
    }
    if (team) {
      conditions.push('h.team = ?')
      params.push(team)
    }
    if (taking_over_team) {
      // 接班班组: LEFT JOIN handover_shifts 出的 hs.team
      conditions.push('hs.team = ?')
      params.push(taking_over_team)
    }
    if (shift_type) {
      conditions.push('h.shift_type = ?')
      params.push(shift_type)
    }
    if (user) {
      conditions.push('(h.handing_over_user = ? OR h.taking_over_user = ?)')
      params.push(user, user)
    }
    if (handing_over_user) {
      conditions.push('h.handing_over_user = ?')
      params.push(handing_over_user)
    }
    if (taking_over_user) {
      conditions.push('h.taking_over_user = ?')
      params.push(taking_over_user)
    }

    const whereClause = conditions.join(' AND ')

    // 查总数 (同条件)
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total
       FROM handover_records h
       LEFT JOIN handover_shifts hs ON hs.user_name = h.taking_over_user
         AND hs.shift_type = h.shift_type AND hs.shift_end IS NULL
       WHERE ${whereClause}`,
      params
    )
    const total = countRows[0]?.total || 0

    // 查分页数据
    const [rows] = await pool.query(
      `SELECT h.*, u.name as taking_over_user_name,
              d.notes as duty_notes,
              hs.team as taking_over_team, hs.member_name as taking_over_shift_member, hs.leader_name as taking_over_shift_leader
       FROM handover_records h
       LEFT JOIN users u ON h.taking_over_user = u.id
       LEFT JOIN duty_notes d ON d.team = h.team AND d.role = h.handing_over_role
         AND d.shift_type = h.shift_type AND d.date = DATE(h.handover_time)
       LEFT JOIN handover_shifts hs ON hs.user_name = h.taking_over_user
         AND hs.shift_type = h.shift_type AND hs.shift_end IS NULL
       WHERE ${whereClause}
       ORDER BY h.handover_time DESC LIMIT ? OFFSET ?`,
      [...params, pageLimit, pageOffset]
    )
    res.json({ rows, total, limit: pageLimit, offset: pageOffset })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 获取单条历史交接记录的详情(巡检任务 + 工单情况)
// 时间窗口: handover_time - 12h ~ handover_time(覆盖任意班次跨天)
router.get('/history/:id/detail', async (req, res) => {
  try {
    const { id } = req.params
    const [rows] = await pool.query(
      `SELECT * FROM handover_records WHERE id = ? AND status = 'completed'`,
      [id]
    )
    if (!rows[0]) return res.status(404).json({ error: '记录不存在或未完成' })
    const record = rows[0]

    // 窗口:handover_time 往前 12 小时
    const winEnd = new Date(record.handover_time)
    const winStart = new Date(winEnd.getTime() - 12 * 3600000)
    const prevDate = fmtDate(winEnd)

    const prevRole = record.handing_over_role
    const prevUserName = record.handing_over_user
    const prevTeam = record.team
    const prevMember = record.handing_over_member

    // 巡检任务: 按 prevDate + executor_name 查 (业务执行日, 不依赖 updated_at 窗口)
    // handover_records.handing_over_user 对应 user_name (如 '一期制水')
    const [shiftTasks] = await pool.query(
      `SELECT r.*, i.device_name, p.name as plan_name
       FROM inspection_task_records r
       LEFT JOIN inspection_items i ON r.device_id = i.device_id AND r.plan_id = i.plan_id
       LEFT JOIN inspection_plans p ON r.plan_id = p.id
       WHERE r.check_date = ? AND r.executor_name = ?`,
      [prevDate, prevUserName]
    )

    // 问题工单
    const woQuery = prevMember && prevUserName
      ? `SELECT * FROM problem_orders WHERE DATE(created_at) = ? AND team = ? AND member_name = ? AND (role = ? OR reporter_name = ?) AND created_at >= ? AND created_at <= ?`
      : (prevUserName
        ? `SELECT * FROM problem_orders WHERE DATE(created_at) = ? AND team = ? AND (role = ? OR reporter_name = ?) AND created_at >= ? AND created_at <= ?`
        : `SELECT * FROM problem_orders WHERE DATE(created_at) = ? AND team = ? AND role = ? AND created_at >= ? AND created_at <= ?`)
    const woParams = prevMember && prevUserName
      ? [prevDate, prevTeam, prevMember, prevUserName, prevUserName, fmtDateTime(winStart), fmtDateTime(winEnd)]
      : (prevUserName
        ? [prevDate, prevTeam, prevUserName, prevUserName, fmtDateTime(winStart), fmtDateTime(winEnd)]
        : [prevDate, prevTeam, prevRole, fmtDateTime(winStart), fmtDateTime(winEnd)])
    const [woRows] = await pool.query(woQuery, woParams)

    // 维修工单
    const maintQuery = prevMember && prevUserName
      ? `SELECT * FROM maintenance_orders WHERE DATE(created_at) = ? AND team = ? AND member_name = ? AND (role = ? OR reporter_name = ?) AND created_at >= ? AND created_at <= ?`
      : (prevUserName
        ? `SELECT * FROM maintenance_orders WHERE DATE(created_at) = ? AND team = ? AND (role = ? OR reporter_name = ?) AND created_at >= ? AND created_at <= ?`
        : `SELECT * FROM maintenance_orders WHERE DATE(created_at) = ? AND team = ? AND role = ? AND created_at >= ? AND created_at <= ?`)
    const [maintWoRows] = await pool.query(maintQuery, woParams)

    // 合并 + 去重(问题工单转维修)
    const allWosRaw = [
      ...woRows.map(w => ({ ...w, type: '问题工单' })),
      ...maintWoRows.map(w => ({ ...w, type: '维修工单' }))
    ]
    const maintProblemMap = {}
    for (const w of allWosRaw) {
      if (w.type === '维修工单' && w.problem_order_id) {
        maintProblemMap[w.problem_order_id] = w
      }
    }
    // 补全查找:to_maintenance 问题工单未被窗口内维修工单替代的，查最新维修工单(不限窗口)
    const problemIdsNeedReplaceH = allWosRaw
      .filter(w => w.type === '问题工单' && w.status === 'to_maintenance' && !maintProblemMap[w.id])
      .map(w => w.id)
    if (problemIdsNeedReplaceH.length > 0) {
      const [latestMaintH] = await pool.query(
        `SELECT * FROM maintenance_orders WHERE problem_order_id IN (${problemIdsNeedReplaceH.map(() => '?').join(',')}) ORDER BY id DESC`,
        problemIdsNeedReplaceH
      )
      for (const m of latestMaintH || []) {
        if (m.problem_order_id) {
          maintProblemMap[m.problem_order_id] = { ...m, type: '维修工单' }
        }
      }
    }
    const allWos = []
    const replacedMaintIds = new Set()
    for (const w of allWosRaw) {
      if (w.type === '问题工单' && w.status === 'to_maintenance' && maintProblemMap[w.id]) {
        allWos.push({ ...maintProblemMap[w.id], _from_problem: true })
        replacedMaintIds.add(maintProblemMap[w.id].id)
      } else if (w.type === '维修工单' && replacedMaintIds.has(w.id)) {
        continue
      } else {
        allWos.push(w)
      }
    }

    const tasks = {
      total: shiftTasks.length,
      done: shiftTasks.filter(t => t.status === 'completed' || t.status === 'abnormal').length,
      abnormal: shiftTasks.filter(t => t.has_abnormal === 1).length,
      allList: shiftTasks
    }
    // 标记:这些工单都是该班次期间由该班次创建的
    for (const w of allWos) w.isCreatedInLastShift = true

    res.json({
      record,
      tasks,
      workorders: {
        created: allWos,
        completed: allWos.filter(w => ['completed', 'closed', 'self_resolved'].includes(w.status)),
        inProgress: allWos.filter(w => ['processing', 'delay', 'returned', 'to_maintenance'].includes(w.status))
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 获取当前有效班次
router.get('/current-shift', async (req, res) => {
  try {
    const { role, team } = req.query
    if (!role) return res.status(400).json({ error: '缺少 role 参数' })
    const today = fmtDate(new Date())
    // 直接从 handover_shifts 表查当前有效班次(按角色区分)
    const [shifts] = await pool.query(
      `SELECT * FROM handover_shifts WHERE shift_end IS NULL AND role = ? ORDER BY shift_start DESC LIMIT 1`,
      [role]
    )
    res.json(shifts[0] || null)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 获取值班纪事(兼容 /current-notes)
router.get('/current-notes', async (req, res) => {
  try {
    const { role, team, shift_type, date } = req.query
    if (!role) return res.status(400).json({ error: '缺少 role 参数' })
    const today = date || fmtDate(new Date())
    const [rows] = await pool.query(
      `SELECT * FROM duty_notes WHERE team = ? AND role = ? AND shift_type = ? AND date = ? LIMIT 1`,
      [team || 'A班', role, shift_type || '日班', today]
    )
    res.json(rows[0] || { notes: '', shift_type: shift_type || '日班', date: today, team: team || 'A班', role: role || '值班岗位' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 保存值班纪事(兼容 /current-notes)
router.post('/current-notes', async (req, res) => {
  try {
    const { role, team, shift_type, date, notes, member_name } = req.body
    if (!role) return res.status(400).json({ error: '缺少 role 参数' })
    const today = date || fmtDate(new Date())
    await pool.query(
      `INSERT INTO duty_notes (team, role, shift_type, member_name, date, notes) VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE notes = ?, member_name = COALESCE(?, member_name), updated_at = CURRENT_TIMESTAMP`,
      [team || 'A班', role, shift_type || '日班', member_name || null, today, notes, notes, member_name]
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 获取值班纪事
router.get('/notes', async (req, res) => {
  try {
    const { role, team, shift_type, date } = req.query
    if (!role) return res.status(400).json({ error: '缺少 role 参数' })
    const today = date || fmtDate(new Date())
    const [rows] = await pool.query(
      `SELECT * FROM duty_notes WHERE team = ? AND role = ? AND shift_type = ? AND date = ? LIMIT 1`,
      [team || 'A班', role, shift_type || '日班', today]
    )
    res.json(rows[0] || { notes: '', shift_type: shift_type || '日班', date: today, team: team || 'A班', role: role || '值班岗位' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 保存值班纪事
router.post('/notes', async (req, res) => {
  try {
    const { role, team, shift_type, date, notes, member_name } = req.body
    if (!role) return res.status(400).json({ error: '缺少 role 参数' })
    const today = date || fmtDate(new Date())
    await pool.query(
      `INSERT INTO duty_notes (team, role, shift_type, member_name, date, notes) VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE notes = ?, member_name = COALESCE(?, member_name), updated_at = CURRENT_TIMESTAMP`,
      [team || 'A班', role, shift_type || '日班', member_name || null, today, notes, notes, member_name]
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- 新的 current-workorders ----
// 显示逻辑:
// - 当前班次继承的进行中工单(来自 inherited_workorders,过滤 self_resolved)
// - 当日该用户提交的问题工单(reporter_name = user)
// - 当日该用户关联的维修工单(两条路径:problem_order_id 关联 OR user_name+team+role+日期 兜底)
// - 兜底逻辑:问题工单转维修并闭环后删除,problem_order_id 失效,通过 user_name+team+role+日期 回溯
router.get('/current-workorders', async (req, res) => {
  try {
    const { user, date, team, role } = req.query
    if (!user) return res.status(400).json({ error: '缺少 user 参数' })
    const targetDate = date || fmtDate(new Date())

    // 从当前班次的 inherited_workorders 获取继承工单
    const [shifts] = await pool.query(
      `SELECT inherited_workorders FROM handover_shifts WHERE shift_end IS NULL ORDER BY shift_start DESC LIMIT 1`
    )
    let inherited = []
    if (shifts[0]?.inherited_workorders) {
      // mysql2 已自动解析 JSON 字段为 JS 对象/数组,直接使用
      inherited = Array.isArray(shifts[0].inherited_workorders)
        ? shifts[0].inherited_workorders
        : (() => { try { return JSON.parse(shifts[0].inherited_workorders) } catch { return [] } })()
    }
    // 只保留未完成的继承工单(排除 completed/closed/self_resolved)
    // 并对问题工单转维修的情况进行去重:问题工单转维修后只显示维修工单的状态
    const activeInheritedRaw = inherited.filter(w => !['completed', 'closed', 'self_resolved'].includes(w.status))
    // 收集问题工单(status=to_maintenance)需要被维修工单替代
    const inheritedProblemToMaint = {}
    for (const w of activeInheritedRaw) {
      if (w.wo_type === 'problem' && w.status === 'to_maintenance' && w.id) {
        // 在 inherited 中查找是否有 problem_order_id == w.id 的维修工单
        const linkedMaint = activeInheritedRaw.find(m => m.wo_type === 'maintenance' && m.problem_order_id === w.id)
        if (linkedMaint) inheritedProblemToMaint[w.id] = linkedMaint
      }
    }
    // 替换:问题工单(to_maintenance)被同 id 的维修工单替代
    const activeInherited = []
    const inheritedReplacedMaintIds = new Set()
    for (const w of activeInheritedRaw) {
      if (w.wo_type === 'problem' && inheritedProblemToMaint[w.id]) {
        const maint = inheritedProblemToMaint[w.id]
        activeInherited.push({ ...maint, type: '维修工单', _from_problem: true })
        inheritedReplacedMaintIds.add(maint.id)
      } else if (w.wo_type === 'maintenance' && inheritedReplacedMaintIds.has(w.id)) {
        // 已被作为替代的维修工单,跳过
        continue
      } else {
        // 补充 type 字段(中文)供前端 statusLabel 匹配
        const type = w.wo_type === 'maintenance' ? '维修工单' : w.wo_type === 'problem' ? '问题工单' : (w.type || '工单')
        activeInherited.push({ ...w, type })
      }
    }

    // 当日该用户提交的问题工单
    // 系统管理人可见所有问题工单(按日期过滤),其他人按 reporter_name 过滤
    const isAdmin = role === '系统管理人'
    const [pos] = isAdmin
      ? await pool.query(
          `SELECT id, content, status, '问题工单' as type, device_id, created_at
           FROM problem_orders WHERE DATE(created_at) = ?`,
          [targetDate]
        )
      : await pool.query(
          `SELECT id, content, status, '问题工单' as type, device_id, created_at
           FROM problem_orders WHERE reporter_name = ?`,
          [user]
        )
    // 北京时区过滤:created_at +8h 取日期 == targetDate(但需考虑夜班跨天的情况)
    // 获取当前班次开始时间,以此为窗口起点
    const [curShiftRows] = await pool.query(
      `SELECT shift_start FROM handover_shifts WHERE shift_end IS NULL ORDER BY shift_start DESC LIMIT 1`
    )
    const shiftStartTime = curShiftRows[0]?.shift_start
      ? new Date(curShiftRows[0].shift_start)
      : null
    const filteredPos = pos.filter(p => {
      const created = new Date(p.created_at)
      // 如果有当前班次,按班次开始时间为窗口;否则按 targetDate
      if (shiftStartTime) return created >= shiftStartTime
      const bjMs = created.getTime() + 8 * 3600000
      const bjDate = new Date(bjMs).toISOString().slice(0, 10)
      return bjDate === targetDate
    })
    const posIdsSet = new Set(filteredPos.map(p => p.id))

    // 通过 problem_order_id 查找关联的维修工单(有效关联)
    let linkedMaintRows = []
    if (posIdsSet.size > 0) {
      const posIdList = Array.from(posIdsSet)
      const [linkedMaint] = await pool.query(
        `SELECT id, content, status, '维修工单' as type, device_id, created_at, problem_order_id
         FROM maintenance_orders WHERE problem_order_id IN (${posIdList.map(() => '?').join(',')})`,
        posIdList
      )
      linkedMaintRows = linkedMaint || []
    }

    // 兜底查询:当 problem_order_id 对应的 prob 工单已被删除时,
    // 通过 reporter_name + team + role + 日期 查找孤儿维修工单(按原始报告人过滤)
    // 北京时区日期过滤
    let orphanMaintRows = []
    if (team && role) {
      const isAdmin = role === '系统管理人'
      if (isAdmin) {
        // 系统管理人查当日所有维修工单
        const [orphanMaint] = await pool.query(
          `SELECT mo.id, mo.content, mo.status, '维修工单' as type, mo.device_id, mo.created_at, mo.problem_order_id
           FROM maintenance_orders mo
           WHERE mo.team = ? AND mo.role = ?`,
          [team, role]
        )
        orphanMaintRows = (orphanMaint || []).filter(m => {
          const created = new Date(m.created_at)
          if (shiftStartTime) return created >= shiftStartTime
          const bjMs = created.getTime() + 8 * 3600000
          const bjDate = new Date(bjMs).toISOString().slice(0, 10)
          return bjDate === targetDate
        })
      } else {
        // 其他人按原始报告人过滤(通过 problem_order_id JOIN 获取)
        // 注意:不过滤 mo.role,因为维修工单的 role 是创建人角色,与报告人无关
        const [orphanMaint] = await pool.query(
          `SELECT mo.id, mo.content, mo.status, '维修工单' as type, mo.device_id, mo.created_at, mo.problem_order_id
           FROM maintenance_orders mo
           LEFT JOIN problem_orders po ON mo.problem_order_id = po.id
           WHERE (mo.reporter_name = ? OR po.reporter_name = ?) AND mo.team = ?`,
          [user, user, team]
        )
        orphanMaintRows = (orphanMaint || []).filter(m => {
          const created = new Date(m.created_at)
          if (shiftStartTime) return created >= shiftStartTime
          const bjMs = created.getTime() + 8 * 3600000
          const bjDate = new Date(bjMs).toISOString().slice(0, 10)
          return bjDate === targetDate
        })
      }
    }

    // 已通过 problem_order_id 找到的维修工单 id(用于去重)
    const linkedMaintIds = new Set(linkedMaintRows.map(m => m.id))

    // 孤儿工单排除已关联的,保留进行中 + 已闭环
    const orphanFiltered = orphanMaintRows.filter(m =>
      !linkedMaintIds.has(m.id) &&
      !['self_resolved'].includes(m.status)
    )

    // 问题工单状态替换:to_maintenance 时显示维修工单状态
    // 去重:to_maintenance 的问题工单直接用维修工单替代,不再单独返回问题工单
    const maintStatusMap = {}
    for (const m of linkedMaintRows) {
      if (m.problem_order_id) maintStatusMap[m.problem_order_id] = m
    }
    // to_maintenance 的问题工单:用维修工单替代;其他正常问题工单保留
    const normalizedPos = filteredPos.map(p => {
      if (p.status === 'to_maintenance' && maintStatusMap[p.id]) {
        // 用维修工单替代,标记来源
        return { ...maintStatusMap[p.id], _from_problem: true }
      }
      return p
    })

    // 找出 normalizedPos 中已替代的维修工单 id(用于去重)
    const replacedMaintIds = new Set(
      normalizedPos.filter(p => p._from_problem).map(p => p.id)
    )

    // 分类输出时排除已被替代的维修工单(避免重复显示)
    const activeMaint = linkedMaintRows.filter(m => !replacedMaintIds.has(m.id) && !['completed', 'closed'].includes(m.status))
    const closedMaint = linkedMaintRows.filter(m => !replacedMaintIds.has(m.id) && ['completed', 'closed'].includes(m.status))
    const activeOrphan = orphanFiltered.filter(m => !['completed', 'closed'].includes(m.status))
    const closedOrphan = orphanFiltered.filter(m => ['completed', 'closed'].includes(m.status))

    // 拼接所有工单,再按 (id, type) 组合去重,保留第一个出现的(inherited 优先,保证状态最新)
    // 同时按 problem_order_id 去重:同一个问题工单关联的维修工单只保留一个(优先 inherited,再是 activeMaint)
    const merged = [...activeInherited, ...normalizedPos, ...activeMaint, ...closedMaint, ...activeOrphan, ...closedOrphan]
    const seenKey3 = new Set()
    const seenProblemKey = new Set()
    const result = merged.filter((w) => {
      const key = `${w.id}-${w.type}`
      if (seenKey3.has(key)) return false
      seenKey3.add(key)
      // 维修工单按 problem_order_id 去重
      if (w.type === '维修工单' && w.problem_order_id) {
        const pkey = `maint-${w.problem_order_id}`
        if (seenProblemKey.has(pkey)) return false
        seenProblemKey.add(pkey)
      }
      return true
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router