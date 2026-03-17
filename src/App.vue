<script setup lang="ts">
import KLineChart from "./components/KLineChart.vue";
import StockSidebar from "./components/StockSidebar.vue";
import HistorySidebar from "./components/HistorySidebar.vue";
// import StockDataDisplay from "./components/StockDataDisplay.vue";
</script>

<template>
  <div class="app-container">
    <HistorySidebar />
    <div class="chart-section">
      <!-- <StockDataDisplay /> -->
      <KLineChart />
    </div>
    <StockSidebar />
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
}

.chart-section {
  flex: 1;
  margin-left: 280px;
  margin-right: 300px;
  padding: 20px;
  overflow-y: auto;
}
</style>
