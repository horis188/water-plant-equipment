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
        <div class="export-dropdown">
          <button class="dm-btn dm-btn-export" @click="toggleExportMenu" :disabled="selectedIds.length === 0">
            📥 批量导出 ({{ selectedIds.length }}) ▾
          </button>
          <div v-if="showExportMenu" class="export-menu">
            <div class="export-item" @click="doExport('txt')">📄 Text 文本</div>
            <div class="export-item" @click="doExport('csv')">📊 Excel (CSV)</div>
            <div class="export-item" @click="doExport('doc')">📝 Word (DOC)</div>
            <div class="export-item" @click="doExport('print')">🖨️ 打印</div>
          </div>
        </div>
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
      <select v-model="searchStatus" class="search-select">
        <option value="">全部状态</option>
        <option value="在用">在用</option>
        <option value="告警">告警</option>
        <option value="维修中">维修中</option>
      </select>
      <button class="dm-btn dm-btn-search" @click="doSearch">🔍 搜索</button>
      <button class="dm-btn dm-btn-reset" @click="resetSearch">重置</button>
    </div>

    <!-- Tabs -->
    <div class="dm-tabs">
      <div class="dm-tab" :class="{ active: activeTab === 'list' }" @click="activeTab = 'list'">设备列表</div>
      <div class="dm-tab" :class="{ active: activeTab === 'changes' }" @click="activeTab = 'changes'">设备变动</div>
    </div>

    <!-- 设备列表 -->
    <div v-show="activeTab === 'list'" class="dm-table-wrap">
      <table class="dm-table">
        <thead>
          <tr>
            <th class="col-check"><input type="checkbox" @change="toggleSelectAll" :checked="isAllSelected" /></th>
            <th class="sortable" :class="{ active: sortField === 'name' }" @click="toggleSort('name')">设备名称 <span class="sort-icon">{{ sortField === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : '△' }}</span></th>
            <th class="sortable" :class="{ active: sortField === 'type' }" @click="toggleSort('type')">类型 <span class="sort-icon">{{ sortField === 'type' ? (sortDir === 'asc' ? '▲' : '▼') : '△' }}</span></th>
            <th class="sortable" :class="{ active: sortField === 'model' }" @click="toggleSort('model')">型号 <span class="sort-icon">{{ sortField === 'model' ? (sortDir === 'asc' ? '▲' : '▼') : '△' }}</span></th>
            <th class="sortable" :class="{ active: sortField === 'location' }" @click="toggleSort('location')">安装地点 <span class="sort-icon">{{ sortField === 'location' ? (sortDir === 'asc' ? '▲' : '▼') : '△' }}</span></th>
            <th>参数</th>
            <th class="sortable" :class="{ active: sortField === 'status' }" @click="toggleSort('status')">状态 <span class="sort-icon">{{ sortField === 'status' ? (sortDir === 'asc' ? '▲' : '▼') : '△' }}</span></th>
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
            <td>{{ device.params || '-' }}</td>
            <td><span class="status-badge" :class="`status-${device.status}`">{{ device.status }}</span></td>
            <td class="col-actions">
              <button class="action-btn" @click="openEditDialog(device)">✏️ 编辑</button>
              <button class="action-btn action-btn-danger" @click="confirmDelete(device)">🗑️ 删除</button>
            </td>
          </tr>
          <tr v-if="paginatedDevices.length === 0">
            <td colspan="7" class="empty-row">暂无设备数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 设备变动列表 -->
    <div v-show="activeTab === 'changes'" class="dm-table-wrap">
      <table class="dm-table">
        <thead>
          <tr>
            <th>设备名称</th>
            <th>变动时间</th>
            <th>操作人</th>
            <th>变动内容</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="change in deviceChangeLog" :key="change.id">
            <tr class="change-main-row">
              <td><span class="device-name-link" @click.stop="toggleChangeDetail(change.id)">{{ change.name }}</span></td>
              <td>{{ change.changeTime }}</td>
              <td>{{ change.operator }}</td>
              <td class="change-detail-cell">
                <div class="change-summary">{{ change.changes.length }} 项变动</div>
                <div class="change-details" :class="{ active: expandedChangeId === change.id }">
                  <div v-for="(c, idx) in change.changes" :key="idx" class="change-item-row">
                    <span class="change-field">{{ c.fieldLabel }}</span>
                    <span class="change-old">{{ c.oldValue }}</span>
                    <span class="change-arrow">→</span>
                    <span class="change-new">{{ c.newValue }}</span>
                  </div>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="deviceChangeLog.length === 0">
            <td colspan="4" class="empty-row">暂无设备变动记录</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div v-show="activeTab === 'list'" class="dm-pagination">
      <span>共 {{ filteredDevices.length }} 条，每页显示</span>
      <select v-model="pageSize" @change="currentPage = 1">
        <option value="10">10</option>
        <option value="15">15</option>
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
            <label>参数</label>
            <div class="params-checkboxes">
              <label class="param-check"><input type="checkbox" v-model="paramsInput.voltage.checked" />电压</label>
              <input v-if="paramsInput.voltage.checked" v-model="paramsInput.voltage.value" type="text" placeholder="如 380V" class="param-input" />
              <label class="param-check"><input type="checkbox" v-model="paramsInput.current.checked" />电流</label>
              <input v-if="paramsInput.current.checked" v-model="paramsInput.current.value" type="text" placeholder="如 30A" class="param-input" />
              <label class="param-check"><input type="checkbox" v-model="paramsInput.power.checked" />功率</label>
              <input v-if="paramsInput.power.checked" v-model="paramsInput.power.value" type="text" placeholder="如 15kW" class="param-input" />
              <label class="param-check"><input type="checkbox" v-model="paramsInput.pipeDiameter.checked" />管径</label>
              <input v-if="paramsInput.pipeDiameter.checked" v-model="paramsInput.pipeDiameter.value" type="text" placeholder="如 DN100" class="param-input" />
            </div>
          </div>
          <div class="form-row">
            <label>其他参数</label>
            <input v-model="paramsInput.extra" type="text" placeholder="输入其他参数说明" />
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
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TopNavBar from '../components/TopNavBar.vue'
import { deviceListWithStatus, addDevice, updateDevice, deleteDevice, currentUser, deviceChangeLog } from '../composables/useDeviceStore'

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
const searchStatus = ref('')

