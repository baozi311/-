import { ref, reactive, computed, onUnmounted } from 'vue';

interface StockData {
  unitPrice: number;
  totalStock: number;
  personalStock: number;
  totalMoney: number;
  personalMoney: number;
  lastUpdated?: string;
  timestamp?: string;
}

type KLineData = (string | number)[];

interface DiskInfo {
  id: number;
  startTime: string;
  endTime?: string;
  isClosed: boolean;
  dataCount: number;
  highPrice: number | null;
  lowPrice: number | null;
}

const stockData = reactive<StockData>({
  unitPrice: 0,
  totalStock: 0,
  personalStock: 0,
  totalMoney: 0,
  personalMoney: 0,
  lastUpdated: ''
});

// 从 localStorage 读取上一次价格
const savedPrice = localStorage.getItem('previousUnitPrice');
let previousUnitPrice = savedPrice ? parseFloat(savedPrice) : 0;

const historyData = ref<StockData[]>([]);
const klineData = ref<KLineData[]>([]);
const diskList = ref<DiskInfo[]>([]);
const currentDiskId = ref<number | null>(null);

const loading = ref(false);
const historyLoading = ref(false);
const klineLoading = ref(false);
const diskLoading = ref(false);

const error = ref<string | null>(null);
const historyError = ref<string | null>(null);
const klineError = ref<string | null>(null);
const diskError = ref<string | null>(null);

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const formattedTotalMoney = computed(() => {
  return formatCurrency(stockData.totalMoney);
});

const formattedPersonalMoney = computed(() => {
  return formatCurrency(stockData.personalMoney);
});

const formattedUnitPrice = computed(() => {
  return toFixed4(stockData.unitPrice);
});

function toFixed4(value: number): string {
  const str = String(value);
  const parts = str.split(".");
  if (parts.length === 1) return parts[0] + ".0000";
  return parts[0] + "." + parts[1].padEnd(4, "0").slice(0, 4);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 4
  }).format(amount);
}

function connectWebSocket() {
  ws = new WebSocket('ws://localhost:3000');

  ws.onopen = () => {
    console.log('WebSocket连接已建立');
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    // 连接成功后加载初始数据
    loadStockData();
    loadDiskList();
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    } catch (err) {
      console.error('解析WebSocket消息失败:', err);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket连接已关闭，尝试重新连接...');
    reconnectTimer = setTimeout(() => {
      connectWebSocket();
    }, 3000);
  };

  ws.onerror = (err) => {
    console.error('WebSocket错误:', err);
  };
}

function handleWebSocketMessage(message: any) {
  switch (message.type) {
    case 'stock_update':
      // 保存上一次价格到 localStorage
      localStorage.setItem('previousUnitPrice', String(stockData.unitPrice));
      previousUnitPrice = stockData.unitPrice;
      Object.assign(stockData, message.data);
      stockData.lastUpdated = new Date().toLocaleString();
      currentDiskId.value = message.diskId;
      
      // 更新历史数据
      historyData.value.push({ ...message.data });
      // 更新K线图数据
      const time = new Date(message.data.timestamp).toTimeString().split(' ')[0];
      klineData.value.push([time, message.data.unitPrice, message.data.unitPrice, message.data.unitPrice, message.data.unitPrice, message.data.totalStock]);
      break;
    case 'disks_update':
      diskList.value = message.data;
      currentDiskId.value = message.currentDiskId;
      break;
    case 'disk_created':
      if (message.currentDiskId) {
        currentDiskId.value = message.currentDiskId;
        const existingDisk = diskList.value.find(d => d.id === message.data.id);
        if (!existingDisk) {
          diskList.value.push({
            ...message.data,
            highPrice: null,
            lowPrice: null
          });
        }
      }
      break;
    case 'disk_closed':
      const closedDisk = diskList.value.find(d => d.id === message.data.id);
      if (closedDisk) {
        closedDisk.isClosed = true;
        closedDisk.endTime = message.data.endTime;
        closedDisk.highPrice = message.data.highPrice;
        closedDisk.lowPrice = message.data.lowPrice;
        closedDisk.dataCount = message.data.dataCount;
      }
      break;
  }
}

