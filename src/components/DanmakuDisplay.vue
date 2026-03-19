<template>
  <div v-if="showDanmaku" class="danmaku-container">
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

interface DanmakuItem {
  id: number;
  text: string;
  top: number;
  duration: number;
  delay: number;
  color: string;
  count: number;
}

interface Props {
  showDanmaku?: boolean;
  diskId?: number | null;
}

const props = withDefaults(defineProps<Props>(), {
  showDanmaku: true,
  diskId: null,
});

const displayDanmakuList = ref<DanmakuItem[]>([]);
const processedDanmakuIds = ref<Set<number>>(new Set());

function storeToDisplayDanmaku(storeDanmaku: StoreDanmaku): DanmakuItem {
  return {
    id: storeDanmaku.id,
    text: storeDanmaku.text,
    top: storeDanmaku.top,
    duration: storeDanmaku.duration,
    delay: 0,
    color: storeDanmaku.color,
    count: storeDanmaku.count || 1,
  };
}

function loadDanmakuForDisk(diskId: number | null) {
  displayDanmakuList.value = [];
  processedDanmakuIds.value.clear();
  if (diskId === null) return;

  const storeDanmakuList = danmakuMap.value.get(diskId) || [];

  // 错位显示弹幕，每个弹幕有不同的延迟时间
  storeDanmakuList.forEach((storeDanmaku, index) => {
    // 为每个弹幕添加随机延迟，范围在0-2000ms之间
    const delay = index * 100 + Math.random() * 1000;
    setTimeout(() => {
      displaySingleDanmaku(storeDanmaku);
    }, delay);
  });
}

function displaySingleDanmaku(storeDanmaku: StoreDanmaku) {
  if (processedDanmakuIds.value.has(storeDanmaku.id)) return;

  const danmaku = storeToDisplayDanmaku(storeDanmaku);
  displayDanmakuList.value.push(danmaku);
  processedDanmakuIds.value.add(storeDanmaku.id);

  setTimeout(
    () => {
      removeDanmaku(danmaku.id);
    },
    (danmaku.duration + danmaku.delay) * 1000,
  );
}

function addDanmaku(text: string) {
  if (currentDiskId.value === null) return;

  const storeDanmaku: StoreDanmaku = {
    id: Date.now(),
    diskId: currentDiskId.value,
    text,
    timestamp: new Date().toISOString(),
    color: getRandomColor(),
    top: getRandomTop(),
    duration: 6 + Math.random() * 8, // 移动速度
    count: 1,
  };

  displaySingleDanmaku(storeDanmaku);
  return storeDanmaku;
}

function removeDanmaku(id: number) {
  const index = displayDanmakuList.value.findIndex((d) => d.id === id);
  if (index !== -1) {
    displayDanmakuList.value.splice(index, 1);
  }
}

function clearAll() {
  displayDanmakuList.value = [];
  processedDanmakuIds.value.clear();
}

const colors = [
  "#ffffff",
  "#ffeb3b",
  "#00bcd4",
  "#ff5722",
  "#9c27b0",
  "#4caf50",
  "#e91e63",
];

function getRandomColor(): string {
  return colors[Math.floor(Math.random() * colors.length)];
}

function getRandomTop(): number {
  return Math.random() * 80 + 5;
}

watch(
  () => props.diskId,
  (newDiskId) => {
    loadDanmakuForDisk(newDiskId);
  },
  { immediate: true },
);

watch(
  () => danmakuMap.value.get(props.diskId || 0),
  (newDanmakuList, oldDanmakuList) => {
    if (!newDanmakuList || props.diskId === null) return;

    const newDanmakuIds = new Set(newDanmakuList.map((d) => d.id));
    const oldDanmakuIds = oldDanmakuList
      ? new Set(oldDanmakuList.map((d) => d.id))
      : new Set<number>();

    newDanmakuList.forEach((storeDanmaku) => {
      if (
        !oldDanmakuIds.has(storeDanmaku.id) &&
        !processedDanmakuIds.value.has(storeDanmaku.id)
      ) {
        displaySingleDanmaku(storeDanmaku);
      }
    });
  },
  { deep: true },
);

defineExpose({
  addDanmaku,
  clearAll,
});
</script>

<style scoped>
.danmaku-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
  z-index: 1000;
}

.danmaku-item {
  position: absolute;
  left: 100%;
  white-space: nowrap;
  font-size: 18px;
  font-weight: 500;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  animation: danmaku-move linear forwards;
}

@keyframes danmaku-move {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(calc(-100vw - 100%));
  }
}
</style>
