<template>
  <div class="ins-page">
    <TopNavBar />
    
    <!-- 页面标题区 -->
    <div class="ins-header">
      <div class="header-left">
        <h2 class="page-title">巡检保养</h2>
        <span class="page-date">{{ today }}</span>
      </div>
      <!-- 非管理员显示我的巡检统计 -->
      <div class="header-stats" v-if="currentUser?.role !== '系统管理人' && activeTab !== 'maintenance'">
        <div class="stat-pill stat-teal">
          <span class="stat-dot"></span>
          今日巡检 {{ myDoneCount }}/{{ myTasks.length }}
        </div>
        <div class="stat-pill stat-red">
          <span class="stat-dot"></span>
          有异常 {{ myAbnormalCount }}
        </div>
        <div class="stat-pill stat-orange">
          <span class="stat-dot"></span>
          待处理 {{ myPendingCount }}
        </div>
      </div>
      <!-- 管理员显示我的巡检统计 -->
      <div class="header-stats" v-else-if="activeTab !== 'maintenance'">
        <div class="stat-pill stat-teal">
          <span class="stat-dot"></span>
          今日巡检 {{ myDoneCount }}/{{ myTasks.length }}
        </div>
        <div class="stat-pill stat-red">
          <span class="stat-dot"></span>
          有异常 {{ myAbnormalCount }}
        </div>
        <div class="stat-pill stat-orange">
          <span class="stat-dot"></span>
          待处理 {{ myPendingCount }}
        </div>
      </div>
    </div>

    <!-- Tab 切换区 -->
    <div class="ins-tabs">
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'inspection' }"
        @click="activeTab = 'inspection'"
      >
        <span class="tab-icon">🔍</span>
        巡检计划
        <span class="tab-count">{{ myPendingCount }}</span>
      </button>
      <button 
        v-if="isAdmin"
        class="tab-btn" 
        :class="{ active: activeTab === 'maintenance' }"
        @click="activeTab = 'maintenance'"
      >
        <span class="tab-icon">🔧</span>
        保养计划管理
      </button>
    </div>

    <!-- 巡检计划内容 -->
    <div v-show="activeTab === 'inspection'" class="tab-content">
      <!-- 管理按钮（仅管理员可见） -->
      <div class="section-toolbar" v-if="isAdmin">
        <button class="btn-admin" @click="showAdminPanel = !showAdminPanel">
          {{ showAdminPanel ? '收起计划管理' : '⚙️ 管理巡检计划' }}
        </button>
      </div>

      <!-- 计划管理面板（仅管理员） -->
      <div v-if="showAdminPanel && isAdmin" class="admin-panel">
        <div class="admin-panel-header">
          <span class="admin-title">巡检计划管理</span>
          <button class="btn-create-plan" @click="showCreateDialog = true">+ 新建计划</button>
        </div>
        <div v-if="plans.length === 0" class="plans-empty">暂无巡检计划，请创建</div>
        <div v-for="plan in plans" :key="plan.id" class="plan-item">
          <div class="plan-item-info">
            <span class="plan-item-name">{{ plan.name }}</span>
            <span class="plan-item-meta">📍{{ plan.location }} 🔄{{ cycleLabel(plan.cycle) }} 👤{{ getExecutorNames(plan) }}</span>
          </div>
          <div class="plan-item-actions">
            <button class="btn-plan-edit" @click="editPlan(plan)">编辑</button>
            <button class="btn-plan-delete" @click="deletePlan(plan.id)">删除</button>
          </div>
        </div>
      </div>

      <!-- 进度条 -->
      <div class="progress-section">
        <div class="progress-info">
          <span class="progress-label">我的巡检任务</span>
          <span class="progress-value">{{ myTasks.filter(t => t.is_completed).length }}/{{ myTasks.length }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: (myTasks.length > 0 ? Math.round(myTasks.filter(t => t.is_completed).length / myTasks.length * 100) : 0) + '%' }"></div>
        </div>
      </div>

      <!-- 我的任务列表 -->
      <div class="device-list">
        <div v-if="myTasks.length === 0" class="plans-empty">暂无待执行的巡检任务</div>
        <div 
          v-for="task in myTasks" 
          :key="task.plan_id + '-' + task.device_id" 
          class="device-card"
          :class="task.is_completed ? 'done' : 'pending'"
          @click="task.is_completed ? null : executeTask(task)"
          :style="{ cursor: task.is_completed ? 'default' : 'pointer' }"
        >
          <div class="card-check" :class="task.is_completed ? (task.has_abnormal ? 'abnormal' : 'done') : 'pending'">
            <svg v-if="task.is_completed && !task.has_abnormal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <path d="M5 13l4 4L19 7"/>
            </svg>
            <svg v-if="task.has_abnormal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="card-body">
            <div class="card-name">{{ task.device_name }}</div>
            <div class="card-location">
              <span class="loc-icon">📍</span>
              {{ task.location }} · {{ task.plan_name }}
            </div>
            <div v-if="task.check_content" class="task-check-items">
              <span v-for="(item, idx) in task.check_content.split('\n').filter((l: string) => l.trim())" :key="idx" class="check-item-tag">{{ item }}</span>
            </div>
            <div v-if="!task.is_completed && task.remainingMs < Infinity" class="task-remaining" :class="task.remainingMs < 0 ? 'overdue' : task.remainingMs < 1800000 ? 'urgent' : ''">
              <span v-if="task.remainingMs < 0">已超时 {{ formatRemaining(-task.remainingMs) }}</span>
              <span v-else>剩余 {{ formatRemaining(task.remainingMs) }}</span>
            </div>
          </div>
          <div class="card-status" :class="task.is_completed ? (task.has_abnormal ? 'abnormal' : 'done') : 'pending'">
            {{ task.is_completed ? (task.has_abnormal ? '有异常' : '已完成') : '待执行' }}
          </div>
        </div>
      </div>
    </div>

    <!-- 新建/编辑计划弹窗 -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click.self="closeDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h3>{{ editingPlan ? '编辑巡检计划' : '新建巡检计划' }}</h3>
          <button class="dialog-close" @click="closeDialog">×</button>
        </div>
        <div class="dialog-body">
          <!-- 计划名称 + 执行人 -->
          <div class="form-row-two">
            <div class="form-col">
              <label>计划名称</label>
              <input v-model="planForm.name" type="text" placeholder="如：每日设备巡检" />
            </div>
            <div class="form-col">
              <label>执行角色</label>
              <select v-model="selectedRole" @change="selectedExecutorId = ''">
                <option value="">请选择角色</option>
                <option v-for="role in allRoles" :key="role" :value="role">{{ role }}</option>
              </select>
            </div>
            <div class="form-col">
              <label>选择执行人</label>
              <select v-model="selectedExecutorId" :disabled="!selectedRole">
                <option value="">请先选择角色</option>
                <option v-for="user in (usersByRole[selectedRole] || [])" :key="user.id" :value="user.id">{{ user.name }}</option>
              </select>
            </div>
          </div>
          <!-- 执行周期 -->
          <div class="form-row">
            <label>执行周期</label>
            <div class="cycle-options">
              <button v-for="opt in cycleOptions" :key="opt.value" class="cycle-btn" :class="{ active: planForm.cycle === opt.value }" @click="planForm.cycle = opt.value">{{ opt.label }}</button>
            </div>
            <div v-if="planForm.cycle === 'custom'" class="custom-times-wrap">
              <div class="custom-time-label">每日执行时间段：</div>
              <div v-for="(t, idx) in customTimes" :key="idx" class="custom-time-row">
                <input v-model="customTimes[idx].start" type="time" placeholder="开始时间" />
                <span class="time-sep">至</span>
                <input v-model="customTimes[idx].end" type="time" placeholder="结束时间" />
                <button class="btn-remove-time" @click="removeCustomTime(idx)">×</button>
              </div>
              <button class="btn-add-time" @click="addCustomTime">+ 添加时间段</button>
            </div>
          </div>
          <!-- 选择地点 -->
          <div class="form-row">
            <label>选择地点</label>
            <select v-model="planForm.location" @change="selectedDeviceIds = []">
              <option value="">请选择地点</option>
              <option v-for="loc in locations" :key="loc.id" :value="loc.name">{{ loc.name }}</option>
            </select>
          </div>
          <!-- 选择设备 -->
          <div class="form-row">
            <label>选择设备</label>
            <div class="device-selector">
              <div v-if="!planForm.location" class="selector-hint">请先选择地点</div>
              <div v-else class="available-devices">
                <div 
                  v-for="dev in filteredDevices" 
                  :key="dev.id" 
                  class="device-option" 
                  :class="{ selected: selectedDeviceIds.includes(dev.id) }"
                  @click="toggleDevice(dev)"
                >{{ dev.name }}</div>
              </div>
              <div v-if="selectedDeviceIds.length > 0" class="selected-count">已选 {{ selectedDeviceIds.length }} 台设备</div>
            </div>
          </div>
          <!-- 每台设备的巡检项 -->
          <div v-for="dev in selectedDevices" :key="dev.id" class="device-check-config">
            <div class="config-header">
              <span class="config-device">🖥️ {{ dev.name }}</span>
              <span class="config-location">📍 {{ dev.location }}</span>
            </div>
            <div class="config-items">
              <label>巡检内容（每行一项）：</label>
              <textarea 
                v-model="deviceCheckItems[dev.id]" 
                rows="4" 
                placeholder="每行一个检查项，例：