async function loadStockData() {
  loading.value = true;
  error.value = null;

  try {
    const response = await fetch('http://localhost:3000/stock/latest');
    const data = await response.json();

    if (data.success && data.data) {
      Object.assign(stockData, data.data);
      stockData.lastUpdated = new Date().toLocaleString();
      currentDiskId.value = data.diskId || null;
    } else {
      error.value = '没有可用的股票数据';
    }
  } catch (err) {
    error.value = '加载股票数据失败';
    console.error('加载股票数据失败:', err);
  } finally {
    loading.value = false;
  }
}

async function loadHistoryData() {
  historyLoading.value = true;
  historyError.value = null;

  try {
    const response = await fetch('http://localhost:3000/stock');
    const data = await response.json();

    if (data.success && Array.isArray(data.data)) {
      historyData.value = data.data;
      currentDiskId.value = data.diskId || null;
    } else {
      historyError.value = '没有可用的历史股票数据';
    }
  } catch (err) {
    historyError.value = '加载历史股票数据失败';
    console.error('加载历史股票数据失败:', err);
  } finally {
    historyLoading.value = false;
  }
}

async function loadKlineData() {
  klineLoading.value = true;
  klineError.value = null;

  try {
    const response = await fetch('http://localhost:3000/stock/kline');
    const data = await response.json();

    if (data.success && Array.isArray(data.data)) {
      klineData.value = data.data;
      currentDiskId.value = data.diskId || null;
    } else {
      klineError.value = '没有可用的K线图数据';
    }
  } catch (err) {
    klineError.value = '加载K线图数据失败';
    console.error('加载K线图数据失败:', err);
  } finally {
    klineLoading.value = false;
  }
}

async function loadDiskList() {
  diskLoading.value = true;
  diskError.value = null;

  try {
    const response = await fetch('http://localhost:3000/disks');
    const data = await response.json();

    if (data.success && Array.isArray(data.data)) {
      diskList.value = data.data;
      currentDiskId.value = data.currentDiskId || null;
    } else {
      diskError.value = '没有可用的股票盘';
    }
  } catch (err) {
    diskError.value = '加载股票盘列表失败';
    console.error('加载股票盘列表失败:', err);
  } finally {
    diskLoading.value = false;
  }
}

async function loadDiskData(diskId: number) {
  diskLoading.value = true;
  diskError.value = null;

  try {
    const response = await fetch(`http://localhost:3000/disks/${diskId}`);
    const data = await response.json();

    if (data.success && Array.isArray(data.data)) {
      historyData.value = data.data;
      currentDiskId.value = data.diskId || null;
    } else {
      diskError.value = '加载股票盘数据失败';
    }
  } catch (err) {
    diskError.value = '加载股票盘数据失败';
    console.error('加载股票盘数据失败:', err);
  } finally {
    diskLoading.value = false;
  }
}

async function loadDiskKline(diskId: number) {
  klineLoading.value = true;
  klineError.value = null;

  try {
    const response = await fetch(`http://localhost:3000/disks/${diskId}/kline`);
    const data = await response.json();

    if (data.success && Array.isArray(data.data)) {
      klineData.value = data.data;
      currentDiskId.value = data.diskId || null;
    } else {
      klineError.value = '加载K线图数据失败';
    }
  } catch (err) {
    klineError.value = '加载K线图数据失败';
    console.error('加载K线图数据失败:', err);
  } finally {
    klineLoading.value = false;
  }
}

function disconnectWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

connectWebSocket();

export {
  stockData,
  historyData,
  klineData,
  diskList,
  currentDiskId,
  loading,
  historyLoading,
  klineLoading,
  diskLoading,
  error,
  historyError,
  klineError,
  diskError,
  formattedTotalMoney,
  formattedPersonalMoney,
  formattedUnitPrice,
  previousUnitPrice,
  loadStockData,
  loadHistoryData,
  loadKlineData,
  loadDiskList,
  loadDiskData,
  loadDiskKline,
  disconnectWebSocket
};
