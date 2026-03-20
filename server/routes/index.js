/**
 * 路由模块
 * 负责处理所有HTTP请求，包括股票数据、盘管理、弹幕和健康检查
 */

import express from 'express' // Express框架
import { stockDisks, currentDisk, isCrashData, createNewDisk, closeCurrentDisk, getDanmakuForDisk, danmakuData, saveData } from '../data/index.js' // 数据管理
import { broadcastStockUpdate, broadcastDiskCreated, broadcastDiskClosed } from '../websocket/index.js' // WebSocket广播
import { CRASH_DATA } from '../config/index.js' // 配置参数
// import { callDeepSeek, analyzeStockData, generateDanmaku } from '../ai/index.js' // DeepSeek大模型

const router = express.Router() // 创建路由器实例

/**
 * 生成K线图数据（每个数据点作为一个K线）
 * @param {Array} diskData 盘数据
 * @returns {Array} K线图数据
 */
function generateKLineData(diskData) {
  if (!diskData || diskData.length === 0) {
    return []
  }

  // 按时间排序数据
  const sortedData = [...diskData].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const klineData = []

  for (let i = 0; i < sortedData.length; i++) {
    const item = sortedData[i]
    const date = new Date(item.timestamp)
    const time = date.toTimeString().split(' ')[0] // 提取时间部分

    // 使用当前价格和前一个价格计算K线
    let open, close, high, low

    if (i === 0) {
      // 第一个数据点
      open = item.unitPrice
      close = item.unitPrice
      high = item.unitPrice
      low = item.unitPrice
    } else {
      const prevItem = sortedData[i - 1]
      // O = 前一个价格, C = 当前价格
      open = prevItem.unitPrice
      close = item.unitPrice
      // H = max(前一个, 当前), L = min(前一个, 当前)
      high = Math.max(open, close)
      low = Math.min(open, close)
    }

    // 构建K线数据点
    klineData.push([
      time,       // 时间
      open,       // 开盘价
      close,      // 收盘价
      low,        // 最低价
      high,       // 最高价
      item.totalStock  // 成交量
    ])
  }

  return klineData
}

/**
 * 根路径
 * 用于检查API服务器是否运行
 */
router.get('/', (req, res) => {
  res.send('API服务器运行中')
})

/**
 * 获取所有股票盘
 * @returns {Object} 盘列表和当前盘ID
 */
router.get('/disks', (req, res) => {
  res.json({
    success: true,
    data: stockDisks.map(disk => ({
      id: disk.id,
      startTime: disk.startTime,
      endTime: disk.endTime || null,
      isClosed: disk.isClosed,
      dataCount: disk.data.length,
      highPrice: disk.highPrice || null,
      lowPrice: disk.lowPrice || null,
      maxStock: disk.maxStock || null,
      minStock: disk.minStock || null
    })),
    count: stockDisks.length,
    currentDiskId: currentDisk ? currentDisk.id : null
  })
})

/**
 * 获取当前股票盘数据
 * @returns {Object} 当前盘数据
 */
router.get('/stock', (req, res) => {
  if (!currentDisk) {
    return res.json({
      success: true,
      data: [],
      count: 0,
      lastUpdated: null
    })
  }

  res.json({
    success: true,
    data: currentDisk.data,
    count: currentDisk.data.length,
    lastUpdated: currentDisk.data.length > 0 ? currentDisk.data[currentDisk.data.length - 1].timestamp : null,
    diskId: currentDisk.id,
    isClosed: currentDisk.isClosed
  })
})

/**
 * 获取指定盘的数据
 * @param {number} id 盘ID
 * @returns {Object} 盘数据
 */
router.get('/disks/:id', (req, res) => {
  const diskId = parseInt(req.params.id)
  const disk = stockDisks.find(d => d.id === diskId)

  if (!disk) {
    return res.status(404).json({
      success: false,
      message: '盘不存在'
    })
  }

  res.json({
    success: true,
    data: disk.data,
    count: disk.data.length,
    diskId: disk.id,
    startTime: disk.startTime,
    endTime: disk.endTime || null,
    isClosed: disk.isClosed
  })
})

