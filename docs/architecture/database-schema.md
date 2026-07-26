# 数据库设计

> ⚠️ **占位文件 — 当前不适用**

当前「日程安排」为纯客户端应用，使用浏览器 `localStorage`（键名 `calendar-app-state`）存储全部数据，**没有数据库**。

## 当前存储方案

- **介质**: 浏览器 localStorage
- **键名**: `calendar-app-state`
- **格式**: JSON 字符串（`AppState` 类型）
- **持久化方式**: 每次状态变化时整体序列化写入

## 未来可能的方向

参见 CLAUDE.md 中的「迁移到 Tauri 的路线图」：

- 若迁移至 Tauri + SQLite：数据存储到 `~/Library/Application Support/<app-id>/` 下的 SQLite 文件
- 表结构需参照 `lib/types.ts` 中的 `AppState` 定义设计
- 纯函数层（`lib/task-engine.ts`、`lib/date-utils.ts`、`lib/types.ts`）无需修改

## 当前数据结构

详细定义见 [数据持久化规格](../specifications/data-persistence-spec.md)。
