<template>
  <div class="shifts-view">
    <div class="card-header">
      <h3 class="card-title">班次时间配置</h3>
      <span class="card-tag" style="background:rgba(74,222,128,0.15);color:#4ade80;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:500;">P0-2</span>
    </div>

    <div class="toolbar">
      <span class="hint">💡 配置早班/日班/夜班的开始结束时间, 系统按配置自动判断当前班次。跨天的班次 (如夜班 23:00 → 次日 08:00) 需勾选"跨天"。</span>
      <div style="flex:1;"></div>
      <button class="dm-btn" @click="load" style="padding:6px 14px;">🔍 刷新</button>
      <button class="dm-btn dm-btn-primary" @click="openEdit(null)" style="padding:6px 14px;background:rgba(45,212,191,0.15);color:#2dd4bf;border:1px solid rgba(45,212,191,0.4);">➕ 新增班次</button>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:60px;">ID</th>
            <th>班次名</th>
            <th>开始</th>
            <th>结束</th>
            <th style="width:90px;">跨天</th>
            <th style="width:60px;">排序</th>
            <th>描述</th>
            <th style="width:90px;">状态</th>
            <th style="width:170px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="9" class="empty">加载中...</td>
          </tr>
          <tr v-else-if="rows.length === 0">
            <td colspan="9" class="empty">暂无班次数据</td>
          </tr>
          <tr v-for="row in rows" :key="row.id" :class="{ disabled: !row.enabled }">
            <td>{{ row.id }}</td>
            <td><strong style="color:#2dd4bf;font-size:15px;">{{ row.name }}</strong></td>
            <td><code style="color:#93c5fd;font-size:14px;">{{ row.start_time }}</code></td>
            <td><code style="color:#93c5fd;font-size:14px;">{{ row.end_time }}</code></td>
            <td>
              <span v-if="row.cross_day" class="cross-day">✓ 跨天</span>
              <span v-else class="text-gray">-</span>
            </td>
            <td style="text-align:center;">{{ row.sort }}</td>
            <td style="color:rgba(255,255,255,0.6);">{{ row.description || '-' }}</td>
            <td>
              <span v-if="row.enabled" class="status-on">● 启用</span>
              <span v-else class="status-off">● 停用</span>
            </td>
            <td>
              <button class="op-btn" @click="openEdit(row)">编辑</button>
              <button class="op-btn" @click="toggle(row)">{{ row.enabled ? '停用' : '启用' }}</button>
              <button class="op-btn danger" @click="remove(row)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="table-footer">共 {{ rows.length }} 个班次</div>

    <!-- 弹窗 -->
    <div v-if="dialogVisible" class="dialog-mask" @click.self="dialogVisible = false">
      <div class="dialog">
        <div class="dialog-header">
          <span class="dialog-title">{{ editing ? '编辑班次' : '新增班次' }}</span>
          <button class="dialog-close" @click="dialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label class="form-label">班次名 *</label>
            <input v-model="form.name" class="form-input" placeholder="如 早班/日班/夜班" />
          </div>
          <div class="form-row">
            <label class="form-label">开始时间 *</label>
            <input v-model="form.start_time" type="time" step="1" class="form-input" />
          </div>
          <div class="form-row">
            <label class="form-label">结束时间 *</label>
            <input v-model="form.end_time" type="time" step="1" class="form-input" />
          </div>
          <div class="form-row">
            <label class="form-label">跨天</label>
            <label class="switch">
              <input v-model="form.cross_day" type="checkbox" />
              <span class="slider"></span>
            </label>
            <span style="font-size:12px;color:rgba(255,255,255,0.5);margin-left:4px;">夜班 23:00 → 次日 08:00 需勾选</span>
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

const rows = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editing = ref<any>(null)
const form = ref({ name: '', start_time: '08:00:00', end_time: '16:00:00', cross_day: false, sort: 0, enabled: true, description: '' })

async function load() {
  loading.value = true
  try {
    const data = await adminApi.get('/shifts')
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
      name: row.name,
      start_time: row.start_time,
      end_time: row.end_time,
      cross_day: !!row.cross_day,
      sort: row.sort,
      enabled: !!row.enabled,
      description: row.description || ''
    }
  } else {
    form.value = { name: '', start_time: '08:00:00', end_time: '16:00:00', cross_day: false, sort: 100, enabled: true, description: '' }
  }
  dialogVisible.value = true
}

