/**
 * 股票数据状态管理
 * 负责管理股票数据、K线图数据、股票盘信息和弹幕数据
 */
import { ref, reactive, computed, onUnmounted } from 'vue';

// API基础地址
const API_BASE_URL = 'http://felinus.gnway.cc:8000';

/**
 * 股票数据接口
 */
interface StockData {
  unitPrice: number;        // 单价
  totalStock: number;       // 总股数
  personalStock: number;    // 个人股数
  totalMoney: number;       // 总资金
  personalMoney: number;    // 个人资金
  lastUpdated?: string;     // 最后更新时间
  timestamp?: string;       // 时间戳
}

/**
 * AI分析结果接口
 */
interface AIAnalysisResult {
  nextPrice: number;        // 预测的下一次股票价格
  trend: 'up' | 'down';     // 预测趋势：上涨或下跌
  accuracy: number;         // AI评估的准确率
  timestamp: string;        // 分析时间戳
}

/**
 * K线图数据类型
 */
type KLineData = (string | number)[];

/**
 * 股票盘信息接口
 */
interface DiskInfo {
  id: number;               // 盘ID
  startTime: string;        // 开始时间
  endTime?: string;         // 结束时间
  isClosed: boolean;        // 是否关闭
  dataCount: number;        // 数据数量
  highPrice: number | null; // 最高价
  lowPrice: number | null;  // 最低价
  maxStock: number | null;  // 最大股数
  minStock: number | null;  // 最小股数
}

/**
 * 弹幕接口
 */
interface Danmaku {
  id: number;               // 弹幕ID
  diskId: number;           // 盘ID
  text: string;             // 弹幕内容
  timestamp: string;        // 时间戳
  color: string;            // 弹幕颜色
  top: number;              // 弹幕位置
  duration: number;         // 弹幕持续时间
  count: number;            // 弹幕重复次数
}

// 股票数据状态
const stockData = reactive<StockData>({
  unitPrice: 0,
  totalStock: 0,
  personalStock: 0,
  totalMoney: 0,
  personalMoney: 0,
  lastUpdated: ''
});

// 历史数据状态
const historyData = ref<StockData[]>([]);
// K线图数据状态
const klineData = ref<KLineData[]>([]);
// 股票盘列表状态
const diskList = ref<DiskInfo[]>([]);
// 当前盘ID状态
const currentDiskId = ref<number | null>(null);
// 弹幕映射状态，按盘ID分组
const danmakuMap = ref<Map<number, Danmaku[]>>(new Map());
// 弹幕ID计数器
const danmakuIdCounter = ref(0);
// 弹幕加载状态
const danmakuLoaded = ref(false);

// 加载状态
const loading = ref(false);
const historyLoading = ref(false);
const klineLoading = ref(false);
const diskLoading = ref(false);

// 错误状态
const error = ref<string | null>(null);
const historyError = ref<string | null>(null);
const klineError = ref<string | null>(null);
const diskError = ref<string | null>(null);

// AI分析结果状态
const aiAnalysisResult = ref<AIAnalysisResult | null>(null);

// WebSocket连接
let ws: WebSocket | null = null;
// 重连定时器
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 格式化总资金
 */
const formattedTotalMoney = computed(() => {
  return formatCurrency(stockData.totalMoney);
});

/**
 * 格式化个人资金
 */
const formattedPersonalMoney = computed(() => {
  return formatCurrency(stockData.personalMoney);
});

/**
 * 格式化单价，保留4位小数
 */
const formattedUnitPrice = computed(() => {
  return toFixed4(stockData.unitPrice);
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
 * 格式化货币
 * @param amount 金额
 * @returns 格式化后的货币字符串
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 4
  }).format(amount);
}

/**
 * 连接WebSocket
 */
