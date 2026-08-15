# 前端审查改进清单

> 基于对「日程安排」应用的前端显示效果、应用逻辑与 UI 合理性审查整理。

## 已完成 ✅

- [x] **新建任务弹窗缺少标题**
  - 位置：`components/calendar/task-form.tsx`
  - 问题：创建新任务时 Dialog 标题为空，用户不知道当前是新建还是编辑。
  - 修复：标题根据 `editingTask` 状态显示为「编辑任务」或「新建任务」。

- [x] **假期模式描述与实际行为不符**
  - 位置：`components/calendar/holiday-dialog.tsx`
  - 问题：原描述「截止日自动顺延」会让用户以为任务截止日期会被修改。
  - 修复：改为「周期任务与持续进度任务在假期区间内隐藏，假期结束后自动恢复」。

- [x] **进度任务步骤编辑策略调整**
  - 位置：`components/calendar/task-form.tsx` / `components/calendar/progress-step-editor.tsx`
  - 问题：原先已产生完成记录后步骤结构（增删步骤、起始步骤、模式切换）和推进天数全部锁定，但用户需要能够调整每步推进天数。
  - 调整（2026-08-15）：步骤结构仍锁定（不可增删步骤、不可改起始步骤、不可切换简洁/详细模式），但步骤名称与推进天数始终可改；推进天数的修改会基于当前 `steps.interval` 实时重算进度条覆盖范围（追溯调整）。

## 待处理 / 建议后续处理 ⏳

- [ ] **`pnpm lint` 脚本无法运行**
  - 位置：`package.json`
  - 说明：仓库未安装 ESLint 也未配置 ESLint 配置文件，`pnpm lint` 会失败。需要安装 ESLint 并补充配置，或移除该脚本。

- [ ] **图例组件未投入使用**
  - 位置：`components/calendar/legend.tsx`
  - 说明：组件存在但没有任何文件引用，资源闲置。可考虑接入月/周视图，或删除以减少维护负担。

- [ ] **分组功能数据层已就绪但 UI 未接线**
  - 位置：`lib/use-app-state.ts` / `components/calendar/task-form.tsx`
  - 说明：`groupId`、`groups`、级联删除/恢复已实现，但当前没有创建/选择分组的 UI 入口。

- [ ] **缺少测试框架与自动化验证**
  - 说明：当前验证依赖 `pnpm build` + 浏览器手动确认。建议至少为核心纯函数（`task-engine.ts`、`date-utils.ts`）补充单元测试。

- [ ] **回收站清空/彻底删除缺少二次确认**
  - 位置：`components/calendar/trash-dialog.tsx`
  - 说明：清空回收站和彻底删除当前直接执行，误触风险较高。

- [ ] **今日待办 / 昨日遗留缺少集中汇总视图**
  - 说明：当天实例由规则自动生成，但没有一个独立面板列出「今天必须处理」和「昨天未补」的事项，需要跨日期查看。

- [ ] **PWA Service Worker 功能过于简化**
  - 位置：`public/sw.js`
  - 说明：当前仅注册自身以支持「添加到 Dock」，无离线缓存策略。

## 备注

- 所有日期状态使用 `DateKey`（`YYYY-MM-DD`），不引入 `Date` 对象。
- 未完成任务的状态由 `task-engine.ts` 自动生成：
  - 普通/周期/复习任务：`missed`（可后续补做）
  - 进度任务过去日：`skipped`
  - 当天可操作：`pending`
