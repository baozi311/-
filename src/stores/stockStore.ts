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
  maxStock: number | null;
  minStock: number | null;
}

interface Danmaku {
  id: number;
  diskId: number;
  text: string;
  timestamp: string;
  color: string;
  top: number;
  duration: number;
  count: number;
}

const stockData = reactive<StockData>({
  unitPrice: 0,
  totalStock: 0,
  personalStock: 0,
  totalMoney: 0,
  personalMoney: 0,
  lastUpdated: ''
});

const historyData = ref<StockData[]>([]);
const klineData = ref<KLineData[]>([]);
const diskList = ref<DiskInfo[]>([]);
const currentDiskId = ref<number | null>(null);
const danmakuMap = ref<Map<number, Danmaku[]>>(new Map());
const danmakuIdCounter = ref(0);
const danmakuLoaded = ref(false);

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
  ws = new WebSocket('ws://felinus.gnway.cc:8000');

  ws.onopen = () => {
    console.log('WebSocket连接已建立');
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
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
      Object.assign(stockData, message.data);
      stockData.lastUpdated = new Date().toLocaleString();
      currentDiskId.value = message.diskId;
      if (message.data && message.data.timestamp) {
        const lastHistory = historyData.value[historyData.value.length - 1];
        if (!lastHistory || lastHistory.timestamp !== message.data.timestamp) {
          historyData.value.push({
            ...message.data,
            timestamp: message.data.timestamp
          });
          const time = new Date(message.data.timestamp).toTimeString().split(' ')[0];
          const prevItem = historyData.value[historyData.value.length - 2];
          const open = prevItem ? prevItem.unitPrice : message.data.unitPrice;
          const close = message.data.unitPrice;
          const high = Math.max(open, close);
          const low = Math.min(open, close);
          klineData.value.push([
            time,
            open,
            close,
            low,
            high,
            message.data.totalStock
          ]);
        }
      }
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
    case 'danmaku':
      if (message.data && message.data.diskId !== undefined && message.data.text) {
        // 检查是否已经存在相同文本的弹幕
        if (danmakuMap.value.has(message.data.diskId)) {
          const existingDanmaku = danmakuMap.value.get(message.data.diskId)!.find(d => d.text === message.data.text);
          if (existingDanmaku) {
            // 增加计数
            existingDanmaku.count++;
            existingDanmaku.timestamp = message.data.timestamp || new Date().toISOString();
            return;
          }
        }
        
        const danmaku: Danmaku = {
          id: message.data.id || danmakuIdCounter.value++,
          diskId: message.data.diskId,
          text: message.data.text,
          timestamp: message.data.timestamp || new Date().toISOString(),
          color: message.data.color || getRandomColor(),
          top: message.data.top !== undefined ? message.data.top : getRandomTop(),
          duration: message.data.duration !== undefined ? message.data.duration : getRandomDuration(),
          count: message.data.count || 1,
        };
        
        if (!danmakuMap.value.has(danmaku.diskId)) {
          danmakuMap.value.set(danmaku.diskId, []);
        }
        danmakuMap.value.get(danmaku.diskId)!.push(danmaku);
      }
      break;
    case 'danmaku_history':
      if (message.data && Array.isArray(message.data.danmakuList)) {
        const diskId = message.data.diskId;
        if (diskId !== undefined) {
          danmakuMap.value.set(diskId, message.data.danmakuList);
        }
      }
      break;
  }
}

