<template>
  <div class="wo-page">
    <TopNavBar />
    <div class="wo-header">
      <div class="wo-title">
        <h2 v-if="currentUser.role === '值班岗位' || currentUser.role === '带班' || currentUser.role === '系统管理人'">{{ activeTab === 'maintenance' ? '维修工单' : '问题工单' }}</h2>
        <h2 v-else>维修工单</h2>
        <span v-if="currentUser.role === '维修组'" class="wo-stat">
          未接单 {{ maintenanceOrders.filter(o => o.status === 'pending').length }}
        </span>
        <span v-if="currentUser.role === '维修组'" class="wo-stat">
          进行中 {{ maintenanceOrders.filter(o => o.status === 'processing' || o.status === 'delay').length }}
        </span>
        <span v-if="currentUser.role === '维修组'" class="wo-stat">
          已完成 {{ maintenanceOrders.filter(o => o.status === 'completed' || o.status === 'closed').length }}
        </span>
        <span v-if="(currentUser.role === '值班岗位' || currentUser.role === '带班' || currentUser.role === '系统管理人') && activeTab === 'maintenance'" class="wo-stat">
          未接单 {{ maintenanceOrders.filter(o => o.status === 'pending').length }}
        </span>
        <span v-if="(currentUser.role === '值班岗位' || currentUser.role === '带班' || currentUser.role === '系统管理人') && activeTab === 'maintenance'" class="wo-stat">
          进行中 {{ maintenanceOrders.filter(o => o.status === 'processing' || o.status === 'delay').length }}
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
      <div v-if="wsAmIOnShift || currentUser.role === '维修组'" class="wo-actions">
        <button class="dm-btn dm-btn-primary" @click="currentUser.role === '带班' ? openCreateMaintenanceDialog() : openCreateDialog()">
          {{ currentUser.role === '带班' ? '+ 新建维修工单' : '+ 新建问题工单' }}
        </button>
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
            <span>报告人：{{ order.reporterName }}</span>
            <span>时间：{{ order.createdAt }}</span>
          </div>
          <div v-if="order.images.length || ('videos' in order && order.videos?.length)" class="wo-attachments">
            <span v-if="order.images.length">📷 {{ order.images.length }}</span>
            <span v-if="'videos' in order && order.videos?.length">🎬 {{ order.videos.length }}</span>
          </div>
          <div v-if="order.resolution" class="wo-resolution">
            <strong>处理结果：</strong>{{ order.resolution }}
          </div>
        </div>
        <div class="wo-card-actions">
          <button v-if="canHandleProblem(order)" class="action-btn" @click.stop="openProblemHandle(order)">处理</button>
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
            <span>分派：{{ order.assignerName }}</span>
            <span v-if="order.handlerName">接单：{{ order.handlerName }}</span>
            <span>时间：{{ order.createdAt }}</span>
          </div>
          <div v-if="order.delayReason" class="wo-delay">
            <strong>延时原因：</strong>{{ order.delayReason }}
          </div>
          <div v-if="order.returnReason" class="wo-return">
            <strong>退回原因：</strong>{{ order.returnReason }}
          </div>
        </div>
        <div class="wo-card-actions">
          <button v-if="canAcceptOrder(order)" class="action-btn" @click.stop="acceptOrder(order)">接单</button>
          <button v-if="canDelayOrder(order)" class="action-btn" @click.stop="openDelayDialog(order)">延时</button>
          <button v-if="(currentUser.role === '维修组' || currentUser.role === '系统管理人') && (order.status === 'processing' || order.status === 'delay')" class="action-btn action-btn-primary" @click.stop="openCompleteDialog(order)">完成</button>
          <button v-if="(currentUser.role === '维修组' || currentUser.role === '系统管理人') && order.status === 'processing'" class="action-btn action-btn-primary" @click.stop="openProblemCloseDialog(order)">问题工单闭环</button>
          <button v-if="(currentUser.role === '带班' || currentUser.role === '系统管理人') && order.status === 'completed'" class="action-btn" @click.stop="openReviewDialog(order)">审核</button>
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
          <div class="form-row">
            <label>问题描述 <span class="required">*</span></label>
            <textarea v-model="createForm.content" placeholder="请描述发现的问题" rows="4"></textarea>
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

    <!-- 新建维修工单弹窗（带班直接创建）-->
    <div v-if="createMaintenanceDialogVisible" class="dm-dialog-overlay" @click.self="createMaintenanceDialogVisible = false">
      <div class="dm-dialog">
        <div class="dialog-header">
          <h3>新建维修工单</h3>
          <button class="dialog-close" @click="createMaintenanceDialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
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

    <!-- 处理问题工单弹窗（自行解决） -->
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
            <input type="text" v-model="handleForm.resolutionImages" placeholder="图片URL，多个用逗号分隔" />
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
            <input type="text" v-model="completeForm.participants" placeholder="参与人员，多个用逗号分隔" />
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
            <label>闭环原因（图文）<span class="required">*</span></label>
            <textarea v-model="problemCloseForm.reason" placeholder="请说明发现的问题原因和解决方案" rows="4"></textarea>
          </div>
          <div class="form-row">
            <label>图片</label>
            <input type="text" v-model="problemCloseForm.images" placeholder="图片URL，多个用逗号分隔" />
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
            <input type="text" v-model="reviewForm.images" placeholder="图片URL，多个用逗号分隔" />
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
            <div class="detail-row"><label>工单编号：</label><span>{{ detailOrder.id }}</span></div>
            <div class="detail-row"><label>状态：</label><span :style="{ color: statusColor(detailOrder.status) }">{{ statusLabel(detailOrder.status) }}</span></div>
            <div class="detail-row"><label>内容：</label><span>{{ detailOrder.content || '无' }}</span></div>
            <div v-if="'handlerName' in detailOrder && detailOrder.handlerName" class="detail-row"><label>接单人：</label><span>{{ detailOrder.handlerName }}</span></div>
            <div v-if="'sparepartUsage' in detailOrder && detailOrder.sparepartUsage.length" class="detail-row">
              <label>备件使用：</label>
              <div v-for="sp in detailOrder.sparepartUsage" :key="sp.name" class="sp-item">{{ sp.name }} × {{ sp.quantity }}</div>
            </div>
          </template>
        </div>
        <div class="dialog-footer">
          <button v-if="currentUser.role === '系统管理人' && detailOrder && 'status' in detailOrder && !['closed', 'completed'].includes(detailOrder.status)" class="dm-btn" @click="openEditDialog(detailOrder)">编辑</button>
          <button v-if="currentUser.role === '系统管理人' && detailOrder && 'status' in detailOrder && !['closed', 'completed'].includes(detailOrder.status)" class="dm-btn" @click="returnOrder(detailOrder)">退回</button>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import TopNavBar from '../components/TopNavBar.vue'
