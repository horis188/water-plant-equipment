<template>
  <div class="sp-page">
    <TopNavBar />
    <div class="sp-header">
      <div class="sp-title">
        <h2>备件仓库</h2>
        <span class="sp-count">共 {{ filteredSpareparts.length }} 项备件</span>
      </div>
      <div class="sp-actions">
        <button class="dm-btn dm-btn-primary" @click="openAddDialog">+ 新增备件</button>
        <div class="export-dropdown">
          <button class="dm-btn dm-btn-export" @click="toggleExportMenu" :disabled="selectedIds.length === 0">
            📥 导出 ▾
          </button>
          <div v-if="showExportMenu" class="export-menu">
            <div v-if="currentUser.role === '系统管理人'" class="export-item" @click="exportAllSpareparts">📋 一键导出全部备件清单</div>
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
      <input v-model="searchName" type="text" placeholder="备件名称" class="search-input" />
      <select v-model="searchType" class="search-select">
        <option value="">全部类型</option>
        <option v-for="t in sparepartTypes" :key="t" :value="t">{{ t }}</option>
      </select>
      <input v-model="searchVendor" type="text" placeholder="厂商" class="search-input search-input-sm" />
      <input v-model="searchLocation" type="text" placeholder="存放位置" class="search-input search-input-sm" />
      <input v-model="searchSpecs" type="text" placeholder="规格参数" class="search-input search-input-sm" />
      <button class="dm-btn dm-btn-search" @click="doSearch">🔍 搜索</button>
      <button class="dm-btn dm-btn-reset" @click="resetSearch">重置</button>
    </div>

    <!-- Tabs -->
    <div class="dm-tabs">
      <div class="dm-tab" :class="{ active: activeTab === 'list' }" @click="activeTab = 'list'">备件列表</div>
      <div class="dm-tab" :class="{ active: activeTab === 'logs' }" @click="activeTab = 'logs'">出入仓记录</div>
    </div>

    <!-- 备件列表 -->
    <div v-show="activeTab === 'list'" class="dm-table-wrap">
      <table class="dm-table">
        <thead>
          <tr>
            <th class="col-check"><input type="checkbox" @change="toggleSelectAll" :checked="isAllSelected" /></th>
            <th class="sortable" :class="{ active: sortField === 'name' }" @click="toggleSort('name')">
              备件名称 <span class="sort-icon">{{ sortField === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : '△' }}</span>
            </th>
            <th class="sortable" :class="{ active: sortField === 'type' }" @click="toggleSort('type')">
              类型 <span class="sort-icon">{{ sortField === 'type' ? (sortDir === 'asc' ? '▲' : '▼') : '△' }}</span>
            </th>
            <th class="sortable" :class="{ active: sortField === 'quantity' }" @click="toggleSort('quantity')">
              数量 <span class="sort-icon">{{ sortField === 'quantity' ? (sortDir === 'asc' ? '▲' : '▼') : '△' }}</span>
            </th>
            <th class="sortable" :class="{ active: sortField === 'location' }" @click="toggleSort('location')">
              摆放位置 <span class="sort-icon">{{ sortField === 'location' ? (sortDir === 'asc' ? '▲' : '▼') : '△' }}</span>
            </th>
            <th class="sortable" :class="{ active: sortField === 'vendor' }" @click="toggleSort('vendor')">
              厂商 <span class="sort-icon">{{ sortField === 'vendor' ? (sortDir === 'asc' ? '▲' : '▼') : '△' }}</span>
            </th>
            <th>规格</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="sp in paginatedSpareparts" :key="sp.id">
            <td class="col-check"><input type="checkbox" :value="sp.id" v-model="selectedIds" /></td>
            <td>{{ sp.name }}</td>
            <td><span class="type-badge">{{ sp.type }}</span></td>
            <td :class="{ 'low-stock': sp.quantity <= 2 }">{{ sp.quantity }}</td>
            <td>{{ sp.location }}</td>
            <td>{{ sp.vendor }}</td>
            <td class="specs-cell">{{ sp.specs || '-' }}</td>
            <td class="col-actions">
              <button class="action-btn" @click="openEditDialog(sp)">✏️ 编辑</button>
              <button class="action-btn action-btn-success" @click="openInoutDialog(sp, '入仓')">📥 入仓</button>
              <button class="action-btn action-btn-danger" @click="openInoutDialog(sp, '出仓')">📤 出仓</button>
            </td>
          </tr>
          <tr v-if="paginatedSpareparts.length === 0">
            <td colspan="8" class="empty-row">暂无备件数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 出入仓记录 -->
    <div v-show="activeTab === 'logs'" class="dm-table-wrap">
      <table class="dm-table">
        <thead>
          <tr>
            <th>备件名称</th>
            <th>动作</th>
            <th>数量</th>
            <th>操作人</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in paginatedLogs" :key="log.id">
            <td>{{ log.sparepartName }}</td>
            <td><span :class="log.action === '入仓' ? 'status-online' : 'status-warning'">{{ log.action }}</span></td>
            <td>{{ log.quantity }}</td>
            <td>{{ log.operator }}</td>
            <td>{{ log.time }}</td>
          </tr>
          <tr v-if="sparepartLogs.length === 0">
            <td colspan="5" class="empty-row">暂无出入仓记录</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div class="dm-pagination">
      <span>共 {{ activeTab === 'list' ? filteredSpareparts.length : sparepartLogs.length }} 条，每页显示</span>
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

    <!-- 新增/编辑备件弹窗 -->
    <div v-if="dialogVisible" class="dm-dialog-overlay" @click.self="dialogVisible = false">
      <div class="dm-dialog">
        <div class="dialog-header">
          <h3>{{ editingSp ? '编辑备件' : '新增备件' }}</h3>
          <button class="dialog-close" @click="dialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label>备件名称 <span class="required">*</span></label>
            <input v-model="form.name" type="text" placeholder="请输入备件名称" />
          </div>
          <div class="form-row">
            <label>类型 <span class="required">*</span></label>
            <input v-model="form.type" type="text" list="sparepart-types-list" placeholder="选择或输入新类型" @blur="handleTypeBlur" />
            <datalist id="sparepart-types-list">
              <option v-for="t in sparepartTypes" :key="t" :value="t" />
            </datalist>
          </div>
          <div class="form-row-group">
            <div class="form-row">
              <label>数量 <span class="required">*</span></label>
              <input v-model.number="form.quantity" type="number" placeholder="数量" min="0" />
            </div>
            <div class="form-row">
              <label>摆放位置</label>
              <input v-model="form.location" type="text" placeholder="如 A区-03-02" />
            </div>
          </div>
          <div class="form-row">
            <label>厂商</label>
            <input v-model="form.vendor" type="text" placeholder="请输入厂商" />
          </div>
          <div class="form-row">
            <label>规格</label>
            <div class="params-checkboxes">
              <label class="param-check"><input type="checkbox" v-model="specsInput.voltage.checked" />电压</label>
              <input v-if="specsInput.voltage.checked" v-model="specsInput.voltage.value" type="text" placeholder="如 380V" class="param-input" />
              <label class="param-check"><input type="checkbox" v-model="specsInput.current.checked" />电流</label>
              <input v-if="specsInput.current.checked" v-model="specsInput.current.value" type="text" placeholder="如 10A" class="param-input" />
              <label class="param-check"><input type="checkbox" v-model="specsInput.power.checked" />功率</label>
              <input v-if="specsInput.power.checked" v-model="specsInput.power.value" type="text" placeholder="如 15kW" class="param-input" />
              <label class="param-check"><input type="checkbox" v-model="specsInput.pipeDiameter.checked" />管径</label>
              <input v-if="specsInput.pipeDiameter.checked" v-model="specsInput.pipeDiameter.value" type="text" placeholder="如 DN100" class="param-input" />
              <label class="param-check"><input type="checkbox" v-model="specsInput.thread.checked" />螺纹</label>
              <input v-if="specsInput.thread.checked" v-model="specsInput.thread.value" type="text" placeholder="如 G1/2" class="param-input" />
              <label class="param-check"><input type="checkbox" v-model="specsInput.length.checked" />长度</label>
              <input v-if="specsInput.length.checked" v-model="specsInput.length.value" type="text" placeholder="如 3mm" class="param-input" />
            </div>
          </div>
          <div class="form-row">
            <label>其他参数</label>
            <input v-model="specsInput.extra" type="text" placeholder="输入其他参数说明" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="dialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-primary" @click="saveSparepart">{{ editingSp ? '保存' : '新增' }}</button>
        </div>
      </div>
    </div>

    <!-- 出入仓弹窗 -->
    <div v-if="inoutDialogVisible" class="dm-dialog-overlay" @click.self="inoutDialogVisible = false">
      <div class="dm-dialog dm-dialog-sm">
        <div class="dialog-header">
          <h3>{{ inoutAction === '入仓' ? '📥 入仓' : '📤 出仓' }}</h3>
          <button class="dialog-close" @click="inoutDialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label>备件名称</label>
            <input :value="inoutTarget?.name" type="text" disabled />
          </div>
          <div class="form-row">
            <label>当前库存</label>
            <input :value="inoutTarget?.quantity" type="text" disabled />
          </div>
          <div class="form-row">
            <label>数量 <span class="required">*</span></label>
            <input v-model.number="inoutQuantity" type="number" min="1" placeholder="请输入数量" />
          </div>
          <div v-if="inoutError" class="form-error">{{ inoutError }}</div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn dm-btn-cancel" @click="inoutDialogVisible = false">取消</button>
          <button class="dm-btn dm-btn-primary" @click="confirmInout">确认{{ inoutAction }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import TopNavBar from '../components/TopNavBar.vue'
import { spareparts, sparepartLogs, sparepartTypes, addSparepart, updateSparepart, addSparepartType, inoutSparepart, Sparepart } from '../composables/useSparepartStore'
import { currentUser } from '../composables/useDeviceStore'

// ============ 搜索 ============
const searchName = ref('')
const searchType = ref('')
const searchVendor = ref('')
const searchLocation = ref('')
const searchSpecs = ref('')
const activeSearchName = ref('')
const activeSearchType = ref('')
const activeSearchVendor = ref('')
const activeSearchLocation = ref('')
const activeSearchSpecs = ref('')

function doSearch() {
  activeSearchName.value = searchName.value
  activeSearchType.value = searchType.value
  activeSearchVendor.value = searchVendor.value
  activeSearchLocation.value = searchLocation.value
  activeSearchSpecs.value = searchSpecs.value
  currentPage.value = 1
}

function resetSearch() {
  searchName.value = ''
  searchType.value = ''
  searchVendor.value = ''
  searchLocation.value = ''
  searchSpecs.value = ''
  activeSearchName.value = ''
  activeSearchType.value = ''
  activeSearchVendor.value = ''
  activeSearchLocation.value = ''
  activeSearchSpecs.value = ''
  currentPage.value = 1
}

// ============ Tab ============
const activeTab = ref('list')

// ============ 排序 ============
const sortField = ref<string | null>('name')
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

// ============ 分页 ============
const currentPage = ref(1)
const pageSize = ref(10)

// ============ 选中 ============
const selectedIds = ref<string[]>([])

const isAllSelected = computed(() => {
  return paginatedSpareparts.value.length > 0 && paginatedSpareparts.value.every(sp => selectedIds.value.includes(sp.id))
})

function toggleSelectAll(e: any) {
  if (e.target.checked) {
    selectedIds.value = paginatedSpareparts.value.map(sp => sp.id)
  } else {
    selectedIds.value = []
  }
}

// ============ 过滤+排序 ============
const filteredSpareparts = computed(() => {
  let list = spareparts.value.filter(sp => {
    const matchName = !activeSearchName.value || sp.name.includes(activeSearchName.value)
    const matchType = !activeSearchType.value || sp.type === activeSearchType.value
    const matchVendor = !activeSearchVendor.value || sp.vendor.includes(activeSearchVendor.value)
    const matchLocation = !activeSearchLocation.value || sp.location.includes(activeSearchLocation.value)
    const matchSpecs = !activeSearchSpecs.value || (sp.specs && sp.specs.includes(activeSearchSpecs.value))
    return matchName && matchType && matchVendor && matchLocation && matchSpecs
  })
  if (sortField.value) {
    const field = sortField.value as keyof Sparepart
    const dir = sortDir.value === 'asc' ? 1 : -1
    list = [...list].sort((a, b) => {
      const va = String(a[field] ?? '')
      const vb = String(b[field] ?? '')
      return va.localeCompare(vb, 'zh-CN') * dir
    })
  }
  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil((activeTab.value === 'list' ? filteredSpareparts.value.length : sparepartLogs.value.length) / pageSize.value)))

const paginatedSpareparts = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredSpareparts.value.slice(start, start + pageSize.value)
})

