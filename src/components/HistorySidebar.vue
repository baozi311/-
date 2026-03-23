<!--
 * 历史侧边栏组件
 * 负责显示股票盘的历史数据和封存盘列表
-->
<template>
  <div class="history-sidebar" :class="{ collapsed }">
    <!-- <button class="toggle-btn" @click="emit('toggle')">
      {{ collapsed ? "»" : "«" }}
    </button> -->
    <div class="sidebar-content" v-show="!collapsed">
      <!-- 侧边栏头部 -->
      <div class="sidebar-header">
        <h3>股票盘</h3>
        <button
          @click="loadAllData"
          :disabled="diskLoading"
          class="btn-refresh"
        >
          {{ diskLoading ? "加载中..." : "刷新" }}
        </button>
      </div>

      <!-- 当前盘显示最新数据 -->
      <div class="history-list" @click="switchToCurrentDisk">
        <div v-if="historyLoading" class="loading-message">
          加载当前盘数据...
        </div>
        <div v-else-if="historyError" class="error-message">
          {{ historyError }}
        </div>
        <div
          v-else-if="formattedHistoryData.length === 0"
          class="empty-message"
        >
          暂无数据
        </div>
        <div v-else class="history-item active">
          <div class="date-section">
            <span class="date">{{ latestData?.date }}</span>
            <span class="time">{{ latestData?.time }}</span>
            <span class="current-badge">当前盘</span>
          </div>
          <div class="price-section">
            <div class="price-info">
              <span class="label">单价</span>
              <span class="value">{{ toFixed4(latestData?.open) }}</span>
            </div>
            <div class="price-info">
              <span class="label">总股</span>
              <span class="value">{{ latestData?.volume }}</span>
            </div>
          </div>
          <div
            class="change-section"
            :class="(latestData?.change || 0) >= 0 ? 'up' : 'down'"
          >
            <span class="change-value">
              {{ (latestData?.change || 0) >= 0 ? "+" : ""
              }}{{ toFixed4(latestData?.change) }}
            </span>
            <span class="change-percent">
              ({{ toFixed4(latestData?.changePercent) }}%)
            </span>
          </div>
        </div>
      </div>
      <!-- 封存盘列表 -->
      <div class="closed-disks-section">
        <div class="section-title">封存盘</div>
        <div class="disk-list">
          <div v-if="diskLoading" class="loading-message">加载中...</div>
          <div v-else-if="closedDisks.length === 0" class="empty-message">
            暂无封存盘
          </div>
          <div
            v-else
            v-for="disk in closedDisks"
            :key="disk.id"
            class="disk-item"
            :class="{ active: activeTab === 'disk-' + disk.id }"
            @click="selectDisk(disk.id)"
          >
            <div class="disk-header">
              <span class="disk-id">盘 #{{ disk.id }}</span>
              <span class="disk-badge">已封盘</span>
            </div>
            <div class="disk-stats">
              <span class="disk-time"
                >{{ formatTime(disk.startTime, true) }} - 
                {{ formatTime(disk.endTime, true) }}</span
              >
            </div>
            <div class="disk-price-range">
              <span class="price-label">最高价</span>
              <span class="price-value high">{{
                toFixed4(disk.highPrice) || "0.0000"
              }}</span>
              <span class="price-label">最低价</span>
              <span class="price-value low">{{
                toFixed4(disk.lowPrice) || "0.0000"
              }}</span>
            </div>
            <div class="disk-price-range">
              <span class="price-label">最多股</span>
              <span class="price-value high">{{ disk.maxStock || 0 }}</span>
              <span class="price-label">最少股</span>
              <span class="price-value low">{{ disk.minStock || 0 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 封存盘数据列表 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import {
  historyData,
  historyLoading,
  historyError,
  diskList,
  diskLoading,
  loadHistoryData,
  loadKlineData,
  loadDiskList,
  loadDiskData,
  loadDiskKline,
  loadStockData,
} from "../stores/stockStore";

/**
 * 组件属性接口
 */
interface Props {
  collapsed?: boolean;    // 是否折叠
}

// 定义组件属性
const props = withDefaults(defineProps<Props>(), {
  collapsed: false,       // 默认不折叠
});

// 定义组件事件
const emit = defineEmits<{
  (e: "toggle"): void;                  // 切换折叠状态
  (e: "select-disk", diskId: number | null): void; // 选择股票盘
}>();

/**
 * 历史数据项接口
 */
interface HistoryItem {
  date: string;             // 日期
  time: string;             // 时间
  open: number;             // 开盘价
  close: number;            // 收盘价
  high: number;             // 最高价
  low: number;              // 最低价
  change: number;           // 涨跌额
  changePercent: number;    // 涨跌幅
  volume: number;           // 成交量
  timestamp?: string;       // 时间戳
}

// 选中的历史数据索引
const selectedIndex = ref(0);
// 当前活动的标签
const activeTab = ref("current");

/**
 * 计算封存盘列表
 */
const closedDisks = computed(() => {
  return diskList.value
    .filter((disk) => disk.isClosed)
    .sort((a, b) => b.id - a.id); // 按ID降序排序
});

/**
 * 计算最新数据
 */
const latestData = computed(() => {
  if (formattedHistoryData.value.length === 0) return null;
  return formattedHistoryData.value[formattedHistoryData.value.length - 1];
});

/**
 * 格式化日期
 * @param dateStr 日期字符串
 * @returns 格式化后的日期
 */
function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN");
}

/**
 * 格式化日期时间
 * @param dateStr 日期字符串
 * @returns 格式化后的日期时间
 */
function formatDateTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN");
}

