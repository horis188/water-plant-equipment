<template>
  <div class="handover-page">
    <TopNavBar />
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">班组交接</h2>
        <span class="page-desc">{{ currentShiftLabel }}</span>
      </div>
      <div v-if="false" class="header-actions">
        <span class="shift-badge">{{ currentShiftType }}</span>
        <span class="team-badge">{{ currentUser.team || 'A班' }}</span>
      </div>
    </div>

    <!-- 状态卡片行 (仅单岗位值班使用, 带班/系统管理人隐藏) -->
    <div v-if="!['系统管理人', '带班', '厂长'].includes(currentUser?.role || '')" class="status-cards-row" style="padding: 0 32px;">
      <div class="stat-card">
        <span class="stat-num" :class="tasksDone >= tasksTotal && tasksTotal > 0 ? 'stat-green' : 'stat-orange'">{{ tasksDone }}</span>
        <span class="stat-lbl">巡检完成</span>
      </div>
      <div class="stat-sep">/</div>
      <div class="stat-card">
        <span class="stat-num stat-gray">{{ tasksTotal }}</span>
        <span class="stat-lbl">巡检总数</span>
      </div>
      <div class="stat-sep">/</div>
      <div class="stat-card">
        <span class="stat-num" :class="workordersDone >= workordersTotal && workordersTotal > 0 ? 'stat-green' : 'stat-orange'">{{ workordersDone }}</span>
        <span class="stat-lbl">工单处理</span>
      </div>
      <div class="stat-sep">/</div>
      <div class="stat-card">
        <span class="stat-num stat-gray">{{ workordersTotal }}</span>
        <span class="stat-lbl">工单总数</span>
      </div>
    </div>

    <!-- 系统管理员/带班专属概览 (顶部 stats) -->
    <div v-if="['系统管理人', '带班', '厂长'].includes(currentUser?.role || '') && adminOverview" class="admin-overview" style="padding: 0 32px; margin-top: 16px;">
      <div class="admin-stats" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px;">
        <div class="admin-stat-card" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:16px;">
          <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:10px;">📋 今日工单情况</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
            <div style="text-align:center;"><div style="font-size:24px;font-weight:600;color:#2dd4bf;">{{ adminOverview.workorderStats.newTotal }}</div><div style="font-size:11px;color:rgba(255,255,255,0.5);">新建总数</div></div>
            <div style="text-align:center;"><div style="font-size:24px;font-weight:600;color:#fa8c16;">{{ adminOverview.workorderStats.problemOrders }}</div><div style="font-size:11px;color:rgba(255,255,255,0.5);">问题工单</div></div>
            <div style="text-align:center;"><div style="font-size:24px;font-weight:600;color:#fa8c16;">{{ adminOverview.workorderStats.maintenanceOrders }}</div><div style="font-size:11px;color:rgba(255,255,255,0.5);">维修工单</div></div>
            <div style="text-align:center;"><div style="font-size:24px;font-weight:600;color:#16a34a;">{{ adminOverview.workorderStats.completed }}</div><div style="font-size:11px;color:rgba(255,255,255,0.5);">已完成</div></div>
          </div>
        </div>
        <div class="admin-stat-card" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:16px;">
          <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:10px;">🔍 今日巡检任务情况</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
            <div style="text-align:center;"><div style="font-size:24px;font-weight:600;color:#2dd4bf;">{{ adminOverview.taskStats.total }}</div><div style="font-size:11px;color:rgba(255,255,255,0.5);">任务总数</div></div>
            <div style="text-align:center;"><div style="font-size:24px;font-weight:600;color:#16a34a;">{{ adminOverview.taskStats.done }}</div><div style="font-size:11px;color:rgba(255,255,255,0.5);">已完成</div></div>
            <div style="text-align:center;"><div style="font-size:24px;font-weight:600;color:#e53935;">{{ adminOverview.taskStats.abnormal }}</div><div style="font-size:11px;color:rgba(255,255,255,0.5);">异常</div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 各岗位事务卡片 (带班账号过滤掉"带班"自己) -->
    <div v-if="['系统管理人', '带班', '厂长'].includes(currentUser?.role || '') && displayPositions.length > 0" style="padding: 0 32px; margin-top: 16px;">
      <div class="section-title" style="font-size:16px;font-weight:600;color:rgba(255,255,255,0.85);margin-bottom:12px;">
        👥 当前值班班组岗位事务
      </div>
      <div class="admin-positions-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:12px;align-items:start;">
        <div v-for="p in displayPositions" :key="p.role+p.team" class="admin-position-card" :class="expandedAdminPositions.has(p.role+p.team) ? 'expanded' : ''" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:16px;cursor:pointer;transition:all 0.2s;" @click="toggleAdminPosition(p.role+p.team)">
          <div class="admin-position-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div>
              <div style="font-size:21px;font-weight:700;color:#2dd4bf;letter-spacing:1px;">{{ p.role || '未知岗位' }}</div>
              <div style="font-size:14px;color:rgba(255,255,255,0.75);margin-top:6px;font-weight:500;">
                {{ p.memberName || p.userName || '未接班' }}
                <span v-if="p.team"> · {{ p.team }}</span>
                <span v-if="p.shiftType"> · {{ p.shiftType }}</span>
              </div>
            </div>
            <span style="font-size:14px;color:rgba(255,255,255,0.5);">{{ expandedAdminPositions.has(p.role+p.team) ? '▼' : '▶' }}</span>
          </div>
          <div class="admin-position-summary" style="display:flex;gap:12px;font-size:14px;margin-bottom:6px;font-weight:500;">
            <span :class="p.tasks.total === 0 ? 'text-gray' : (p.tasks.done >= p.tasks.total ? 'text-green' : 'text-orange')">巡检 {{ p.tasks.done }}/{{ p.tasks.total }}</span>
            <span v-if="p.tasks.abnormal > 0" style="color:#e53935;">异常 {{ p.tasks.abnormal }}</span>
            <span :class="p.workorders.created.length === 0 ? 'text-gray' : (p.workorders.inProgress.length > 0 ? 'text-orange' : 'text-green')">工单 {{ p.workorders.completed.length }}/{{ p.workorders.created.length }}</span>
          </div>
          <!-- 展开详情 -->
          <div v-if="expandedAdminPositions.has(p.role+p.team)" class="admin-position-body" style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);font-size:14px;color:rgba(255,255,255,0.85);" @click.stop>
            <div style="margin-bottom:10px;background:rgba(255,255,255,0.04);padding:10px 12px;border-radius:4px;">
              <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:6px;font-weight:600;">📝 值班纪事</div>
              <div v-if="p.notes && p.notes.notes" style="color:rgba(255,255,255,0.95);white-space:pre-wrap;line-height:1.6;">{{ p.notes.notes }}</div>
              <div v-else style="color:rgba(255,255,255,0.4);font-style:italic;">暂无值班纪事</div>
            </div>
            <div style="margin-bottom:10px;">
              <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:6px;font-weight:600;">🔍 巡检任务({{ p.tasks.done }}/{{ p.tasks.total }})</div>
              <div v-if="p.tasks.allList && p.tasks.allList.length > 0" class="task-list-mini">
                <div class="task-item-mini" v-for="(t, idx) in p.tasks.allList" :key="idx">
                  <span class="task-check-icon">{{ t.has_abnormal ? '🚨' : (t.status === 'completed' || t.status === 'abnormal' ? '✅' : '⬜') }}</span>
                  <span class="task-name-mini" :style="t.has_abnormal ? 'color:#e53935;font-weight:600' : ''">{{ t.device_name }}</span>
                  <span class="task-location-mini" :style="t.has_abnormal ? 'color:#e53935' : ''">{{ t.plan_name }}<span v-if="t.abnormal_desc"> · {{ t.abnormal_desc }}</span></span>
                </div>
              </div>
              <div v-else style="color:rgba(255,255,255,0.4);font-style:italic;font-size:13px;">暂无巡检任务</div>
            </div>
            <div>
              <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:6px;font-weight:600;">📋 工单({{ p.workorders.created.length }})</div>
              <div v-if="p.workorders.created && p.workorders.created.length > 0" class="task-list-mini">
                <div class="task-item-mini" v-for="(w, idx) in p.workorders.created.slice(0, 10)" :key="idx" :style="['completed','closed','self_resolved'].includes(w.status) ? 'opacity:0.6' : ''">
                  <span class="task-check-icon">{{ statusIcon(w.status) }}</span>
                  <span class="task-name-mini" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" :style="['completed','closed','self_resolved'].includes(w.status) ? 'text-decoration:line-through;color:rgba(255,255,255,0.5)' : ['pending','to_maintenance','processing','delay','returned'].includes(w.status) ? 'color:#e53935;font-weight:600' : ''">{{ w.content }}</span>
                  <div class="wo-meta-mini">
                    <span class="wo-type-mini" :class="w.type && w.type.includes('问题') ? 'type-problem' : 'type-maintenance'">{{ w.type && w.type.includes('问题') ? '问题' : '维修' }}</span>
                    <span class="wo-status-mini" :class="'status-'+w.status">{{ statusLabel(w.status, w.type) }}</span>
                  </div>
                </div>
              </div>
              <div v-else style="color:rgba(255,255,255,0.4);font-style:italic;font-size:13px;">暂无工单</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 待接班提示 -->
    <div v-if="handoverStatus === 'pending' && lastHandover" class="pending-hint" style="display:flex;flex-direction:column;gap:8px;padding:12px 18px;background:rgba(250,140,22,0.12);border:1px solid rgba(250,140,22,0.3);border-left:3px solid #fa8c16;border-radius:6px;margin:0 32px 12px;">
      <!-- 第1行: 班次信息 -->
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:18px;">⏳</span>
        <div style="flex:1;line-height:1.4;">
          <div style="font-size:15px;font-weight:600;color:#fa8c16;">待 {{ lastHandover.taking_over_role || lastHandover.taking_over_user || '某人' }} 接班</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:2px;">
            {{ lastHandover.handing_over_member || lastHandover.handing_over_user }} ({{ lastHandover.handing_over_role }}) 交班 · {{ lastHandover.shift_type }} {{ lastHandover.team }} · {{ formatTime(lastHandover.handover_time) }}
          </div>
          <div v-if="lastHandover.notes" style="font-size:12px;color:rgba(255,255,255,0.55);margin-top:4px;white-space:pre-wrap;">📝 {{ lastHandover.notes }}</div>
        </div>
      </div>
      <!-- 第2行: 接班选择 + 确认按钮 -->
      <div v-if="canTakeover" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:4px 0;">
        <div style="display:flex;align-items:center;gap:6px;">
          <label style="font-size:13px;color:rgba(255,255,255,0.8);">班组：</label>
          <select v-model="selectedNewTeam" style="padding:4px 8px;background:#1a3550;color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:4px;min-width:80px;">
            <option v-for="t in teams" :key="'np-'+t" :value="t" style="background:#1a3550;color:#fff;">{{ t }}</option>
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <label style="font-size:13px;color:rgba(255,255,255,0.8);">接班人：</label>
          <select v-model="selectedNewMember" style="padding:4px 8px;background:#1a3550;color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:4px;min-width:120px;">
            <option value="" style="background:#1a3550;color:#fff;">请选择</option>
            <option v-for="m in filteredNewMembers" :key="'nm-'+m.team_name+'-'+m.name" :value="m.name" style="background:#1a3550;color:#fff;">{{ m.name }}{{ m.team_name ? ' · ' + m.team_name : '' }}</option>
          </select>
        </div>
        <button @click="onTakeoverClick" :disabled="!canTakeover || !selectedNewMember" :style="(!canTakeover || !selectedNewMember) ? 'padding:6px 14px;background:rgba(45,212,191,0.25);color:rgba(255,255,255,0.4);border:none;border-radius:4px;cursor:not-allowed;font-weight:600;margin-left:auto;font-size:13px;' : 'padding:6px 14px;background:#2dd4bf;color:#0f2d4a;border:none;border-radius:4px;cursor:pointer;font-weight:600;margin-left:auto;font-size:13px;'">✅ 确认接班 ({{ selectedNewMember || '未选择' }})</button>
      </div>
    </div>

    <!-- 交班确认弹窗 -->
    <div v-if="handoverModalVisible" class="modal-backdrop" @click.self="handoverModalVisible = false" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;">
      <div class="modal-box" style="background:#0f2d4a;border:1px solid rgba(45,212,191,0.3);border-radius:8px;padding:24px;min-width:420px;max-width:560px;color:#fff;">
        <h3 style="margin:0 0 16px;font-size:18px;color:#2dd4bf;">🔁 交班确认</h3>
        <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:14px 18px;margin-bottom:16px;">
          <div style="font-size:14px;font-weight:600;color:rgba(255,255,255,0.85);margin-bottom:10px;">本班次状态检查：</div>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:14px;">
            <div>• 值班纪事：<span :style="notesCount > 0 ? 'color:rgba(255,255,255,0.7);' : 'color:#fa8c16;'">{{ notesCount > 0 ? '已填 ' + notesCount + ' 条' : '未填' }}</span></div>
            <div>• 巡检任务：<span :style="tasksReady ? 'color:#4ade80;' : 'color:#fa8c16;'">{{ currentShiftTasks.done }} / {{ currentShiftTasks.total }} 完成{{ currentShiftTasks.abnormal > 0 ? ' (含 ' + currentShiftTasks.abnormal + ' 异常)' : '' }}</span></div>
            <div>• 工单情况：<span :style="workordersReady ? 'color:#4ade80;' : 'color:#fa8c16;'">完成 {{ currentShiftWorkorders.completed.length }} /  进行中 {{ currentShiftWorkorders.inProgress.length + (currentShiftWorkorders.inherited || []).length }}{{ (currentShiftWorkorders.inherited || []).length > 0 ? ' (含 ' + currentShiftWorkorders.inherited.length + ' 继承)' : '' }}</span></div>
          </div>
        </div>
        <div v-if="!allReady" style="background:rgba(250,140,22,0.15);border:1px solid rgba(250,140,22,0.4);border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#fa8c16;">
          ⚠️ 有未完成项。交班后未完成项会自动继承给下一班继续处理。
        </div>
        <div v-else style="background:rgba(74,222,128,0.15);border:1px solid rgba(74,222,128,0.4);border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#4ade80;">
          ✓ 所有项目已完成, 可以交班。
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button @click="handoverModalVisible = false" style="padding:8px 18px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:4px;cursor:pointer;">取消</button>
          <button @click="submitHandover" style="padding:8px 18px;background:#2dd4bf;color:#0f2d4a;border:none;border-radius:4px;cursor:pointer;font-weight:600;">确认交班</button>
        </div>
      </div>
    </div>

    <!-- 接班确认弹窗 -->
    <div v-if="takeoverModalVisible" class="modal-backdrop" @click.self="takeoverModalVisible = false" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;">
      <div class="modal-box" style="background:#0f2d4a;border:1px solid rgba(45,212,191,0.3);border-radius:8px;padding:24px;min-width:420px;max-width:560px;color:#fff;">
        <h3 style="margin:0 0 16px;font-size:18px;color:#2dd4bf;">✅ 接班确认</h3>
        <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:14px 18px;margin-bottom:16px;">
          <div style="font-size:14px;font-weight:600;color:rgba(255,255,255,0.85);margin-bottom:10px;">即将接管：</div>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:14px;">
            <div>• 岗位：<span style="color:#2dd4bf;">{{ currentUser?.role || '-' }}</span></div>
            <div>• 接班班组：<span style="color:#2dd4bf;">{{ selectedNewTeam }}</span></div>
            <div>• 接班人：<span style="color:#2dd4bf;">{{ selectedNewMember }}</span></div>
            <div v-if="lastHandover">• 班次：<span style="color:#2dd4bf;">{{ lastHandover.shift_type }}</span></div>
          </div>
        </div>
        <div v-if="(currentShiftWorkorders.inherited || []).length > 0 || currentShiftWorkorders.inProgress.length > 0" style="background:rgba(96,165,250,0.15);border:1px solid rgba(96,165,250,0.4);border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#60a5fa;">
          ℹ️ 接管后将自动继承 {{ currentShiftWorkorders.inherited?.length || 0 }} 条滚动工单 + {{ currentShiftWorkorders.inProgress.length }} 条进行中工单
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button @click="takeoverModalVisible = false" style="padding:8px 18px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:4px;cursor:pointer;">取消</button>
          <button @click="confirmTakeover" style="padding:8px 18px;background:#2dd4bf;color:#0f2d4a;border:none;border-radius:4px;cursor:pointer;font-weight:600;">确认接班</button>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div style="padding: 0 32px;">
      <!-- 上一班交接信息 -->
      <div v-if="lastHandover && handoverStatus !== 'pending' && !['系统管理人', '带班', '厂长'].includes(currentUser?.role || '')" class="info-card" style="margin-top: 20px;">
        <div class="card-header">
          <h3 class="card-title">上一班交接信息</h3>
          <span class="card-tag" :class="lastHandover.status === 'completed' ? 'tag-done' : 'tag-wait'">
            {{ lastHandover.status === 'completed' ? '已完成' : '待接班' }}
          </span>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">交班人</span>
            <span class="info-value">{{ lastHandover.handing_over_user }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">角色</span>
            <span class="info-value">{{ lastHandover.handing_over_role }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">班次</span>
            <span class="info-value">{{ lastHandover.shift_type }} · {{ lastHandover.team }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">交接时间</span>
            <span class="info-value">{{ formatTime(lastHandover.handover_time) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">任务状态</span>
            <span class="info-value" :class="lastHandover.tasks_status === 'completed' ? 'text-green' : 'text-orange'">
              {{ lastHandover.tasks_status === 'completed' ? '已完成' : '未完成' }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">工单状态</span>
            <span class="info-value" :class="lastHandover.workorders_status === 'completed' ? 'text-green' : 'text-orange'">
              {{ lastHandover.workorders_status === 'completed' ? '已完成' : '未完成' }}
            </span>
          </div>
        </div>
        <div v-if="lastHandover.notes" class="info-notes">
          <span class="info-label">值班纪事：</span>
          <div class="notes-box">{{ lastHandover.notes }}</div>
        </div>
        <div v-if="lastHandover.workorders && lastHandover.workorders.length > 0" class="info-workorders">
          <span class="info-label">上时段工单：</span>
          <div class="wo-list">
            <div v-for="wo in lastHandover.workorders" :key="wo.id" class="wo-item" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(255,255,255,0.05);border-radius:4px;margin-bottom:6px;font-size:14px;">
              <span class="wo-type-tag" style="padding:3px 10px;border-radius:3px;font-size:12px;font-weight:600;background:rgba(45,212,191,0.2);color:#2dd4bf;">{{ wo.type }}</span>
              <span class="wo-content" style="flex:1;color:rgba(255,255,255,0.95);">{{ wo.content || wo.id }}</span>
              <span class="wo-status" :class="'status-' + wo.status" style="padding:3px 10px;border-radius:3px;font-size:12px;font-weight:500;background:rgba(96,165,250,0.2);color:#60a5fa;">{{ wo.status }}</span>
            </div>
          </div>
        </div>

        <!-- 上一班巡检任务 (带统计 + 点击展开) -->
        <div style="margin-top:15px;margin-bottom:16px;">
          <div class="collapse-header" @click="lastTasksExpanded = !lastTasksExpanded" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(255,255,255,0.05);border-radius:6px;cursor:pointer;">
            <span style="font-size:15px;font-weight:600;color:rgba(255,255,255,0.95);">🔍 上一班巡检任务</span>
            <span :class="lastShiftTasks.done >= lastShiftTasks.total && lastShiftTasks.total > 0 ? 'text-green' : 'text-orange'" style="font-size:14px;font-weight:600;">
              {{ lastShiftTasks.done }}/{{ lastShiftTasks.total }} 完成
              <span v-if="lastShiftTasks.abnormal > 0" style="color:#e53935;"> · {{ lastShiftTasks.abnormal }}异常</span>
              <span style="margin-left:6px;color:rgba(255,255,255,0.5);">{{ lastTasksExpanded ? '▼' : '▶' }}</span>
            </span>
          </div>
          <div v-if="lastTasksExpanded" class="collapse-body" style="margin-top:8px;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:6px;max-height:300px;overflow-y:auto;">
            <div v-if="lastShiftTasks.allList.length === 0" style="color:rgba(255,255,255,0.45);font-style:italic;font-size:14px;padding:8px 0;">暂无巡检任务</div>
            <div v-else>
              <div v-for="(item, idx) in lastShiftTasks.allList" :key="idx" class="task-item-mini" style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:14px;">
                <span class="task-check-icon">{{ item.has_abnormal ? '🚨' : (item.status === 'completed' || item.status === 'abnormal' ? '✅' : '⬜') }}</span>
                <span :style="item.has_abnormal ? 'color:#e53935;font-weight:600' : ''">{{ item.device_name }}</span>
                <span style="color:rgba(255,255,255,0.5);font-size:13px;">{{ item.plan_name }}<span v-if="item.abnormal_desc"> · {{ item.abnormal_desc }}</span></span>
              </div>
            </div>
          </div>
        </div>

        <!-- 上一班工单情况 (带统计 + 点击展开) -->
        <div style="margin-bottom:16px;">
          <div class="collapse-header" @click="lastWorkordersExpanded = !lastWorkordersExpanded" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(255,255,255,0.05);border-radius:6px;cursor:pointer;">
            <span style="font-size:15px;font-weight:600;color:rgba(255,255,255,0.95);">📋 上一班工单情况</span>
            <span style="font-size:14px;font-weight:600;">
              <span style="color:#60a5fa;">新建{{ lastShiftWorkorders.created.length }}</span>
              <span style="color:rgba(255,255,255,0.4);"> / </span>
              <span style="color:#4ade80;">完成{{ lastShiftWorkorders.completed.length }}</span>
              <span style="color:rgba(255,255,255,0.4);"> / </span>
              <span :class="lastShiftWorkorders.inProgress.length > 0 ? 'text-orange' : 'text-gray'">进行中{{ lastShiftWorkorders.inProgress.length }}</span>
              <span style="margin-left:6px;color:rgba(255,255,255,0.5);">{{ lastWorkordersExpanded ? '▼' : '▶' }}</span>
            </span>
          </div>
          <div v-if="lastWorkordersExpanded" class="collapse-body" style="margin-top:8px;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:6px;max-height:300px;overflow-y:auto;">
            <div v-if="lastShiftWorkorders.completed.length === 0 && lastShiftWorkorders.inProgress.length === 0 && lastShiftWorkorders.created.length === 0" style="color:rgba(255,255,255,0.45);font-style:italic;font-size:14px;padding:8px 0;">暂无工单</div>
            <div v-if="lastShiftWorkorders.completed.length > 0" style="margin-bottom:10px;">
              <div style="font-size:13px;color:rgba(255,255,255,0.65);margin-bottom:6px;font-weight:600;">✓ 已完成</div>
              <div v-for="wo in lastShiftWorkorders.completed" :key="'last-d-'+wo.id" class="task-item-mini" style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:14px;opacity:0.7;">
                <span class="task-check-icon">{{ statusIcon(wo.status) }}</span>
                <span class="wo-type-mini" :class="wo.type && wo.type.includes('问题') ? 'type-problem' : 'type-maintenance'">{{ wo.type && wo.type.includes('问题') ? '问题' : '维修' }}</span>
                <span style="flex:1;min-width:0;text-decoration:line-through;color:rgba(255,255,255,0.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ wo.content }}</span>
                <span class="wo-status" :class="'status-'+wo.status" style="padding:2px 8px;border-radius:2px;font-size:12px;font-weight:500;flex-shrink:0;">{{ statusLabel(wo.status, wo.type) }}</span>
              </div>
            </div>
            <div v-if="lastShiftWorkorders.inProgress.length > 0">
              <div style="font-size:13px;color:rgba(255,255,255,0.65);margin-bottom:6px;font-weight:600;">⏳ 进行中</div>
              <div v-for="wo in lastShiftWorkorders.inProgress" :key="'last-p-'+wo.id" class="task-item-mini" style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:14px;">
                <span class="task-check-icon">{{ statusIcon(wo.status) }}</span>
                <span class="wo-type-mini" :class="wo.type && wo.type.includes('问题') ? 'type-problem' : 'type-maintenance'">{{ wo.type && wo.type.includes('问题') ? '问题' : '维修' }}</span>
                <span style="flex:1;min-width:0;color:#e53935;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ wo.content }}</span>
                <span class="wo-status" :class="'status-'+wo.status" style="padding:2px 8px;border-radius:2px;font-size:12px;font-weight:500;flex-shrink:0;">{{ statusLabel(wo.status, wo.type) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 当前班组事务 (完整版: 班组信息 + 值班纪事 + 巡检任务 + 工单情况) -->
      <div v-if="currentUser?.role !== '系统管理人'" class="handover-form-card" style="margin-top: 20px;">
        <div class="card-header">
          <h3 class="card-title">当前班组事务</h3>
        </div>
        <div class="form-section">
          <!-- 当前班组信息摘要 (5列) -->
          <div class="duty-info-row" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:14px 16px;background:rgba(45,212,191,0.08);border:1px solid rgba(45,212,191,0.25);border-radius:6px;margin-bottom:18px;">
            <div class="duty-info-item">
              <div class="duty-label" style="font-size:13px;color:rgba(255,255,255,0.65);margin-bottom:6px;">班组</div>
              <div class="duty-value" style="font-size:17px;color:#2dd4bf;font-weight:600;">{{ currentShift?.team || currentUser.team || 'A班' }}</div>
            </div>
            <div class="duty-info-item">
              <div class="duty-label" style="font-size:13px;color:rgba(255,255,255,0.65);margin-bottom:6px;">岗位</div>
              <div class="duty-value" style="font-size:17px;color:#2dd4bf;font-weight:600;">{{ currentShift?.role || currentUser.role }}</div>
            </div>
            <div class="duty-info-item">
              <div class="duty-label" style="font-size:13px;color:rgba(255,255,255,0.65);margin-bottom:6px;">岗位人员</div>
              <div class="duty-value" style="font-size:17px;color:#2dd4bf;font-weight:600;">{{ currentShift?.member_name || currentUser.member_name || currentUser.name }}</div>
            </div>
            <div class="duty-info-item">
              <div class="duty-label" style="font-size:13px;color:rgba(255,255,255,0.65);margin-bottom:6px;">班次</div>
              <div class="duty-value" style="font-size:17px;color:#2dd4bf;font-weight:600;">{{ currentShift?.shift_type || currentShiftType }}</div>
            </div>
            <div class="duty-info-item">
              <div class="duty-label" style="font-size:13px;color:rgba(255,255,255,0.65);margin-bottom:6px;">接班状态</div>
              <div class="duty-value" :class="currentShift ? 'text-green' : 'text-orange'" style="font-size:17px;font-weight:600;">{{ currentShift ? '已接班' : '未接班' }}</div>
            </div>
          </div>

          <!-- 值班纪事 -->
          <div class="form-row" style="margin-bottom:16px;">
            <label class="form-label" style="font-size:16px;font-weight:600;color:rgba(255,255,255,0.95);">📝 值班纪事</label>
            <div class="notes-editor" style="margin-top:8px;">
              <div v-for="(note, idx) in handoverNoteLines" :key="idx" class="note-line-row" style="display:flex;gap:6px;margin-bottom:6px;">
                <input v-model="handoverNoteLines[idx]" class="note-line-input" :disabled="!amIOnShift" :placeholder="'第' + (idx+1) + '条记录...'" @keydown.enter.prevent="addNoteLine(idx)" style="flex:1;padding:10px 14px;background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:4px;font-size:15px;" />
                <button v-if="amIOnShift" class="note-del-btn" @click="removeNoteLine(idx)" title="删除此行" style="padding:0 10px;background:rgba(239,68,68,0.2);color:#ef4444;border:none;border-radius:4px;cursor:pointer;font-size:16px;">×</button>
              </div>
              <button v-if="amIOnShift" class="note-add-btn" @click="addNoteLine(-1)" style="padding:6px 14px;background:rgba(45,212,191,0.15);color:#2dd4bf;border:1px dashed rgba(45,212,191,0.4);border-radius:4px;cursor:pointer;font-size:14px;">+ 添加行</button>
            </div>
          </div>

          <!-- 巡检任务 (带统计 + 点击展开) -->
          <div style="margin-bottom:16px;">
            <div class="collapse-header" @click="currentTasksExpanded = !currentTasksExpanded" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(255,255,255,0.05);border-radius:6px;cursor:pointer;">
              <span style="font-size:15px;font-weight:600;color:rgba(255,255,255,0.95);">🔍 巡检任务</span>
              <span :class="currentShiftTasks.done >= currentShiftTasks.total && currentShiftTasks.total > 0 ? 'text-green' : 'text-orange'" style="font-size:14px;font-weight:600;">
                {{ currentShiftTasks.done }}/{{ currentShiftTasks.total }} 完成
                <span v-if="currentShiftTasks.abnormal > 0" style="color:#e53935;"> · {{ currentShiftTasks.abnormal }}异常</span>
                <span style="margin-left:6px;color:rgba(255,255,255,0.5);">{{ currentTasksExpanded ? '▼' : '▶' }}</span>
              </span>
            </div>
            <div v-if="currentTasksExpanded" class="collapse-body" style="margin-top:8px;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:6px;max-height:300px;overflow-y:auto;">
              <div v-if="currentShiftTasks.allList.length === 0" style="color:rgba(255,255,255,0.45);font-style:italic;font-size:14px;padding:8px 0;">暂无巡检任务</div>
              <div v-else>
                <div v-for="(item, idx) in currentShiftTasks.allList" :key="idx" class="task-item-mini" style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:14px;">
                  <span class="task-check-icon">{{ item.has_abnormal ? '🚨' : (item.status === 'completed' || item.status === 'abnormal' ? '✅' : '⬜') }}</span>
                  <span :style="item.has_abnormal ? 'color:#e53935;font-weight:600' : ''">{{ item.device_name }}</span>
                  <span style="color:rgba(255,255,255,0.5);font-size:13px;">{{ item.plan_name }}<span v-if="item.abnormal_desc"> · {{ item.abnormal_desc }}</span></span>
                </div>
              </div>
            </div>
          </div>

          <!-- 工单情况 (带统计 + 点击展开) -->
          <div style="margin-bottom:16px;">
            <div class="collapse-header" @click="currentWorkordersExpanded = !currentWorkordersExpanded" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(255,255,255,0.05);border-radius:6px;cursor:pointer;">
              <span style="font-size:15px;font-weight:600;color:rgba(255,255,255,0.95);">📋 工单情况</span>
              <span style="font-size:14px;font-weight:600;">
                <span style="color:#60a5fa;">新建{{ currentShiftWorkorders.created.length }}</span>
                <span style="color:rgba(255,255,255,0.4);"> / </span>
                <span style="color:#a78bfa;">滚动{{ (currentShiftWorkorders.inherited || []).length }}</span>
                <span style="color:rgba(255,255,255,0.4);"> / </span>
                <span style="color:#4ade80;">完成{{ currentShiftWorkorders.completed.length }}</span>
                <span style="color:rgba(255,255,255,0.4);"> / </span>
                <span :class="currentShiftWorkorders.inProgress.length > 0 ? 'text-orange' : 'text-gray'">进行中{{ currentShiftWorkorders.inProgress.length }}</span>
                <span style="margin-left:6px;color:rgba(255,255,255,0.5);">{{ currentWorkordersExpanded ? '▼' : '▶' }}</span>
              </span>
            </div>
            <div v-if="currentWorkordersExpanded" class="collapse-body" style="margin-top:8px;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:6px;max-height:300px;overflow-y:auto;">
              <div v-if="currentShiftWorkorders.completed.length === 0 && currentShiftWorkorders.inProgress.length === 0 && currentShiftWorkorders.created.length === 0 && (currentShiftWorkorders.inherited || []).length === 0" style="color:rgba(255,255,255,0.45);font-style:italic;font-size:14px;padding:8px 0;">暂无工单</div>
              <div v-if="(currentShiftWorkorders.inherited || []).length > 0" style="margin-bottom:10px;">
                <div style="font-size:13px;color:rgba(255,255,255,0.65);margin-bottom:6px;font-weight:600;">🔄 滚动工单（从上一班继承）</div>
                <div v-for="wo in currentShiftWorkorders.inherited" :key="'cur-i-'+wo.id" class="task-item-mini" style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:14px;">
                  <span class="task-check-icon">{{ statusIcon(wo.status) }}</span>
                  <span class="wo-type-mini" :class="wo.type && wo.type.includes('问题') ? 'type-problem' : 'type-maintenance'">{{ wo.type && wo.type.includes('问题') ? '问题' : '维修' }}</span>
                  <span style="flex:1;min-width:0;color:#a78bfa;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ wo.content }}</span>
                  <span class="wo-status" :class="'status-'+wo.status" style="padding:2px 8px;border-radius:2px;font-size:12px;font-weight:500;flex-shrink:0;">{{ statusLabel(wo.status, wo.type) }}</span>
                </div>
              </div>
              <div v-if="currentShiftWorkorders.completed.length > 0" style="margin-bottom:10px;">
                <div style="font-size:13px;color:rgba(255,255,255,0.65);margin-bottom:6px;font-weight:600;">✓ 已完成</div>
                <div v-for="wo in currentShiftWorkorders.completed" :key="'cur-d-'+wo.id" class="task-item-mini" style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:14px;opacity:0.7;">
                  <span class="task-check-icon">{{ statusIcon(wo.status) }}</span>
                  <span class="wo-type-mini" :class="wo.type && wo.type.includes('问题') ? 'type-problem' : 'type-maintenance'">{{ wo.type && wo.type.includes('问题') ? '问题' : '维修' }}</span>
                  <span style="flex:1;min-width:0;text-decoration:line-through;color:rgba(255,255,255,0.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ wo.content }}</span>
                  <span class="wo-status" :class="'status-'+wo.status" style="padding:2px 8px;border-radius:2px;font-size:12px;font-weight:500;flex-shrink:0;">{{ statusLabel(wo.status, wo.type) }}</span>
                </div>
              </div>
              <div v-if="currentShiftWorkorders.inProgress.length > 0">
                <div style="font-size:13px;color:rgba(255,255,255,0.65);margin-bottom:6px;font-weight:600;">⏳ 进行中</div>
                <div v-for="wo in currentShiftWorkorders.inProgress" :key="'cur-p-'+wo.id" class="task-item-mini" style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:14px;">
                  <span class="task-check-icon">{{ statusIcon(wo.status) }}</span>
                  <span class="wo-type-mini" :class="wo.type && wo.type.includes('问题') ? 'type-problem' : 'type-maintenance'">{{ wo.type && wo.type.includes('问题') ? '问题' : '维修' }}</span>
                  <span style="flex:1;min-width:0;color:#e53935;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ wo.content }}</span>
                  <span class="wo-status" :class="'status-'+wo.status" style="padding:2px 8px;border-radius:2px;font-size:12px;font-weight:500;flex-shrink:0;">{{ statusLabel(wo.status, wo.type) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部按钮区: 根据状态显示不同按钮 -->
          <div class="form-actions" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <!-- 未接班 (currentShift 为空 且 不是待接班): 显示接班处理 + 班组+人下拉 -->
            <template v-if="!currentShift && handoverStatus !== 'pending'">
              <label style="font-size:14px;color:rgba(255,255,255,0.85);">接班班组：</label>
              <select v-model="selectedNewTeam" style="padding:6px 10px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:4px;">
                <option v-for="t in teams" :key="'newt-'+t" :value="t">{{ t }}</option>
              </select>
              <label style="font-size:14px;color:rgba(255,255,255,0.85);">接班人：</label>
              <select v-model="selectedNewMember" style="padding:6px 10px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:4px;min-width:100px;">
                <option value="">请选择</option>
                <option v-for="m in filteredNewMembers" :key="'newm-'+m.team_name+'-'+m.name" :value="m.name">{{ m.name }}</option>
              </select>
              <button class="dm-btn dm-btn-primary" @click="onTakeoverClick" :disabled="!selectedNewMember" style="padding:8px 20px;background:#2dd4bf;color:#0f2d4a;border:none;border-radius:4px;cursor:pointer;font-weight:600;">✅ 接班处理</button>
            </template>
            <!-- 已接班: 显示保存 + 交班处理 -->
            <template v-else-if="amIOnShift">
              <button class="dm-btn" @click="saveNotes" style="padding:8px 20px;background:rgba(45,212,191,0.15);color:#2dd4bf;border:1px solid rgba(45,212,191,0.4);border-radius:4px;cursor:pointer;">💾 保存</button>
              <button class="dm-btn dm-btn-primary" @click="onHandoverClick" style="padding:8px 20px;background:#2dd4bf;color:#0f2d4a;border:none;border-radius:4px;cursor:pointer;font-weight:600;">🔁 交班处理</button>
            </template>
            <!-- 待接班: 只显示提示 (顶部 pending-hint 区域已有接班处理按钮) -->
            <template v-else-if="handoverStatus === 'pending'">
              <span style="color:rgba(255,255,255,0.6);font-size:14px;">⏳ 等待接班人点击顶部"接班处理"按钮</span>
            </template>
          </div>
        </div>
      </div>

      <!-- 交接历史 -->
      <div class="history-card" style="margin-top: 20px; margin-bottom: 32px;">
        <div class="card-header">
          <h3 class="card-title">交接历史</h3>
        </div>
        <!-- 筛选条 -->
        <div class="history-filters" style="padding:10px 16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:rgba(255,255,255,0.04);border-radius:6px;margin:0 16px 10px;font-size:12px;">
          <template v-if="isAdminViewer">
            <label style="color:rgba(255,255,255,0.6);">岗位</label>
            <select v-model="filterRole" class="filter-select" style="width:90px;padding:2px 6px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:3px;">
              <option value="">全部岗位</option>
              <option value="一期制水">一期制水</option>
              <option value="旧厂制水">旧厂制水</option>
              <option value="投药间值班">投药间值班</option>
              <option value="新低值班">新低值班</option>
              <option value="新高值班">新高值班</option>
              <option value="泥水车间">泥水车间</option>
              <option value="带班">带班</option>
            </select>
          </template>
          <label style="color:rgba(255,255,255,0.6);">交班班组</label>
          <select v-model="filterTeam" class="filter-select" style="width:70px;padding:2px 6px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:3px;">
            <option value="">全部</option>
            <option v-for="t in teams" :key="t" :value="t">{{ t }}</option>
          </select>
          <label style="color:rgba(255,255,255,0.6);">交班人</label>
          <select v-model="filterHandingOverUser" class="filter-select" style="width:100px;padding:2px 6px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:3px;" :disabled="!allTeamMembers.length">
            <option value="">全部</option>
            <option v-for="m in filteredHandingOverUsers" :key="'ho-'+m.team_name+'-'+m.member_name" :value="m.member_name">{{ m.member_name }}</option>
          </select>
          <label style="color:rgba(255,255,255,0.6);">接班班组</label>
          <select v-model="filterTakingOverTeam" class="filter-select" style="width:70px;padding:2px 6px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:3px;">
            <option value="">全部</option>
            <option v-for="t in teams" :key="t" :value="t">{{ t }}</option>
          </select>
          <label style="color:rgba(255,255,255,0.6);">接班人</label>
          <select v-model="filterTakingOverUser" class="filter-select" style="width:100px;padding:2px 6px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:3px;" :disabled="!allTeamMembers.length">
            <option value="">全部</option>
            <option v-for="m in filteredTakingOverUsers" :key="'to-'+m.team_name+'-'+m.member_name" :value="m.member_name">{{ m.member_name }}</option>
          </select>
          <label style="color:rgba(255,255,255,0.6);">班型</label>
          <select v-model="filterShift" class="filter-select" style="width:60px;padding:2px 6px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:3px;">
            <option value="">全部</option>
            <option value="日班">日班</option>
            <option value="夜班">夜班</option>
            <option value="早班">早班</option>
          </select>
          <label style="color:rgba(255,255,255,0.6);">起始</label>
          <input type="date" v-model="filterStart" class="filter-input" style="width:130px;padding:2px 6px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:3px;color-scheme:dark;" />
          <label style="color:rgba(255,255,255,0.6);">结束</label>
          <input type="date" v-model="filterEnd" class="filter-input" style="width:130px;padding:2px 6px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:3px;color-scheme:dark;" />
          <button class="dm-btn dm-btn-sm dm-btn-primary" @click="() => loadHistory()" style="padding:4px 10px;">🔍 查询</button>
          <button class="dm-btn dm-btn-sm" @click="resetFilters" style="padding:4px 10px;">重置</button>
        </div>
        <div v-if="!hasSearched" class="empty-state">
          <span class="empty-icon">🔍</span>
          <p>请选择筛选条件后点击 [🔍 查询] 加载交接历史</p>
        </div>
        <div v-else-if="history.length === 0" class="empty-state">
          <span class="empty-icon">📋</span>
          <p>该筛选条件下暂无交接记录</p>
        </div>

        <!-- 顶部信息条 (无按钮, 只显示范围) -->
        <div v-if="hasSearched && historyTotal > 0" class="history-info-bar">
          <span class="pager-info">显示{{ currentPageCount }}条，共{{ historyTotal }}条</span>
        </div>

        <!-- 历史记录列表 (B 单卡布局) -->
        <div v-if="hasSearched && history.length > 0" class="history-list history-list-b" style="padding:0 16px;">
          <div v-for="record in history" :key="'B-'+record.id" class="history-block-b" :class="{ 'expanded': expandedHistoryIds.includes(record.id) }" @click="toggleHistoryItem(record.id)">
            <div class="history-summary-b">
              <div class="hsb-row">
                <div class="hsb-time">{{ formatTime(record.handover_time) }} · {{ record.handing_over_role || '未知岗位' }}</div>
                <span class="card-tag" :class="record.status === 'completed' ? 'tag-done' : 'tag-wait'">{{ record.status === 'completed' ? '已完成' : '待接班' }}</span>
                <span class="hsb-toggle">{{ expandedHistoryIds.includes(record.id) ? '▼' : '▶' }}</span>
              </div>
              <div class="hsb-names">
                <span class="hsb-party">
                  <span class="hsb-team">{{ record.team || '?' }}</span>
                  <span class="hsb-sep">·</span>
                  <span class="hsb-member">{{ record.handing_over_member || record.handing_over_user }}</span>
                  <span class="hsb-action">交班</span>
                </span>
                <span class="hsb-arrow">→</span>
                <span v-if="record.status === 'completed' && record.taking_over_user" class="hsb-party">
                  <span class="hsb-team">{{ record.taking_over_team || '?' }}</span>
                  <span class="hsb-sep">·</span>
                  <span class="hsb-member">{{ record.taking_over_shift_member || record.taking_over_member || record.taking_over_user_name || '?' }}</span>
                  <span class="hsb-action">接班</span>
                </span>
                <span v-else class="hsb-pending">待接班</span>
              </div>
            </div>
            <transition name="slide-down">
              <div v-if="expandedHistoryIds.includes(record.id)" class="history-detail-b-wrap" @click.stop>
                <HistoryDetail :detail="historyDetails[record.id]" :loading="loadingDetails[record.id]" />
              </div>
            </transition>
          </div>
        </div>

        <!-- 底部翻页器 (带按钮) -->
        <div v-if="hasSearched && historyTotal > 0" class="history-pager history-pager-bottom">
          <button class="dm-btn dm-btn-sm" :disabled="historyPage <= 1" @click="() => goPage(1)" style="padding:4px 10px;">⏮ 首页</button>
          <button class="dm-btn dm-btn-sm" :disabled="historyPage <= 1" @click="() => goPage(historyPage - 1)" style="padding:4px 10px;">‹ 上一页</button>
          <span class="pager-current">第 {{ historyPage }} / {{ totalPages }} 页</span>
          <button class="dm-btn dm-btn-sm" :disabled="historyPage >= totalPages" @click="() => goPage(historyPage + 1)" style="padding:4px 10px;">下一页 ›</button>
          <button class="dm-btn dm-btn-sm" :disabled="historyPage >= totalPages" @click="() => goPage(totalPages)" style="padding:4px 10px;">末页 ⏭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import TopNavBar from '../components/TopNavBar.vue'
import HistoryDetail from '../components/HistoryDetail.vue'
import { currentUser, isOnDuty, setCurrentShiftContext } from '../composables/useDeviceStore'

const API_BASE = '/api/handover'

// 班组和班次
const teams = ['A班', 'B班', 'C班', 'D班']

// ========== 系统管理员/带班专属概览 ==========
const adminOverview = ref<any>(null)
const expandedAdminPositions = ref<Set<string>>(new Set())
const allShifts = ref<any[]>([])

const displayPositions = computed(() => {
  const all = adminOverview.value?.positions || []
  if (currentUser.value?.role === '带班') {
    return all.filter((p: any) => p.role !== '带班')
  }
  return all
})

const isAdminViewer = computed(() => ['系统管理人', '带班', '厂长'].includes(currentUser.value?.role || ''))

function toggleAdminPosition(role: string) {
  if (expandedAdminPositions.value.has(role)) expandedAdminPositions.value.delete(role)
  else expandedAdminPositions.value.add(role)
  expandedAdminPositions.value = new Set(expandedAdminPositions.value)
}

async function loadAdminOverview() {
  if (!currentUser.value || !['系统管理人', '带班', '厂长'].includes(currentUser.value.role)) return
  try {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const res = await fetch(`${API_BASE}/admin-overview?role=${encodeURIComponent(currentUser.value.role)}&date=${today}`)
    if (res.ok) adminOverview.value = await res.json()
  } catch (err) { console.error('加载管理员概览失败', err) }
}

// 状态
const currentShiftType = ref('日班')
const currentShift = ref<any>(null)
const amIOnShift = computed(() => currentShift.value && currentShift.value.user_name === currentUser.value?.name)
const currentTeam = ref('A班')
const selectedTeam = ref('A班')
const handoverNotes = ref('')
const handoverNoteLines = ref<string[]>([''])
const handoverStatus = ref<'idle' | 'pending' | 'completed'>('idle')

function addNoteLine(afterIdx: number) {
  handoverNoteLines.value.splice(afterIdx + 1, 0, '')
}
function removeNoteLine(idx: number) {
  if (handoverNoteLines.value.length > 1) {
    handoverNoteLines.value.splice(idx, 1)
  }
}
function buildNotesFromLines(): string {
  return handoverNoteLines.value.filter(l => l.trim()).join('\n')
}
function parseNotesToLines(notes: string): void {
  handoverNoteLines.value = notes ? notes.split('\n').filter((l: string) => l.trim()) : ['']
}
const lastHandover = ref<any>(null)
const lastShiftTasks = ref<{ total: number; done: number; abnormal: number; abnormalList: any[]; allList: any[] }>({ total: 0, done: 0, abnormal: 0, abnormalList: [], allList: [] })
const lastShiftWorkorders = ref<{ created: any[]; completed: any[]; inProgress: any[] }>({ created: [], completed: [], inProgress: [] })
const currentShiftTasks = ref<{ total: number; done: number; abnormal: number; abnormalList: any[]; allList: any[] }>({ total: 0, done: 0, abnormal: 0, abnormalList: [], allList: [] })
const currentShiftWorkorders = ref<{ created: any[]; completed: any[]; inProgress: any[]; inherited: any[] }>({ created: [], completed: [], inProgress: [], inherited: [] })
const lastDutyNotes = ref<any>(null)
const lastTasksExpanded = ref(false)
const lastWorkordersExpanded = ref(false)
const currentTasksExpanded = ref(false)
const currentWorkordersExpanded = ref(false)

// 接班人选 (不需账号, 只需选择谁在当前岗位上)
const newShiftMembers = ref<Array<{ name: string; leader_name?: string; team_name?: string }>>([])
const selectedNewMember = ref<string>('')
const selectedNewTeam = ref<string>('')  // 接班后归属班组

// 过滤后的接班人列表 (按所选班组, 优先用全量成员数据)
const filteredNewMembers = computed(() => {
  const list = allTeamMembers.value.length > 0
    ? allTeamMembers.value.map(m => ({ name: m.member_name, leader_name: m.leader_name, team_name: m.team_name }))
    : newShiftMembers.value
  if (!selectedNewTeam.value) return list
  return list.filter(m => m.team_name === selectedNewTeam.value)
})

// 加载该岗位的接班候选人 (从班组表中读, 可选对应班组的成员)
// 说明: loadAllTeamMembers 已经从 /api/shift-team-members/:team 拉了全量配置
// 这里只多取一个默认值 (用于兑底), 成员数据由 loadAllTeamMembers 提供
async function loadShiftTeamMembers() {
  try {
    const res = await fetch('/api/shift-teams')
    if (!res.ok) return
    const data = await res.json()
    // 仅用于兑底 (当 allTeamMembers 未加载完时)
    newShiftMembers.value = data
      .filter((m: any) => m.member_name)
      .map((m: any) => ({
        name: m.member_name,
        leader_name: m.leader_name,
        team_name: m.team_name
      }))
  } catch (err) {
    console.error('加载班组人员兑底数据失败', err)
  }
}

// ========== 历史筛选的班组人员下拉联动 ==========
// 加载所有班组的成员 (用于历史筛选下拉联动)
// 系统管理员班组配置的成员列表 → /api/shift-team-members/:teamName
const allTeamMembers = ref<Array<{ team_name: string; member_name: string; leader_name?: string }>>([])
async function loadAllTeamMembers() {
  try {
    // 1. 拿班组列表
    const teamsRes = await fetch('/api/shift-teams')
    if (!teamsRes.ok) return
    const teams = await teamsRes.json()
    // 2. 并行拿每个班的成员
    const promises = teams.map(async (t: any) => {
      try {
        const r = await fetch(`/api/shift-team-members/${encodeURIComponent(t.team_name)}`)
        if (!r.ok) return []
        const members = await r.json()
        return members
          .filter((m: any) => m.member_name)
          .map((m: any) => ({
            team_name: t.team_name,
            member_name: m.member_name,
            leader_name: t.leader_name || ''
          }))
      } catch {
        return []
      }
    })
    const all = await Promise.all(promises)
    allTeamMembers.value = all.flat()
  } catch (err) {
    console.error('加载所有班组人员失败', err)
  }
}

// 交班组联交班人 (按所选交班班组过滤)
const filteredHandingOverUsers = computed(() => {
  if (!filterTeam.value) {
    // 不选班组: 返回所有成员去重
    const seen = new Set<string>()
    return allTeamMembers.value.filter(m => {
      if (seen.has(m.member_name)) return false
      seen.add(m.member_name)
      return true
    })
  }
  return allTeamMembers.value.filter(m => m.team_name === filterTeam.value)
})

// 接班组联接班人 (按所选接班班组过滤)
const filteredTakingOverUsers = computed(() => {
  if (!filterTakingOverTeam.value) {
    const seen = new Set<string>()
    return allTeamMembers.value.filter(m => {
      if (seen.has(m.member_name)) return false
      seen.add(m.member_name)
      return true
    })
  }
  return allTeamMembers.value.filter(m => m.team_name === filterTakingOverTeam.value)
})

// 工单状态文本映射
function statusLabel(status: string, woType?: string): string {
  const map: Record<string, string> = {
    'pending': '未接单',
    'processing': '处理中',
    'completed': '已完成',
    'closed': '已关闭',
    'delay': '延期中',
    'returned': '已退回',
    'to_maintenance': '转维修',
    'self_resolved': '已自行解决'
  }
  return map[status] || status
}

function statusIcon(status: string): string {
  const iconMap: Record<string, string> = {
    'pending': '⏳',
    'processing': '🔧',
    'completed': '✅',
    'closed': '✅',
    'delay': '⏰',
    'returned': '🔙',
    'to_maintenance': '🔁',
    'self_resolved': '✅'
  }
  return iconMap[status] || '⬜'
}
const history = ref<any[]>([])
const historyTotal = ref(0)
const historyPage = ref(1)
const historyPageSize = 10
const hasSearched = ref(false)
const filterShift = ref('')
const filterTeam = ref('')
const filterUser = ref('')
const filterRole = ref('')
const filterHandingOverUser = ref('')
const filterTakingOverTeam = ref('')
const filterTakingOverUser = ref('')
const filterStart = ref('')
const filterEnd = ref('')

// 班组选择变化时, 清空对应的人选择
watch(filterTeam, () => { filterHandingOverUser.value = '' })
watch(filterTakingOverTeam, () => { filterTakingOverUser.value = '' })
const expandedHistoryIds = ref<number[]>([])
const historyDetails = ref<Record<number, any>>({})
const loadingDetails = ref<Record<number, boolean>>({})
const shiftTypes = [
  { type: '早班', start: '08:00', end: '16:00' },
  { type: '日班', start: '16:00', end: '23:00' },
  { type: '夜班', start: '23:00', end: '08:00' }
]

// 巡检/工单状态
const tasksTotal = ref(0)
const tasksDone = ref(0)
const workordersTotal = ref(0)
const workordersDone = ref(0)

// 计算属性
const tasksCompleted = computed(() => tasksDone.value >= tasksTotal.value && tasksTotal.value > 0)
const workordersCompleted = computed(() => workordersDone.value >= workordersTotal.value && workordersTotal.value > 0)

const currentShiftLabel = computed(() => {
  const now = new Date()
  return `${now.getMonth()+1}月${now.getDate()}日`
})

const canHandover = computed(() => {
  return tasksCompleted.value && workordersCompleted.value && selectedTeam.value
})

const canTakeover = computed(() => {
  return lastHandover.value &&
    (lastHandover.value.taking_over_user === currentUser.value?.name ||
     lastHandover.value.taking_over_role === currentUser.value?.role ||
     !lastHandover.value.taking_over_user)
})

// ========== 交班/接班 确认弹窗 ==========
const handoverModalVisible = ref(false)
const takeoverModalVisible = ref(false)

// 交班准备检查 (用于弹窗提示)
// 规则: 值班纪事可为空, 巡检任务如果有项目则不能为空
const notesCount = computed(() => handoverNoteLines.value.filter((l: string) => l.trim()).length)
const tasksReady = computed(() => {
  if (currentShiftTasks.value.total === 0) return true  // 没任务不卡
  return currentShiftTasks.value.done >= currentShiftTasks.value.total
})
const workordersReady = computed(() => {
  // 进行中工单交班后会自动继承, 不算不完成
  return true
})
const allReady = computed(() => tasksReady.value)  // 只检查巡检任务

// 点 "交班处理" 按钮 → 弹窗
function onHandoverClick() {
  handoverModalVisible.value = true
}
// 点 "接班处理" 按钮 → 弹窗
function onTakeoverClick() {
  if (!selectedNewMember.value) {
    alert('请选择接班人')
    return
  }
  takeoverModalVisible.value = true
}

// 班次配置 (从后端读取, loadData 时加载)
const shiftsConfig = ref<Array<{ name: string; start_time: string; end_time: string; cross_day: number; enabled: number }>>([])

// 判断当前应该哪个班在岗 (按 shift_config 表动态判断)
function getCurrentShiftAndTeam(): { shift: string; team: string } {
  const now = new Date()
  const curMin = now.getHours() * 60 + now.getMinutes() // 当前分钟数

  let shift = '早班' // fallback
  for (const s of shiftsConfig.value) {
    if (!s.enabled) continue
    const [sh, sm] = s.start_time.split(':').map(Number)
    const [eh, em] = s.end_time.split(':').map(Number)
    const startMin = sh * 60 + sm
    const endMin = eh * 60 + em
    if (s.cross_day) {
      // 跨天班: start <= now < 24h OR 0 <= now < end
      if (curMin >= startMin || curMin < endMin) { shift = s.name; break }
    } else {
      if (curMin >= startMin && curMin < endMin) { shift = s.name; break }
    }
  }

  // 简单轮转：按日期分配班组
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
  const roleIndex = ['系统管理人', '带班', '维修组', '值班岗位', '旧厂制水', '新低值班', '一期制水', '新高值班'].indexOf(currentUser.value?.role || '')
  const teamIndex = (dayOfYear + roleIndex) % 4
  const team = teams[teamIndex]

  return { shift, team }
}

// 加载数据
async function loadData() {
  if (!currentUser.value) return
  const role = currentUser.value.role

  // 并行加载: shift_config + status
  try {
    const [shiftRes, statusRes] = await Promise.all([
      fetch('/api/admin/shifts'),
      fetch(`${API_BASE}/status?role=${encodeURIComponent(role)}&userId=${currentUser.value.id}`)
    ])
    if (shiftRes.ok) {
      const sd = await shiftRes.json()
      shiftsConfig.value = (sd.rows || []).filter((r: any) => r.enabled).sort((a: any, b: any) => a.sort - b.sort)
    }
    const data = await statusRes.json()

    if (data.lastHandover) {
      lastHandover.value = data.lastHandover
      handoverStatus.value = data.lastHandover.status === 'pending' ? 'pending' : 'idle'
    }

    // 当前班次纪事编辑器: 优先用今天已保存的 duty_notes, 不要用上一班的
    if (data.currentDutyNotes && data.currentDutyNotes.notes) {
      parseNotesToLines(data.currentDutyNotes.notes)
    } else {
      handoverNoteLines.value = ['']
    }

    tasksTotal.value = data.tasksTotal || 0
    tasksDone.value = data.tasksDone || 0
    workordersTotal.value = data.workordersTotal || 0
    workordersDone.value = data.workordersDone || 0

    const { shift, team } = getCurrentShiftAndTeam()
    currentShiftType.value = shift
    currentTeam.value = team
    currentShift.value = data.currentShift

    // 上一班事务详情 (巡检任务 + 工单 + 纪事) - 仅值班岗位/带班需要
    if (data.lastShiftTasks) lastShiftTasks.value = data.lastShiftTasks
    if (data.lastShiftWorkorders) lastShiftWorkorders.value = data.lastShiftWorkorders
    if (data.lastDutyNotes) lastDutyNotes.value = data.lastDutyNotes
    // 当前班次事务详情 (巡检任务 + 工单) - 接班以来到现在
    if (data.currentShiftTasks) currentShiftTasks.value = data.currentShiftTasks
    if (data.currentShiftWorkorders) currentShiftWorkorders.value = data.currentShiftWorkorders

    // 系统管理员/带班: 加载专属概览
    if (['系统管理人', '带班', '厂长'].includes(currentUser.value?.role || '')) {
      await loadAdminOverview()
    }

    // 注意: 不再自动加载历史, 需要点查询才查
  } catch (err) {
    console.error('加载交接数据失败', err)
  }
}

// 交班 (弹窗确认后调用)
async function submitHandover() {
  // 关闭弹窗 (防重复点)
  handoverModalVisible.value = false
  if (!isOnDuty.value) { alert('非值班时间，无法交班'); return }
  // 使用 currentShift.team (实际值班班组), 兑底 selectedTeam
  const teamForHandover = currentShift.value?.team || selectedTeam.value
  if (!teamForHandover) {
    alert('请选择交班班组')
    return
  }
  try {
    const res = await fetch(`${API_BASE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handingOverUser: currentUser.value?.name,
        handingOverRole: currentUser.value?.role,
        shiftType: currentShiftType.value,
        team: teamForHandover,
        handoverTime: Date.now(),
        notes: buildNotesFromLines(),
        tasksStatus: tasksCompleted.value ? 'completed' : 'pending',
        workordersStatus: workordersCompleted.value ? 'completed' : 'pending'
      })
    })
    if (!res.ok) {
      // 拿后端详细错误信息
      const errBody = await res.json().catch(() => ({}))
      throw new Error(errBody.error || `HTTP ${res.status}`)
    }
    alert('交班成功')
    handoverStatus.value = 'pending'
    handoverNotes.value = ''
    handoverNoteLines.value = ['']
    // 交班成功后, 本班次结束, 清空 currentShift 让底部按钮区切换为'接班处理'状态
    currentShift.value = null
    // 同步清全局 currentShiftContext (右上角圆圈)
    setCurrentShiftContext(null)
    await loadData()
  } catch (err: any) {
    console.error('交班失败', err)
    alert('交班失败: ' + (err.message || '请重试'))
  }
}

// 保存值班纪事 (不交班, 仅保存)
async function saveNotes() {
  if (!amIOnShift.value) { alert('非值班时间,无法保存'); return }
  if (!currentShift.value) { alert('未接班,无法保存'); return }
  try {
    const res = await fetch(`${API_BASE}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team: currentShift.value.team,
        role: currentShift.value.role,
        shift_type: currentShift.value.shift_type,
        member_name: currentShift.value.member_name,
        date: new Date().toISOString().slice(0, 10),
        notes: buildNotesFromLines()
      })
    })
    if (!res.ok) throw new Error('保存失败')
    alert('保存成功')
  } catch (err) {
    console.error('保存失败', err)
    alert('保存失败, 请重试')
  }
}

// 接班
async function confirmTakeover() {
  if (!lastHandover.value) return
  if (!selectedNewMember.value) {
    alert('请选择接班人')
    return
  }
  try {
    const res = await fetch(`${API_BASE}/takeover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        takingOverUser: currentUser.value?.name,
        takingOverRole: currentUser.value?.role,
        takingOverMember: selectedNewMember.value,
        takingOverTeam: selectedNewTeam.value || lastHandover.value.team,
        handoverId: lastHandover.value.id,
        shiftStart: Date.now()
      })
    })
    if (!res.ok) throw new Error('接班失败')
    alert('接班成功，当前班次已开始')
    handoverStatus.value = 'completed'
    lastHandover.value = null
    // 更新全局 currentShiftContext: 右上角圆圈显示新接班人名字
    setCurrentShiftContext({
      team: selectedNewTeam.value || lastHandover.value?.team || currentUser.value?.team || '',
      member_name: selectedNewMember.value,
      shift_type: lastHandover.value?.shift_type || currentShiftType.value,
      role: currentUser.value?.role || '',
      leader_name: newShiftMembers.value.find(m => m.name === selectedNewMember.value)?.leader_name || ''
    })
    await loadData()
  } catch (err) {
    console.error('接班失败', err)
    alert('接班失败，请重试')
  }
}

// 格式化时间
function formatTime(timeStr: string): string {
  if (!timeStr) return '-'
  // 强制按北京时间 (Asia/Shanghai, UTC+8) 显示, 不受本地时区影响
  const d = new Date(timeStr)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

async function loadHistory(page = 1) {
  if (!currentUser.value) return
  const role = currentUser.value.role
  // 系统管理员/带班/厂长: 查全部 (不默认加 user 过滤)
  // 其他角色: 默认按个人名 (currentUser.member_name) 过滤
  // (handover_records.handing_over_user 存的是个人名, 不是岗位名)
  const isBroadViewer = ['系统管理人', '带班', '厂长'].includes(currentUser.value.role)
  const defaultUser = isBroadViewer ? '' : (currentUser.value.member_name || currentUser.value.name || '')
  const offset = (page - 1) * historyPageSize
  let url = `${API_BASE}/history?role=${encodeURIComponent(role)}&limit=${historyPageSize}&offset=${offset}&viewerRole=${encodeURIComponent(currentUser.value.role)}`
  if (isBroadViewer && filterRole.value) url += `&role=${encodeURIComponent(filterRole.value)}`
  if (filterShift.value) url += `&shift_type=${encodeURIComponent(filterShift.value)}`
  if (filterTeam.value) url += `&team=${encodeURIComponent(filterTeam.value)}`
  if (filterTakingOverTeam.value) url += `&taking_over_team=${encodeURIComponent(filterTakingOverTeam.value)}`
  if (filterUser.value) url += `&user=${encodeURIComponent(filterUser.value)}`
  if (filterHandingOverUser.value) url += `&handing_over_user=${encodeURIComponent(filterHandingOverUser.value)}`
  if (filterTakingOverUser.value) url += `&taking_over_user=${encodeURIComponent(filterTakingOverUser.value)}`
  if (filterStart.value) url += `&start_date=${encodeURIComponent(filterStart.value)}`
  if (filterEnd.value) url += `&end_date=${encodeURIComponent(filterEnd.value)}`
  if (!isBroadViewer && defaultUser && !filterUser.value) {
    url += `&user=${encodeURIComponent(defaultUser)}`
  }
  try {
    const res = await fetch(url)
    const data = await res.json()
    history.value = data.rows || []
    historyTotal.value = data.total || 0
    historyPage.value = page
    hasSearched.value = true
  } catch (err) {
    console.error('加载历史失败', err)
  }
}

const totalPages = computed(() => Math.max(1, Math.ceil(historyTotal.value / historyPageSize)))
const pageRange = computed(() => {
  const total = historyTotal.value
  if (total === 0) return '0 / 0'
  const start = (historyPage.value - 1) * historyPageSize + 1
  const end = Math.min(start + historyPageSize - 1, total)
  return `${start}-${end} / ${total}`
})
const currentPageCount = computed(() => {
  if (historyTotal.value === 0) return 0
  return Math.min(historyPageSize, historyTotal.value - (historyPage.value - 1) * historyPageSize)
})

function goPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  if (p === historyPage.value) return
  loadHistory(p)
}

function resetFilters() {
  filterShift.value = ''
  filterTeam.value = ''
  filterUser.value = ''
  filterRole.value = ''
  filterHandingOverUser.value = ''
  filterTakingOverTeam.value = ''
  filterTakingOverUser.value = ''
  filterStart.value = ''
  filterEnd.value = ''
  // 同步清空已查询到的结果 (点击重置 = 回到初始状态)
  history.value = []
  historyTotal.value = 0
  historyPage.value = 1
  historyDetails.value = {}
  expandedHistoryIds.value = []
  hasSearched.value = false
  // 重置后不自动查, 让用户重新点查询
}

async function toggleHistoryItem(id: number) {
  const idx = expandedHistoryIds.value.indexOf(id)
  if (idx >= 0) {
    expandedHistoryIds.value.splice(idx, 1)
  } else {
    expandedHistoryIds.value.push(id)
    // 按需加载详情
    if (!historyDetails.value[id] && !loadingDetails.value[id]) {
      loadingDetails.value[id] = true
      try {
        const res = await fetch(`${API_BASE}/history/${id}/detail`)
        if (res.ok) {
          const data = await res.json()
          historyDetails.value[id] = {
            // 后端 detail 接口把值班纪事放在 record.notes
            notes: (data.record && data.record.notes) || data.notes || data.duty_notes || '',
            tasks: data.tasks || { total: 0, done: 0, abnormal: 0, allList: [] },
            workorders: data.workorders || { created: [], completed: [], inProgress: [] }
          }
        }
      } catch (err) {
        console.error('加载历史详情失败', err)
      } finally {
        loadingDetails.value[id] = false
      }
    }
  }
}

onMounted(() => {
  loadData()
  loadShiftTeamMembers()
  loadAllTeamMembers()
  // 注意: 历史列表不自动加载, 需要点查询
})
</script>

<style scoped>
.handover-page {
  min-height: 100vh;
  background: #0f2d4a;
  padding: 0 0 40px;
}

.page-header {
  background: rgba(255,255,255,0.04);
  padding: 24px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header-left { display: flex; flex-direction: column; gap: 4px; }
.page-title { color: #fff; font-size: 22px; font-weight: 600; margin: 0; letter-spacing: 1px; }
.page-desc { color: rgba(255,255,255,0.75); font-size: 13px; }
.header-actions { display: flex; gap: 10px; align-items: center; }

.shift-badge, .team-badge {
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  background: rgba(45,212,191,0.15);
  color: #2dd4bf;
}

.status-cards-row {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 16px 24px;
  margin: 20px 32px;
}
.stat-card { display: flex; flex-direction: column; align-items: center; flex: 1; }
.stat-num { font-size: 28px; font-weight: 700; }
.stat-lbl { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 2px; }
.stat-sep { font-size: 22px; color: rgba(255,255,255,0.2); padding: 0 8px; }
.stat-green { color: #52c41a; }
.stat-orange { color: #fa8c16; }
.stat-gray { color: rgba(255,255,255,0.5); }

.pending-hint {
  display: flex;
  align-items: center;
  background: rgba(250,140,22,0.12);
  border: 1px solid rgba(250,140,22,0.3);
  border-radius: 10px;
  padding: 16px 20px;
  margin: 0 32px 16px;
  border-left: 4px solid #fa8c16;
}
.pending-hint-icon { font-size: 32px; margin-right: 16px; }
.pending-hint-info { flex: 1; }
.pending-hint-title { font-size: 16px; font-weight: 600; color: #fa8c16; }
.pending-hint-meta { font-size: 13px; color: rgba(255,255,255,0.5); margin-top: 4px; }
.pending-hint-notes { font-size: 13px; color: rgba(255,255,255,0.7); margin-top: 6px; background: rgba(255,255,255,0.08); padding: 8px; border-radius: 4px; }
.pending-hint-actions { margin-left: 20px; }

.info-card, .handover-form-card, .history-card {
  background: rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 20px 24px;
}
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.card-title { font-size: 18px; font-weight: 600; color: #fff; margin: 0; }
.card-tag {
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}
.tag-done { background: rgba(82,196,26,0.15); color: #52c41a; }
.tag-wait { background: rgba(250,173,20,0.15); color: #faad14; }

.info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px 16px; }
.info-item { display: flex; flex-direction: column; gap: 4px; }
.info-label { font-size: 14px; color: rgba(255,255,255,0.7); font-weight: 500; }
.info-value { font-size: 17px; font-weight: 600; color: rgba(255,255,255,1); }
.text-green { color: #4ade80; }
.text-orange { color: #fa8c16; }
.text-gray { color: rgba(255, 255, 255, 0.5); }

.info-notes { margin-top: 16px; }
.notes-box {
  background: rgba(255,255,255,0.06);
  border-radius: 6px;
  padding: 12px 16px;
  font-size: 15px;
  color: rgba(255,255,255,0.9);
  margin-top: 6px;
  line-height: 1.7;
}

.form-section {}
.form-row-inline { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.form-row { margin-bottom: 16px; }
.form-label { font-size: 16px; color: rgba(255,255,255,0.9); font-weight: 600; min-width: 70px; }
.notes-editor { display: flex; flex-direction: column; gap: 6px; }
.note-line-row { display: flex; align-items: center; gap: 6px; }
.note-line-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 6px;
  font-size: 15px;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.95);
  box-sizing: border-box;
}
.note-line-input:focus { border-color: #40a9ff; outline: none; }
.note-line-input:disabled { opacity: 0.5; cursor: not-allowed; }
.note-del-btn {
  width: 28px; height: 28px;
  border: none; border-radius: 50%;
  background: rgba(239,68,68,0.2); color: #ef4444;
  font-size: 18px; cursor: pointer; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.note-del-btn:hover { background: rgba(239,68,68,0.4); }
.note-add-btn {
  align-self: flex-start;
  padding: 6px 16px;
  border: 1px dashed rgba(45,212,191,0.4);
  border-radius: 6px;
  background: rgba(45,212,191,0.08);
  color: #2dd4bf; font-size: 13px; cursor: pointer;
  margin-top: 4px;
}
.note-add-btn:hover { background: rgba(45,212,191,0.15); }

.team-selector { display: flex; gap: 10px; }
.team-btn {
  padding: 6px 20px;
  border: 2px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  background: rgba(255,255,255,0.06);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255,255,255,0.7);
  transition: all 0.2s;
}
.team-btn.active {
  border-color: #2dd4bf;
  background: rgba(45,212,191,0.15);
  color: #2dd4bf;
}

.check-list { margin-bottom: 20px; }
.check-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
  margin-bottom: 8px;
  font-size: 14px;
  color: rgba(255,255,255,0.6);
}
.check-item.done { background: rgba(82,196,26,0.12); color: #52c41a; }
.check-icon { font-size: 18px; }
.check-text {}

.form-actions { margin-top: 10px; }

.dm-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}
.dm-btn-primary { background: #2DD4BF; color: #0a192f; font-weight: 600; }
.dm-btn-primary:hover { background: #5eead4; }
.dm-btn-primary:disabled { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.3); cursor: not-allowed; }
.dm-btn-confirm { background: #2DD4BF; color: #0a192f; font-weight: 600; }
.dm-btn-confirm:hover { background: #5eead4; }
.dm-btn-confirm:disabled { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.3); cursor: not-allowed; }

.empty-state { text-align: center; padding: 40px 0; color: rgba(255,255,255,0.4); }
.empty-icon { font-size: 48px; display: block; margin-bottom: 12px; }

/* ============================================
   布局 B: 单卡 (加大间距, summary + 详情同卡)
   ============================================ */
.history-list-b {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.history-block-b {
  background: rgba(15, 45, 74, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}
.history-block-b:hover {
  background: rgba(20, 60, 100, 0.7);
  border-color: rgba(45, 212, 191, 0.35);
}
.history-block-b.expanded {
  background: rgba(20, 60, 100, 0.75);
  border-color: rgba(45, 212, 191, 0.5);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}
.hsb-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.hsb-time {
  flex: 1;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.75);
  font-weight: 500;
}
.hsb-toggle {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
  font-weight: 600;
}
.hsb-names {
  font-size: 16px;
  color: rgba(255, 255, 255, 1);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hsb-arrow {
  margin: 0 8px;
  color: rgba(45, 212, 191, 0.8);
  font-weight: 600;
}
.hsb-party {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
}
.hsb-team {
  color: #2dd4bf;
  font-weight: 600;
  font-size: 15px;
}
.hsb-sep {
  color: rgba(255, 255, 255, 0.4);
  margin: 0 2px;
}
.hsb-member {
  color: rgba(255, 255, 255, 1);
  font-weight: 500;
  font-size: 15px;
}
.hsb-action {
  margin-left: 4px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 13px;
  font-weight: 400;
}
.hsb-pending {
  color: #fa8c16;
  font-weight: 600;
  font-size: 15px;
}
.history-detail-b-wrap {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

/* ============================================
   展开/收起动画
   ============================================ */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: max-height 0.3s ease, opacity 0.25s ease;
  overflow: hidden;
}
.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}
.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 1200px;
  opacity: 1;
}

/* ============================================
   翻页器
   ============================================ */
.history-info-bar {
  padding: 10px 16px;
  margin: 4px 16px 0;
  background: rgba(45, 212, 191, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 6px;
  text-align: right;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}
.history-info-bar .pager-info {
  color: rgba(255, 255, 255, 0.75);
}
.history-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 16px;
  margin: 12px 16px 0;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
}
.pager-info {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}
.pager-current {
  color: #2dd4bf;
  font-weight: 600;
  font-size: 14px;
  padding: 0 8px;
  min-width: 100px;
  text-align: center;
}
.history-pager .dm-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* ============================================
   工单类型标签颜色 (维修=蓝, 问题=橙)
   ============================================ */
.wo-type-mini {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}
.wo-type-mini.type-maintenance {
  background: rgba(96, 165, 250, 0.35);
  color: #93c5fd;
}
.wo-type-mini.type-problem {
  background: rgba(251, 146, 60, 0.35);
  color: #fdba74;
}

/* ============================================
   岗位卡 mini 列表 (巡检项/工单项) 统一字号
   ============================================ */
.task-item-mini {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}
.task-name-mini {
  font-size: 14px;
  font-weight: 500;
}
.task-location-mini {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
}
.wo-meta-mini {
  display: flex;
  gap: 6px;
  margin-left: 4px;
  font-size: 12px;
}
.wo-type-mini,
.wo-status-mini {
  padding: 2px 8px;
  border-radius: 2px;
  font-size: 12px;
  font-weight: 500;
}

/* 工单状态标签颜色 (状态与颜色一一对应, 适用 .wo-status 和 .wo-status-mini) */
.wo-status,
.wo-status-mini {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
}
.wo-status.status-completed,
.wo-status.status-closed,
.wo-status.status-self_resolved,
.wo-status-mini.status-completed,
.wo-status-mini.status-closed,
.wo-status-mini.status-self_resolved {
  background: rgba(74, 222, 128, 0.18);
  color: #4ade80;
}
.wo-status.status-processing,
.wo-status-mini.status-processing {
  background: rgba(45, 212, 191, 0.18);
  color: #2dd4bf;
}
.wo-status.status-delay,
.wo-status-mini.status-delay {
  background: rgba(250, 173, 20, 0.2);
  color: #faad14;
}
.wo-status.status-returned,
.wo-status-mini.status-returned {
  background: rgba(229, 57, 53, 0.2);
  color: #ff6b6b;
}
.wo-status.status-pending,
.wo-status-mini.status-pending {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
}
.wo-status.status-to_maintenance,
.wo-status-mini.status-to_maintenance {
  background: rgba(96, 165, 250, 0.2);
  color: #60a5fa;
}

/* ============================================
   下拉框深色修复 (修复白底不可见问题)
   ============================================ */
.history-filters select {
  color-scheme: dark;
}
.history-filters select option {
  background-color: #0f2d4a;
  color: #ffffff;
}
.history-filters select option:checked {
  background: linear-gradient(0deg, #2dd4bf 0%, #2dd4bf 100%);
  background-color: #14b8a6;
  color: #ffffff;
}

/* ============================================
   兼容旧类名 (防其它地方仍引用)
   ============================================ */
.history-list {}
.history-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.history-item:last-child { border-bottom: none; }
.history-time { font-size: 13px; color: rgba(255,255,255,0.45); width: 90px; flex-shrink: 0; }
.history-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.history-arrow { font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.85); }
.history-meta { font-size: 12px; color: rgba(255,255,255,0.45); }
</style>