import { currentUser, updateDeviceStatusByOrder, isOnDuty } from '../composables/useDeviceStore'
import {
  matchDeviceByContent, problemOrders, maintenanceOrders,
  addProblemOrder, updateProblemOrder,
  addMaintenanceOrder, updateMaintenanceOrder,
  initDeviceStatusFromWorkOrders,
  statusLabel, statusColor, levelLabel,
  ProblemWorkOrder, MaintenanceWorkOrder
} from '../composables/useWorkOrderStore'

// 从数据库同步问题工单
async function syncProblemOrdersFromDB() {
  try {
    const res = await fetch('/api/workorders/problem')
    const dbOrders = await res.json()
    // 合并到本地（去重）
    for (const o of dbOrders) {
      const exists = problemOrders.value.find(p => p.id === o.id)
      if (!exists) {
        problemOrders.value.push({
          id: o.id,
          reporterId: o.reporter_name || o.reporterId,
          reporterName: o.reporter_name || '',
          content: o.content,
          status: o.status,
          shiftId: '',
          images: o.images ? JSON.parse(o.images) : [],
          videos: o.videos ? JSON.parse(o.videos) : [],
          createdAt: new Date(o.created_at).toLocaleString('zh-CN'),
          resolution: o.resolution
        })
      }
    }
  } catch {}
}

