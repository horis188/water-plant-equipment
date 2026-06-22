<script setup lang="ts">
import { ref, computed } from 'vue'
import { currentUser, devices, updateDeviceStatusByOrder } from '../composables/useDeviceStore'
import { usePermission } from '../composables/usePermission'
import {
  problemOrders, maintenanceOrders,
  updateProblemOrder, updateMaintenanceOrder,
  deleteProblemOrder, deleteMaintenanceOrder,
  addMaintenanceOrder,
  statusLabel, statusColor, levelLabel,
  matchDeviceByContent
} from '../composables/useWorkOrderStore'

const props = defineProps<{
  orderItem: any  // dashboard work order item: { id, _type, ... }
}>()

const emit = defineEmits<{
  close: []
  updated: []
}>()

const { has, hasAny } = usePermission()

// ---- find full order from stores ----
const fullOrder = computed(() => {
  const item = props.orderItem
  if (!item) return null
  const numId = String(item.id).replace(/^(PO|WO)-/, '')
  if (item._type === 'problem') {
    return problemOrders.value.find(p => String(p.id) === numId) || null
  }
  return maintenanceOrders.value.find(m => String(m.id) === numId) || null
})

const isProblem = computed(() => props.orderItem?._type === 'problem')
const isMaintenance = computed(() => props.orderItem?._type === 'maintenance')

// 设备名查找: deviceId → device.name
const linkedDeviceName = computed(() => {
  const item = props.orderItem
  const full = fullOrder.value as any
  // 优先从 fullOrder.deviceId 查, 其次从 orderItem.deviceId, 最后用 orderItem.device (卡片传的"设备#X")
  const idCandidates: any[] = [
    full?.deviceId,
    item?.deviceId,
    item?.device
  ].filter(Boolean)
  for (const id of idCandidates) {
    const idStr = String(id)
    // 尝试精确匹配, 也尝试去掉 "设备#" 前缀
    const normalized = idStr.replace(/^设备#?/, '').replace(/^#/, '')
    const dev = devices.value.find(d =>
      String(d.id) === idStr ||
      String(d.id) === normalized ||
      `设备#${d.id}` === idStr
    )
    if (dev) return dev.name
  }
  return null
})

const linkedDeviceDisplay = computed(() => {
  if (linkedDeviceName.value) {
    const idText = props.orderItem?.device || (fullOrder.value as any)?.deviceId
    return `${linkedDeviceName.value} (${idText || '-'})`
  }
  return props.orderItem?.device || (fullOrder.value as any)?.deviceId || '-'
})

// 格式化 ISO 时间 为北京时间 (Asia/Shanghai) 'yyyy/MM/dd HH:mm'
function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',  // 强制北京时间, 避免浏览器时区不同
      year: 'numeric',
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false
    })
  } catch { return iso }
}

// 最新处理时间: 只要 lastActionAt 有就显示
// 注意: store 里是后端原始 snake_case 字段 (last_action_at), 兼容驼峰
const lastActionDisplay = computed(() => {
  const full = fullOrder.value as any
  const raw = full?.last_action_at || full?.lastActionAt || full?.updated_at || full?.updatedAt || null
  return formatDateTime(raw)
})

// 处理人 (接单人): 优先用后端 handler_name, 其次用卡片 handler
const handlerDisplay = computed(() => {
  const full = fullOrder.value as any
  return full?.handler_name || full?.handlerName || full?.handler || props.orderItem?.handler || null
})

// 报告人/分派人/创建时间/闭环时间: 同样加 snake_case fallback
const reporterNameDisplay = computed(() => {
  const full = fullOrder.value as any
  return full?.reporter_name || full?.reporterName || null
})
const assignerNameDisplay = computed(() => {
  const full = fullOrder.value as any
  return full?.assigner_name || full?.assignerName || null
})
const createdAtDisplay = computed(() => {
  const full = fullOrder.value as any
  return formatDateTime(full?.created_at || full?.createdAt)
})
const closedAtDisplay = computed(() => {
  const full = fullOrder.value as any
  return formatDateTime(full?.closed_at || full?.closedAt)
})

// ---- permission checks (matching WorkOrderView) ----
function canHandleProblem() {
  return (currentUser.value?.role === '带班' || currentUser.value?.role === '系统管理人') && fullOrder.value?.status === 'pending'
}

