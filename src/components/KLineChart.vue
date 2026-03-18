<template>
  <div class="chart-wrapper">
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
    </div>
    <div v-if="klineLoading" class="chart-loading">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>
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
} from "../stores/stockStore";

const chartContainer = ref<HTMLElement | null>(null);
let myChart: echarts.ECharts | null = null;
const chartType = ref<"kline" | "line">("kline");

const upColor = "#26a69a";
const downColor = "#ef5350";

function splitData(rawData: (string | number)[][]) {
  const categoryData: string[] = [];
  const values: number[][] = [];
  const volumes: number[][] = [];
  for (let i = 0; i < rawData.length; i++) {
    const item = [...rawData[i]];
    categoryData.push(item.shift() as string);
    values.push(item);
    volumes.push([i, item[4], item[0] > item[1] ? 1 : -1]);
  }
  return { categoryData, values, volumes };
}

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

function createOption() {
  const rawData =
    klineData.value.length > 0 ? klineData.value : generateDefaultKLineData();
  const data = splitData(rawData);

  if (chartType.value === "line") {
    return createLineOption(data);
  }
  return createKlineOption(data);
}

// 生成默认K线数据（当服务器没有数据时使用）
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

const handleResize = () => {
  if (myChart && chartContainer.value) {
    myChart.resize();
  }
};

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

onMounted(() => {
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

onBeforeUnmount(() => {
  if (myChart) {
    myChart.dispose();
  }
  window.removeEventListener("resize", handleResize);
});
</script>

<style scoped>
.chart-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chart-controls {
  display: flex;
  gap: 10px;
  padding: 10px;
  background-color: #1e222d;
  flex-shrink: 0;
}

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

#chart-container {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}
</style>
