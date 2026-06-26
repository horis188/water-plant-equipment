<template>
  <div class="sp-page">
    <TopNavBar />

    <!-- P1: 备件低库存告警 (P2.3) -->
    <div v-if="lowStockItems.length" class="low-stock-banner" :class="{ pulse: lowStockItems.length > 0 }">
      <span class="low-stock-icon">⚠️</span>
      <span class="low-stock-text">
        <strong>{{ lowStockItems.length }}</strong> 项备件低于最低库存阈值, 建议补货:
        <span v-for="(sp, idx) in lowStockItems.slice(0, 3)" :key="sp.id" class="low-stock-name">
          {{ sp.name }}<span v-if="idx < Math.min(lowStockItems.length, 3) - 1">、</span>
        </span>
        <span v-if="lowStockItems.length > 3">等</span>
      </span>
    </div>

    <div class="sp-header">
      <div class="sp-title">
        <h2>备件仓库</h2>
        <span class="sp-count">共 {{ filteredSpareparts.length }} 项备件</span>
      </div>
      <div class="sp-actions">
        <button v-if="canEdit" class="dm-btn dm-btn-primary" @click="openAddDialog">+ 新增备件</button>
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
            <td><a href="#" class="name-link" @click.prevent="openDetailDialog(sp)">{{ sp.name }}</a></td>
            <td><span class="type-badge">{{ sp.type }}</span></td>
            <td :class="{ 'low-stock': sp.min_quantity > 0 && sp.quantity < sp.min_quantity }">
              {{ sp.quantity }}
            </td>
            <td>{{ sp.location }}</td>
            <td>{{ sp.vendor }}</td>
            <td class="specs-cell">{{ sp.specs || '-' }}</td>
            <td class="col-actions">
              <button v-if="canEdit" class="action-btn" @click="openEditDialog(sp)">✏️ 编辑</button>
              <button v-if="currentUser.role === '系统管理人'" class="action-btn action-btn-danger" @click="confirmDeleteSparepart(sp)">🗑️ 删除</button>
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

    <!-- 新增/编辑/详情备件弹窗 -->
    <div v-if="dialogVisible" class="dm-dialog-overlay" @click.self="dialogVisible = false">
      <div class="dm-dialog">
        <div class="dialog-header">
          <h3>{{ isReadOnly ? '备件详情' : (editingSp ? '编辑备件' : '新增备件') }}</h3>
          <button class="dialog-close" @click="dialogVisible = false">×</button>
        </div>
        <div class="dialog-body" :class="{ 'readonly-body': isReadOnly }">
          <div class="form-row">
            <label>备件名称 <span class="required" v-if="!isReadOnly">*</span></label>
            <input v-model="form.name" type="text" placeholder="请输入备件名称" :disabled="isReadOnly" />
          </div>
          <div class="form-row">
            <label>类型 <span class="required" v-if="!isReadOnly">*</span></label>
            <input v-model="form.type" type="text" list="sparepart-types-list" placeholder="选择或输入新类型" @blur="handleTypeBlur" :disabled="isReadOnly" />
            <datalist id="sparepart-types-list">
              <option v-for="t in sparepartTypes" :key="t" :value="t" />
            </datalist>
          </div>
          <div class="form-row-group">
            <div class="form-row">
              <label>数量 <span class="required" v-if="!isReadOnly">*</span></label>
              <input v-model.number="form.quantity" type="number" placeholder="数量" min="0" :disabled="isReadOnly" />
            </div>
            <div class="form-row">
              <label>报警阈值 <span class="threshold-hint" title="库存低于此值会触发低库存告警">ⓘ</span></label>
              <input v-model.number="form.min_quantity" type="number" placeholder="0 = 不告警" min="0" :disabled="isReadOnly" />
            </div>
          </div>
          <div class="form-row">
            <label>摆放位置</label>
            <input v-model="form.location" type="text" placeholder="如 A区-03-02" :disabled="isReadOnly" />
          </div>
          <div class="form-row">
            <label>厂商</label>
            <input v-model="form.vendor" type="text" placeholder="请输入厂商" :disabled="isReadOnly" />
          </div>
          <div class="form-row">
            <label>规格</label>
            <!-- 详情模式: 文本框多行只读 -->
            <textarea v-if="isReadOnly" class="specs-textarea" :value="editingSp?.specs || ''" rows="3" readonly></textarea>
            <!-- 编辑/新增模式: textarea (自由编辑) + 下方勾选+填值工具 -->
            <div v-else class="specs-edit-wrap">
              <textarea v-model="specsText" class="specs-textarea" rows="3" placeholder="直接编辑规格，如: 3x2.5, DN50 法兰, 6205-2RS。勾选下方选项会快速添加对应字段。"></textarea>
              <div class="params-checkboxes">
                <div class="preset-item">
                  <label class="param-check"><input type="checkbox" @change="onPresetCheck('电压', specsInput.voltage, $event)" />电压</label>
                  <input v-model="specsInput.voltage.value" type="text" placeholder="如 380V" class="param-input" />
                </div>
                <div class="preset-item">
                  <label class="param-check"><input type="checkbox" @change="onPresetCheck('电流', specsInput.current, $event)" />电流</label>
                  <input v-model="specsInput.current.value" type="text" placeholder="如 10A" class="param-input" />
                </div>
                <div class="preset-item">
                  <label class="param-check"><input type="checkbox" @change="onPresetCheck('功率', specsInput.power, $event)" />功率</label>
                  <input v-model="specsInput.power.value" type="text" placeholder="如 15kW" class="param-input" />
                </div>
                <div class="preset-item">
                  <label class="param-check"><input type="checkbox" @change="onPresetCheck('管径', specsInput.pipeDiameter, $event)" />管径</label>
                  <input v-model="specsInput.pipeDiameter.value" type="text" placeholder="如 DN100" class="param-input" />
                </div>
                <div class="preset-item">
                  <label class="param-check"><input type="checkbox" @change="onPresetCheck('螺纹', specsInput.thread, $event)" />螺纹</label>
                  <input v-model="specsInput.thread.value" type="text" placeholder="如 G1/2" class="param-input" />
                </div>
                <div class="preset-item">
                  <label class="param-check"><input type="checkbox" @change="onPresetCheck('长度', specsInput.length, $event)" />长度</label>
                  <input v-model="specsInput.length.value" type="text" placeholder="如 3mm" class="param-input" />
                </div>
              </div>
            </div>
          </div>
          <!-- 技术文档: 已上传文件 + 上传按钮 -->
          <div class="form-row">
            <label>技术文档</label>
            <!-- 详情模式: 只读文件列表 (点击打开/下载) -->
            <div v-if="isReadOnly" class="tech-docs-list">
              <div v-if="techDocs.length === 0" class="tech-docs-empty">无技术文档</div>
              <a v-for="(doc, idx) in techDocs" :key="idx" :href="doc.url" target="_blank" :download="doc.name" class="tech-doc-item" :title="`点击打开: ${doc.name} (${formatSize(doc.size)})`">
                <span class="doc-icon">📄</span>
                <span class="doc-name">{{ doc.name }}</span>
                <span class="doc-size">{{ formatSize(doc.size) }}</span>
                <span class="doc-action">打开</span>
              </a>
            </div>
            <!-- 编辑/新增模式: 文件列表 + 上传按钮 -->
            <div v-else class="tech-docs-edit">
              <div v-if="techDocs.length === 0" class="tech-docs-empty">未上传技术文档 (PDF / Word / Excel / 图片等)</div>
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
          <button class="dm-btn dm-btn-cancel" @click="dialogVisible = false">关闭</button>
          <button v-if="!isReadOnly" class="dm-btn dm-btn-primary" @click="saveSparepart">{{ editingSp ? '保存' : '新增' }}</button>
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
import { ref, computed, watch, onMounted } from 'vue'
import TopNavBar from '../components/TopNavBar.vue'
import { spareparts, sparepartLogs, sparepartTypes, addSparepart, updateSparepart, deleteSparepart, addSparepartType, inoutSparepart, loadSpareparts, loadSparepartLogs, Sparepart } from '../composables/useSparepartStore'
import { currentUser, authHeader } from '../composables/useDeviceStore'
import { useSSE } from '../composables/useSSE'

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
const selectedIds = ref<(number | string)[]>([])

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
// P1: 备件低库存告警 (P2.3)
const lowStockItems = ref<any[]>([])
async function loadLowStock() {
  try {
    const r = await fetch('/api/spareparts/low-stock-list')
    if (!r.ok) return
    const d = await r.json()
    lowStockItems.value = d.items || []
  } catch {}
}
useSSE('sparepart-low-stock', async (payload) => {
  console.info('[SSE] 备件低库存告警:', payload)
  await loadLowStock()
  // 同时刷新备件主列表
  // (主列表通过 sparepartStore 加载, 这里只触发一次 reload)
  if (typeof spareparts.value.length === 'number') {
    // 触发主列表的 watch/重新加载 (如果 spareparts 有 reload 函数)
    // 这里简化为只刷新低库存列表
  }
})
onMounted(() => {
  loadLowStock()
  loadSpareparts()
  loadSparepartLogs()
})

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
  extra: { checked: false, value: '' }
})