轴承温度是否正常
运行时是否有异响
密封是否完好"
              ></textarea>
              <div v-if="deviceCheckItems[dev.id]" class="check-items-preview">
                <span v-for="(item, i) in deviceCheckItems[dev.id].split('\n').filter((l: string) => l.trim())" :key="i" class="check-item-tag">{{ item }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-cancel" @click="closeDialog">取消</button>
          <button class="btn-confirm" @click="savePlan">{{ editingPlan ? '保存修改' : '创建计划' }}</button>
        </div>
      </div>
    </div>

    <!-- 巡检执行弹窗 -->
    <div v-if="showExecuteDialog" class="dialog-overlay" @click.self="showExecuteDialog = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>执行巡检</h3>
          <button class="dialog-close" @click="showExecuteDialog = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="execute-info">
            <div class="execute-device">{{ currentTask?.device_name }}</div>
            <div class="execute-plan">📍{{ currentTask?.location }} · {{ currentTask?.plan_name }}</div>
          </div>
          <div class="execute-checklist">
            <div v-for="(item, idx) in (currentTask?.check_content || '').split('\n').filter((l: string) => l.trim())" :key="idx" class="check-row">
              <div class="check-box-wrap">
                <input type="checkbox" v-model="checkedItems" :value="item" :id="'check-' + idx" class="check-input" />
                <label :for="'check-' + idx" class="check-label">{{ item }}</label>
              </div>
            </div>
          </div>
          <div class="abnormal-section">
            <label class="abnormal-label">
              <input type="checkbox" v-model="hasAbnormal" class="check-input" />
              <span>发现异常</span>
            </label>
            <textarea v-if="hasAbnormal" v-model="abnormalDesc" placeholder="描述异常情况..." rows="3"></textarea>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-cancel" @click="showExecuteDialog = false">取消</button>
          <button class="btn-confirm" @click="submitTaskResult">提交巡检结果</button>
        </div>
      </div>
    </div>

    <!-- 保养计划内容 -->
    <div v-show="activeTab === 'maintenance'" class="tab-content">
      <!-- 系统管理人：完整管理界面 -->
      <div v-if="isAdmin" class="maint-admin-wrapper">
        <div class="page-header" style="padding: 24px 32px 20px;">
          <div class="header-left">
            <h2 class="page-title">保养计划管理</h2>
            <span class="page-desc">制定设备保养计划，分派执行周期和负责人</span>
          </div>
          <div class="header-actions">
            <button class="btn-primary" @click="maintOpenCreate">+ 新建保养计划</button>
          </div>
        </div>

        <!-- 计划列表 -->
        <div style="padding: 0 32px;">
          <div v-if="maintPlans.length === 0" class="empty-state">
            <span class="empty-icon">🔧</span>
            <p>暂无保养计划，点击上方按钮创建</p>
          </div>

          <div v-for="plan in maintPlans" :key="plan.id" class="plan-card">
            <div class="plan-header">
              <div class="plan-info">
                <h3 class="plan-name">{{ plan.name }}</h3>
                <div class="plan-meta">
                  <span class="meta-tag">👤 {{ plan.executor_name || plan.executor_role }}</span>
                  <span class="meta-tag">🏷️ {{ plan.device_type }}</span>
                  <span class="meta-tag">🔄 {{ cycleCountLabel(plan.cycle_type, plan.cycle_value, plan.cycle_count) }}</span>
                  <span v-if="plan.has_third_party == 1" class="meta-tag">🔒 第三方维保</span>
                  <span v-if="plan.remainingMs != null" class="meta-tag" :class="plan.remainingMs < 0 ? 'tag-overdue' : 'tag-remaining'">{{ formatMaintRemaining(plan.remainingMs) }}</span>
                </div>
              </div>
              <div class="plan-actions">
                <button class="btn-edit" @click="maintEditPlan(plan)">编辑</button>
                <button class="btn-delete" @click="maintDeletePlan(plan.id)">删除</button>
              </div>
            </div>

            <!-- 执行情况统计 -->
            <div class="maint-stats-row">
              <div class="maint-stat-item">
                <span class="stat-num stat-green">{{ plan.doneCount || 0 }}</span>
                <span class="stat-lbl">已完成</span>
              </div>
              <div class="maint-stat-sep">/</div>
              <div class="maint-stat-item">
                <span class="stat-num stat-red">{{ plan.abnormalCount || 0 }}</span>
                <span class="stat-lbl">有异常</span>
              </div>
              <div class="maint-stat-sep">/</div>
              <div class="maint-stat-item">
                <span class="stat-num stat-cyan">{{ plan.totalCount || 0 }}</span>
                <span class="stat-lbl">总数</span>
              </div>
              <div class="maint-stat-expand" @click="toggleMaintDetail(plan.id)">
                <span>{{ expandedMaintPlan === plan.id ? '收起' : '查看详情' }}</span>
                <span class="expand-arrow">{{ expandedMaintPlan === plan.id ? '▲' : '▼' }}</span>
              </div>
            </div>

            <!-- 设备列表详情 -->
            <div v-if="expandedMaintPlan === plan.id" class="maint-detail-section">
              <div v-if="!maintRecords[plan.id]" class="detail-loading">加载中...</div>
              <div v-else class="detail-device-list">
                <div v-for="item in plan.items" :key="item.id" class="detail-device-item">
                  <div class="detail-device-header">
                    <div class="detail-device-name">🖥️ {{ item.device_name }}</div>
                    <div class="detail-device-tags">
                      <span v-if="getDeviceStatus(plan.id, item.device_name) === 'done'" class="detail-tag tag-done">✓ 已完成</span>
                      <span v-else-if="getDeviceStatus(plan.id, item.device_name) === 'abnormal'" class="detail-tag tag-abnormal">⚠ 有异常</span>
                      <span v-else class="detail-tag tag-pending">○ 待处理</span>
                    </div>
                  </div>
                  <div v-if="getDeviceRecord(plan.id, item.device_name)?.results" class="detail-check-list">
                    <div v-for="(check, ci) in (getDeviceRecord(plan.id, item.device_name)?.results || [])" :key="ci" class="detail-check-row">
                      <div class="check-dot dot-done"></div>
                      <span class="check-text">{{ check }}</span>
                    </div>
                  </div>
                  <div v-else-if="item.check_content" class="detail-check-list">
                    <div v-for="(check, ci) in item.check_content.split('\n').filter((c: string) => c.trim())" :key="ci" class="detail-check-row">
                      <div class="check-dot dot-pending"></div>
                      <span class="check-text">{{ check }}</span>
                    </div>
                  </div>
                  <div v-if="getDeviceRecord(plan.id, item.device_name)?.abnormal_desc" class="detail-abnormal-note">
                    <span class="abnormal-note-label">异常描述：</span>{{ getDeviceRecord(plan.id, item.device_name).abnormal_desc }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 非系统管理人：保养任务列表 -->
      <div v-if="!isAdmin" class="maint-admin-wrapper">
        <div class="page-header" style="padding: 24px 32px 20px;">
          <div class="header-left">
            <h2 class="page-title">保养任务</h2>
            <span class="page-desc">执行分配给您的设备保养任务</span>
          </div>
        </div>
        <div style="padding: 0 32px;">
          <div v-if="myMaintTasks.length === 0" class="empty-state">
            <span class="empty-icon">📋</span>
            <p>暂无待执行任务</p>
          </div>
          <div v-for="task in myMaintTasks" :key="task.id" class="plan-card" style="margin-bottom: 16px;">
            <div class="plan-header">
              <div class="plan-info">
                <h3 class="plan-name">{{ task.name }}</h3>
                <div class="plan-meta">
                  <span class="meta-tag">👤 {{ task.executor_name || '未分配' }}</span>
                  <span class="meta-tag">🏷️ {{ task.device_type }}</span>
                  <span v-if="task.remainingMs != null" class="meta-tag" :class="task.remainingMs < 0 ? 'tag-overdue' : 'tag-remaining'">
                    {{ task.remainingMs < 0 ? '已超时' : '剩余' }} {{ formatMaintRemaining(task.remainingMs) }}
                  </span>
                </div>
              </div>
              <div class="plan-actions">
                <button class="btn-edit" @click="toggleMaintTask(task.id)">{{ expandedMaintTask === task.id ? '收起' : '查看详情' }}</button>
                <button class="btn-primary" style="margin-left:8px;" @click="openMaintExecute(task)">执行保养</button>
              </div>
            </div>
            <div v-if="expandedMaintTask === task.id" class="maint-detail-section" style="padding: 0;">
              <div v-for="item in task.items" :key="item.id" class="detail-device-item">
                <div class="detail-device-header">
                  <div class="detail-device-name">🖥️ {{ item.device_name }}</div>
                  <div class="detail-device-tags">
                    <span class="detail-tag tag-pending">○ 待处理</span>
                  </div>
                </div>
                <div v-if="item.check_content" class="detail-check-list">
                  <div v-for="(check, ci) in item.check_content.split('\n').filter((c: string) => c.trim())" :key="ci" class="check-item">
                    <div class="check-dot dot-pending"></div>
                    <span class="check-text">{{ check }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 执行保养弹窗（仅非管理员） -->
      <div v-if="maintExecuteDialog" class="dialog-overlay" @click.self="maintExecuteDialog = false">
        <div class="dialog">
          <div class="dialog-header">
            <h3>执行保养</h3>
            <button class="dialog-close" @click="maintExecuteDialog = false">×</button>
          </div>
          <div class="dialog-body">
            <div class="execute-info">
              <div class="execute-device">{{ currentMaintTask?.name }}</div>
              <div class="execute-plan">📍{{ currentMaintTask?.device_type }}</div>
            </div>
            <div v-if="currentMaintTask?.items" class="execute-checklist">
              <div v-for="(item, idx) in currentMaintTask.items" :key="idx" class="detail-device-item">
                <div class="detail-device-header">
                  <div class="detail-device-name">🖥️ {{ item.device_name }}</div>
                </div>
                <div v-if="item.check_content" class="detail-check-list">
                  <div v-for="(check, ci) in item.check_content.split('\n').filter((c: string) => c.trim())" :key="ci" class="check-item">
                    <div class="check-box-wrap">
                      <input type="checkbox" v-model="maintCheckedItems" :value="check" :id="'mcheck-' + idx + '-' + ci" class="check-input" />
                      <label :for="'mcheck-' + idx + '-' + ci" class="check-label">{{ check }}</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="abnormal-section">
              <label class="abnormal-label">
                <input type="checkbox" v-model="maintHasAbnormal" class="check-input" />
                <span>发现异常</span>
              </label>
              <textarea v-if="maintHasAbnormal" v-model="maintAbnormalDesc" placeholder="描述异常情况..." rows="3"></textarea>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn-cancel" @click="maintExecuteDialog = false">取消</button>
            <button class="btn-confirm" @click="submitMaintResult">提交保养结果</button>
          </div>
        </div>
      </div>

      <!-- 新建/编辑弹窗（仅管理员） -->
      <div v-if="maintShowDialog && isAdmin" class="dialog-overlay" @click.self="maintCloseDialog">
        <div v-if="maintShowDialog" class="dialog-overlay" @click.self="maintCloseDialog">
          <div class="dialog">
            <div class="dialog-header">
              <h3>{{ maintEditingPlan ? '编辑保养计划' : '新建保养计划' }}</h3>
              <button class="dialog-close" @click="maintCloseDialog">×</button>
            </div>
            <div class="dialog-body">
              <div class="form-row">
                <label>计划名称 <span class="required">*</span></label>
                <input v-model="maintForm.name" type="text" placeholder="如：月度设备保养" />
              </div>
              <div class="form-row-two">
                <div class="form-col">
                  <label>执行角色 <span class="required">*</span></label>
                  <select v-model="maintSelectedRole" @change="maintSelectedExecutorId = ''">
                    <option value="">请选择角色</option>
                    <option v-for="role in maintAllRoles" :key="role" :value="role">{{ role }}</option>
                  </select>
                </div>
                <div class="form-col">
                  <label>选择执行人 <span class="required">*</span></label>
                  <select v-model="maintSelectedExecutorId" :disabled="!maintSelectedRole">
                    <option value="">请先选择角色</option>
                    <option v-for="user in (maintUsersByRole[maintSelectedRole] || [])" :key="user.id" :value="user.id">{{ user.name }}</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <label>设备类型 <span class="required">*</span></label>
                <select v-model="maintForm.device_type">
                  <option value="">请选择</option>
                  <option value="生产设备">生产设备</option>
                  <option value="特种设备">特种设备</option>
                </select>
              </div>
              <div class="form-row">
                <label>选择地点和设备 <span class="required">*</span></label>
                <div class="location-group-list">
                  <div v-for="(grp, gIdx) in maintLocationGroups" :key="gIdx" class="location-group">
                    <div class="grp-header">
                      <span class="grp-num">地点 {{ gIdx + 1 }}</span>
                      <button v-if="maintLocationGroups.length > 1" class="grp-remove" @click="maintRemoveLocationGroup(gIdx)">×</button>
                    </div>
                    <div class="grp-body">
                      <select v-model="grp.location" @change="maintOnGroupLocationChange(gIdx)" class="grp-location">
                        <option value="">请选择地点</option>
                        <option v-for="loc in maintAvailableLocations(gIdx)" :key="loc.id" :value="loc.name">{{ loc.name }}</option>
                      </select>
                      <div v-if="grp.location" class="device-selector">
                        <div class="available-devices">
                          <div v-for="dev in maintGetDevicesForLocation(grp.location)" :key="dev.id" class="device-option" :class="{ selected: grp.deviceIds.some((x: any) => x.id === dev.id) }" @click="maintToggleGroupDevice(gIdx, dev)">{{ dev.name }}</div>
                        </div>
                        <div v-if="grp.deviceIds.length > 0" class="selected-count">已选 {{ grp.deviceIds.length }} 台</div>
                        <div v-for="devObj in grp.deviceIds" :key="devObj.id" class="device-extra-item">
                          <div class="device-extra-toggle" @click="maintToggleDeviceExtra(gIdx, devObj.id)">
                            <span class="toggle-icon">{{ isDeviceExtraExpanded(gIdx, devObj.id) ? '▼' : '▶' }}</span>
                            <span class="toggle-label">为「{{ getDeviceName(devObj.id) }}」单独设置保养项目</span>
                          </div>
                          <div v-if="isDeviceExtraExpanded(gIdx, devObj.id)" class="device-extra-content">
                            <textarea
                              v-model="maintDeviceContent[devObj.id]"
                              rows="3"
                              :placeholder="'输入 ' + getDeviceName(devObj.id) + ' 的保养内容（每行一项）'"
                            ></textarea>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <button class="add-location-btn" @click="maintAddLocationGroup">
                  <span>+</span> 添加另一地点
                </button>
              </div>
              <div class="form-row">
                <label>保养内容（每行一项，全局）</label>
                <textarea v-model="maintForm.check_content" rows="3" placeholder="所有设备统一保养内容，每行一项"></textarea>
              </div>
              
              <div class="form-row">
                <label>保养周期 <span class="required">*</span></label>
                <div class="cycle-input-row cycle-single-row">
                  <span class="cycle-label">每</span>
                  <input v-model.number="maintForm.cycle_value" type="number" min="1" class="cycle-num" />
                  <select v-model="maintForm.cycle_type" class="cycle-unit-select">
                    <option value="day">天</option>
                    <option value="week">周</option>
                    <option value="month">月</option>
                    <option value="year">年</option>
                  </select>
                  <span class="cycle-label">，执行</span>
                  <input v-model.number="maintForm.cycle_count" type="number" min="1" class="cycle-num" />
                  <span class="cycle-label">次</span>
                </div>
              </div>
              <div class="form-row">
                <label>涉及第三方维保</label>
                <div class="radio-options">
                  <label class="radio-label"><input type="radio" v-model="maintForm.has_third_party" :value="true" /> 是</label>
                  <label class="radio-label"><input type="radio" v-model="maintForm.has_third_party" :value="false" /> 否</label>
                </div>
              </div>
              <div v-if="maintForm.has_third_party" class="form-row">
                <label>第三方厂家名称 <span class="required">*</span></label>
                <input v-model="maintForm.third_party_name" type="text" placeholder="请输入第三方维保厂家名称" />
              </div>
            </div>
            <div class="dialog-footer">
              <button class="btn-cancel" @click="maintCloseDialog">取消</button>
              <button class="btn-confirm" @click="maintSavePlan">{{ maintEditingPlan ? '保存修改' : '创建计划' }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import TopNavBar from '../components/TopNavBar.vue'
import { currentUser, devices as maintDeviceStore, isOnDuty } from '../composables/useDeviceStore'

const API_BASE = '/api/inspection'
const isAdmin = computed(() => currentUser.value?.role === '系统管理人')

// ===== 保养计划管理 =====
const MAINT_API = '/api/maintenance'
const maintPlans = ref<any[]>([])
const maintShowDialog = ref(false)
const maintEditingPlan = ref<any>(null)
const maintDeviceContent = ref<Record<string, string>>({})
const maintExpandedDevices = ref<Record<number, string[]>>({})
const maintAllSelectedDevices = computed(() => {
  const ids = new Set<string>()
  maintLocationGroups.value.forEach(g => g.deviceIds.forEach((x: any) => ids.add(x.id)))
  return maintAllDevices.value.filter(d => ids.has(d.id))
})
const expandedMaintPlan = ref<number | null>(null)
const expandedMaintTask = ref<number | null>(null)
const myMaintTasks = ref<any[]>([])
const maintExecuteDialog = ref(false)
const currentMaintTask = ref<any>(null)
const maintCheckedItems = ref<string[]>([])
const maintHasAbnormal = ref(false)
const maintAbnormalDesc = ref('')
const maintRecords = ref<Record<number, any[]>>({})
const maintUsersByRole = ref<Record<string, any[]>>({})
const maintAllRoles = ref<string[]>([])
const maintSelectedRole = ref('')
const maintSelectedExecutorId = ref('')
const maintLocations = ref<any[]>([])
const maintAllDevices = ref<any[]>([])
const maintLocationGroups = ref<any[]>([{ location: '', deviceIds: [] }])

const maintForm = ref({
  name: '',
  device_type: '',
  check_content: '',
  cycle_type: 'month',
  cycle_value: 1,
  cycle_count: 1,
  has_third_party: false,
  third_party_name: ''
})

function cycleCountLabel(type: string, value: number, count: number) {
  const unitMap: Record<string, string> = { day: '天', week: '周', month: '月', year: '年' }
  return `每${value}${unitMap[type] || '月'}，共${count}次`
}

function formatMaintRemaining(ms: number): string {
  if (ms == null) return ''
  if (ms === Infinity) return '已完成'
  if (ms < 0) return `已超时 ${Math.abs(Math.round(ms / 86400000))}天`
  const totalMins = Math.floor(ms / 60000)
  const days = Math.floor(totalMins / 1440)
  const hours = Math.floor((totalMins % 1440) / 60)
  const mins = totalMins % 60
  if (days > 0) return `${days}天${hours}小时`
  if (hours > 0) return `${hours}小时${mins}分钟`
  return `${mins}分钟`
}

async function maintLoadUsers() {
  try {
    const res = await fetch('/api/users')
    const allUsers = await res.json()
    if (allUsers && allUsers.length > 0) {
      const filtered = allUsers.filter((u: any) => u.role !== '系统管理人')
      const roleMap: Record<string, any[]> = {}
      for (const u of filtered) {
        if (!roleMap[u.role]) roleMap[u.role] = []
        roleMap[u.role].push(u)
      }
      maintUsersByRole.value = roleMap
maintAllRoles.value = [...new Set([...ALL_ROLES, ...Object.keys(roleMap)])]
    }
  } catch (err) { console.error('加载用户失败', err) }
}

async function maintLoadPlans() {
  try {
    const res = await fetch(`${MAINT_API}/plans`)
    maintPlans.value = await res.json()
  } catch (err) { console.error('加载保养计划失败', err) }
}

function maintLoadDeviceData() {
  maintAllDevices.value = maintDeviceStore.value.map((d: any) => ({ id: d.id, name: d.name, location: d.location }))
  const locMap = new Map<string, number>()
  for (const d of maintDeviceStore.value) {
    if (d.location && !locMap.has(d.location)) locMap.set(d.location, locMap.size + 1)
  }
  maintLocations.value = Array.from(locMap.entries()).map(([name, id]) => ({ id, name }))
}

function maintAvailableLocations(currentIdx: number) {
  const used = maintLocationGroups.value.filter((_: any, i: number) => i !== currentIdx).map((g: any) => g.location).filter(Boolean)
  return maintLocations.value.filter(loc => !used.includes(loc.name))
}

function maintGetDevicesForLocation(locName: string) {
  return maintAllDevices.value.filter(d => d.location === locName)
}

function maintOnGroupLocationChange(gIdx: number) {
  maintLocationGroups.value[gIdx].deviceIds = []
}

function maintToggleGroupDevice(gIdx: number, dev: any) {
  const items = maintLocationGroups.value[gIdx].deviceIds
  const idx = items.findIndex((x: any) => x.id === dev.id)
  if (idx >= 0) items.splice(idx, 1)
  else items.push({ id: dev.id, customContent: '' })
}

function maintAddLocationGroup() {
  maintLocationGroups.value.push({ location: '', deviceIds: [] })
}

function getDeviceName(devId: string): string {
  const dev = maintAllDevices.value.find(d => d.id === devId)
  return dev ? dev.name : devId
}
function isDeviceExtraExpanded(gIdx: number, devId: string): boolean {
  return maintExpandedDevices.value[gIdx]?.includes(devId) || false
}
function maintToggleDeviceExtra(gIdx: number, devId: string) {
  if (!maintExpandedDevices.value[gIdx]) maintExpandedDevices.value[gIdx] = []
  const idx = maintExpandedDevices.value[gIdx].indexOf(devId)
  if (idx >= 0) maintExpandedDevices.value[gIdx].splice(idx, 1)
  else maintExpandedDevices.value[gIdx].push(devId)
}
function maintRemoveLocationGroup(gIdx: number) {
  maintLocationGroups.value.splice(gIdx, 1)
}

function toggleMaintDetail(planId: number) {
  if (expandedMaintPlan.value === planId) {
    expandedMaintPlan.value = null
    return
  }
  expandedMaintPlan.value = planId
  if (!maintRecords.value[planId]) {
    fetchMaintRecords(planId)
  }
}

function toggleMaintTask(taskId: number) {
  if (expandedMaintTask.value === taskId) {
    expandedMaintTask.value = null
    return
  }
  expandedMaintTask.value = taskId
}

async function loadMyMaintTasks() {
  if (!currentUser.value) return
  const role = currentUser.value.role
  if (role === '系统管理人') return
  try {
    const res = await fetch(`${MAINT_API}/plans`)
    const allPlans = await res.json()
    const now = Date.now()
    myMaintTasks.value = allPlans.filter((p: any) => p.executor_role === role).map((p: any) => {
      const rem = getPlanRemainingMs(p, now)
      return { ...p, remainingMs: rem }
    })
  } catch (err) {
    console.error('加载保养任务失败', err)
  }
}

function getPlanRemainingMs(plan: any, now: number): number {
  if (!plan.next_execute_time) return 0
  const target = new Date(plan.next_execute_time).getTime()
  return target - now
}

function openMaintExecute(task: any) {
  if (!isOnDuty.value) return;
  currentMaintTask.value = task
  maintCheckedItems.value = []
  maintHasAbnormal.value = false
  maintAbnormalDesc.value = ''
  maintExecuteDialog.value = true
}

async function submitMaintResult() {
  if (!currentMaintTask.value) return
  const task = currentMaintTask.value
  try {
    const results = maintCheckedItems.value.map((item: string) => ({ content: item, status: 'done' }))
    const res = await fetch(`${MAINT_API}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: task.id,
        device_id: task.items?.[0]?.device_id || null,
        device_name: task.items?.[0]?.device_name || task.name,
        executor_id: currentUser.value?.id,
        executor_name: currentUser.value?.name,
        results,
        has_abnormal: maintHasAbnormal.value,
        abnormal_desc: maintAbnormalDesc.value
      })
    })
    if (!res.ok) throw new Error('提交失败')
    alert('保养任务已完成')
    maintExecuteDialog.value = false
    currentMaintTask.value = null
    await loadMyMaintTasks()
  } catch (err) {
    console.error('提交失败', err)
    alert('提交失败，请重试')
  }
}

async function fetchMaintRecords(planId: number) {
  try {
    const res = await fetch(`${MAINT_API}/records/${planId}`)
    maintRecords.value[planId] = await res.json()
  } catch (err) { console.error('加载保养记录失败', err) }
}

function getDeviceRecord(planId: number, deviceName: string) {
  const records = maintRecords.value[planId] || []
  return records.find((r: any) => r.device_name === deviceName)
}

function getDeviceStatus(planId: number, deviceName: string): 'done' | 'abnormal' | 'pending' {
  const rec = getDeviceRecord(planId, deviceName)
  if (!rec) return 'pending'
  return rec.has_abnormal == 1 ? 'abnormal' : 'done'
}

function maintOpenCreate() {
  maintEditingPlan.value = null
  maintForm.value = { name: '', device_type: '', check_content: '', cycle_type: 'month', cycle_value: 1, cycle_count: 1, has_third_party: false, third_party_name: '' }
  maintSelectedRole.value = ''
  maintSelectedExecutorId.value = ''
  maintLocationGroups.value = [{ location: '', deviceIds: [] }]
  // 确保角色数据已加载
  if (maintAllRoles.value.length === 0) maintLoadUsers()
  maintShowDialog.value = true
}

function maintEditPlan(plan: any) {
  maintEditingPlan.value = plan
  maintForm.value = {
    name: plan.name || '',
    device_type: plan.device_type || '',
    check_content: plan.check_content || '',
    cycle_type: plan.cycle_type || 'month',
    cycle_value: plan.cycle_value || 1,
    cycle_count: plan.cycle_count || 1,
    has_third_party: plan.has_third_party == 1,
    third_party_name: plan.third_party_name || ''
  }
  maintSelectedRole.value = plan.executor_role || ''
  maintSelectedExecutorId.value = plan.executor_ids ? String(JSON.parse(plan.executor_ids)[0] || '') : ''
  // 确保设备数据已加载
  if (maintAllDevices.value.length === 0) maintLoadDeviceData()
  if (plan.items && plan.items.length > 0) {
    // items 只有 device_name，用名称在前端设备列表中匹配
    const selectedNames = plan.items.map((it: any) => it.device_name).filter(Boolean)
    const locMap = new Map<string, number[]>()
    for (const dev of maintAllDevices.value) {
      if (selectedNames.includes(dev.name)) {
        if (!locMap.has(dev.location)) locMap.set(dev.location, [])
        locMap.get(dev.location)!.push(dev.id)
      }
    }
    if (locMap.size > 0) {
      maintLocationGroups.value = Array.from(locMap.entries()).map(([loc, ids]) => ({ location: loc, deviceIds: ids }))
    } else {
      // 匹配不到时用名称兜底
      maintLocationGroups.value = [{ location: '', deviceIds: [] }]
    }
  } else {
    maintLocationGroups.value = [{ location: '', deviceIds: [] }]
  }
  maintShowDialog.value = true
}

function maintCloseDialog() {
  maintShowDialog.value = false
  maintEditingPlan.value = null
}

async function maintSavePlan() {
  const validGroups = maintLocationGroups.value.filter(g => g.location && g.deviceIds.length > 0)
  if (!maintForm.value.name || !maintSelectedRole.value || !maintSelectedExecutorId.value || validGroups.length === 0 || !maintForm.value.device_type) {
    alert('请填写必填项（*标记）')
    return
  }
  const allDeviceIds = maintLocationGroups.value.flatMap(g => g.deviceIds)
  const selectedDevs = maintAllDevices.value.filter(d => allDeviceIds.includes(d.id))
  const items = maintLocationGroups.value.filter(g => g.location && g.deviceIds.length > 0).flatMap(g => {
    const devs = maintAllDevices.value.filter(d => g.deviceIds.some((x: any) => x.id === d.id))
    return devs.map(dev => ({ device_id: dev.id, device_name: dev.name, location: dev.location, check_content: maintForm.value.check_content }))
  })
  const payload = {
    name: maintForm.value.name,
    executor_role: maintSelectedRole.value,
    executor_ids: JSON.stringify([Number(maintSelectedExecutorId.value)]),
    device_name: selectedDevs.map(d => d.name).join('、'),
    device_type: maintForm.value.device_type,
    check_content: maintForm.value.check_content,
    cycle_type: maintForm.value.cycle_type,
    cycle_value: maintForm.value.cycle_value,
    cycle_count: maintForm.value.cycle_count,
    has_third_party: maintForm.value.has_third_party,
    third_party_name: maintForm.value.has_third_party ? maintForm.value.third_party_name : '',
    items
  }
  try {
    if (maintEditingPlan.value) {
      await fetch(`${MAINT_API}/plans/${maintEditingPlan.value.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    } else {
      await fetch(`${MAINT_API}/plans`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    await maintLoadPlans()
    maintCloseDialog()
  } catch (err) { console.error('保存失败', err); alert('保存失败') }
}

async function maintDeletePlan(id: number) {
  if (!confirm('确认删除该保养计划？')) return
  try {
    await fetch(`${MAINT_API}/plans/${id}`, { method: 'DELETE' })
    await maintLoadPlans()
  } catch (err) { console.error('删除失败', err) }
}


const today = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]}`
})

type InsStatus = 'done' | 'pending'
const statusLabel: Record<InsStatus, string> = { done: '已完成', pending: '待巡检' }

const activeTab = ref<'inspection' | 'maintenance'>('inspection')

// 管理员功能
const showAdminPanel = ref(false)
const showCreateDialog = ref(false)
const editingPlan = ref<any>(null)
const plans = ref<any[]>([])
const locations = ref<any[]>([])
const devices = ref<any[]>([])
const selectedDeviceIds = ref<number[]>([])
const deviceCheckItems = ref<Record<number, string>>({})
const ALL_ROLES = ['系统管理人', '带班', '维修组', '值班岗位', '旧厂制水', '新低值班', '一期制水', '新高值班']
const usersByRole = ref<Record<string, any[]>>({})
const allRoles = ref<string[]>([])
const selectedExecutorId = ref<string>('')
const selectedRole = ref<string>('')

const currentTask = ref<any>(null)
const showExecuteDialog = ref(false)
const checkedItems = ref<string[]>([])
const hasAbnormal = ref(false)
const abnormalDesc = ref('')
const customTimes = ref<{start: string, end: string}[]>([])

const filteredDevices = computed(() => {
  if (!planForm.value.location) return devices.value
  return devices.value.filter(d => d.location === planForm.value.location)
})

const planForm = ref({
  name: '',
  location: '',
  cycle: 'daily',
  executor_role: ''
})

const cycleOptions = [
  { value: 'hourly', label: '每小时' },
  { value: 'two_hour', label: '每2小时' },
  { value: 'four_hour', label: '每4小时' },
  { value: 'eight_hour', label: '每8小时' },
  { value: 'weekly', label: '每周一次' },
  { value: 'custom', label: '自定义时间' }
]

const selectedDevices = computed(() =>
  devices.value.filter(d => selectedDeviceIds.value.includes(d.id))
)

function getExecutorNames(plan: any): string {
  try {
    const ids = JSON.parse(plan.executor_ids || '[]')
    const names: string[] = []
    for (const role in usersByRole.value) {
      for (const u of usersByRole.value[role]) {
        if (ids.includes(u.id)) names.push(u.name)
      }
    }
    return names.length > 0 ? names.join('、') : plan.executor_role || '未指定'
  } catch {
    return plan.executor_role || '未指定'
  }
}

function getExecutorRole(userId: number): string {
  for (const role in usersByRole.value) {
    const found = usersByRole.value[role].find((u: any) => u.id === userId)
    if (found) return role
  }
  return ''
}

function cycleLabel(cycle: string) {
  return cycleOptions.find(c => c.value === cycle)?.label || cycle
}

async function loadPlans() {
  try {
    const res = await fetch(`${API_BASE}/plans`)
    plans.value = await res.json()
  } catch (err) {
    console.error('加载巡检计划失败', err)
  }
}

async function loadLocations() {
  try {
    const res = await fetch('/api/devices')
    const allDevices = await res.json()
    const locSet = new Set<string>()
    for (const d of allDevices) {
      if (d.location) locSet.add(d.location)
    }
    locations.value = Array.from(locSet).map(name => ({ id: name, name }))
  } catch (err) {
    console.error('加载地点失败', err)
  }
}

const mockDevices = [
  { id: 1, name: '1号取水泵', location: '取水泵房' },
  { id: 2, name: '2号取水泵', location: '取水泵房' },
  { id: 3, name: '1号送水泵', location: '送水泵房' },
  { id: 4, name: '滤池1-4号', location: '滤池间' },
  { id: 5, name: '水质监测站', location: '监测中心' }
]

async function loadDevices() {
  try {
    const res = await fetch('/api/devices')
    const data = await res.json()
    devices.value = data.length > 0 ? data : mockDevices
  } catch {
    devices.value = mockDevices
  }
}

const mockUsers = {
  '带班': [{ id: 2, name: '张远', role: '带班' }],
  '值班岗位': [{ id: 3, name: '一期制水', role: '值班岗位' }],
  '维修组': [{ id: 4, name: '维修组', role: '维修组' }]
}

async function loadUsers() {
  try {
    const res = await fetch('/api/users')
    const allUsers = await res.json()
    if (allUsers && allUsers.length > 0) {
      const filtered = allUsers.filter((u: any) => u.role !== '系统管理人')
      const roleMap: Record<string, any[]> = {}
      for (const u of filtered) {
        if (!roleMap[u.role]) roleMap[u.role] = []
        roleMap[u.role].push(u)
      }
      usersByRole.value = roleMap
allRoles.value = [...new Set([...ALL_ROLES, ...Object.keys(roleMap)])]
    }
  } catch (err) {
    console.error('加载用户失败', err)
  }
}

function toggleDevice(dev: any) {
  const idx = selectedDeviceIds.value.indexOf(dev.id)
  if (idx >= 0) {
    selectedDeviceIds.value.splice(idx, 1)
    delete deviceCheckItems.value[dev.id]
  } else {
    selectedDeviceIds.value.push(dev.id)
    deviceCheckItems.value[dev.id] = deviceCheckItems.value[dev.id] || ''
  }
}

function toggleExecutor(userId: number) {
  selectedExecutorId.value = String(userId)
}

function addCustomTime() {
  customTimes.value.push({ start: '', end: '' })
}

function removeCustomTime(idx: number) {
  customTimes.value.splice(idx, 1)
}

function editPlan(plan: any) {
  editingPlan.value = plan
  planForm.value = {
    name: plan.name,
    location: plan.location,
    cycle: plan.cycle,
    executor_role: plan.executor_role
  }
  // 解析执行人
  selectedRole.value = plan.executor_role || ''
  selectedExecutorId.value = plan.executor_ids ? String(JSON.parse(plan.executor_ids)[0]) : ''
  // 解析自定义时间
  customTimes.value = []
  if (plan.custom_times) {
    try {
          customTimes.value = plan.custom_times ? JSON.parse(plan.custom_times) : []
    } catch {}
  }
  selectedDeviceIds.value = plan.items?.map((it: any) => it.device_id) || []
  deviceCheckItems.value = {}
  plan.items?.forEach((it: any) => {
    deviceCheckItems.value[it.device_id] = it.check_content || ''
  })
  showCreateDialog.value = true
}

function closeDialog() {
  showCreateDialog.value = false
  editingPlan.value = null
  planForm.value = { name: '', location: '', cycle: 'daily', executor_role: '' }
  selectedDeviceIds.value = []
  deviceCheckItems.value = {}
  selectedExecutorId.value = ''
  selectedRole.value = ''
  customTimes.value = []
}

async function savePlan() {
  if (!planForm.value.name) {
    alert('请填写计划名称')
    return
  }
  if (!selectedRole.value) {
    alert('请选择执行角色')
    return
  }
  if (!selectedExecutorId.value) {
    alert('请选择执行人')
    return
  }
  if (!planForm.value.location) {
    alert('请选择地点')
    return
  }
  if (selectedDeviceIds.value.length === 0) {
    alert('请选择设备')
    return
  }
  
  const items = selectedDevices.value.map(dev => ({
    device_id: dev.id,
    device_name: dev.name,
    check_content: deviceCheckItems.value[dev.id] || ''
  }))
  
  const payload = {
    name: planForm.value.name,
    location: planForm.value.location,
    cycle: planForm.value.cycle,
    executor_role: selectedRole.value,
    device_ids: selectedDeviceIds.value,
    executor_ids: JSON.stringify([Number(selectedExecutorId.value)]),
    custom_times: JSON.stringify(customTimes.value),
    items
  }
  
  try {
    const url = editingPlan.value ? `${API_BASE}/plans/${editingPlan.value.id}` : `${API_BASE}/plans`
    const method = editingPlan.value ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HTTP ${res.status}: ${text}`)
    }
    await loadPlans()
    closeDialog()
  } catch (err) {
    console.error('保存失败:', err)
    const msg = err instanceof Error ? err.message : String(err)
    alert('保存失败：' + msg)
  }
}

async function deletePlan(id: number) {
  if (!confirm('确认删除？')) return
  try {
    await fetch(`${API_BASE}/plans/${id}`, { method: 'DELETE' })
    await loadPlans()
  } catch (err) {
    console.error('删除失败', err)
  }
}

onMounted(async () => {
  await loadPlans()
  loadLocations()
  loadDevices()
  loadUsers()
  await loadMyTasks()
  if (isAdmin.value) {
    maintLoadUsers()
    await maintLoadPlans()
    maintLoadDeviceData()
  } else {
    await loadMyMaintTasks()
  }
  const timer = setInterval(() => {
    const now = Date.now()
    for (const t of myTasks.value) {
      const plan = plans.value.find((p: any) => p.id === t.plan_id)
      t.remainingMs = getTaskRemainingMs(t, plan, now)
    }
  }, 60000)
  onUnmounted(() => clearInterval(timer))
})

const inspectionItems = ref<any[]>([])

const doneCount = computed(() => inspectionItems.value.filter(i => i.status === 'done').length)
const totalCount = computed(() => inspectionItems.value.length)
const pendingCount = computed(() => inspectionItems.value.filter(i => i.status === 'pending').length)
const myTasks = ref<any[]>([])

// 用 myTasks 统计
const myDoneCount = computed(() => myTasks.value.filter(t => t.is_completed).length)
const myPendingCount = computed(() => myTasks.value.filter(t => !t.is_completed).length)
const myAbnormalCount = computed(() => myTasks.value.filter(t => t.has_abnormal).length)

async function loadMyTasks() {
  if (!currentUser.value) return
  const role = currentUser.value.role
  if (role === '系统管理人') return
  const userId = currentUser.value.id
  try {
    const res = await fetch(`${API_BASE}/pending-tasks?executor_role=${encodeURIComponent(role)}&executor_id=${userId}`)
    const tasks = await res.json()
    // 补充剩余时间（直接用task自带字段，不依赖plans查找）
    const now = Date.now()
    for (const t of tasks) {
      const plan = plans.value.find((p: any) => p.id === t.plan_id)
      const rem = getTaskRemainingMs(t, plan, now)
      console.log('[DEBUG loadMyTasks] now:', new Date(now).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}), 'plan id:', t.plan_id, 'cycle:', t.cycle, 'custom_times:', t.custom_times, 'rem:', Math.floor(rem/60000), 'min')
      t.remainingMs = rem
    }
    // 按剩余时间升序，再按任务名称升序
    tasks.sort((a: any, b: any) => {
      if (a.remainingMs !== b.remainingMs) return a.remainingMs - b.remainingMs
      return (a.plan_name || '').localeCompare(b.plan_name || '')
    })
    myTasks.value = tasks
  } catch (err) {
    console.error('加载任务失败', err)
  }
}

