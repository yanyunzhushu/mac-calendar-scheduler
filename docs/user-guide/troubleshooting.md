# 常见问题排查

## 页面空白 / 加载不出来

1. 检查服务是否运行：`lsof -i :3000`
2. 如果没有进程在监听，运行 `pnpm build && pnpm dev`
3. 检查浏览器控制台（F12 → Console）是否有错误
4. 尝试清除浏览器缓存

## 数据丢失

**可能原因**：

- 清除了浏览器数据/缓存
- 使用了隐私模式/无痕浏览（会话结束后数据被清除）
- 手动执行了 `localStorage.removeItem('calendar-app-state')`

**预防措施**：

定期导出数据（F12 → Console）：

```js
console.log(localStorage.getItem('calendar-app-state'))
```

将输出的 JSON 字符串保存到本地文件。

## 新建任务按钮没反应

对话框通常会在点击后立即弹出。如果没反应：

1. 检查浏览器控制台是否有 JavaScript 错误
2. 尝试刷新页面（数据保存在 localStorage，刷新不会丢失）
3. 如果持续出现，可能是 `localStorage` 数据损坏，尝试导出→清空→重新导入

## 端口 3000 被占用

`scripts/serve.mjs` 会自动处理端口冲突：
- 端口空闲 → 直接启动
- 被健康服务器占用（health check 通过）→ 复用
- 被僵尸进程占用 → 自动杀进程后重启

如果自动处理无效，手动执行：

```bash
pkill -f "scripts/serve"
```

然后重新 `pnpm dev`。

## 构建失败

```bash
pnpm build    # 查看具体错误信息
```

常见原因：
- `out/` 目录权限问题 → `rm -rf out && pnpm build`
- 依赖丢失 → `pnpm install && pnpm build`

TypeScript 类型错误不会阻止构建（配置了 `ignoreBuildErrors: true`）。

## 任务不显示

1. 确认任务在对应日期范围内
2. 检查是否开启了**假期模式**（周期/进度任务在假期区间内不显示）
3. 检查是否启用了**任务视图**（聚焦模式）——仅显示被聚焦任务
4. 检查任务是否被**暂停**（paused 的任务不生成今天之后的实例）
5. 持续进度任务：未来日期不会生成实例，仅显示到今天为止

## 样式错乱

1. 确保运行 `pnpm build`（而非 `pnpm dev:next`）来验证最终构建
2. CSS 依赖 Tailwind v4，确保 `postcss.config.mjs` 配置存在
3. 清除浏览器缓存后重试