/**
 * 获取指定盘的K线图数据
 * @param {number} id 盘ID
 * @returns {Object} K线图数据
 */
router.get('/disks/:id/kline', (req, res) => {
  const diskId = parseInt(req.params.id)
  const disk = stockDisks.find(d => d.id === diskId)

  if (!disk) {
    return res.status(404).json({
      success: false,
      message: '盘不存在'
    })
  }

  const klineData = generateKLineData(disk.data)
  res.json({
    success: true,
    data: klineData,
    count: klineData.length,
    diskId: disk.id,
    isClosed: disk.isClosed
  })
})



/**
 * 获取最新股票数据
 * @returns {Object} 最新股票数据
 */
router.get('/stock/latest', (req, res) => {
  if (!currentDisk || currentDisk.data.length === 0) {
    return res.json({
      success: true,
      data: null,
      lastUpdated: null
    })
  }

  const latestData = currentDisk.data[currentDisk.data.length - 1]
  res.json({
    success: true,
    data: latestData,
    lastUpdated: latestData ? latestData.timestamp : null,
    diskId: currentDisk.id
  })
})

/**
 * 健康检查
 * @returns {Object} 服务器健康状态
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    currentDiskId: currentDisk ? currentDisk.id : null,
    totalDisks: stockDisks.length
  })
})

/**
 * 获取弹幕数据
 * @returns {Object} 弹幕数据
 */
router.get('/danmaku', (req, res) => {
  res.json({
    success: true,
    data: danmakuData
  })
})

/**
 * 获取指定盘的弹幕数据
 * @param {number} diskId 盘ID
 * @returns {Object} 盘的弹幕数据
 */
router.get('/danmaku/:diskId', (req, res) => {
  const diskId = parseInt(req.params.diskId)
  const diskDanmaku = getDanmakuForDisk(diskId)

  res.json({
    success: true,
    data: diskDanmaku
  })
})

/**
 * 获取当前盘的K线图数据
 * @returns {Object} K线图数据
 */
router.get('/stock/kline', (req, res) => {
  if (!currentDisk) {
    return res.json({
      success: true,
      data: [],
      count: 0,
      lastUpdated: null
    })
  }

  const klineData = generateKLineData(currentDisk.data)
  res.json({
    success: true,
    data: klineData,
    count: klineData.length,
    lastUpdated: currentDisk.data.length > 0 ? currentDisk.data[currentDisk.data.length - 1].timestamp : null,
    diskId: currentDisk.id
  })
})

/*
 * AI分析接口 - 返回股票数据供AI分析预测
 * @returns {Object} AI分析数据
 */
/*
router.get('/ai/analysis', (req, res) => {
  if (!currentDisk || currentDisk.data.length === 0) {
    return res.json({
      success: true,
      message: '当前没有活跃的股票盘',
      data: null
    })
  }

  const data = currentDisk.data
  const latestData = data[data.length - 1]
  const previousData = data.length > 1 ? data[data.length - 2] : null

  res.json({
    success: true,
    diskId: currentDisk.id,
    startTime: currentDisk.startTime,
    isClosed: currentDisk.isClosed,
    data: data,
    latest: {
      unitPrice: latestData.unitPrice,
      totalStock: latestData.totalStock,
      totalMoney: latestData.totalMoney,
      timestamp: latestData.timestamp
    },
    previous: previousData ? {
      unitPrice: previousData.unitPrice,
      totalStock: previousData.totalStock,
      totalMoney: previousData.totalMoney,
      timestamp: previousData.timestamp
    } : null,
    statistics: {
      highPrice: currentDisk.highPrice || null,
      lowPrice: currentDisk.lowPrice || null,
      maxStock: currentDisk.maxStock || null,
      minStock: currentDisk.minStock || null,
      totalRecords: data.length
    },
    lastUpdated: latestData.timestamp
  })
})

/**
 * DeepSeek大模型通用调用接口
 * @param {string} prompt 提示文本
 * @param {Array} messages 对话历史
 * @returns {Object} 生成的文本
 */
