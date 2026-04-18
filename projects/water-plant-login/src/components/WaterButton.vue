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
    <!-- Animated water bubbles -->
    <span class="bubble bubble-1"></span>
    <span class="bubble bubble-2"></span>
    <span class="bubble bubble-3"></span>

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

    <!-- Ripple effect element -->
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
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  overflow: hidden;
  transition: all var(--transition-base);
  box-shadow: 0 4px 15px rgba(30, 107, 184, 0.3);
}

/* Glow effect on hover */
.water-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.water-btn:hover:not(.disabled)::before {
  opacity: 1;
}

.water-btn:hover:not(.disabled) {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(30, 107, 184, 0.4), 0 0 20px rgba(30, 107, 184, 0.2);
}

.water-btn:active:not(.disabled),
.water-btn.pressed:not(.disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 10px rgba(30, 107, 184, 0.3);
}

/* Bubbles animation */
.bubble {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  pointer-events: none;
}

.bubble-1 {
  width: 8px;
  height: 8px;
  top: 50%;
  left: 20%;
  animation: bubbleFloat 2s ease-in-out infinite;
}

.bubble-2 {
  width: 6px;
  height: 6px;
  top: 60%;
  left: 50%;
  animation: bubbleFloat 2.5s ease-in-out infinite 0.5s;
}

.bubble-3 {
  width: 5px;
  height: 5px;
  top: 40%;
  left: 75%;
  animation: bubbleFloat 1.8s ease-in-out infinite 1s;
}

@keyframes bubbleFloat {
  0%, 100% {
    transform: translateY(0) scale(1);
    opacity: 0.3;
  }
  50% {
    transform: translateY(-10px) scale(1.2);
    opacity: 0.6;
  }
}

/* Wave cover effect */
.wave-cover {
  position: absolute;
  top: 0;
  left: -100%;
  width: 200%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transform: skewX(-20deg);
  transition: left 0.6s ease;
}

.water-btn:hover:not(.disabled) .wave-cover {
  left: 100%;
}

/* Disabled state */
.water-btn.disabled {
  background: linear-gradient(135deg, #bbb 0%, #ddd 100%);
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
  animation: spin 1s linear infinite, pulse 1.5s ease-in-out infinite;
  color: #fff;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: rotate(0deg) scale(1); }
  50% { opacity: 0.8; transform: rotate(180deg) scale(1.1); }
}

.btn-text {
  position: relative;
  z-index: 1;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.btn-text.hidden {
  opacity: 0;
  transform: translateY(-10px);
}

/* Ripple effect */
.ripple-effect {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 70%);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  transition: width 0.6s ease, height 0.6s ease, opacity 0.6s ease;
  opacity: 0;
}

.water-btn:active:not(.disabled) .ripple-effect {
  width: 400px;
  height: 400px;
  opacity: 1;
  transition: width 0s, height 0s, opacity 0s;
}
</style>
