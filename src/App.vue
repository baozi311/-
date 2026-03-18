<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import KLineChart from "./components/KLineChart.vue";
import StockSidebar from "./components/StockSidebar.vue";
import HistorySidebar from "./components/HistorySidebar.vue";
import DanmakuDisplay from "./components/DanmakuDisplay.vue";
import { currentDiskId, diskList } from "./stores/stockStore";

const leftCollapsed = ref(false);
const rightCollapsed = ref(false);
const isMobile = ref(false);
const showDanmaku = ref(true);
const danmakuRef = ref<InstanceType<typeof DanmakuDisplay> | null>(null);
const activeDiskId = ref<number | null>(null);

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

const handleSendDanmaku = (text: string) => {
  if (danmakuRef.value) {
    danmakuRef.value.addDanmaku(text);
  }
};

const handleToggleDanmaku = (show: boolean) => {
  showDanmaku.value = show;
};

const handleSelectDisk = (diskId: number | null) => {
  activeDiskId.value = diskId;
};

const currentDisk = computed(() => {
  if (currentDiskId.value === null) return null;
  return diskList.value.find((d) => d.id === currentDiskId.value) || null;
});

const displayDiskId = computed(() => {
  if (activeDiskId.value !== null) return activeDiskId.value;
  return currentDiskId.value;
});

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
    <HistorySidebar
      :collapsed="leftCollapsed"
      @select-disk="handleSelectDisk"
    />
    <div
      v-if="isMobile && !leftCollapsed"
      class="sidebar-overlay left"
      @click="leftCollapsed = true"
    ></div>
    <div
      v-if="isMobile && !rightCollapsed"
      class="sidebar-overlay right"
      @click="rightCollapsed = true"
    ></div>
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
      <div class="chart-wrapper">
        <KLineChart />
        <DanmakuDisplay
          ref="danmakuRef"
          :showDanmaku="showDanmaku"
          :diskId="displayDiskId"
        />
      </div>
    </div>
    <StockSidebar
      :collapsed="rightCollapsed"
      @send-danmaku="handleSendDanmaku"
      @toggle-danmaku="handleToggleDanmaku"
    />
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

.chart-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
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

.sidebar-overlay {
  position: fixed;
  top: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 99;
}

.sidebar-overlay.left {
  right: 0;
  left: 280px;
}

.sidebar-overlay.right {
  left: 0;
  right: 300px;
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

@media (min-width: 769px) {
  .sidebar-overlay {
    display: none;
  }
}
</style>