/**
 * 格式化时间
 * @param dateStr 日期字符串
 * @param includeSeconds 是否包含秒
 * @returns 格式化后的时间
 */
function formatTime(
  dateStr: string | undefined,
  includeSeconds: boolean = false,
) {
  if (!dateStr) return "--:--:--";
  const date = new Date(dateStr);
  const time = date.toTimeString().split(" ")[0];
  if (includeSeconds) {
    return time;
  }
  return time.slice(0, 5);
}

/**
 * 格式化金额
 * @param amount 金额
 * @returns 格式化后的金额
 */
function formatMoney(amount: number): string {
  return amount.toLocaleString("zh-CN");
}

/**
 * 将数字格式化为4位小数
 * @param value 要格式化的数字
 * @returns 格式化后的字符串
 */
function toFixed4(value: number | undefined | null): string {
  if (value === undefined || value === null) return "0.0000";
  const str = String(value);
  const parts = str.split(".");
  if (parts.length === 1) return parts[0] + ".0000";
  return parts[0] + "." + parts[1].padEnd(4, "0").slice(0, 4);
}

/**
 * 加载所有数据
 */
async function loadAllData() {
  await loadDiskList();
  await loadHistoryData();
  await loadStockData();
}

/**
 * 切换到当前盘
 */
async function switchToCurrentDisk() {
  activeTab.value = "current";
  selectedIndex.value = 0;
  emit("select-disk", null);
  await loadHistoryData();
  await loadKlineData();
}

/**
 * 选择股票盘
 * @param diskId 股票盘ID
 */
async function selectDisk(diskId: number) {
  activeTab.value = "disk-" + diskId;
  selectedIndex.value = 0;
  emit("select-disk", diskId);
  await loadDiskData(diskId);
  await loadDiskKline(diskId);
}

/**
 * 格式化历史数据
 */
const formattedHistoryData = computed(() => {
  return historyData.value.map((item, index) => {
    const prevItem = historyData.value[index - 1];
    const prevPrice = prevItem ? prevItem.unitPrice : item.unitPrice;
    const change = item.unitPrice - prevPrice;
    const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;

    const date = item.timestamp ? new Date(item.timestamp) : new Date();

    return {
      date: date.toISOString().split("T")[0],
      time: date.toTimeString().split(" ")[0],
      open: item.unitPrice,
      close: item.unitPrice,
      high: item.unitPrice,
      low: item.unitPrice,
      change: change,
      changePercent: changePercent,
      volume: item.totalStock,
      timestamp: item.timestamp,
    };
  });
});

/**
 * 选择历史数据
 * @param index 历史数据索引
 */
function selectHistory(index: number) {
  selectedIndex.value = index;
  console.log("Selected history index:", index);
  console.log("Selected history data:", formattedHistoryData.value[index]);
}

// 组件挂载时加载数据
onMounted(() => {
  loadAllData();
});
</script>

<style scoped>
/* 历史侧边栏 */
.history-sidebar {
  width: 280px;
  background-color: #1e222d;
  border-right: 1px solid #2a2e39;
  height: 100vh;
  overflow-y: auto;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
  transition: width 0.3s ease;
}

/* 折叠状态 */
.history-sidebar.collapsed {
  width: 00px;
}

/* 切换按钮 */
.toggle-btn {
  position: absolute;
  right: -20px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 60px;
  background-color: #2a2e39;
  border: none;
  border-radius: 0 4px 4px 0;
  color: #d1d4dc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  z-index: 101;
  transition: background-color 0.2s ease;
}

.toggle-btn:hover {
  background-color: #363a45;
}

/* 侧边栏头部 */
.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #2a2e39;
  background-color: #1e222d;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  margin: 0;
  color: #d1d4dc;
  font-size: 16px;
  font-weight: 600;
}

/* 刷新按钮 */
.btn-refresh {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: #26a69a;
  color: white;
}

.btn-refresh:hover:not(:disabled) {
  background-color: #2196f3;
}

.btn-refresh:disabled {
  background-color: #2a2e39;
  cursor: not-allowed;
}

/* 盘标签 */
.disk-tabs {
  display: flex;
  padding: 12px;
  gap: 8px;
  border-bottom: 1px solid #2a2e39;
}

