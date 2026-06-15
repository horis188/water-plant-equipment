<template>
  <div class="positions-view">
    <div class="card-header">
      <h3 class="card-title">岗位字典</h3>
      <span class="card-tag" style="background:rgba(74,222,128,0.15);color:#4ade80;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:500;">P0-1</span>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <input v-model="keyword" type="text" placeholder="搜索: 名称/编码/角色" class="search-input" @keyup.enter="load" />
      <select v-model="enabledFilter" class="filter-select" @change="load">
        <option value="">全部状态</option>
        <option value="1">已启用</option>
        <option value="0">已停用</option>
      </select>
      <button class="dm-btn dm-btn-primary" @click="load" style="padding:6px 14px;">🔍 刷新</button>
      <div style="flex:1;"></div>
      <button class="dm-btn" @click="openEdit(null)" style="padding:6px 14px;background:rgba(45,212,191,0.15);color:#2dd4bf;border:1px solid rgba(45,212,191,0.4);">➕ 新增岗位</button>
    </div>

    <!-- 表格 -->
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:60px;">ID</th>
            <th>编码</th>
            <th>名称</th>
            <th>角色</th>
            <th style="width:80px;">排序</th>
            <th>描述</th>
            <th style="width:100px;">状态</th>
            <th style="width:180px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="8" style="text-align:center;padding:40px;color:rgba(255,255,255,0.5);">加载中...</td>
          </tr>
          <tr v-else-if="rows.length === 0">
            <td colspan="8" style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);">暂无岗位数据</td>
          </tr>
          <tr v-for="row in rows" :key="row.id" :class="{ disabled: !row.enabled }">
            <td>{{ row.id }}</td>
            <td><code style="color:#93c5fd;">{{ row.code }}</code></td>
            <td><strong>{{ row.name }}</strong></td>
            <td><span class="role-pill">{{ row.role }}</span></td>
            <td style="text-align:center;">{{ row.sort }}</td>
            <td style="color:rgba(255,255,255,0.6);">{{ row.description || '-' }}</td>
            <td>
              <span v-if="row.enabled" class="status-on">● 启用</span>
              <span v-else class="status-off">● 停用</span>
            </td>
            <td>
              <button class="op-btn" @click="openEdit(row)">编辑</button>
              <button class="op-btn" @click="toggle(row)">{{ row.enabled ? '停用' : '启用' }}</button>
              <button class="op-btn danger" :disabled="deletingId === row.id" @click="remove(row)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="table-footer">
      <span>共 {{ rows.length }} 条岗位</span>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="dialogVisible" class="dialog-mask" @click.self="dialogVisible = false">
      <div class="dialog">
        <div class="dialog-header">
          <span class="dialog-title">{{ editing ? '编辑岗位' : '新增岗位' }}</span>
          <button class="dialog-close" @click="dialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label class="form-label">编码 *</label>
            <input v-model="form.code" class="form-input" placeholder="如 YQ_ZHISHUI (大写字母+下划线)" />
          </div>
          <div class="form-row">
            <label class="form-label">名称 *</label>
            <input v-model="form.name" class="form-input" placeholder="如 一期制水" />
          </div>
          <div class="form-row">
            <label class="form-label">角色 *</label>
            <select v-model="form.role" class="form-input">
              <option value="值班岗位">值班岗位</option>
              <option value="带班">带班</option>
              <option value="系统管理人">系统管理人</option>
              <option value="维修组">维修组</option>
            </select>
          </div>
          <div class="form-row">
            <label class="form-label">排序</label>
            <input v-model.number="form.sort" type="number" class="form-input" />
          </div>
          <div class="form-row">
            <label class="form-label">启用</label>
            <label class="switch">
              <input v-model="form.enabled" type="checkbox" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="form-row">
            <label class="form-label">描述</label>
            <input v-model="form.description" class="form-input" placeholder="可选" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn" @click="dialogVisible = false" style="padding:8px 18px;">取消</button>
          <button class="dm-btn dm-btn-primary" @click="save" :disabled="saving" style="padding:8px 18px;background:#2dd4bf;color:#0a192f;font-weight:600;">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminApi } from '../../composables/useAdminApi'

const keyword = ref('')
const enabledFilter = ref('')
const rows = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const deletingId = ref<number | null>(null)

