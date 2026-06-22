<template>
  <div class="roles-view">
    <div class="card-header">
      <h3 class="card-title">角色权限</h3>
      <span class="card-tag" style="background:rgba(74,222,128,0.15);color:#4ade80;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:500;">P0-5</span>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <input v-model="keyword" type="text" placeholder="搜索: 角色名/编码" class="search-input" @keyup.enter="load" />
      <button class="dm-btn" @click="load" style="padding:6px 14px;">🔍 刷新</button>
      <div style="flex:1;"></div>
      <button class="dm-btn" @click="openEdit(null)" style="padding:6px 14px;background:rgba(45,212,191,0.15);color:#2dd4bf;border:1px solid rgba(45,212,191,0.4);">➕ 新增角色</button>
    </div>

    <!-- 表格 -->
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:60px;">ID</th>
            <th style="width:120px;">编码</th>
            <th>角色名</th>
            <th>描述</th>
            <th style="width:80px;">权限数</th>
            <th style="width:80px;">用户数</th>
            <th style="width:60px;">排序</th>
            <th style="width:90px;">状态</th>
            <th>类型</th>
            <th style="width:280px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="10" class="empty">加载中...</td>
          </tr>
          <tr v-else-if="filteredRows.length === 0">
            <td colspan="10" class="empty">暂无角色</td>
          </tr>
          <tr v-for="row in filteredRows" :key="row.id" :class="{ disabled: !row.enabled }">
            <td>{{ row.id }}</td>
            <td><code style="color:#93c5fd;">{{ row.code }}</code></td>
            <td><strong>{{ row.name }}</strong></td>
            <td style="color:rgba(255,255,255,0.6);font-size:12px;">{{ row.description || '-' }}</td>
            <td style="text-align:center;color:#2dd4bf;font-weight:600;">{{ row.perm_count }}</td>
            <td style="text-align:center;">{{ row.user_count }}</td>
            <td style="text-align:center;">{{ row.sort_order }}</td>
            <td>
              <span v-if="row.enabled" class="status-on">● 启用</span>
              <span v-else class="status-off">● 停用</span>
            </td>
            <td>
              <span v-if="row.is_system" class="role-pill" style="background:rgba(239,68,68,0.15);color:#fca5a5;">系统</span>
              <span v-else class="role-pill" style="background:rgba(45,212,191,0.15);color:#2dd4bf;">自定义</span>
            </td>
            <td>
              <button class="op-btn" @click="openEdit(row)">编辑</button>
              <button class="op-btn" @click="openPerms(row)">配权限</button>
              <button class="op-btn" @click="toggle(row)" :disabled="row.is_system === 1" :title="row.is_system === 1 ? '系统角色不可停用' : ''">{{ row.enabled ? '停用' : '启用' }}</button>
              <button class="op-btn danger" @click="remove(row)" :disabled="row.is_system === 1 || row.user_count > 0" :title="row.is_system === 1 ? '系统角色不可删除' : (row.user_count > 0 ? '该角色有用户, 不可删除' : '')">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="dialogVisible" class="dialog-mask" @click.self="dialogVisible = false">
      <div class="dialog">
        <div class="dialog-header">
          <span class="dialog-title">{{ editing ? '编辑角色' : '新增角色' }}</span>
          <button class="dialog-close" @click="dialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label class="form-label">编码 *</label>
            <input v-model="form.code" class="form-input" :disabled="editing && editing.is_system === 1" placeholder="如: 项目经理" />
            <span v-if="editing && editing.is_system === 1" class="form-hint">系统角色编码不可修改</span>
          </div>
          <div class="form-row">
            <label class="form-label">角色名 *</label>
            <input v-model="form.name" class="form-input" placeholder="如: 项目经理" />
          </div>
          <div class="form-row">
            <label class="form-label">描述</label>
            <input v-model="form.description" class="form-input" placeholder="如: 项目管理 + 跨组协调" />
          </div>
          <div class="form-row">
            <label class="form-label">排序</label>
            <input v-model.number="form.sort_order" type="number" class="form-input" />
          </div>
          <div class="form-row" v-if="!editing || editing.is_system !== 1">
            <label class="form-label">启用</label>
            <label class="switch">
              <input v-model="form.enabled" type="checkbox" />
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn" @click="dialogVisible = false" style="padding:8px 18px;">取消</button>
          <button class="dm-btn dm-btn-primary" @click="save" :disabled="saving" style="padding:8px 18px;background:#2dd4bf;color:#0a192f;font-weight:600;">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 权限分配弹窗 -->
    <div v-if="permsDialogVisible" class="dialog-mask" @click.self="permsDialogVisible = false">
      <div class="dialog dialog-wide">
        <div class="dialog-header">
          <span class="dialog-title">分配权限 · {{ permRole?.name }}</span>
          <button class="dialog-close" @click="permsDialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="perms-toolbar">
            <span class="perms-tip">已选 <strong style="color:#2dd4bf;">{{ selectedPermIds.size }}</strong> / {{ perms.length }} 项权限</span>
            <div style="flex:1;"></div>
            <button class="dm-btn" @click="selectAllInModule" style="padding:4px 12px;font-size:12px;">全选当前模块</button>
            <button class="dm-btn" @click="clearAllInModule" style="padding:4px 12px;font-size:12px;">清空当前模块</button>
          </div>
          <div v-for="(items, module) in groupedPerms" :key="module" class="perm-module">
            <div class="perm-module-header">
              <span class="perm-module-name">📂 {{ moduleLabel(module) }}</span>
              <span class="perm-module-count">{{ items.length }} 项</span>
            </div>
            <div class="perm-list">
              <label v-for="p in items" :key="p.id" class="perm-item">
                <input
                  type="checkbox"
                  :checked="selectedPermIds.has(p.id)"
                  @change="togglePerm(p.id)"
                />
                <span class="perm-code">{{ p.code }}</span>
                <span class="perm-name">{{ p.name }}</span>
                <span class="perm-type">{{ p.type }}</span>
              </label>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn" @click="permsDialogVisible = false" style="padding:8px 18px;">取消</button>
          <button class="dm-btn dm-btn-primary" @click="savePerms" :disabled="savingPerms" style="padding:8px 18px;background:#2dd4bf;color:#0a192f;font-weight:600;">{{ savingPerms ? '保存中...' : '保存权限' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { adminApi } from '../../composables/useAdminApi'

const rows = ref<any[]>([])
const allPerms = ref<any[]>([])
const loading = ref(false)
const keyword = ref('')

const dialogVisible = ref(false)
const editing = ref<any>(null)
const form = ref({ code: '', name: '', description: '', sort_order: 0, enabled: true })
const saving = ref(false)

const permsDialogVisible = ref(false)
const permRole = ref<any>(null)
const perms = ref<any[]>([])
const selectedPermIds = ref<Set<number>>(new Set())
const savingPerms = ref(false)

const moduleLabels: Record<string, string> = {
  dashboard: '主面板',
  handover: '交接班',
  inspection: '巡检',
  workorder: '工单',
  maintenance: '保养',
  device: '设备',
  spareparts: '备件',
  admin: '系统管理'
}
function moduleLabel(code: string): string {
  return moduleLabels[code] || code
}

const filteredRows = computed(() => {
  if (!keyword.value) return rows.value
  const kw = keyword.value.toLowerCase()
  return rows.value.filter(r =>
    r.name.toLowerCase().includes(kw) || r.code.toLowerCase().includes(kw)
  )
})

const groupedPerms = computed(() => {
  const groups: Record<string, any[]> = {}
  for (const p of perms.value) {
    if (!groups[p.module]) groups[p.module] = []
    groups[p.module].push(p)
  }
  // 按 moduleLabels 排序
  const sorted: Record<string, any[]> = {}
  for (const k of Object.keys(moduleLabels)) {
    if (groups[k]) sorted[k] = groups[k]
  }
  return sorted
})

async function load() {
  loading.value = true
  try {
    const data = await adminApi.get('/roles')
    rows.value = data.rows || []
  } catch (err: any) {
    alert('加载角色失败: ' + err.message)
  } finally {
    loading.value = false
  }
}

function openEdit(row: any) {
  editing.value = row
  if (row) {
    form.value = {
      code: row.code,
      name: row.name,
      description: row.description || '',
      sort_order: row.sort_order,
      enabled: !!row.enabled
    }
  } else {
    form.value = { code: '', name: '', description: '', sort_order: 99, enabled: true }
  }
  dialogVisible.value = true
}

async function save() {
  if (!form.value.code || !form.value.name) {
    alert('编码和角色名必填')
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      // 系统角色: 不传 code (避免改 code), 不传 enabled (避免改 enabled)
      const payload: any = {
        name: form.value.name,
        description: form.value.description,
        sort_order: form.value.sort_order
      }
      if (editing.value.is_system !== 1) {
        payload.code = form.value.code
        payload.enabled = form.value.enabled
      }
      await adminApi.put(`/roles/${editing.value.id}`, payload)
    } else {
      await adminApi.post('/roles', form.value)
    }
    dialogVisible.value = false
    await load()
  } catch (err: any) {
    alert('保存失败: ' + err.message)
  } finally {
    saving.value = false
  }
}

async function toggle(row: any) {
  if (row.is_system === 1) {
    alert('系统角色不可停用')
    return
  }
  if (!confirm(`确定要${row.enabled ? '停用' : '启用'}角色 [${row.name}]?`)) return
  try {
    await adminApi.patch(`/roles/${row.id}/toggle`)
    await load()
  } catch (err: any) {
    alert('操作失败: ' + err.message)
  }
}

async function remove(row: any) {
  if (row.is_system === 1) { alert('系统角色不可删除'); return }
  if (row.user_count > 0) { alert(`该角色有 ${row.user_count} 个用户, 请先转移`); return }
  if (!confirm(`确定要删除角色 [${row.name}] 吗?\n该角色下的所有权限分配也会被删除`)) return
  try {
    await adminApi.del(`/roles/${row.id}`)
    await load()
  } catch (err: any) {
    alert('删除失败: ' + err.message)
  }
}

async function openPerms(row: any) {
  permRole.value = row
  permsDialogVisible.value = true
  selectedPermIds.value = new Set()
  // 拉权限点 (带当前角色已勾选状态)
  try {
    const data = await adminApi.get(`/permissions?roleId=${row.id}`)
    perms.value = data.rows || []
    for (const p of perms.value) {
      if (p.checked) selectedPermIds.value.add(p.id)
    }
  } catch (err: any) {
    alert('加载权限失败: ' + err.message)
    permsDialogVisible.value = false
  }
}

function togglePerm(id: number) {
  if (selectedPermIds.value.has(id)) {
    selectedPermIds.value.delete(id)
  } else {
    selectedPermIds.value.add(id)
  }
  // 触发响应式
  selectedPermIds.value = new Set(selectedPermIds.value)
}

function selectAllInModule() {
  // 该函数没传 module 参数, 改成"全选所有未选的"
  for (const p of perms.value) {
    selectedPermIds.value.add(p.id)
  }
  selectedPermIds.value = new Set(selectedPermIds.value)
}

function clearAllInModule() {
  selectedPermIds.value.clear()
  selectedPermIds.value = new Set(selectedPermIds.value)
}

async function savePerms() {
  if (!permRole.value) return
  savingPerms.value = true
  try {
    await adminApi.put(`/roles/${permRole.value.id}/permissions`, {
      permission_ids: Array.from(selectedPermIds.value)
    })
    permsDialogVisible.value = false
    await load()
    alert('权限已保存')
  } catch (err: any) {
    alert('保存失败: ' + err.message)
  } finally {
    savingPerms.value = false
  }
}

onMounted(() => { load() })
</script>

<style scoped>
.roles-view { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 20px 24px; }
.card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
.card-title { font-size: 17px; font-weight: 600; color: #fff; margin: 0; }
.toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
.search-input { padding: 6px 12px; background: rgba(255, 255, 255, 0.06); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; font-size: 13px; outline: none; width: 240px; }
.search-input:focus { border-color: #2dd4bf; }
.dm-btn { padding: 8px 18px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all 0.2s; background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.85); }
.dm-btn:hover { background: rgba(255, 255, 255, 0.1); }
.dm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.dm-btn-primary { background: #2dd4bf !important; color: #0a192f !important; font-weight: 600; }

.table-wrap { overflow-x: auto; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.08); }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th, .data-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.9); }
.data-table th { background: rgba(45, 212, 191, 0.1); color: #2dd4bf; font-weight: 600; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap; }
.data-table tbody tr:hover { background: rgba(255, 255, 255, 0.04); }
.data-table tr.disabled { opacity: 0.5; }
.data-table .empty { text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.4); }
.role-pill { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 12px; font-weight: 500; }
.status-on { color: #4ade80; font-weight: 500; }
.status-off { color: rgba(255, 255, 255, 0.4); }
.op-btn { padding: 3px 10px; margin-right: 4px; background: rgba(45, 212, 191, 0.15); color: #2dd4bf; border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 3px; cursor: pointer; font-size: 12px; }
.op-btn:hover:not(:disabled) { background: rgba(45, 212, 191, 0.25); }
.op-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.op-btn.danger { background: rgba(239, 68, 68, 0.12); color: #fca5a5; border-color: rgba(239, 68, 68, 0.3); }
.op-btn.danger:hover:not(:disabled) { background: rgba(239, 68, 68, 0.22); }
.op-btn.danger:disabled { background: rgba(239, 68, 68, 0.05); color: rgba(255, 255, 255, 0.3); }

.dialog-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { background: #163a5c; border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 10px; width: 90%; max-width: 520px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); }
.dialog-wide { max-width: 820px; max-height: 85vh; display: flex; flex-direction: column; }
.dialog-wide .dialog-body { overflow-y: auto; }
.dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
.dialog-title { font-size: 16px; font-weight: 600; color: #fff; }
.dialog-close { background: none; border: none; color: rgba(255, 255, 255, 0.5); font-size: 22px; cursor: pointer; line-height: 1; padding: 0 4px; }
.dialog-body { padding: 20px; max-height: 65vh; overflow-y: auto; }
.dialog-footer { padding: 14px 20px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: flex-end; gap: 8px; }
.form-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.form-label { width: 100px; font-size: 13px; color: rgba(255, 255, 255, 0.75); }
.form-input { flex: 1; padding: 7px 12px; background: rgba(255, 255, 255, 0.06); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; font-size: 13px; outline: none; }
.form-input:focus { border-color: #2dd4bf; }
.form-input:disabled { opacity: 0.5; }
.form-hint { font-size: 12px; color: rgba(250, 173, 20, 0.85); }

.switch { position: relative; display: inline-block; width: 40px; height: 22px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; inset: 0; background: rgba(255, 255, 255, 0.15); transition: 0.2s; border-radius: 22px; }
.slider::before { position: absolute; content: ''; height: 16px; width: 16px; left: 3px; top: 3px; background: #fff; transition: 0.2s; border-radius: 50%; }
.switch input:checked + .slider { background: #2dd4bf; }
.switch input:checked + .slider::before { transform: translateX(18px); }

.perms-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
.perms-tip { font-size: 13px; color: rgba(255, 255, 255, 0.7); }

.perm-module { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; margin-bottom: 12px; }
.perm-module-header { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
.perm-module-name { font-size: 13px; font-weight: 600; color: #2dd4bf; }
.perm-module-count { font-size: 12px; color: rgba(255, 255, 255, 0.4); }
.perm-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; padding: 10px 14px; }
.perm-item { display: flex; align-items: center; gap: 8px; padding: 4px 6px; font-size: 12px; cursor: pointer; border-radius: 3px; }
.perm-item:hover { background: rgba(45, 212, 191, 0.08); }
.perm-item input { cursor: pointer; }
.perm-code { color: #93c5fd; font-family: monospace; font-size: 11px; min-width: 140px; }
.perm-name { color: rgba(255, 255, 255, 0.85); flex: 1; }
.perm-type { color: rgba(255, 255, 255, 0.4); font-size: 11px; padding: 1px 6px; background: rgba(255, 255, 255, 0.06); border-radius: 3px; }
</style>
