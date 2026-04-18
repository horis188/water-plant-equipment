<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// Generate random water drops
const drops = ref<Array<{ id: number; x: number; size: number; duration: number; delay: number }>>([])
const bubbles = ref<Array<{ id: number; x: number; size: number; duration: number; delay: number; wobble: number }>>([])

const generateDrops = () => {
  drops.value = Array.from({ length: 25 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: Math.random() * 8 + 4,
    duration: Math.random() * 8 + 6,
    delay: Math.random() * 5
  }))
}

const generateBubbles = () => {
  bubbles.value = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: Math.random() * 40 + 15,
    duration: Math.random() * 10 + 8,
    delay: Math.random() * 5,
    wobble: Math.random() * 60 + 30
  }))
}

let animationFrame: number | undefined = undefined

onMounted(() => {
  generateDrops()
  generateBubbles()
})

onUnmounted(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <div class="water-bg">
    <!-- Deep water gradient base -->
    <div class="deep-water"></div>

    <!-- Light rays - more prominent -->
    <div class="light-rays">
      <div class="ray ray-1"></div>
      <div class="ray ray-2"></div>
      <div class="ray ray-3"></div>
      <div class="ray ray-4"></div>
    </div>

    <!-- Gradient orbs - darker and more saturated -->
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    <div class="orb orb-4"></div>

    <!-- Floating bubbles - more visible -->
    <div
      v-for="bubble in bubbles"
      :key="'bubble-' + bubble.id"
      class="bubble"
      :style="{
        left: `${bubble.x}%`,
        width: `${bubble.size}px`,
        height: `${bubble.size}px`,
        animationDuration: `${bubble.duration}s`,
        animationDelay: `${bubble.delay}s`,
        '--wobble': `${bubble.wobble}px`
      }"
    ></div>

    <!-- Waves at bottom - more prominent -->
    <div class="waves">
      <svg class="wave wave-1" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path fill="rgba(20, 80, 140, 0.25)" d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
      </svg>
      <svg class="wave wave-2" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path fill="rgba(30, 150, 160, 0.2)" d="M0,80 C360,20 720,100 1080,60 C1260,40 1380,70 1440,80 L1440,120 L0,120 Z" />
      </svg>
      <svg class="wave wave-3" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path fill="rgba(15, 120, 160, 0.18)" d="M0,40 C480,100 960,20 1440,60 L1440,120 L0,120 Z" />
      </svg>
    </div>

    <!-- Floating water drops - more visible -->
    <div
      v-for="drop in drops"
      :key="'drop-' + drop.id"
      class="drop"
      :style="{
        left: `${drop.x}%`,
        width: `${drop.size}px`,
        height: `${drop.size}px`,
        animationDuration: `${drop.duration}s`,
        animationDelay: `${drop.delay}s`
      }"
    ></div>

    <!-- Animated pipeline at bottom -->
    <svg class="pipeline" viewBox="0 0 1440 60" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pipeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(20, 80, 140, 0.4)"/>
          <stop offset="50%" stop-color="rgba(30, 150, 160, 0.5)"/>
          <stop offset="100%" stop-color="rgba(20, 80, 140, 0.4)"/>
        </linearGradient>
      </defs>
      <rect x="0" y="25" width="1440" height="12" fill="url(#pipeGrad)" rx="6"/>
      <circle cx="720" cy="31" r="10" fill="rgba(45, 212, 191, 0.6)">
        <animate attributeName="r" values="10;14;10" dur="1.5s" repeatCount="indefinite"/>
      </circle>
      <!-- Flow indicators -->
      <circle cx="200" cy="31" r="4" fill="rgba(255,255,255,0.4)">
        <animate attributeName="cx" values="100;1340;100" dur="8s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;0.6;0" dur="8s" repeatCount="indefinite"/>
      </circle>
      <circle cx="600" cy="31" r="4" fill="rgba(255,255,255,0.4)">
        <animate attributeName="cx" values="100;1340;100" dur="10s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;0.6;0" dur="10s" repeatCount="indefinite"/>
      </circle>
      <circle cx="1100" cy="31" r="4" fill="rgba(255,255,255,0.4)">
        <animate attributeName="cx" values="100;1340;100" dur="7s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;0.6;0" dur="7s" repeatCount="indefinite"/>
      </circle>
    </svg>
  </div>
</template>

<style scoped>
.water-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(160deg, #1a3a5c 0%, #2d5a7b 40%, #1e4a6e 70%, #153550 100%);
  overflow: hidden;
  z-index: 0;
}

/* Deep water overlay */
.deep-water {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(30, 100, 150, 0.3) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 60%, rgba(20, 80, 130, 0.25) 0%, transparent 40%);
  pointer-events: none;
}

