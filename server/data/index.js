/**
 * 数据管理模块
 * 负责股票数据、弹幕数据的存储、加载和管理
 */

import fs from 'fs' // 文件系统模块
import { DATA_FILE, DANMAKU_FILE, CRASH_DATA, MAX_CLOSED_DISKS } from '../config/index.js' // 配置参数

// 股票盘数据数组
let stockDisks = []

// 当前活跃的股票盘
let currentDisk = null

// 弹幕数据
let danmakuData = {
  danmakuDisks: [] // 按盘分组的弹幕列表
}

/**
 * 检查数据是否为崩盘数据
 * @param {Object} stockData 股票数据
 * @returns {boolean} 是否为崩盘数据
 */
function isCrashData(stockData) {
  return stockData.unitPrice === CRASH_DATA.unitPrice &&
    stockData.totalStock === CRASH_DATA.totalStock &&
    stockData.personalStock === CRASH_DATA.personalStock &&
    stockData.totalMoney === CRASH_DATA.totalMoney &&
    stockData.personalMoney === CRASH_DATA.personalMoney
}

/**
 * 保存股票数据到文件
 */
function saveData() {
  try {
    const data = {
      stockDisks: stockDisks,
      currentDiskId: currentDisk ? currentDisk.id : null
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
    // console.log('数据已保存到文件')
  } catch (error) {
    console.error('保存数据失败:', error)
  }
}

/**
 * 保存弹幕数据到文件
 */
function saveDanmakuData() {
  try {
    fs.writeFileSync(DANMAKU_FILE, JSON.stringify(danmakuData, null, 2), 'utf-8')
    // console.log('弹幕数据已保存到文件')
  } catch (error) {
    console.error('保存弹幕数据失败:', error)
  }
}

/**
 * 从文件加载数据
 */
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      stockDisks = data.stockDisks || []

      // 为所有封盘重新计算 maxStock/minStock
      for (const disk of stockDisks) {
        if (disk.isClosed && disk.data && disk.data.length > 0) {
          const stocks = disk.data.map(d => d.totalStock)
          disk.maxStock = Math.max(...stocks)
          // 排除1000（初始开盘数量），找最接近1000的值
          const stocksWithoutBase = stocks.filter(s => s !== 1000)
          disk.minStock = stocksWithoutBase.length > 0 ? Math.min(...stocksWithoutBase) : 1000
        }
      }

      // 恢复当前盘
      if (data.currentDiskId) {
        currentDisk = stockDisks.find(d => d.id === data.currentDiskId) || null
      }

      console.log(`从文件加载了 ${stockDisks.length} 个盘的数据`)
    } else {
      console.log('没有找到数据文件，将创建新数据')
    }
  } catch (error) {
    console.error('加载数据失败:', error)
    stockDisks = []
    currentDisk = null
  }

  // 加载弹幕数据
  try {
    if (fs.existsSync(DANMAKU_FILE)) {
      const data = JSON.parse(fs.readFileSync(DANMAKU_FILE, 'utf-8'))
      danmakuData = data
      console.log(`从文件加载了 ${danmakuData.danmakuDisks.length} 个盘的弹幕数据`)
    } else {
      console.log('没有找到弹幕数据文件，将创建新数据')
      danmakuData = { danmakuDisks: [] }
      saveDanmakuData()
    }
  } catch (error) {
    console.error('加载弹幕数据失败:', error)
    danmakuData = { danmakuDisks: [] }
  }
}

/**
 * 创建新盘
 * @param {Object} startData 初始数据
 * @returns {Object} 新创建的盘
 */
function createNewDisk(startData) {
  const disk = {
    id: stockDisks.length + 1, // 盘ID，自增
    startTime: new Date().toISOString(), // 开盘时间
    data: [startData], // 盘数据
    isClosed: false // 是否封盘
  }
  stockDisks.push(disk)
  currentDisk = disk
  console.log(`创建新盘 #${disk.id}`)
  saveData()

  return disk
}

/**
 * 计算盘的统计信息
 * @param {Object} disk 盘数据
 * @returns {Object} 统计信息（最高价、最低价、最多股、最少股）
 */
function calculateDiskStats(disk) {
  if (!disk.data || disk.data.length === 0) {
    return { highPrice: 0, lowPrice: 0, maxStock: 0, minStock: 0 }
  }

  const prices = disk.data.map(d => d.unitPrice)
  const stocks = disk.data.map(d => d.totalStock)
  const highPrice = Math.max(...prices)
  const lowPrice = Math.min(...prices)
  const maxStock = Math.max(...stocks)

  // 排除1000（初始开盘数量），找最接近1000的值
  const stocksWithoutBase = stocks.filter(s => s !== 1000)
  let minStock = stocksWithoutBase.length > 0 ? Math.min(...stocksWithoutBase) : 1000

  return { highPrice, lowPrice, maxStock, minStock }
}

