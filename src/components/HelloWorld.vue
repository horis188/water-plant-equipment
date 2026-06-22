<script setup lang="ts">
import { ref } from 'vue'
/**
 * HelloWorld 组件
 * 一个简单的问候展示组件
 */

/** 组件 Props 接口 */
interface Props {
  /** 问候标题 */
  title?: string;
  /** 问候消息 */
  message?: string;
}

/** 带默认值的 Props */
const props = withDefaults(defineProps<Props>(), {
  title: 'Hello World',
  message: '欢迎使用 Vue 3 + TypeScript 项目！',
});

/** 点击计数器 */
const count = ref<number>(0);

/** 增加计数 */
function increment(): void {
  count.value++;
}
</script>

<template>
  <div class="hello-world">
    <h1 class="hello-world__title">{{ props.title }}</h1>
    <p class="hello-world__message">{{ props.message }}</p>
    <div class="hello-world__counter">
      <span class="hello-world__count">点击次数: {{ count }}</span>
      <button class="hello-world__button" @click="increment">
        点击我
      </button>
    </div>
  </div>
</template>

<style scoped>
.hello-world {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md, 16px);
  padding: var(--spacing-lg, 24px);
  border-radius: var(--border-radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.hello-world__title {
  margin: 0;
  font-size: 2rem;
  color: var(--color-primary, #42b883);
}

.hello-world__message {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text-secondary, #666666);
}

.hello-world__counter {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 12px);
}

.hello-world__count {
  font-size: 0.875rem;
  color: var(--color-text, #333333);
}

.hello-world__button {
  padding: var(--spacing-xs, 8px) var(--spacing-md, 16px);
  border: none;
  border-radius: var(--border-radius-sm, 4px);
  background-color: var(--color-primary, #42b883);
  color: #ffffff;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.hello-world__button:hover {
  background-color: var(--color-primary-dark, #369870);
}
</style>