function canAcceptOrder() {
  const o = fullOrder.value
  return (currentUser.value?.role === '维修组' || currentUser.value?.role === '系统管理人') && o?.status === 'pending' && !(o as any).handlerId
}

function canDelayOrder() {
  const o = fullOrder.value
  return (currentUser.value?.role === '维修组' || currentUser.value?.role === '系统管理人') && o?.status === 'processing'
}

// ---- Handle dialog ----
const handleDialogVisible = ref(false)
const handleType = ref<'self' | 'maintenance'>('self')
const handleForm = ref({ resolution: '', images: '', level: 'medium' as const })

function openHandle() {
  handleType.value = 'self'
  handleForm.value = { resolution: '', images: '', level: 'medium' }
  handleDialogVisible.value = true
}

async function submitHandle() {
  if (!fullOrder.value) return
  const order = fullOrder.value as any

  if (handleType.value === 'self') {
    if (!handleForm.value.resolution) return
    await updateProblemOrder(order.id, {
      status: 'self_resolved',
      resolution: handleForm.value.resolution,
      resolutionImages: handleForm.value.images ? handleForm.value.images.split(',').map((s: string) => s.trim()) : [],
      closedAt: new Date().toLocaleString('zh-CN')
    })
    if (order.deviceId) {
      await updateDeviceStatusByOrder(order.deviceId, '在用', currentUser.value.name)
    }
  } else {
    await updateProblemOrder(order.id, { status: 'to_maintenance' })
    await addMaintenanceOrder({
      problemOrderId: order.id,
      content: order.content,
      level: handleForm.value.level,
      assignerId: currentUser.value.name,
      assignerName: currentUser.value.name,
      participants: [],
      status: 'pending',
      delayDays: 0,
      sparepartUsage: [],
      team: order.team || currentUser.value.team || 'A班',
      role: order.role || currentUser.value.role || '值班岗位',
      user_name: currentUser.value.name,
      reporterName: order.reporterName,
      memberName: order.memberName || ''
    })
    if (order.deviceId) {
      await updateDeviceStatusByOrder(order.deviceId, '维修中', currentUser.value.name)
    }
  }
  handleDialogVisible.value = false
  emit('updated')
}

// ---- Delay dialog ----
const delayDialogVisible = ref(false)
const delayForm = ref({ reason: '', images: '' })

function openDelay() {
  delayForm.value = { reason: '', images: '' }
  delayDialogVisible.value = true
}

function submitDelay() {
  if (!fullOrder.value || !delayForm.value.reason) return
  updateMaintenanceOrder(fullOrder.value.id, {
    status: 'delay',
    delayReason: delayForm.value.reason,
    delayDays: 1,
    delayImages: delayForm.value.images ? delayForm.value.images.split(',').map((s: string) => s.trim()).filter(Boolean) : []
  })
  delayDialogVisible.value = false
  emit('updated')
}

// ---- Complete dialog ----
const completeDialogVisible = ref(false)
const completeForm = ref({ note: '', images: '', participants: '', spareparts: [{ name: '', quantity: 1, specs: '' }] })

function openComplete() {
  completeForm.value = { note: '', images: '', participants: '', spareparts: [{ name: '', quantity: 1, specs: '' }] }
  completeDialogVisible.value = true
}

async function submitComplete() {
  if (!fullOrder.value) return
  await updateMaintenanceOrder(fullOrder.value.id, {
    status: 'completed',
    completionNote: completeForm.value.note,
    completionImages: completeForm.value.images ? completeForm.value.images.split(',').map((s: string) => s.trim()) : [],
    participants: completeForm.value.participants ? completeForm.value.participants.split(',').map((s: string) => s.trim()) : [],
    sparepartUsage: completeForm.value.spareparts.filter(sp => sp.name),
    completedAt: new Date().toLocaleString('zh-CN')
  })
  const order = fullOrder.value as any
  if (order.problemOrderId) {
    const po = problemOrders.value.find(p => p.id === order.problemOrderId)
    if (po?.deviceId) {
      await updateDeviceStatusByOrder(po.deviceId, '在用', currentUser.value.name)
    }
  } else {
    const did = matchDeviceByContent(order.content || '')
    if (did) await updateDeviceStatusByOrder(did, '在用', currentUser.value.name)
  }
  completeDialogVisible.value = false
  emit('updated')
}