function getTaskRemainingMs(task: any, plan: any, now: number): number {
  if (task.is_completed) return Infinity
  const cycleMap: Record<string, number> = {
    'hourly': 60 * 60 * 1000,
    'two-hour': 2 * 60 * 60 * 1000,
    'four-hour': 4 * 60 * 60 * 1000,
    'eight-hour': 8 * 60 * 60 * 1000,
    'weekly': 7 * 24 * 60 * 60 * 1000,
  }
  const cycle = task.cycle || plan?.cycle
  const customTimes = task.custom_times || plan?.custom_times
  if (cycle === 'custom' && customTimes) {
    try {
      const times = JSON.parse(customTimes)
      if (Array.isArray(times) && times.length > 0) {
        const seg = times[0]
        const startStr = typeof seg === 'string' ? seg.split('-')[0].trim() : (seg.start || '')
        const endStr = typeof seg === 'string' ? seg.split('-')[1].trim() : (seg.end || '')
        const [sh, sm] = startStr.split(':').map(Number)
        const [eh, em] = endStr.split(':').map(Number)
        const nowD = new Date()
        // 计算窗口结束时间
        const endD = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate(), eh, em, 0)
        if (endD.getTime() <= nowD.getTime()) {
          // 窗口已过，算下一个周期（明天）
          endD.setDate(endD.getDate() + 1)
        }
        return endD.getTime() - now
      }
    } catch (e) { console.error('剩余时间计算错误', e) }
  }
  const interval = cycleMap[cycle] || (2 * 60 * 60 * 1000)
  if (task.record_created_at) {
    return new Date(task.record_created_at).getTime() + interval - now
  }
  const planCreated = plan?.created_at ? new Date(plan.created_at).getTime() : now
  return planCreated + interval - now
}

