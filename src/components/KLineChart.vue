<template>
  <div id="chart-container" ref="chartContainer"></div>
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

function createOption() {
  // 使用从服务器获取的K线图数据，如果没有数据则使用模拟数据
  const rawData =
    klineData.value.length > 0 ? klineData.value : generateDefaultKLineData();
  const data = splitData(rawData);

  return {
    backgroundColor: "#131722",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      backgroundColor: "rgba(25, 27, 35, 0.8)",
      borderColor: "#333",
      textStyle: { color: "#ccc" },
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
        // name: "NVDA",
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
        name: "Volume",
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
    const width = chartContainer.value.clientWidth + 40;
    const height = chartContainer.value.clientHeight;
    myChart.resize({ width, height });
  }
};

function updateChart() {
  if (myChart) {
    const option = createOption();
    myChart.setOption(option);
  }
}

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
    const width = chartContainer.value.clientWidth + 40;
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
#chart-container {
  width: 100%;
  height: 95vh;
  overflow: hidden;
}
</style>
