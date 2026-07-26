# 测试指南

> ⚠️ **占位文件 — 当前不适用**

当前项目**未配置任何测试框架**，没有测试目录或测试命令。

## 当前验证方式

1. `pnpm build` — 验证构建是否成功
2. 浏览器中手动确认功能是否正常
3. 通过浏览器控制台（F12）注入测试数据，观察各视图渲染

## 测试数据注入

详细说明见 CLAUDE.md 中的「测试数据」章节。

**方式 A：控制台脚本**
在对话中生成测试数据脚本 → 粘贴到 F12 控制台 → 页面自动刷新。

**方式 B：临时硬编码**
在 `use-app-state.ts` 中临时写入 `localStorage.setItem(...)` → 构建 → 用户刷新后回退代码。

**清空数据**：
```js
localStorage.removeItem('calendar-app-state');
location.reload();
```

## 未来方向

如需添加测试框架，推荐方案：

- **单元测试**: Vitest（与 TypeScript + React 兼容性好）
- **组件测试**: React Testing Library
- **端到端测试**: Playwright（适合验证日历交互流程）

核心纯函数（`lib/task-engine.ts`、`lib/date-utils.ts`）不含 React 依赖，可以直接用 Vitest 进行单元测试，无需额外配置。