// ---- Problem Close dialog ----
const problemCloseDialogVisible = ref(false)
const problemCloseForm = ref({ reason: '', images: '' })

function openProblemClose() {
  problemCloseForm.value = { reason: '', images: '' }
  problemCloseDialogVisible.value = true
}

async function submitProblemClose() {
  if (!fullOrder.value || !problemCloseForm.value.reason) return
  const order = fullOrder.value as any
  await updateMaintenanceOrder(order.id, {
    status: 'closed',
    completionNote: problemCloseForm.value.reason,
    completionImages: problemCloseForm.value.images ? problemCloseForm.value.images.split(',').map((s: string) => s.trim()) : [],
    closedAt: new Date().toLocaleString('zh-CN')
  })
  if (order.problemOrderId) {
    await updateProblemOrder(order.problemOrderId, {
      status: 'closed',
      resolution: problemCloseForm.value.reason,
      resolutionImages: problemCloseForm.value.images ? problemCloseForm.value.images.split(',').map((s: string) => s.trim()) : [],
      closedAt: new Date().toLocaleString('zh-CN')
    })
  }
  const deviceId = order.problemOrderId
    ? problemOrders.value.find(p => p.id === order.problemOrderId)?.deviceId
    : matchDeviceByContent(order.content || '')
  if (deviceId) await updateDeviceStatusByOrder(deviceId, '在用', currentUser.value.name)
  problemCloseDialogVisible.value = false
  emit('updated')
}

// ---- Review dialog ----
const reviewDialogVisible = ref(false)
const reviewResult = ref<'pass' | 'reject'>('pass')
const reviewForm = ref({ reason: '', images: '' })

function openReview() {
  reviewResult.value = 'pass'
  reviewForm.value = { reason: '', images: '' }
  reviewDialogVisible.value = true
}

async function submitReview() {
  if (!fullOrder.value) return
  if (reviewResult.value === 'reject' && !reviewForm.value.reason) return
  const order = fullOrder.value as any

  const getDeviceId = () => {
    if (order.problemOrderId) {
      return problemOrders.value.find(p => p.id === order.problemOrderId)?.deviceId
    }
    return matchDeviceByContent(order.content || '')
  }

  if (reviewResult.value === 'pass') {
    if (order.problemOrderId) {
      await updateMaintenanceOrder(order.id, { problemOrderId: null })
      await deleteProblemOrder(order.problemOrderId)
    }
    await updateMaintenanceOrder(order.id, {
      status: 'closed',
      closedAt: new Date().toLocaleString('zh-CN')
    })
    const did = getDeviceId()
    if (did) await updateDeviceStatusByOrder(did, '在用', currentUser.value.name)
  } else {
    await updateMaintenanceOrder(order.id, {
      status: 'returned',
      returnReason: reviewForm.value.reason,
      returnImages: reviewForm.value.images ? reviewForm.value.images.split(',').map((s: string) => s.trim()) : []
    })
    const did = getDeviceId()
    if (did) await updateDeviceStatusByOrder(did, '维修中', currentUser.value.name)
  }
  reviewDialogVisible.value = false
  emit('updated')
}

// ---- Edit dialog ----
const editDialogVisible = ref(false)
const editForm = ref<{ content: string; level: 'light' | 'medium' | 'heavy' }>({ content: '', level: 'medium' })

function openEdit() {
  const o = fullOrder.value as any
  editForm.value = {
    content: o?.content || '',
    level: o?.level || 'medium'
  }
  editDialogVisible.value = true
}

function submitEdit() {
  if (!fullOrder.value) return
  if (isProblem.value) {
    updateProblemOrder(fullOrder.value.id, { content: editForm.value.content })
  } else {
    updateMaintenanceOrder(fullOrder.value.id, {
      content: editForm.value.content,
      level: editForm.value.level
    })
  }
  editDialogVisible.value = false
  emit('updated')
}

// ---- Accept ----
function acceptOrder() {
  if (!fullOrder.value) return
  updateMaintenanceOrder(fullOrder.value.id, {
    handlerId: currentUser.value.name,
    handlerName: currentUser.value.name,
    status: 'processing'
  })
  emit('updated')
}

