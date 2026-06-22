<template>
  <div class="device-page">
    <TopNavBar />
    <div class="detail-manage">
      <!-- 返回按钮 -->
      <div class="detail-back">
        <button class="back-btn" @click="router.back()">← 返回</button>
      </div>

      <!-- 设备详情面板 (复用 DeviceDetailPanel, 传 showActions=false 隐藏编辑/删除按钮) -->
      <div v-if="device" class="detail-card">
        <DeviceDetailPanel
          :device="device"
          :show-actions="false"
          :show-close="false"
          @close="router.back()"
        />
      </div>

      <!-- 未找到设备 -->
      <div v-else class="detail-empty">
        <p>未找到该设备信息</p>
        <button class="back-btn" @click="router.back()">返回</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TopNavBar from '../components/TopNavBar.vue'
import DeviceDetailPanel from '../components/DeviceDetailPanel.vue'
import { deviceListWithStatus, loadDevicesFromDB } from '../composables/useDeviceStore'
import { loadAllWorkOrders } from '../composables/useWorkOrderStore'
import { authHeader } from '../composables/useDeviceStore'

const route = useRoute()
const router = useRouter()

// 设备 ID 类型兼容: 后端 /api/devices 返回 number, 路由 params 是 string
const device = computed(() => {
  const id = route.params.id
  return deviceListWithStatus.value.find((d: any) => String(d.id) === String(id))
})

// 加载设备 + 同步全量工单到 store (供 DeviceDetailPanel 显示关联工单)
onMounted(async () => {
  await loadDevicesFromDB()
  await loadAllWorkOrders(authHeader())
})
</script>

<style scoped>
.device-page {
  position: relative;
  min-height: 100vh;
  background: #0f2d4a;
}

.detail-manage {
  padding: 0 24px 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.detail-back {
  padding: 12px 0;
}

.back-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.detail-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(45, 212, 191, 0.2);
  border-radius: 12px;
  overflow: hidden;
}

.detail-empty {
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.6);
}

.detail-empty p {
  margin-bottom: 16px;
}
</style>
