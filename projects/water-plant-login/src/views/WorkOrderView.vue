<template>
  <div class="wo-page">
    <TopNavBar />

    <!-- P1: 工单统计面板 (P2.1 工单 P1) -->
    <div v-if="stats" class="wo-stats-bar">
      <div class="stat-card">
        <div class="stat-label">今日新建</div>
        <div class="stat-value" style="color:#22c55e;">{{ stats.today.new }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">今日闭环</div>
        <div class="stat-value" style="color:#3b82f6;">{{ stats.today.closed }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">未闭环</div>
        <div class="stat-value" style="color:#fbbf24;">{{ stats.open }}</div>
      </div>
      <div class="stat-card" :class="{ alert: stats.sla.breached > 0 }">
        <div class="stat-label">SLA 超时</div>
        <div class="stat-value" :style="{ color: stats.sla.breached > 0 ? '#ef4444' : '#94a3b8' }">{{ stats.sla.breached }}</div>
      </div>
      <div class="stat-card" :class="{ alert: stats.sla.warning_2h > 0 }">
        <div class="stat-label">即将超时 (2h)</div>
        <div class="stat-value" :style="{ color: stats.sla.warning_2h > 0 ? '#fb923c' : '#94a3b8' }">{{ stats.sla.warning_2h }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">平均处理时长</div>
        <div class="stat-value-sm">{{ stats.avg_minutes.overall ? formatMinutes(stats.avg_minutes.overall) : '—' }}</div>
      </div>
    </div>

    <div class="wo-header">
      <div class="wo-title">
        <h2 v-if="currentUser.role === '值班岗位' || currentUser.role === '带班' || currentUser.role === '系统管理人'">{{ activeTab === 'maintenance' ? '维修工单' : '问题工单' }}</h2>
        <h2 v-else>维修工单</h2>
        <span v-if="currentUser.role === '维修组'" class="wo-stat">
          未接单 {{ maintenanceOrders.filter(o => o.status === 'pending').length }}
        </span>
        <span v-if="currentUser.role === '维修组'" class="wo-stat">
          进行中 {{ maintenanceOrders.filter(o => o.status === 'processing' || o.status === 'delay' || o.status === 'returned').length }}
        </span>
        <span v-if="currentUser.role === '维修组'" class="wo-stat">
          已完成 {{ maintenanceOrders.filter(o => o.status === 'completed' || o.status === 'closed').length }}
        </span>
        <span v-if="(currentUser.role === '值班岗位' || currentUser.role === '带班' || currentUser.role === '系统管理人') && activeTab === 'maintenance'" class="wo-stat">
          未接单 {{ maintenanceOrders.filter(o => o.status === 'pending').length }}
        </span>
        <span v-if="(currentUser.role === '值班岗位' || currentUser.role === '带班' || currentUser.role === '系统管理人') && activeTab === 'maintenance'" class="wo-stat">
          进行中 {{ maintenanceOrders.filter(o => o.status === 'processing' || o.status === 'delay' || o.status === 'returned').length }}
        </span>
        <span v-if="(currentUser.role === '值班岗位' || currentUser.role === '带班' || currentUser.role === '系统管理人') && activeTab === 'maintenance'" class="wo-stat">
          已完成 {{ maintenanceOrders.filter(o => o.status === 'completed' || o.status === 'closed').length }}
        </span>
        <span v-if="(currentUser.role === '值班岗位' || currentUser.role === '带班' || currentUser.role === '系统管理人') && activeTab === 'problem'" class="wo-stat">
          未处理 {{ problemOrders.filter(o => o.status === 'pending').length }}
        </span>
        <span v-if="(currentUser.role === '值班岗位' || currentUser.role === '带班' || currentUser.role === '系统管理人') && activeTab === 'problem'" class="wo-stat">
          转维修 {{ problemOrders.filter(o => o.status === 'to_maintenance').length }}
        </span>
        <span v-if="(currentUser.role === '值班岗位' || currentUser.role === '带班' || currentUser.role === '系统管理人') && activeTab === 'problem'" class="wo-stat">
          已解决 {{ problemOrders.filter(o => o.status === 'self_resolved' && isRecentResolved(o)).length }}
        </span>
      </div>
      <div v-if="wsAmIOnShift || hasAny(['btn:wo_create_problem', 'btn:wo_create_maintenance'])" class="wo-actions">
        <button v-if="has('btn:wo_create_maintenance')" class="dm-btn dm-btn-primary" @click="openCreateMaintenanceDialog()">+ 新建维修工单</button>
        <button v-if="has('btn:wo_create_problem')" class="dm-btn dm-btn-primary" @click="openCreateDialog()">+ 新建问题工单</button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="wo-search">
      <select v-model="searchStatus" class="search-select">
        <option value="">全部状态</option>
        <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
      <button class="dm-btn dm-btn-search" @click="doSearch">🔍 搜索</button>
      <button class="dm-btn dm-btn-reset" @click="resetSearch">重置</button>
    </div>

    <!-- Tabs -->
    <div class="dm-tabs">
      <div v-if="currentUser.role !== '维修组'" class="dm-tab" :class="{ active: activeTab === 'problem' }" @click="activeTab = 'problem'">问题工单</div>
      <div class="dm-tab" :class="{ active: activeTab === 'maintenance' }" @click="activeTab = 'maintenance'">维修工单</div>
    </div>

    <!-- 问题工单列表 -->
    <div v-show="activeTab === 'problem'" class="wo-list">
      <div v-for="order in filteredProblemOrders" :key="order.id" class="wo-card" @click="openProblemDetail(order)">
        <div class="wo-card-header">
          <span class="wo-id">{{ order.id }}</span>
          <span class="wo-status" :style="{ background: statusColor(order.status) }">{{ statusLabel(order.status) }}</span>
        </div>
        <div class="wo-card-body">
          <p class="wo-content">{{ order.content }}</p>
          <div class="wo-meta">
            <span>{{ order.team || '' }} {{ order.role || '值班岗位' }} · {{ order.memberName || order.reporterName }}</span>
            <span>创建:{{ order.createdAt }}</span>
            <span v-if="order.lastActionAt && order.lastActionAt !== order.createdAt">最新处理:{{ order.lastActionAt }}</span>
            <span v-if="order.closedAt" style="color:#16a34a;">闭环:{{ order.closedAt }}</span>
            <!-- P1: SLA 倒计时 -->
            <span v-if="order.sla_due_at && !['closed','completed','self_resolved'].includes(order.status)" :style="{ color: slaColor(order.sla_due_at, order.status), fontWeight: 600 }">
              ⏱ {{ slaText(order.sla_due_at, order.status) }}
            </span>
          </div>
          <div v-if="order.images.length || ('videos' in order && order.videos?.length)" class="wo-attachments">
            <div v-if="order.images.length" class="wo-thumbs">
              <img v-for="(img, idx) in order.images.slice(0, 4)" :key="'img-'+idx" :src="img" class="wo-thumb" @click.stop="openImagePreview(order.images, idx)" />
              <span v-if="order.images.length > 4" class="wo-thumb-more">+{{ order.images.length - 4 }}</span>
            </div>
            <span v-if="'videos' in order && order.videos.length" class="wo-video-badge">🎬 {{ order.videos.length }}</span>
          </div>
          <div v-if="order.resolution" class="wo-resolution">
            <strong>处理结果:</strong>{{ order.resolution }}
            <div v-if="order.resolutionImages && order.resolutionImages.length" class="wo-thumbs" style="margin-top:6px;">
              <img v-for="(img, idx) in order.resolutionImages.slice(0, 4)" :key="'ri-'+idx" :src="img" class="wo-thumb" @click.stop="openImagePreview(order.resolutionImages, idx)" />
              <span v-if="order.resolutionImages.length > 4" class="wo-thumb-more">+{{ order.resolutionImages.length - 4 }}</span>
            </div>
          </div>
        </div>
        <div class="wo-card-actions">
          <button v-if="canHandleProblem(order)" class="action-btn" @click.stop="openProblemHandle(order)">处理</button>
          <button v-if="has('btn:wo_delete_problem')" class="action-btn action-btn-danger" @click.stop="openProblemDelete(order)">删除</button>
        </div>
      </div>
      <div v-if="filteredProblemOrders.length === 0" class="empty-row">暂无问题工单</div>
    </div>

    <!-- 维修工单列表 -->
    <div v-show="activeTab === 'maintenance'" class="wo-list">
      <div v-for="order in filteredMaintenanceOrders" :key="order.id" class="wo-card" @click="openMaintenanceDetail(order)">
        <div class="wo-card-header">
          <span class="wo-id">{{ order.id }}</span>
          <span class="wo-level" :class="`level-${order.level}`">{{ levelLabel(order.level) }}级</span>
          <span class="wo-status" :style="{ background: statusColor(order.status) }">{{ statusLabel(order.status) }}</span>
        </div>
        <div class="wo-card-body">
          <p class="wo-content">{{ order.content || '维修任务' }}</p>
          <div class="wo-meta">
            <span v-if="order.reporterName">{{ order.team || '' }} {{ order.role || '值班岗位' }} · {{ order.memberName || order.reporterName }}</span>
            <span>分派:{{ order.assignerName }}</span>
            <span v-if="order.handlerName">接单:{{ order.handlerName }}</span>
            <span>创建:{{ order.createdAt }}</span>
            <span v-if="order.lastActionAt && order.lastActionAt !== order.createdAt">最新处理:{{ order.lastActionAt }}</span>
            <span v-if="order.closedAt" style="color:#16a34a;">闭环:{{ order.closedAt }}</span>
            <!-- P1: SLA 倒计时 -->
            <span v-if="order.sla_due_at && !['closed','completed'].includes(order.status)" :style="{ color: slaColor(order.sla_due_at, order.status), fontWeight: 600 }">
              ⏱ {{ slaText(order.sla_due_at, order.status) }}
            </span>
          </div>
          <div v-if="order.delayReason" class="wo-delay">
            <strong>延时原因:</strong>{{ order.delayReason }}
            <div v-if="order.delayImages && order.delayImages.length" class="wo-thumbs" style="margin-top:6px;">
              <img v-for="(img, idx) in order.delayImages.slice(0, 4)" :key="'di-'+idx" :src="img" class="wo-thumb" @click.stop="openImagePreview(order.delayImages, idx)" />
              <span v-if="order.delayImages.length > 4" class="wo-thumb-more">+{{ order.delayImages.length - 4 }}</span>
            </div>
          </div>
          <div v-if="order.returnReason" class="wo-return">
            <strong>退回原因:</strong>{{ order.returnReason }}
            <div v-if="order.returnImages && order.returnImages.length" class="wo-thumbs" style="margin-top:6px;">
              <img v-for="(img, idx) in order.returnImages.slice(0, 4)" :key="'ri-'+idx" :src="img" class="wo-thumb" @click.stop="openImagePreview(order.returnImages, idx)" />
              <span v-if="order.returnImages.length > 4" class="wo-thumb-more">+{{ order.returnImages.length - 4 }}</span>
            </div>
          </div>
          <div v-if="order.completionNote" class="wo-resolution">
            <strong>完成说明:</strong>{{ order.completionNote }}
            <div v-if="order.completionImages && order.completionImages.length" class="wo-thumbs" style="margin-top:6px;">
              <img v-for="(img, idx) in order.completionImages.slice(0, 4)" :key="'ci-'+idx" :src="img" class="wo-thumb" @click.stop="openImagePreview(order.completionImages, idx)" />
              <span v-if="order.completionImages.length > 4" class="wo-thumb-more">+{{ order.completionImages.length - 4 }}</span>
            </div>
          </div>
        </div>
        <div class="wo-card-actions">
          <button v-if="canAcceptOrder(order)" class="action-btn" @click.stop="acceptOrder(order)">接单</button>
          <button v-if="canDelayOrder(order)" class="action-btn" @click.stop="openDelayDialog(order)">延时</button>
          <button v-if="has('btn:wo_complete') && (order.status === 'processing' || order.status === 'delay' || order.status === 'returned')" class="action-btn action-btn-primary" @click.stop="openCompleteDialog(order)">完成</button>
          <button v-if="has('btn:wo_close_problem') && order.status === 'processing'" class="action-btn action-btn-primary" @click.stop="openProblemCloseDialog(order)">问题工单闭环</button>
          <button v-if="has('btn:wo_review') && order.status === 'completed'" class="action-btn" @click.stop="openReviewDialog(order)">审核</button>
          <button v-if="has('btn:wo_delete_maintenance')" class="action-btn action-btn-danger" @click.stop="openMaintenanceDelete(order)">删除</button>
        </div>
      </div>
      <div v-if="filteredMaintenanceOrders.length === 0" class="empty-row">暂无维修工单</div>
    </div>

    <!-- 新建问题工单弹窗 -->
    <div v-if="createDialogVisible" class="dm-dialog-overlay" @click.self="createDialogVisible = false">
      <div class="dm-dialog">
        <div class="dialog-header">
          <h3>新建问题工单</h3>
          <button class="dialog-close" @click="createDialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row" v-if="problemTemplates.length">
            <label>从模板创建</label>
            <select :value="selectedProblemTplId" @change="e => applyTemplate('problem', (e.target as HTMLSelectElement).value)" class="tpl-select">
              <option value="">-- 选模板自动填描述 --</option>
              <option v-for="t in problemTemplates" :key="t.id" :value="t.id">{{ t.name }} {{ t.category ? `(${t.category})` : '' }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>问题描述 <span class="required">*</span></label>
            <textarea v-model="createForm.content" placeholder="请描述发现的问题" rows="4"></textarea>
          </div>
          <div class="form-row">
            <label>关联设备</label>
            <select v-model="createForm.deviceId">
              <option :value="null">-- 不关联设备 --</option>
              <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }} ({{ d.location }})</option>
            </select>
          </div>
          <div class="form-row">
            <label>图片</label>
            <input type="file" accept="image/*" multiple @change="e => handleImageUpload(e, createForm)" />
            <div v-if="createForm.images" class="upload-preview">
              <span v-for="(img, idx) in createForm.images.split(',')" :key="idx" class="preview-item">{{ img }}</span>
            </div>
          </div>
          <div class="form-row">
            <label>视频</label>
            <input type="file" accept="video/*" multiple @change="e => handleVideoUpload(e, createForm)" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="createDialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-primary" @click="submitCreateProblem">提交</button>
        </div>
      </div>
    </div>

    <!-- 新建维修工单弹窗(带班直接创建)-->
    <div v-if="createMaintenanceDialogVisible" class="dm-dialog-overlay" @click.self="createMaintenanceDialogVisible = false">
      <div class="dm-dialog">
        <div class="dialog-header">
          <h3>新建维修工单</h3>
          <button class="dialog-close" @click="createMaintenanceDialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row" v-if="maintenanceTemplates.length">
            <label>从模板创建</label>
            <select :value="selectedMaintenanceTplId" @change="e => applyTemplate('maintenance', (e.target as HTMLSelectElement).value)" class="tpl-select">
              <option value="">-- 选模板自动填内容+等级 --</option>
              <option v-for="t in maintenanceTemplates" :key="t.id" :value="t.id">{{ t.name }} {{ t.default_level ? `[${t.default_level}]` : '' }} {{ t.default_sla_hours ? `(${t.default_sla_hours}h)` : '' }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>维修内容 <span class="required">*</span></label>
            <textarea v-model="createMaintenanceForm.content" placeholder="请描述维修内容" rows="4"></textarea>
          </div>
          <div class="form-row">
            <label>维修级别</label>
            <select v-model="createMaintenanceForm.level">
              <option value="light">轻度</option>
              <option value="medium">中度</option>
              <option value="heavy">重度</option>
            </select>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="createMaintenanceDialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-primary" @click="submitCreateMaintenance">提交</button>
        </div>
      </div>
    </div>

    <!-- 处理问题工单弹窗(自行解决) -->
    <div v-if="handleDialogVisible" class="dm-dialog-overlay" @click.self="handleDialogVisible = false">
      <div class="dm-dialog">
        <div class="dialog-header">
          <h3>处理问题工单</h3>
          <button class="dialog-close" @click="handleDialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label>处理方式</label>
            <div class="radio-group">
              <label class="radio-item"><input type="radio" v-model="handleType" value="self" /> 自行解决</label>
              <label class="radio-item"><input type="radio" v-model="handleType" value="maintenance" /> 转维修工单</label>
            </div>
          </div>
          <div v-if="handleType === 'self'" class="form-row">
            <label>解决说明 <span class="required">*</span></label>
            <textarea v-model="handleForm.resolution" placeholder="请描述解决方式" rows="3"></textarea>
          </div>
          <div v-if="handleType === 'self'" class="form-row">
            <label>解决图片</label>
            <input type="file" accept="image/*" multiple @change="e => handleImageUpload(e, handleForm)" />
            <div v-if="handleForm.images" class="upload-preview">
              <span v-for="(img, idx) in handleForm.images.split(',')" :key="idx" class="preview-item">{{ img.split('/').pop() }}</span>
            </div>
          </div>
          <div v-if="handleType === 'maintenance'" class="form-row">
            <label>维修级别 <span class="required">*</span></label>
            <select v-model="handleForm.level">
              <option value="light">轻度</option>
              <option value="medium">中度</option>
              <option value="heavy">重度</option>
            </select>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="handleDialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-primary" @click="submitHandleProblem">提交</button>
        </div>
      </div>
    </div>

    <!-- 延时弹窗 -->
    <div v-if="delayDialogVisible" class="dm-dialog-overlay" @click.self="delayDialogVisible = false">
      <div class="dm-dialog dm-dialog-sm">
        <div class="dialog-header">
          <h3>申请延时</h3>
          <button class="dialog-close" @click="delayDialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label>延时原因 <span class="required">*</span></label>
            <textarea v-model="delayForm.reason" placeholder="请填写延时原因" rows="3"></textarea>
          </div>
          <div class="form-row">
            <label>图片</label>
            <input type="file" accept="image/*" multiple @change="e => handleImageUpload(e, delayForm)" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="delayDialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-primary" @click="submitDelay">提交</button>
        </div>
      </div>
    </div>

    <!-- 完成维修弹窗 -->
    <div v-if="completeDialogVisible" class="dm-dialog-overlay" @click.self="completeDialogVisible = false">
      <div class="dm-dialog">
        <div class="dialog-header">
          <h3>完成维修</h3>
          <button class="dialog-close" @click="completeDialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label>维修说明</label>
            <textarea v-model="completeForm.note" placeholder="请描述维修情况" rows="3"></textarea>
          </div>
          <div class="form-row">
            <label>完成图片</label>
            <input type="file" accept="image/*" multiple @change="e => handleImageUpload(e, completeForm)" />
          </div>
          <div class="form-row">
            <label>参与人员</label>
            <input type="text" v-model="completeForm.participants" placeholder="参与人员,多个用逗号分隔" />
          </div>
          <div class="form-row">
            <label>备件使用</label>
            <div v-for="(sp, idx) in completeForm.spareparts" :key="idx" class="sparepart-row">
              <input v-model="sp.name" type="text" placeholder="备件名称" />
              <input v-model="sp.quantity" type="number" placeholder="数量" min="1" />
              <input v-model="sp.specs" type="text" placeholder="规格" />
              <button class="icon-btn" @click="completeForm.spareparts.splice(idx, 1)">×</button>
            </div>
            <button class="dm-btn dm-btn-sm" @click="completeForm.spareparts.push({ name: '', quantity: 1, specs: '' })">+ 添加备件</button>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="completeDialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-primary" @click="submitComplete">提交</button>
        </div>
      </div>
    </div>

    <!-- 问题工单闭环弹窗 -->
    <div v-if="problemCloseDialogVisible" class="dm-dialog-overlay" @click.self="problemCloseDialogVisible = false">
      <div class="dm-dialog dm-dialog-sm">
        <div class="dialog-header">
          <h3>问题工单闭环</h3>
          <button class="dialog-close" @click="problemCloseDialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label>闭环原因(图文)<span class="required">*</span></label>
            <textarea v-model="problemCloseForm.reason" placeholder="请说明发现的问题原因和解决方案" rows="4"></textarea>
          </div>
          <div class="form-row">
            <label>图片</label>
            <input type="file" accept="image/*" multiple @change="e => handleImageUpload(e, problemCloseForm)" />
            <div v-if="problemCloseForm.images" class="upload-preview">
              <span v-for="(img, idx) in problemCloseForm.images.split(',')" :key="idx" class="preview-item">{{ img.split('/').pop() }}</span>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="problemCloseDialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-primary" @click="submitProblemClose">确认闭环</button>
        </div>
      </div>
    </div>

    <!-- 审核弹窗 -->
    <div v-if="reviewDialogVisible" class="dm-dialog-overlay" @click.self="reviewDialogVisible = false">
      <div class="dm-dialog dm-dialog-sm">
        <div class="dialog-header">
          <h3>审核维修结果</h3>
          <button class="dialog-close" @click="reviewDialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label>审核结果</label>
            <div class="radio-group">
              <label class="radio-item"><input type="radio" v-model="reviewResult" value="pass" /> 通过</label>
              <label class="radio-item"><input type="radio" v-model="reviewResult" value="reject" /> 不通过</label>
            </div>
          </div>
          <div v-if="reviewResult === 'reject'" class="form-row">
            <label>退回原因 <span class="required">*</span></label>
            <textarea v-model="reviewForm.reason" placeholder="请说明退回原因" rows="3"></textarea>
          </div>
          <div v-if="reviewResult === 'reject'" class="form-row">
            <label>退回图片</label>
            <input type="file" accept="image/*" multiple @change="e => handleImageUpload(e, reviewForm)" />
            <div v-if="reviewForm.images" class="upload-preview">
              <span v-for="(img, idx) in reviewForm.images.split(',')" :key="idx" class="preview-item">{{ img.split('/').pop() }}</span>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="reviewDialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-primary" @click="submitReview">提交</button>
        </div>
      </div>
    </div>

    <!-- 工单详情弹窗 -->
    <div v-if="detailDialogVisible" class="dm-dialog-overlay" @click.self="detailDialogVisible = false">
      <div class="dm-dialog">
        <div class="dialog-header">
          <h3>工单详情</h3>
          <button class="dialog-close" @click="detailDialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <template v-if="detailOrder">
            <div class="detail-row"><label>工单编号:</label><span>{{ detailOrder.id }}</span></div>
            <div class="detail-row"><label>状态:</label><span :style="{ color: statusColor(detailOrder.status) }">{{ statusLabel(detailOrder.status) }}</span></div>
            <div class="detail-row"><label>内容:</label><span>{{ detailOrder.content || '无' }}</span></div>
            <div v-if="'handlerName' in detailOrder && detailOrder.handlerName" class="detail-row"><label>接单人:</label><span>{{ detailOrder.handlerName }}</span></div>
            <div v-if="'reporterName' in detailOrder && detailOrder.reporterName" class="detail-row">
              <label>报告人:</label>
              <span>
                {{ detailOrder.reporterName }}
                <span v-if="detailOrder.memberName" style="color:rgba(255,255,255,0.5);">(岗位人员:{{ detailOrder.memberName }})</span>
                <span v-if="detailOrder.role" style="color:rgba(255,255,255,0.5);"> · {{ detailOrder.role }}</span>
              </span>
            </div>
            <div v-if="'sparepartUsage' in detailOrder && detailOrder.sparepartUsage.length" class="detail-row">
              <label>备件使用:</label>
              <div v-for="sp in detailOrder.sparepartUsage" :key="sp.name" class="sp-item">{{ sp.name }} × {{ sp.quantity }}</div>
            </div>
          </template>
        </div>
        <div class="dialog-footer">
          <button v-if="has('btn:wo_edit') && detailOrder && 'status' in detailOrder && !['closed', 'completed'].includes(detailOrder.status)" class="dm-btn" @click="openEditDialog(detailOrder)">编辑</button>
          <button v-if="has('btn:wo_edit') && detailOrder && 'status' in detailOrder && !['closed', 'completed'].includes(detailOrder.status)" class="dm-btn" @click="returnOrder(detailOrder)">退回</button>
          <button class="dm-btn dm-btn-cancel" @click="detailDialogVisible = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 编辑工单弹窗 -->
    <div v-if="editDialogVisible" class="dm-dialog-overlay" @click.self="editDialogVisible = false">
      <div class="dm-dialog">
        <div class="dialog-header">
          <h3>编辑工单</h3>
          <button class="dialog-close" @click="editDialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label>工单内容 <span class="required">*</span></label>
            <textarea v-model="editForm.content" placeholder="请描述工单内容" rows="4"></textarea>
          </div>
          <div v-if="'level' in (detailOrder || {})" class="form-row">
            <label>维修级别</label>
            <select v-model="editForm.level">
              <option value="light">轻度</option>
              <option value="medium">中度</option>
              <option value="heavy">重度</option>
            </select>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="editDialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-primary" @click="submitEdit">保存</button>
        </div>
      </div>
    </div>

    <!-- 删除问题工单弹窗 -->
    <div v-if="problemDeleteVisible" class="dm-dialog-overlay" @click.self="problemDeleteVisible = false">
      <div class="dm-dialog">
        <div class="dialog-header">
          <h3>删除问题工单</h3>
          <button class="dialog-close" @click="problemDeleteVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <p>确定要删除问题工单 <strong>{{ deletingProblemOrder?.id }}</strong> 吗?此操作不可恢复。</p>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="problemDeleteVisible = false">取消</button>
          <button class="dm-btn dm-btn-danger" @click="confirmProblemDelete">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 删除维修工单弹窗 -->
    <div v-if="maintenanceDeleteVisible" class="dm-dialog-overlay" @click.self="maintenanceDeleteVisible = false">
      <div class="dm-dialog">
        <div class="dialog-header">
          <h3>删除维修工单</h3>
          <button class="dialog-close" @click="maintenanceDeleteVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <p>确定要删除维修工单 <strong>{{ deletingMaintenanceOrder?.id }}</strong> 吗?此操作不可恢复。</p>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="maintenanceDeleteVisible = false">取消</button>
          <button class="dm-btn dm-btn-danger" @click="confirmMaintenanceDelete">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <div v-if="previewImages.length > 0" class="image-preview-mask" @click.self="closeImagePreview">
      <button class="image-preview-close" @click="closeImagePreview">×</button>
      <button v-if="previewImages.length > 1" class="image-preview-nav left" :disabled="previewIndex === 0" @click="previewIndex = (previewIndex - 1 + previewImages.length) % previewImages.length">‹</button>
      <div class="image-preview-content">
        <img :src="previewImages[previewIndex]" />
      </div>
      <button v-if="previewImages.length > 1" class="image-preview-nav right" :disabled="previewIndex === previewImages.length - 1" @click="previewIndex = (previewIndex + 1) % previewImages.length">›</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import TopNavBar from '../components/TopNavBar.vue'
import { currentUser, updateDeviceStatusByOrder, isOnDuty, loadDevicesFromDB, devices } from '../composables/useDeviceStore'
import { usePermission } from '../composables/usePermission'
import {
  matchDeviceByContent, problemOrders, maintenanceOrders,
  addProblemOrder, updateProblemOrder,
  addMaintenanceOrder, updateMaintenanceOrder,
  deleteProblemOrder, deleteMaintenanceOrder, recreateProblemFromMaintenance,
  initDeviceStatusFromWorkOrders,
  statusLabel, statusColor, levelLabel,
  ProblemWorkOrder, MaintenanceWorkOrder
} from '../composables/useWorkOrderStore'

// P0-5: 权限钩子
const { has, hasAny } = usePermission()

// P1: SLA 跟踪 (P2.1 工单 P1)
// 状态: normal (绿) / warning (黄, 2h 内) / urgent (橙色, 30min 内) / breached (红, 已超时)
function slaStatus(sla_due_at: string, status: string): 'normal' | 'warning' | 'urgent' | 'breached' | 'none' {
  if (!sla_due_at) return 'none'
  if (['closed', 'completed', 'self_resolved'].includes(status)) return 'normal'
  const ms = new Date(sla_due_at).getTime() - Date.now()
  if (ms <= 0) return 'breached'
  if (ms <= 30 * 60 * 1000) return 'urgent'
  if (ms <= 2 * 3600 * 1000) return 'warning'
  return 'normal'
}
function slaText(sla_due_at: string, status: string): string {
  const s = slaStatus(sla_due_at, status)
  if (s === 'none') return ''
  if (s === 'breached') {
    const overdueMin = Math.round((Date.now() - new Date(sla_due_at).getTime()) / 60000)
    if (overdueMin < 60) return `SLA 超时 ${overdueMin} 分钟`
    if (overdueMin < 60 * 24) return `SLA 超时 ${Math.floor(overdueMin / 60)} 小时 ${overdueMin % 60} 分`
    return `SLA 超时 ${Math.floor(overdueMin / 60 / 24)} 天`
  }
  const remainMin = Math.round((new Date(sla_due_at).getTime() - Date.now()) / 60000)
  if (remainMin < 60) return `SLA 剩余 ${remainMin} 分钟`
  if (remainMin < 60 * 24) return `SLA 剩余 ${Math.floor(remainMin / 60)} 小时 ${remainMin % 60} 分`
  return `SLA 剩余 ${Math.floor(remainMin / 60 / 24)} 天`
}
function slaColor(sla_due_at: string, status: string): string {
  const s = slaStatus(sla_due_at, status)
  if (s === 'breached') return '#ef4444'  // 红
  if (s === 'urgent') return '#fb923c'    // 橙
  if (s === 'warning') return '#facc15'   // 黄
  return '#22c55e'                        // 绿
}

// P1: 工单统计面板 (P2.1)
const stats = ref<any>(null)
async function loadWorkorderStats() {
  try {
    const r = await fetch('/api/workorders/stats?days=7')
    if (!r.ok) return
    stats.value = await r.json()
  } catch {}
}
function formatMinutes(min: number): string {
  if (min < 60) return `${min} 分钟`
  if (min < 60 * 24) return `${Math.floor(min / 60)} 小时 ${min % 60} 分`
  return `${Math.floor(min / 60 / 24)} 天 ${Math.floor((min / 60) % 24)} 小时`
}

// 从数据库同步问题工单
async function syncProblemOrdersFromDB() {
  try {
    const res = await fetch('/api/workorders/problem')
    const dbOrders = await res.json()
    // 合并到本地(去重),优先用数据库中的device_id,fallback到关键词匹配
    for (const o of dbOrders) {
      const exists = problemOrders.value.find(p => p.id === o.id)
      // 优先用数据库中已有的device_id,否则用关键词匹配
      const dbDeviceId = o.device_id ? String(o.device_id) : null
      const orderDeviceId = dbDeviceId || matchDeviceByContent(o.content || '') || undefined
      if (!exists) {
        problemOrders.value.push({
          id: o.id,
          reporterId: o.reporter_name || o.reporterId,
          reporterName: o.reporter_name || '',
          content: o.content,
          status: o.status,
          shiftId: '',
          deviceId: orderDeviceId,
          images: typeof o.images === 'string' ? (o.images || '').split(',').map((s: string) => s.trim()).filter(Boolean) : (o.images || []),
          videos: typeof o.videos === 'string' ? (o.videos || '').split(',').map((s: string) => s.trim()).filter(Boolean) : (o.videos || []),
          resolutionImages: typeof o.resolution_images === 'string' ? (o.resolution_images || '').split(',').map((s: string) => s.trim()).filter(Boolean) : (o.resolution_images || []),
          createdAt: new Date(o.created_at).toLocaleString('zh-CN'),
          resolution: o.resolution,
          role: o.role || '',
          memberName: o.member_name || '',
          team: o.team || '',
          lastActionAt: o.last_action_at ? new Date(o.last_action_at).toLocaleString('zh-CN') : '',
          closedAt: o.closed_at ? new Date(o.closed_at).toLocaleString('zh-CN') : '',
          sla_due_at: o.sla_due_at,  // P1: SLA 跟踪
          sla_hours: o.sla_hours
        })
      } else {
        // 更新已有工单的deviceId
        const idx = problemOrders.value.findIndex(p => p.id === o.id)
        if (idx !== -1) {
          problemOrders.value[idx] = { ...problemOrders.value[idx], deviceId: orderDeviceId }
        }
      }
    }
  } catch {}
}

async function syncMaintenanceOrdersFromDB() {
  try {
    const res = await fetch('/api/workorders/maintenance')
    const dbOrders = await res.json()
    // 完全替换内存数据,保证与数据库同步
    maintenanceOrders.value = dbOrders.map((o: any) => ({
      id: String(o.id),
      content: o.content,
      level: o.level || 'medium',
      status: o.status,
      assignerId: o.assigner_name || '',
      assignerName: o.assigner_name || '',
      handlerId: o.handler_name || '',
      handlerName: o.handler_name || '',
      problemOrderId: o.problem_order_id || null,
      participants: typeof o.participants === 'string' ? JSON.parse(o.participants || '[]') : (o.participants || []),
      delayDays: o.delay_days || 0,
      delayReason: o.delay_reason || '',
      delayImages: typeof o.delay_images === 'string' ? JSON.parse(o.delay_images || '[]') : (o.delay_images || []),
      sparepartUsage: typeof o.sparepart_usage === 'string' ? JSON.parse(o.sparepart_usage || '[]') : (o.sparepart_usage || []),
      returnReason: o.return_reason || '',
      returnImages: typeof o.return_images === 'string' ? (o.return_images || '').split(',').map((s: string) => s.trim()).filter(Boolean) : (o.return_images || []),
      completionNote: o.completion_note || '',
      completionImages: typeof o.completion_images === 'string' ? JSON.parse(o.completion_images || '[]') : (o.completion_images || []),
      reporterName: o.reporter_name || '',
      memberName: o.member_name || '',
      role: o.role || '',
      team: o.team || '',
      createdAt: o.created_at ? new Date(o.created_at).toLocaleString('zh-CN') : '',
      lastActionAt: o.last_action_at ? new Date(o.last_action_at).toLocaleString('zh-CN') : '',
      closedAt: o.closed_at ? new Date(o.closed_at).toLocaleString('zh-CN') : '',
      sla_due_at: o.sla_due_at,  // P1: SLA 跟踪
      sla_hours: o.sla_hours
    }))
  } catch {}
}

let syncTimer: any = null
async function loadShiftStatus() {
  if (!currentUser.value?.role) return
  try {
    const r = await fetch(`/api/handover/status?role=${encodeURIComponent(currentUser.value.role)}`)
    const d = await r.json()
    wsCurrentShift.value = d.currentShift || null
  } catch(e) {}
}
onMounted(() => {
  loadWorkorderTemplates()
  loadWorkorderStats()
  loadDevicesFromDB().then(() => {
    syncProblemOrdersFromDB().then(() => {
      syncMaintenanceOrdersFromDB().then(() => {
        initDeviceStatusFromWorkOrders()
        // 处理URL参数触发的弹窗
        const action = route.query.action as string | undefined
        if (action === 'createMaintenance') {
          activeTab.value = 'maintenance'
          createMaintenanceDialogVisible.value = true
          createMaintenanceForm.value = { content: '', level: 'medium' }
        } else if (action === 'createProblem') {
          activeTab.value = 'problem'
          createDialogVisible.value = true
          createForm.value = { content: '', images: '', videos: '', deviceId: null }
        }
      })
    })
  })
  loadShiftStatus()
  syncTimer = setInterval(() => {
    syncProblemOrdersFromDB()
    syncMaintenanceOrdersFromDB().then(() => {
      initDeviceStatusFromWorkOrders()
    })
  }, 5000)
})
onUnmounted(() => { if (syncTimer) clearInterval(syncTimer) })

// Tab
const activeTab = ref<'problem' | 'maintenance'>(currentUser.value.role === '维修组' ? 'maintenance' : 'problem')
const searchStatus = ref('')

// ============ 状态选项 ============
const route = useRoute()
const allStatusOptions = [
  { value: 'pending', label: '待确认' },
  { value: 'self_resolved', label: '已自行解决' },
  { value: 'to_maintenance', label: '转维修' },
  { value: 'processing', label: '处理中' },
  { value: 'delay', label: '延时中' },
  { value: 'completed', label: '已完成待审核' },
  { value: 'returned', label: '已退回' },
  { value: 'closed', label: '已闭环' }
]

const statusOptions = computed(() => {
  if (activeTab.value === 'maintenance') {
    // 维修工单状态
    return allStatusOptions.filter(o => ['pending', 'processing', 'delay', 'completed', 'returned', 'closed'].includes(o.value))
  }
  // 问题工单状态
  return allStatusOptions.filter(o => ['pending', 'self_resolved', 'to_maintenance', 'closed'].includes(o.value))
})

// ============ 搜索 ============
const activeSearchStatus = ref('')
function doSearch() { activeSearchStatus.value = searchStatus.value }
function resetSearch() { searchStatus.value = ''; activeSearchStatus.value = '' }

// ============ 过滤 ============
const isRecentResolved = (o: { closedAt?: string }) => {
  if (!o.closedAt) return false
  const closed = new Date(o.closedAt)
  const now = new Date()
  const diffDays = (now.getTime() - closed.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays <= 7
}

// 问题工单排序: 待确认 > 转维修 > 已闭环
const problemStatusOrder: Record<string, number> = { 'pending': 1, 'to_maintenance': 2, 'self_resolved': 3, 'closed': 3 }

const filteredProblemOrders = computed(() => {
  const filtered = problemOrders.value.filter(o => {
    if (!activeSearchStatus.value) return true
    return o.status === activeSearchStatus.value
  })
  return filtered.sort((a, b) => (problemStatusOrder[a.status] || 99) - (problemStatusOrder[b.status] || 99))
})

// 维修工单排序
const maintenanceStatusOrder_维修组: Record<string, number> = { 'pending': 1, 'processing': 2, 'delay': 3, 'completed': 4, 'returned': 5, 'closed': 6 }
const maintenanceStatusOrder_其他: Record<string, number> = { 'completed': 1, 'pending': 2, 'processing': 3, 'delay': 4, 'returned': 5, 'closed': 6 }
const levelOrder: Record<string, number> = { 'heavy': 1, 'medium': 2, 'light': 3 }

const filteredMaintenanceOrders = computed(() => {
  const is维修组OrAdmin = currentUser.value.role === '维修组' || currentUser.value.role === '系统管理人'
  const statusOrder = is维修组OrAdmin ? maintenanceStatusOrder_维修组 : maintenanceStatusOrder_其他
  const filtered = maintenanceOrders.value.filter(o => {
    if (!activeSearchStatus.value) return true
    return o.status === activeSearchStatus.value
  })
  return filtered.sort((a, b) => {
    const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99)
    if (statusDiff !== 0) return statusDiff
    // 同状态按等级排序:重 > 中 > 轻
    return (levelOrder[a.level] || 99) - (levelOrder[b.level] || 99)
  })
})

// ============ 权限判断 ============
function canHandleProblem(order: ProblemWorkOrder) {
  return (currentUser.value.role === '带班' || currentUser.value.role === '系统管理人') && order.status === 'pending'
}

function canAcceptOrder(order: MaintenanceWorkOrder) {
  return (currentUser.value.role === '维修组' || currentUser.value.role === '系统管理人') && order.status === 'pending' && !order.handlerId
}

function canDelayOrder(order: MaintenanceWorkOrder) {
  return (currentUser.value.role === '维修组' || currentUser.value.role === '系统管理人') && order.status === 'processing'
}

// ============ 新建问题工单 ============
const createDialogVisible = ref(false)
const createMaintenanceDialogVisible = ref(false)
const wsCurrentShift = ref<any>(null)
const wsAmIOnShift = computed(() => wsCurrentShift.value && wsCurrentShift.value.user_name === currentUser.value?.name)
const createForm = ref<{ content: string; images: string; videos: string; deviceId: number | null }>({ content: '', images: '', videos: '', deviceId: null })

// P2.1: 工单模板
const problemTemplates = ref<any[]>([])
const maintenanceTemplates = ref<any[]>([])
const selectedProblemTplId = ref('')
const selectedMaintenanceTplId = ref('')
async function loadWorkorderTemplates() {
  try {
    const r = await fetch('/api/workorder-templates?type=problem', { headers: { 'X-User-Id': String(currentUser.value?.id || 0) } })
    const d = await r.json()
    problemTemplates.value = d.rows || []
  } catch {}
  try {
    const r = await fetch('/api/workorder-templates?type=maintenance', { headers: { 'X-User-Id': String(currentUser.value?.id || 0) } })
    const d = await r.json()
    maintenanceTemplates.value = d.rows || []
  } catch {}
}
function applyTemplate(type: 'problem' | 'maintenance', tplId: string) {
  if (!tplId) return
  const list = type === 'problem' ? problemTemplates.value : maintenanceTemplates.value
  const t = list.find(x => String(x.id) === String(tplId))
  if (!t) return
  if (type === 'problem') {
    createForm.value.content = t.default_content
    selectedProblemTplId.value = tplId
  } else {
    createMaintenanceForm.value.content = t.default_content
    if (t.default_level) {
      const lv: 'medium' | 'heavy' | 'light' = t.default_level === '重' ? 'heavy' : t.default_level === '中' ? 'medium' : 'light'
      createMaintenanceForm.value.level = lv
    }
    selectedMaintenanceTplId.value = tplId
  }
}

function openCreateDialog() { if (!wsAmIOnShift.value && currentUser.value?.role !== '维修组') return; createDialogVisible.value = true; createForm.value = { content: '', images: '', videos: '', deviceId: null } }

async function handleImageUpload(e: Event, form: any) {
  const files = (e.target as HTMLInputElement).files
  if (!files || files.length === 0) {
    form._uploadFailed = false
    return
  }
  form._uploadFailed = false
  const urls = await uploadFiles(Array.from(files))
  if (urls.length === 0) {
    // 上传失败:标记并在提交时拦截
    form._uploadFailed = true
    form.images = ''
    alert(`图片上传失败(${files.length} 个文件),请检查网络后重试`)
    return
  }
  form.images = (form.images ? form.images + ',' : '') + urls.join(',')
  form._uploadFailed = false
}

async function handleVideoUpload(e: Event, form: any) {
  const files = (e.target as HTMLInputElement).files
  if (!files || files.length === 0) {
    form._uploadFailed = false
    return
  }
  form._uploadFailed = false
  const urls = await uploadFiles(Array.from(files))
  if (urls.length === 0) {
    form._uploadFailed = true
    form.videos = ''
    alert(`视频上传失败(${files.length} 个文件),请检查网络后重试`)
    return
  }
  form.videos = (form.videos ? form.videos + ',' : '') + urls.join(',')
  form._uploadFailed = false
}

// 提交前检查:有文件被选中但上传失败则阻止提交
function ensureUploadsOk(...forms: any[]): boolean {
  for (const f of forms) {
    if (f?._uploadFailed) {
      alert('附件上传失败,请重新选择文件后提交')
      return false
    }
  }
  return true
}

async function uploadFiles(files: File[]): Promise<string[]> {
  const fd = new FormData()
  for (const f of files) fd.append('files', f)
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert('上传失败: ' + (err.error || res.status))
      return []
    }
    const data = await res.json()
    return data.urls || []
  } catch (err: any) {
    alert('上传失败: ' + err.message)
    return []
  }
}

// 图片预览
const previewImages = ref<string[]>([])
const previewIndex = ref(0)
function openImagePreview(images: string[], idx: number) {
  previewImages.value = images
  previewIndex.value = idx
}
function closeImagePreview() {
  previewImages.value = []
  previewIndex.value = 0
}

function submitCreateProblem() {
  if (!createForm.value.content) return
  if (!ensureUploadsOk(createForm.value)) return
  addProblemOrder({
    reporterId: currentUser.value.name,
    reporterName: currentUser.value.name,
    shiftId: 'SHIFT-001',
    content: createForm.value.content,
    images: createForm.value.images ? createForm.value.images.split(',').map(s => s.trim()) : [],
    videos: createForm.value.videos ? createForm.value.videos.split(',').map(s => s.trim()) : [],
    status: 'pending',
    deviceId: createForm.value.deviceId ? String(createForm.value.deviceId) : undefined,
    team: currentUser.value.team || 'A班',
    role: wsCurrentShift.value?.role || currentUser.value.name || '值班岗位',
    member_name: wsCurrentShift.value?.member_name || currentUser.value.member_name || ''
  })
  createDialogVisible.value = false
}

// ============ 新建维修工单(带班直接创建)===========
const createMaintenanceForm = ref<{ content: string; level: 'medium' | 'heavy' | 'light' }>({ content: '', level: 'medium' })

function openCreateMaintenanceDialog() { if (!wsAmIOnShift.value && currentUser.value?.role !== '维修组') return;
  createMaintenanceDialogVisible.value = true
  createMaintenanceForm.value = { content: '', level: 'medium' }
}

function submitCreateMaintenance() {
  if (!createMaintenanceForm.value.content) return
  addMaintenanceOrder({
    content: createMaintenanceForm.value.content,
    level: createMaintenanceForm.value.level,
    assignerId: currentUser.value.name,
    assignerName: currentUser.value.name,
    participants: [],
    status: 'pending',
    delayDays: 0,
    sparepartUsage: [],
    team: currentUser.value.team || 'A班',
    role: wsCurrentShift.value?.role || currentUser.value.name || '值班岗位',
    user_name: currentUser.value.name,
    reporterName: currentUser.value.name
  })
  createMaintenanceDialogVisible.value = false
}

// ============ 处理问题工单 ============
const handleDialogVisible = ref(false)
const handleType = ref<'self' | 'maintenance'>('self')
const handleForm = ref({ resolution: '', images: '', level: 'medium' as const })
const handlingOrder = ref<ProblemWorkOrder | null>(null)

function openProblemHandle(order: ProblemWorkOrder) {
  handlingOrder.value = order
  handleType.value = 'self'
  handleForm.value = { resolution: '', images: '', level: 'medium' }
  handleDialogVisible.value = true
}

async function submitHandleProblem() {
  if (!handlingOrder.value) return
  if (!ensureUploadsOk(handleForm.value)) return

  // 获取关联的设备ID
  const getDeviceId = () => handlingOrder.value?.deviceId

  if (handleType.value === 'self') {
    if (!handleForm.value.resolution) return
    updateProblemOrder(handlingOrder.value.id, {
      status: 'self_resolved',
      resolution: handleForm.value.resolution,
      resolutionImages: handleForm.value.images ? handleForm.value.images.split(',').map(s => s.trim()) : [],
      closedAt: new Date().toLocaleString('zh-CN')
    })
    // 自行解决后设备恢复在用
    const deviceId = getDeviceId()
    if (deviceId) {
      await updateDeviceStatusByOrder(deviceId, '在用', currentUser.value.name)
    }
  } else {
    updateProblemOrder(handlingOrder.value.id, { status: 'to_maintenance' })
    addMaintenanceOrder({
      problemOrderId: handlingOrder.value.id,
      content: handlingOrder.value.content,
      level: handleForm.value.level,
      assignerId: currentUser.value.name,
      assignerName: currentUser.value.name,
      participants: [],
      status: 'pending',
      delayDays: 0,
      sparepartUsage: [],
      team: handlingOrder.value.team || currentUser.value.team || 'A班',
      role: handlingOrder.value.role || currentUser.value.role || '值班岗位',
      user_name: currentUser.value.name,
      reporterName: handlingOrder.value.reporterName,
      memberName: handlingOrder.value.memberName || ''
    })
    // 问题工单转维修,设备状态变为维修中
    const deviceId = getDeviceId()
    if (deviceId) {
      await updateDeviceStatusByOrder(deviceId, '维修中', currentUser.value.name)
    }
  }
  handleDialogVisible.value = false
}

// ============ 延时 ============
const delayDialogVisible = ref(false)
const delayForm = ref<{ reason: string; images: string }>({ reason: '', images: '' })
const delayingOrder = ref<MaintenanceWorkOrder | null>(null)

function openDelayDialog(order: MaintenanceWorkOrder) {
  delayingOrder.value = order
  delayForm.value = { reason: '', images: '' }
  delayDialogVisible.value = true
}

function submitDelay() {
  if (!delayingOrder.value || !delayForm.value.reason) return
  if (!ensureUploadsOk(delayForm.value)) return
  updateMaintenanceOrder(delayingOrder.value.id, {
    status: 'delay',
    delayReason: delayForm.value.reason,
    delayDays: 1,
    delayImages: delayForm.value.images ? delayForm.value.images.split(',').map(s => s.trim()).filter(Boolean) : []
  })
  delayDialogVisible.value = false
}

// ============ 完成维修 ============
const completeDialogVisible = ref(false)
const completeForm = ref({ note: '', images: '', participants: '', spareparts: [{ name: '', quantity: 1, specs: '' }] })
const completingOrder = ref<MaintenanceWorkOrder | null>(null)

function openCompleteDialog(order: MaintenanceWorkOrder) {
  completingOrder.value = order
  completeForm.value = { note: '', images: '', participants: '', spareparts: [{ name: '', quantity: 1, specs: '' }] }
  completeDialogVisible.value = true
}

async function submitComplete() {
  if (!completingOrder.value) return
  if (!ensureUploadsOk(completeForm.value)) return
  await updateMaintenanceOrder(completingOrder.value.id, {
    status: 'completed',
    completionNote: completeForm.value.note,
    completionImages: completeForm.value.images ? completeForm.value.images.split(',').map(s => s.trim()) : [],
    participants: completeForm.value.participants ? completeForm.value.participants.split(',').map(s => s.trim()) : [],
    sparepartUsage: completeForm.value.spareparts.filter(sp => sp.name),
    completedAt: new Date().toLocaleString('zh-CN')
  })
  // 完成维修后设备状态变为在用(等待审核),问题工单不动,等审核通过再删
  const order = completingOrder.value
  if (order.problemOrderId) {
    const problemOrder = problemOrders.value.find(p => p.id === order.problemOrderId)
    if (problemOrder?.deviceId) {
      await updateDeviceStatusByOrder(problemOrder.deviceId, '在用', currentUser.value.name)
    }
  } else {
    const deviceId = matchDeviceByContent(order.content || '')
    if (deviceId) {
      await updateDeviceStatusByOrder(deviceId, '在用', currentUser.value.name)
    }
  }
  completeDialogVisible.value = false
}

// ============ 问题工单闭环 ============
const problemCloseDialogVisible = ref(false)
const problemCloseForm = ref({ reason: '', images: '' })
const closingOrder = ref<MaintenanceWorkOrder | null>(null)

function openProblemCloseDialog(order: MaintenanceWorkOrder) {
  closingOrder.value = order
  problemCloseForm.value = { reason: '', images: '' }
  problemCloseDialogVisible.value = true
}

async function submitProblemClose() {
  if (!closingOrder.value || !problemCloseForm.value.reason) return
  if (!ensureUploadsOk(problemCloseForm.value)) return
  const order = closingOrder.value

  // 获取关联的设备ID
  const getDeviceId = () => {
    if (order.problemOrderId) {
      const problemOrder = problemOrders.value.find(p => p.id === order.problemOrderId)
      return problemOrder?.deviceId
    }
    return matchDeviceByContent(order.content || '')
  }

  // 关闭维修工单
  await updateMaintenanceOrder(order.id, {
    status: 'closed',
    completionNote: problemCloseForm.value.reason,
    completionImages: problemCloseForm.value.images ? problemCloseForm.value.images.split(',').map(s => s.trim()) : [],
    closedAt: new Date().toLocaleString('zh-CN')
  })

  // 如果有来源问题工单,关闭它并记录原因
  if (order.problemOrderId) {
    await updateProblemOrder(order.problemOrderId, {
      status: 'closed',
      resolution: problemCloseForm.value.reason,
      resolutionImages: problemCloseForm.value.images ? problemCloseForm.value.images.split(',').map(s => s.trim()) : [],
      closedAt: new Date().toLocaleString('zh-CN')
    })
  }

  // 工单闭环后设备恢复在用
  const deviceId = getDeviceId()
  if (deviceId) {
    await updateDeviceStatusByOrder(deviceId, '在用', currentUser.value.name)
  }

  problemCloseDialogVisible.value = false
}

// ============ 审核 ============
const reviewDialogVisible = ref(false)
const reviewResult = ref<'pass' | 'reject'>('pass')
const reviewForm = ref({ reason: '', images: '' })
const reviewingOrder = ref<MaintenanceWorkOrder | null>(null)

function openReviewDialog(order: MaintenanceWorkOrder) {
  reviewingOrder.value = order
  reviewResult.value = 'pass'
  reviewForm.value = { reason: '', images: '' }
  reviewDialogVisible.value = true
}

async function submitReview() {
  if (!reviewingOrder.value) return
  if (reviewResult.value === 'reject' && !reviewForm.value.reason) return
  if (reviewResult.value === 'reject' && !ensureUploadsOk(reviewForm.value)) return
  const order = reviewingOrder.value

  // 获取关联的设备ID
  const getDeviceId = (o: typeof order) => {
    if (o.problemOrderId) {
      const problemOrder = problemOrders.value.find(p => p.id === o.problemOrderId)
      return problemOrder?.deviceId
    }
    return matchDeviceByContent(o.content || '')
  }

  if (reviewResult.value === 'pass') {
    // 审核通过后删除关联的问题工单前,先清除维修工单的 problem_order_id 引用,避免孤儿工单丢失
    if (order.problemOrderId) {
      await updateMaintenanceOrder(order.id, { problemOrderId: null })
      await deleteProblemOrder(order.problemOrderId)
    }
    await updateMaintenanceOrder(order.id, {
      status: 'closed',
      closedAt: new Date().toLocaleString('zh-CN')
    })
    // 设备恢复在用
    const deviceId = getDeviceId(order)
    if (deviceId) {
      await updateDeviceStatusByOrder(deviceId, '在用', currentUser.value.name)
    }
  } else {
    await updateMaintenanceOrder(order.id, {
      status: 'returned',
      returnReason: reviewForm.value.reason,
      returnImages: reviewForm.value.images ? reviewForm.value.images.split(',').map(s => s.trim()) : []
    })
    // 退回后设备状态变为告警(问题未解决,维修工单还在)
    const deviceId = getDeviceId(order)
    if (deviceId) {
      await updateDeviceStatusByOrder(deviceId, '维修中', currentUser.value.name)
    }
  }
  reviewDialogVisible.value = false
}

// ============ 详情 ============
const detailDialogVisible = ref(false)
const detailOrder = ref<ProblemWorkOrder | MaintenanceWorkOrder | null>(null)

function openProblemDetail(order: ProblemWorkOrder) {
  detailOrder.value = order
  detailDialogVisible.value = true
}

function openMaintenanceDetail(order: MaintenanceWorkOrder) {
  detailOrder.value = order
  detailDialogVisible.value = true
}

async function returnOrder(order: ProblemWorkOrder | MaintenanceWorkOrder) {
  // 获取设备ID
  const getDeviceId = () => {
    if ('problemOrderId' in order && order.problemOrderId) {
      const po = problemOrders.value.find(p => p.id === order.problemOrderId)
      return po?.deviceId || null
    }
    return matchDeviceByContent(order.content || '')
  }
  const deviceId = getDeviceId()
  if ('reporterId' in order) {
    // Problem order - return to pending,设备变为告警
    await updateProblemOrder(order.id, { status: 'pending' })
    if (deviceId) await updateDeviceStatusByOrder(deviceId, '告警', currentUser.value.name)
  } else {
    // Maintenance order - return to pending → 恢复问题工单为pending(复用),删除维修工单,设备变为告警
    if (order.problemOrderId) {
      await updateProblemOrder(order.problemOrderId, { status: 'pending' })
    }
    await deleteMaintenanceOrder(order.id)
    if (deviceId) await updateDeviceStatusByOrder(deviceId, '告警', currentUser.value.name)
  }
  detailDialogVisible.value = false
}

// ============ 编辑工单 ============
const editDialogVisible = ref(false)
const editForm = ref<{ content: string; level: 'light' | 'medium' | 'heavy' }>({ content: '', level: 'medium' })

function openEditDialog(order: ProblemWorkOrder | MaintenanceWorkOrder) {
  editForm.value = {
    content: order.content || '',
    level: ('level' in order ? order.level : 'medium') as 'light' | 'medium' | 'heavy'
  }
  editDialogVisible.value = true
}

function submitEdit() {
  if (!detailOrder.value) return
  if ('reporterId' in detailOrder.value) {
    updateProblemOrder(detailOrder.value.id, { content: editForm.value.content })
  } else {
    updateMaintenanceOrder(detailOrder.value.id, {
      content: editForm.value.content,
      level: editForm.value.level as 'light' | 'medium' | 'heavy'
    })
  }
  editDialogVisible.value = false
  detailDialogVisible.value = false
}

// ============ 接单 ============
function acceptOrder(order: MaintenanceWorkOrder) {
  updateMaintenanceOrder(order.id, {
    handlerId: currentUser.value.name,
    handlerName: currentUser.value.name,
    status: 'processing'
  })
  // 接单后设备状态保持维修中(由转维修时已设置)
}

// ============ 删除工单 ============
const problemDeleteVisible = ref(false)
const maintenanceDeleteVisible = ref(false)
const deletingProblemOrder = ref<ProblemWorkOrder | null>(null)
const deletingMaintenanceOrder = ref<MaintenanceWorkOrder | null>(null)

function openProblemDelete(order: ProblemWorkOrder) {
  deletingProblemOrder.value = order
  problemDeleteVisible.value = true
}

function confirmProblemDelete() {
  if (!deletingProblemOrder.value) return
  deleteProblemOrder(deletingProblemOrder.value.id)
  problemDeleteVisible.value = false
  deletingProblemOrder.value = null
}

function openMaintenanceDelete(order: MaintenanceWorkOrder) {
  deletingMaintenanceOrder.value = order
  maintenanceDeleteVisible.value = true
}

function confirmMaintenanceDelete() {
  if (!deletingMaintenanceOrder.value) return
  deleteMaintenanceOrder(deletingMaintenanceOrder.value.id)
  maintenanceDeleteVisible.value = false
  deletingMaintenanceOrder.value = null
}
</script>

<style scoped>
.wo-page { min-height: 100vh; background: rgba(10, 25, 47, 0.95); }

.wo-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 24px 32px;
}

