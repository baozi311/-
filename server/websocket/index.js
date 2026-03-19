/**
 * WebSocket模块
 * 负责实时通信，处理WebSocket连接、消息和广播
 */

import { WebSocketServer } from 'ws' // WebSocket服务器
import { currentDisk, stockDisks, addDanmaku, danmakuData } from '../data/index.js' // 数据管理
import { analyzeStockData } from '../ai/index.js' // AI分析

// 存储所有连接的客户端
const clients = new Set()

// WebSocket服务器实例
let wss = null

/**
 * 初始化WebSocket服务器
 * @param {Object} server HTTP服务器实例
 * @returns {Object} WebSocket服务器实例
 */
function initWebSocket(server) {
  wss = new WebSocketServer({ server })

  // WebSocket连接处理
  wss.on('connection', async (ws) => {
    console.log('新的WebSocket连接')
    clients.add(ws)

    // 发送当前数据给新连接的客户端
    if (currentDisk && currentDisk.data.length > 0) {
      const latestData = currentDisk.data[currentDisk.data.length - 1]

      // 准备AI分析数据
      const analysisData = {
        diskId: currentDisk.id,
        startTime: currentDisk.startTime,
        isClosed: currentDisk.isClosed,
        data: currentDisk.data,
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
          totalRecords: currentDisk.data.length
        }
      }

      // 进行AI分析
      let aiAnalysis = null
      try {
        aiAnalysis = await analyzeStockData(analysisData)
        console.log('AI分析结果:', aiAnalysis)
      } catch (error) {
        console.error('AI分析失败:', error)
      }

      // 发送股票数据和AI分析结果
      ws.send(JSON.stringify({
        type: 'stock_update',
        data: {
          ...latestData,
          // aiAnalysis: aiAnalysis
        },
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

    // 处理接收到的消息
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message)
        if (data.type === 'danmaku') {
          console.log('收到弹幕:', data.data)

          const danmaku = data.data
          const savedDanmaku = addDanmaku(danmaku)

          if (savedDanmaku) {
            // 广播给所有客户端
            broadcast({
              type: 'danmaku',
              data: savedDanmaku
            })
          }
        }
      } catch (error) {
        console.error('处理WebSocket消息失败:', error)
      }
    })

    // 处理连接关闭
    ws.on('close', () => {
      console.log('WebSocket连接关闭')
      clients.delete(ws)
    })
  })

  return wss
}

/**
 * 广播消息给所有客户端
 * @param {Object} message 消息对象
 */
function broadcast(message) {
  const data = JSON.stringify(message)
  clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(data)
    }
  })
}

/**
 * 广播股票更新
 * @param {Object} data 股票数据
 * @param {number} diskId 盘ID
 */
function broadcastStockUpdate(data, diskId) {
  broadcast({
    type: 'stock_update',
    data: data,
    diskId: diskId
  })
}

/**
 * 广播盘创建
 * @param {Object} disk 盘数据
 */
function broadcastDiskCreated(disk) {
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
}

/**
 * 广播盘关闭
 * @param {Object} disk 盘数据
 */
function broadcastDiskClosed(disk) {
  broadcast({
    type: 'disk_closed',
    data: {
      id: disk.id,
      startTime: disk.startTime,
      endTime: disk.endTime,
      isClosed: disk.isClosed,
      dataCount: disk.data.length,
      highPrice: disk.highPrice,
      lowPrice: disk.lowPrice,
      maxStock: disk.maxStock,
      minStock: disk.minStock
    }
  })
}

/**
 * 广播盘列表更新
 */
function broadcastDisksUpdate() {
  broadcast({
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
  })
}

// 导出模块
export {
  initWebSocket, // 初始化WebSocket服务器
  broadcast, // 广播消息
  broadcastStockUpdate, // 广播股票更新
  broadcastDiskCreated, // 广播盘创建
  broadcastDiskClosed, // 广播盘关闭
  broadcastDisksUpdate, // 广播盘列表更新
  clients // 客户端集合
}