// 搜索条件（点击搜索后才生效）
const activeSearchName = ref('')
const activeSearchType = ref('')
const activeSearchModel = ref('')
const activeSearchLocation = ref('')
const activeSearchStatus = ref('')

// 对话框
const dialogVisible = ref(false)
const deleteDialogVisible = ref(false)
const editingDevice = ref<any>(null)
const deletingDevice = ref<any>(null)
const fileInput = ref<any>(null)

// 表单（不含status，由store计算）
const form = ref({
  name: '', type: '', model: '', vendor: '', location: '', value: null as number | null, remark: '', doc: null as string | null, params: ''
})

// 参数勾选输入
const paramsInput = ref({
  voltage: { checked: false, value: '' },
  current: { checked: false, value: '' },
  power: { checked: false, value: '' },
  pipeDiameter: { checked: false, value: '' },
  extra: ''
})

// 分页
const currentPage = ref(1)
const pageSize = ref(10)

// 选中
const selectedIds = ref<string[]>([])
const sortField = ref('name')
const sortDir = ref('asc')
function toggleSort(field: string) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = 'asc'
  }
  currentPage.value = 1
}
const showExportMenu = ref(false)
function toggleExportMenu() { showExportMenu.value = !showExportMenu.value }

// 点击空白处关闭导出下拉框
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.export-dropdown')) {
    showExportMenu.value = false
  }
}
watch(showExportMenu, (val) => {
  if (val) {
    setTimeout(() => document.addEventListener('click', handleClickOutside), 0)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})

// Tab状态
const activeTab = ref(route.path === '/device/changes' ? 'changes' : 'list')
// 监听路由参数变化
watch(() => route.query.status, (newStatus) => {
  const s = (newStatus as string) || ''
  activeSearchStatus.value = s
  searchStatus.value = s
}, { immediate: true })

const sortOrder = ref<string[]>([])
watch(() => route.query.sort, (newSort) => {
  sortOrder.value = (newSort as string || '').split(',').filter(Boolean)
  currentPage.value = 1
}, { immediate: true })

const expandedChangeId = ref<string | null>(null)

function toggleChangeDetail(id: string) {
  expandedChangeId.value = expandedChangeId.value === id ? null : id
}



// 过滤后设备
const filteredDevices = computed(() => {
  const list = allDevices.value.filter(d => {
    const matchName = !activeSearchName.value || d.name.includes(activeSearchName.value)
    const matchType = !activeSearchType.value || d.type === activeSearchType.value
    const matchModel = !activeSearchModel.value || d.model.includes(activeSearchModel.value)
    const matchLocation = !activeSearchLocation.value || d.location.includes(activeSearchLocation.value)
    const matchStatus = !activeSearchStatus.value || d.status === activeSearchStatus.value
    return matchName && matchType && matchModel && matchLocation && matchStatus
  })
  // URL优先级排序
  let result = [...list]
  if (sortOrder.value.length > 0) {
    const orderMap: Record<string, number> = {}
    sortOrder.value.forEach((v, i) => { orderMap[v] = i })
    result = result.sort((a, b) => (orderMap[a.status] ?? 99) - (orderMap[b.status] ?? 99))
  }
  // 列排序（无URL排序时才生效，避免优先级被覆盖）
  if (sortOrder.value.length === 0 && sortField.value) {
    const field = sortField.value as keyof typeof allDevices.value[0]
    const dir = sortDir.value === 'asc' ? 1 : -1
    result.sort((a, b) => {
      const va = String(a[field] ?? '')
      const vb = String(b[field] ?? '')
      return va.localeCompare(vb, 'zh-CN') * dir
    })
  }
  return result
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
  activeSearchName.value = searchName.value
  activeSearchType.value = searchType.value
  activeSearchModel.value = searchModel.value
  activeSearchLocation.value = searchLocation.value
  activeSearchStatus.value = searchStatus.value
  currentPage.value = 1
}

function resetSearch() {
  searchName.value = ''
  searchType.value = ''
  searchModel.value = ''
  searchLocation.value = ''
  activeSearchName.value = ''
  activeSearchType.value = ''
  activeSearchModel.value = ''
  activeSearchLocation.value = ''
  activeSearchStatus.value = ''
  currentPage.value = 1
}

// 新增
function openAddDialog() {
  editingDevice.value = null
  form.value = { name: '', type: '', model: '', vendor: '', location: '', value: null, remark: '', doc: null, params: '' }
  paramsInput.value = { voltage: { checked: false, value: '' }, current: { checked: false, value: '' }, power: { checked: false, value: '' }, pipeDiameter: { checked: false, value: '' }, extra: '' }
  dialogVisible.value = true
}

// 编辑
function openEditDialog(device: any) {
  editingDevice.value = device
  form.value = { ...device, params: device.params || '' }
  const saved = (device.params || '') as string
  const pi = { voltage: { checked: false, value: '' }, current: { checked: false, value: '' }, power: { checked: false, value: '' }, pipeDiameter: { checked: false, value: '' }, extra: '' }
  saved.split(',').forEach(p => {
    const colonIdx = p.indexOf(':')
    if (colonIdx > 0) {
      const k = p.substring(0, colonIdx).trim()
      const v = p.substring(colonIdx + 1).trim()
      if (k === '电压') { pi.voltage.checked = true; pi.voltage.value = v }
      else if (k === '电流') { pi.current.checked = true; pi.current.value = v }
      else if (k === '功率') { pi.power.checked = true; pi.power.value = v }
      else if (k === '管径') { pi.pipeDiameter.checked = true; pi.pipeDiameter.value = v }
      else if (k === '其他') { pi.extra = v }
    }
  })
  paramsInput.value = pi
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
    params: (() => {
      const parts: string[] = []
      if (paramsInput.value.voltage.checked && paramsInput.value.voltage.value) parts.push('电压:' + paramsInput.value.voltage.value)
      if (paramsInput.value.current.checked && paramsInput.value.current.value) parts.push('电流:' + paramsInput.value.current.value)
      if (paramsInput.value.power.checked && paramsInput.value.power.value) parts.push('功率:' + paramsInput.value.power.value)
      if (paramsInput.value.pipeDiameter.checked && paramsInput.value.pipeDiameter.value) parts.push('管径:' + paramsInput.value.pipeDiameter.value)
      if (paramsInput.value.extra) parts.push('其他:' + paramsInput.value.extra)
      return parts.join(',')
    })()
  }
  if (editingDevice.value) {
    updateDevice(editingDevice.value.id, record, currentUser.value.name)
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

// 批量导出
function doExport(format: string) {
  showExportMenu.value = false
  const devs = allDevices.value.filter(d => selectedIds.value.includes(d.id))
  if (devs.length === 0) return
  if (format === 'txt') exportTxt(devs)
  else if (format === 'csv') exportCsv(devs)
  else if (format === 'doc') exportDoc(devs)
  else if (format === 'print') exportPrint(devs)
}

function exportTxt(devs: any[]) {
  const content = devs.map(d => `设备名称: ${d.name}
设备类型: ${d.type}
型号: ${d.model}
厂家: ${d.vendor}
安装地点: ${d.location}
价值金额: ${d.value?.toLocaleString() ?? '-'} 元
状态: ${d.status}
备注: ${d.remark || '无'}
技术文档: ${d.doc || '无'}
参数: ${d.params || '无'}`).join('\n\n==========\n\n')
  downloadBlob(content, `设备资料_${formatDate()}.txt`, 'text/plain')
}

function exportCsv(devs: any[]) {
  const header = ['设备编号','设备名称','类型','型号','厂家','安装地点','价值(元)','状态','备注','参数']
  const rows = devs.map(d => [d.id, d.name, d.type, d.model, d.vendor, d.location, d.value, d.status, d.remark || '', d.params || ''])
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  downloadBlob(csv, `设备资料_${formatDate()}.csv`, 'text/csv')
}

function exportDoc(devs: any[]) {
  const rows = devs.map(d => `<tr><td>${d.id}</td><td>${d.name}</td><td>${d.type}</td><td>${d.model}</td><td>${d.vendor}</td><td>${d.location}</td><td>${d.value?.toLocaleString() ?? '-'}</td><td>${d.status}</td><td>${d.remark || ''}</td><td>${d.params || ''}</td></tr>`).join('')
  const html = `<html><head><meta charset='utf-8'></head><body><h1>设备资料导出</h1><table border='1' cellpadding='8' style='border-collapse:collapse;width:100%'><thead><tr><th>编号</th><th>名称</th><th>类型</th><th>型号</th><th>厂家</th><th>地点</th><th>价值</th><th>状态</th><th>备注</th><th>参数</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
  downloadBlob(html, `设备资料_${formatDate()}.doc`, 'application/msword')
}

function exportPrint(devs: any[]) {
  const rows = devs.map(d => `<tr><td>${d.id}</td><td>${d.name}</td><td>${d.type}</td><td>${d.model}</td><td>${d.vendor}</td><td>${d.location}</td><td>${d.value}</td><td>${d.status}</td></tr>`).join('')
  const html = `<html><head><meta charset='utf-8'><style>body{font-family:SimSun;font-size:12px;margin:20px}h1{text-align:center}table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:6px;text-align:left}</style></head><body><h1>设备资料导出</h1><table><thead><tr><th>编号</th><th>名称</th><th>类型</th><th>型号</th><th>厂家</th><th>地点</th><th>价值</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close(); win.print() }
}

function formatDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' })
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
  padding: 0 0 20px;
}

