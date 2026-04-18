<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  loading?: boolean
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
  disabled: false
})

const pressed = ref(false)
</script>

<template>
  <button
    class="water-btn"
    :class="{ loading, pressed, disabled }"
    :disabled="disabled || loading"
    @mousedown="pressed = true"
    @mouseup="pressed = false"
    @mouseleave="pressed = false"
  >
    <!-- Water wave animation on hover -->
    <span class="wave-cover"></span>

    <!-- Loading spinner -->
    <span v-if="loading" class="spinner">
      <svg class="drop-spinner" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2c-5 7-8 10-8 14a8 8 0 0016 0c0-4-3-7-8-14z" />
      </svg>
    </span>

    <!-- Button text -->
    <span class="btn-text" :class="{ hidden: loading }">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.water-btn {
  position: relative;
  width: 100%;
  height: 52px;
  font-size: 16px;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  overflow: hidden;
  transition: all var(--transition-base);
  box-shadow: 0 4px 15px rgba(30, 107, 184, 0.3);
}

.water-btn:hover:not(.disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(30, 107, 184, 0.4);
}

.water-btn:active:not(.disabled),
.water-btn.pressed:not(.disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 10px rgba(30, 107, 184, 0.3);
}

/* Wave cover effect */
.wave-cover {
  position: absolute;
  top: 0;
  left: -100%;
  width: 200%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transform: skewX(-20deg);
  transition: left 0.5s ease;
}

.water-btn:hover:not(.disabled) .wave-cover {
  left: 100%;
}

/* Disabled state */
.water-btn.disabled {
  background: #ccc;
  box-shadow: none;
  cursor: not-allowed;
}

/* Loading state */
.spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-spinner {
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
  color: #fff;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.btn-text {
  position: relative;
  z-index: 1;
  transition: opacity var(--transition-fast);
}

.btn-text.hidden {
  opacity: 0;
}

/* Ripple from center on click */
.water-btn::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.4s ease, height 0.4s ease;
}

.water-btn:active:not(.disabled)::after {
  width: 300px;
  height: 300px;
}
</style>
