/*
 * Vite 配置文件
 * 负责设置项目的构建和开发服务器配置
 */

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  // 插件配置
  plugins: [vue()], // 使用Vue插件
  
  // 开发服务器配置
  server: {
    host: true, // 绑定到所有网络接口
    port: 5173, // 确保使用指定端口
    allowedHosts: [// 允许隧道主机
      'n7649692.natappfree.cc',
      'felinus.gnway.cc'
    ],
    // 添加API接收端点
    proxy: {
      '/api': {
        target: 'http://localhost:5140', // 后端API服务地址
        changeOrigin: true, // 更改请求头中的Origin
        rewrite: (path) => path.replace(/^\/api/, '') // 重写路径
      }
    }
  }
})