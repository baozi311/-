<template>
  <div class="stock-sidebar" :class="{ collapsed }">
    <button class="toggle-btn" @click="emit('toggle')">
      {{ collapsed ? "«" : "»" }}
    </button>
    <div class="sidebar-content" v-show="!collapsed">
      <div class="sidebar-header">
        <h3>股票信息</h3>
        <button @click="loadStockData" :disabled="loading" class="btn-refresh">
          {{ loading ? "加载中..." : "刷新" }}
        </button>
      </div>

      <div class="stock-info">
        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <template v-else>
          <div class="stock-header">
            <span class="stock-symbol">{{ symbol }}</span>
            <span class="stock-name">{{ name }}</span>
          </div>

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

          <div class="stock-details">
            <div class="detail-item">
              <span class="label">单价</span>
              <span class="value">{{ formattedUnitPrice }}</span>
            </div>
            <div class="detail-item">
              <span class="label">总库存</span>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, defineProps, defineEmits } from "vue";
import {
  stockData,
  historyData,
  loading,
  error,
  formattedTotalMoney,
  formattedPersonalMoney,
  formattedUnitPrice,
  loadStockData,
  loadHistoryData,
} from "../stores/stockStore";

interface Props {
  collapsed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false,
});

const emit = defineEmits<{
  (e: "toggle"): void;
}>();

// 股票基本信息
const symbol = "IIROSE";
const name = "Rosebush Garden";

// 计算涨跌（使用历史数据）
const priceChange = computed(() => {
  if (historyData.value.length < 2) return 0;
  const latest = historyData.value[historyData.value.length - 1];
  const previous = historyData.value[historyData.value.length - 2];
  return latest.unitPrice - previous.unitPrice;
});

const percentChange = computed(() => {
  if (historyData.value.length < 2) return 0;
  const latest = historyData.value[historyData.value.length - 1];
  const previous = historyData.value[historyData.value.length - 2];
  if (previous.unitPrice === 0) return 0;
  return ((latest.unitPrice - previous.unitPrice) / previous.unitPrice) * 100;
});

const priceChangeClass = computed(() => {
  return priceChange.value >= 0 ? "up" : "down";
});

function toFixed4(value: number): string {
  const str = String(value);
  const parts = str.split(".");
  if (parts.length === 1) return parts[0] + ".0000";
  return parts[0] + "." + parts[1].padEnd(4, "0").slice(0, 4);
}

// 从stockStore获取数据
const totalStock = computed(() => stockData.totalStock);
const personalStock = computed(() => stockData.personalStock);
const lastUpdated = computed(() => stockData.lastUpdated);

// 组件挂载时加载数据
onMounted(() => {
  loadStockData();
  loadHistoryData();
});
</script>

<style scoped>
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

.stock-sidebar.collapsed {
  width: 00px;
}

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

.stock-info {
  padding: 20px;
}

.error-message {
  background-color: rgba(239, 83, 80, 0.1);
  border: 1px solid #ef5350;
  color: #ef5350;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;
}

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
</style>
