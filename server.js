import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { WebSocketServer } from 'ws'

const app = express()

// 创建HTTP服务器
const server = app.listen(3000)

// 创建WebSocket服务器
const wss = new WebSocketServer({ server })

// 存储所有连接的客户端
const clients = new Set()

// WebSocket连接处理
wss.on('connection', (ws) => {
  console.log('新的WebSocket连接')
  clients.add(ws)

  // 立即发送当前数据给新连接的客户端
  if (currentDisk && currentDisk.data.length > 0) {
    const latestData = currentDisk.data[currentDisk.data.length - 1]
    ws.send(JSON.stringify({
      type: 'stock_update',
      data: latestData,
      diskId: currentDisk.id
    }))
  }

  // 发送盘列表
  ws.send(JSON.stringify({
    type: 'disks_update',
    data: stockDisks.map(disk => ({
      id: disk.id,
      startTime: disk.startTime,
      endTime: disk.endTime || null,
      isClosed: disk.isClosed,
      dataCount: disk.data.length,
      highPrice: disk.highPrice || null,
      lowPrice: disk.lowPrice || null
    })),
    currentDiskId: currentDisk ? currentDisk.id : null
  }))

  ws.on('close', () => {
    console.log('WebSocket连接关闭')
    clients.delete(ws)
  })
})

// 广播消息给所有客户端
function broadcast(message) {
  const data = JSON.stringify(message)
  clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(data)
    }
  })
}

// 数据文件路径
const DATA_FILE = path.join(process.cwd(), 'stock-data.json')

// 中间件
app.use(express.json())
app.use(cors()) // 启用CORS

// 崩盘判断：unitPrice:1, totalStock:1000, personalStock:0, totalMoney:1000, personalMoney:0
const CRASH_DATA = {
  unitPrice: 1,
  totalStock: 1000,
  personalStock: 0,
  totalMoney: 1000,
  personalMoney: 0
}

// 检测是否为崩盘数据
function isCrashData(stockData) {
  return stockData.unitPrice === CRASH_DATA.unitPrice &&
    stockData.totalStock === CRASH_DATA.totalStock &&
    stockData.personalStock === CRASH_DATA.personalStock &&
    stockData.totalMoney === CRASH_DATA.totalMoney &&
    stockData.personalMoney === CRASH_DATA.personalMoney
}

// 股票盘数据结构
// {
//   id: 盘ID,
//   startTime: 起始时间,
//   data: [数据列表],
//   isClosed: 是否已封盘
// }

// 所有股票盘
let stockDisks = []

// 当前活跃的盘
let currentDisk = null

// 保存数据到文件
function saveData() {
  try {
    const data = {
      stockDisks: stockDisks,
      currentDiskId: currentDisk ? currentDisk.id : null
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
    console.log('数据已保存到文件')
  } catch (error) {
    console.error('保存数据失败:', error)
  }
}

// 从文件加载数据
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      stockDisks = data.stockDisks || []

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
}

// 创建新盘
function createNewDisk(startData) {
  const disk = {
    id: stockDisks.length + 1,
    startTime: new Date().toISOString(),
    data: [startData],
    isClosed: false
  }
  stockDisks.push(disk)
  currentDisk = disk
  console.log(`创建新盘 #${disk.id}`)
  saveData()

  // 广播给所有客户端
  broadcast({
    type: 'disk_created',
    data: {
      id: disk.id,
      startTime: disk.startTime,
      isClosed: disk.isClosed,
      dataCount: disk.data.length
    },
    currentDiskId: disk.id
  })

  return disk
}

// 计算盘的统计信息
function calculateDiskStats(disk) {
  if (!disk.data || disk.data.length === 0) {
    return { highPrice: 0, lowPrice: 0 }
  }

  const prices = disk.data.map(d => d.unitPrice)
  const highPrice = Math.max(...prices)
  const lowPrice = Math.min(...prices)

  return { highPrice, lowPrice }
}

// 封存当前盘
function closeCurrentDisk() {
  if (currentDisk) {
    currentDisk.isClosed = true
    currentDisk.endTime = new Date().toISOString()
    // 计算统计信息
    const stats = calculateDiskStats(currentDisk)
    currentDisk.highPrice = stats.highPrice
    currentDisk.lowPrice = stats.lowPrice
    console.log(`封存盘 #${currentDisk.id}, 最高价: ${stats.highPrice}, 最低价: ${stats.lowPrice}`)
    saveData()

    // 广播给所有客户端
    broadcast({
      type: 'disk_closed',
      data: {
        id: currentDisk.id,
        startTime: currentDisk.startTime,
        endTime: currentDisk.endTime,
        isClosed: currentDisk.isClosed,
        dataCount: currentDisk.data.length,
        highPrice: currentDisk.highPrice,
        lowPrice: currentDisk.lowPrice
      }
    })
  }
}