async function save() {
  if (!form.value.name || !form.value.start_time || !form.value.end_time) {
    alert('班次名/开始/结束时间 必填')
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await adminApi.put(`/shifts/${editing.value.id}`, form.value)
    } else {
      await adminApi.post('/shifts', form.value)
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
  if (!confirm(`确定要${row.enabled ? '停用' : '启用'}班次 [${row.name}]?`)) return
  try { await adminApi.patch(`/shifts/${row.id}/toggle`); await load() }
  catch (err: any) { alert('操作失败: ' + err.message) }
}

async function remove(row: any) {
  if (!confirm(`确定要删除班次 [${row.name}]?\n(被引用的班次可能不能删除)`)) return
  try { await adminApi.del(`/shifts/${row.id}`); await load() }
  catch (err: any) { alert('删除失败: ' + err.message) }
}

onMounted(load)
</script>

<style scoped>
.shifts-view { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 20px 24px; }
.card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
.card-title { font-size: 17px; font-weight: 600; color: #fff; margin: 0; }
.toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
.hint { font-size: 12px; color: rgba(255, 255, 255, 0.55); padding: 8px 12px; background: rgba(45, 212, 191, 0.06); border-radius: 4px; flex: 0 1 auto; }
.dm-btn { padding: 8px 18px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all 0.2s; background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.85); }
.dm-btn:hover { background: rgba(255, 255, 255, 0.1); }
.dm-btn-primary { background: #2dd4bf !important; color: #0a192f !important; font-weight: 600; }
.dm-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.table-wrap { overflow-x: auto; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.08); }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th, .data-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.9); }
.data-table th { background: rgba(45, 212, 191, 0.1); color: #2dd4bf; font-weight: 600; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap; }
.data-table tbody tr:hover { background: rgba(255, 255, 255, 0.04); }
.data-table tr.disabled { opacity: 0.5; }
.data-table .empty { text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.4); }
.cross-day { color: #faad14; font-weight: 600; }
.text-gray { color: rgba(255, 255, 255, 0.35); }
.status-on { color: #4ade80; font-weight: 500; }
.status-off { color: rgba(255, 255, 255, 0.4); }
.op-btn { padding: 3px 10px; margin-right: 4px; background: rgba(45, 212, 191, 0.15); color: #2dd4bf; border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 3px; cursor: pointer; font-size: 12px; }
.op-btn:hover { background: rgba(45, 212, 191, 0.25); }
.op-btn.danger { background: rgba(239, 68, 68, 0.12); color: #fca5a5; border-color: rgba(239, 68, 68, 0.3); }
.op-btn.danger:hover { background: rgba(239, 68, 68, 0.22); }
.table-footer { margin-top: 10px; text-align: right; font-size: 13px; color: rgba(255, 255, 255, 0.55); }

.dialog-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { background: #163a5c; border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 10px; width: 90%; max-width: 520px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); }
.dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
.dialog-title { font-size: 16px; font-weight: 600; color: #fff; }
.dialog-close { background: none; border: none; color: rgba(255, 255, 255, 0.5); font-size: 22px; cursor: pointer; line-height: 1; padding: 0 4px; }
.dialog-body { padding: 20px; }
.dialog-footer { padding: 14px 20px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: flex-end; gap: 8px; }
.form-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.form-label { width: 90px; font-size: 13px; color: rgba(255, 255, 255, 0.75); }
.form-input { flex: 1; padding: 7px 12px; background: rgba(255, 255, 255, 0.06); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; font-size: 13px; outline: none; }
.form-input:focus { border-color: #2dd4bf; }
input.form-input[type="time"] { color-scheme: dark; }

.switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; inset: 0; background: rgba(255, 255, 255, 0.15); transition: 0.2s; border-radius: 22px; }
.slider::before { position: absolute; content: ''; height: 16px; width: 16px; left: 3px; top: 3px; background: #fff; transition: 0.2s; border-radius: 50%; }
.switch input:checked + .slider { background: #2dd4bf; }
.switch input:checked + .slider::before { transform: translateX(18px); }
</style>
