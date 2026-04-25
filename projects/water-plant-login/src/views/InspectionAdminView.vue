<template>
  <div class="ins-admin-page">
    <TopNavBar />
    
    <!-- 页面标题区 -->
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">巡检计划管理</h2>
        <span class="page-desc">制定巡检任务，分派执行周期和负责人</span>
      </div>
      <div class="header-actions">
        <button class="btn-primary" @click="showCreateDialog = true">+ 新建巡检计划</button>
      </div>
    </div>

    <!-- 计划列表 -->
    <div class="plans-section">
      <div v-if="plans.length === 0" class="empty-state">
        <span class="empty-icon">📋</span>
        <p>暂无巡检计划，点击上方按钮创建</p>
      </div>
      
      <div v-for="plan in plans" :key="plan.id" class="plan-card">
        <div class="plan-header">
          <div class="plan-info">
            <h3 class="plan-name">{{ plan.name }}</h3>
            <div class="plan-meta">
              <span class="meta-tag">📍 {{ plan.location }}</span>
              <span class="meta-tag">🔄 {{ cycleLabel(plan.cycle) }}</span>
              <span class="meta-tag">👤 {{ plan.executor_role }}</span>
            </div>
          </div>
          <div class="plan-actions">
            <button class="btn-edit" @click="editPlan(plan)">编辑</button>
            <button class="btn-delete" @click="deletePlan(plan.id)">删除</button>
          </div>
        </div>
        
        <div class="plan-devices">
          <div class="devices-label">巡检设备：</div>
          <div class="device-list">
            <div v-for="item in plan.items" :key="item.id" class="device-chip">
              <span class="chip-name">{{ item.device_name }}</span>
              <div class="chip-items">
                <span v-for="(check, idx) in item.check_content.split('\n')" :key="idx" class="check-item">{{ check }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建/编辑弹窗 -->
    <div v-if="showCreateDialog || editingPlan" class="dialog-overlay" @click.self="closeDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h3>{{ editingPlan ? '编辑巡检计划' : '新建巡检计划' }}</h3>
          <button class="dialog-close" @click="closeDialog">×</button>
        </div>
        
        <div class="dialog-body">
          <!-- 计划名称 -->
          <div class="form-row">
            <label>计划名称</label>
            <input v-model="form.name" type="text" placeholder="如：每日设备巡检" />
          </div>
          
          <!-- 执行周期 -->
          <div class="form-row">
            <label>执行周期</label>
            <div class="cycle-options">
              <button 
                v-for="opt in cycleOptions" 
                :key="opt.value"
                class="cycle-btn"
                :class="{ active: form.cycle === opt.value }"
                @click="form.cycle = opt.value"
              >{{ opt.label }}</button>
            </div>
          </div>
          
          <!-- 执行角色 -->
          <div class="form-row">
            <label>执行角色</label>
            <select v-model="form.executor_role">
              <option value="">请选择</option>
              <option value="值班岗位">值班岗位</option>
              <option value="带班">带班</option>
            </select>
          </div>
          
          <!-- 选择地点 -->
          <div class="form-row">
            <label>选择地点</label>
            <select v-model="form.location" @change="onLocationChange">
              <option value="">请选择地点</option>
              <option v-for="loc in locations" :key="loc.id" :value="loc.name">{{ loc.name }}</option>
            </select>
          </div>
          
          <!-- 选择设备 -->
          <div class="form-row">
            <label>选择设备</label>
            <div class="device-selector">
              <div class="available-devices">
                <div 
                  v-for="dev in availableDevices" 
                  :key="dev.id"
                  class="device-option"
                  :class="{ selected: selectedDeviceIds.includes(dev.id) }"
                  @click="toggleDevice(dev)"
                >{{ dev.name }}</div>
              </div>
              <div v-if="selectedDeviceIds.length > 0" class="selected-count">已选 {{ selectedDeviceIds.length }} 台设备</div>
            </div>
          </div>
          
          <!-- 设备巡检项配置 -->
          <div v-for="dev in selectedDevices" :key="dev.id" class="device-check-config">
            <div class="config-header">
              <span class="config-device">🖥️ {{ dev.name }}</span>
              <span class="config-location">📍 {{ dev.location }}</span>
            </div>
            <div class="config-items">
              <label>巡检内容（每行一项）：</label>
              <textarea 
                v-model="deviceCheckItems[dev.id]" 
                placeholder="输入检查项，每行一个，例如：
检查轴承温度
检查振动声音
检查密封性"
                rows="5"
              ></textarea>
            </div>
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
import { ref, computed, onMounted } from 'vue'
import TopNavBar from '../components/TopNavBar.vue'

const API_BASE = 'http://localhost:3000/api/inspection'

const locations = ref<any[]>([])
const plans = ref<any[]>([])
const showCreateDialog = ref(false)
const editingPlan = ref<any>(null)

const availableDevices = ref<any[]>([])
const selectedDeviceIds = ref<number[]>([])

const deviceCheckItems = ref<Record<number, string>>({})

const form = ref({
  name: '',
  location: '',
  cycle: 'daily',
  executor_role: ''
})

const cycleOptions = [
  { value: 'hourly', label: '每小时' },
  { value: 'two_hour', label: '每2小时' },
  { value: 'eight_hour', label: '每8小时' },
  { value: 'weekly', label: '每周一次' }
]

const selectedDevices = computed(() => 
  availableDevices.value.filter(d => selectedDeviceIds.value.includes(d.id))
)

function cycleLabel(cycle: string) {
  return cycleOptions.find(c => c.value === cycle)?.label || cycle
}

async function loadLocations() {
  try {
    const res = await fetch(`${API_BASE}/locations`)
    locations.value = await res.json()
  } catch (err) {
    console.error('加载地点失败', err)
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

async function loadDevices() {
  try {
    const res = await fetch('http://localhost:3000/api/devices')
    availableDevices.value = await res.json()
  } catch (err) {
    console.error('加载设备失败', err)
  }
}

function onLocationChange() {
  selectedDeviceIds.value = []
  deviceCheckItems.value = {}
}

function toggleDevice(device: any) {
  const idx = selectedDeviceIds.value.indexOf(device.id)
  if (idx >= 0) {
    selectedDeviceIds.value.splice(idx, 1)
    delete deviceCheckItems.value[device.id]
  } else {
    selectedDeviceIds.value.push(device.id)
    deviceCheckItems.value[device.id] = deviceCheckItems.value[device.id] || ''
  }
}

function editPlan(plan: any) {
  editingPlan.value = plan
  form.value = {
    name: plan.name,
    location: plan.location,
    cycle: plan.cycle,
    executor_role: plan.executor_role
  }
  selectedDeviceIds.value = []
  deviceCheckItems.value = {}
  // 解析 device_ids
  if (plan.device_ids) {
    try {
      const ids = JSON.parse(plan.device_ids)
      selectedDeviceIds.value = ids
    } catch {}
  }
  // 填充巡检项
  for (const item of plan.items) {
    deviceCheckItems.value[item.device_id] = item.check_content || ''
  }
}

function closeDialog() {
  showCreateDialog.value = false
  editingPlan.value = null
  form.value = { name: '', location: '', cycle: 'daily', executor_role: '' }
  selectedDeviceIds.value = []
  deviceCheckItems.value = {}
}

async function savePlan() {
  if (!form.value.name || !form.value.location || !form.value.executor_role || selectedDeviceIds.value.length === 0) {
    alert('请填写完整信息')
    return
  }
  
  const items = selectedDevices.value.map(dev => ({
    device_id: dev.id,
    device_name: dev.name,
    check_content: deviceCheckItems.value[dev.id] || ''
  }))
  
  const payload = {
    name: form.value.name,
    location: form.value.location,
    cycle: form.value.cycle,
    executor_role: form.value.executor_role,
    device_ids: selectedDeviceIds.value,
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
  if (!confirm('确认删除该巡检计划？')) return
  try {
    await fetch(`${API_BASE}/plans/${id}`, { method: 'DELETE' })
    await loadPlans()
  } catch (err) {
    console.error('删除失败', err)
  }
}

onMounted(() => {
  loadLocations()
  loadPlans()
  loadDevices()
})
</script>

<style scoped>
.ins-admin-page {
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
  margin-bottom: 16px;
}

.plan-name {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
}

.plan-meta {
  display: flex;
  gap: 12px;
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

.plan-devices {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 12px;
}

.devices-label {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  margin-bottom: 10px;
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.device-chip {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  padding: 10px 14px;
}

.chip-name {
  color: #2DD4BF;
  font-size: 13px;
  font-weight: 500;
  display: block;
  margin-bottom: 6px;
}

.chip-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.check-item {
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 8px;
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
  width: 700px;
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

.cycle-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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

.device-selector {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(45, 212, 191, 0.15);
  border-radius: 8px;
  padding: 12px;
}

.available-devices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.device-option {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.device-option.selected {
  background: rgba(45, 212, 191, 0.15);
  border-color: #2DD4BF;
  color: #2DD4BF;
}

.selected-count {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.device-check-config {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(45, 212, 191, 0.1);
  border-radius: 8px;
  padding: 14px;
  margin-top: 12px;
}

.config-header {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
}

.config-device {
  color: #2DD4BF;
  font-size: 14px;
  font-weight: 500;
}

.config-location {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.config-items label {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  margin-bottom: 6px;
  display: block;
}

.config-items textarea {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 6px;
  color: #fff;
  padding: 8px 10px;
  font-size: 13px;
  resize: vertical;
  box-sizing: border-box;
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
</style>