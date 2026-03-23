/**
 * WebSocket模块
 * 负责实时通信，处理WebSocket连接、消息和广播
 */

import { WebSocketServer } from 'ws'
import { currentDisk, stockDisks, addDanmaku, danmakuData } from '../data/index.js'
import { encrypt, decrypt } from '../utils/index.js'

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
  wss.on('connection', (ws) => {
    console.log('新的WebSocket连接')
    clients.add(ws)

    // 发送当前数据给新连接的客户端
    if (currentDisk && currentDisk.data.length > 0) {
      const latestData = currentDisk.data[currentDisk.data.length - 1]

      // 发送股票数据（加密）
      const message = JSON.stringify({
        type: 'stock_update',
        data: latestData,
        diskId: currentDisk.id
      });
      ws.send('ENCRYPTED:' + encrypt(message));
    }

    // 发送盘列表（加密）
    const disksMessage = JSON.stringify({
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
    });
    ws.send('ENCRYPTED:' + encrypt(disksMessage));

    // 处理接收到的消息
    ws.on('message', (message) => {
      try {
        let messageData = message.toString();
        let data;

        // 如果是加密的消息，先解密
        if (messageData.startsWith('ENCRYPTED:')) {
          const encryptedData = messageData.substring(10); // 移除 'ENCRYPTED:' 前缀
          const decryptedData = decrypt(encryptedData);
          data = JSON.parse(decryptedData);
        } else {
          data = JSON.parse(messageData);
        }

        // 处理弹幕消息
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

        // 处理浏览器插件连接
        if (data.type === 'plugin_connected') {
          console.log('浏览器插件已连接:', data.source)
          ws.isPlugin = true
        }

        // 处理AI分析结果
        if (data.type === 'ai_analysis_result') {
          console.log('收到AI分析结果:', data.result)
          // 广播AI分析结果给所有客户端
          broadcast({
            type: 'ai_analysis',
            data: data.result
          })
        }

        // 处理AI分析错误
        if (data.type === 'ai_analysis_error') {
          console.error('AI分析错误:', data.error)
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
  const encryptedData = 'ENCRYPTED:' + encrypt(data)
  clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(encryptedData)
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

/**
 * 发送股票数据给浏览器插件
 * @param {Object} stockData 股票数据
 */
function sendToPlugin(stockData) {
  const pluginClients = Array.from(clients).filter(client => client.isPlugin)

  if (pluginClients.length > 0) {
    const message = JSON.stringify({
      type: 'stock_data_for_ai',
      stockData: stockData,
      diskData: currentDisk ? currentDisk.data : [],
      diskId: currentDisk ? currentDisk.id : null
    })

    pluginClients.forEach(client => {
      if (client.readyState === 1) {
        client.send(message)
        console.log('[WebSocket] 已发送股票数据给插件')
      }
    })
  }
}

// 导出模块
export {
  initWebSocket, // 初始化WebSocket服务器
  broadcast, // 广播消息
  broadcastStockUpdate, // 广播股票更新
  broadcastDiskCreated, // 广播盘创建
  broadcastDiskClosed, // 广播盘关闭
  broadcastDisksUpdate, // 广播盘列表更新
  sendToPlugin, // 发送数据给插件
  clients // 客户端集合
}
