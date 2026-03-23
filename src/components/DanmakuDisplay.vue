<!--
 * 弹幕显示组件
 * 负责显示股票盘的弹幕，支持错位显示和顺序显示
-->
<template>
  <!-- 弹幕容器 -->
  <div v-if="showDanmaku" class="danmaku-container">
    <!-- 弹幕项 -->
    <div
      v-for="danmaku in displayDanmakuList"
      :key="danmaku.id"
      class="danmaku-item"
      :style="{
        top: danmaku.top + '%',
        animationDuration: danmaku.duration + 's',
        animationDelay: danmaku.delay + 's',
        color: danmaku.color,
        fontSize: Math.min(18 + (danmaku.count - 1) * 2, 30) + 'px',
        fontWeight: Math.min(500 + (danmaku.count - 1) * 100, 900),
      }"
    >
      {{ danmaku.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";
import {
  currentDiskId,
  danmakuMap,
  type Danmaku as StoreDanmaku,
} from "../stores/stockStore";

/**
 * 弹幕项接口
 */
interface DanmakuItem {
  id: number; // 弹幕ID
  text: string; // 弹幕内容
  top: number; // 弹幕位置
  duration: number; // 弹幕持续时间
  delay: number; // 弹幕延迟时间
  color: string; // 弹幕颜色
  count: number; // 弹幕重复次数
  height: number; // 弹幕高度
}

/**
 * 组件属性接口
 */
interface Props {
  showDanmaku?: boolean; // 是否显示弹幕
  diskId?: number | null; // 股票盘ID
}

// 定义组件属性
const props = withDefaults(defineProps<Props>(), {
  showDanmaku: true, // 默认显示弹幕
  diskId: null, // 默认盘ID为null
});

// 显示的弹幕列表
const displayDanmakuList = ref<DanmakuItem[]>([]);
// 已处理的弹幕ID集合
const processedDanmakuIds = ref<Set<number>>(new Set());

/**
 * 计算弹幕高度
 * @param count 弹幕重复次数
 * @returns 弹幕高度
 */
function calculateDanmakuHeight(count: number): number {
  const fontSize = Math.min(18 + (count - 1) * 2, 30);
  return fontSize * 1.2;
}

/**
 * 将存储的弹幕转换为显示的弹幕
 * @param storeDanmaku 存储的弹幕
 * @returns 显示的弹幕
 */
function storeToDisplayDanmaku(storeDanmaku: StoreDanmaku): DanmakuItem {
  const count = storeDanmaku.count || 1;
  return {
    id: storeDanmaku.id,
    text: storeDanmaku.text,
    top: storeDanmaku.top,
    duration: storeDanmaku.duration,
    delay: Math.random() * 2,
    color: storeDanmaku.color,
    count,
    height: calculateDanmakuHeight(count),
  };
}

/**
 * 检查位置是否可用
 * @param top 弹幕顶部位置
 * @param height 弹幕高度
 * @returns 是否可用
 */
function isPositionAvailable(top: number, height: number): boolean {
  const buffer = 5;
  for (const danmaku of displayDanmakuList.value) {
    const danmakuTop = danmaku.top;
    const danmakuBottom = danmakuTop + danmaku.height;
    const newBottom = top + height;

    if (
      (top >= danmakuTop - buffer && top < danmakuBottom + buffer) ||
      (newBottom > danmakuTop - buffer &&
        newBottom <= danmakuBottom + buffer) ||
      (top <= danmakuTop - buffer && newBottom >= danmakuBottom + buffer)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * 寻找可用的顶部位置
 * @param count 弹幕重复次数
 * @returns 可用的顶部位置
 */
function findAvailableTop(count: number): number {
  const height = calculateDanmakuHeight(count);
  const maxAttempts = 50;

  for (let i = 0; i < maxAttempts; i++) {
    const top = Math.random() * (80 - height) + 5;
    if (isPositionAvailable(top, height)) {
      return top;
    }
  }

  return Math.random() * 80 + 5;
}

/**
 * 加载指定股票盘的弹幕
 * @param diskId 股票盘ID
 */
function loadDanmakuForDisk(diskId: number | null) {
  displayDanmakuList.value = [];
  processedDanmakuIds.value.clear();
  if (diskId === null) return;

  const storeDanmakuList = danmakuMap.value.get(diskId) || [];

  // 错位显示弹幕，每个弹幕按顺序依次显示
  storeDanmakuList.forEach((storeDanmaku, index) => {
    // 为每个弹幕添加递增延迟，确保一个接一个显示
    const delay = index * 800; // 800ms间隔，确保前一个弹幕完全显示后再显示下一个
    setTimeout(() => {
      displaySingleDanmaku(storeDanmaku);
    }, delay);
  });
}

/**
 * 显示单个弹幕
 * @param storeDanmaku 存储的弹幕
 */
function displaySingleDanmaku(storeDanmaku: StoreDanmaku) {
  if (processedDanmakuIds.value.has(storeDanmaku.id)) return;

  const danmaku = storeToDisplayDanmaku(storeDanmaku);
  danmaku.top = findAvailableTop(danmaku.count);
  displayDanmakuList.value.push(danmaku);
  processedDanmakuIds.value.add(storeDanmaku.id);

  // 弹幕结束后移除
  setTimeout(
    () => {
      removeDanmaku(danmaku.id);
    },
    (danmaku.duration + danmaku.delay) * 1000,
  );
}

/**
 * 添加新弹幕
 * @param text 弹幕内容
 * @returns 创建的弹幕
 */
function addDanmaku(text: string) {
  if (currentDiskId.value === null) return;

  const storeDanmaku: StoreDanmaku = {
    id: Date.now(),
    diskId: currentDiskId.value,
    text,
    timestamp: new Date().toISOString(),
    color: getRandomColor(),
    top: 0, // 会在displaySingleDanmaku中重新计算
    duration: 6 + Math.random() * 8, // 移动速度
    count: 1,
  };

  displaySingleDanmaku(storeDanmaku);
  return storeDanmaku;
}

/**
 * 移除弹幕
 * @param id 弹幕ID
 */
function removeDanmaku(id: number) {
  const index = displayDanmakuList.value.findIndex((d) => d.id === id);
  if (index !== -1) {
    displayDanmakuList.value.splice(index, 1);
  }
}

/**
 * 清除所有弹幕
 */
function clearAll() {
  displayDanmakuList.value = [];
  processedDanmakuIds.value.clear();
}

// 弹幕颜色列表
const colors = [
  "#ffffff",
  "#ffeb3b",
  "#00bcd4",
  "#ff5722",
  "#9c27b0",
  "#4caf50",
  "#e91e63",
];

/**
 * 获取随机颜色
 * @returns 随机颜色代码
 */
function getRandomColor(): string {
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * 获取随机顶部位置
 * @returns 随机顶部位置
 */
function getRandomTop(): number {
  return findAvailableTop(1);
}

// 监听盘ID变化
watch(
  () => props.diskId,
  (newDiskId) => {
    loadDanmakuForDisk(newDiskId);
  },
  { immediate: true },
);

// 监听弹幕变化
watch(
  () => danmakuMap.value.get(props.diskId || 0),
  (newDanmakuList, oldDanmakuList) => {
    if (!newDanmakuList || props.diskId === null) return;

    const newDanmakuIds = new Set(newDanmakuList.map((d) => d.id));
    const oldDanmakuIds = oldDanmakuList
      ? new Set(oldDanmakuList.map((d) => d.id))
      : new Set<number>();

    // 找出新增的弹幕并按顺序显示
    const newDanmus = newDanmakuList.filter((storeDanmaku) => {
      return (
        !oldDanmakuIds.has(storeDanmaku.id) &&
        !processedDanmakuIds.value.has(storeDanmaku.id)
      );
    });

    // 为新增的弹幕添加延迟，确保一个接一个显示
    newDanmus.forEach((storeDanmaku, index) => {
      const delay = index * 800;
      setTimeout(() => {
        displaySingleDanmaku(storeDanmaku);
      }, delay);
    });
  },
  { deep: true },
);

// 暴露方法给父组件
defineExpose({
  addDanmaku,
  clearAll,
});
</script>

<style scoped>
/* 弹幕容器 */
.danmaku-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* 允许点击穿透 */
  overflow: hidden;
  z-index: 1000; /* 确保弹幕在最上层 */
}

/* 弹幕项 */
.danmaku-item {
  position: absolute;
  left: 100%; /* 从右侧进入 */
  white-space: nowrap; /* 禁止换行 */
  font-size: 18px;
  font-weight: 500;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8); /* 添加文字阴影，提高可读性 */
  animation: danmaku-move linear forwards; /* 应用移动动画 */
}

/* 弹幕移动动画 */
@keyframes danmaku-move {
  from {
    transform: translateX(0); /* 起始位置 */
  }
  to {
    transform: translateX(calc(-100vw - 100%)); /* 结束位置，完全移出屏幕 */
  }
}
</style>
