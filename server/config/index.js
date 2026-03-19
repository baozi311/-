/**
 * 服务器配置模块
 * 包含服务器端口、文件路径、崩盘数据等配置参数
 */

import path from 'path' // 路径处理模块

// 服务器配置
export const PORT = process.env.PORT || 3000 // 服务器端口，优先使用环境变量

// 文件路径配置
export const DATA_FILE = path.join(process.cwd(), 'stock-data.json') // 股票数据文件路径
export const DANMAKU_FILE = path.join(process.cwd(), 'danmaku-data.json') // 弹幕数据文件路径

// 崩盘数据配置
export const CRASH_DATA = {
  unitPrice: 1, // 单价
  totalStock: 1000, // 总股票数
  personalStock: 0, // 个人股票数
  totalMoney: 1000, // 总资金
  personalMoney: 0 // 个人资金
}

// 数据清理配置
export const MAX_CLOSED_DISKS = 50 // 最大封盘数量，超过后清理最旧的封盘

// WebSocket配置
export const WS_CONFIG = {
  path: '/ws' // WebSocket路径
}

// API配置
export const API_CONFIG = {
  prefix: '/api' // API前缀
}

// DeepSeek大模型配置
export const DEEPSEEK_CONFIG = {
  apiKey: process.env.DEEPSEEK_API_KEY || 'sk-03da632aaed54c5f894bd1735c71f9fc', // DeepSeek API密钥
  baseURL: 'https://api.deepseek.com/v1', // DeepSeek API基础URL
  model: 'deepseek-chat', // 使用的模型
  temperature: 0.7, // 生成文本的随机性
  maxTokens: 1024 // 最大生成token数
}
