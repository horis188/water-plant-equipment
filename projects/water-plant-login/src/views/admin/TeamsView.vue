<template>
  <div class="teams-view">
    <div class="card-header">
      <h3 class="card-title">班组配置</h3>
      <span class="card-tag" style="background:rgba(74,222,128,0.15);color:#4ade80;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:500;">P0-3</span>
    </div>

    <div class="teams-body">
      <!-- 左侧: 班组列表 -->
      <aside class="teams-sidebar">
        <div class="sidebar-header">
          <span>班组列表</span>
          <button class="add-btn" @click="openTeamEdit(null)" title="新增班组">➕</button>
        </div>
        <div v-if="teamsLoading" class="loading">加载中...</div>
        <div v-else-if="teams.length === 0" class="loading">暂无班组</div>
        <div
          v-for="t in teams"
          :key="t.id"
          class="team-item"
          :class="{ active: selectedTeam === t.team_name }"
          @click="selectTeam(t)"
        >
          <div class="team-name">{{ t.team_name }}</div>
          <div class="team-leader">带班: {{ t.leader_name || '-' }}</div>
          <div class="team-counts">
            <span class="badge">{{ t.member_count }} 人</span>
            <span v-if="t.member_count === 0" class="badge-zero">空</span>
          </div>
        </div>
      </aside>

      <!-- 右侧: 成员管理 -->
      <main class="teams-main">
        <div v-if="!selectedTeam" class="empty-hint">
          <span class="empty-icon">👈</span>
          <p>请在左侧选择一个班组</p>
        </div>
        <template v-else>
          <div class="team-header">
            <div>
              <h4 class="team-title">{{ selectedTeam }} 班成员</h4>
              <p class="team-sub">带班: <strong style="color:#faad14;">{{ currentTeam?.leader_name || '-' }}</strong> · 当前值班员: {{ currentTeam?.member_name || '-' }}</p>
            </div>
            <div class="team-actions">
              <button class="dm-btn" @click="openTeamEdit(currentTeam)" style="padding:6px 14px;background:rgba(45,212,191,0.15);color:#2dd4bf;border:1px solid rgba(45,212,191,0.4);">✏️ 编辑班组</button>
              <button class="dm-btn" @click="deleteTeam" :disabled="members.length > 0 || (currentTeam && currentTeam.user_count > 0)" :title="deleteBlockReason" style="padding:6px 14px;background:rgba(239,68,68,0.12);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);">🗑️ 删除班组</button>
              <button class="dm-btn dm-btn-primary" @click="openMemberEdit(null)" style="padding:6px 14px;background:rgba(45,212,191,0.15);color:#2dd4bf;border:1px solid rgba(45,212,191,0.4);">➕ 新增成员</button>
            </div>
          </div>

          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:60px;">序号</th>
                  <th>姓名</th>
                  <th style="width:120px;">类型</th>
                  <th>创建时间</th>
                  <th style="width:160px;">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="membersLoading"><td colspan="5" class="empty">加载中...</td></tr>
                <tr v-else-if="members.length === 0"><td colspan="5" class="empty">该班组暂无成员, 点击"新增成员"添加</td></tr>
                <tr v-for="(m, idx) in members" :key="m.id">
                  <td>{{ idx + 1 }}</td>
                  <td><strong>{{ m.member_name }}</strong></td>
                  <td>
                    <span :class="m.member_type === '带班' ? 'type-leader' : 'type-normal'">{{ m.member_type }}</span>
                  </td>
                  <td style="color:rgba(255,255,255,0.55);font-size:12px;">{{ formatDate(m.created_at) }}</td>
                  <td>
                    <button class="op-btn" @click="openMemberEdit(m)">编辑</button>
                    <button class="op-btn danger" @click="deleteMember(m)">删除</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="table-footer">共 {{ members.length }} 名成员</div>
        </template>
      </main>
    </div>

    <!-- 班组编辑弹窗 -->
    <div v-if="teamDialogVisible" class="dialog-mask" @click.self="teamDialogVisible = false">
      <div class="dialog">
        <div class="dialog-header">
          <span class="dialog-title">{{ teamEditing?.id ? '编辑班组' : '新增班组' }}</span>
          <button class="dialog-close" @click="teamDialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label class="form-label">班组名 *</label>
            <input v-model="teamForm.team_name" class="form-input" :disabled="!!teamEditing?.id" placeholder="如 A班" />
          </div>
          <div class="form-row">
            <label class="form-label">带班人</label>
            <input v-model="teamForm.leader_name" class="form-input" placeholder="姓名" />
          </div>
          <div class="form-row">
            <label class="form-label">当前值班员</label>
            <input v-model="teamForm.member_name" class="form-input" placeholder="姓名 (用于当前值班显示)" />
          </div>
          <div class="form-row">
            <label class="form-label">默认班次</label>
            <select v-model="teamForm.shift_type" class="form-input">
              <option value="早班">早班</option>
              <option value="日班">日班</option>
              <option value="夜班">夜班</option>
            </select>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn" @click="teamDialogVisible = false" style="padding:8px 18px;">取消</button>
          <button class="dm-btn dm-btn-primary" @click="saveTeam" :disabled="saving" style="padding:8px 18px;background:#2dd4bf;color:#0a192f;font-weight:600;">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 成员编辑弹窗 -->
    <div v-if="memberDialogVisible" class="dialog-mask" @click.self="memberDialogVisible = false">
      <div class="dialog">
        <div class="dialog-header">
          <span class="dialog-title">{{ memberEditing?.id ? '编辑成员' : '新增成员' }} ({{ selectedTeam }})</span>
          <button class="dialog-close" @click="memberDialogVisible = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-row">
            <label class="form-label">姓名 *</label>
            <input v-model="memberForm.member_name" class="form-input" placeholder="成员姓名" />
          </div>
          <div class="form-row">
            <label class="form-label">类型 *</label>
            <select v-model="memberForm.member_type" class="form-input">
              <option value="值班">值班</option>
              <option value="带班">带班</option>
            </select>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dm-btn" @click="memberDialogVisible = false" style="padding:8px 18px;">取消</button>
          <button class="dm-btn dm-btn-primary" @click="saveMember" :disabled="saving" style="padding:8px 18px;background:#2dd4bf;color:#0a192f;font-weight:600;">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { adminApi } from '../../composables/useAdminApi'

