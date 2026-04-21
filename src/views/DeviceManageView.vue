<template>
  <div class="device-page">
    <TopNavBar />
    <div class="device-manage">
      <div class="dm-title">
        <h2>{{ pageTitle }}</h2>
        <span class="dm-count">共 {{ filteredDevices.length }} 台设备</span>
      </div>
      <div class="dm-actions">
        <button class="dm-btn dm-btn-primary" @click="openAddDialog">
          <span>+</span> 新增设备
        </button>
        <button class="dm-btn dm-btn-export" @click="exportSelected" :disabled="selectedIds.length === 0">
          📥 批量导出 ({{ selectedIds.length }})
        </button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="dm-search">
      <input v-model="searchName" type="text" placeholder="设备名称" class="search-input" />
      <select v-model="searchType" class="search-select">
        <option value="">全部类型</option>
        <option value="水泵">水泵</option>
        <option value="电机">电机</option>
        <option value="仪表">仪表</option>
        <option value="阀门">阀门</option>
        <option value="其他">其他</option>
      </select>
      <input v-model="searchModel" type="text" placeholder="型号" class="search-input search-input-sm" />
      <input v-model="searchLocation" type="text" placeholder="安装地点" class="search-input search-input-sm" />
      <button class="dm-btn dm-btn-search" @click="doSearch">🔍 搜索</button>
      <button class="dm-btn dm-btn-reset" @click="resetSearch">重置</button>
    </div>

    <!-- 设备列表 -->
    <div class="dm-table-wrap">
      <table class="dm-table">
        <thead>
          <tr>
            <th class="col-check"><input type="checkbox" @change="toggleSelectAll" :checked="isAllSelected" /></th>
            <th>设备名称</th>
            <th>类型</th>
            <th>型号</th>
            <th>安装地点</th>
            <th>额定电压</th>
            <th>功率</th>
            <th>管径</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="device in paginatedDevices" :key="device.id">
            <td class="col-check"><input type="checkbox" :value="device.id" v-model="selectedIds" /></td>
            <td><span class="device-name-link" @click="goDetail(device)">{{ device.name }}</span></td>
            <td><span class="type-badge">{{ device.type }}</span></td>
            <td>{{ device.model }}</td>
            <td>{{ device.location }}</td>
            <td>{{ device.params?.voltage ?? '-' }}</td>
            <td>{{ device.params?.power ?? '-' }}</td>
            <td>{{ device.params?.pipeDiameter ?? '-' }}</td>
            <td class="col-actions">
              <button class="action-btn" @click="openEditDialog(device)">✏️ 编辑</button>
              <button class="action-btn action-btn-danger" @click="confirmDelete(device)">🗑️ 删除</button>
            </td>
          </tr>
          <tr v-if="paginatedDevices.length === 0">
            <td colspan="9" class="empty-row">暂无设备数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div class="dm-pagination">
      <span>共 {{ filteredDevices.length }} 条，每页显示</span>
      <select v-model="pageSize" @change="currentPage = 1">
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="50">50</option>
      </select>
      <span>条</span>
      <button class="page-btn" @click="currentPage = 1" :disabled="currentPage === 1">«</button>
      <button class="page-btn" @click="currentPage--" :disabled="currentPage === 1">‹</button>
      <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
      <button class="page-btn" @click="currentPage++" :disabled="currentPage >= totalPages">›</button>
      <button class="page-btn" @click="currentPage = totalPages" :disabled="currentPage >= totalPages">»</button>
    </div>

    <!-- 新增/编辑对话框 -->
    <div v-if="dialogVisible" class="dm-dialog-overlay" @click.self="dialogVisible = false">
      <div class="dm-dialog">
        <div class="dialog-header">
          <h3>{{ editingDevice ? '编辑设备' : '新增设备' }}</h3>
          <button class="dialog-close" @click="dialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label>设备名称 <span class="required">*</span></label>
            <input v-model="form.name" type="text" placeholder="请输入设备名称" />
          </div>
          <div class="form-row">
            <label>设备类型 <span class="required">*</span></label>
            <select v-model="form.type">
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
            <input v-model="form.model" type="text" placeholder="请输入型号" />
          </div>
          <div class="form-row">
            <label>厂家</label>
            <input v-model="form.vendor" type="text" placeholder="请输入厂家" />
          </div>
          <div class="form-row">
            <label>安装地点</label>
            <input v-model="form.location" type="text" placeholder="请输入安装地点" />
          </div>
          <div class="form-row">
            <label>价值金额(元)</label>
            <input v-model.number="form.value" type="number" placeholder="请输入价值金额" />
          </div>
          <div class="form-row">
            <label>备注</label>
            <textarea v-model="form.remark" placeholder="请输入备注信息" rows="3"></textarea>
          </div>
          <div class="form-row">
            <label>技术文档</label>
            <div class="file-upload">
              <input type="file" accept=".doc,.docx,.pdf" @change="handleFileChange" ref="fileInput" />
              <div v-if="form.doc" class="file-name">📄 {{ form.doc }}</div>
              <div v-else class="file-hint">支持 .doc .docx .pdf 格式</div>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="dialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-primary" @click="saveDevice">{{ editingDevice ? '保存' : '新增' }}</button>
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
          <p>确定要删除设备 <strong>{{ deletingDevice?.name }}</strong> 吗？此操作不可撤销。</p>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="deleteDialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-danger" @click="doDelete">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TopNavBar from '../components/TopNavBar.vue'