const paginatedLogs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return sparepartLogs.value.slice(start, start + pageSize.value)
})

// ============ 新增/编辑弹窗 ============
const dialogVisible = ref(false)
const editingSp = ref<Sparepart | null>(null)

const defaultSpecs = () => ({
  voltage: { checked: false, value: '' },
  current: { checked: false, value: '' },
  power: { checked: false, value: '' },
  pipeDiameter: { checked: false, value: '' },
  thread: { checked: false, value: '' },
  length: { checked: false, value: '' },
  extra: ''
})

const form = ref({ name: '', type: '', quantity: null as number | null, location: '', vendor: '' })
const specsInput = ref(defaultSpecs())

function openAddDialog() {
  editingSp.value = null
  form.value = { name: '', type: '', quantity: null, location: '', vendor: '' }
  specsInput.value = defaultSpecs()
  dialogVisible.value = true
}

function openEditDialog(sp: Sparepart) {
  editingSp.value = sp
  form.value = { name: sp.name, type: sp.type, quantity: sp.quantity, location: sp.location, vendor: sp.vendor }
  // 解析 specs
  const si = defaultSpecs()
  const parts: Record<string, string> = {}
  ;(sp.specs || '').split(',').forEach(p => {
    const colonIdx = p.indexOf(':')
    if (colonIdx > 0) {
      parts[p.substring(0, colonIdx).trim()] = p.substring(colonIdx + 1).trim()
    }
  })
  si.voltage = { checked: !!parts['电压'], value: parts['电压'] || '' }
  si.current = { checked: !!parts['电流'], value: parts['电流'] || '' }
  si.power = { checked: !!parts['功率'], value: parts['功率'] || '' }
  si.pipeDiameter = { checked: !!parts['管径'], value: parts['管径'] || '' }
  si.thread = { checked: !!parts['螺纹'], value: parts['螺纹'] || '' }
  si.length = { checked: !!parts['长度'], value: parts['长度'] || '' }
  si.extra = parts['其他'] || ''
  specsInput.value = si
  dialogVisible.value = true
}