const teams = ref<any[]>([])
const teamsLoading = ref(false)
const selectedTeam = ref<string>('')
const currentTeam = ref<any>(null)
const members = ref<any[]>([])
const membersLoading = ref(false)
const saving = ref(false)

const teamDialogVisible = ref(false)
const teamEditing = ref<any>(null)
const teamForm = ref({ team_name: '', member_name: '', leader_name: '', shift_type: '早班' })

// 删除按钮不可点的提示 (用于 title 悬停解释)
const deleteBlockReason = computed(() => {
  if (!currentTeam.value) return ''
  const reasons: string[] = []
  if (members.value.length > 0) reasons.push(`还有 ${members.value.length} 名成员`)
  if (currentTeam.value.user_count > 0) reasons.push(`被 ${currentTeam.value.user_count} 名用户引用`)
  return reasons.length > 0 ? '需先处理: ' + reasons.join(', ') : ''
})

const memberDialogVisible = ref(false)
const memberEditing = ref<any>(null)
const memberForm = ref({ member_name: '', member_type: '值班' })

async function loadTeams() {
  teamsLoading.value = true
  try {
    const data = await adminApi.get('/teams')
    // 后端 SQL 已返回 member_count + user_count
    teams.value = data.rows || []
  } catch (err: any) {
    alert('加载班组失败: ' + err.message)
  } finally {
    teamsLoading.value = false
  }
}

async function selectTeam(t: any) {
  selectedTeam.value = t.team_name
  currentTeam.value = t
  await loadMembers()
}