// 初始化：加载数据或创建第一盘
loadData()

// 检查是否需要清理（每天凌晨3点后，如果当前盘最后数据是昨天的，清理所有数据）
function checkAndClearOldData() {
  const now = new Date()
  const resetHour = 3

  // 只在凌晨3点之后检查
  if (now.getHours() < resetHour) {
    return
  }

  if (currentDisk && currentDisk.data.length > 0) {
    const lastDataTime = new Date(currentDisk.data[currentDisk.data.length - 1].timestamp)
    const lastDataDate = new Date(lastDataTime.getFullYear(), lastDataTime.getMonth(), lastDataTime.getDate())
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // 如果最后数据是昨天的，清理所有数据
    if (lastDataDate.getTime() < today.getTime()) {
      console.log('检测到新的一天（凌晨3点后），清理所有历史数据...')
      // 清理所有数据
      stockDisks = []
      currentDisk = null
      // 创建新盘
      createNewDisk({
        ...CRASH_DATA,
        timestamp: new Date().toISOString()
      })
    }
  }
}

checkAndClearOldData()

if (stockDisks.length === 0 || !currentDisk) {
  createNewDisk({
    ...CRASH_DATA,
    timestamp: new Date().toISOString()
  })
}

// 生成K线图数据
function generateKLineData(diskData) {
  if (!diskData || diskData.length === 0) {
    return []
  }

  return diskData.map(item => {
    const price = item.unitPrice
    const date = new Date(item.timestamp)
    const time = date.toTimeString().split(' ')[0] // 只显示时分秒 HH:MM:SS
    return [
      time,
      price,
      price,
      price,
      price,
      item.totalStock
    ]
  })
}

// 根路径
app.get('/', (req, res) => {
  res.send('API服务器运行中')
})

// 获取所有股票盘列表
app.get('/disks', (req, res) => {
  res.json({
    success: true,
    data: stockDisks.map(disk => ({
      id: disk.id,
      startTime: disk.startTime,
      endTime: disk.endTime || null,
      isClosed: disk.isClosed,
      dataCount: disk.data.length,
      highPrice: disk.highPrice || null,
      lowPrice: disk.lowPrice || null
    })),
    count: stockDisks.length,
    currentDiskId: currentDisk ? currentDisk.id : null
  })
})

// 获取当前股票盘数据
app.get('/stock', (req, res) => {
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

// 获取指定盘的数据
app.get('/disks/:id', (req, res) => {
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

// 获取指定盘的K线图数据
app.get('/disks/:id/kline', (req, res) => {
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

// 接收股票数据
app.post('/stock', (req, res) => {
  try {
    const stockData = req.body
    console.log('收到股票数据:', stockData)

    // 验证数据结构
    const requiredFields = ['unitPrice', 'totalStock', 'personalStock', 'totalMoney', 'personalMoney']
    for (const field of requiredFields) {
      if (stockData[field] === undefined) {
        throw new Error(`缺少必填字段: ${field}`)
      }
    }

    // 检测是否为崩盘数据
    if (isCrashData(stockData)) {
      console.log('检测到崩盘数据，创建新盘')

      // 封存当前盘
      closeCurrentDisk()

      // 创建新盘，崩盘数据作为起始数据
      createNewDisk({
        ...stockData,
        timestamp: new Date().toISOString()
      })

      return res.json({
        success: true,
        message: '崩盘，新盘已创建',
        diskId: currentDisk.id,
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
      console.log(`数据已添加到盘 #${currentDisk.id}`)
      saveData()

      // 广播给所有客户端
      broadcast({
        type: 'stock_update',
        data: dataWithTimestamp,
        diskId: currentDisk.id
      })
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

// 获取最新股票数据
app.get('/stock/latest', (req, res) => {
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

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    currentDiskId: currentDisk ? currentDisk.id : null,
    totalDisks: stockDisks.length
  })
})

// 获取当前盘的K线图数据
app.get('/stock/kline', (req, res) => {
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

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  })
})

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err)
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  })
})

const PORT = process.env.PORT || 3000
console.log(`服务器运行在 http://localhost:${PORT}`)
console.log(`数据文件: ${DATA_FILE}`)
console.log(`WebSocket: ws://localhost:${PORT}`)
console.log(`接收股票数据: POST http://localhost:${PORT}/stock`)
console.log(`查询股票数据: GET http://localhost:${PORT}/stock`)
console.log(`获取最新数据: GET http://localhost:${PORT}/stock/latest`)
console.log(`获取K线图: GET http://localhost:${PORT}/stock/kline`)
console.log(`获取盘列表: GET http://localhost:${PORT}/disks`)
console.log(`健康检查: GET http://localhost:${PORT}/health`)
