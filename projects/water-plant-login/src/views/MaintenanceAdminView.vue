<template>
  <div class="maint-admin-page">
    <TopNavBar />
    
    <!-- 页面标题区 -->
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">保养计划管理</h2>
        <span class="page-desc">制定设备保养计划，分派执行周期和负责人</span>
      </div>
      <div class="header-actions">
        <button class="btn-primary" @click="openCreate">+ 新建保养计划</button>
      </div>
    </div>

    <!-- 计划列表 -->
    <div class="plans-section">
      <div v-if="plans.length === 0" class="empty-state">
        <span class="empty-icon">🔧</span>
        <p>暂无保养计划，点击上方按钮创建</p>
      </div>
      
      <div v-for="plan in plans" :key="plan.id" class="plan-card">
        <div class="plan-header">
          <div class="plan-info">
            <h3 class="plan-name">{{ plan.name }}</h3>
            <div class="plan-meta">
              <span class="meta-tag">👤 {{ plan.executor_role }}</span>
              <span class="meta-tag">🖥️ {{ plan.device_name }}</span>
              <span class="meta-tag">🏷️ {{ plan.device_type }}</span>
              <span class="meta-tag">🔄 {{ cycleCountLabel(plan.cycle_type, plan.cycle_value, plan.cycle_count) }}</span>
              <span v-if="plan.has_third_party == 1" class="meta-tag">🔒 第三方维保</span>
            </div>
          </div>
          <div class="plan-actions">
            <button class="btn-edit" @click="editPlan(plan)">编辑</button>
            <button class="btn-delete" @click="deletePlan(plan.id)">删除</button>
          </div>
        </div>
        
        <div v-if="plan.check_content" class="plan-content">
          <div class="content-label">保养内容：</div>
          <div class="content-items">
            <span v-for="(line, idx) in plan.check_content.split('\n').filter((l: string) => l.trim())" :key="idx" class="content-item">{{ line }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建/编辑弹窗 -->
    <div v-if="showDialog" class="dialog-overlay" @click.self="closeDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h3>{{ editingPlan ? '编辑保养计划' : '新建保养计划' }}</h3>
          <button class="dialog-close" @click="closeDialog">×</button>
        </div>
        
        <div class="dialog-body">
          <!-- 计划名称 -->
          <div class="form-row">
            <label>计划名称 <span class="required">*</span></label>
            <input v-model="form.name" type="text" placeholder="如：月度设备保养" />
          </div>

          <!-- 执行角色 + 执行人 -->
          <div class="form-row-two">
            <div class="form-col">
              <label>执行角色 <span class="required">*</span></label>
              <select v-model="selectedRole" @change="selectedExecutorId = ''">
                <option value="">请选择角色</option>
                <option v-for="role in allRoles" :key="role" :value="role">{{ role }}</option>
              </select>
            </div>
            <div class="form-col">
              <label>选择执行人 <span class="required">*</span></label>
              <select v-model="selectedExecutorId" :disabled="!selectedRole">
                <option value="">请先选择角色</option>
                <option v-for="user in (usersByRole[selectedRole] || [])" :key="user.id" :value="user.id">{{ user.name }}</option>
              </select>
            </div>
          </div>

          <!-- 设备类型 -->
          <div class="form-row">
            <label>设备类型 <span class="required">*</span></label>
            <select v-model="form.device_type">
              <option value="">请选择</option>
              <option value="生成设备">生成设备</option>
              <option value="特种设备">特种设备</option>
            </select>
          </div>

          <!-- 地点+设备选择（可多组） -->
          <div class="form-row">
            <label>选择地点和设备 <span class="required">*</span></label>
            <div class="location-group-list">
              <div v-for="(grp, gIdx) in locationGroups" :key="gIdx" class="location-group">
                <div class="grp-header">
                  <span class="grp-num">地点 {{ gIdx + 1 }}</span>
                  <button v-if="locationGroups.length > 1" class="grp-remove" @click="removeLocationGroup(gIdx)">×</button>
                </div>
                <div class="grp-body">
                  <select v-model="grp.location" @change="onGroupLocationChange(gIdx)" class="grp-location">
                    <option value="">请选择地点</option>
                    <option v-for="loc in availableLocations(gIdx)" :key="loc.id" :value="loc.name">{{ loc.name }}</option>
                  </select>
                  <div v-if="grp.location" class="device-selector">
                    <div class="available-devices">
                      <div 
                        v-for="dev in getDevicesForLocation(grp.location)" 
                        :key="dev.id"
                        class="device-option"
                        :class="{ selected: grp.deviceIds.includes(dev.id) }"
                        @click="toggleGroupDevice(gIdx, dev)"
                      >{{ dev.name }}</div>
                    </div>
                    <div v-if="grp.deviceIds.length > 0" class="selected-count">已选 {{ grp.deviceIds.length }} 台</div>
                  </div>
                </div>
              </div>
            </div>
            <button class="add-location-btn" @click="addLocationGroup">
              <span>+</span> 添加另一地点
            </button>
          </div>

          <!-- 保养内容 -->
          <div class="form-row">
            <label>保养内容（每行一项）</label>
            <textarea 
              v-model="form.check_content" 
              rows="5" 
              placeholder="每行一个保养项，例：
检查轴承润滑情况
更换密封垫圈
检测电机绝缘性能"
            ></textarea>
            <div v-if="form.check_content" class="check-preview">
              <span v-for="(item, i) in form.check_content.split('\n').filter(l => l.trim())" :key="i" class="check-tag">{{ item }}</span>
            </div>
          </div>

          <!-- 保养周期 -->
          <div class="form-row">
            <label>保养周期 <span class="required">*</span></label>
            <div class="cycle-input-row">
              <span>每</span>
              <input v-model.number="form.cycle_value" type="number" min="1" class="cycle-num" />
              <select v-model="form.cycle_type" class="cycle-unit-select">
                <option value="day">天</option>
                <option value="week">周</option>
                <option value="month">月</option>
                <option value="year">年</option>
              </select>
              <span>执行</span>
              <input v-model.number="form.cycle_count" type="number" min="1" class="cycle-num" />
              <span>次</span>
            </div>
          </div>

          <!-- 第三方维保 -->
          <div class="form-row">
            <label>涉及第三方维保</label>
            <div class="radio-options">
              <label class="radio-label">
                <input type="radio" v-model="form.has_third_party" :value="true" /> 是
              </label>
              <label class="radio-label">
                <input type="radio" v-model="form.has_third_party" :value="false" /> 否
              </label>
            </div>
          </div>

          <!-- 第三方厂家名称 -->
          <div v-if="form.has_third_party" class="form-row">
            <label>第三方厂家名称 <span class="required">*</span></label>
            <input v-model="form.third_party_name" type="text" placeholder="请输入第三方维保厂家名称" />
          </div>
        </div>
        
        <div class="dialog-footer">
          <button class="btn-cancel" @click="closeDialog">取消</button>
          <button class="btn-confirm" @click="savePlan">{{ editingPlan ? '保存修改' : '创建计划' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TopNavBar from '../components/TopNavBar.vue'
import { devices as allDevicesStore } from '../composables/useDeviceStore'

const API_BASE = '/api/maintenance'

const plans = ref<any[]>([])
const showDialog = ref(false)
const editingPlan = ref<any>(null)

// 用户/角色
const usersByRole = ref<Record<string, any[]>>({})
const allRoles = ref<string[]>([])
const selectedRole = ref('')
const selectedExecutorId = ref('')

// 设备/地点（使用前端临时数据）
const locations = ref<any[]>([])
const allDevices = ref<any[]>([])
const locationGroups = ref<any[]>([{ location: '', deviceIds: [] }])

function loadDeviceData() {
  allDevices.value = allDevicesStore.value.map((d: any) => ({
    id: d.id,
    name: d.name,
    location: d.location
  }))
  const locMap = new Map<string, number>()
  for (const d of allDevicesStore.value) {
    if (d.location && !locMap.has(d.location)) {
      locMap.set(d.location, locMap.size + 1)
    }
  }
  locations.value = Array.from(locMap.entries()).map(([name, id]) => ({ id, name }))
}

function availableLocations(currentIdx: number) {
  const used = locationGroups.value
    .filter((_: any, i: number) => i !== currentIdx)
    .map((g: any) => g.location)
    .filter(Boolean)
  return locations.value.filter(loc => !used.includes(loc.name))
}

function getDevicesForLocation(locName: string) {
  return allDevices.value.filter(d => d.location === locName)
}

function onGroupLocationChange(gIdx: number) {
  locationGroups.value[gIdx].deviceIds = []
}

function toggleGroupDevice(gIdx: number, dev: any) {
  const ids = locationGroups.value[gIdx].deviceIds
  const idx = ids.indexOf(dev.id)
  if (idx >= 0) ids.splice(idx, 1)
  else ids.push(dev.id)
}

function addLocationGroup() {
  locationGroups.value.push({ location: '', deviceIds: [] })
}

function removeLocationGroup(gIdx: number) {
  locationGroups.value.splice(gIdx, 1)
}


const form = ref({
  name: '',
  device_type: '',
  check_content: '',
  cycle_type: 'month',
  cycle_value: 1,
  cycle_count: 1,
  has_third_party: false,
  third_party_name: ''
})

function cycleCountLabel(type: string, value: number, count: number) {
  const unitMap: Record<string, string> = { day: '天', week: '周', month: '月', year: '年' }
  return `每${value}${unitMap[type] || '月'}，共${count}次`
}



async function loadUsers() {
  try {
    const res = await fetch('/api/users')
    const allUsers = await res.json()
    if (allUsers && allUsers.length > 0) {
      const filtered = allUsers.filter((u: any) => u.role !== '系统管理人')
      const roleMap: Record<string, any[]> = {}
      for (const u of filtered) {
        if (!roleMap[u.role]) roleMap[u.role] = []
        roleMap[u.role].push(u)
      }
      usersByRole.value = roleMap
      allRoles.value = Object.keys(roleMap)
    }
  } catch (err) {
    console.error('加载用户失败', err)
  }
}

async function loadPlans() {
  try {
    const res = await fetch(`${API_BASE}/plans`)
    plans.value = await res.json()
  } catch (err) {
    console.error('加载计划失败', err)
  }
}

function openCreate() {
  editingPlan.value = null
  form.value = { name: '', device_type: '', check_content: '', cycle_type: 'month', cycle_value: 1, cycle_count: 1, has_third_party: false, third_party_name: '' }
  selectedRole.value = ''
  selectedExecutorId.value = ''
  locationGroups.value = [{ location: '', deviceIds: [] }]
  showDialog.value = true
}

function editPlan(plan: any) {
  editingPlan.value = plan
  form.value = {
    name: plan.name || '',
    device_type: plan.device_type || '',
    check_content: plan.check_content || '',
    cycle_type: plan.cycle_type || 'month',
    cycle_value: plan.cycle_value || 1,
    cycle_count: plan.cycle_count || 1,
    has_third_party: plan.has_third_party == 1,
    third_party_name: plan.third_party_name || ''
  }
  selectedRole.value = plan.executor_role || ''
  selectedExecutorId.value = plan.executor_ids ? String(JSON.parse(plan.executor_ids)[0] || '') : ''
  // 从 items 还原地点分组
  if (plan.items && plan.items.length > 0) {
    const locMap = new Map<string, number[]>()
    for (const it of plan.items) {
      if (!locMap.has(it.location)) locMap.set(it.location, [])
      if (it.device_id) locMap.get(it.location)!.push(it.device_id)
    }
    locationGroups.value = Array.from(locMap.entries()).map(([loc, ids]) => ({ location: loc, deviceIds: ids }))
  } else {
    locationGroups.value = [{ location: '', deviceIds: [] }]
  }
  showDialog.value = true
}

function closeDialog() {
  showDialog.value = false
  editingPlan.value = null
}

async function savePlan() {
  const validGroups = locationGroups.value.filter(g => g.location && g.deviceIds.length > 0)
  if (!form.value.name || !selectedRole.value || !selectedExecutorId.value || validGroups.length === 0 || !form.value.device_type) {
    alert('请填写必填项（*标记）')
    return
  }
  
  const allDeviceIds = locationGroups.value.flatMap(g => g.deviceIds)
  const selectedDevs = allDevices.value.filter(d => allDeviceIds.includes(d.id))
  const items = locationGroups.value
    .filter(g => g.location && g.deviceIds.length > 0)
    .flatMap(g => {
      const devs = allDevices.value.filter(d => g.deviceIds.includes(d.id))
      return devs.map(dev => ({
        device_id: dev.id,
        device_name: dev.name,
        location: dev.location,
        check_content: ''
      }))
    })
  
  const payload = {
    name: form.value.name,
    executor_role: selectedRole.value,
    executor_ids: JSON.stringify([Number(selectedExecutorId.value)]),
    device_name: selectedDevs.map(d => d.name).join('、'),
    device_type: form.value.device_type,
    check_content: form.value.check_content,
    cycle_type: form.value.cycle_type,
    cycle_value: form.value.cycle_value,
    cycle_count: form.value.cycle_count,
    has_third_party: form.value.has_third_party,
    third_party_name: form.value.has_third_party ? form.value.third_party_name : '',
    items
  }
  
  try {
    if (editingPlan.value) {
      await fetch(`${API_BASE}/plans/${editingPlan.value.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } else {
      await fetch(`${API_BASE}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    }
    await loadPlans()
    closeDialog()
  } catch (err) {
    console.error('保存失败', err)
    alert('保存失败')
  }
}

async function deletePlan(id: number) {
  if (!confirm('确认删除该保养计划？')) return
  try {
    await fetch(`${API_BASE}/plans/${id}`, { method: 'DELETE' })
    await loadPlans()
  } catch (err) {
    console.error('删除失败', err)
  }
}

onMounted(() => {
  loadUsers()
  loadPlans()
  loadDeviceData()
})
</script>

<style scoped>
.maint-admin-page {
  min-height: 100vh;
  background: #0f2d4a;
  padding: 0 0 40px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px 20px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  color: #fff;
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  letter-spacing: 1px;
}

.page-desc {
  color: rgba(255, 255, 255, 0.45);
  font-size: 13px;
}

.btn-primary {
  background: rgba(45, 212, 191, 0.15);
  border: 1px solid rgba(45, 212, 191, 0.4);
  color: #2DD4BF;
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: rgba(45, 212, 191, 0.25);
}

.plans-section {
  padding: 0 32px;
}

.empty-state {
  text-align: center;
  padding: 60px 0;
  color: rgba(255, 255, 255, 0.4);
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.plan-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(45, 212, 191, 0.15);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 16px;
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.plan-name {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
}

.plan-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.meta-tag {
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  background: rgba(255, 255, 255, 0.06);
  padding: 3px 10px;
  border-radius: 12px;
}

.plan-actions {
  display: flex;
  gap: 8px;
}

.btn-edit, .btn-delete {
  background: none;
  border: 1px solid;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.btn-edit {
  border-color: rgba(45, 212, 191, 0.4);
  color: #2DD4BF;
}

.btn-delete {
  border-color: rgba(239, 68, 68, 0.4);
  color: #FCA5A5;
}

.plan-content {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 10px;
}

.content-label {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  margin-bottom: 8px;
}

.content-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.content-item {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  background: rgba(255, 255, 255, 0.05);
  padding: 3px 10px;
  border-radius: 4px;
}

/* 弹窗 */
.dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #0f3248;
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 12px;
  width: 680px;
  max-height: 85vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(45, 212, 191, 0.1);
}

.dialog-header h3 {
  color: #fff;
  font-size: 18px;
  margin: 0;
}

.dialog-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 22px;
  cursor: pointer;
}

.dialog-body {
  padding: 24px;
}

.form-row {
  margin-bottom: 20px;
}

.form-row label {
  display: block;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  margin-bottom: 8px;
}

.required {
  color: #F97316;
  margin-left: 2px;
}

.form-row input,
.form-row select,
.form-row textarea {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 10px 12px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-row textarea {
  resize: vertical;
  min-height: 80px;
}

.form-row-two {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.form-col {
  flex: 1;
}

.form-col label {
  display: block;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  margin-bottom: 8px;
}

.form-col select,
.form-col input {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 10px 12px;
  font-size: 14px;
  box-sizing: border-box;
}

.check-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.check-tag {
  font-size: 11px;
  background: rgba(45, 212, 191, 0.1);
  color: #2DD4BF;
  padding: 2px 8px;
  border-radius: 4px;
}

.cycle-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.cycle-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(45, 212, 191, 0.2);
  color: rgba(255, 255, 255, 0.6);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.cycle-btn.active {
  background: rgba(45, 212, 191, 0.15);
  border-color: #2DD4BF;
  color: #2DD4BF;
}

.cycle-value-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.cycle-num {
  width: 70px !important;
  text-align: center;
}

.radio-options {
  display: flex;
  gap: 20px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 14px;
  cursor: pointer;
}

.radio-label input[type="radio"] {
  accent-color: #2DD4BF;
  width: 16px;
  height: 16px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgba(45, 212, 191, 0.1);
}

.btn-cancel {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.6);
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.btn-confirm {
  background: rgba(45, 212, 191, 0.15);
  border: 1px solid rgba(45, 212, 191, 0.4);
  color: #2DD4BF;
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.btn-confirm:hover {
  background: rgba(45, 212, 191, 0.25);
}

.cycle-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.65);
  font-size: 14px;
}

.cycle-unit-select {
  width: 110px !important;
}

.device-selector {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 8px;
  padding: 12px;
}

.available-devices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.device-option {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid rgba(45, 212, 191, 0.2);
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.04);
  transition: all 0.2s;
}

.device-option:hover {
  border-color: rgba(45, 212, 191, 0.5);
  color: #2DD4BF;
}

.device-option.selected {
  background: rgba(45, 212, 191, 0.15);
  border-color: #2DD4BF;
  color: #2DD4BF;
}

.selected-count {
  margin-top: 10px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.location-group-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.location-group {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(45, 212, 191, 0.15);
  border-radius: 8px;
  padding: 14px;
}

.grp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.grp-num {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.grp-remove {
  background: none;
  border: none;
  color: rgba(255, 100, 100, 0.6);
  font-size: 18px;
  cursor: pointer;
}

.grp-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.grp-location {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #fff;
  padding: 8px 12px;
  font-size: 14px;
  box-sizing: border-box;
}

.add-location-btn {
  margin-top: 10px;
  background: none;
  border: 1px dashed rgba(45, 212, 191, 0.3);
  color: rgba(45, 212, 191, 0.7);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  width: 100%;
  transition: all 0.2s;
}

.add-location-btn:hover {
  border-color: #2DD4BF;
  color: #2DD4BF;
}
</style>