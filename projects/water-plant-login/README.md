# 供水厂设备管理平台 - 登录模块

## 📋 项目简介

供水厂设备管理平台的登录页面，基于 Vue 3 + TypeScript + Vite 构建。

## 🛠️ 环境要求

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **Git**: 任意版本

## 🚀 本地运行

```bash
# 克隆项目（已有项目可跳过）
git clone https://github.com/horis188/water-plant-equipment.git
cd water-plant-equipment/projects/water-plant-login

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:5175/login

## 📦 项目结构

```
water-plant-login/
├── src/
│   ├── components/       # 组件
│   │   ├── LoginCard.vue       # 登录卡片
│   │   ├── WaterBackground.vue  # 水流动画背景
│   │   ├── WaterButton.vue      # 水系风格按钮
│   │   ├── WaterInput.vue       # 水系风格输入框
│   │   ├── VerifyCode.vue       # 验证码组件
│   │   └── icons/              # SVG 图标
│   ├── views/
│   │   └── LoginView.vue        # 登录页视图
│   ├── styles/
│   │   └── variables.css        # CSS 变量
│   ├── router/
│   │   └── index.ts             # 路由配置
│   ├── App.vue                  # 根组件
│   └── main.ts                  # 入口文件
├── public/
│   └── logo.svg                 # Logo
├── index.html
├── vite.config.ts               # Vite 配置
├── tsconfig.json                # TypeScript 配置
└── package.json
```

## 🎨 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | ^3.4.21 | 渐进式框架 |
| Vue Router | ^4.3.0 | 路由管理 |
| TypeScript | ^5.4.0 | 类型安全 |
| Vite | ^5.2.0 | 构建工具 |

## 🔐 测试账号

- 账号：`admin`
- 密码：`admin123`

## 📝 开发命令

```bash
# 开发模式
npm run dev

# 类型检查
npm run build

# 预览构建结果
npm run preview
```

## 🔧 环境配置

项目使用以下环境变量（如需）：

```env
# .env.local
VITE_API_BASE_URL=http://localhost:3000
```

## 📚 相关文档

- [Vue 3 文档](https://vuejs.org/)
- [Vite 文档](https://vitejs.dev/)
- [TypeScript 文档](https://www.typescriptlang.org/)
- [Vue Router 文档](https://router.vuejs.org/)
