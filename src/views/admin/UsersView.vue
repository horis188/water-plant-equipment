<template>
  <div class="users-view">
    <div class="card-header">
      <h3 class="card-title">用户管理</h3>
      <span class="card-tag" style="background:rgba(74,222,128,0.15);color:#4ade80;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:500;">P0-4</span>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <input v-model="keyword" type="text" placeholder="搜索: 账号/姓名" class="search-input" @keyup.enter="load(1)" />
      <select v-model="roleFilter" class="filter-select" @change="load(1)">
        <option value="">全部角色</option>
        <option v-for="r in roleOptions" :key="r" :value="r">{{ r }}</option>
      </select>
      <select v-model="enabledFilter" class="filter-select" @change="load(1)">
        <option value="">全部状态</option>
        <option value="1">已启用</option>
        <option value="0">已停用</option>
      </select>
      <button class="dm-btn" @click="load(1)" style="padding:6px 14px;">🔍 查询</button>
      <div style="flex:1;"></div>
      <button class="dm-btn" @click="openEdit(null)" style="padding:6px 14px;background:rgba(45,212,191,0.15);color:#2dd4bf;border:1px solid rgba(45,212,191,0.4);">➕ 新增用户</button>
    </div>

    <!-- 表格 -->
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:60px;">序号</th>
            <th>账号</th>
            <th>姓名</th>
            <th>角色</th>
            <th style="width:90px;">状态</th>
            <th>创建时间</th>
            <th style="width:230px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="7" class="empty">加载中...</td></tr>
          <tr v-else-if="rows.length === 0"><td colspan="7" class="empty">暂无用户</td></tr>
          <tr v-for="(u, idx) in rows" :key="u.id" :class="{ disabled: !u.enabled }">
            <td>{{ (page - 1) * pageSize + idx + 1 }}</td>
            <td><code style="color:#93c5fd;">{{ u.username }}</code></td>
            <td><strong>{{ u.name }}</strong></td>
            <td><span class="role-pill" :class="'role-'+roleClass(u.role)">{{ u.role }}</span></td>
            <td>
              <span v-if="u.enabled" class="status-on">● 启用</span>
              <span v-else class="status-off">● 停用</span>
            </td>
            <td style="color:rgba(255,255,255,0.55);font-size:12px;">{{ formatDate(u.created_at) }}</td>
            <td>
              <button class="op-btn" @click="openEdit(u)">编辑</button>
              <button class="op-btn" @click="resetPwd(u)">重置密码</button>
              <button class="op-btn" @click="toggle(u)" :disabled="u.id === 1 || u.id === currentUserId" :title="u.id === 1 ? '不能停用超级管理员' : (u.id === currentUserId ? '不能停用自己' : '')">{{ u.enabled ? '停用' : '启用' }}</button>
              <button class="op-btn danger" @click="remove(u)" :disabled="u.id === 1 || u.id === currentUserId" :title="u.id === 1 ? '不能删除超级管理员' : (u.id === currentUserId ? '不能删除自己' : '')">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 翻页器 -->
    <div class="pagination">
      <span class="page-info">共 {{ total }} 个用户</span>
      <button class="dm-btn" :disabled="page <= 1" @click="load(page - 1)" style="padding:4px 10px;">‹ 上一页</button>
      <span class="page-current">第 {{ page }} / {{ totalPages }} 页</span>
      <button class="dm-btn" :disabled="page >= totalPages" @click="load(page + 1)" style="padding:4px 10px;">下一页 ›</button>
      <select v-model.number="pageSize" @change="load(1)" class="filter-select" style="width:auto;">
        <option :value="10">10条/页</option>
        <option :value="20">20条/页</option>
        <option :value="50">50条/页</option>
      </select>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="dialogVisible" class="dialog-mask" @click.self="dialogVisible = false">
      <div class="dialog">
        <div class="dialog-header">
          <span class="dialog-title">{{ editing ? '编辑用户' : '新增用户' }}</span>
          <button class="dialog-close" @click="dialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label class="form-label">账号 *</label>
            <input v-model="form.username" class="form-input" :disabled="!!editing" placeholder="登录账号 (e.g. yqzs)" />
          </div>
          <div class="form-row" v-if="!editing">
            <label class="form-label">密码 *</label>
            <input v-model="form.password" type="text" class="form-input" placeholder="明文密码 (项目暂用明文, 后续接入加密)" />
          </div>
          <div class="form-row" v-else>
            <label class="form-label">新密码</label>
            <input v-model="form.password" type="text" class="form-input" placeholder="留空则不修改" />
          </div>
          <div class="form-row">
            <label class="form-label">姓名 *</label>
            <input v-model="form.name" class="form-input" placeholder="显示姓名" />
          </div>
          <div class="form-row">
            <label class="form-label">角色 *</label>
            <select v-model="form.role" class="form-input">
              <option v-for="r in roleOptions" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
          <div class="form-row">
            <label class="form-label">头像</label>
            <input v-model="form.avatar" class="form-input" placeholder="单字汉字或emoji, 留空自动取姓名首字" />
          </div>
          <div class="form-row">
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { adminApi } from '../../composables/useAdminApi'
import { currentUser } from '../../composables/useDeviceStore'