function connectWebSocket() {
  ws = new WebSocket(API_BASE_URL.replace('http', 'ws'));

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

/**
 * 处理WebSocket消息
 * @param message 消息对象
 */
function handleWebSocketMessage(message: any) {
  switch (message.type) {
    case 'stock_update':
      // 更新股票数据
      Object.assign(stockData, message.data);
      stockData.lastUpdated = new Date().toLocaleString();
      currentDiskId.value = message.diskId;
      if (message.data && message.data.timestamp) {
        const lastHistory = historyData.value[historyData.value.length - 1];
        if (!lastHistory || lastHistory.timestamp !== message.data.timestamp) {
          // 添加历史数据
          historyData.value.push({
            ...message.data,
            timestamp: message.data.timestamp
          });
          // 计算K线数据
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
      // 处理AI分析结果
      if (message.data && message.data.aiAnalysis) {
        aiAnalysisResult.value = message.data.aiAnalysis;
      }
      break;
    case 'disks_update':
      // 更新股票盘列表
      diskList.value = message.data;
      currentDiskId.value = message.currentDiskId;
      break;
    case 'disk_created':
      // 处理新创建的股票盘
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
      // 处理关闭的股票盘
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
      // 处理弹幕消息
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
        
        // 创建新弹幕
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
        
        // 添加弹幕到映射
        if (!danmakuMap.value.has(danmaku.diskId)) {
          danmakuMap.value.set(danmaku.diskId, []);
        }
        danmakuMap.value.get(danmaku.diskId)!.push(danmaku);
      }
      break;
    case 'danmaku_history':
      // 处理弹幕历史数据
      if (message.data && Array.isArray(message.data.danmakuList)) {
        const diskId = message.data.diskId;
        if (diskId !== undefined) {
          danmakuMap.value.set(diskId, message.data.danmakuList);
        }
      }
      break;
  }
}

/**
 * 加载股票数据
 */
async function loadStockData() {
  loading.value = true;
  error.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/stock/latest`);
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

/**
 * 加载历史股票数据
 */
async function loadHistoryData() {
  historyLoading.value = true;
  historyError.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/stock`);
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

/**
 * 加载K线图数据
 */
async function loadKlineData() {
  klineLoading.value = true;
  klineError.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/stock/kline`);
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

/**
 * 加载股票盘列表
 */
async function loadDiskList() {
  diskLoading.value = true;
  diskError.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/disks`);
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

/**
 * 加载指定股票盘的数据
 * @param diskId 股票盘ID
 */
async function loadDiskData(diskId: number) {
  diskLoading.value = true;
  diskError.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/disks/${diskId}`);
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

/**
 * 加载指定股票盘的K线图数据
 * @param diskId 股票盘ID
 */
async function loadDiskKline(diskId: number) {
  klineLoading.value = true;
  klineError.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/disks/${diskId}/kline`);
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

/**
 * 从文件加载弹幕数据
 */
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
          // 更新弹幕ID计数器，确保新弹幕ID唯一
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

/**
 * 断开WebSocket连接
 */
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

// 弹幕颜色列表
const colors = [
  "#ffffff",
  "#ffeb3b",
  "#00bcd4",
  "#ff5722",
  "#9c27b0",
  "#4caf50",
  "#e91e63",
];

/**
 * 获取随机颜色
 * @returns 随机颜色代码
 */
function getRandomColor(): string {
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * 获取随机弹幕位置
 * @returns 随机位置（0-100）
 */
function getRandomTop(): number {
  return Math.random() * 80 + 5;
}

/**
 * 获取随机弹幕持续时间
 * @returns 随机持续时间
 */
function getRandomDuration(): number {
  return 15 + Math.random() * 3; // 移动速度
}

/**
 * 添加弹幕
 * @param diskId 股票盘ID
 * @param text 弹幕内容
 * @returns 创建的弹幕对象
 */
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

  // 创建新弹幕
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

  // 添加弹幕到映射
  if (!danmakuMap.value.has(diskId)) {
    danmakuMap.value.set(diskId, []);
  }
  danmakuMap.value.get(diskId)!.push(danmaku);

  return danmaku;
}

/**
 * 发送弹幕
 * @param diskId 股票盘ID
 * @param text 弹幕内容
 */
function sendDanmaku(diskId: number, text: string) {
  const danmaku = addDanmaku(diskId, text);
  
  // 通过WebSocket发送弹幕
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'danmaku',
      data: danmaku
    }));
  }
  
  // 保存弹幕到localStorage
  saveDanmakuToLocalStorage();
}

/**
 * 保存弹幕到localStorage
 */
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

/**
 * 从localStorage加载弹幕
 */
function loadDanmakuFromLocalStorage() {
  try {
    const storedData = localStorage.getItem('danmaku');
    if (storedData) {
      const danmakuObject = JSON.parse(storedData);
      Object.entries(danmakuObject).forEach(([diskIdStr, danmakuList]) => {
        const diskId = parseInt(diskIdStr);
        if (!isNaN(diskId) && Array.isArray(danmakuList)) {
          danmakuMap.value.set(diskId, danmakuList);
          // 更新弹幕ID计数器
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

/**
 * 根据股票盘ID获取弹幕
 * @param diskId 股票盘ID
 * @returns 弹幕数组
 */
function getDanmakuByDiskId(diskId: number): Danmaku[] {
  return danmakuMap.value.get(diskId) || [];
}

/**
 * 清除指定股票盘的弹幕
 * @param diskId 股票盘ID
 */
function clearDanmakuByDiskId(diskId: number) {
  danmakuMap.value.delete(diskId);
}

/**
 * 获取当前股票盘的弹幕
 * @returns 弹幕数组
 */
function getCurrentDiskDanmaku(): Danmaku[] {
  if (currentDiskId.value === null) return [];
  return getDanmakuByDiskId(currentDiskId.value);
}

// 连接WebSocket
connectWebSocket();

// 初始化时加载弹幕数据
(async () => {
  // 首先尝试从JSON文件加载
  await loadDanmakuFromFile();
  // 然后尝试从localStorage加载（可能有更新的数据）
  loadDanmakuFromLocalStorage();
})();

// 导出状态和方法
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
  aiAnalysisResult,
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

// 导出类型
export type { Danmaku };