// ---- Return ----
async function returnOrder() {
  if (!fullOrder.value) return
  const order = fullOrder.value as any
  if (isProblem.value) {
    await updateProblemOrder(order.id, { status: 'pending' })
  } else {
    if (order.problemOrderId) {
      await updateProblemOrder(order.problemOrderId, { status: 'pending' })
    }
    await deleteMaintenanceOrder(order.id)
  }
  emit('updated')
  emit('close')
}

// ---- Delete dialogs ----
const deleteDialogVisible = ref(false)
function confirmDelete() { deleteDialogVisible.value = true }
async function doDelete() {
  if (!fullOrder.value) return
  if (isProblem.value) {
    await deleteProblemOrder(fullOrder.value.id)
  } else {
    await deleteMaintenanceOrder(fullOrder.value.id)
  }
  deleteDialogVisible.value = false
  emit('deleted' as any)
  emit('close')
}

// ---- Image preview ----
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

// ---- Helpers ----
function formatDisplayStatus() {
  // 修复: 之前优先返回 orderItem.status (原始英文), 导致详情弹窗标题状态不转中文
  return statusLabel(props.orderItem?.status) || (fullOrder.value ? statusLabel(fullOrder.value.status) : '--')
}

function formatDisplayLevel() {
  const lv = levelLabel(props.orderItem?.level)
  return lv ? `${lv}级` : '--'
}

// Image upload helper
async function handleImageUpload(e: Event, formRef: any) {
  const files = (e.target as HTMLInputElement).files
  if (!files || files.length === 0) return
  try {
    const fd = new FormData()
    for (const f of Array.from(files)) fd.append('files', f)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (!res.ok) {
      alert('上传失败: ' + res.status)
      return
    }
    const data = await res.json()
    const urls = data.urls || []
    formRef.value.images = (formRef.value.images ? formRef.value.images + ',' : '') + urls.join(',')
  } catch (err: any) {
    alert('上传失败: ' + err.message)
  }
}
</script>