async function loadStockData() {
  loading.value = true;
  error.value = null;

  try {
    const response = await fetch('http://felinus.gnway.cc:8000/stock/latest');
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
    const response = await fetch('http://felinus.gnway.cc:8000/stock');
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
    const response = await fetch('http://felinus.gnway.cc:8000/stock/kline');
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
    const response = await fetch('http://felinus.gnway.cc:8000/disks');
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
    const response = await fetch(`http://felinus.gnway.cc:8000/disks/${diskId}`);
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
    const response = await fetch(`http://felinus.gnway.cc:8000/disks/${diskId}/kline`);
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

async function loadDanmakuFromFile() {
  try {
    const response = await fetch('/danmaku-data.json');
    const data = await response.json();
    
    if (data.danmakuDisks && Array.isArray(data.danmakuDisks)) {
      data.danmakuDisks.forEach((diskData: any) => {
        const diskId = diskData.diskId;
        const danmakuList = diskData.danmakuList;
        if (diskId !== undefined && Array.isArray(danmakuList)) {
          danmakuMap.value.set(diskId, danmakuList);
          // Update danmakuIdCounter to be higher than the highest id in the loaded data
          danmakuList.forEach((danmaku: Danmaku) => {
            if (danmaku.id > danmakuIdCounter.value) {
              danmakuIdCounter.value = danmaku.id + 1;
            }
          });
        }
      });
      danmakuLoaded.value = true;
      console.log('Danmaku data loaded from danmaku-data.json');
    }
  } catch (error) {
    console.error('Error loading danmaku data:', error);
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

const colors = [
  "#ffffff",
  "#ffeb3b",
  "#00bcd4",
  "#ff5722",
  "#9c27b0",
  "#4caf50",
  "#e91e63",
];

function getRandomColor(): string {
  return colors[Math.floor(Math.random() * colors.length)];
}

function getRandomTop(): number {
  return Math.random() * 80 + 5;
}

function getRandomDuration(): number {
  return 15 + Math.random() * 3; // 移动速度
}

function addDanmaku(diskId: number, text: string): Danmaku {
  // 检查是否已经存在相同文本的弹幕
  if (danmakuMap.value.has(diskId)) {
    const existingDanmaku = danmakuMap.value.get(diskId)!.find(d => d.text === text);
    if (existingDanmaku) {
      // 增加计数
      existingDanmaku.count++;
      existingDanmaku.timestamp = new Date().toISOString();
      return existingDanmaku;
    }
  }

  const danmaku: Danmaku = {
    id: danmakuIdCounter.value++,
    diskId,
    text,
    timestamp: new Date().toISOString(),
    color: getRandomColor(),
    top: getRandomTop(),
    duration: getRandomDuration(),
    count: 1,
  };

  if (!danmakuMap.value.has(diskId)) {
    danmakuMap.value.set(diskId, []);
  }
  danmakuMap.value.get(diskId)!.push(danmaku);

  return danmaku;
}

function sendDanmaku(diskId: number, text: string) {
  const danmaku = addDanmaku(diskId, text);
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'danmaku',
      data: danmaku
    }));
  }
  
  // Save danmaku to localStorage for persistence
  saveDanmakuToLocalStorage();
}

function saveDanmakuToLocalStorage() {
  try {
    const danmakuObject: Record<number, Danmaku[]> = {};
    danmakuMap.value.forEach((danmakuList, diskId) => {
      danmakuObject[diskId] = danmakuList;
    });
    localStorage.setItem('danmaku', JSON.stringify(danmakuObject));
    console.log('Danmaku data saved to localStorage');
  } catch (error) {
    console.error('Error saving danmaku to localStorage:', error);
  }
}

function loadDanmakuFromLocalStorage() {
  try {
    const storedData = localStorage.getItem('danmaku');
    if (storedData) {
      const danmakuObject = JSON.parse(storedData);
      Object.entries(danmakuObject).forEach(([diskIdStr, danmakuList]) => {
        const diskId = parseInt(diskIdStr);
        if (!isNaN(diskId) && Array.isArray(danmakuList)) {
          danmakuMap.value.set(diskId, danmakuList);
          // Update danmakuIdCounter
          danmakuList.forEach((danmaku: Danmaku) => {
            if (danmaku.id > danmakuIdCounter.value) {
              danmakuIdCounter.value = danmaku.id + 1;
            }
          });
        }
      });
      danmakuLoaded.value = true;
      console.log('Danmaku data loaded from localStorage');
    }
  } catch (error) {
    console.error('Error loading danmaku from localStorage:', error);
  }
}

function getDanmakuByDiskId(diskId: number): Danmaku[] {
  return danmakuMap.value.get(diskId) || [];
}

function clearDanmakuByDiskId(diskId: number) {
  danmakuMap.value.delete(diskId);
}

function getCurrentDiskDanmaku(): Danmaku[] {
  if (currentDiskId.value === null) return [];
  return getDanmakuByDiskId(currentDiskId.value);
}

connectWebSocket();

// Load danmaku data when the store is initialized
(async () => {
  // First try to load from JSON file
  await loadDanmakuFromFile();
  // Then try to load from localStorage (which may have newer data)
  loadDanmakuFromLocalStorage();
})();

export {
  stockData,
  historyData,
  klineData,
  diskList,
  currentDiskId,
  danmakuMap,
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
  loadStockData,
  loadHistoryData,
  loadKlineData,
  loadDiskList,
  loadDiskData,
  loadDiskKline,
  disconnectWebSocket,
  addDanmaku,
  sendDanmaku,
  getDanmakuByDiskId,
  clearDanmakuByDiskId,
  getCurrentDiskDanmaku,
};

export type { Danmaku };
