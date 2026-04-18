<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// Generate random water drops
const drops = ref<Array<{ id: number; x: number; size: number; duration: number; delay: number }>>([])

const generateDrops = () => {
  drops.value = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: Math.random() * 8 + 4,
    duration: Math.random() * 10 + 15,
    delay: Math.random() * 10
  }))
}

let animationFrame: number | undefined = undefined

onMounted(() => {
  generateDrops()
})

onUnmounted(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <div class="water-bg">
    <!-- Gradient orbs -->
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>

    <!-- Waves at bottom -->
    <div class="waves">
      <svg class="wave wave-1" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path fill="rgba(30, 107, 184, 0.1)" d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
      </svg>
      <svg class="wave wave-2" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path fill="rgba(45, 212, 191, 0.08)" d="M0,80 C360,20 720,100 1080,60 C1260,40 1380,70 1440,80 L1440,120 L0,120 Z" />
      </svg>
      <svg class="wave wave-3" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path fill="rgba(6, 182, 212, 0.06)" d="M0,40 C480,100 960,20 1440,60 L1440,120 L0,120 Z" />
      </svg>
    </div>

    <!-- Floating water drops -->
    <div
      v-for="drop in drops"
      :key="drop.id"
      class="drop"
      :style="{
        left: `${drop.x}%`,
        width: `${drop.size}px`,
        height: `${drop.size}px`,
        animationDuration: `${drop.duration}s`,
        animationDelay: `${drop.delay}s`
      }"
    ></div>
  </div>
</template>

<style scoped>
.water-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #F0F7FF 0%, #E0F0FF 50%, #D0E8FF 100%);
  overflow: hidden;
  z-index: 0;
}

/* Gradient orbs for glow effect */
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
}

.orb-1 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(30, 107, 184, 0.3) 0%, transparent 70%);
  top: -200px;
  right: -100px;
  animation: float 8s ease-in-out infinite;
}

.orb-2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(45, 212, 191, 0.2) 0%, transparent 70%);
  bottom: -150px;
  left: -100px;
  animation: float 10s ease-in-out infinite reverse;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(20px, -20px); }
}

/* Waves */
.waves {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 120px;
}

.wave {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.wave-1 {
  animation: wave 8s ease-in-out infinite;
}

.wave-2 {
  animation: wave 10s ease-in-out infinite reverse;
}

.wave-3 {
  animation: wave 12s ease-in-out infinite;
}

@keyframes wave {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(-20px); }
}

/* Water drops */
.drop {
  position: absolute;
  top: -20px;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8), rgba(30, 107, 184, 0.2));
  border-radius: 50%;
  animation: fall linear infinite;
  opacity: 0.6;
}

@keyframes fall {
  0% {
    transform: translateY(-20px) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 0.6;
  }
  90% {
    opacity: 0.6;
  }
  100% {
    transform: translateY(100vh) rotate(360deg);
    opacity: 0;
  }
}
</style>