/* P1: 统计面板 */
.wo-stats-bar {
  display: flex;
  gap: 12px;
  padding: 14px 32px;
  background: rgba(45, 212, 191, 0.04);
  border-bottom: 1px solid rgba(45, 212, 191, 0.1);
  overflow-x: auto;
}
.stat-card {
  flex: 0 0 auto;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 8px 16px;
  min-width: 100px;
  text-align: center;
}
.stat-card.alert {
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.08);
  animation: statAlertPulse 2s ease-in-out infinite;
}
@keyframes statAlertPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.15); }
}
.stat-label { font-size: 11px; color: rgba(255, 255, 255, 0.55); margin-bottom: 4px; letter-spacing: 0.5px; }
.stat-value { font-size: 24px; font-weight: 700; line-height: 1.1; }
.stat-value-sm { font-size: 14px; font-weight: 600; color: rgba(255, 255, 255, 0.85); line-height: 1.6; }

.wo-title { display: flex; align-items: baseline; gap: 12px; }
.wo-title h2 { color: #fff; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 1px; }
.wo-count { color: rgba(255,255,255,0.5); font-size: 13px; }
.wo-stat { margin-right: 12px; color: rgba(255,255,255,0.6); font-size: 13px; }

.wo-search {
  display: flex; gap: 10px; align-items: center;
  padding: 0 32px 16px;
}

.search-select {
  background: rgba(0,0,0,0.3); border: 1px solid rgba(45,212,191,0.3);
  border-radius: 6px; color: #fff; padding: 6px 12px; outline: none;
}

.wo-list { padding: 0 32px; display: flex; flex-direction: column; gap: 12px; }

.wo-card {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(45,212,191,0.15);
  border-radius: 10px; padding: 14px 16px; cursor: pointer;
  transition: border-color 0.2s;
}
.wo-card:hover { border-color: rgba(45,212,191,0.4); }

.wo-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.wo-id { font-size: 12px; color: rgba(255,255,255,0.5); font-family: monospace; }
.wo-level {
  font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600;
}
.level-light { background: rgba(16,185,129,0.2); color: #10B981; }
.level-medium { background: rgba(245,158,11,0.2); color: #F59E0B; }
.level-heavy { background: rgba(239,68,68,0.2); color: #EF4444; }

.wo-status {
  font-size: 11px; padding: 2px 8px; border-radius: 10px; color: #fff; font-weight: 500;
}

.wo-card-body .wo-content { color: rgba(255,255,255,0.9); margin: 0 0 8px; font-size: 14px; }
.wo-meta { display: flex; gap: 16px; font-size: 12px; color: rgba(255,255,255,0.45); }
.wo-attachments { display: flex; gap: 10px; font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 6px; align-items: center; }
.wo-thumbs { display: flex; gap: 4px; }
.wo-thumb { width: 44px; height: 44px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); }
.wo-thumb:hover { border-color: #2DD4BF; }
.wo-thumb-more { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.08); border-radius: 4px; font-size: 12px; color: rgba(255,255,255,0.6); }
.wo-video-badge { color: #fb923c; }
.image-preview-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center; }
.image-preview-content { max-width: 90vw; max-height: 90vh; }
.image-preview-content img { max-width: 100%; max-height: 90vh; object-fit: contain; }
.image-preview-close { position: absolute; top: 20px; right: 20px; width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.15); color: #fff; border: none; font-size: 18px; cursor: pointer; }
.image-preview-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.15); color: #fff; border: none; font-size: 24px; cursor: pointer; }
.image-preview-nav.left { left: 20px; }
.image-preview-nav.right { right: 20px; }
.image-preview-nav:disabled { opacity: 0.3; cursor: not-allowed; }
.wo-resolution, .wo-delay, .wo-return {
  margin-top: 6px; font-size: 12px; color: rgba(255,255,255,0.6);
}

.wo-card-actions { display: flex; gap: 8px; margin-top: 10px; }

/* 按钮 */
.dm-btn {
  padding: 7px 16px; border-radius: 6px; border: none; cursor: pointer;
  font-size: 13px; transition: all 0.2s;
}
.dm-btn-primary { background: #2DD4BF; color: #0a192f; font-weight: 600; }
.dm-btn-primary:hover { background: #5eead4; }
.dm-btn-cancel { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.15); }
.dm-btn-search { background: rgba(45,212,191,0.15); color: #2DD4BF; border: 1px solid rgba(45,212,191,0.3); }
.dm-btn-reset { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.1); }
.dm-btn-sm { background: rgba(45,212,191,0.1); color: #2DD4BF; border: 1px solid rgba(45,212,191,0.3); padding: 4px 12px; font-size: 12px; border-radius: 4px; cursor: pointer; }

.action-btn {
  padding: 4px 12px; border-radius: 4px; border: 1px solid rgba(45,212,191,0.3);
  background: rgba(45,212,191,0.1); color: #2DD4BF; font-size: 12px; cursor: pointer;
}
.action-btn:hover { background: rgba(45,212,191,0.2); }
.action-btn-primary { background: #2DD4BF; color: #0a192f; border-color: #2DD4BF; font-weight: 600; }
.action-btn-danger { background: rgba(239,68,68,0.2); color: #EF4444; border-color: rgba(239,68,68,0.4); }
.action-btn-danger:hover { background: rgba(239,68,68,0.35); }
.icon-btn { background: rgba(239,68,68,0.2); color: #EF4444; border: none; border-radius: 4px; padding: 2px 8px; cursor: pointer; }

/* Tabs */
.dm-tabs { display: flex; gap: 4px; padding: 0 32px 16px; }
.dm-tab {
  padding: 6px 20px; border-radius: 6px; cursor: pointer; font-size: 13px;
  color: rgba(255,255,255,0.5); transition: all 0.2s;
}
.dm-tab:hover { color: rgba(255,255,255,0.8); }
.dm-tab.active { background: rgba(45,212,191,0.15); color: #2DD4BF; }

/* 弹窗 */
.dm-dialog-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6); display: flex; align-items: center;
  justify-content: center; z-index: 1000;
}
.dm-dialog {
  background: #1a3a5c; border: 1px solid rgba(45,212,191,0.3);
  border-radius: 12px; width: 520px; max-height: 85vh; overflow-y: auto;
}
.dm-dialog-sm { width: 380px; }
.dialog-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid rgba(45,212,191,0.1);
}
.dialog-header h3 { color: #fff; margin: 0; font-size: 16px; }
.dialog-close { background: none; border: none; color: rgba(255,255,255,0.5); font-size: 22px; cursor: pointer; }
.dialog-body { padding: 16px 20px; color: #fff; }
.dialog-body p { color: rgba(255,255,255,0.85); margin: 0 0 8px; }
.dialog-body strong { color: #fff; }
.dialog-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 12px 20px; border-top: 1px solid rgba(45,212,191,0.1);
}

/* 表单 */
.form-row { margin-bottom: 14px; }
.form-row label { display: block; color: rgba(255,255,255,0.7); font-size: 13px; margin-bottom: 5px; }
.form-row input, .form-row select, .form-row textarea {
  width: 100%; background: rgba(0,0,0,0.25); border: 1px solid rgba(45,212,191,0.25);
  border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 13px; outline: none; box-sizing: border-box;
}
.form-row input:focus, .form-row textarea:focus { border-color: rgba(45,212,191,0.5); }
.form-row input::placeholder, .form-row textarea::placeholder { color: rgba(255,255,255,0.4); }
.required { color: #FCA5A5; }

.radio-group { display: flex; gap: 20px; }
.radio-item { display: flex; align-items: center; gap: 6px; color: rgba(255,255,255,0.8); cursor: pointer; }
.radio-item input { accent-color: #2DD4BF; }

.sparepart-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
.sparepart-row input { flex: 1; }

.detail-row { display: flex; gap: 8px; margin-bottom: 10px; font-size: 13px; }
.detail-row label { color: rgba(255,255,255,0.5); min-width: 80px; }
.detail-row span { color: rgba(255,255,255,0.9); }
.sp-item { color: rgba(255,255,255,0.7); font-size: 12px; }

.empty-row { text-align: center; color: rgba(255,255,255,0.3); padding: 40px; }
</style>
