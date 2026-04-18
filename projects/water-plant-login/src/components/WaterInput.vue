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
    <!-- Animated border -->
    <div class="input-border"></div>

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
      <svg v-if="icon === 'lock'" class="icon icon-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

    <!-- Password visibility toggle -->
    <button
      v-if="type === 'password'"
      type="button"
      class="visibility-toggle"
      @click="showPassword = !showPassword"
      tabindex="-1"
    >
      <svg v-if="!showPassword" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <svg v-else class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    </button>

    <!-- Ripple effect -->
    <div class="ripple" :class="{ active: focused }"></div>

    <!-- Glow effect on focus -->
    <div class="glow-effect"></div>

    <!-- Error message -->
    <Transition name="error">
      <div v-if="error" class="error-msg">
        <svg class="error-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        {{ error }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.water-input {
  position: relative;
  margin-bottom: 24px;
}

.input-border {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: var(--radius-md);
  pointer-events: none;
  overflow: hidden;
}

.input-border::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: border-color var(--transition-base);
}

.focused .input-border::before {
  border-color: var(--color-primary);
  box-shadow: inset 0 0 0 1px var(--color-primary);
}

.error .input-border::before {
  border-color: var(--color-error);
}

/* Animated corner decoration */
.input-border::after {
  content: '';
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
  opacity: 0;
  transform: scale(0);
  transition: all var(--transition-fast);
}

.focused .input-border::after {
  opacity: 1;
  transform: scale(1);
  animation: cornerPulse 1.5s ease-in-out infinite;
}

@keyframes cornerPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.5; }
}

.input {
  width: 100%;
  height: 52px;
  padding: 0 48px 0 48px;
  font-size: 16px;
  font-family: inherit;
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.95);
  border: none;
  border-radius: var(--radius-md);
  outline: none;
  transition: all var(--transition-base);
}

.input::placeholder {
  color: var(--color-text-secondary);
  opacity: 0.6;
}

.input:focus {
  background: #fff;
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
  transition: all var(--transition-fast);
}

.focused .input-icons {
  color: var(--color-primary);
  transform: translateY(-50%) scale(1.1);
}

.icon {
  width: 20px;
  height: 20px;
  transition: transform var(--transition-fast);
}

/* Password visibility toggle */
.visibility-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: color var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.visibility-toggle:hover {
  color: var(--color-primary);
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
  pointer-events: none;
}

.focused .ripple {
  opacity: 1;
  animation: rippleExpand 0.8s ease-out;
}

@keyframes rippleExpand {
  0% {
    width: 6px;
    height: 6px;
    opacity: 0.8;
  }
  100% {
    width: 300px;
    height: 300px;
    opacity: 0;
  }
}

/* Glow effect */
.glow-effect {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 0;
  height: 0;
  background: radial-gradient(circle, rgba(30, 107, 184, 0.1) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
  transition: width 0.5s ease, height 0.5s ease;
}

.focused .glow-effect {
  width: 150%;
  height: 150%;
}

/* Error state */
.error .input {
  animation: shake 0.4s ease-out;
}

.error-msg {
  position: absolute;
  bottom: -26px;
  left: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-error);
}

.error-icon {
  width: 14px;
  height: 14px;
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