import { deviceListWithStatus, addDevice, updateDevice, deleteDevice } from '../composables/useDeviceStore'

const route = useRoute()
const router = useRouter()


// 页面标题
const pageTitle = computed(() => {
  const map: Record<string, string> = {
    '/device/inuse': '在用设备',
    '/device/warning': '告警设备',
    '/device/maintenance': '维修设备',
    '/device/changes': '设备变动'
  }
  return map[route.path] || '设备管理'
})

// 设备数据
const allDevices = deviceListWithStatus
const searchName = ref('')
const searchType = ref('')
const searchModel = ref('')
const searchLocation = ref('')

// 对话框
const dialogVisible = ref(false)
const deleteDialogVisible = ref(false)
const editingDevice = ref<any>(null)
const deletingDevice = ref<any>(null)
const fileInput = ref<any>(null)

// 表单（不含status，由store计算）
const form = ref({
  name: '', type: '', model: '', vendor: '', location: '', value: null as number | null, remark: '', doc: null as string | null
})

// 分页
const currentPage = ref(1)
const pageSize = ref(10)

// 选中
const selectedIds = ref<string[]>([])

// 状态筛选
const statusFilter = computed(() => {
  const map: Record<string, string> = {
    '/device/inuse': '在用',
    '/device/warning': '告警',
    '/device/maintenance': '维修中',
    '/device/changes': '变动'
  }
  return map[route.path] || ''
})

// 过滤后设备
const filteredDevices = computed(() => {
  return allDevices.value.filter(d => {
    const matchStatus = !statusFilter.value || d.status === statusFilter.value
    const matchName = !searchName.value || d.name.includes(searchName.value)
    const matchType = !searchType.value || d.type === searchType.value
    const matchModel = !searchModel.value || d.model.includes(searchModel.value)
    const matchLocation = !searchLocation.value || d.location.includes(searchLocation.value)
    return matchStatus && matchName && matchType && matchModel && matchLocation
  })
})

// 分页数据
const totalPages = computed(() => Math.max(1, Math.ceil(filteredDevices.value.length / pageSize.value)))
const paginatedDevices = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredDevices.value.slice(start, start + pageSize.value)
})

const isAllSelected = computed(() => {
  return paginatedDevices.value.length > 0 && paginatedDevices.value.every(d => selectedIds.value.includes(d.id))
})

// 搜索
function doSearch() {
  currentPage.value = 1
}

function resetSearch() {
  searchName.value = ''
  searchType.value = ''
  searchModel.value = ''
  searchLocation.value = ''
  currentPage.value = 1
}

// 新增
function openAddDialog() {
  editingDevice.value = null
  form.value = { name: '', type: '', model: '', vendor: '', location: '', value: null, remark: '', doc: null }
  dialogVisible.value = true
}

// 编辑
function openEditDialog(device: any) {
  editingDevice.value = device
  form.value = { ...device }
  dialogVisible.value = true
}

// 保存
function saveDevice() {
  if (!form.value.name || !form.value.type) {
    alert('请填写必填项')
    return
  }
  const record: any = {
    name: form.value.name,
    type: form.value.type,
    model: form.value.model,
    vendor: form.value.vendor,
    location: form.value.location,
    value: form.value.value ?? 0,
    remark: form.value.remark,
    doc: form.value.doc,
    params: { voltage: '-', power: '-', current: '-', pipeDiameter: '-' }
  }
  if (editingDevice.value) {
    updateDevice(editingDevice.value.id, record)
  } else {
    addDevice(record)
  }
  dialogVisible.value = false
}

// 删除
function confirmDelete(device: any) {
  deletingDevice.value = device
  deleteDialogVisible.value = true
}

function doDelete() {
  deleteDevice(deletingDevice.value.id)
  deleteDialogVisible.value = false
  selectedIds.value = selectedIds.value.filter(id => id !== deletingDevice.value.id)
}

// 全选
function toggleSelectAll(e: any) {
  if (e.target.checked) {
    selectedIds.value = paginatedDevices.value.map(d => d.id)
  } else {
    selectedIds.value = []
  }
}

// 文件上传
function handleFileChange(e: any) {
  const file = e.target.files[0]
  if (file) {
    form.value.doc = file.name
  }
}

// 下载文档

function goDetail(device: any) {
  router.push(`/device/detail/${device.id}`)
}

// 导出单个

// 批量导出
function exportSelected() {
  const devices = allDevices.value.filter(d => selectedIds.value.includes(d.id))
  const content = devices.map(generateDoc).join('\n---\n')
  downloadFile(content, `设备资料_批量导出.txt`)
}

