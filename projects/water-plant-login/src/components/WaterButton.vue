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

    <!-- Subtle ripple effect -->
    <span class="ripple-effect"></span>
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
  background: linear-gradient(135deg, #1E6BB8 0%, #2a7bb8 100%);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(30, 107, 184, 0.3);
}

.water-btn:hover:not(.disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(30, 107, 184, 0.35);
  background: linear-gradient(135deg, #1E6BB8 0%, #3a8bc8 100%);
}

.water-btn:active:not(.disabled),
.water-btn.pressed:not(.disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(30, 107, 184, 0.25);
}

/* Wave cover effect - subtle */
.wave-cover {
  position: absolute;
  top: 0;
  left: -100%;
  width: 200%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
  transform: skewX(-20deg);
  transition: left 0.4s ease;
}

.water-btn:hover:not(.disabled) .wave-cover {
  left: 100%;
}

/* Disabled state */
.water-btn.disabled {
  background: #8a9aab;
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
  width: 22px;
  height: 22px;
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
  transition: opacity 0.15s ease;
}

.btn-text.hidden {
  opacity: 0;
}

/* Subtle ripple effect */
.ripple-effect {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  transition: width 0.3s ease, height 0.3s ease;
  opacity: 0;
}

.water-btn:active:not(.disabled) .ripple-effect {
  width: 250px;
  height: 250px;
  opacity: 1;
  transition: width 0s, height 0s;
}
</style>