<template>
  <div class="wodp-root">
    <div class="wodp-header">
      <div class="wodp-header-left">
        <span class="wodp-id">{{ orderItem.id }}</span>
        <span class="wodp-level-badge" :class="`level-${orderItem.level}`">{{ formatDisplayLevel() }}</span>
      </div>
      <span class="wodp-status" :style="{ background: fullOrder ? statusColor(fullOrder.status) : '#6B7280' }">
        {{ formatDisplayStatus() }}
      </span>
    </div>

    <div class="wodp-body">
      <!-- Basic info -->
      <div class="detail-row"><label>内容:</label><span class="detail-content">{{ fullOrder?.content || orderItem.content || '无' }}</span></div>
      <div class="detail-row"><label>关联设备:</label><span>{{ linkedDeviceDisplay }}</span></div>
      <div class="detail-row"><label>处理人:</label><span>{{ handlerDisplay || '未接单' }}</span></div>
      <div class="detail-row"><label>创建时间:</label><span>{{ orderItem.createTime || fullOrder?.createdAt || '无' }}</span></div>
      <div v-if="lastActionDisplay" class="detail-row"><label>最新处理:</label><span style="color:#2DD4BF;">{{ lastActionDisplay }}</span></div>

      <!-- Full order details from store -->
      <template v-if="fullOrder">
        <div v-if="reporterNameDisplay" class="detail-row">
          <label>报告人:</label>
          <span>
            {{ reporterNameDisplay }}
            <template v-if="(fullOrder as any).team">
              <span style="color:rgba(255,255,255,0.4);"> · </span>{{ (fullOrder as any).team }}
            </template>
            <template v-if="(fullOrder as any).member_name || (fullOrder as any).memberName">
              <span style="color:rgba(255,255,255,0.4);"> · </span>{{ (fullOrder as any).member_name || (fullOrder as any).memberName }}
            </template>
          </span>
        </div>
        <div v-if="assignerNameDisplay" class="detail-row"><label>分派人:</label><span>{{ assignerNameDisplay }}</span></div>
        <div v-if="closedAtDisplay" class="detail-row"><label>闭环时间:</label><span style="color:#16a34a;">{{ closedAtDisplay }}</span></div>

        <!-- Resolution -->
        <div v-if="(fullOrder as any).resolution" class="detail-row detail-block">
          <label>处理结果:</label>
          <span class="detail-content">{{ (fullOrder as any).resolution }}</span>
          <div v-if="(fullOrder as any).resolutionImages && (fullOrder as any).resolutionImages.length" class="wo-thumbs" style="margin-top:6px;">
            <img v-for="(img, idx) in (fullOrder as any).resolutionImages.slice(0, 4)" :key="'ri-'+idx" :src="img" class="wo-thumb" @click.stop="openImagePreview((fullOrder as any).resolutionImages, idx)" />
            <span v-if="(fullOrder as any).resolutionImages.length > 4" class="wo-thumb-more">+{{ (fullOrder as any).resolutionImages.length - 4 }}</span>
          </div>
        </div>

        <!-- Delay reason -->
        <div v-if="(fullOrder as any).delayReason" class="detail-row detail-block">
          <label>延时原因:</label>
          <span class="detail-content">{{ (fullOrder as any).delayReason }}</span>
          <div v-if="(fullOrder as any).delayImages && (fullOrder as any).delayImages.length" class="wo-thumbs" style="margin-top:6px;">
            <img v-for="(img, idx) in (fullOrder as any).delayImages.slice(0, 4)" :key="'di-'+idx" :src="img" class="wo-thumb" @click.stop="openImagePreview((fullOrder as any).delayImages, idx)" />
            <span v-if="(fullOrder as any).delayImages.length > 4" class="wo-thumb-more">+{{ (fullOrder as any).delayImages.length - 4 }}</span>
          </div>
        </div>

        <!-- Return reason -->
        <div v-if="(fullOrder as any).returnReason" class="detail-row detail-block">
          <label>退回原因:</label>
          <span class="detail-content">{{ (fullOrder as any).returnReason }}</span>
        </div>

        <!-- Completion note -->
        <div v-if="(fullOrder as any).completionNote" class="detail-row detail-block">
          <label>完成说明:</label>
          <span class="detail-content">{{ (fullOrder as any).completionNote }}</span>
          <div v-if="(fullOrder as any).completionImages && (fullOrder as any).completionImages.length" class="wo-thumbs" style="margin-top:6px;">
            <img v-for="(img, idx) in (fullOrder as any).completionImages.slice(0, 4)" :key="'ci-'+idx" :src="img" class="wo-thumb" @click.stop="openImagePreview((fullOrder as any).completionImages, idx)" />
            <span v-if="(fullOrder as any).completionImages.length > 4" class="wo-thumb-more">+{{ (fullOrder as any).completionImages.length - 4 }}</span>
          </div>
        </div>

        <!-- Assigned images (problem) -->
        <div v-if="(fullOrder as any).images && (fullOrder as any).images.length" class="detail-row">
          <label>图片:</label>
          <div class="wo-thumbs">
            <img v-for="(img, idx) in (fullOrder as any).images.slice(0, 4)" :key="'im-'+idx" :src="img" class="wo-thumb" @click.stop="openImagePreview((fullOrder as any).images, idx)" />
            <span v-if="(fullOrder as any).images.length > 4" class="wo-thumb-more">+{{ (fullOrder as any).images.length - 4 }}</span>
          </div>
        </div>

        <!-- Sparepart usage -->
        <div v-if="(fullOrder as any).sparepartUsage && (fullOrder as any).sparepartUsage.length" class="detail-row">
          <label>备件使用:</label>
          <div v-for="sp in (fullOrder as any).sparepartUsage" :key="sp.name" class="sp-item">{{ sp.name }} × {{ sp.quantity }} {{ sp.specs ? '(' + sp.specs + ')' : '' }}</div>
        </div>

        <!-- Participants (maintenance) -->
        <div v-if="(fullOrder as any).participants && (fullOrder as any).participants.length" class="detail-row">
          <label>参与者:</label>
          <span>
            <span v-for="(p, idx) in (fullOrder as any).participants" :key="idx" class="sp-item" style="margin-right:8px;">
              {{ typeof p === 'string' ? p : (p.name || p.user_name || p.member_name || JSON.stringify(p)) }}
            </span>
          </span>
        </div>
      </template>
    </div>

    <!-- Action buttons -->
    <div class="wodp-actions">
      <!-- Problem actions -->
      <template v-if="isProblem">
        <button v-if="canHandleProblem()" class="action-btn action-btn-primary" @click="openHandle">处理</button>
        <button v-if="has('btn:wo_edit') && fullOrder && !['closed', 'completed'].includes((fullOrder as any).status)" class="action-btn" @click="openEdit">编辑</button>
        <button v-if="has('btn:wo_edit') && fullOrder && !['closed', 'completed'].includes((fullOrder as any).status)" class="action-btn" @click="returnOrder">退回</button>
        <button v-if="has('btn:wo_delete_problem')" class="action-btn action-btn-danger" @click="confirmDelete">删除</button>
      </template>

      <!-- Maintenance actions -->
      <template v-if="isMaintenance">
        <button v-if="canAcceptOrder()" class="action-btn action-btn-primary" @click="acceptOrder">接单</button>
        <button v-if="canDelayOrder()" class="action-btn" @click="openDelay">延时</button>
        <button v-if="has('btn:wo_complete') && fullOrder && (['processing','delay','returned'] as string[]).includes((fullOrder as any).status)" class="action-btn action-btn-primary" @click="openComplete">完成</button>
        <button v-if="has('btn:wo_close_problem') && fullOrder && (fullOrder as any).status === 'processing'" class="action-btn action-btn-primary" @click="openProblemClose">问题工单闭环</button>
        <button v-if="has('btn:wo_review') && fullOrder && (fullOrder as any).status === 'completed'" class="action-btn" @click="openReview">审核</button>
        <button v-if="has('btn:wo_edit') && fullOrder && !['closed', 'completed'].includes((fullOrder as any).status)" class="action-btn" @click="openEdit">编辑</button>
        <button v-if="has('btn:wo_edit') && fullOrder && !['closed', 'completed'].includes((fullOrder as any).status)" class="action-btn" @click="returnOrder">退回</button>
        <button v-if="has('btn:wo_delete_maintenance')" class="action-btn action-btn-danger" @click="confirmDelete">删除</button>
      </template>

      <button class="action-btn action-btn-cancel" @click="emit('close')">关闭</button>
    </div>

    <!-- ===== DIALOGS ===== -->

    <!-- Handle dialog -->
    <div v-if="handleDialogVisible" class="dm-dialog-overlay" @click.self="handleDialogVisible = false">
      <div class="dm-dialog">
        <div class="dialog-header"><h3>处理问题工单</h3><button class="dialog-close" @click="handleDialogVisible = false">×</button></div>
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
            <input type="file" accept="image/*" multiple @change="e => handleImageUpload(e, { value: handleForm })" />
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
          <button class="dm-btn dm-btn-primary" @click="submitHandle">提交</button>
        </div>
      </div>
    </div>

    <!-- Delay dialog -->
    <div v-if="delayDialogVisible" class="dm-dialog-overlay" @click.self="delayDialogVisible = false">
      <div class="dm-dialog dm-dialog-sm">
        <div class="dialog-header"><h3>申请延时</h3><button class="dialog-close" @click="delayDialogVisible = false">×</button></div>
        <div class="dialog-body">
          <div class="form-row">
            <label>延时原因 <span class="required">*</span></label>
            <textarea v-model="delayForm.reason" placeholder="请填写延时原因" rows="3"></textarea>
          </div>
          <div class="form-row">
            <label>图片</label>
            <input type="file" accept="image/*" multiple @change="e => handleImageUpload(e, { value: delayForm })" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="delayDialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-primary" @click="submitDelay">提交</button>
        </div>
      </div>
    </div>

    <!-- Complete dialog -->
    <div v-if="completeDialogVisible" class="dm-dialog-overlay" @click.self="completeDialogVisible = false">
      <div class="dm-dialog">
        <div class="dialog-header"><h3>完成维修</h3><button class="dialog-close" @click="completeDialogVisible = false">×</button></div>
        <div class="dialog-body">
          <div class="form-row">
            <label>维修说明</label>
            <textarea v-model="completeForm.note" placeholder="请描述维修情况" rows="3"></textarea>
          </div>
          <div class="form-row">
            <label>完成图片</label>
            <input type="file" accept="image/*" multiple @change="e => handleImageUpload(e, { value: completeForm })" />
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

    <!-- Problem Close dialog -->
    <div v-if="problemCloseDialogVisible" class="dm-dialog-overlay" @click.self="problemCloseDialogVisible = false">
      <div class="dm-dialog dm-dialog-sm">
        <div class="dialog-header"><h3>问题工单闭环</h3><button class="dialog-close" @click="problemCloseDialogVisible = false">×</button></div>
        <div class="dialog-body">
          <div class="form-row">
            <label>闭环原因(图文)<span class="required">*</span></label>
            <textarea v-model="problemCloseForm.reason" placeholder="请说明发现的问题原因和解决方案" rows="4"></textarea>
          </div>
          <div class="form-row">
            <label>图片</label>
            <input type="file" accept="image/*" multiple @change="e => handleImageUpload(e, { value: problemCloseForm })" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="problemCloseDialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-primary" @click="submitProblemClose">确认闭环</button>
        </div>
      </div>
    </div>

    <!-- Review dialog -->
    <div v-if="reviewDialogVisible" class="dm-dialog-overlay" @click.self="reviewDialogVisible = false">
      <div class="dm-dialog dm-dialog-sm">
        <div class="dialog-header"><h3>审核维修结果</h3><button class="dialog-close" @click="reviewDialogVisible = false">×</button></div>
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
            <input type="file" accept="image/*" multiple @change="e => handleImageUpload(e, { value: reviewForm })" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="reviewDialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-primary" @click="submitReview">提交</button>
        </div>
      </div>
    </div>

    <!-- Edit dialog -->
    <div v-if="editDialogVisible" class="dm-dialog-overlay" @click.self="editDialogVisible = false">
      <div class="dm-dialog">
        <div class="dialog-header"><h3>编辑工单</h3><button class="dialog-close" @click="editDialogVisible = false">×</button></div>
        <div class="dialog-body">
          <div class="form-row">
            <label>工单内容 <span class="required">*</span></label>
            <textarea v-model="editForm.content" placeholder="请描述工单内容" rows="4"></textarea>
          </div>
          <div v-if="isMaintenance" class="form-row">
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

    <!-- Delete confirm -->
    <div v-if="deleteDialogVisible" class="dm-dialog-overlay" @click.self="deleteDialogVisible = false">
      <div class="dm-dialog dm-dialog-sm">
        <div class="dialog-header"><h3>删除工单</h3><button class="dialog-close" @click="deleteDialogVisible = false">×</button></div>
        <div class="dialog-body">
          <p>确定要删除工单 <strong>{{ orderItem.id }}</strong> 吗？此操作不可恢复。</p>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="deleteDialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-danger" @click="doDelete">确认删除</button>
        </div>
      </div>
    </div>

    <!-- Image preview -->
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