function handleTypeBlur() {
  if (form.value.type) addSparepartType(form.value.type)
}

function buildSpecs(): string {
  const parts: string[] = []
  if (specsInput.value.voltage.checked && specsInput.value.voltage.value) parts.push('电压:' + specsInput.value.voltage.value)
  if (specsInput.value.current.checked && specsInput.value.current.value) parts.push('电流:' + specsInput.value.current.value)
  if (specsInput.value.power.checked && specsInput.value.power.value) parts.push('功率:' + specsInput.value.power.value)
  if (specsInput.value.pipeDiameter.checked && specsInput.value.pipeDiameter.value) parts.push('管径:' + specsInput.value.pipeDiameter.value)
  if (specsInput.value.thread.checked && specsInput.value.thread.value) parts.push('螺纹:' + specsInput.value.thread.value)
  if (specsInput.value.length.checked && specsInput.value.length.value) parts.push('长度:' + specsInput.value.length.value)
  if (specsInput.value.extra) parts.push('其他:' + specsInput.value.extra)
  return parts.join(',')
}

function saveSparepart() {
  if (!form.value.name || !form.value.type) {
    alert('请填写必填项')
    return
  }
  const record = {
    name: form.value.name,
    type: form.value.type,
    quantity: form.value.quantity ?? 0,
    location: form.value.location,
    vendor: form.value.vendor,
    specs: buildSpecs()
  }
  if (editingSp.value) {
    updateSparepart(editingSp.value.id, record)
  } else {
    addSparepart(record)
  }
  dialogVisible.value = false
}

