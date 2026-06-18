<script setup lang="ts">
import { ref, computed } from 'vue'
import { currentUser, updateDevice, deleteDevice } from '../composables/useDeviceStore'
import { problemOrders, maintenanceOrders, statusLabel } from '../composables/useWorkOrderStore'
import WorkOrderDetailPanel from './WorkOrderDetailPanel.vue'

const props = withDefaults(defineProps<{
  device: any
  showActions?: boolean  // 是否显示编辑/删除按钮 (独立页面里不需, 默认 true)
  showClose?: boolean    // 是否显示关闭按钮 (独立页面里不需, 默认 true)
}>(), {
  showActions: true,
  showClose: true
})

const emit = defineEmits<{
  close: []
  updated: []
  deleted: []
}>()

// 设备 ID (统一 string 类型, 避免 number/string 不匹配)
const deviceIdStr = computed(() => String(props.device?.id ?? ''))

// 关联工单: 筛选 deviceId 匹配的所有工单
// 后端 problemOrders 里 device_id 是 number, maintenanceOrders 里 device_id 是 number, 但本组件 device.id 可能是 string
const relatedOrders = computed(() => {
  const all: any[] = []
  // 问题工单: 排除已转维修的 (to_maintenance), 避免与对应的维修工单重复
  for (const o of problemOrders.value as any[]) {
    if (o.status === 'to_maintenance') continue
    if (String(o.device_id ?? o.deviceId) === deviceIdStr.value) {
      all.push({ ...o, _type: 'problem' })
    }
  }
  // 维修工单
  for (const o of maintenanceOrders.value as any[]) {
    if (String(o.device_id ?? o.deviceId) === deviceIdStr.value) {
      all.push({ ...o, _type: 'maintenance' })
    }
  }
  // 按创建时间倒序
  return all.sort((a, b) => {
    const ta = new Date(a.created_at || a.createdAt || 0).getTime()
    const tb = new Date(b.created_at || b.createdAt || 0).getTime()
    return tb - ta
  })
})

// 当前选中的工单 (点击后弹 WorkOrderDetailPanel)
const selectedOrder = ref<any>(null)
const showOrderModal = ref(false)
function openOrderDetail(order: any) {
  // 转换为 dashboard 卡片格式 (跟 MainDashboard 调 WorkOrderDetailPanel 保持一致)
  // level/status 需要中文 (后端返回的是 heavy/delay 等英文)
  const orderItem = {
    id: order._type === 'problem' ? `PO-${order.id}` : `WO-${order.id}`,
    _type: order._type,
    title: (order.content || '工单').slice(0, 30),
    device: props.device.name,
    level: levelLabel(order.level),          // 翻译: heavy→紧急
    createTime: fmtTime(order.created_at),   // 格式化为北京时间 yyyy/MM/dd HH:mm
    status: statusLabel(order.status),       // 翻译: delay→延时中
    handler: order.handler_name || order.assigner_name || order.user_name || '--'
  }
  selectedOrder.value = orderItem
  showOrderModal.value = true
}
function closeOrderModal() {
  showOrderModal.value = false
  selectedOrder.value = null
}

// 中文级别名
function levelLabel(lv: string): string {
  const map: Record<string, string> = {
    heavy: '紧急', medium: '中等', light: '普通',
    urgent: '紧急', high: '紧急', low: '普通'
  }
  return map[lv] || lv || '普通'
}

// 格式化时间为 'yyyy/MM/dd HH:mm' 北京时间
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '--'
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    })
  } catch { return iso }
}

// ---- permissions ----
const canEditDevice = computed(() => {
  const role = currentUser.value?.role
  return role === '维修组' || role === '系统管理人'
})
const canDeleteDevice = computed(() => {
  return currentUser.value?.role === '系统管理人'
})

// ---- edit dialog ----
const editDialogVisible = ref(false)
const editing = ref(false)
const editForm = ref({
  name: '', type: '', model: '', vendor: '', location: '', value: null as number | null, remark: '', params: ''
})
const paramsText = ref('')
const paramsInput = ref({
  voltage: { checked: false, value: '' },
  current: { checked: false, value: '' },
  power: { checked: false, value: '' },
  pipeDiameter: { checked: false, value: '' }
})
const techDocs = ref<any[]>([])
const uploading = ref(false)