<style scoped>
.wodp-root {
  background: transparent;
  color: #fff;
}

.wodp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(45, 212, 191, 0.08);
  border-bottom: 1px solid rgba(45, 212, 191, 0.12);
  border-radius: 12px 12px 0 0;
}

.wodp-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wodp-id {
  font-size: 13px;
  color: rgba(255,255,255,0.55);
  font-family: monospace;
}

.wodp-level-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}
/* 跟维修工单卡片 (WorkOrderView.wo-level) 颜色一致: 重级红/中级黄/轻级绿 */
.level-light { background: rgba(16, 185, 129, 0.25); color: #6EE7B7; }
.level-medium { background: rgba(245, 158, 11, 0.25); color: #FCD34D; }
.level-heavy { background: rgba(239, 68, 68, 0.25); color: #FCA5A5; }

.wodp-status {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 10px;
  color: #fff;
  font-weight: 500;
}

.wodp-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 50vh;
  overflow-y: auto;
}

.detail-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.detail-row label {
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  min-width: 70px;
  flex-shrink: 0;
  padding-top: 1px;
}

.detail-row span {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
}

.detail-block {
  flex-direction: column;
  gap: 4px;
}

.detail-content {
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}

.wo-thumbs { display: flex; gap: 4px; flex-wrap: wrap; }
.wo-thumb { width: 44px; height: 44px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); }
.wo-thumb:hover { border-color: #2DD4BF; }
.wo-thumb-more { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.08); border-radius: 4px; font-size: 12px; color: rgba(255,255,255,0.6); }

.sp-item {
  color: rgba(255,255,255,0.6);
  font-size: 12px;
  padding: 2px 0;
}

.wodp-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  padding: 14px 20px;
  border-top: 1px solid rgba(45, 212, 191, 0.1);
}

