/**
 * 应用程序入口文件
 * 负责创建和挂载Vue应用
 */
import { createApp } from 'vue'  // 导入Vue的createApp函数
import './style.css'             // 导入全局样式
import App from './App.vue'      // 导入根组件

// 创建Vue应用实例并挂载到DOM元素#app上
createApp(App).mount('#app')
