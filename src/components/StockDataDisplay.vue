<template>
  <div class="stock-data-display">
    <div class="stock-data-header">
      <h3>实时股票数据</h3>
      <button 
        @click="loadStockData" 
        :disabled="loading"
        class="btn-refresh"
      >
        {{ loading ? '加载中...' : '刷新数据' }}
      </button>
    </div>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
    
    <div v-else class="stock-data-content">
      <div class="data-grid">
        <div class="data-item">
          <span class="label">单价</span>
          <span class="value">{{ formattedUnitPrice }}</span>
        </div>
        <div class="data-item">
          <span class="label">总库存</span>
          <span class="value">{{ stockData.totalStock }}</span>
        </div>
        <div class="data-item">
          <span class="label">个人库存</span>
          <span class="value">{{ stockData.personalStock }}</span>
        </div>
        <div class="data-item">
          <span class="label">总金额</span>
          <span class="value">{{ formattedTotalMoney }}</span>
        </div>
        <div class="data-item">
          <span class="label">个人金额</span>
          <span class="value">{{ formattedPersonalMoney }}</span>
        </div>
      </div>
      
      <div class="last-updated">
        最后更新: {{ stockData.lastUpdated || '从未' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  stockData,
  loading,
  error,
  formattedTotalMoney,
  formattedPersonalMoney,
  formattedUnitPrice,
  loadStockData
} from '../stores/stockStore';
</script>

<style scoped>
.stock-data-display {
  background-color: #1e222d;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  border: 1px solid #2a2e39;
}

.stock-data-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #2a2e39;
}

.stock-data-header h3 {
  margin: 0;
  color: #d1d4dc;
  font-size: 16px;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 8px;
}

.btn-refresh, .btn-simulate {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-refresh {
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

.btn-simulate {
  background-color: #363a45;
  color: #d1d4dc;
}

.btn-simulate:hover {
  background-color: #424650;
}

.error-message {
  background-color: rgba(239, 83, 80, 0.1);
  border: 1px solid #ef5350;
  color: #ef5350;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;
}

.stock-data-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.data-item {
  background-color: #131722;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #2a2e39;
}

.data-item .label {
  display: block;
  color: #787b86;
  font-size: 12px;
  margin-bottom: 4px;
}

.data-item .value {
  display: block;
  color: #d1d4dc;
  font-size: 18px;
  font-weight: 600;
}

.last-updated {
  color: #787b86;
  font-size: 12px;
  text-align: right;
  padding-top: 12px;
  border-top: 1px solid #2a2e39;
}
</style>
