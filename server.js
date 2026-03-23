/**
 * 主服务器入口文件
 * 负责初始化Express服务器、WebSocket服务器、加载数据和启动服务
 */

// 导入所需模块
import express from 'express' // Express框架
import cors from 'cors' // CORS中间件
import { PORT, CRASH_DATA } from './server/config/index.js' // 配置参数
import { loadData, checkAndClearOldData, createNewDisk, closeCurrentDisk, currentDisk, stockDisks } from './server/data/index.js' // 数据管理
import { initWebSocket, broadcastDiskClosed } from './server/websocket/index.js' // WebSocket管理
import routes from './server/routes/index.js' // 路由定义

// 创建Express应用实例
const app = express()

// 中间件配置
app.use(express.json()) // 解析JSON请求体
app.use(cors()) // 启用CORS

// 使用路由
app.use('/', routes)

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err) // 记录错误日志
  console.error('错误堆栈:', err.stack) // 记录错误堆栈
  res.status(500).json({ // 返回500错误响应
    success: false,
    message: '服务器内部错误',
    error: err.message
  })
})

// 创建HTTP服务器
const server = app.listen(PORT)

// 初始化WebSocket服务器
initWebSocket(server)

// 启动时加载数据
loadData() // 从文件加载股票和弹幕数据
checkAndClearOldData() // 检查并清理旧数据

// 如果没有盘数据，创建新盘
if (stockDisks.length === 0 || !currentDisk) {
  createNewDisk({
    ...CRASH_DATA, // 使用崩盘数据作为初始数据
    timestamp: new Date().toISOString() // 添加时间戳
  })
}

// 每5分钟检查一次盘数量，清理多余的封盘
setInterval(() => {
  checkAndClearOldData()
}, 5 * 60 * 1000)

// 服务器启动日志
console.log(`服务器运行在 http://localhost:${PORT}`)
console.log(`WebSocket: ws://localhost:${PORT}`)
console.log(`接收股票数据: POST http://localhost:${PORT}/stock`)
console.log(`查询股票数据: GET http://localhost:${PORT}/stock`)
console.log(`获取最新数据: GET http://localhost:${PORT}/stock/latest`)
console.log(`获取K线图: GET http://localhost:${PORT}/stock/kline`)
console.log(`获取盘列表: GET http://localhost:${PORT}/disks`)
console.log(`健康检查: GET http://localhost:${PORT}/health`)