async function loadMembers() {
  if (!selectedTeam.value) return
  membersLoading.value = true
  try {
    const data = await adminApi.get(`/teams/${encodeURIComponent(selectedTeam.value)}/members`)
    members.value = data.rows || []
  } catch (err: any) {
    alert('加载成员失败: ' + err.message)
    members.value = []
  } finally {
    membersLoading.value = false
  }
}

function formatDate(d: string): string {
  if (!d) return '-'
  return d.substring(0, 19).replace('T', ' ')
}

function openTeamEdit(t: any) {
  teamEditing.value = t
  if (t) {
    teamForm.value = {
      team_name: t.team_name,
      member_name: t.member_name || '',
      leader_name: t.leader_name || '',
      shift_type: t.shift_type || '早班'
    }
  } else {
    teamForm.value = { team_name: '', member_name: '', leader_name: '', shift_type: '早班' }
  }
  teamDialogVisible.value = true
}

async function saveTeam() {
  if (!teamForm.value.team_name) { alert('班组名必填'); return }
  saving.value = true
  try {
    if (teamEditing.value?.id) {
      await adminApi.put(`/teams/${encodeURIComponent(teamEditing.value.team_name)}`, teamForm.value)
    } else {
      await adminApi.post('/teams', teamForm.value)
    }
    teamDialogVisible.value = false
    await loadTeams()
    if (selectedTeam.value) await loadMembers()
  } catch (err: any) {
    alert('保存失败: ' + err.message)
  } finally {
    saving.value = false
  }
}

async function deleteTeam() {
  if (!currentTeam.value) return
  if (members.value.length > 0 || currentTeam.value.user_count > 0) {
    alert('该班组不能删除:\n' + deleteBlockReason.value)
    return
  }
  if (!confirm(`确定要删除班组 [${selectedTeam.value}]?`)) return
  try {
    await adminApi.del(`/teams/${encodeURIComponent(selectedTeam.value)}`)
    selectedTeam.value = ''
    currentTeam.value = null
    members.value = []
    await loadTeams()
  } catch (err: any) {
    alert('删除失败: ' + err.message)
  }
}

function openMemberEdit(m: any) {
  memberEditing.value = m
  if (m) {
    memberForm.value = { member_name: m.member_name, member_type: m.member_type || '值班' }
  } else {
    memberForm.value = { member_name: '', member_type: '值班' }
  }
  memberDialogVisible.value = true
}

async function saveMember() {
  if (!memberForm.value.member_name) { alert('姓名必填'); return }
  saving.value = true
  try {
    if (memberEditing.value?.id) {
      await adminApi.patch(`/teams/members/${memberEditing.value.id}`, memberForm.value)
    } else {
      await adminApi.post(`/teams/${encodeURIComponent(selectedTeam.value)}/members`, memberForm.value)
    }
    memberDialogVisible.value = false
    await loadMembers()
    await loadTeams() // 刷新 member_count
  } catch (err: any) {
    alert('保存失败: ' + err.message)
  } finally {
    saving.value = false
  }
}

async function deleteMember(m: any) {
  if (!confirm(`确定要删除成员 [${m.member_name}]?`)) return
  try {
    await adminApi.del(`/teams/members/${m.id}`)
    await loadMembers()
    await loadTeams()
  } catch (err: any) {
    alert('删除失败: ' + err.message)
  }
}

onMounted(loadTeams)
</script>