function formatRemaining(ms: number): string {
  if (ms < 0) ms = -ms
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}小时${m}分`
  return `${m}分钟`
}

async function executeTask(task: any) {
  // 弹出巡检执行对话框
  currentTask.value = task
  showExecuteDialog.value = true
}

function markTaskComplete(task: any, abnormal: boolean) {
  const t = myTasks.value.find(t => t.plan_id === task.plan_id && t.device_id === task.device_id)
  if (t) {
    t.is_completed = true
    t.has_abnormal = abnormal ? 1 : 0
  }
}

async function submitTaskResult() {
  if (!currentTask.value) return
  try {
    const res = await fetch(`${API_BASE}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: currentTask.value.plan_id,
        device_id: currentTask.value.device_id,
        device_name: currentTask.value.device_name,
        executor: currentUser.value?.name || '',
        executor_id: currentUser.value?.id || null,
        executor_name: currentUser.value?.name || '',
        results: JSON.stringify(checkedItems.value),
        has_abnormal: hasAbnormal.value ? 1 : 0,
        abnormal_desc: abnormalDesc.value
      })
    })
    if (!res.ok) throw new Error('提交失败')
    const data = await res.json()
    if (data.duplicate) {
      alert('该任务已在2小时内提交过，无需重复提交')
    } else {
      markTaskComplete(currentTask.value, hasAbnormal.value)
    }
    showExecuteDialog.value = false
    checkedItems.value = []
    hasAbnormal.value = false
    abnormalDesc.value = ''
    currentTask.value = null
    loadMyTasks()
  } catch (err) {
    console.error('提交失败', err)
    alert('提交失败，请重试')
  }
}