const currentUserId = computed(() => currentUser.value?.id || 0)

const roleOptions = ['系统管理人', '带班', '值班岗位', '维修组']
const rows = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const keyword = ref('')
const roleFilter = ref('')
const enabledFilter = ref('')

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editing = ref<any>(null)
const form = ref({
  username: '', password: '', name: '', role: '值班岗位',
  avatar: '', enabled: true
})

function roleClass(role: string): string {
  if (role === '系统管理人') return 'admin'
  if (role === '带班') return 'leader'
  if (role === '维修组') return 'maint'
  return 'operator'
}
function formatDate(d: string): string {
  if (!d) return '-'
  return d.substring(0, 19).replace('T', ' ')
}

async function load(p = 1) {
  page.value = p
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (keyword.value) params.set('keyword', keyword.value)
    if (roleFilter.value) params.set('role', roleFilter.value)
    if (enabledFilter.value) params.set('enabled', enabledFilter.value)
    params.set('page', String(p))
    params.set('pageSize', String(pageSize.value))
    const data = await adminApi.get(`/users?${params.toString()}`)
    rows.value = data.rows || []
    total.value = data.total || 0
  } catch (err: any) {
    alert('加载失败: ' + err.message)
  } finally {
    loading.value = false
  }
}

function openEdit(u: any) {
  editing.value = u
  if (u) {
    form.value = {
      username: u.username, password: '', name: u.name, role: u.role,
      avatar: u.avatar && u.avatar !== '?' ? u.avatar : '', enabled: !!u.enabled
    }
  } else {
    form.value = { username: '', password: '', name: '', role: '值班岗位', avatar: '', enabled: true }
  }
  dialogVisible.value = true
}

async function save() {
  if (!form.value.username || !form.value.name || !form.value.role) {
    alert('账号/姓名/角色 必填')
    return
  }
  if (!editing.value && !form.value.password) {
    alert('新增用户必须设置密码')
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await adminApi.put(`/users/${editing.value.id}`, form.value)
    } else {
      await adminApi.post('/users', form.value)
    }
    dialogVisible.value = false
    await load(page.value)
  } catch (err: any) {
    alert('保存失败: ' + err.message)
  } finally {
    saving.value = false
  }
}

async function toggle(u: any) {
  if (u.id === 1) { alert('不能停用超级管理员'); return }
  if (u.id === currentUserId.value) { alert('不能停用自己'); return }
  if (!confirm(`确定要${u.enabled ? '停用' : '启用'}用户 [${u.username}]?`)) return
  try {
    await adminApi.patch(`/users/${u.id}/toggle`)
    await load(page.value)
  } catch (err: any) { alert('操作失败: ' + err.message) }
}