/**
 * 封存当前盘
 * @returns {Object|null} 封盘后的盘数据或null
 */
function closeCurrentDisk() {
  if (currentDisk) {
    currentDisk.isClosed = true
    currentDisk.endTime = new Date().toISOString()
    // 计算统计信息
    const stats = calculateDiskStats(currentDisk)
    currentDisk.highPrice = stats.highPrice
    currentDisk.lowPrice = stats.lowPrice
    currentDisk.maxStock = stats.maxStock
    currentDisk.minStock = stats.minStock
    console.log(`封存盘 #${currentDisk.id}, 最高价: ${stats.highPrice}, 最低价: ${stats.lowPrice}, 最多股: ${stats.maxStock}, 最少股: ${stats.minStock}`)
    saveData()

    // 检查并清理旧数据，只保留最新的50个封存盘
    checkAndClearOldData()

    return currentDisk
  }
  return null
}

/**
 * 按盘数量检查并清理旧数据
 * @returns {boolean} 是否清理了数据
 */
function checkAndClearByDiskCount() {
  const closedDisks = stockDisks.filter(disk => disk.isClosed === true)

  console.log(`当前封盘数量: ${closedDisks.length}/${MAX_CLOSED_DISKS}`)

  if (closedDisks.length > MAX_CLOSED_DISKS) {
    const excess = closedDisks.length - MAX_CLOSED_DISKS
    console.log(`封盘数量超过 ${MAX_CLOSED_DISKS} 个，清理 ${excess} 个最旧的封盘...`)

    // 获取最新的 MAX_CLOSED_DISKS 个封盘
    const latestClosedDisks = closedDisks.slice(-MAX_CLOSED_DISKS)

    // 获取当前活跃盘
    const activeDisk = stockDisks.find(disk => !disk.isClosed)

    // 创建新的 stockDisks 数组，包含最新的封盘和活跃盘
    stockDisks = [...latestClosedDisks]
    if (activeDisk) {
      stockDisks.push(activeDisk)
    }

    // 更新 currentDisk（如果需要）
    if (activeDisk && currentDisk !== activeDisk) {
      currentDisk = activeDisk
    }

    saveData()
    return true
  }
  return false
}

/**
 * 检查并清理旧数据
 * @returns {boolean} 是否清理了数据
 */
function checkAndClearOldData() {
  return checkAndClearByDiskCount()
}

/**
 * 获取指定盘的弹幕数据
 * @param {number} diskId 盘ID
 * @returns {Object} 弹幕数据
 */
function getDanmakuForDisk(diskId) {
  return danmakuData.danmakuDisks.find(d => d.diskId === diskId) || {
    diskId: diskId,
    danmakuList: []
  }
}

/**
 * 添加或更新弹幕
 * @param {Object} danmaku 弹幕数据
 * @returns {Object|null} 保存后的弹幕数据或null
 */
function addDanmaku(danmaku) {
  const diskId = danmaku.diskId
  if (diskId === undefined) return null

  // 找到或创建对应盘的弹幕列表
  let diskDanmaku = danmakuData.danmakuDisks.find(d => d.diskId === diskId)
  if (!diskDanmaku) {
    diskDanmaku = {
      diskId: diskId,
      danmakuList: []
    }
    danmakuData.danmakuDisks.push(diskDanmaku)
  }

  // 检查是否已存在相同文本的弹幕
  const existingDanmaku = diskDanmaku.danmakuList.find(d => d.text === danmaku.text)
  if (existingDanmaku) {
    // 增加计数
    existingDanmaku.count = (existingDanmaku.count || 1) + 1
    existingDanmaku.timestamp = new Date().toISOString()
  } else {
    // 添加新弹幕
    diskDanmaku.danmakuList.push({
      id: Date.now(),
      text: danmaku.text,
      timestamp: new Date().toISOString(),
      color: danmaku.color,
      top: danmaku.top,
      duration: danmaku.duration,
      count: 1
    })
  }

  saveDanmakuData()
  return danmaku
}

// 导出模块
export {
  stockDisks, // 股票盘数据数组
  currentDisk, // 当前活跃盘
  danmakuData, // 弹幕数据
  isCrashData, // 检查是否为崩盘数据
  saveData, // 保存股票数据
  saveDanmakuData, // 保存弹幕数据
  loadData, // 加载数据
  createNewDisk, // 创建新盘
  calculateDiskStats, // 计算盘统计信息
  closeCurrentDisk, // 封存当前盘
  checkAndClearOldData, // 检查并清理旧数据
  checkAndClearByDiskCount, // 按盘数量检查并清理
  getDanmakuForDisk, // 获取指定盘的弹幕
  addDanmaku // 添加或更新弹幕
}