.device-manage {
  padding: 24px 32px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  letter-spacing: 1px;
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
  padding: 16px 20px;
  margin-bottom: 16px;
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
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(45, 212, 191, 0.3);
}

.search-input-sm {
  width: 100px;
}

.search-select {
  min-width: 110px;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(45, 212, 191, 0.3);
}

.search-select option {
  color: #1a1a1a;
  background: #c8eef5;
}

.search-input::placeholder, .search-select::placeholder {
  color: rgba(255, 255, 255, 0.55);
}

.search-input:focus, .search-select:focus {
  border-color: rgba(45, 212, 191, 0.5);
}

/* Tabs */
.dm-tabs {
  display: flex;
  gap: 4px;
  padding: 0 32px 16px;
}

.dm-tab {
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s;
}

.dm-tab:hover {
  background: rgba(45, 212, 191, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.dm-tab.active {
  background: rgba(45, 212, 191, 0.15);
  color: #2DD4BF;
  border-color: rgba(45, 212, 191, 0.4);
}

/* 参数勾选 */
.params-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.param-check {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 27px;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  white-space: nowrap;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.15s;
}

.param-check:hover {
  background: rgba(255, 255, 255, 0.05);
}

.param-check input[type="checkbox"] {
  cursor: pointer;
  accent-color: #2DD4BF;
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.param-input {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.85);
  padding: 6px 10px;
  font-size: 17px;
  width: 120px;
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

.export-dropdown {
  position: relative;
}

.export-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: #1a3a5c;
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  overflow: hidden;
  z-index: 100;
  min-width: 150px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.export-item {
  padding: 9px 14px;
  cursor: pointer;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  transition: background 0.15s;
}

.export-item:hover {
  background: rgba(45, 212, 191, 0.15);
  color: #2DD4BF;
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
  margin: 0 32px 16px;
}

.dm-table {
  width: 100%;
  border-collapse: collapse;
}

.dm-table thead tr {
  background: rgba(45, 212, 191, 0.08);
  line-height: 1.2;
}

.dm-table th {
  padding: 12px 14px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 15px;
  font-weight: 500;
  text-align: left;
  border-bottom: 1px solid rgba(45, 212, 191, 0.1);
}

.dm-table th.sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.dm-table th.sortable:hover {
  color: rgba(255, 255, 255, 0.9);
}

.dm-table th.sortable.active {
  color: #2DD4BF;
}

.sort-icon {
  font-size: 12px;
  margin-left: 4px;
  opacity: 0.6;
}

.dm-table th.sortable.active .sort-icon {
  opacity: 1;
}

.dm-table td {
  padding: 5px 14px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 15px;
  line-height: 1.2;
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

.status-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
}
.status-在用 { background: rgba(45, 212, 191, 0.15); color: #2DD4BF; }
.status-告警 { background: rgba(239, 68, 68, 0.15); color: #EF4444; }
.status-维修中 { background: rgba(59, 130, 246, 0.15); color: #60A5FA; }

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
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.85);
  padding: 4px 8px;
}

.dm-pagination select option {
  color: #1a1a1a;
  background: #c8eef5;
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

/* 设备变动 */
.change-detail-cell {
  text-align: left;
}

.change-summary {
  color: #2DD4BF;
  font-size: 12px;
  cursor: pointer;
}

.change-details {
  display: none;
  margin-top: 6px;
  padding: 6px 8px;
  background: rgba(45, 212, 191, 0.08);
  border-radius: 6px;
  border: 1px solid rgba(45, 212, 191, 0.15);
}

.change-details {
  display: none;
}

.change-details.active {
  display: block;
}

.change-item-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 3px 0;
  color: rgba(255, 255, 255, 0.75);
}

.change-field {
  color: #93C5FD;
  min-width: 70px;
}

.change-old {
  color: #FCA5A5;
  text-decoration: line-through;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.change-arrow {
  color: rgba(255, 255, 255, 0.4);
}

.change-new {
  color: #86EFAC;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.form-row-group {
  display: flex;
  gap: 12px;
}

.form-row-group .form-row {
  flex: 1;
  margin-bottom: 0;
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
