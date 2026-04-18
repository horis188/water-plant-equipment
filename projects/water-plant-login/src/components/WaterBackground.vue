<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// Generate random water drops
const drops = ref<Array<{ id: number; x: number; size: number; duration: number; delay: number }>>([])
const bubbles = ref<Array<{ id: number; x: number; size: number; duration: number; delay: number; wobble: number }>>([])

const generateDrops = () => {
  drops.value = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: Math.random() * 6 + 3,
    duration: Math.random() * 12 + 10,
    delay: Math.random() * 10
  }))
}

const generateBubbles = () => {
  bubbles.value = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: Math.random() * 30 + 10,
    duration: Math.random() * 15 + 12,
    delay: Math.random() * 8,
    wobble: Math.random() * 40 + 20
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
    <!-- Light rays -->
    <div class="light-rays">
      <div class="ray ray-1"></div>
      <div class="ray ray-2"></div>
      <div class="ray ray-3"></div>
    </div>

    <!-- Gradient orbs -->
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>

    <!-- Floating bubbles -->
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

    <!-- Waves at bottom -->
    <div class="waves">
      <svg class="wave wave-1" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path fill="rgba(30, 107, 184, 0.12)" d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
      </svg>
      <svg class="wave wave-2" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path fill="rgba(45, 212, 191, 0.1)" d="M0,80 C360,20 720,100 1080,60 C1260,40 1380,70 1440,80 L1440,120 L0,120 Z" />
      </svg>
      <svg class="wave wave-3" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path fill="rgba(6, 182, 212, 0.08)" d="M0,40 C480,100 960,20 1440,60 L1440,120 L0,120 Z" />
      </svg>
    </div>

    <!-- Floating water drops -->
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
          <stop offset="0%" stop-color="rgba(30, 107, 184, 0.15)"/>
          <stop offset="50%" stop-color="rgba(45, 212, 191, 0.2)"/>
          <stop offset="100%" stop-color="rgba(30, 107, 184, 0.15)"/>
        </linearGradient>
      </defs>
      <rect x="0" y="25" width="1440" height="10" fill="url(#pipeGrad)" rx="5"/>
      <circle cx="720" cy="30" r="8" fill="rgba(45, 212, 191, 0.3)">
        <animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite"/>
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
  background: linear-gradient(135deg, #F0F7FF 0%, #E0F0FF 50%, #D0E8FF 100%);
  overflow: hidden;
  z-index: 0;
}

/* Light rays */
.light-rays {
  position: absolute;
  top: -50%;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}

.ray {
  position: absolute;
  top: 0;
  width: 2px;
  height: 150%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, transparent 100%);
  transform-origin: top center;
}

.ray-1 {
  left: 20%;
  transform: rotate(15deg);
  animation: rayShimmer 6s ease-in-out infinite;
}

.ray-2 {
  left: 50%;
  transform: rotate(0deg);
  animation: rayShimmer 8s ease-in-out infinite reverse;
}

.ray-3 {
  left: 80%;
  transform: rotate(-15deg);
  animation: rayShimmer 7s ease-in-out infinite;
}

@keyframes rayShimmer {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

/* Gradient orbs for glow effect */
.orb {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.orb-1 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(30, 107, 184, 0.25) 0%, transparent 70%);
  top: -250px;
  right: -150px;
  animation: float1 10s ease-in-out infinite;
}

.orb-2 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(45, 212, 191, 0.2) 0%, transparent 70%);
  bottom: -200px;
  left: -150px;
  animation: float2 12s ease-in-out infinite reverse;
}

.orb-3 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%);
  top: 40%;
  left: 30%;
  animation: float3 8s ease-in-out infinite;
}

@keyframes float1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-30px, 20px) scale(1.05); }
  66% { transform: translate(20px, -30px) scale(0.95); }
}

@keyframes float2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(40px, -20px) scale(1.1); }
}

@keyframes float3 {
  0%, 100% { transform: translate(0, 0); opacity: 0.3; }
  50% { transform: translate(-20px, 30px); opacity: 0.5; }
}

/* Bubbles */
.bubble {
  position: absolute;
  bottom: -50px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8), rgba(30, 107, 184, 0.1));
  border: 1px solid rgba(255, 255, 255, 0.5);
  animation: rise linear infinite;
  opacity: 0.6;
}

@keyframes rise {
  0% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: 0;
  }
  10% {
    opacity: 0.6;
  }
  50% {
    transform: translateY(-45vh) translateX(calc(var(--wobble) * 0.5)) scale(1.1);
  }
  90% {
    opacity: 0.6;
  }
  100% {
    transform: translateY(-100vh) translateX(var(--wobble)) scale(0.9);
    opacity: 0;
  }
}

/* Waves */
.waves {
  position: absolute;
  bottom: 50px;
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
  animation: wave 10s ease-in-out infinite;
}

.wave-2 {
  animation: wave 12s ease-in-out infinite reverse;
}

.wave-3 {
  animation: wave 14s ease-in-out infinite;
}

@keyframes wave {
  0%, 100% { transform: translateX(0) translateY(0); }
  25% { transform: translateX(-15px, 5px); }
  50% { transform: translateX(-30px, 0); }
  75% { transform: translateX(-15px, -5px); }
}

/* Water drops */
.drop {
  position: absolute;
  top: -20px;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.9), rgba(30, 107, 184, 0.3));
  border-radius: 50%;
  animation: fall linear infinite;
  opacity: 0.7;
}

@keyframes fall {
  0% {
    transform: translateY(-20px) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 0.7;
  }
  90% {
    opacity: 0.7;
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