<style scoped>
.teams-view { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 20px 24px; min-height: 500px; }
.card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
.card-title { font-size: 17px; font-weight: 600; color: #fff; margin: 0; }

.teams-body { display: flex; gap: 16px; align-items: stretch; min-height: 460px; }
.teams-sidebar { width: 220px; flex-shrink: 0; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.sidebar-header { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); font-size: 13px; color: rgba(255, 255, 255, 0.7); font-weight: 600; }
.add-btn { background: rgba(45, 212, 191, 0.15); color: #2dd4bf; border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 12px; }
.add-btn:hover { background: rgba(45, 212, 191, 0.25); }
.loading { padding: 20px; text-align: center; color: rgba(255, 255, 255, 0.4); font-size: 13px; }
.team-item { padding: 10px 12px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 5px; cursor: pointer; transition: all 0.15s; }
.team-item:hover { background: rgba(45, 212, 191, 0.1); border-color: rgba(45, 212, 191, 0.3); }
.team-item.active { background: rgba(45, 212, 191, 0.18); border-color: #2dd4bf; }
.team-name { font-size: 15px; font-weight: 600; color: #2dd4bf; }
.team-leader { font-size: 12px; color: rgba(255, 255, 255, 0.6); margin-top: 2px; }
.team-counts { margin-top: 6px; }
.badge { display: inline-block; padding: 1px 8px; background: rgba(96, 165, 250, 0.18); color: #93c5fd; border-radius: 3px; font-size: 11px; }
.badge-zero { display: inline-block; padding: 1px 8px; background: rgba(250, 173, 20, 0.18); color: #faad14; border-radius: 3px; font-size: 11px; margin-left: 4px; }

.teams-main { flex: 1; min-width: 0; }
.empty-hint { padding: 80px 20px; text-align: center; color: rgba(255, 255, 255, 0.4); }
.empty-icon { font-size: 48px; display: block; margin-bottom: 12px; }

.team-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
.team-title { font-size: 16px; font-weight: 600; color: #fff; margin: 0 0 4px; }
.team-sub { font-size: 13px; color: rgba(255, 255, 255, 0.6); margin: 0; }
.team-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.dm-btn { padding: 8px 18px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all 0.2s; background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.85); }
.dm-btn:hover { background: rgba(255, 255, 255, 0.1); }
.dm-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.table-wrap { overflow-x: auto; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.08); }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th, .data-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.9); }
.data-table th { background: rgba(45, 212, 191, 0.1); color: #2dd4bf; font-weight: 600; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap; }
.data-table tbody tr:hover { background: rgba(255, 255, 255, 0.04); }
.data-table .empty { text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.4); }
.type-leader { display: inline-block; padding: 2px 8px; background: rgba(250, 173, 20, 0.2); color: #faad14; border-radius: 3px; font-size: 12px; font-weight: 500; }
.type-normal { display: inline-block; padding: 2px 8px; background: rgba(96, 165, 250, 0.18); color: #93c5fd; border-radius: 3px; font-size: 12px; font-weight: 500; }
.op-btn { padding: 3px 10px; margin-right: 4px; background: rgba(45, 212, 191, 0.15); color: #2dd4bf; border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 3px; cursor: pointer; font-size: 12px; }
.op-btn:hover { background: rgba(45, 212, 191, 0.25); }
.op-btn.danger { background: rgba(239, 68, 68, 0.12); color: #fca5a5; border-color: rgba(239, 68, 68, 0.3); }
.op-btn.danger:hover { background: rgba(239, 68, 68, 0.22); }
.table-footer { margin-top: 10px; text-align: right; font-size: 13px; color: rgba(255, 255, 255, 0.55); }

.dialog-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { background: #163a5c; border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 10px; width: 90%; max-width: 480px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); }
.dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
.dialog-title { font-size: 16px; font-weight: 600; color: #fff; }
.dialog-close { background: none; border: none; color: rgba(255, 255, 255, 0.5); font-size: 22px; cursor: pointer; line-height: 1; padding: 0 4px; }
.dialog-body { padding: 20px; }
.dialog-footer { padding: 14px 20px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: flex-end; gap: 8px; }
.form-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.form-label { width: 100px; font-size: 13px; color: rgba(255, 255, 255, 0.75); }
.form-input { flex: 1; padding: 7px 12px; background: rgba(255, 255, 255, 0.06); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; font-size: 13px; outline: none; }
.form-input:focus { border-color: #2dd4bf; }
.form-input:disabled { opacity: 0.5; }
select.form-input { color-scheme: dark; }
select.form-input option { background: #0f2d4a; color: #fff; }
</style>