const dialogVisible = ref(false)
const editing = ref<any>(null)
const form = ref({
  code: '',
  name: '',
  role: '值班岗位',
  sort: 0,
  enabled: true,
  description: ''
})

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (keyword.value) params.set('keyword', keyword.value)
    if (enabledFilter.value) params.set('enabled', enabledFilter.value)
    const q = params.toString()
    const data = await adminApi.get(`/positions${q ? '?' + q : ''}`)
    rows.value = data.rows || []
  } catch (err: any) {
    alert('加载失败: ' + err.message)
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
      role: row.role,
      sort: row.sort,
      enabled: !!row.enabled,
      description: row.description || ''
    }
  } else {
    form.value = { code: '', name: '', role: '值班岗位', sort: 100, enabled: true, description: '' }
  }
  dialogVisible.value = true
}

async function save() {
  if (!form.value.code || !form.value.name || !form.value.role) {
    alert('编码/名称/角色 必填')
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await adminApi.put(`/positions/${editing.value.id}`, form.value)
    } else {
      await adminApi.post('/positions', form.value)
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
  if (!confirm(`确定要${row.enabled ? '停用' : '启用'}岗位 [${row.name}]?`)) return
  try {
    await adminApi.patch(`/positions/${row.id}/toggle`)
    await load()
  } catch (err: any) {
    alert('操作失败: ' + err.message)
  }
}

async function remove(row: any) {
  if (!confirm(`确定要删除岗位 [${row.name}]?\n(被用户引用的岗位不能删除)`)) return
  deletingId.value = row.id
  try {
    await adminApi.del(`/positions/${row.id}`)
    await load()
  } catch (err: any) {
    alert('删除失败: ' + err.message)
  } finally {
    deletingId.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.positions-view {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 20px 24px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.card-title {
  font-size: 17px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.search-input, .filter-select {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}
.search-input { width: 240px; }
.search-input:focus, .filter-select:focus { border-color: #2dd4bf; }
.filter-select { color-scheme: dark; }
.filter-select option { background: #0f2d4a; color: #fff; }

.dm-btn {
  padding: 8px 18px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
}
.dm-btn:hover { background: rgba(255, 255, 255, 0.1); }
.dm-btn-primary { background: #2dd4bf !important; color: #0a192f !important; font-weight: 600; }
.dm-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.table-wrap {
  overflow-x: auto;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.data-table th, .data-table td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
}
.data-table th {
  background: rgba(45, 212, 191, 0.1);
  color: #2dd4bf;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  white-space: nowrap;
}
.data-table tbody tr:hover { background: rgba(255, 255, 255, 0.04); }
.data-table tr.disabled { opacity: 0.5; }

.role-pill {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(96, 165, 250, 0.18);
  color: #93c5fd;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 500;
}
.status-on { color: #4ade80; font-weight: 500; }
.status-off { color: rgba(255, 255, 255, 0.4); }

.op-btn {
  padding: 3px 10px;
  margin-right: 4px;
  background: rgba(45, 212, 191, 0.15);
  color: #2dd4bf;
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}
.op-btn:hover { background: rgba(45, 212, 191, 0.25); }
.op-btn.danger {
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.3);
}
.op-btn.danger:hover { background: rgba(239, 68, 68, 0.22); }
.op-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.table-footer {
  margin-top: 10px;
  text-align: right;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
}

/* 弹窗 */
.dialog-mask {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.dialog {
  background: #163a5c;
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 10px;
  width: 90%; max-width: 480px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
.dialog-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.dialog-title { font-size: 16px; font-weight: 600; color: #fff; }
.dialog-close {
  background: none; border: none; color: rgba(255, 255, 255, 0.5);
  font-size: 22px; cursor: pointer; line-height: 1; padding: 0 4px;
}
.dialog-close:hover { color: #fff; }
.dialog-body { padding: 20px; }
.dialog-footer {
  padding: 14px 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex; justify-content: flex-end; gap: 8px;
}
.form-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.form-label { width: 80px; font-size: 13px; color: rgba(255, 255, 255, 0.75); }
.form-input {
  flex: 1; padding: 7px 12px; background: rgba(255, 255, 255, 0.06);
  color: #fff; border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px; font-size: 13px; outline: none;
}
.form-input:focus { border-color: #2dd4bf; }
select.form-input { color-scheme: dark; }
select.form-input option { background: #0f2d4a; color: #fff; }

/* 开关 */
.switch { position: relative; display: inline-block; width: 40px; height: 22px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute; cursor: pointer; inset: 0;
  background: rgba(255, 255, 255, 0.15);
  transition: 0.2s; border-radius: 22px;
}
.slider::before {
  position: absolute; content: ''; height: 16px; width: 16px;
  left: 3px; top: 3px; background: #fff; transition: 0.2s; border-radius: 50%;
}
.switch input:checked + .slider { background: #2dd4bf; }
.switch input:checked + .slider::before { transform: translateX(18px); }
</style>
