<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  modelValue: string
  type?: string
  placeholder?: string
  error?: string
  icon?: 'user' | 'lock' | 'verify'
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  error: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const focused = ref(false)
const showPassword = ref(false)

const inputType = computed(() => {
  if (props.type === 'password' && showPassword.value) return 'text'
  return props.type
})

const onInput = (e: Event) => {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="water-input" :class="{ focused, error: !!error, 'has-value': modelValue }">
    <!-- Input field -->
    <input
      :type="inputType"
      :value="modelValue"
      :placeholder="placeholder"
      @input="onInput"
      @focus="focused = true"
      @blur="focused = false"
      class="input"
    />

    <!-- Icons -->
    <div class="input-icons">
      <!-- User icon -->
      <svg v-if="icon === 'user'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
      </svg>

      <!-- Lock icon -->
      <svg v-if="icon === 'lock'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 018 0v4" />
        <circle cx="12" cy="16" r="1" fill="currentColor" />
      </svg>

      <!-- Verify code icon -->
      <svg v-if="icon === 'verify'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 10l3 2-3 2M13 14h4" />
      </svg>
    </div>

    <!-- Ripple effect -->
    <div class="ripple" :class="{ active: focused }"></div>

    <!-- Error message -->
    <Transition name="error">
      <div v-if="error" class="error-msg">{{ error }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.water-input {
  position: relative;
  margin-bottom: 20px;
}

.input {
  width: 100%;
  height: 52px;
  padding: 0 48px 0 48px;
  font-size: 16px;
  font-family: inherit;
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  outline: none;
  transition: all var(--transition-base);
}

.input::placeholder {
  color: var(--color-text-secondary);
  opacity: 0.7;
}

.input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(30, 107, 184, 0.15);
  background: #fff;
}

/* Ripple effect */
.ripple {
  position: absolute;
  top: 50%;
  left: 24px;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  background: var(--color-primary);
  border-radius: 50%;
  opacity: 0;
  transition: all var(--transition-fast);
  pointer-events: none;
}

.focused .ripple {
  opacity: 1;
  animation: ripple 0.6s ease-out;
}

@keyframes ripple {
  0% {
    width: 6px;
    height: 6px;
    opacity: 1;
  }
  100% {
    width: 200px;
    height: 200px;
    opacity: 0;
  }
}

/* Icons */
.input-icons {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  transition: color var(--transition-fast);
}

.focused .input-icons {
  color: var(--color-primary);
}

.icon {
  width: 20px;
  height: 20px;
}

/* Error state */
.error .input {
  border-color: var(--color-error);
  animation: shake 0.4s ease-out;
}

.error-msg {
  position: absolute;
  bottom: -22px;
  left: 0;
  font-size: 12px;
  color: var(--color-error);
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}

.error-enter-active,
.error-leave-active {
  transition: all 0.2s ease;
}

.error-enter-from,
.error-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
