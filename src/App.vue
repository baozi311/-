<script setup lang="ts">
/**
 * 主应用组件
 * 负责布局和管理侧边栏、图表和弹幕显示
 */

import { ref, onMounted, onUnmounted, computed } from "vue"; // Vue 响应式 API
import KLineChart from "./components/KLineChart.vue"; // K线图组件
import StockSidebar from "./components/StockSidebar.vue"; // 股票侧边栏组件
import HistorySidebar from "./components/HistorySidebar.vue"; // 历史侧边栏组件
import DanmakuDisplay from "./components/DanmakuDisplay.vue"; // 弹幕显示组件
import { currentDiskId, diskList } from "./stores/stockStore"; // 股票状态管理

// 响应式数据
const leftCollapsed = ref(false); // 左侧边栏是否折叠
const rightCollapsed = ref(false); // 右侧边栏是否折叠
const isMobile = ref(false); // 是否为移动设备
const showDanmaku = ref(true); // 是否显示弹幕
const danmakuRef = ref<InstanceType<typeof DanmakuDisplay> | null>(null); // 弹幕组件引用
const activeDiskId = ref<number | null>(null); // 当前选中的盘ID

/**
 * 检查是否为移动设备
 */
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768;
  if (isMobile.value) {
    leftCollapsed.value = true;
    rightCollapsed.value = true;
  }
};

/**
 * 切换左侧边栏
 */
const toggleLeft = () => {
  leftCollapsed.value = !leftCollapsed.value;
};

/**
 * 切换右侧边栏
 */
const toggleRight = () => {
  rightCollapsed.value = !rightCollapsed.value;
};

/**
 * 处理发送弹幕
 * @param {string} text 弹幕文本
 */
const handleSendDanmaku = (text: string) => {
  if (danmakuRef.value) {
    danmakuRef.value.addDanmaku(text);
  }
};

/**
 * 处理切换弹幕显示
 * @param {boolean} show 是否显示弹幕
 */
const handleToggleDanmaku = (show: boolean) => {
  showDanmaku.value = show;
};

/**
 * 处理选择盘
 * @param {number | null} diskId 盘ID
 */
const handleSelectDisk = (diskId: number | null) => {
  activeDiskId.value = diskId;
};

/**
 * 当前盘（计算属性）
 */
const currentDisk = computed(() => {
  if (currentDiskId.value === null) return null;
  return diskList.value.find((d) => d.id === currentDiskId.value) || null;
});

/**
 * 显示的盘ID（计算属性）
 * 优先使用选中的盘ID，否则使用当前盘ID
 */
const displayDiskId = computed(() => {
  if (activeDiskId.value !== null) return activeDiskId.value;
  return currentDiskId.value;
});

// 生命周期钩子
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
    <!-- 左侧历史侧边栏 -->
    <HistorySidebar
      :collapsed="leftCollapsed"
      @select-disk="handleSelectDisk"
    />
    <!-- 左侧边栏遮罩（移动设备） -->
    <div
      v-if="isMobile && !leftCollapsed"
      class="sidebar-overlay left"
      @click="leftCollapsed = true"
    ></div>
    <!-- 右侧边栏遮罩（移动设备） -->
    <div
      v-if="isMobile && !rightCollapsed"
      class="sidebar-overlay right"
      @click="rightCollapsed = true"
    ></div>
    <!-- 图表区域 -->
    <div
      class="chart-section"
      :style="{
        marginLeft: leftCollapsed ? '60px' : '280px',
        marginRight: rightCollapsed ? '60px' : '300px',
      }"
    >
      <!-- 侧边栏切换按钮 -->
      <div class="sidebar-toggles">
        <button @click="toggleLeft" class="toggle-sidebar-btn left">
          {{ leftCollapsed ? "»" : "«" }}
        </button>
        <button @click="toggleRight" class="toggle-sidebar-btn right">
          {{ rightCollapsed ? "«" : "»" }}
        </button>
      </div>
      <!-- 图表和弹幕 -->
      <div class="chart-wrapper">
        <KLineChart />
        <DanmakuDisplay
          ref="danmakuRef"
          :showDanmaku="showDanmaku"
          :diskId="displayDiskId"
        />
      </div>
    </div>
    <!-- 右侧股票侧边栏 -->
    <StockSidebar
      :collapsed="rightCollapsed"
      @send-danmaku="handleSendDanmaku"
      @toggle-danmaku="handleToggleDanmaku"
    />
  </div>
</template>

<style scoped>
/* 主容器 */
.app-container {
  width: 100%;
  height: 100vh;
  background-color: #131722;
  margin: 0;
  padding: 0;
  display: flex;
  position: relative;
}

/* 图表区域 */
.chart-section {
  flex: 1;
  padding: 0;
  overflow-y: auto;
  position: relative;
  transition:
    margin-left 0.3s ease,
    margin-right 0.3s ease;
}

/* 图表包装器 */
.chart-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

/* 移动设备控制 */
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

/* 侧边栏切换按钮 */
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

/* 侧边栏遮罩 */
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

/* 响应式布局 */
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