// ============ 出入仓弹窗 ============
const inoutDialogVisible = ref(false)
const inoutTarget = ref<Sparepart | null>(null)
const inoutAction = ref<'出仓' | '入仓'>('入仓')
const inoutQuantity = ref<number | null>(null)
const inoutError = ref('')

function openInoutDialog(sp: Sparepart, action: '出仓' | '入仓') {
  inoutTarget.value = sp
  inoutAction.value = action
  inoutQuantity.value = null
  inoutError.value = ''
  inoutDialogVisible.value = true
}

function confirmInout() {
  if (!inoutQuantity.value || inoutQuantity.value <= 0) {
    inoutError.value = '请输入有效数量'
    return
  }
  if (!inoutTarget.value) return
  const result = inoutSparepart(inoutTarget.value.id, inoutAction.value, inoutQuantity.value)
  if (!result.success) {
    inoutError.value = result.error || '操作失败'
    return
  }
  inoutDialogVisible.value = false
}

// ============ 导出 ============
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

function doExport(format: string) {
  showExportMenu.value = false
  const sps = spareparts.value.filter(s => selectedIds.value.includes(s.id))
  if (sps.length === 0) return
  if (format === 'txt') exportTxt(sps)
  else if (format === 'csv') exportCsv(sps)
  else if (format === 'doc') exportDoc(sps)
  else if (format === 'print') exportPrint(sps)
}