function toggleItem(item: any) {
  item.status = item.status === 'done' ? 'pending' : 'done'
}

</script>

<style scoped>


/* 新建/编辑保养计划弹窗（独立于 maint-admin-wrapper，dialog 在模板中直接挂载） */
.ins-page .dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.ins-page .dialog {
  background: #0f3248;
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 12px;
  width: 880px;
  max-height: 90vh;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(45, 212, 191, 0.3) transparent;
}
.ins-page .dialog::-webkit-scrollbar { width: 6px; }
.ins-page .dialog::-webkit-scrollbar-track { background: transparent; }
.ins-page .dialog::-webkit-scrollbar-thumb { background: rgba(45, 212, 191, 0.3); border-radius: 3px; }
.ins-page .dialog-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 24px; border-bottom: 1px solid rgba(45, 212, 191, 0.1);
}
.ins-page .dialog-header h3 { color: #fff; font-size: 18px; margin: 0; }
.ins-page .dialog-close {
  background: none; border: none; color: rgba(255, 255, 255, 0.4);
  font-size: 22px; cursor: pointer;
}
.ins-page .dialog-body {
  padding: 24px 24px 20px; display: flex; flex-direction: column;
}
.ins-page .form-row { margin-bottom: 18px; transition: all 0.2s ease; }
.ins-page .dialog-body label {
  display: block; box-sizing: border-box;
  color: rgba(255, 255, 255, 0.65); font-size: 13px; font-weight: 500;
  line-height: 1.4; margin-bottom: 8px;
}
.ins-page .required { color: #F97316; margin-left: 2px; }
.ins-page .form-row input,
.ins-page .form-row select,
.ins-page .form-row textarea {
  width: 100%; background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px; color: #fff; padding: 10px 12px;
  font-size: 14px; box-sizing: border-box;
}
.ins-page .form-row textarea { resize: vertical; min-height: 80px; }
.ins-page .form-row-two { display: flex; gap: 16px; margin-bottom: 18px; }
.ins-page .form-col { flex: 1; }
.ins-page .form-col select,
.ins-page .form-col input {
  width: 100%; background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px; color: #fff; padding: 10px 12px;
  font-size: 14px; box-sizing: border-box;
}
.ins-page .dialog-footer {
  display: flex; justify-content: flex-end; gap: 12px;
  padding: 16px 24px; border-top: 1px solid rgba(45, 212, 191, 0.1);
  background: #0f3248; position: sticky; bottom: 0;
  border-radius: 0 0 12px 12px;
}
.ins-page .btn-cancel {
  background: none; border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.6); padding: 8px 20px;
  border-radius: 6px; font-size: 14px; cursor: pointer;
}
.ins-page .btn-confirm {
  background: rgba(45, 212, 191, 0.15); border: 1px solid rgba(45, 212, 191, 0.4);
  color: #2DD4BF; padding: 8px 20px; border-radius: 6px;
  font-size: 14px; cursor: pointer;
}
.ins-page .btn-confirm:hover { background: rgba(45, 212, 191, 0.25); }
.ins-page .cycle-input-row {
  display: flex; flex-direction: column; gap: 10px;
  padding: 12px 14px; background: rgba(255,255,255,0.04);
  border-radius: 8px; border: 1px solid rgba(45, 212, 191, 0.12);
}
.ins-page .cycle-input-row label {
  color: rgba(255, 255, 255, 0.6) !important;
  font-size: 13px !important; margin-bottom: 0 !important;
}
.ins-page .cycle-single-row {
  flex-direction: row; align-items: center; flex-wrap: wrap; gap: 6px;
}
.ins-page .cycle-segment { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.ins-page .cycle-label {
  color: #ffffff !important; white-space: nowrap;
  font-weight: 600 !important; font-size: 14px !important;
}
.ins-page .dialog-body .cycle-label {
  color: #ffffff !important; font-weight: 600 !important; font-size: 14px !important;
}
.ins-page .cycle-num {
  width: 60px !important; text-align: center; padding: 5px 6px;
  border: 1px solid rgba(255,255,255,0.2); border-radius: 6px;
  background: rgba(255,255,255,0.08); color: #fff; font-size: 14px;
}
.ins-page .cycle-unit-select {
  width: 90px !important; padding: 5px 8px;
  border: 1px solid rgba(255,255,255,0.2); border-radius: 6px;
  background: rgba(255,255,255,0.08); color: #fff; font-size: 14px;
}
.ins-page .hint-text { font-size: 12px; color: rgba(255,255,255,0.45); font-weight: normal; }
.ins-page .device-extra-item { margin-top: 12px; }
.ins-page .device-extra-toggle {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; background: rgba(45,212,191,0.08);
  border: 1px solid rgba(45,212,191,0.2); border-radius: 6px;
  cursor: pointer; font-size: 13px; color: #2dd4bf;
}
.ins-page .device-extra-toggle:hover { background: rgba(45,212,191,0.14); }
.ins-page .toggle-icon { font-size: 10px; }
.ins-page .toggle-label { font-weight: 500; color: #fff; }
.ins-page .device-extra-content textarea {
  width: 100%; margin-top: 6px; padding: 8px 10px;
  border: 1px solid rgba(255,255,255,0.15); border-radius: 6px;
  background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.85);
  font-size: 13px; resize: vertical; box-sizing: border-box;
}
.ins-page .radio-options { display: flex; gap: 20px; padding: 8px 0; }
.ins-page .radio-label {
  display: inline-flex; align-items: center; gap: 10px;
  color: rgba(255, 255, 255, 0.75); font-size: 14px;
  cursor: pointer; padding: 6px 12px; border-radius: 6px;
  border: 1px solid transparent; transition: all 0.2s;
}
.ins-page .radio-label:hover {
  border-color: rgba(45, 212, 191, 0.3); background: rgba(45, 212, 191, 0.06);
}
.ins-page .radio-label input[type="radio"] {
  accent-color: #2DD4BF; width: 16px; height: 16px; flex-shrink: 0;
}
.ins-page .location-group-list {
  display: flex; flex-direction: column; gap: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(45, 212, 191, 0.12); border-radius: 10px; padding: 16px;
}
.ins-page .location-group {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(45, 212, 191, 0.15); border-radius: 8px; padding: 14px;
}
.ins-page .grp-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
}
.ins-page .grp-num { color: #ffffff !important; font-size: 13px; font-weight: 600; }
.ins-page .grp-remove {
  background: none; border: none; color: rgba(255, 100, 100, 0.6);
  font-size: 18px; cursor: pointer;
}
.ins-page .grp-body { display: flex; flex-direction: column; gap: 10px; }
.ins-page .grp-location {
  width: 100%; background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 6px;
  color: #fff; padding: 8px 12px; font-size: 14px; box-sizing: border-box;
}
.ins-page .add-location-btn {
  margin-top: 10px; background: none;
  border: 1px dashed rgba(45, 212, 191, 0.45); color: rgba(45, 212, 191, 0.9);
  padding: 8px 16px; border-radius: 6px; font-size: 13px;
  cursor: pointer; width: 100%; transition: all 0.2s;
}
.ins-page .add-location-btn:hover { border-color: #2DD4BF; color: #2DD4BF; }
.ins-page .device-selector {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(45, 212, 191, 0.2); border-radius: 8px; padding: 12px;
}
.ins-page .available-devices { display: flex; flex-wrap: wrap; gap: 8px; }
.ins-page .device-option {
  padding: 6px 14px; border-radius: 6px; font-size: 13px;
  cursor: pointer; border: 1px solid rgba(45, 212, 191, 0.2);
  color: rgba(255, 255, 255, 0.7); background: rgba(255, 255, 255, 0.04);
  transition: all 0.2s;
}
.ins-page .device-option:hover { border-color: rgba(45, 212, 191, 0.5); color: #2DD4BF; }
.ins-page .device-option.selected {
  background: rgba(45, 212, 191, 0.15); border-color: #2DD4BF; color: #2DD4BF;
}
.ins-page .selected-count { margin-top: 8px; color: #ffffff !important; font-size: 13px; font-weight: 500; }

/* 保养计划统计栏 */
.maint-stats-row {
  display: flex;
  align-items: center;
  gap: 0;
  margin: 12px 0;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  flex-wrap: wrap;
}
.maint-stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.maint-stat-num {
  font-size: 16px;
  font-weight: 700;
}
.maint-stat-lbl {
  font-size: 12px;
  opacity: 0.7;
}
.maint-stat-sep {
  color: rgba(255, 255, 255, 0.3);
  margin: 0 10px;
  font-size: 14px;
}
.maint-stat-expand {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  color: rgba(45, 212, 191, 0.8);
  font-size: 12px;
  cursor: pointer;
}
.maint-stat-expand:hover { color: #2DD4BF; }
.stat-green { color: #22C55E !important; font-weight: 700; font-size: 18px; }
.stat-red { color: #EF4444 !important; font-weight: 700; font-size: 18px; }
.stat-cyan { color: #06B6D4 !important; font-weight: 700; font-size: 18px; }

/* 保养详情展开区 */
.maint-detail-section {
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  padding-top: 12px;
  margin-top: 4px;
}
.detail-device-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.detail-device-item {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px;
  padding: 12px;
}
.detail-device-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.detail-device-name {
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  font-weight: 600;
}
.detail-device-tags { display: flex; gap: 6px; }
.detail-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}
.tag-done { background: rgba(34, 197, 94, 0.15); color: #22C55E; }
.tag-abnormal { background: rgba(239, 68, 68, 0.15); color: #EF4444; }
.tag-pending { background: rgba(251, 146, 60, 0.15); color: #FDBA74; }
.detail-check-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-left: 4px;
}
.detail-check-row { display: flex; align-items: center; gap: 8px; }
.check-dot { width: 8px; height: 8px; border-radius: 50%; min-width: 8px; }
.dot-done { background: #22C55E; }
.dot-pending { background: #FDBA74; }
.check-text { color: rgba(255, 255, 255, 0.6); font-size: 13px; }
.detail-abnormal-note {
  margin-top: 6px;
  color: rgba(239, 68, 68, 0.8);
  font-size: 12px;
  background: rgba(239, 68, 68, 0.08);
  padding: 6px 10px;
  border-radius: 4px;
}
.abnormal-note-label { font-weight: 600; }
.detail-loading { color: rgba(255,255,255,0.4); font-size: 13px; padding: 10px 0; }

/* 剩余时间tag */
.tag-overdue { background: rgba(239, 68, 68, 0.2) !important; color: #FCA5A5 !important; }
.tag-remaining { background: rgba(251, 146, 60, 0.15) !important; color: #FDBA74 !important; }

/* 保养计划内嵌样式 */
.maint-admin-wrapper .page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.maint-admin-wrapper .header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.maint-admin-wrapper .page-title {
  color: #fff;
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  letter-spacing: 1px;
}
.maint-admin-wrapper .page-desc {
  color: rgba(255, 255, 255, 0.45);
  font-size: 13px;
}
.maint-admin-wrapper .btn-primary {
  background: rgba(45, 212, 191, 0.15);
  border: 1px solid rgba(45, 212, 191, 0.4);
  color: #2DD4BF;
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}
.maint-admin-wrapper .btn-primary:hover { background: rgba(45, 212, 191, 0.25); }
.maint-admin-wrapper .plan-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(45, 212, 191, 0.15);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 16px;
}
.maint-admin-wrapper .plan-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.maint-admin-wrapper .plan-name {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
}
.maint-admin-wrapper .plan-meta { display: flex; gap: 10px; flex-wrap: wrap; }
.maint-admin-wrapper .meta-tag {
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  background: rgba(255, 255, 255, 0.06);
  padding: 3px 10px;
  border-radius: 12px;
}
.maint-admin-wrapper .plan-actions { display: flex; gap: 8px; }
.maint-admin-wrapper .btn-edit, .maint-admin-wrapper .btn-delete {
  background: none;
  border: 1px solid;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}
.maint-admin-wrapper .btn-edit { border-color: rgba(45, 212, 191, 0.4); color: #2DD4BF; }
.maint-admin-wrapper .btn-delete { border-color: rgba(239, 68, 68, 0.4); color: #FCA5A5; }
.maint-admin-wrapper .empty-state {
  text-align: center;
  padding: 60px 0;
  color: rgba(255, 255, 255, 0.4);
}
.maint-admin-wrapper .empty-icon { font-size: 48px; display: block; margin-bottom: 16px; }
.maint-admin-wrapper .dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.maint-admin-wrapper .dialog {
  background: #0f3248;
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 12px;
  width: 880px;
  max-height: 90vh;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(45, 212, 191, 0.3) transparent;
}
.maint-admin-wrapper .dialog::-webkit-scrollbar { width: 6px; }
.maint-admin-wrapper .dialog::-webkit-scrollbar-track { background: transparent; }
.maint-admin-wrapper .dialog::-webkit-scrollbar-thumb {
  background: rgba(45, 212, 191, 0.3);
  border-radius: 3px;
}
.maint-admin-wrapper .dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(45, 212, 191, 0.1);
}
.maint-admin-wrapper .dialog-header h3 { color: #fff; font-size: 18px; margin: 0; }
.maint-admin-wrapper .dialog-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 22px;
  cursor: pointer;
}
.maint-admin-wrapper .dialog-body {
  padding: 24px 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.maint-admin-wrapper .form-row {
  margin-bottom: 18px;
  transition: all 0.2s ease;
}
.maint-admin-wrapper .dialog-body label {
  display: block;
  box-sizing: border-box;
  color: rgba(255, 255, 255, 0.65);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  margin-bottom: 8px;
}
.maint-admin-wrapper .required { color: #F97316; margin-left: 2px; }
.maint-admin-wrapper .form-row input,
.maint-admin-wrapper .form-row select,
.maint-admin-wrapper .form-row textarea {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 10px 12px;
  font-size: 14px;
  box-sizing: border-box;
}
.maint-admin-wrapper .form-row textarea { resize: vertical; min-height: 80px; }
.maint-admin-wrapper .form-row-two {
  display: flex;
  gap: 16px;
  margin-bottom: 18px;
}
.maint-admin-wrapper .form-col { flex: 1; }

.maint-admin-wrapper .form-col select,
.maint-admin-wrapper .form-col input {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 10px 12px;
  font-size: 14px;
  box-sizing: border-box;
}
.maint-admin-wrapper .dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgba(45, 212, 191, 0.1);
  background: #0f3248;
  position: sticky;
  bottom: 0;
  border-radius: 0 0 12px 12px;
}
.maint-admin-wrapper .btn-cancel {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.6);
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}
.maint-admin-wrapper .btn-confirm {
  background: rgba(45, 212, 191, 0.15);
  border: 1px solid rgba(45, 212, 191, 0.4);
  color: #2DD4BF;
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}
.maint-admin-wrapper .btn-confirm:hover { background: rgba(45, 212, 191, 0.25); }
.maint-admin-wrapper .cycle-input-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.04);
  border-radius: 8px;
  border: 1px solid rgba(45, 212, 191, 0.12);
}
.maint-admin-wrapper .cycle-input-row label {
  color: rgba(255, 255, 255, 0.6) !important;
  font-size: 13px !important;
  margin-bottom: 0 !important;
}
.maint-admin-wrapper .cycle-single-row {
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.maint-admin-wrapper .cycle-segment {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.maint-admin-wrapper .cycle-label {
  color: #ffffff !important;
  white-space: nowrap;
  font-weight: 600 !important;
  font-size: 14px !important;
}
.maint-admin-wrapper .dialog-body .cycle-label {
  color: #ffffff !important;
  font-weight: 600 !important;
  font-size: 14px !important;
}
.maint-admin-wrapper .cycle-num {
  width: 60px !important; text-align: center;
  padding: 5px 6px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 6px;
  background: rgba(255,255,255,0.08);
  color: #fff;
  font-size: 14px;
}
.maint-admin-wrapper .cycle-unit-select {
  width: 90px !important;
  padding: 5px 8px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 6px;
  background: rgba(255,255,255,0.08);
  color: #fff;
  font-size: 14px;
}
.hint-text { font-size: 12px; color: rgba(255,255,255,0.45); font-weight: normal; }

.device-extra-item { margin-top: 12px; }
.device-extra-toggle {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  background: rgba(45,212,191,0.08);
  border: 1px solid rgba(45,212,191,0.2);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #2dd4bf;
}
.device-extra-toggle:hover { background: rgba(45,212,191,0.14); }
.toggle-icon { font-size: 10px; }
.toggle-label { font-weight: 500; color: #fff; }
.device-extra-content textarea {
  width: 100%; margin-top: 6px; padding: 8px 10px;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.85);
  font-size: 13px; resize: vertical; box-sizing: border-box;
}
.maint-admin-wrapper .radio-options {
  display: flex;
  gap: 20px;
  padding: 8px 0;
}
.maint-admin-wrapper .radio-label {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 14px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: all 0.2s;
}
.maint-admin-wrapper .radio-label:hover {
  border-color: rgba(45, 212, 191, 0.3);
  background: rgba(45, 212, 191, 0.06);
}
.maint-admin-wrapper .radio-label input[type="radio"] {
  accent-color: #2DD4BF;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.maint-admin-wrapper .location-group-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(45, 212, 191, 0.12);
  border-radius: 10px;
  padding: 16px;
}
.maint-admin-wrapper .location-group {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(45, 212, 191, 0.15);
  border-radius: 8px;
  padding: 14px;
}
.maint-admin-wrapper .grp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.maint-admin-wrapper .grp-num { color: #ffffff !important; font-size: 13px; font-weight: 600; }
.maint-admin-wrapper .grp-remove {
  background: none;
  border: none;
  color: rgba(255, 100, 100, 0.6);
  font-size: 18px;
  cursor: pointer;
}
.maint-admin-wrapper .grp-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.maint-admin-wrapper .grp-location {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 8px 12px;
  font-size: 14px;
  box-sizing: border-box;
}
.maint-admin-wrapper .add-location-btn {
  margin-top: 10px;
  background: none;
  border: 1px dashed rgba(45, 212, 191, 0.45);
  color: rgba(45, 212, 191, 0.9);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  width: 100%;
  transition: all 0.2s;
}
.maint-admin-wrapper .add-location-btn:hover { border-color: #2DD4BF; color: #2DD4BF; }
.maint-admin-wrapper .device-selector {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 8px;
  padding: 12px;
}
.maint-admin-wrapper .available-devices { display: flex; flex-wrap: wrap; gap: 8px; }
.maint-admin-wrapper .device-option {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid rgba(45, 212, 191, 0.2);
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.04);
  transition: all 0.2s;
}
.maint-admin-wrapper .device-option:hover { border-color: rgba(45, 212, 191, 0.5); color: #2DD4BF; }
.maint-admin-wrapper .device-option.selected {
  background: rgba(45, 212, 191, 0.15);
  border-color: #2DD4BF;
  color: #2DD4BF;
}
.maint-admin-wrapper .selected-count {
  margin-top: 8px;
  color: #ffffff !important;
  font-size: 13px;
  font-weight: 500;
}
.ins-page {
  min-height: 100vh;
  background: #0f2d4a;
  padding: 0 0 40px;
}

/* 页面标题区 */
.ins-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px 20px;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 16px;
}

.page-title {
  color: #fff;
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  letter-spacing: 1px;
}

.page-date {
  color: rgba(255, 255, 255, 0.45);
  font-size: 13px;
}

.header-stats {
  display: flex;
  gap: 12px;
}

.stat-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.stat-teal {
  background: rgba(45, 212, 191, 0.15);
  color: #2DD4BF;
  border: 1px solid rgba(45, 212, 191, 0.3);
}

.stat-orange {
  background: rgba(251, 146, 60, 0.15);
  color: #fb923c;
  border: 1px solid rgba(251, 146, 60, 0.3);
}

.stat-red {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.stat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

/* Tab 切换 */
.ins-tabs {
  display: flex;
  gap: 4px;
  padding: 0 32px 20px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.55);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
}

.tab-btn.active {
  background: rgba(45, 212, 191, 0.15);
  color: #2DD4BF;
  border: 1px solid rgba(45, 212, 191, 0.3);
}

.tab-icon {
  font-size: 15px;
}

.tab-count {
  background: rgba(251, 146, 60, 0.2);
  color: #fb923c;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

/* 管理员工具栏 */
.section-toolbar {
  margin-bottom: 16px;
}

.btn-admin {
  background: rgba(45, 212, 191, 0.1);
  border: 1px solid rgba(45, 212, 191, 0.3);
  color: #2DD4BF;
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.btn-admin:hover {
  background: rgba(45, 212, 191, 0.2);
}

/* 管理面板 */
.admin-panel {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.admin-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.admin-title {
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

.btn-create-plan {
  background: rgba(45, 212, 191, 0.15);
  border: 1px solid rgba(45, 212, 191, 0.4);
  color: #2DD4BF;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.plans-empty {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  text-align: center;
  padding: 20px 0;
}

.plan-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  margin-bottom: 8px;
}

.plan-item:last-child { margin-bottom: 0; }

.plan-item-name {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  display: block;
  margin-bottom: 4px;
}

.plan-item-meta {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
}

.plan-item-actions {
  display: flex;
  gap: 8px;
}

.btn-plan-edit, .btn-plan-delete {
  background: none;
  border: 1px solid;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.btn-plan-edit {
  border-color: rgba(45, 212, 191, 0.4);
  color: #2DD4BF;
}

.btn-plan-delete {
  border-color: rgba(239, 68, 68, 0.4);
  color: #FCA5A5;
}

/* 弹窗 */
.dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #0f3248;
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 12px;
  width: 680px;
  max-height: 85vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  border-bottom: 1px solid rgba(45, 212, 191, 0.1);
}

.dialog-header h3 {
  color: #fff;
  font-size: 17px;
  margin: 0;
}

.dialog-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 22px;
  cursor: pointer;
}

.dialog-body { padding: 20px 28px; }

.form-row-two {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.form-col label {
  display: block;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  margin-bottom: 7px;
}

.form-col input {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 9px 12px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-col select {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 9px 12px;
  font-size: 14px;
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%232DD4BF' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}

.form-col select option {
  background: #0f2d4a;
  color: #fff;
  padding: 8px;
}

.form-col select optgroup {
  background: rgba(45, 212, 191, 0.15);
  color: #2DD4BF;
  font-weight: 600;
}

.form-col select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-row select {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 9px 12px;
  font-size: 14px;
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%232DD4BF' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}

.form-row select option {
  background: #0f2d4a;
  color: #fff;
}

.form-row select optgroup {
  background: rgba(45, 212, 191, 0.15);
  color: #2DD4BF;
  font-weight: 600;
}

.form-row {
  margin-bottom: 16px;
}

.form-row label {
  display: block;
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  margin-bottom: 7px;
  font-weight: 500;
}

.form-row input,
.form-row select,
.form-row textarea {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 9px 12px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-row textarea { resize: vertical; }

.cycle-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.cycle-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(45, 212, 191, 0.2);
  color: rgba(255, 255, 255, 0.6);
  padding: 5px 13px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.cycle-btn.active {
  background: rgba(45, 212, 191, 0.15);
  border-color: #2DD4BF;
  color: #2DD4BF;
}

.device-selector {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(45, 212, 191, 0.15);
  border-radius: 8px;
  padding: 12px;
}

.available-devices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.device-option {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.device-option.selected {
  background: rgba(45, 212, 191, 0.15);
  border-color: #2DD4BF;
  color: #2DD4BF;
}

.selected-count {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.device-check-config {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(45, 212, 191, 0.1);
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
}

.config-header {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.config-device {
  color: #2DD4BF;
  font-size: 13px;
  font-weight: 500;
}

.config-location {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.config-items label {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  margin-bottom: 5px;
  display: block;
}

.config-items textarea {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 6px;
  color: #fff;
  padding: 8px 10px;
  font-size: 13px;
  resize: vertical;
  box-sizing: border-box;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 15px 22px;
  border-top: 1px solid rgba(45, 212, 191, 0.1);
}

.btn-cancel {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.6);
  padding: 7px 18px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.btn-confirm {
  background: rgba(45, 212, 191, 0.15);
  border: 1px solid rgba(45, 212, 191, 0.4);
  color: #2DD4BF;
  padding: 7px 18px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.btn-confirm:hover { background: rgba(45, 212, 191, 0.25); }

/* 内容区 */
.tab-content {
  padding: 0 32px;
}

/* 进度条 */
.progress-section {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.progress-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.progress-value {
  color: #2DD4BF;
  font-size: 13px;
  font-weight: 600;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2DD4BF, #06B6D4);
  border-radius: 3px;
  transition: width 0.4s ease;
}

/* 设备卡片列表 */
.device-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.device-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.device-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(45, 212, 191, 0.2);
}

.device-card.done { opacity: 0.65; }

.card-check {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-check.done {
  background: rgba(45, 212, 191, 0.2);
  color: #2DD4BF;
}

.card-check.abnormal {
  background: rgba(251, 146, 60, 0.2);
  color: #fb923c;
}

.card-check.pending {
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.card-body { flex: 1; }

.card-name {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.card-location {
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.loc-icon { font-size: 11px; }

.card-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.card-status.abnormal {
  background: rgba(251, 146, 60, 0.15);
  color: #fb923c;
}

.card-status.pending {
  background: rgba(251, 146, 60, 0.15);
  color: #fb923c;
}

/* 保养概览 */
.maint-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.overview-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 14px 16px;
  text-align: center;
}

.overview-value {
  color: #2DD4BF;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}

.overview-label {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

/* 保养列表 */
.maint-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.maint-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
}

.maint-name {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.maint-equip {
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
}

.maint-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.maint-date-row { text-align: right; }

.date-label {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  display: block;
  margin-bottom: 2px;
}

.date-value {
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
}

.maint-days-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.maint-days-badge.normal {
  background: rgba(45, 212, 191, 0.15);
  color: #2DD4BF;
}

.maint-days-badge.urgent {
  background: rgba(251, 146, 60, 0.15);
  color: #fb923c;
}

/* 自定义时间 */
.custom-times-wrap {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.custom-time-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.custom-time-row input {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 6px 10px;
  font-size: 14px;
  width: 140px;
}

.btn-remove-time {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #FCA5A5;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-add-time {
  background: rgba(45, 212, 191, 0.1);
  border: 1px dashed rgba(45, 212, 191, 0.3);
  color: rgba(45, 212, 191, 0.7);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

/* 设备选项 */
.device-option {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  padding: 7px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.device-option.selected {
  background: rgba(45, 212, 191, 0.15);
  border-color: #2DD4BF;
  color: #2DD4BF;
}

.dev-name {
  font-weight: 500;
}

.dev-loc {
  font-size: 11px;
  opacity: 0.6;
}

/* 巡检项预览 */
.check-items-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.check-item-tag {
  background: rgba(45, 212, 191, 0.1);
  border: 1px solid rgba(45, 212, 191, 0.25);
  color: #2DD4BF;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
}

/* 执行人选择器 */
.executor-selector {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(45, 212, 191, 0.15);
  border-radius: 8px;
  padding: 14px;
}

.role-group {
  margin-bottom: 14px;
}

.role-group:last-child { margin-bottom: 0; }

.role-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.role-check-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.role-check-wrap input {
  width: 16px;
  height: 16px;
  accent-color: #2DD4BF;
}

.role-name {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}

.role-count {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.role-users {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-left: 24px;
}

.user-chip {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.user-chip:hover {
  background: rgba(255, 255, 255, 0.1);
}

.user-chip.selected {
  background: rgba(45, 212, 191, 0.2);
  border-color: #2DD4BF;
  color: #2DD4BF;
}

.no-roles {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  text-align: center;
  padding: 16px;
}

/* 巡检执行弹窗 */
.execute-info {
  margin-bottom: 16px;
}

.execute-device {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.execute-plan {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.execute-checklist {
  margin-bottom: 16px;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  margin-bottom: 8px;
}

.check-box-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.check-input {
  width: 20px;
  height: 20px;
  min-width: 20px;
  accent-color: #2DD4BF;
  cursor: pointer;
}

.check-label {
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  cursor: pointer;
  flex: 1;
}

.abnormal-section {
  margin-top: 12px;
}

.abnormal-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 10px;
}

.abnormal-label input {
  width: 18px;
  height: 18px;
  accent-color: #fb923c;
}

.abnormal-section textarea {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(251, 146, 60, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 10px;
  font-size: 14px;
  resize: vertical;
  box-sizing: border-box;
}

/* 任务列表中的检查项标签 */
.task-check-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.task-check-items .check-item-tag {
  font-size: 10px;
  padding: 2px 6px;
}

.task-remaining {
  font-size: 11px;
  color: #888;
  margin-top: 4px;
}
.task-remaining.urgent {
  color: #ff6b00;
}
.task-remaining.overdue {
  color: #e53e3e;
  font-weight: bold;
}
</style>