/* Light rays - more prominent */
.light-rays {
  position: absolute;
  top: -20%;
  left: 0;
  width: 100%;
  height: 120%;
  overflow: hidden;
  pointer-events: none;
}

.ray {
  position: absolute;
  top: -20%;
  width: 80px;
  height: 140%;
  background: linear-gradient(180deg, rgba(100, 180, 220, 0.15) 0%, rgba(100, 180, 220, 0.05) 50%, transparent 100%);
  transform-origin: top center;
}

.ray-1 {
  left: 10%;
  transform: rotate(20deg);
  animation: rayShimmer 4s ease-in-out infinite;
}

.ray-2 {
  left: 35%;
  width: 60px;
  transform: rotate(5deg);
  animation: rayShimmer 5s ease-in-out infinite 1s;
}

.ray-3 {
  left: 55%;
  width: 100px;
  transform: rotate(-8deg);
  animation: rayShimmer 4.5s ease-in-out infinite 2s;
}

.ray-4 {
  left: 80%;
  width: 50px;
  transform: rotate(-18deg);
  animation: rayShimmer 3.5s ease-in-out infinite 0.5s;
}

@keyframes rayShimmer {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

/* Gradient orbs - darker and more saturated */
.orb {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.orb-1 {
  width: 700px;
  height: 700px;
  background: radial-gradient(circle, rgba(30, 107, 184, 0.5) 0%, rgba(30, 107, 184, 0.2) 40%, transparent 70%);
  top: -300px;
  right: -200px;
  animation: float1 6s ease-in-out infinite;
}

.orb-2 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(45, 212, 191, 0.4) 0%, rgba(45, 212, 191, 0.15) 40%, transparent 70%);
  bottom: -250px;
  left: -200px;
  animation: float2 7s ease-in-out infinite reverse;
}

.orb-3 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(6, 182, 212, 0.35) 0%, rgba(6, 182, 212, 0.1) 40%, transparent 70%);
  top: 30%;
  left: 20%;
  animation: float3 5s ease-in-out infinite;
}

.orb-4 {
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, rgba(20, 80, 130, 0.4) 0%, transparent 70%);
  top: 50%;
  right: 10%;
  animation: float1 8s ease-in-out infinite reverse;
}

@keyframes float1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-40px, 30px) scale(1.08); }
  66% { transform: translate(30px, -40px) scale(0.95); }
}

@keyframes float2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(50px, -30px) scale(1.15); }
}

@keyframes float3 {
  0%, 100% { transform: translate(0, 0); opacity: 0.6; }
  50% { transform: translate(-30px, 40px); opacity: 0.9; }
}

/* Bubbles - more visible */
.bubble {
  position: absolute;
  bottom: -60px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(150, 210, 240, 0.6), rgba(30, 107, 184, 0.2));
  border: 1px solid rgba(150, 210, 240, 0.4);
  animation: rise linear infinite;
}

@keyframes rise {
  0% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: 0;
  }
  10% {
    opacity: 0.8;
  }
  50% {
    transform: translateY(-50vh) translateX(calc(var(--wobble) * 0.6)) scale(1.15);
  }
  90% {
    opacity: 0.7;
  }
  100% {
    transform: translateY(-110vh) translateX(var(--wobble)) scale(0.85);
    opacity: 0;
  }
}

/* Waves - more prominent */
.waves {
  position: absolute;
  bottom: 50px;
  left: 0;
  width: 100%;
  height: 150px;
}

.wave {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.wave-1 {
  animation: wave 6s ease-in-out infinite;
}

.wave-2 {
  animation: wave 8s ease-in-out infinite reverse;
}

.wave-3 {
  animation: wave 10s ease-in-out infinite;
}

@keyframes wave {
  0%, 100% { transform: translateX(0) translateY(0); }
  25% { transform: translateX(-30px, 8px); }
  50% { transform: translateX(-60px, 0); }
  75% { transform: translateX(-30px, -8px); }
}

/* Water drops - more visible */
.drop {
  position: absolute;
  top: -20px;
  background: radial-gradient(circle at 30% 30%, rgba(200, 230, 255, 0.9), rgba(30, 107, 184, 0.5));
  border-radius: 50%;
  animation: fall linear infinite;
  opacity: 0.8;
}

@keyframes fall {
  0% {
    transform: translateY(-20px) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 0.8;
  }
  90% {
    opacity: 0.8;
  }
  100% {
    transform: translateY(100vh) rotate(360deg);
    opacity: 0;
  }
}

/* Pipeline decoration */
.pipeline {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 60px;
}
</style>