router.post('/ai/deepseek', async (req, res) => {
  try {
    console.log('收到DeepSeek大模型调用请求')
    console.log('请求头:', req.headers)
    console.log('请求体:', req.body)

    // 检查请求体是否存在
    if (!req.body) {
      console.log('请求体为空')
      return res.status(400).json({
        success: false,
        message: '请求体为空'
      })
    }

    const { prompt, messages } = req.body

    if (!prompt) {
      console.log('缺少提示文本')
      return res.status(400).json({
        success: false,
        message: '缺少提示文本'
      })
    }

    console.log('开始调用DeepSeek大模型...')
    const result = await callDeepSeek(prompt, messages)
    console.log('DeepSeek大模型调用成功:', result)

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('调用DeepSeek大模型失败:', error)
    console.error('错误堆栈:', error.stack)
    res.status(500).json({
      success: false,
      message: '调用DeepSeek大模型失败',
      error: error.message
    })
  }
})

/**
 * 股票数据AI分析接口
 * @returns {Object} AI分析结果
 */
router.get('/ai/stock-analysis', async (req, res) => {
  try {
    if (!currentDisk || currentDisk.data.length === 0) {
      return res.json({
        success: true,
        message: '当前没有活跃的股票盘',
        data: null
      })
    }

    const data = currentDisk.data
    const latestData = data[data.length - 1]

    const stockData = {
      diskId: currentDisk.id,
      startTime: currentDisk.startTime,
      isClosed: currentDisk.isClosed,
      data: data,
      latest: {
        unitPrice: latestData.unitPrice,
        totalStock: latestData.totalStock,
        totalMoney: latestData.totalMoney,
        timestamp: latestData.timestamp
      },
      statistics: {
        highPrice: currentDisk.highPrice || null,
        lowPrice: currentDisk.lowPrice || null,
        maxStock: currentDisk.maxStock || null,
        minStock: currentDisk.minStock || null,
        totalRecords: data.length
      }
    }

    const analysis = await analyzeStockData(stockData)

    res.json({
      success: true,
      data: analysis,
      diskId: currentDisk.id
    })
  } catch (error) {
    console.error('股票数据AI分析失败:', error)
    res.status(500).json({
      success: false,
      message: '股票数据AI分析失败',
      error: error.message
    })
  }
})

/**
 * 接收股票数据并进行AI分析
 * @param {Object} stockData 股票数据
 * @returns {Object} 处理结果和AI分析
 */
router.post('/stock', async (req, res) => {
  try {
    const stockData = req.body
    console.log('收到股票数据:', new Date().toISOString(), stockData)

    // 验证数据结构
    const requiredFields = ['unitPrice', 'totalStock', 'personalStock', 'totalMoney', 'personalMoney']
    for (const field of requiredFields) {
      if (stockData[field] === undefined) {
        throw new Error(`缺少必填字段: ${field}`)
      }
    }

    // 检查是否为崩盘数据
    if (isCrashData(stockData)) {
      console.log('检测到崩盘数据，创建新盘')

      // 封存当前盘
      closeCurrentDisk()

      // 创建新盘，崩盘数据作为起始数据
      const newDisk = createNewDisk({
        ...stockData,
        timestamp: new Date().toISOString()
      })

      // 广播盘创建
      broadcastDiskCreated(newDisk)

      return res.json({
        success: true,
        message: '崩盘，新盘已创建',
        diskId: newDisk.id,
        timestamp: new Date().toISOString()
      })
    }

    // 添加时间戳
    const dataWithTimestamp = {
      ...stockData,
      timestamp: new Date().toISOString()
    }

    // 存储到当前盘
    if (currentDisk) {
      currentDisk.data.push(dataWithTimestamp)
      // console.log(`数据已添加到盘 #${currentDisk.id}`)
      saveData()

      // 广播给所有客户端
      broadcastStockUpdate({
        ...dataWithTimestamp
      }, currentDisk.id)
    }

    res.json({
      success: true,
      message: '股票数据接收成功',
      diskId: currentDisk ? currentDisk.id : null,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('处理股票数据失败:', error)
    res.status(400).json({
      success: false,
      message: '数据格式错误',
      error: error.message
    })
  }
})

/**
 * 404处理
 * 处理不存在的接口
 */
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  })
})

// 导出路由器
export default router