async function resetPwd(u: any) {
  const newPwd = prompt(`为用户 [${u.username}] 重置密码:\n(留空将重置为默认 123456)`, '')
  if (newPwd === null) return // 取消
  const finalPwd = newPwd.trim() || '123456'
  if (!confirm(`确认将密码重置为: ${finalPwd}?`)) return
  try {
    const r = await adminApi.post(`/users/${u.id}/reset-password`, { password: finalPwd })
    alert(`密码已重置为: ${r.new_password}\n请告知用户妥善保管`)
  } catch (err: any) { alert('重置失败: ' + err.message) }
}

async function remove(u: any) {
  if (u.id === 1) { alert('不能删除超级管理员'); return }
  if (u.id === currentUserId.value) { alert('不能删除自己'); return }
  if (!confirm(`确定要删除用户 [${u.username}]?`)) return
  try {
    await adminApi.del(`/users/${u.id}`)
    if (rows.value.length === 1 && page.value > 1) page.value--
    await load(page.value)
  } catch (err: any) { alert('删除失败: ' + err.message) }
}

onMounted(async () => { await load(1) })
</script>

<style scoped>
.users-view { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 20px 24px; }
.card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
.card-title { font-size: 17px; font-weight: 600; color: #fff; margin: 0; }
.toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
.search-input, .filter-select { padding: 6px 12px; background: rgba(255, 255, 255, 0.06); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; font-size: 13px; outline: none; }
.search-input { width: 240px; }
.search-input:focus, .filter-select:focus { border-color: #2dd4bf; }
.filter-select { color-scheme: dark; min-width: 100px; }
.filter-select option { background: #0f2d4a; color: #fff; }
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
.role-pill.role-admin { background: rgba(239, 68, 68, 0.18); color: #fca5a5; }
.role-pill.role-leader { background: rgba(250, 173, 20, 0.2); color: #faad14; }
.role-pill.role-maint { background: rgba(96, 165, 250, 0.18); color: #93c5fd; }
.role-pill.role-operator { background: rgba(45, 212, 191, 0.18); color: #5eead4; }
.status-on { color: #4ade80; font-weight: 500; }
.status-off { color: rgba(255, 255, 255, 0.4); }
.op-btn { padding: 3px 10px; margin-right: 4px; background: rgba(45, 212, 191, 0.15); color: #2dd4bf; border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 3px; cursor: pointer; font-size: 12px; }
.op-btn:hover { background: rgba(45, 212, 191, 0.25); }
.op-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.op-btn.danger { background: rgba(239, 68, 68, 0.12); color: #fca5a5; border-color: rgba(239, 68, 68, 0.3); }
.op-btn.danger:hover:not(:disabled) { background: rgba(239, 68, 68, 0.22); }
.op-btn.danger:disabled { background: rgba(239, 68, 68, 0.05); color: rgba(255, 255, 255, 0.3); }

.pagination { display: flex; align-items: center; gap: 10px; justify-content: flex-end; margin-top: 14px; font-size: 13px; }
.page-info { color: rgba(255, 255, 255, 0.55); margin-right: auto; }
.page-current { color: #2dd4bf; font-weight: 600; padding: 0 6px; }

.dialog-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { background: #163a5c; border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 10px; width: 90%; max-width: 520px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); }
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
select.form-input { color-scheme: dark; }
select.form-input option { background: #0f2d4a; color: #fff; }

.switch { position: relative; display: inline-block; width: 40px; height: 22px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; inset: 0; background: rgba(255, 255, 255, 0.15); transition: 0.2s; border-radius: 22px; }
.slider::before { position: absolute; content: ''; height: 16px; width: 16px; left: 3px; top: 3px; background: #fff; transition: 0.2s; border-radius: 50%; }
.switch input:checked + .slider { background: #2dd4bf; }
.switch input:checked + .slider::before { transform: translateX(18px); }
</style>