const form = ref({ name: '', type: '', quantity: null as number | null, min_quantity: 0 as number, location: '', vendor: '' })
const specsInput = ref(defaultSpecs())
// 规格文本 (textarea 双向绑定, 取代之前的 checkbox 组合输入)
const specsText = ref('')
// 技术文档文件列表
const techDocs = ref<{ url: string; name: string; size: number; uploaded_at?: string; uploaded_by?: string }[]>([])
// 上传中状态
const uploading = ref(false)
// 只读模式 (查看详情 vs 编辑): 编辑/新增为 false, 查看详情为 true
const isReadOnly = ref(false)
// 仅有系统管理人/维修组能编辑
const canEdit = computed(() => ['系统管理人', '维修组'].includes(currentUser.value?.role || ''))

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB'
}

// 上传技术文档
async function onUploadTechDoc(ev: Event) {
  const input = ev.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return
  uploading.value = true
  try {
    const formData = new FormData()
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i])
    }
    const r = await fetch('/api/upload/', {
      method: 'POST',
      headers: authHeader(),
      body: formData
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${r.status}`)
    }
    const data = await r.json()
    const newItems = (data.items || []).map((it: any) => ({
      url: it.url,
      name: it.name,
      size: it.size,
      uploaded_at: new Date().toISOString(),
      uploaded_by: currentUser.value?.name || '未知'
    }))
    // 追加 (不覆盖已上传)
    techDocs.value = [...techDocs.value, ...newItems]
  } catch (err) {
    alert('上传失败：' + (err instanceof Error ? err.message : String(err)))
  } finally {
    uploading.value = false
    input.value = ''  // 清空 input, 允许重复上传同名文件
  }
}

// 移除技术文档 (仅编辑模式下前端移除, 保存时同步)
function removeTechDoc(idx: number) {
  techDocs.value.splice(idx, 1)
}

// 常用规格快捷键 (勾选 checkbox 时把「字段名:值」追加到 specsText; 取消勾选时移除该字段)
function onPresetCheck(label: string, slot: { checked: boolean; value: string }, ev: Event) {
  const checked = (ev.target as HTMLInputElement).checked
  if (checked) {
    const kv = label + ':' + (slot.value || '')
    // 若 textarea 末尾不是逗号, 加逗号
    if (specsText.value && !specsText.value.trimEnd().endsWith(',')) {
      specsText.value = specsText.value.trimEnd() + ','
    }
    specsText.value = specsText.value + kv
  } else {
    // 取消勾选: 删除该 label 对应的段 (按 label 前缀匹配, 支持手动改过的值)
    specsText.value = removeParamByLabel(specsText.value, label)
  }
}

// 从规格字符串中删除指定 label 的字段 (按 "," 分段, 过滤以 "label:" 开头的项)
function removeParamByLabel(text: string, label: string): string {
  if (!text) return ''
  const prefix = label + ':'
  const items = text.split(',').map(s => s.trim()).filter(s => s.length > 0)
  const filtered = items.filter(s => !s.startsWith(prefix))
  return filtered.join(',')
}

function openAddDialog() {
  if (!canEdit.value) return
  editingSp.value = null
  isReadOnly.value = false
  form.value = { name: '', type: '', quantity: null, min_quantity: 0, location: '', vendor: '' }
  specsText.value = ''
  techDocs.value = []
  dialogVisible.value = true
}

function openDetailDialog(sp: Sparepart) {
  isReadOnly.value = true
  // 复用 openEditDialog 的 prefill, 后面禁用表单
  openEditDialog(sp)
}

function openEditDialog(sp: Sparepart) {
  if (!canEdit.value) {
    isReadOnly.value = true
  } else {
    isReadOnly.value = false
  }
  editingSp.value = sp
  form.value = { name: sp.name, type: sp.type, quantity: sp.quantity, min_quantity: sp.min_quantity ?? 0, location: sp.location, vendor: sp.vendor }
  specsText.value = sp.specs || ''
  // 解析后端 tech_docs (JSON 字段)
  techDocs.value = Array.isArray(sp.tech_docs) ? sp.tech_docs : []
  dialogVisible.value = true
}

function handleTypeBlur() {
  if (form.value.type) addSparepartType(form.value.type)
}

async function saveSparepart() {
  if (!form.value.name || !form.value.type) {
    alert('请填写必填项')
    return
  }
  const record = {
    name: form.value.name,
    type: form.value.type,
    quantity: form.value.quantity ?? 0,
    min_quantity: form.value.min_quantity ?? 0,
    location: form.value.location,
    vendor: form.value.vendor,
    specs: specsText.value,
    tech_docs: techDocs.value
  }
  try {
    if (editingSp.value) {
      await updateSparepart(editingSp.value.id, record)
    } else {
      await addSparepart(record)
    }
    dialogVisible.value = false
  } catch (err) {
    alert('保存失败：' + (err instanceof Error ? err.message : String(err)))
  }
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

async function confirmInout() {
  if (!inoutQuantity.value || inoutQuantity.value <= 0) {
    inoutError.value = '请输入有效数量'
    return
  }
  if (!inoutTarget.value) return
  const result = await inoutSparepart(inoutTarget.value.id, inoutAction.value, inoutQuantity.value)
  if (!result.success) {
    inoutError.value = result.error || '操作失败'
    return
  }
  inoutDialogVisible.value = false
}

// ============ 删除备件 (仅系统管理人) ============
async function confirmDeleteSparepart(sp: Sparepart) {
  if (currentUser.value?.role !== '系统管理人') return
  if (!confirm(`确定要删除备件「${sp.name}」吗？此操作不可恢复。`)) return
  try {
    await deleteSparepart(sp.id)
  } catch (err) {
    alert('删除失败：' + (err instanceof Error ? err.message : String(err)))
  }
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

/* P1: 低库存告警横幅 (P2.3) */
.low-stock-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 24px 16px;
  padding: 10px 18px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 6px;
  color: #fca5a5;
  font-size: 13px;
}
.low-stock-banner.pulse {
  animation: lowStockPulse 2s ease-in-out infinite;
}
@keyframes lowStockPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2); }
}
.low-stock-icon { font-size: 18px; }
.low-stock-text { flex: 1; }
.low-stock-name { color: #fecaca; margin: 0 2px; }
.threshold-mark { color: rgba(255,255,255,0.5); font-size: 11px; margin-left: 2px; }
.name-link { color: #ffffff; text-decoration: none; cursor: pointer; font-weight: 500; }
.name-link:hover { color: #2dd4bf; text-decoration: underline; }
.dm-dialog input:disabled,
.dm-dialog input[disabled] { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7); cursor: not-allowed; opacity: 0.85; }
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
.specs-edit-wrap { display: flex; flex-direction: column; gap: 8px; }
.specs-tip { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; }
.tech-docs-list, .tech-docs-edit { display: flex; flex-direction: column; gap: 6px; }
.tech-docs-empty { color: rgba(255,255,255,0.4); font-size: 12px; font-style: italic; padding: 4px 0; }
.tech-doc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  color: rgba(255,255,255,0.85);
  text-decoration: none;
  font-size: 13px;
  transition: background 0.15s;
}
a.tech-doc-item:hover, .tech-doc-item-editable:hover { background: rgba(45, 212, 191, 0.1); }
.doc-icon { font-size: 16px; }
.doc-name { flex: 1; color: #60a5fa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tech-doc-item-editable .doc-name { color: #60a5fa; }
a.tech-doc-item:hover .doc-name { color: #93c5fd; text-decoration: underline; }
.doc-size { color: rgba(255,255,255,0.5); font-size: 11px; font-family: ui-monospace, monospace; }
.doc-action { color: #2dd4bf; font-size: 11px; }
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
  display: inline-flex;
  align-items: center;
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
.readonly-body .required { display: none; }
.dm-table td.low-stock { color: #ef4444; font-weight: 600; }
.threshold-hint { color: rgba(255,255,255,0.4); font-size: 12px; margin-left: 4px; cursor: help; }

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
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  align-items: center;
}
.preset-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.param-check {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  color: rgba(255,255,255,0.85);
  cursor: pointer;
  white-space: nowrap;
  padding: 2px 6px;
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

.form-row .param-input {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 4px;
  color: rgba(255,255,255,0.85);
  padding: 4px 6px;
  font-size: 13px;
  width: 90px;
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
