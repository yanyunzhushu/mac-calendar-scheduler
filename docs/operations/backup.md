# 备份与恢复

> ⚠️ **占位文件 — 当前不适用**

「日程安排」的数据存储在浏览器 `localStorage` 中，无自动备份机制。

## 当前手动备份方式

在浏览器控制台（F12）执行：

**导出**：
```js
copy(localStorage.getItem('calendar-app-state'))
// 粘贴到本地文件保存
```

**恢复**：
```js
localStorage.setItem('calendar-app-state', '<JSON字符串>')
location.reload()
```

**清空**：
```js
localStorage.removeItem('calendar-app-state')
location.reload()
```

## 风险说明

- 清除浏览器数据 → 数据永久丢失
- 隐私模式/无痕浏览 → 会话结束后数据清除
- 建议定期手动导出备份

## 未来方向

若迁移至 Tauri，见 CLAUDE.md 迁移路线图，数据将存储到文件系统（SQLite 或 JSON 文件），可实现自动备份。