async function syncMaintenanceOrdersFromDB() {
  try {
    const res = await fetch('/api/workorders/maintenance')
    const dbOrders = await res.json()
    for (const o of dbOrders) {
      const exists = maintenanceOrders.value.find(m => m.id === o.id)
      if (!exists) {
        maintenanceOrders.value.push({
          id: o.id,
          content: o.content,
          level: o.level,
          status: o.status,
          assignerId: o.assigner_name || '',
          assignerName: o.assigner_name || '',
          handlerId: o.handler_name || '',
          handlerName: o.handler_name || '',
          problemOrderId: o.problem_order_id || null,
          participants: [],
          delayDays: 0,
          sparepartUsage: [],
          createdAt: new Date(o.created_at).toLocaleString('zh-CN')
        })
      }
    }
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
  initDeviceStatusFromWorkOrders()
  syncProblemOrdersFromDB()
  syncMaintenanceOrdersFromDB()
  loadShiftStatus()
  syncTimer = setInterval(() => {
    syncProblemOrdersFromDB()
    syncMaintenanceOrdersFromDB()
  }, 5000)
})
onUnmounted(() => { if (syncTimer) clearInterval(syncTimer) })

// Tab
const activeTab = ref<'problem' | 'maintenance'>(currentUser.value.role === '维修组' ? 'maintenance' : 'problem')
const searchStatus = ref('')

// ============ 状态选项 ============
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
    // 同状态按等级排序：重 > 中 > 轻
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
const wsCurrentShift = ref<any>(null)
const wsAmIOnShift = computed(() => wsCurrentShift.value && wsCurrentShift.value.user_name === currentUser.value?.name)
const createForm = ref({ content: '', images: '', videos: '' })

function openCreateDialog() { if (!wsAmIOnShift.value && currentUser.value?.role !== '维修组') return; createDialogVisible.value = true; createForm.value = { content: '', images: '', videos: '' } }

function handleImageUpload(e: Event, form: { images?: string }) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  const urls = Array.from(files).map(f => URL.createObjectURL(f))
  form.images = urls.join(',')
}

function handleVideoUpload(e: Event, form: { videos?: string }) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  const urls = Array.from(files).map(f => URL.createObjectURL(f))
  form.videos = urls.join(',')
}

function submitCreateProblem() {
  if (!createForm.value.content) return
  addProblemOrder({
    reporterId: currentUser.value.name,
    reporterName: currentUser.value.name,
    shiftId: 'SHIFT-001',
    content: createForm.value.content,
    images: createForm.value.images ? createForm.value.images.split(',').map(s => s.trim()) : [],
    videos: createForm.value.videos ? createForm.value.videos.split(',').map(s => s.trim()) : [],
    status: 'pending'
  })
  createDialogVisible.value = false
}

// ============ 新建维修工单（带班直接创建）===========
const createMaintenanceDialogVisible = ref(false)
const createMaintenanceForm = ref({ content: '', level: 'medium' as const })

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
    sparepartUsage: []
  })
  createMaintenanceDialogVisible.value = false
}

// ============ 处理问题工单 ============
const handleDialogVisible = ref(false)
const handleType = ref<'self' | 'maintenance'>('self')
const handleForm = ref({ resolution: '', resolutionImages: '', level: 'medium' as const })
const handlingOrder = ref<ProblemWorkOrder | null>(null)

function openProblemHandle(order: ProblemWorkOrder) {
  handlingOrder.value = order
  handleType.value = 'self'
  handleForm.value = { resolution: '', resolutionImages: '', level: 'medium' }
  handleDialogVisible.value = true
}

