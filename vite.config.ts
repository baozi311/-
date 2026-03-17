import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
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
        target: 'http://localhost:5140',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})