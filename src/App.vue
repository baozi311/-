<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import KLineChart from "./components/KLineChart.vue";
import StockSidebar from "./components/StockSidebar.vue";
import HistorySidebar from "./components/HistorySidebar.vue";

const leftCollapsed = ref(false);
const rightCollapsed = ref(false);
const isMobile = ref(false);

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768;
  if (isMobile.value) {
    leftCollapsed.value = true;
    rightCollapsed.value = true;
  }
};

const toggleLeft = () => {
  leftCollapsed.value = !leftCollapsed.value;
};

const toggleRight = () => {
  rightCollapsed.value = !rightCollapsed.value;
};

onMounted(() => {
  checkMobile();
  window.addEventListener("resize", checkMobile);
});

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile);
});
</script>

<template>
  <div class="app-container">
    <HistorySidebar :collapsed="leftCollapsed" @toggle="toggleLeft" />
    <div
      class="chart-section"
      :style="{
        marginLeft: leftCollapsed ? '60px' : '280px',
        marginRight: rightCollapsed ? '60px' : '300px',
      }"
    >
      <div v-if="isMobile" class="mobile-controls">
        <button @click="toggleLeft" class="mobile-btn">
          {{ leftCollapsed ? "☰ 盘" : "✕" }}
        </button>
        <button @click="toggleRight" class="mobile-btn">
          {{ rightCollapsed ? "☰ 信息" : "✕" }}
        </button>
      </div>
      <KLineChart />
    </div>
    <StockSidebar :collapsed="rightCollapsed" @toggle="toggleRight" />
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100vh;
  background-color: #131722;
  margin: 0;
  padding: 0;
  display: flex;
  position: relative;
}

.chart-section {
  flex: 1;
  padding: 0;
  overflow-y: auto;
  transition:
    margin-left 0.3s ease,
    margin-right 0.3s ease;
}

.mobile-controls {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  gap: 10px;
  background-color: #1e222d;
}

.mobile-btn {
  flex: 1;
  padding: 10px;
  background-color: #2a2e39;
  border: none;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 14px;
  cursor: pointer;
}

@media (max-width: 768px) {
  .app-container {
    flex-direction: column;
  }

  .chart-section {
    margin-left: 0px !important;
    margin-right: 0px !important;
  }
}
</style>
