#!/bin/bash
export PATH="$HOME/.local/bin:$PATH"
TASK="$1"
PROMPT="你是一个 Vue 3 前端开发者。请根据以下需求生成代码：

## 任务描述
$TASK

## 技术栈
- Vue 3 + Composition API (<script setup>)
- TypeScript
- Pinia（状态管理）
- Vue Router

## 项目目录
/home/hzh/文档/project/projects/water-plant-login/src

## 代码规范
- 组件使用 PascalCase
- 样式使用 Scoped CSS
- 类型定义使用 Interface
- 禁止使用 any 类型

## 输出要求
1. 生成完整的 Vue 组件代码
2. 生成完整的 Store 代码
3. 生成文件路径和完整代码内容"

kimi -p "$PROMPT" --print --quiet 2>&1
