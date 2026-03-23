<!--
 * K线图组件
 * 负责显示股票的K线图和折线图
-->
<template>
  <div class="chart-wrapper">
    <!-- 图表控制按钮 -->
    <div class="chart-controls">
      <button
        :class="{ active: chartType === 'kline' }"
        @click="chartType = 'kline'"
      >
        K线
      </button>
      <button
        :class="{ active: chartType === 'line' }"
        @click="chartType = 'line'"
      >
        折线
      </button>
      <!-- AI分析结果 -->
      <!-- <div class="ai-analysis-info" v-if="aiAnalysisResult">
        <div class="ai-analysis-details">
          <div class="ai-detail-item">
            <span class="label">预测价格</span>
            <span class="value">{{
              aiAnalysisResult.nextPrice !== null ? toFixed4(aiAnalysisResult.nextPrice) : '--'
            }}</span>
          </div>
          <div class="ai-detail-item">
            <span class="label">预测股数</span>
            <span class="value">{{
              aiAnalysisResult.nextTotalStock !== null ? aiAnalysisResult.nextTotalStock : '--'
            }}</span>
          </div>
          <div class="ai-detail-item">
            <span class="label">准确率</span>
            <span class="value">{{ aiAnalysisResult.accuracy }}%</span>
          </div>
        </div>
      </div> -->
    </div>
    <!-- 加载状态 -->
    <div v-if="klineLoading" class="chart-loading">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>
    <!-- 图表容器 -->
    <div id="chart-container" ref="chartContainer"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import * as echarts from "echarts";
import {
  stockData,
  klineData,
  loadStockData,
  loadKlineData,
  klineLoading,
  klineError,
  aiAnalysisResult,
} from "../stores/stockStore";

// 图表容器引用
const chartContainer = ref<HTMLElement | null>(null);
// ECharts实例
let myChart: echarts.ECharts | null = null;
// 图表类型
const chartType = ref<"kline" | "line">("kline");

// 上涨颜色
const upColor = "#26a69a";
// 下跌颜色
const downColor = "#ef5350";

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
 * 分割数据
 * @param rawData 原始数据
 * @returns 分割后的数据
 */
function splitData(rawData: (string | number)[][]) {
  const categoryData: string[] = []; // 类别数据（时间）
  const values: number[][] = []; // K线数据
  const volumes: number[][] = []; // 成交量数据
  for (let i = 0; i < rawData.length; i++) {
    const item = [...rawData[i]];
    categoryData.push(item.shift() as string);
    values.push(item);
    volumes.push([i, item[4], item[0] > item[1] ? 1 : -1]);
  }
  return { categoryData, values, volumes };
}

/**
 * 创建K线图配置
 * @param data 分割后的数据
 * @returns K线图配置
 */
function createKlineOption(data: {
  categoryData: string[];
  values: number[][];
  volumes: number[][];
}) {
  return {
    backgroundColor: "#131722",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      backgroundColor: "rgba(25, 27, 35, 0.8)",
      borderColor: "#333",
      textStyle: { color: "#ccc" },
      formatter: function (params: any) {
        if (!params || !params.length) return "";
        let result = `<strong>${params[0].axisValue}</strong><br/>`;
        for (const item of params) {
          if (item.seriesType === "candlestick") {
            result += `开盘 ${item.data[1]}<br/> 收盘 ${item.data[2]} <br/>`;
          } else if (item.seriesType === "bar") {
            result += `总股: ${item.data[1]}<br/>`;
          }
        }
        return result;
      },
    },
    axisPointer: {
      link: [{ xAxisIndex: "all" }],
      label: { backgroundColor: "#777" },
    },
    grid: [
      { left: "5%", right: "8%", height: "60%" },
      { left: "5%", right: "8%", top: "75%", height: "15%" },
    ],
    xAxis: [
      {
        type: "category",
        data: data.categoryData,
        boundaryGap: false,
        axisLine: { onZero: false, lineStyle: { color: "#333" } },
        splitLine: { show: true, lineStyle: { color: "#2a2e39" } },
        min: "dataMin",
        max: "dataMax",
      },
      {
        type: "category",
        gridIndex: 1,
        data: data.categoryData,
        boundaryGap: false,
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        min: "dataMin",
        max: "dataMax",
      },
    ],
    yAxis: [
      {
        scale: true,
        splitLine: { show: true, lineStyle: { color: "#2a2e39" } },
        axisLine: { lineStyle: { color: "#333" } },
        position: "right",
      },
      {
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: [0, 1], start: 0, end: 100 },
      { type: "slider", xAxisIndex: [0, 1], top: "92%", start: 0, end: 100 },
    ],
    series: [
      {
        name: "K线",
        type: "candlestick",
        data: data.values,
        itemStyle: {
          color: upColor,
          color0: downColor,
          borderColor: upColor,
          borderColor0: downColor,
        },
      },
      {
        name: "总股",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: data.volumes,
        itemStyle: {
          color: function (params: any) {
            return params.data[2] === 1 ? downColor : upColor;
          },
        },
      },
    ],
  };
}

/**
 * 创建折线图配置
 * @param data 分割后的数据
 * @returns 折线图配置
 */