function openEdit() {
  const d = props.device
  editForm.value = { name: d.name, type: d.type, model: d.model || '', vendor: d.vendor || '', location: d.location || '', value: d.value ?? null, remark: d.remark || '', params: d.params || '' }
  paramsText.value = d.params || ''
  techDocs.value = Array.isArray(d.tech_docs) ? [...d.tech_docs] : []
  paramsInput.value = { voltage: { checked: false, value: '' }, current: { checked: false, value: '' }, power: { checked: false, value: '' }, pipeDiameter: { checked: false, value: '' } }
  editDialogVisible.value = true
}

function onPresetCheck(label: string, slot: { checked: boolean; value: string }, ev: Event) {
  const checked = (ev.target as HTMLInputElement).checked
  if (!checked) return
  const kv = label + ':' + (slot.value || '')
  if (paramsText.value && !paramsText.value.trimEnd().endsWith(',')) {
    paramsText.value = paramsText.value.trimEnd() + ','
  }
  paramsText.value = paramsText.value + kv
}

async function onUploadTechDoc(ev: Event) {
  const input = ev.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return
  uploading.value = true
  try {
    const formData = new FormData()
    for (let i = 0; i < files.length; i++) formData.append('files', files[i])
    const r = await fetch('/api/upload/', {
      method: 'POST',
      headers: { 'X-User-Id': String(currentUser.value?.id || 0) },
      body: formData
    })
    if (!r.ok) throw new Error('Upload failed')
    const data = await r.json()
    const newItems = (data.items || []).map((it: any) => ({
      url: it.url, name: it.name, size: it.size,
      uploaded_at: new Date().toISOString(),
      uploaded_by: currentUser.value?.name || '未知'
    }))
    techDocs.value = [...techDocs.value, ...newItems]
  } catch (err) {
    alert('上传失败：' + (err instanceof Error ? err.message : String(err)))
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function removeTechDoc(idx: number) {
  techDocs.value.splice(idx, 1)
}

function formatSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB'
}

async function saveEdit() {
  if (!editForm.value.name || !editForm.value.type) {
    alert('请填写必填项')
    return
  }
  const record: any = {
    name: editForm.value.name,
    type: editForm.value.type,
    model: editForm.value.model,
    vendor: editForm.value.vendor,
    location: editForm.value.location,
    value: editForm.value.value ?? 0,
    remark: editForm.value.remark,
    params: paramsText.value,
    tech_docs: techDocs.value
  }
  await updateDevice(props.device.id, record, currentUser.value.name)
  editDialogVisible.value = false
  emit('updated')
}

// ---- delete dialog ----
const deleteDialogVisible = ref(false)
function confirmDelete() {
  deleteDialogVisible.value = true
}
async function doDelete() {
  await deleteDevice(props.device.id)
  deleteDialogVisible.value = false
  emit('deleted')
}
</script>

<template>
  <div class="ddp-root">
    <!-- header with status badge -->
    <div class="ddp-header">
      <h2>{{ device.name }}</h2>
      <span class="status-badge" :class="`status-${device.status}`">{{ device.status }}</span>
    </div>

    <div class="ddp-body">
      <!-- 基本信息 -->
      <div class="info-section">
        <h3 class="section-title">基本信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">设备编号</span>
            <span class="info-value">{{ device.id }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">设备名称</span>
            <span class="info-value">{{ device.name }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">设备类型</span>
            <span class="info-value">{{ device.type }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">型号</span>
            <span class="info-value">{{ device.model || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">厂家</span>
            <span class="info-value">{{ device.vendor || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">安装地点</span>
            <span class="info-value">{{ device.location || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">备注</span>
            <span class="info-value">{{ device.remark || '无' }}</span>
          </div>
        </div>
      </div>

      <!-- 技术参数 -->
      <div class="info-section">
        <h3 class="section-title">技术参数</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">参数</span>
            <span class="info-value">{{ device.params || '-' }}</span>
          </div>
        </div>
      </div>

      <!-- 技术文档 -->
      <div class="info-section">
        <h3 class="section-title">技术文档</h3>
        <div v-if="device.tech_docs && device.tech_docs.length" class="docs-list">
          <a v-for="(doc, idx) in device.tech_docs" :key="idx" :href="doc.url" target="_blank" class="doc-item-link" :title="`点击打开: ${doc.name}`">
            <span class="doc-emoji">📄</span>
            <span class="doc-name-text">{{ doc.name }}</span>
            <span class="doc-size-text">{{ formatSize(doc.size) }}</span>
            <span class="doc-action">打开</span>
          </a>
        </div>
        <div v-else class="doc-none">暂无技术文档</div>
      </div>

      <!-- 关联工单 (非在用设备才有意义) -->
      <div v-if="relatedOrders.length > 0" class="info-section">
        <h3 class="section-title">关联工单 ({{ relatedOrders.length }})</h3>
        <div class="related-orders">
          <div
            v-for="order in relatedOrders"
            :key="`${order._type}-${order.id}`"
            class="related-order-item"
            @click="openOrderDetail(order)"
          >
            <div class="ro-header">
              <span class="ro-id">{{ order._type === 'problem' ? 'PO-' : 'WO-' }}{{ order.id }}</span>
              <span class="ro-level" :class="`level-${order.level}`">{{ levelLabel(order.level) }}</span>
              <span class="ro-status" :class="`ro-status-${order.status}`">{{ statusLabel(order.status) }}</span>
            </div>
            <div class="ro-content">{{ (order.content || '工单').slice(0, 50) }}{{ (order.content || '').length > 50 ? '...' : '' }}</div>
            <div class="ro-meta">
              <span v-if="order.reporter_name || order.member_name">
                报告人: {{ order.reporter_name }}{{ order.team ? ' · ' + order.team : '' }}{{ order.member_name ? ' · ' + order.member_name : '' }}
              </span>
              <span class="ro-time">{{ fmtTime(order.created_at) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- action buttons -->
      <div class="ddp-actions">
        <button v-if="showActions && canEditDevice" class="dm-btn dm-btn-primary" @click="openEdit">✏️ 编辑</button>
        <button v-if="showActions && canDeleteDevice" class="dm-btn dm-btn-danger" @click="confirmDelete">🗑️ 删除</button>
        <button v-if="showClose" class="dm-btn dm-btn-cancel" @click="emit('close')">关闭</button>
      </div>
    </div>

    <!-- 编辑对话框 -->
    <div v-if="editDialogVisible" class="dm-dialog-overlay" @click.self="editDialogVisible = false">
      <div class="dm-dialog">
        <div class="dialog-header">
          <h3>编辑设备</h3>
          <button class="dialog-close" @click="editDialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label>设备名称 <span class="required">*</span></label>
            <input v-model="editForm.name" type="text" placeholder="请输入设备名称" />
          </div>
          <div class="form-row">
            <label>设备类型 <span class="required">*</span></label>
            <select v-model="editForm.type">
              <option value="">请选择</option>
              <option value="水泵">水泵</option>
              <option value="电机">电机</option>
              <option value="仪表">仪表</option>
              <option value="阀门">阀门</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <div class="form-row">
            <label>型号</label>
            <input v-model="editForm.model" type="text" placeholder="请输入型号" />
          </div>
          <div class="form-row">
            <label>厂家</label>
            <input v-model="editForm.vendor" type="text" placeholder="请输入厂家" />
          </div>
          <div class="form-row">
            <label>安装地点</label>
            <input v-model="editForm.location" type="text" placeholder="请输入安装地点" />
          </div>
          <div class="form-row">
            <label>价值金额(元)</label>
            <input v-model.number="editForm.value" type="number" placeholder="请输入价值金额" />
          </div>
          <div class="form-row">
            <label>备注</label>
            <textarea v-model="editForm.remark" placeholder="请输入备注信息" rows="3"></textarea>
          </div>
          <div class="form-row">
            <label>参数</label>
            <div class="params-edit-wrap">
              <textarea v-model="paramsText" class="specs-textarea" rows="3" placeholder="直接编辑参数，如: 电压:380V, 电流:30A, 功率:15kW" />
              <div class="params-checkboxes">
                <div class="preset-item">
                  <label class="param-check"><input type="checkbox" @change="onPresetCheck('电压', paramsInput.voltage, $event)" />电压</label>
                  <input v-model="paramsInput.voltage.value" type="text" placeholder="如 380V" class="param-input" />
                </div>
                <div class="preset-item">
                  <label class="param-check"><input type="checkbox" @change="onPresetCheck('电流', paramsInput.current, $event)" />电流</label>
                  <input v-model="paramsInput.current.value" type="text" placeholder="如 30A" class="param-input" />
                </div>
                <div class="preset-item">
                  <label class="param-check"><input type="checkbox" @change="onPresetCheck('功率', paramsInput.power, $event)" />功率</label>
                  <input v-model="paramsInput.power.value" type="text" placeholder="如 15kW" class="param-input" />
                </div>
                <div class="preset-item">
                  <label class="param-check"><input type="checkbox" @change="onPresetCheck('管径', paramsInput.pipeDiameter, $event)" />管径</label>
                  <input v-model="paramsInput.pipeDiameter.value" type="text" placeholder="如 DN100" class="param-input" />
                </div>
              </div>
            </div>
          </div>
          <!-- 技术文档 -->
          <div class="form-row">
            <label>技术文档</label>
            <div class="tech-docs-edit">
              <div v-if="techDocs.length === 0" class="tech-docs-empty">未上传技术文档</div>
              <div v-for="(doc, idx) in techDocs" :key="idx" class="tech-doc-item tech-doc-item-editable">
                <span class="doc-icon">📄</span>
                <a :href="doc.url" target="_blank" class="doc-name" :title="`点击打开: ${doc.name}`">{{ doc.name }}</a>
                <span class="doc-size">{{ formatSize(doc.size) }}</span>
                <button type="button" class="doc-remove" @click="removeTechDoc(idx)" title="移除">×</button>
              </div>
              <label class="tech-docs-upload">
                <input type="file" multiple @change="onUploadTechDoc" :disabled="uploading" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.dwg,.jpg,.jpeg,.png,.gif,.webp,.bmp" />
                <span v-if="!uploading">📎 上传技术文档 (可多个)</span>
                <span v-else>上传中...</span>
              </label>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="editDialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-primary" @click="saveEdit">保存</button>
        </div>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <div v-if="deleteDialogVisible" class="dm-dialog-overlay" @click.self="deleteDialogVisible = false">
      <div class="dm-dialog dm-dialog-sm">
        <div class="dialog-header">
          <h3>确认删除</h3>
          <button class="dialog-close" @click="deleteDialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <p>确定要删除设备 <strong>{{ device.name }}</strong> 吗？此操作不可撤销。</p>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="deleteDialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-danger" @click="doDelete">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 嵌套工单详情弹窗 -->
    <n-modal
      v-model:show="showOrderModal"
      :mask-closable="true"
      title="工单详情"
      class="detail-modal-shell"
      style="width: 800px;"
      :bordered="false"
      size="huge"
    >
      <WorkOrderDetailPanel
        v-if="selectedOrder"
        :order-item="selectedOrder"
        @close="closeOrderModal"
      />
    </n-modal>
  </div>
</template>

<style scoped>
.ddp-root {
  background: transparent;
  color: #fff;
}

.related-orders { display: flex; flex-direction: column; gap: 8px; }
.related-order-item {
  background: rgba(45, 212, 191, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.15);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.related-order-item:hover {
  background: rgba(45, 212, 191, 0.12);
  border-color: rgba(45, 212, 191, 0.3);
  transform: translateX(2px);
}
.ro-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.ro-id { font-size: 12px; color: rgba(255,255,255,0.6); font-family: ui-monospace, monospace; }
.ro-level {
  font-size: 10px; padding: 2px 8px; border-radius: 8px; font-weight: 600;
}
.level-heavy, .level-urgent, .level-high {
  background: rgba(239, 68, 68, 0.25); color: #FCA5A5;
}
.level-medium {
  background: rgba(245, 158, 11, 0.25); color: #FCD34D;
}
.level-light, .level-low {
  background: rgba(30, 107, 184, 0.3); color: #93C5FD;
}
.ro-status {
  font-size: 10px; padding: 2px 8px; border-radius: 8px; font-weight: 600;
  background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.85);
  margin-left: auto;
}
.ro-status-pending, .ro-status-self_resolved { background: rgba(16, 185, 129, 0.3); color: #6EE7B7; }
.ro-status-to_maintenance, .ro-status-processing { background: rgba(245, 158, 11, 0.3); color: #FCD34D; }
.ro-status-delay { background: rgba(234, 179, 8, 0.3); color: #FDE047; }
.ro-status-returned { background: rgba(239, 68, 68, 0.3); color: #FCA5A5; }
.ro-status-completed, .ro-status-closed { background: rgba(16, 185, 129, 0.3); color: #6EE7B7; }

.ro-content { font-size: 13px; color: #fff; line-height: 1.5; margin-bottom: 6px; }
.ro-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: rgba(255,255,255,0.5); gap: 12px; }
.ro-meta span:first-child { flex: 1; }
.ro-time { white-space: nowrap; color: rgba(255,255,255,0.4); font-family: ui-monospace, monospace; }

.ddp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(45, 212, 191, 0.08);
  border-bottom: 1px solid rgba(45, 212, 191, 0.12);
  border-radius: 12px 12px 0 0;
}

.ddp-header h2 {
  color: #fff;
  font-size: 18px;
  margin: 0;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-在用 { background: rgba(45, 212, 191, 0.2); color: #2DD4BF; }
.status-维修中 { background: rgba(59, 130, 246, 0.2); color: #60A5FA; }
.status-告警 { background: rgba(239, 68, 68, 0.2); color: #EF4444; }

.ddp-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-height: 65vh;
  overflow-y: auto;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(45, 212, 191, 0.1);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
}

.info-value {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
}

.docs-list { display: flex; flex-direction: column; gap: 8px; }
.doc-item-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  color: rgba(255,255,255,0.85);
  text-decoration: none;
  transition: background 0.15s;
}
.doc-item-link:hover { background: rgba(45, 212, 191, 0.1); }
.doc-emoji { font-size: 18px; }
.doc-name-text { flex: 1; color: #60a5fa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-item-link:hover .doc-name-text { color: #93c5fd; text-decoration: underline; }
.doc-size-text { color: rgba(255,255,255,0.5); font-size: 12px; font-family: ui-monospace, monospace; }
.doc-action { color: #2dd4bf; font-size: 12px; }
.doc-none { color: rgba(255, 255, 255, 0.3); font-size: 13px; }

.ddp-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid rgba(45, 212, 191, 0.1);
}

/* ---- shared dialog styles ---- */
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

.params-edit-wrap { display: flex; flex-direction: column; gap: 8px; }
.param-input {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 4px;
  color: rgba(255,255,255,0.85);
  padding: 4px 6px;
  font-size: 13px;
  width: 90px;
}
.preset-item { display: flex; align-items: center; gap: 6px; }
.params-checkboxes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  align-items: center;
}
.specs-textarea {
  width: 100%;
  padding: 8px 10px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  color: rgba(255,255,255,0.85);
  font-family: ui-monospace, monospace;
  font-size: 13px;
  resize: vertical;
}
.param-check { display: flex; align-items: center; gap: 2px; font-size: 13px; color: rgba(255,255,255,0.85); cursor: pointer; white-space: nowrap; }
.param-check input { cursor: pointer; accent-color: #2DD4BF; width: 14px; height: 14px; }

.tech-docs-edit { display: flex; flex-direction: column; gap: 6px; }
.tech-docs-empty { color: rgba(255,255,255,0.4); font-size: 12px; font-style: italic; padding: 4px 0; }
.tech-doc-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  color: rgba(255,255,255,0.85);
  font-size: 13px;
}
.tech-doc-item:hover { background: rgba(45, 212, 191, 0.1); }
.doc-icon { font-size: 16px; }
.doc-name { flex: 1; color: #60a5fa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-size { color: rgba(255,255,255,0.5); font-size: 11px; font-family: ui-monospace, monospace; }
.doc-remove {
  width: 22px; height: 22px;
  border: none; border-radius: 50%;
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: flex; align-items: center; justify-content: center;
}
.doc-remove:hover { background: rgba(239, 68, 68, 0.4); }
.tech-docs-upload {
  display: inline-flex; align-items: center;
  padding: 6px 12px;
  background: rgba(45, 212, 191, 0.1);
  color: #2dd4bf;
  border: 1px dashed rgba(45, 212, 191, 0.4);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-top: 4px;
}
.tech-docs-upload:hover { background: rgba(45, 212, 191, 0.18); }
.tech-docs-upload input[type=file] { display: none; }
.tech-docs-upload:has(input:disabled) { opacity: 0.5; cursor: not-allowed; }
</style>
