<!--
 * 股票侧边栏组件
 * 负责显示股票信息和弹幕功能
-->
<template>
  <div class="stock-sidebar" :class="{ collapsed }">
    <div class="sidebar-content" v-show="!collapsed">
      <!-- 侧边栏头部 -->
      <div class="sidebar-header">
        <h3>股票信息</h3>
        <button @click="loadStockData" :disabled="loading" class="btn-refresh">
          {{ loading ? "加载中..." : "刷新" }}
        </button>
      </div>

      <!-- 股票信息 -->
      <div class="stock-info">
        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <template v-else>
          <!-- 股票名称和代码 -->
          <div class="stock-header">
            <span class="stock-symbol">{{ symbol }}</span>
            <span class="stock-name">{{ name }}</span>
          </div>

          <!-- 股票价格区域 -->
          <div class="stock-price-section">
            <div class="current-price" :class="priceChangeClass">
              {{ formattedUnitPrice }}
            </div>
            <div class="price-change" :class="priceChangeClass">
              <span v-if="priceChange >= 0">+</span>
              {{ toFixed4(priceChange) }}
              <span class="percent-change">
                ({{ toFixed4(percentChange) }}%)
              </span>
            </div>
          </div>

          <!-- 股票详情 -->
          <div class="stock-details">
            <div class="detail-item">
              <span class="label">单价</span>
              <span class="value">{{ formattedUnitPrice }}</span>
            </div>
            <div class="detail-item">
              <span class="label">总股数</span>
              <span class="value">{{ totalStock }}</span>
            </div>
            <div class="detail-item">
              <span class="label">总金额</span>
              <span class="value">{{ formattedTotalMoney }}</span>
            </div>
            <!-- <div class="detail-item">
            <span class="label">个人库存</span>
            <span class="value">{{ personalStock }}</span>
          </div>
          <div class="detail-item">
            <span class="label">个人金额</span>
            <span class="value">{{ formattedPersonalMoney }}</span>
          </div> -->
            <div class="detail-item">
              <span class="label">最后更新</span>
              <span class="value">{{ lastUpdated || "从未" }}</span>
            </div>
          </div>
        </template>
      </div>

      <!-- 弹幕区域 -->
      <div class="danmaku-section">
        <div class="danmaku-header">
          <span class="danmaku-title">弹幕</span>
          <div class="danmaku-status">
            <span
              v-if="currentDisk && currentDisk.isClosed"
              class="disk-closed-badge"
              >已封盘</span
            >
            <button @click="toggleDanmaku" class="btn-toggle-danmaku">
              {{ showDanmaku ? "隐藏" : "显示" }}
            </button>
          </div>
        </div>
        <div class="danmaku-buttons">
          <button
            v-for="danmaku in presetDanmaku"
            :key="danmaku"
            @click="sendPresetDanmaku(danmaku)"
            :disabled="!canSendDanmaku"
            class="danmaku-button"
            :class="{ disabled: !canSendDanmaku }"
          >
            {{ danmaku }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  stockData,
  historyData,
  loading,
  error,
  aiAnalysisResult,
  formattedTotalMoney,
  formattedPersonalMoney,
  formattedUnitPrice,
  loadStockData,
  loadHistoryData,
  currentDiskId,
  diskList,
  sendDanmaku as sendDanmakuToServer,
} from "../stores/stockStore";

/**
 * 组件属性接口
 */
interface Props {
  collapsed?: boolean; // 是否折叠
}

// 定义组件属性
const props = withDefaults(defineProps<Props>(), {
  collapsed: false, // 默认不折叠
});

// 定义组件事件
const emit = defineEmits<{
  (e: "toggle"): void; // 切换折叠状态
  (e: "send-danmaku", text: string): void; // 发送弹幕
  (e: "toggle-danmaku", show: boolean): void; // 切换弹幕显示
}>();

// 弹幕文本
const danmakuText = ref("");
// 是否显示弹幕
const showDanmaku = ref(true);

// 预设弹幕
const presetDanmaku = [
  "会不会我跑了他就涨啊",
  "这股最好是早似喵",
  "猫猫招手",
  "史",
  "被做局了",
  "观望中",
  "冲啊！",
  "稳了稳了",
  "回调了回调了",
  "牛市要来了",
];

/**
 * 当前盘信息
 */
const currentDisk = computed(() => {
  if (currentDiskId.value === null) return null;
  return diskList.value.find((d) => d.id === currentDiskId.value) || null;
});

/**
 * 是否可以发送弹幕
 */
const canSendDanmaku = computed(() => {
  return currentDisk.value && !currentDisk.value.isClosed;
});

/**
 * 发送弹幕
 */
function sendDanmaku() {
  if (danmakuText.value.trim() && currentDiskId.value !== null) {
    sendDanmakuToServer(currentDiskId.value, danmakuText.value);
    emit("send-danmaku", danmakuText.value);
    danmakuText.value = "";
  }
}

/**
 * 发送预设弹幕
 * @param text 弹幕内容
 */
function sendPresetDanmaku(text: string) {
  if (currentDiskId.value !== null) {
    sendDanmakuToServer(currentDiskId.value, text);
    emit("send-danmaku", text);
  }
}

/**
 * 切换弹幕显示
 */
function toggleDanmaku() {
  showDanmaku.value = !showDanmaku.value;
  emit("toggle-danmaku", showDanmaku.value);
}