function submitHandleProblem() {
  if (!handlingOrder.value) return
  
  // 获取关联的设备ID
  const getDeviceId = () => handlingOrder.value?.deviceId
  
  if (handleType.value === 'self') {
    if (!handleForm.value.resolution) return
    updateProblemOrder(handlingOrder.value.id, {
      status: 'self_resolved',
      resolution: handleForm.value.resolution,
      resolutionImages: handleForm.value.resolutionImages ? handleForm.value.resolutionImages.split(',').map(s => s.trim()) : [],
      closedAt: new Date().toLocaleString('zh-CN')
    })
    // 自行解决后设备恢复在用
    const deviceId = getDeviceId()
    if (deviceId) {
      updateDeviceStatusByOrder(deviceId, '在用', currentUser.value.name)
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
      sparepartUsage: []
    })
    // 问题工单转维修，设备状态变为维修中
    const deviceId = getDeviceId()
    if (deviceId) {
      updateDeviceStatusByOrder(deviceId, '维修中', currentUser.value.name)
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
  updateMaintenanceOrder(delayingOrder.value.id, {
    status: 'delay',
    delayReason: delayForm.value.reason,
    delayDays: 1
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

function submitComplete() {
  if (!completingOrder.value) return
  updateMaintenanceOrder(completingOrder.value.id, {
    status: 'completed',
    completionNote: completeForm.value.note,
    completionImages: completeForm.value.images ? completeForm.value.images.split(',').map(s => s.trim()) : [],
    participants: completeForm.value.participants ? completeForm.value.participants.split(',').map(s => s.trim()) : [],
    sparepartUsage: completeForm.value.spareparts.filter(sp => sp.name),
    completedAt: new Date().toLocaleString('zh-CN')
  })
  // 完成维修后设备状态变为在用（等待审核）
  const order = completingOrder.value
  if (order.problemOrderId) {
    const problemOrder = problemOrders.value.find(p => p.id === order.problemOrderId)
    if (problemOrder?.deviceId) {
      updateDeviceStatusByOrder(problemOrder.deviceId, '在用', currentUser.value.name)
    }
  } else {
    const deviceId = matchDeviceByContent(order.content || '')
    if (deviceId) {
      updateDeviceStatusByOrder(deviceId, '在用', currentUser.value.name)
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

function submitProblemClose() {
  if (!closingOrder.value || !problemCloseForm.value.reason) return
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
  updateMaintenanceOrder(order.id, {
    status: 'closed',
    completionNote: problemCloseForm.value.reason,
    completionImages: problemCloseForm.value.images ? problemCloseForm.value.images.split(',').map(s => s.trim()) : [],
    closedAt: new Date().toLocaleString('zh-CN')
  })
  
  // 如果有来源问题工单，关闭它并记录原因
  if (order.problemOrderId) {
    updateProblemOrder(order.problemOrderId, {
      status: 'closed',
      resolution: problemCloseForm.value.reason,
      resolutionImages: problemCloseForm.value.images ? problemCloseForm.value.images.split(',').map(s => s.trim()) : [],
      closedAt: new Date().toLocaleString('zh-CN')
    })
  }
  
  // 工单闭环后设备恢复在用
  const deviceId = getDeviceId()
  if (deviceId) {
    updateDeviceStatusByOrder(deviceId, '在用', currentUser.value.name)
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

function submitReview() {
  if (!reviewingOrder.value) return
  if (reviewResult.value === 'reject' && !reviewForm.value.reason) return
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
    updateMaintenanceOrder(order.id, {
      status: 'closed',
      closedAt: new Date().toLocaleString('zh-CN')
    })
    // 审核通过后设备恢复在用
    const deviceId = getDeviceId(order)
    if (deviceId) {
      updateDeviceStatusByOrder(deviceId, '在用', currentUser.value.name)
    }
  } else {
    updateMaintenanceOrder(order.id, {
      status: 'returned',
      returnReason: reviewForm.value.reason,
      returnImages: reviewForm.value.images ? reviewForm.value.images.split(',').map(s => s.trim()) : []
    })
    // 退回后设备状态变为告警
    const deviceId = getDeviceId(order)
    if (deviceId) {
      updateDeviceStatusByOrder(deviceId, '告警', currentUser.value.name)
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

function returnOrder(order: ProblemWorkOrder | MaintenanceWorkOrder) {
  if ('reporterId' in order) {
    // Problem order - return to pending
    updateProblemOrder(order.id, { status: 'pending' })
  } else {
    // Maintenance order - return to pending
    updateMaintenanceOrder(order.id, { status: 'pending', handlerId: undefined, handlerName: undefined })
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
  // 接单后设备状态保持维修中（由转维修时已设置）
}
</script>

<style scoped>
.wo-page { min-height: 100vh; background: rgba(10, 25, 47, 0.95); }

.wo-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 24px 32px;
}

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
.wo-attachments { display: flex; gap: 10px; font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 6px; }
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
.dialog-body { padding: 16px 20px; }
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