function exportTxt(sps: any[]) {
  const content = sps.map(s => `备件名称: ${s.name}
类型: ${s.type}
数量: ${s.quantity}
摆放位置: ${s.location}
厂商: ${s.vendor}
规格: ${s.specs || '无'}`).join('\n\n==========\n\n')
  downloadBlob(content, `备件清单_${formatDate()}.txt`, 'text/plain')
}

function exportCsv(sps: any[]) {
  const header = ['备件编号', '名称', '类型', '数量', '摆放位置', '厂商', '规格']
  const rows = sps.map(s => [s.id, s.name, s.type, s.quantity, s.location, s.vendor, s.specs || ''])
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  downloadBlob(csv, `备件清单_${formatDate()}.csv`, 'text/csv')
}

function exportDoc(sps: any[]) {
  const rows = sps.map(s => `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.type}</td><td>${s.quantity}</td><td>${s.location}</td><td>${s.vendor}</td><td>${s.specs || ''}</td></tr>`).join('')
  const html = `<html><head><meta charset='utf-8'></head><body><h1>备件清单导出</h1><table border='1' cellpadding='8' style='border-collapse:collapse;width:100%'><thead><tr><th>编号</th><th>名称</th><th>类型</th><th>数量</th><th>位置</th><th>厂商</th><th>规格</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
  downloadBlob(html, `备件清单_${formatDate()}.doc`, 'application/msword')
}

function exportPrint(sps: any[]) {
  const rows = sps.map(s => `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.type}</td><td>${s.quantity}</td><td>${s.location}</td><td>${s.vendor}</td></tr>`).join('')
  const html = `<html><head><meta charset='utf-8'><style>body{font-family:SimSun;font-size:12px;margin:20px}h1{text-align:center}table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:6px;text-align:left}</style></head><body><h1>备件清单导出</h1><table><thead><tr><th>编号</th><th>名称</th><th>类型</th><th>数量</th><th>位置</th><th>厂商</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close(); win.print() }
}

