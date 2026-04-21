<script setup lang="ts">
// Root App component
</script>

<template>
  <RouterView />
</template>

<style>
/* Global reset */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  height: 100%;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  line-height: 1.6;
  color: var(--color-text-primary);
  background: var(--color-bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  min-height: 100vh;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(30, 107, 184, 0.05);
}

::-webkit-scrollbar-thumb {
  background: rgba(30, 107, 184, 0.2);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(30, 107, 184, 0.4);
}

/* Selection color */
::selection {
  background: rgba(30, 107, 184, 0.2);
  color: inherit;
}
</style>
