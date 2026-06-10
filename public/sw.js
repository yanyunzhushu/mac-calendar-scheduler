// Service Worker —— 使应用可被安装到 Dock / 桌面
// 目前处于最小阶段：注册自身以激活 PWA 安装能力
// 后续可在此文件中添加缓存策略实现离线使用

self.addEventListener('install', () => {
  // 跳过等待，立即激活新版本
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // 接管所有打开的页面
  event.waitUntil(clients.claim())
})

// 所有请求直接透传（后续可改为缓存优先等策略）
self.addEventListener('fetch', () => {})
