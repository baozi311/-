/**
 * 路由模块
 * 负责处理所有HTTP请求，包括股票数据、盘管理、弹幕和健康检查
 */

import express from 'express'
import { stockDisks, currentDisk, isCrashData, createNewDisk, closeCurrentDisk, getDanmakuForDisk, danmakuData, saveData } from '../data/index.js'
import { broadcastStockUpdate, broadcastDiskCreated, sendToPlugin } from '../websocket/index.js'

const router = express.Router()

function generateKLineData(diskData) {
  if (!diskData || diskData.length === 0) {
    return []
  }

  const sortedData = [...diskData].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const klineData = []

  for (let i = 0; i < sortedData.length; i++) {
    const item = sortedData[i]
    const date = new Date(item.timestamp)
    const time = date.toTimeString().split(' ')[0]

    let open, close, high, low

    if (i === 0) {
      open = item.unitPrice
      close = item.unitPrice
      high = item.unitPrice
      low = item.unitPrice
    } else {
      const prevItem = sortedData[i - 1]
      open = prevItem.unitPrice
      close = item.unitPrice
      high = Math.max(open, close)
      low = Math.min(open, close)
    }

    klineData.push([
      time,
      open,
      close,
      low,
      high,
      item.totalStock
    ])
  }

  return klineData
}

router.get('/', (req, res) => {
  res.send('API服务器运行中')
})

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

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    currentDiskId: currentDisk ? currentDisk.id : null,
    totalDisks: stockDisks.length
  })
})

router.get('/danmaku', (req, res) => {
  res.json({
    success: true,
    data: danmakuData
  })
})

router.get('/danmaku/:diskId', (req, res) => {
  const diskId = parseInt(req.params.diskId)
  const diskDanmaku = getDanmakuForDisk(diskId)

  res.json({
    success: true,
    data: diskDanmaku
  })
})

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

router.post('/stock', async (req, res) => {
  try {
    const stockData = req.body
    console.log('收到股票数据:', new Date().toISOString(), stockData)

    const requiredFields = ['unitPrice', 'totalStock', 'personalStock', 'totalMoney', 'personalMoney']
    for (const field of requiredFields) {
      if (stockData[field] === undefined) {
        throw new Error(`缺少必填字段: ${field}`)
      }
    }

    if (isCrashData(stockData)) {
      console.log('检测到崩盘数据，创建新盘')

      closeCurrentDisk()

      const newDisk = createNewDisk({
        ...stockData,
        timestamp: new Date().toISOString()
      })

      broadcastDiskCreated(newDisk)

      return res.json({
        success: true,
        message: '崩盘，新盘已创建',
        diskId: newDisk.id,
        timestamp: new Date().toISOString()
      })
    }

    const dataWithTimestamp = {
      ...stockData,
      timestamp: new Date().toISOString()
    }

    if (currentDisk) {
      currentDisk.data.push(dataWithTimestamp)
      saveData()

      broadcastStockUpdate({
        ...dataWithTimestamp
      }, currentDisk.id)

      sendToPlugin(dataWithTimestamp)
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

router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  })
})

export default router
