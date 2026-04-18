# AI Studio - 前端开发工作室

## 🎯 目标
多 Agent 协作完成前端项目开发，减少错误，提高效率。

## 🏗️ 架构

```
用户
  ↓
┌─────────────────────────────────────┐
│  Leader Agent (MiniMax 2.7)          │
│  - 需求分析                          │
│  - 任务拆解                          │
│  - 分发调度                          │
│  - 结果汇总                          │
└─────────────────────────────────────┘
  ↓         ↓         ↓
┌────────┐ ┌────────┐ ┌────────┐
│Worker A│ │Worker B│ │Worker N│
│(模块1) │ │(模块2) │ │(...).. │
└────────┘ └────────┘ └────────┘
  ↓
┌─────────────────────────────────────┐
│  Review Agent (Kimi 2.5)             │
│  - 代码审核                          │
│  - 问题标注                          │
│  - 修改建议                          │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│  Leader Agent                        │
│  - 整合审核意见                      │
│  - 呈现最终结果                      │
└─────────────────────────────────────┘
```

## 📁 目录结构

```
/home/hzh/文档/project/
├── README.md              # 本文件
├── projects/             # 项目代码存放
│   └── [项目名]/
│       ├── src/
│       ├── components/
│       ├── stores/
│       ├── views/
│       └── ...
├── workspace-leader/     # Leader Agent 工作区
├── workspace-review/     # Review Agent 工作区
└── workspace-workers/    # Worker Agent 工作区
```

## 🔧 技术栈

- **框架**：Vue 3 + Vite + TypeScript
- **状态管理**：Pinia
- **UI 组件**：Naive UI / Element Plus
- **路由**：Vue Router 4
- **代码规范**：ESLint + Prettier

## 🚀 工作流程

### 阶段1：需求确认
1. 用户描述需求
2. Leader 分析并拆解任务
3. **汇报给用户确认** ← 重要步骤

### 阶段2：并行开发
1. Leader 分发任务给 Workers
2. Workers 并行开发各自模块
3. 完成后提交给 Review Agent

### 阶段3：代码审核
1. Review Agent 审核所有代码
2. 标注问题，返回修改建议
3. Leader 分发修改任务

### 阶段4：整合交付
1. 所有修改完成
2. Leader 整合并呈现结果
3. 用户验收

## 💡 使用方式

在 OpenClaw 主会话（Leader）中：
1. 描述你的项目需求
2. Leader 分析并拆解任务
3. 确认任务拆分后，Leader 分发给 Workers
4. 各 Worker 完成工作
5. Review Agent 审核
6. Leader 汇总呈现

## ⚙️ Agent 配置

| Agent | 模型 | 职责 |
|-------|------|------|
| Leader | MiniMax 2.7 | 调度、协调、汇总 |
| Review | Kimi 2.5 | 代码审核 |
| Worker A/B | 灵活 | 具体开发任务 |