function exportAllSpareparts() {
  showExportMenu.value = false
  const all = spareparts.value
  if (all.length === 0) return
  const header = ['备件编号', '名称', '类型', '数量', '摆放位置', '厂商', '规格']
  const rows = all.map(s => [s.id, s.name, s.type, s.quantity, s.location, s.vendor, s.specs || ''])
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  downloadBlob(csv, `全部备件清单_${formatDate()}.csv`, 'text/csv')
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
.sp-page {
  min-height: 100vh;
  background: #0f2d4a;
  padding: 0 0 20px;
}

.sp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px 16px;
}

.sp-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.sp-title h2 {
  color: #fff;
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  letter-spacing: 1px;
}

.sp-count {
  color: rgba(255,255,255,0.5);
  font-size: 13px;
  background: rgba(255,255,255,0.06);
  padding: 2px 10px;
  border-radius: 10px;
}

.sp-actions {
  display: flex;
  gap: 10px;
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
  transition: all 0.2s;
}

.dm-btn-primary {
  background: rgba(45, 212, 191, 0.15);
  border-color: rgba(45, 212, 191, 0.4);
  color: #2DD4BF;
}

.dm-btn-primary:hover { background: rgba(45, 212, 191, 0.25); }

.dm-btn-export {
  background: rgba(45, 212, 191, 0.1);
  border-color: rgba(45, 212, 191, 0.25);
  color: rgba(255, 255, 255, 0.7);
}

.dm-btn-export:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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

