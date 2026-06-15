<template>
  <div class="history-detail-component">
    <div v-if="loading" class="hd-loading">正在加载事务详情...</div>
    <div v-else-if="detail">
      <!-- 值班纪事 -->
      <div v-if="detail.notes" class="hd-section">
        <div class="hd-label">📝 值班纪事</div>
        <div class="hd-notes">{{ detail.notes }}</div>
      </div>
      <!-- 巡检统计 -->
      <div class="hd-stats">
        <span class="hd-label">🔍 巡检: </span>
        <span :class="detail.tasks.done >= detail.tasks.total && detail.tasks.total > 0 ? 'text-green' : 'text-orange'">
          {{ detail.tasks.done }}/{{ detail.tasks.total }} 完成
          <span v-if="detail.tasks.abnormal > 0" class="hd-abnormal-num"> · {{ detail.tasks.abnormal }}异常</span>
        </span>
      </div>
      <!-- 巡检项列表 -->
      <div v-if="detail.tasks.allList && detail.tasks.allList.length > 0" class="hd-task-list">
        <div v-for="(item, idx) in detail.tasks.allList" :key="'t-'+idx" class="hd-task-item">
          <span class="hd-task-icon">{{ item.has_abnormal ? '🚨' : (item.status === 'completed' || item.status === 'abnormal' ? '✅' : '⬜') }}</span>
          <span :class="item.has_abnormal ? 'hd-task-name-abnormal' : 'hd-task-name'">{{ item.device_name }}</span>
          <span class="hd-task-meta">{{ item.plan_name }}<span v-if="item.abnormal_desc"> · {{ item.abnormal_desc }}</span></span>
        </div>
      </div>
      <div v-else class="hd-empty">暂无巡检任务</div>
      <!-- 工单统计 -->
      <div class="hd-stats" style="margin-top:10px;">
        <span class="hd-label">📋 工单: </span>
        <span class="hd-wo-new">新建{{ detail.workorders.created.length }}</span>
        <span class="hd-sep"> / </span>
        <span class="hd-wo-done">完成{{ detail.workorders.completed.length }}</span>
        <span class="hd-sep"> / </span>
        <span :class="detail.workorders.inProgress.length > 0 ? 'text-orange' : 'text-gray'">进行中{{ detail.workorders.inProgress.length }}</span>
      </div>
      <!-- 工单列表 (已完成) -->
      <div v-if="detail.workorders.completed.length > 0" class="hd-wo-block hd-wo-block-done">
        <div class="hd-wo-block-title">✓ 已完成</div>
        <div v-for="wo in detail.workorders.completed" :key="'hd-'+wo.id" class="hd-wo-item" style="opacity:0.6;">
          <span :class="wo.type && wo.type.includes('问题') ? 'hd-wo-tag-problem' : 'hd-wo-tag-maintenance'">{{ wo.type && wo.type.includes('问题') ? '问题' : '维修' }}</span>
          <span class="hd-wo-content-done">{{ wo.content }}</span>
        </div>
      </div>
      <!-- 工单列表 (进行中) -->
      <div v-if="detail.workorders.inProgress.length > 0" class="hd-wo-block hd-wo-block-progress">
        <div class="hd-wo-block-title">⏳ 进行中</div>
        <div v-for="wo in detail.workorders.inProgress" :key="'hp-'+wo.id" class="hd-wo-item">
          <span :class="wo.type && wo.type.includes('问题') ? 'hd-wo-tag-problem' : 'hd-wo-tag-maintenance'">{{ wo.type && wo.type.includes('问题') ? '问题' : '维修' }}</span>
          <span class="hd-wo-content-active">{{ wo.content }}</span>
        </div>
      </div>
      <div v-if="detail.workorders.created.length === 0" class="hd-empty">暂无工单</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  detail: any
  loading?: boolean
}>()
</script>

<style scoped>
.history-detail-component {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}
.hd-loading {
  color: rgba(255, 255, 255, 0.45);
  font-style: italic;
  padding: 8px 0;
  font-size: 14px;
}
.hd-section {
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.05);
  padding: 10px 12px;
  border-radius: 4px;
  border-left: 3px solid rgba(45, 212, 191, 0.4);
}
.hd-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 6px;
  font-weight: 600;
}
.hd-notes {
  white-space: pre-wrap;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.95);
  font-size: 15px;
}
.hd-stats {
  margin-bottom: 8px;
  padding: 4px 0;
  font-size: 14px;
}
.hd-abnormal-num {
  color: #e53935;
  font-weight: 600;
}
.hd-task-list {
  margin: 8px 0 12px;
  padding: 8px 12px 8px 14px;
  background: rgba(45, 212, 191, 0.05);
  border-left: 2px solid rgba(45, 212, 191, 0.3);
  border-radius: 0 4px 4px 0;
}
.hd-task-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  font-size: 14px;
}
.hd-task-icon {
  flex-shrink: 0;
  width: 20px;
  text-align: center;
  font-size: 14px;
}
.hd-task-name {
  color: rgba(255, 255, 255, 0.95);
  font-size: 14px;
}
.hd-task-name-abnormal {
  color: #e53935;
  font-weight: 600;
  font-size: 14px;
}
.hd-task-meta {
  color: rgba(255, 255, 255, 0.55);
  font-size: 13px;
}
.hd-wo-new { color: #60a5fa; font-size: 14px; }
.hd-wo-done { color: #4ade80; font-size: 14px; }
.hd-sep { color: rgba(255, 255, 255, 0.4); margin: 0 3px; font-size: 14px; }
.hd-wo-block {
  margin: 8px 0 10px;
  padding: 8px 12px 8px 14px;
  border-radius: 0 4px 4px 0;
}
.hd-wo-block-done {
  background: rgba(74, 222, 128, 0.06);
  border-left: 2px solid rgba(74, 222, 128, 0.4);
}
.hd-wo-block-progress {
  background: rgba(245, 158, 11, 0.06);
  border-left: 2px solid rgba(245, 158, 11, 0.4);
}
.hd-wo-block-title {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 6px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.hd-wo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  font-size: 14px;
}
.hd-wo-tag-problem {
  background: rgba(251, 146, 60, 0.2);
  color: #fb923c;
  padding: 2px 8px;
  border-radius: 2px;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
}
.hd-wo-tag-maintenance {
  background: rgba(96, 165, 250, 0.2);
  color: #60a5fa;
  padding: 2px 8px;
  border-radius: 2px;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
}
.hd-wo-content-done {
  text-decoration: line-through;
  color: rgba(255, 255, 255, 0.5);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
}
.hd-wo-content-active {
  color: #e53935;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
}
.hd-empty {
  color: rgba(255, 255, 255, 0.45);
  font-style: italic;
  font-size: 14px;
  padding: 6px 0;
}
</style>
