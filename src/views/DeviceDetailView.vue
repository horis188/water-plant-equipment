<template>
  <div class="device-page">
    <TopNavBar />
    <div class="detail-manage">
      <!-- 返回按钮 -->
      <div class="detail-back">
        <button class="back-btn" @click="router.push('/device/inuse')">← 返回设备列表</button>
      </div>

      <!-- 设备基本信息卡片 -->
      <div v-if="device" class="detail-card">
        <div class="detail-header">
          <h2>{{ device.name }}</h2>
          <span class="status-badge" :class="`status-${device.status}`">{{ device.status }}</span>
        </div>

        <div class="detail-body">
          <!-- 基本信息 -->
          <div class="info-section">
            <h3 class="section-title">基本信息</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">设备编号</span>
                <span class="info-value">{{ device.id }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">设备名称</span>
                <span class="info-value">{{ device.name }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">设备类型</span>
                <span class="info-value">{{ device.type }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">型号</span>
                <span class="info-value">{{ device.model }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">厂家</span>
                <span class="info-value">{{ device.vendor }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">安装地点</span>
                <span class="info-value">{{ device.location }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">价值金额</span>
                <span class="info-value">{{ device.value?.toLocaleString() ?? '-' }} 元</span>
              </div>
              <div class="info-item">
                <span class="info-label">备注</span>
                <span class="info-value">{{ device.remark || '无' }}</span>
              </div>
            </div>
          </div>

          <!-- 技术参数 -->
          <div class="info-section">
            <h3 class="section-title">技术参数</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">额定电压</span>
                <span class="info-value">{{ device.params?.voltage ?? '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">功率</span>
                <span class="info-value">{{ device.params?.power ?? '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">额定电流</span>
                <span class="info-value">{{ device.params?.current ?? '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">管径</span>
                <span class="info-value">{{ device.params?.pipeDiameter ?? '-' }}</span>
              </div>
            </div>
          </div>

          <!-- 文档信息 -->
          <div class="info-section">
            <h3 class="section-title">技术文档</h3>
            <div v-if="device.doc" class="doc-item">
              <span class="doc-name">📄 {{ device.doc }}</span>
              <button class="doc-download-btn" @click="downloadDoc">下载</button>
            </div>
            <div v-else class="doc-none">暂无技术文档</div>
          </div>
        </div>
      </div>

      <!-- 未找到设备 -->
      <div v-else class="detail-empty">
        <p>未找到该设备信息</p>
        <button class="back-btn" @click="router.push('/device/inuse')">返回设备列表</button>
      </div>
    </div>
  </div>
</template>


<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TopNavBar from '../components/TopNavBar.vue'
import { deviceListWithStatus } from '../composables/useDeviceStore'

const route = useRoute()
const router = useRouter()

const device = computed(() => {
  return deviceListWithStatus.value.find((d: any) => d.id === route.params.id)
})

function downloadDoc() {
  if (device.value?.doc) {
    const blob = new Blob([`技术文档: ${device.value.name}\n型号: ${device.value.model}\n\n（此为模拟文件）`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = device.value.doc
    a.click()
    URL.revokeObjectURL(url)
  }
}
</script>

<style scoped>
.device-page {
  position: relative;
  min-height: 100vh;
  background: #0f2d4a;
}

.detail-manage {
  padding: 0 24px 24px;
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

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(45, 212, 191, 0.08);
  border-bottom: 1px solid rgba(45, 212, 191, 0.12);
}

.detail-header h2 {
  color: #fff;
  font-size: 18px;
  margin: 0;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-在用 { background: rgba(45, 212, 191, 0.2); color: #2DD4BF; }
.status-维修中 { background: rgba(59, 130, 246, 0.2); color: #60A5FA; }
.status-告警 { background: rgba(239, 68, 68, 0.2); color: #EF4444; }

.detail-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(45, 212, 191, 0.1);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px 24px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
}

.info-value {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
}

.doc-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(45, 212, 191, 0.08);
  border: 1px solid rgba(45, 212, 191, 0.15);
  border-radius: 8px;
}

.doc-name {
  color: #2DD4BF;
  font-size: 13px;
}

.doc-download-btn {
  background: rgba(45, 212, 191, 0.15);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: 6px;
  color: #2DD4BF;
  font-size: 12px;
  padding: 4px 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.doc-download-btn:hover {
  background: rgba(45, 212, 191, 0.25);
}

.doc-none {
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
}

.detail-empty {
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.4);
}

.detail-empty p {
  margin-bottom: 16px;
}
</style>