function createLineOption(data: {
  categoryData: string[];
  values: number[][];
  volumes: number[][];
}) {
  const lineData = data.values.map((item) => item[1]);
  const volumeData = data.volumes.map((item) => item[1]);

  return {
    backgroundColor: "#131722",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      backgroundColor: "rgba(25, 27, 35, 0.8)",
      borderColor: "#333",
      textStyle: { color: "#ccc" },
      formatter: function (params: any) {
        if (!params || !params.length) return "";
        let result = `<strong>${params[0].axisValue}</strong><br/>`;
        for (const item of params) {
          if (item.seriesType === "line") {
            result += `价格: ${item.value}<br/>`;
          } else if (item.seriesType === "bar") {
            result += `总股: ${item.value}<br/>`;
          }
        }
        return result;
      },
    },
    axisPointer: {
      link: [{ xAxisIndex: "all" }],
      label: { backgroundColor: "#777" },
    },
    grid: [
      { left: "5%", right: "8%", height: "55%" },
      { left: "5%", right: "8%", top: "70%", height: "15%" },
    ],
    xAxis: [
      {
        type: "category",
        data: data.categoryData,
        boundaryGap: false,
        axisLine: { onZero: false, lineStyle: { color: "#333" } },
        splitLine: { show: true, lineStyle: { color: "#2a2e39" } },
        min: "dataMin",
        max: "dataMax",
      },
      {
        type: "category",
        gridIndex: 1,
        data: data.categoryData,
        boundaryGap: false,
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        min: "dataMin",
        max: "dataMax",
      },
    ],
    yAxis: [
      {
        scale: true,
        splitLine: { show: true, lineStyle: { color: "#2a2e39" } },
        axisLine: { lineStyle: { color: "#333" } },
        position: "right",
      },
      {
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: [0, 1], start: 0, end: 100 },
      { type: "slider", xAxisIndex: [0, 1], top: "92%", start: 0, end: 100 },
    ],
    series: [
      {
        name: "价格",
        type: "line",
        data: lineData,
        smooth: false,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: {
          color: upColor,
          width: 2,
        },
        itemStyle: {
          color: upColor,
        },
      },
      {
        name: "总股",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumeData,
        itemStyle: {
          color: upColor,
        },
      },
    ],
  };
}

/**
 * 创建图表配置
 * @returns 图表配置
 */
function createOption() {
  const rawData =
    klineData.value.length > 0 ? klineData.value : generateDefaultKLineData();
  const data = splitData(rawData);

  if (chartType.value === "line") {
    return createLineOption(data);
  }
  return createKlineOption(data);
}

/**
 * 生成默认K线数据（当服务器没有数据时使用）
 * @returns 默认K线数据
 */
function generateDefaultKLineData() {
  const basePrice = stockData.unitPrice || 10.5;
  const rawData: (string | number)[][] = [];
  const today = new Date();

  // 生成过去15天的K线数据
  for (let i = 15; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    // 生成随机价格波动
    const open = basePrice + (Math.random() - 0.5) * 2;
    const close = open + (Math.random() - 0.5) * 3;
    const high = Math.max(open, close) + Math.random() * 1;
    const low = Math.min(open, close) - Math.random() * 1;
    const volume = 10000 + Math.floor(Math.random() * 15000);

    rawData.push([dateStr, open, close, low, high, volume]);
  }

  return rawData;
}

/**
 * 处理窗口大小变化
 */
const handleResize = () => {
  if (myChart && chartContainer.value) {
    myChart.resize();
  }
};

/**
 * 更新图表
 */
function updateChart() {
  if (myChart) {
    const option = createOption();
    myChart.setOption(option);
  }
}

// 监听图表类型变化
watch(
  () => chartType.value,
  () => {
    updateChart();
  },
);

// 监听K线图数据变化，更新图表
watch(
  () => klineData.value.length,
  () => {
    updateChart();
  },
);

// 监听股票数据变化，更新图表
watch(
  () => stockData.unitPrice,
  () => {
    updateChart();
  },
);

// 组件挂载时初始化图表
onMounted(() => {
  console.log(397, aiAnalysisResult.value);
  if (chartContainer.value) {
    const isMobile = window.innerWidth <= 768;
    const width = chartContainer.value.clientWidth + (isMobile ? 0 : 40);
    const height = chartContainer.value.clientHeight;
    myChart = echarts.init(chartContainer.value, "dark", { width, height });
    updateChart();
    window.addEventListener("resize", handleResize);

    // 加载股票数据和K线图数据
    loadStockData();
    loadKlineData();
  }
});

// 组件卸载前清理
onBeforeUnmount(() => {
  if (myChart) {
    myChart.dispose();
  }
  window.removeEventListener("resize", handleResize);
});
</script>

<style scoped>
/* 图表包装器 */
.chart-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 图表控制按钮 */
.chart-controls {
  display: flex;
  gap: 10px;
  padding: 10px;
  background-color: #1e222d;
  flex-shrink: 0;
  align-items: center;
}

/* AI分析结果 */
.ai-analysis-info {
  margin-left: auto;
  display: flex;
  gap: 15px;
  align-items: center;
}

.ai-analysis-details {
  display: flex;
  gap: 15px;
  align-items: center;
}

.ai-detail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.ai-detail-item .label {
  color: #787b86;
  font-size: 10px;
}

.ai-detail-item .value {
  color: #d1d4dc;
  font-size: 12px;
  font-weight: 500;
}

.ai-detail-item .value.上涨 {
  color: #26a69a;
}

.ai-detail-item .value.下跌 {
  color: #ef5350;
}

/* 加载状态 */
.chart-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #d1d4dc;
  font-size: 14px;
  z-index: 100;
}

/* 加载动画 */
.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #2a2e39;
  border-top: 3px solid #26a69a;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 控制按钮样式 */
.chart-controls button {
  padding: 8px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  background-color: #2a2e39;
  color: #d1d4dc;
  transition: all 0.2s;
}

.chart-controls button:hover {
  background-color: #363a45;
}

.chart-controls button.active {
  background-color: #26a69a;
  color: #131722;
}

/* 图表容器 */
#chart-container {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}
</style>
