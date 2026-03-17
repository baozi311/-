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
    <HistorySidebar :collapsed="leftCollapsed" />
    <div
      class="chart-section"
      :style="{
        marginLeft: leftCollapsed ? '60px' : '280px',
        marginRight: rightCollapsed ? '60px' : '300px',
      }"
    >
      <div class="sidebar-toggles">
        <button @click="toggleLeft" class="toggle-sidebar-btn left">
          {{ leftCollapsed ? "»" : "«" }}
        </button>
        <button @click="toggleRight" class="toggle-sidebar-btn right">
          {{ rightCollapsed ? "«" : "»" }}
        </button>
      </div>
      <!-- <div v-if="isMobile" class="mobile-controls">
        <button @click="toggleLeft" class="mobile-btn">
          {{ "☰ 盘" }}
        </button>
        <button @click="toggleRight" class="mobile-btn">
          {{ "☰ 信息" }}
        </button>
      </div> -->
      <KLineChart />
    </div>
    <StockSidebar :collapsed="rightCollapsed" />
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
  position: relative;
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
  padding: 15px 20px;
  background-color: #2a2e39;
  border: none;
  border-radius: 6px;
  color: #d1d4dc;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.sidebar-toggles {
  position: fixed;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  display: flex;
  justify-content: space-between;
  pointer-events: none;
  z-index: 200;
}

.toggle-sidebar-btn {
  pointer-events: auto;
  width: 30px;
  height: 60px;
  background-color: #2a2e39;
  border: none;
  color: #d1d4dc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  transition: background-color 0.2s;
}

.toggle-sidebar-btn:hover {
  background-color: #363a45;
}

.toggle-sidebar-btn.left {
  border-radius: 0 6px 6px 0;
}

.toggle-sidebar-btn.right {
  border-radius: 6px 0 0 6px;
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
