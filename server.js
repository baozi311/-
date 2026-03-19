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
      lowPrice: disk.lowPrice || null,
      maxStock: disk.maxStock || null,
      minStock: disk.minStock || null
    })),
    currentDiskId: currentDisk ? currentDisk.id : null
  }))

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message)
      if (data.type === 'danmaku') {
        console.log('收到弹幕:', data.data)
        
        const danmaku = data.data
        const diskId = danmaku.diskId
        
        if (diskId !== undefined) {
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
          
          // 保存弹幕数据
          saveDanmakuData()
          
          // 广播给所有客户端
          broadcast({
            type: 'danmaku',
            data: danmaku
          })
        }
      }
    } catch (error) {
      console.error('处理WebSocket消息失败:', error)
    }
  })

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
const DANMAKU_FILE = path.join(process.cwd(), 'danmaku-data.json')

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

// 弹幕数据
let danmakuData = {
  danmakuDisks: []
}

// 保存数据到文件
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

// 保存弹幕数据到文件
function saveDanmakuData() {
  try {
    fs.writeFileSync(DANMAKU_FILE, JSON.stringify(danmakuData, null, 2), 'utf-8')
    // console.log('弹幕数据已保存到文件')
  } catch (error) {
    console.error('保存弹幕数据失败:', error)
  }
}

// 从文件加载数据
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      stockDisks = data.stockDisks || []

      // 为所有封存盘重新计算 maxStock/minStock
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

// 封存当前盘
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
        lowPrice: currentDisk.lowPrice,
        maxStock: currentDisk.maxStock,
        minStock: currentDisk.minStock
      }
    })

    // 封盘后检查是否需要清理数据
    setTimeout(() => {
      checkAndClearOldData()
    }, 100)
  }
}

// 封盘后检查是否需要清理数据
const MAX_CLOSED_DISKS = 50  // 封盘达到50个后清理

function checkAndClearByDiskCount() {
  const closedDisks = stockDisks.filter(disk => disk.isClosed === true)

  console.log(`当前封盘数量: ${closedDisks.length}/${MAX_CLOSED_DISKS}`)

  if (closedDisks.length >= MAX_CLOSED_DISKS) {
    console.log(`封盘数量达到 ${MAX_CLOSED_DISKS} 个，清理所有历史数据...`)
    stockDisks = []
    currentDisk = null
    createNewDisk({
      ...CRASH_DATA,
      timestamp: new Date().toISOString()
    })
    saveData()
    return true
  }
  return false
}

// 检查是否需要清理（每天早上9点后，如果当前盘最后数据是昨天的，清理所有数据）
function checkAndClearOldData() {
  return checkAndClearByDiskCount()
}

// 每隔5分钟检查一次封盘数量
setInterval(() => {
  checkAndClearByDiskCount()
}, 5 * 60 * 1000)

loadData()
checkAndClearOldData()

if (stockDisks.length === 0 || !currentDisk) {
  createNewDisk({
    ...CRASH_DATA,
    timestamp: new Date().toISOString()
  })
}

// 生成K线图数据（每个数据点作为一个K线）
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

    klineData.push([
      time,
      open,     // 开盘
      close,    // 收盘
      low,      // 最低
      high,     // 最高
      item.totalStock  // 成交量
    ])
  }

  return klineData
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
      lowPrice: disk.lowPrice || null,
      maxStock: disk.maxStock || null,
      minStock: disk.minStock || null
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
    console.log('收到股票数据:', new Date().toISOString(), stockData)

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
      // console.log(`数据已添加到盘 #${currentDisk.id}`)
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

// 获取弹幕数据
app.get('/danmaku', (req, res) => {
  res.json({
    success: true,
    data: danmakuData
  })
})

// 获取指定盘的弹幕数据
app.get('/danmaku/:diskId', (req, res) => {
  const diskId = parseInt(req.params.diskId)
  const diskDanmaku = danmakuData.danmakuDisks.find(d => d.diskId === diskId)
  
  if (!diskDanmaku) {
    return res.json({
      success: true,
      data: {
        diskId: diskId,
        danmakuList: []
      }
    })
  }
  
  res.json({
    success: true,
    data: diskDanmaku
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

// AI分析接口 - 返回股票数据供AI分析预测
app.get('/ai/analysis', (req, res) => {
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