.disk-tab {
  flex: 1;
  padding: 10px;
  background-color: #131722;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.disk-tab:hover {
  background-color: #1a1f2c;
  border-color: #2a2e39;
}

.disk-tab.active {
  background-color: #26a69a;
  border-color: #26a69a;
}

.disk-tab.active .disk-name,
.disk-tab.active .disk-status {
  color: #131722;
}

.disk-name {
  color: #d1d4dc;
  font-size: 14px;
  font-weight: 500;
}

.disk-status {
  color: #26a69a;
  font-size: 12px;
  font-weight: 600;
}

/* 封存盘部分 */
.closed-disks-section {
  border-bottom: 1px solid #2a2e39;
}

.section-title {
  padding: 12px 12px 8px;
  color: #787b86;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.disk-list {
  padding: 0 12px 12px;
}

/* 盘项 */
.disk-item {
  background-color: #131722;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #2a2e39;
}

.disk-item:hover {
  background-color: #1a1f2c;
  border-color: #363a45;
  transform: translateY(-1px);
}

.disk-item.active {
  background-color: #1a1f2c;
  border-color: #26a69a;
  box-shadow: 0 2px 8px rgba(38, 166, 154, 0.2);
}

/* 盘头部 */
.disk-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.disk-id {
  color: #d1d4dc;
  font-size: 15px;
  font-weight: 600;
}

.disk-badge {
  background-color: #ef5350;
  color: #fff;
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 600;
}

/* 盘统计信息 */
.disk-stats {
  margin-bottom: 10px;
  padding: 8px;
  background-color: #0d0f14;
  border-radius: 4px;
}

.disk-time {
  color: #989aa3;
  font-size: 12px;
  font-family: emoji;
  font-weight: 700;
}

/* 盘价格范围 */
.disk-price-range {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid #2a2e39;
}

.disk-price-range .price-label {
  color: #989aa3;
  font-size: 12px;
}

.disk-price-range .price-value {
  font-size: 13px;
  font-weight: 700;
}

.disk-price-range .price-value.high {
  color: #26a69a;
}

.disk-price-range .price-value.low {
  color: #ef5350;
}

/* 当前盘数据 */
.current-disk-data {
  padding: 0;
}

.current-disk-header {
  padding: 12px;
  border-bottom: 1px solid #2a2e39;
}

.disk-label {
  color: #26a69a;
  font-size: 14px;
  font-weight: 600;
}

/* 股票信息卡片 */
.stock-info-card {
  padding: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #2a2e39;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  color: #787b86;
  font-size: 13px;
}

.info-value {
  color: #d1d4dc;
  font-size: 14px;
  font-weight: 500;
}

.info-value.price {
  color: #26a69a;
  font-size: 18px;
  font-weight: 700;
}

/* 加载、错误和空消息 */
.loading-message,
.error-message,
.empty-message {
  padding: 20px;
  text-align: center;
  color: #787b86;
  font-size: 14px;
  margin: 20px 0;
}

.error-message {
  background-color: rgba(239, 83, 80, 0.1);
  border: 1px solid #ef5350;
  color: #ef5350;
  border-radius: 4px;
}

/* 历史列表 */
.history-list {
  padding: 12px;
}

/* 历史项 */
.history-item {
  background-color: #131722;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.history-item:hover {
  background-color: #1a1f2c;
  border-color: #2a2e39;
}

.history-item.active {
  background-color: #1a1f2c;
  border-color: #26a69a;
}

/* 日期部分 */
.date-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.date-section .date {
  color: #d1d4dc;
  font-size: 14px;
  font-weight: 500;
}

.date-section .time {
  color: #787b86;
  font-size: 12px;
  margin-left: auto;
  margin-right: 8px;
}

.current-badge {
  background-color: #26a69a;
  color: #131722;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 600;
}

.date {
  display: block;
  color: #d1d4dc;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.time {
  display: block;
  color: #787b86;
  font-size: 12px;
}

/* 价格部分 */
.price-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.price-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price-info .label {
  color: #787b86;
  font-size: 12px;
}

.price-info .value {
  color: #d1d4dc;
  font-size: 12px;
  font-weight: 500;
}

/* 涨跌部分 */
.change-section {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #2a2e39;
}

.change-section.up {
  color: #26a69a;
}

.change-section.down {
  color: #ef5350;
}

.change-value {
  font-size: 14px;
  font-weight: 600;
}

.change-percent {
  font-size: 12px;
}

/* 滚动条样式 */
.history-sidebar::-webkit-scrollbar {
  width: 6px;
}

.history-sidebar::-webkit-scrollbar-track {
  background: #1e222d;
}

.history-sidebar::-webkit-scrollbar-thumb {
  background: #2a2e39;
  border-radius: 3px;
}

.history-sidebar::-webkit-scrollbar-thumb:hover {
  background: #363a45;
}
</style>