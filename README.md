# 供水厂设备管理平台

供水厂设备全生命周期管理平台——设备台账、巡检、报修工单、备件库存、交接班、驾驶舱数据大屏、RBAC 角色权限一体化。

## ✨ 核心功能

- **设备管理**：设备台账、状态变更、位置/类型字典、点位拓扑
- **巡检管理**：巡检计划、任务分配、异常上报、自动转工单
- **工单管理**：问题工单 → 维修工单流转、SLA 跟踪、模板复用、统计面板
- **备件管理**：库存台账、出入库流水、低库存告警
- **交接班**：班次配置、值班组、交接记录、值班备忘
- **驾驶舱**：通知公告、工单/巡检实时数据、SSE 推送
- **角色权限 (RBAC)**：角色 / 权限点 / 菜单按钮可配，按钮级粒度
- **SSE 实时推送**：业务事件实时通知前端

## 🛠 技术栈

### 前端
- **Vue 3** + Composition API (`<script setup>`)
- **TypeScript**
- **Vite 5**（开发/构建）
- **Vue Router 4**
- **Naive UI**（组件库）
- Pinia 风格 composables（`useDeviceStore` / `useWorkOrderStore` / `useSparepartStore` / `useAdminApi` / `useSSE` / `usePermission` / `useStorage`）

### 后端
- **Node.js 18+**（开发/生产）
- **Express 5**
- **MySQL 8**（`mysql2/promise` 连接池）
- **JWT 鉴权**（`jsonwebtoken`）
- **bcryptjs** 密码哈希
- **multer** 文件上传
- **SSE**（Server-Sent Events）实时推送

## 🚀 快速开始（本地开发）

```bash
# 1. 克隆
git clone https://github.com/horis188/water-plant-equipment.git
cd water-plant-equipment

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
vim .env   # 至少修改 MYSQL_PASSWORD / JWT_SECRET

# 4. 准备数据库(详见 DEPLOY.md)
mysql -u root -p
> CREATE DATABASE water_plant DEFAULT CHARSET utf8mb4;
> exit
bash server/db/init_db.sh    # 按提示输入密码,初始化所有表

# 5. 启动后端(终端 1)
npm run server
# 监听 http://localhost:3000

# 6. 启动前端(终端 2)
npm run dev
# 访问 http://localhost:5175/login
```

## 📁 项目结构

```
.
├── server/                  # Express 后端
│   ├── index.js             # 入口
│   ├── loadEnv.js           # .env 加载器(零依赖)
│   ├── auth_secret.js       # JWT 配置
│   ├── events.js            # SSE 事件总线
│   ├── db/                  # 数据库连接 + SQL 初始化
│   │   ├── mysql.js
│   │   ├── init.sql         # 文档/索引
│   │   ├── init_db.sh       # 一键初始化脚本
│   │   ├── init_handover.sql
│   │   ├── init_rbac.sql
│   │   ├── init_workorder_templates.sql
│   │   └── jsonFields.js
│   ├── routes/              # 业务路由(15+ 模块)
│   ├── middleware/          # 鉴权/权限中间件
│   └── uploads/             # 上传文件(运行时,不入库)
├── src/                     # Vue 3 前端
│   ├── views/               # 页面
│   ├── components/          # 组件
│   ├── composables/         # 业务 composable (store)
│   ├── services/            # API 服务层
│   ├── router/              # 路由
│   ├── styles/              # 全局样式
│   └── assets/              # 静态资源
├── scripts/                 # 运维脚本
│   └── backup-uploads.sh
├── systemd/                 # systemd service 模板
│   ├── water-plant-backend.service
│   └── water-plant-frontend.service
├── public/                  # 前端静态资源
├── .env.example             # 环境变量模板
├── .gitignore
├── vite.config.ts
├── tsconfig.json
├── package.json
├── DEPLOY.md                # 部署指南
└── SPEC.md                  # 产品规格(登录页视觉规范等)
```

## 📜 常用脚本

```bash
npm run dev        # 启动 Vite 开发服务器(:5175)
npm run build      # 类型检查 + 生产构建
npm run preview    # 预览构建产物
npm run server     # 启动 Express 后端(:3000)
```

## 🔐 默认账号

部署完成后,需在数据库插入第一个管理员账号(见 DEPLOY.md「种子数据」一节)。

## 📚 文档

- [DEPLOY.md](./DEPLOY.md) — 从 0 到 1 部署指南
- [SPEC.md](./SPEC.md) — 产品规格(登录页视觉规范等)

## 🔧 系统服务

```bash
# 后端
cp systemd/water-plant-backend.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now water-plant-backend

# 前端(开发模式,生产环境建议 nginx 反代 + 静态构建)
cp systemd/water-plant-frontend.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now water-plant-frontend

# 查看状态/日志
systemctl --user status water-plant-backend
journalctl --user -u water-plant-backend -f
```

## 📦 备份

```bash
# 定期备份上传文件(图片/视频)
bash scripts/backup-uploads.sh
# 输出: backups/uploads-YYYYMMDD.tar.gz
```

## 📝 License

Internal use only.