/* ---- shared dialog/button styles ---- */
.action-btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.8);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}
.action-btn:hover { background: rgba(255,255,255,0.12); }
.action-btn-primary { background: rgba(45, 212, 191, 0.18); border-color: rgba(45, 212, 191, 0.4); color: #2DD4BF; }
.action-btn-primary:hover { background: rgba(45, 212, 191, 0.28); }
.action-btn-danger { background: rgba(239, 68, 68, 0.12); border-color: rgba(239, 68, 68, 0.25); color: #FCA5A5; }
.action-btn-danger:hover { background: rgba(239, 68, 68, 0.22); }
.action-btn-cancel { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); }

.dm-dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.dm-dialog {
  background: #0f3248;
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 12px;
  width: 520px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

.dm-dialog-sm { width: 400px; }

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(45, 212, 191, 0.15);
}

.dialog-header h3 {
  color: #fff;
  font-size: 16px;
  margin: 0;
}

.dialog-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
}

.dialog-close:hover { color: #fff; }

.dialog-body {
  padding: 20px;
  max-height: 55vh;
  overflow-y: auto;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid rgba(45, 212, 191, 0.1);
}

.form-row { margin-bottom: 14px; }
.form-row label { display: block; color: rgba(255, 255, 255, 0.6); font-size: 12px; margin-bottom: 6px; }
.required { color: #EF4444; }

.form-row input, .form-row select, .form-row textarea {
  width: 100%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 6px;
  padding: 8px 12px;
  color: #fff;
  font-size: 13px;
  box-sizing: border-box;
  outline: none;
  font-family: inherit;
}

.form-row input:focus, .form-row select:focus, .form-row textarea:focus {
  border-color: rgba(45, 212, 191, 0.5);
}

.form-row textarea { resize: vertical; min-height: 72px; }
.form-row select option { background: #0f3248; color: #fff; }

.radio-group {
  display: flex;
  gap: 16px;
}
.radio-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255,255,255,0.8);
  font-size: 13px;
  cursor: pointer;
}
.radio-item input { accent-color: #2DD4BF; }

.sparepart-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;
}
.sparepart-row input { flex: 1; }
.sparepart-row input[type="number"] { width: 70px; flex: none; }
.icon-btn {
  background: none;
  border: none;
  color: #FCA5A5;
  font-size: 18px;
  cursor: pointer;
}

.dm-btn {
  padding: 7px 16px;
  border-radius: 6px;
  border: 1px solid rgba(45, 212, 191, 0.3);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.dm-btn:hover { background: rgba(255, 255, 255, 0.1); }
.dm-btn-primary { background: rgba(45, 212, 191, 0.2); border-color: rgba(45, 212, 191, 0.5); color: #2DD4BF; }
.dm-btn-primary:hover { background: rgba(45, 212, 191, 0.3); }
.dm-btn-danger { background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.4); color: #EF4444; }
.dm-btn-danger:hover { background: rgba(239, 68, 68, 0.35); }
.dm-btn-cancel { background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.15); color: rgba(255, 255, 255, 0.6); }
.dm-btn-sm { padding: 4px 10px; font-size: 12px; }

/* Image preview */
.image-preview-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 3000; display: flex; align-items: center; justify-content: center; }
.image-preview-content { max-width: 90vw; max-height: 90vh; }
.image-preview-content img { max-width: 100%; max-height: 90vh; object-fit: contain; }
.image-preview-close { position: absolute; top: 20px; right: 20px; width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.15); color: #fff; border: none; font-size: 18px; cursor: pointer; }
.image-preview-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.15); color: #fff; border: none; font-size: 24px; cursor: pointer; }
.image-preview-nav.left { left: 20px; }
.image-preview-nav.right { right: 20px; }
.image-preview-nav:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
