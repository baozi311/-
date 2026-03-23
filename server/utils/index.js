/**
 * 工具模块
 * 提供各种辅助函数，如时间格式化、数据验证、计算等
 */

// 加密密钥
const ENCRYPTION_KEY = 'stock-danmaku-secret-key-2024';

/**
 * 简单的XOR加密函数
 * @param {string} text 要加密的文本
 * @returns {string} 加密后的Base64字符串
 */
function encrypt(text) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
    );
  }
  return Buffer.from(encodeURIComponent(result)).toString('base64');
}

/**
 * 简单的XOR解密函数
 * @param {string} encoded 加密的Base64字符串
 * @returns {string} 解密后的文本
 */
function decrypt(encoded) {
  try {
    const text = decodeURIComponent(Buffer.from(encoded, 'base64').toString());
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
      );
    }
    return result;
  } catch (error) {
    console.error('解密失败:', error);
    return '';
  }
}

/**
 * 格式化时间戳为可读字符串
 * @param {string|number} timestamp 时间戳
 * @returns {string} 格式化后的时间字符串
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/**
 * 生成随机ID
 * @returns {number} 随机ID
 */
function generateId() {
  return Date.now() + Math.floor(Math.random() * 1000)
}

/**
 * 验证股票数据结构
 * @param {Object} data 股票数据
 * @returns {Object} 验证结果
 */
function validateStockData(data) {
  const requiredFields = ['unitPrice', 'totalStock', 'personalStock', 'totalMoney', 'personalMoney']
  for (const field of requiredFields) {
    if (data[field] === undefined) {
      return { valid: false, error: `缺少必填字段: ${field}` }
    }
  }
  return { valid: true }
}

/**
 * 计算百分比变化
 * @param {number} oldValue 旧值
 * @param {number} newValue 新值
 * @returns {number} 百分比变化
 */
function calculatePercentageChange(oldValue, newValue) {
  if (oldValue === 0) return 0
  return ((newValue - oldValue) / oldValue) * 100
}

/**
 * 格式化数字，添加千位分隔符
 * @param {number} num 数字
 * @returns {string} 格式化后的字符串
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * 获取盘状态
 * @param {Object} disk 盘数据
 * @returns {string} 盘状态
 */
function getDiskStatus(disk) {
  if (disk.isClosed) return '已封盘'
  return '活跃'
}

/**
 * 计算数组平均值
 * @param {Array} values 数值数组
 * @returns {number} 平均值
 */
function calculateAverage(values) {
  if (values.length === 0) return 0
  const sum = values.reduce((acc, val) => acc + val, 0)
  return sum / values.length
}

/**
 * 获取时间差（分钟）
 * @param {string|number} startTime 开始时间
 * @param {string|number} endTime 结束时间
 * @returns {number} 时间差（分钟）
 */
function getTimeDifferenceInMinutes(startTime, endTime) {
  const start = new Date(startTime)
  const end = new Date(endTime)
  const diff = end - start
  return Math.floor(diff / (1000 * 60))
}

// 导出模块
export {
  encrypt, // 加密函数
  decrypt, // 解密函数
  formatTimestamp, // 格式化时间戳
  generateId, // 生成随机ID
  validateStockData, // 验证股票数据
  calculatePercentageChange, // 计算百分比变化
  formatNumber, // 格式化数字
  getDiskStatus, // 获取盘状态
  calculateAverage, // 计算平均值
  getTimeDifferenceInMinutes // 获取时间差
}
