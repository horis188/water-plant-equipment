<template>
  <div class="placeholder">
    <div class="ph-icon">🚧</div>
    <h3>{{ title }}</h3>
    <p>{{ desc }}</p>
    <span class="ph-badge">下一阶段开发</span>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const title = computed(() => route.meta?.title || '系统管理')
const desc = computed(() => route.meta?.desc || '此功能正在规划中, 将在后续迭代中实现')
</script>

<style scoped>
.placeholder {
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(45, 212, 191, 0.3);
  border-radius: 8px;
  padding: 80px 32px;
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
}
.ph-icon { font-size: 64px; margin-bottom: 16px; }
.placeholder h3 { font-size: 18px; color: #fff; margin: 0 0 8px; }
.placeholder p { font-size: 14px; margin: 0 0 16px; }
.ph-badge {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(250, 173, 20, 0.15);
  color: #faad14;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 500;
}
</style>
