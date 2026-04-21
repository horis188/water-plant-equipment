<script setup lang="ts">
import { ref, onMounted } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const code = ref('')
const refreshing = ref(false)

// Generate random code
const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  code.value = result
  drawCanvas()
}

// Draw code on canvas
const drawCanvas = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Clear canvas
  ctx.fillStyle = 'rgba(240, 248, 255, 0.9)'
  ctx.fillRect(0, 0, 120, 44)

  // Draw background noise
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(${Math.random() * 100 + 155}, ${Math.random() * 100 + 180}, ${Math.random() * 100 + 200}, 0.3)`
    ctx.fillRect(
      Math.random() * 120,
      Math.random() * 44,
      Math.random() * 3 + 1,
      Math.random() * 3 + 1
    )
  }

  // Draw interference lines
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(30, 107, 184, ${Math.random() * 0.15 + 0.05})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(Math.random() * 120, Math.random() * 44)
    ctx.lineTo(Math.random() * 120, Math.random() * 44)
    ctx.stroke()
  }

  // Draw code with wave effect
  ctx.font = 'italic 26px "Noto Sans SC", sans-serif'
  ctx.fillStyle = '#1E6BB8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const text = code.value
  const charWidth = 25
  const startX = 60 - (text.length - 1) * charWidth / 2

  for (let i = 0; i < text.length; i++) {
    const offsetY = Math.sin((i + 1) * 0.8) * 4
    ctx.fillText(text[i], startX + i * charWidth, 22 + offsetY)
  }
}

// Refresh code
const refresh = async () => {
  refreshing.value = true
  await new Promise(resolve => setTimeout(resolve, 300))
  generateCode()
  refreshing.value = false
}

// Handle click
const handleClick = () => {
  refresh()
}

onMounted(() => {
  generateCode()
})

// Expose generate method
defineExpose({ generate: generateCode })
</script>

<template>
  <div class="verify-code" @click="handleClick">
    <canvas
      ref="canvasRef"
      width="120"
      height="44"
      class="canvas"
      :class="{ refreshing }"
    />
    <div class="refresh-hint">
      <svg class="refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 4v6h6M23 20v-6h-6" />
        <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.verify-code {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: transform var(--transition-fast);
}

.verify-code:hover {
  transform: scale(1.02);
}

.verify-code:active {
  transform: scale(0.98);
}

.canvas {
  border-radius: var(--radius-md);
  border: 2px solid var(--color-border);
  transition: border-color var(--transition-fast);
}

.verify-code:hover .canvas {
  border-color: var(--color-primary);
}

.canvas.refreshing {
  animation: spin 0.3s ease;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.refresh-hint {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--color-text-secondary);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.verify-code:hover .refresh-hint {
  opacity: 1;
}

.refresh-icon {
  width: 10px;
  height: 10px;
}
</style>
