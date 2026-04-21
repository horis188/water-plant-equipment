<script setup lang="ts">
// Water-themed SVG icons
</script>

<template>
  <!-- User icon -->
  <svg class="icon icon-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
  </svg>

  <!-- Lock icon -->
  <svg class="icon icon-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 018 0v4" />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </svg>

  <!-- Eye open icon -->
  <svg class="icon icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <ellipse cx="12" cy="12" rx="9" ry="6" />
    <circle cx="12" cy="12" r="3" />
  </svg>

  <!-- Eye closed icon -->
  <svg class="icon icon-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M2 12c2-4 6-7 10-7 1.5 0 3 .5 4 1.5" />
    <path d="M5 15c1.5-2 4-3.5 7-3.5 1.2 0 2.4.3 3.5.8" />
    <path d="M22 12c-2 4-6 7-10 7-1.5 0-3-.5-4-1.5" />
    <line x1="3" y1="3" x2="21" y2="21" />
  </svg>

  <!-- Water drop icon -->
  <svg class="icon icon-drop" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2c-5 7-8 10-8 14a8 8 0 0016 0c0-4-3-7-8-14z" />
  </svg>

  <!-- Wave icon -->
  <svg class="icon icon-wave" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    <path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
  </svg>

  <!-- Pipeline icon -->
  <svg class="icon icon-pipeline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="8" width="4" height="8" rx="1" />
    <rect x="17" y="8" width="4" height="8" rx="1" />
    <path d="M7 12h10" />
    <circle cx="12" cy="12" r="2" />
  </svg>
</template>

<style scoped>
.icon {
  display: inline-block;
  width: 24px;
  height: 24px;
  vertical-align: middle;
}
</style>