function generateDoc(d: any) {
  return `设备名称: ${d.name}
设备类型: ${d.type}
型号: ${d.model}
厂家: ${d.vendor}
安装地点: ${d.location}
价值金额: ${d.value?.toLocaleString() ?? '-'} 元
状态: ${d.status}
备注: ${d.remark || '无'}
技术文档: ${d.doc || '无'}`
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.device-page {
  position: relative;
  min-height: 100vh;
  background: #0f2d4a;
  padding: 0 20px 20px;
}

.device-manage {
  padding: 0;
}

/* 顶部操作栏 */
.dm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0 12px;
  background: rgba(15, 45, 75, 0.8);
  border-bottom: 1px solid rgba(45, 212, 191, 0.12);
  margin-bottom: 12px;
}

.dm-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.dm-title h2 {
  color: #fff;
  font-size: 20px;
  margin: 0;
}

.dm-count {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.dm-actions {
  display: flex;
  gap: 10px;
}

/* 搜索栏 */
.dm-search {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(45, 212, 191, 0.1);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.search-input, .search-select {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 6px;
  padding: 7px 12px;
  color: #fff;
  font-size: 13px;
  outline: none;
}

.search-input {
  width: 140px;
}

.search-input-sm {
  width: 100px;
}

.search-select {
  min-width: 110px;
}

.search-input::placeholder, .search-select::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.search-input:focus, .search-select:focus {
  border-color: rgba(45, 212, 191, 0.5);
}

/* 按钮 */
.dm-btn {
  padding: 7px 16px;
  border-radius: 6px;
  border: 1px solid rgba(45, 212, 191, 0.3);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.dm-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.dm-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dm-btn-primary {
  background: rgba(45, 212, 191, 0.2);
  border-color: rgba(45, 212, 191, 0.5);
  color: #2DD4BF;
}

.dm-btn-primary:hover {
  background: rgba(45, 212, 191, 0.3);
}

.dm-btn-export {
  background: rgba(45, 212, 191, 0.1);
  border-color: rgba(45, 212, 191, 0.25);
  color: rgba(255, 255, 255, 0.7);
}

.dm-btn-search {
  background: rgba(45, 212, 191, 0.15);
  border-color: rgba(45, 212, 191, 0.3);
  color: #2DD4BF;
}

.dm-btn-reset {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
}

.dm-btn-cancel {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.6);
}

.dm-btn-danger {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #EF4444;
}

/* 表格 */
.dm-table-wrap {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(45, 212, 191, 0.15);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 8px;
}

.dm-table {
  width: 100%;
  border-collapse: collapse;
}

.dm-table thead tr {
  background: rgba(45, 212, 191, 0.08);
}

.dm-table th {
  padding: 10px 12px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  border-bottom: 1px solid rgba(45, 212, 191, 0.1);
}

.dm-table td {
  padding: 9px 12px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.dm-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.04);
}

.col-check { width: 36px; text-align: center; }
.col-actions { width: 120px; }

.device-name-link {
  color: #2DD4BF;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
}
.device-name-link:hover {
  color: #5EEAD4;
}

.type-badge {
  background: rgba(45, 212, 191, 0.15);
  color: #2DD4BF;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
}

.doc-link {
  color: #2DD4BF;
  cursor: pointer;
  font-size: 12px;
}

.doc-link:hover {
  text-decoration: underline;
}

.doc-none {
  color: rgba(255, 255, 255, 0.25);
  font-size: 12px;
}

.empty-row {
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
  padding: 40px !important;
}

.action-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.action-btn-danger:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #EF4444;
}

/* 分页 */
.dm-pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  padding: 6px 0;
}

.dm-pagination select {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  padding: 4px 8px;
}

.page-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.15);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  padding: 4px 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.page-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.page-info {
  color: rgba(255, 255, 255, 0.6);
  padding: 0 4px;
}

/* 对话框 */
.dm-dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dm-dialog {
  background: rgba(15, 45, 75, 0.95);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 12px;
  width: 520px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

.dm-dialog-sm {
  width: 400px;
}

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

.dialog-close:hover {
  color: #fff;
}

.dialog-body {
  padding: 20px;
  max-height: 65vh;
  overflow-y: auto;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid rgba(45, 212, 191, 0.1);
}

/* 表单 */
.form-row {
  margin-bottom: 14px;
}

.form-row label {
  display: block;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  margin-bottom: 6px;
}

.required {
  color: #EF4444;
}

.form-row input,
.form-row select,
.form-row textarea {
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

.form-row input:focus,
.form-row select:focus,
.form-row textarea:focus {
  border-color: rgba(45, 212, 191, 0.5);
}

.form-row textarea {
  resize: vertical;
  min-height: 72px;
}

.form-row select option {
  background: rgba(15, 45, 75, 0.98);
  color: #fff;
}

.file-upload {
  position: relative;
}

.file-upload input[type="file"] {
  width: 100%;
  cursor: pointer;
}

.file-name {
  color: #2DD4BF;
  font-size: 12px;
  margin-top: 4px;
}

.file-hint {
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
  margin-top: 4px;
}
</style>