/* 搜索栏 */
.dm-search {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(45, 212, 191, 0.1);
  border-radius: 8px;
  padding: 16px 20px;
  margin: 0 32px 16px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.search-input, .search-select {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  padding: 7px 12px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  outline: none;
}

.search-input { width: 140px; }
.search-input-sm { width: 100px; }

.search-input::placeholder, .search-select::placeholder { color: rgba(255, 255, 255, 0.55); }
.search-input:focus, .search-select:focus { border-color: rgba(45, 212, 191, 0.5); }

.search-select option { color: #1a1a1a; background: #c8eef5; }

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

.dm-tab:hover { background: rgba(45, 212, 191, 0.1); color: rgba(255,255,255,0.9); }

.dm-tab.active {
  background: rgba(45, 212, 191, 0.15);
  color: #2DD4BF;
  border-color: rgba(45, 212, 191, 0.4);
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
}

.dm-table th {
  padding: 12px 14px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 15px;
  font-weight: 500;
  text-align: left;
  border-bottom: 1px solid rgba(45, 212, 191, 0.1);
  white-space: nowrap;
}

.dm-table th.sortable { cursor: pointer; user-select: none; }
.dm-table th.sortable:hover { color: rgba(255,255,255,0.9); }
.dm-table th.sortable.active { color: #2DD4BF; }

.sort-icon { font-size: 12px; margin-left: 4px; opacity: 0.6; }
.dm-table th.sortable.active .sort-icon { opacity: 1; }

.dm-table td {
  padding: 11px 14px;
  color: rgba(255,255,255,0.8);
  font-size: 15px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.dm-table tbody tr:hover { background: rgba(45, 212, 191, 0.04); }

.col-check { width: 32px; }
.col-actions { white-space: nowrap; }

.type-badge {
  background: rgba(45, 212, 191, 0.15);
  color: #2DD4BF;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.low-stock { color: #FCA5A5; font-weight: 600; }

.specs-cell {
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-btn {
  background: none;
  border: 1px solid rgba(45, 212, 191, 0.25);
  color: rgba(255,255,255,0.65);
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-right: 4px;
  transition: all 0.15s;
}

.action-btn:hover { background: rgba(45, 212, 191, 0.1); color: #2DD4BF; }

.action-btn-success {
  border-color: rgba(45, 212, 191, 0.4);
  color: #2DD4BF;
}

.action-btn-danger {
  border-color: rgba(239, 68, 68, 0.3);
  color: #FCA5A5;
}

.action-btn-danger:hover { background: rgba(239, 68, 68, 0.1); }

.empty-row {
  text-align: center;
  color: rgba(255,255,255,0.3);
  padding: 30px;
}

/* 分页 */
.dm-pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  color: rgba(255,255,255,0.5);
  font-size: 12px;
  padding: 8px 0;
}

.dm-pagination select {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 4px;
  color: rgba(255,255,255,0.85);
  padding: 4px 8px;
}

.dm-pagination select option { color: #1a1a1a; background: #c8eef5; }

.page-btn {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(45, 212, 191, 0.15);
  border-radius: 4px;
  color: rgba(255,255,255,0.7);
  padding: 4px 10px;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
.page-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.page-info { color: rgba(255,255,255,0.6); padding: 0 4px; }

/* 弹窗 */
.dm-dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dm-dialog {
  background: #1a3a5c;
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 12px;
  width: 480px;
  max-height: 85vh;
  overflow-y: auto;
}

.dm-dialog-sm { width: 360px; }

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(45, 212, 191, 0.1);
}

.dialog-header h3 { color: #fff; font-size: 16px; margin: 0; }

.dialog-close {
  background: none;
  border: none;
  color: rgba(255,255,255,0.5);
  font-size: 22px;
  cursor: pointer;
  line-height: 1;
}

.dialog-close:hover { color: #fff; }

.dialog-body { padding: 16px 20px; }

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid rgba(45, 212, 191, 0.1);
}

/* 表单 */
.form-row {
  margin-bottom: 14px;
}

.form-row label {
  display: block;
  color: rgba(255,255,255,0.7);
  font-size: 13px;
  margin-bottom: 5px;
}

.form-row input, .form-row select, .form-row textarea {
  width: 100%;
  background: rgba(0,0,0,0.25);
  border: 1px solid rgba(45, 212, 191, 0.25);
  border-radius: 6px;
  padding: 8px 12px;
  color: #fff;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}

.form-row input:focus, .form-row select:focus {
  border-color: rgba(45, 212, 191, 0.5);
}

.form-row input::placeholder { color: rgba(255,255,255,0.4); }

.form-row input:disabled {
  background: rgba(0,0,0,0.2);
  color: rgba(255,255,255,0.5);
  cursor: not-allowed;
}

.required { color: #FCA5A5; }

.form-row-group {
  display: flex;
  gap: 12px;
}

.form-row-group .form-row { flex: 1; margin-bottom: 0; }

.form-error {
  color: #FCA5A5;
  font-size: 12px;
  margin-top: 6px;
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
  color: rgba(255,255,255,0.85);
  cursor: pointer;
  white-space: nowrap;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.15s;
}

.param-check:hover {
  background: rgba(255,255,255,0.05);
}

.param-check input[type="checkbox"] { 
  cursor: pointer; 
  accent-color: #2DD4BF;
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.param-input {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 4px;
  color: rgba(255,255,255,0.85);
  padding: 6px 10px;
  font-size: 20px;
  width: 120px;
}

/* 导出下拉 */
.export-dropdown { position: relative; }

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
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.export-item {
  padding: 9px 14px;
  cursor: pointer;
  font-size: 13px;
  color: rgba(255,255,255,0.8);
  transition: background 0.15s;
}

.export-item:hover { background: rgba(45, 212, 191, 0.15); color: #2DD4BF; }

/* 状态标签 */
.status-online { color: #2DD4BF; font-weight: 600; }
.status-warning { color: #FCA5A5; font-weight: 600; }
</style>
