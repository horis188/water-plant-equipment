#!/bin/bash
# Kimi CLI 代码生成调用脚本
# 用法: ./kimi-coder.sh "任务描述"
# 依赖: 需要先执行 kimi login

export PATH="$HOME/.local/bin:$PATH"

TASK="$1"
if [ -z "$TASK" ]; then
    echo "❌ 任务描述不能为空"
    exit 1
fi

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
- 组件使用 PascalCase（如 UserLogin.vue）
- 样式使用 Scoped CSS 或 CSS Variables
- 类型定义使用 Interface
- 禁止使用 any 类型

## 输出要求
1. 生成的代码文件路径
2. 完整的 Vue 组件代码
3. 如有新文件，说明创建位置"

echo "🤖 Kimi 正在生成代码..."
echo "📋 任务: ${TASK:0:50}..."
echo ""

# 使用 --print 进行非交互模式
kimi -p "$PROMPT" --print --quiet 2>&1