// 股票代码
const symbol = "IIROSE";
// 股票名称
const name = "Rosebush Garden";

/**
 * 价格变化
 */
const priceChange = computed(() => {
  if (historyData.value.length < 2) return 0;
  const latest = historyData.value[historyData.value.length - 1];
  const previous = historyData.value[historyData.value.length - 2];
  return latest.unitPrice - previous.unitPrice;
});

/**
 * 价格变化百分比
 */
const percentChange = computed(() => {
  if (historyData.value.length < 2) return 0;
  const latest = historyData.value[historyData.value.length - 1];
  const previous = historyData.value[historyData.value.length - 2];
  if (previous.unitPrice === 0) return 0;
  return ((latest.unitPrice - previous.unitPrice) / previous.unitPrice) * 100;
});

/**
 * 价格变化样式类
 */
const priceChangeClass = computed(() => {
  return priceChange.value >= 0 ? "up" : "down";
});

/**
 * 将数字格式化为4位小数
 * @param value 要格式化的数字
 * @returns 格式化后的字符串
 */
function toFixed4(value: number): string {
  const str = String(value);
  const parts = str.split(".");
  if (parts.length === 1) return parts[0] + ".0000";
  return parts[0] + "." + parts[1].padEnd(4, "0").slice(0, 4);
}

/**
 * 格式化时间戳
 * @param timestamp 时间戳字符串
 * @returns 格式化后的时间字符串
 */
function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

// 总股数
const totalStock = computed(() => stockData.totalStock);
// 个人库存
const personalStock = computed(() => stockData.personalStock);
// 最后更新时间
const lastUpdated = computed(() => stockData.lastUpdated);

// 组件挂载时加载数据
onMounted(() => {
  loadStockData();
  loadHistoryData();
});
</script>

<style scoped>
/* 股票侧边栏 */
.stock-sidebar {
  width: 300px;
  background-color: #1e222d;
  border-left: 1px solid #2a2e39;
  height: 100vh;
  overflow-y: auto;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 100;
  transition: width 0.3s ease;
}

/* 折叠状态 */
.stock-sidebar.collapsed {
  width: 00px;
}

/* 切换按钮 */
.toggle-btn {
  position: absolute;
  left: -20px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 60px;
  background-color: #2a2e39;
  border: none;
  border-radius: 4px 0 0 4px;
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

/* 股票信息 */
.stock-info {
  padding: 20px;
}

/* 错误消息 */
.error-message {
  background-color: rgba(239, 83, 80, 0.1);
  border: 1px solid #ef5350;
  color: #ef5350;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;
}

/* 股票头部 */
.stock-header {
  margin-bottom: 20px;
}

.stock-symbol {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #d1d4dc;
  margin-bottom: 4px;
}

.stock-name {
  display: block;
  font-size: 14px;
  color: #787b86;
}

/* 股票价格区域 */
.stock-price-section {
  margin-bottom: 24px;
  padding: 16px;
  background-color: #131722;
  border-radius: 8px;
}

.current-price {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
}

.current-price.up {
  color: #26a69a;
}

.current-price.down {
  color: #ef5350;
}

.price-change {
  font-size: 16px;
  font-weight: 500;
}

.price-change.up {
  color: #26a69a;
}

.price-change.down {
  color: #ef5350;
}

.percent-change {
  margin-left: 4px;
}

/* 股票详情 */
.stock-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #2a2e39;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-item .label {
  color: #787b86;
  font-size: 14px;
}

.detail-item .value {
  color: #d1d4dc;
  font-size: 14px;
  font-weight: 500;
}

/* 滚动条样式 */
.stock-sidebar::-webkit-scrollbar {
  width: 6px;
}

.stock-sidebar::-webkit-scrollbar-track {
  background: #1e222d;
}

.stock-sidebar::-webkit-scrollbar-thumb {
  background: #2a2e39;
  border-radius: 3px;
}

.stock-sidebar::-webkit-scrollbar-thumb:hover {
  background: #363a45;
}

/* 弹幕区域 */
.danmaku-section {
  padding: 20px;
  border-top: 1px solid #2a2e39;
}

.danmaku-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.danmaku-title {
  color: #d1d4dc;
  font-size: 14px;
  font-weight: 600;
}

.danmaku-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.disk-closed-badge {
  background-color: #ef5350;
  color: #fff;
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.btn-toggle-danmaku {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: #2a2e39;
  color: #d1d4dc;
}

.btn-toggle-danmaku:hover {
  background-color: #363a45;
}

/* 弹幕输入包装器 */
.danmaku-input-wrapper {
  display: flex;
  gap: 8px;
}

/* 弹幕输入框 */
.danmaku-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  background-color: #131722;
  color: #d1d4dc;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

.danmaku-input:focus {
  border-color: #26a69a;
}

/* 弹幕按钮 */
.danmaku-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.danmaku-button {
  padding: 8px 12px;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: #131722;
  color: #d1d4dc;
  text-align: center;
}

.danmaku-button:hover:not(:disabled) {
  background-color: #26a69a;
  border-color: #26a69a;
  color: #131722;
}

.danmaku-button.disabled {
  background-color: #0d0f14;
  color: #787b86;
  border-color: #2a2e39;
  cursor: not-allowed;
}

.danmaku-input::placeholder {
  color: #787b86;
}
</style>
