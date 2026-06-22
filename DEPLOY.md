# 部署指南 — 从 0 到 1 部署供水厂设备管理平台

> 适用场景：在一台**全新**的 Linux 服务器上完整部署本平台。
> 预计耗时：30-60 分钟（不含网络下载时间）。

## 目录

1. [环境要求](#1-环境要求)
2. [准备 MySQL](#2-准备-mysql)
3. [导出/初始化数据库](#3-导出初始化数据库)
4. [部署应用](#4-部署应用)
5. [配置 systemd 托管](#5-配置-systemd-托管)
6. [插入种子数据](#6-插入种子数据-首次部署必需)
7. [验证](#7-验证)
8. [常见问题](#8-常见问题)

---

## 1. 环境要求

| 组件 | 版本 | 验证命令 |
|---|---|---|
| **OS** | Linux（Ubuntu 22.04+ / CentOS 8+ / Debian 11+） | `cat /etc/os-release` |
| **Node.js** | ≥ 18.0.0（推荐 20 LTS 或 22） | `node -v` |
| **npm** | ≥ 9.0.0 | `npm -v` |
| **MySQL** | ≥ 8.0 | `mysql --version` |
| **Git** | 任意 | `git --version` |

```bash
# Ubuntu/Debian 快速安装
sudo apt update
sudo apt install -y nodejs npm mysql-server git

# 启动 MySQL
sudo systemctl enable --now mysql
sudo mysql_secure_installation   # 设置 root 密码
```

## 2. 准备 MySQL

```bash
# 用 root 登录
sudo mysql -u root -p
```

```sql
-- 创建应用专用账号(不要用 root 跑应用)
CREATE USER 'swsc'@'localhost' IDENTIFIED BY '<填一个强密码>';
CREATE DATABASE water_plant DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON water_plant.* TO 'swsc'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

> ⚠️ **不要把 root 密码写到 `.env` 里**。上面创建的 `swsc` 账号只对 `water_plant` 库有权限，更安全。

## 3. 导出/初始化数据库

### 3.1 如果你从已有 dev 库迁移

在 **dev 库所在机器** 执行：

```bash
# 导出缺失的 16 张核心表结构 + 1 个视图(无数据)
mysqldump -h <dev-host> -u swsc -p \
  --no-data --skip-comments --skip-add-drop-table \
  water_plant \
  users spareparts sparepart_logs \
  inspection_plans inspection_items inspection_records inspection_task_records \
  maintenance_orders maintenance_items maintenance_plans maintenance_records \
  shift_teams shift_config locations position_dict problem_orders \
  v_inspection_user_tasks \
  > core_schema.sql

# 把 core_schema.sql 放到目标机器的 server/db/ 目录下
scp core_schema.sql user@<server>:/path/to/project/server/db/
```

> ⚠️ `v_inspection_user_tasks` 是 **视图**（代码里 dashboard 巡检模块会查），不在表列表里但必须一起导出，否则查询会报"视图不存在"。
> 
> 如果还有其它视图/触发器/存储过程，也用 `mysqldump --no-data --routines --triggers` 单独导一份。

> 💡 如果你想**连数据一起迁**，去掉 `--no-data`：
> ```bash
> mysqldump -h <dev-host> -u swsc -p water_plant > full_dump.sql
> ```
> 但生产部署建议只导结构,种子数据自己插(见第 6 节)。

### 3.2 在目标机器上执行一键初始化

```bash
cd /path/to/project
bash server/db/init_db.sh
# 按提示输入 MySQL root 密码(脚本会用它建库/执行 SQL)
```

脚本会按顺序执行：
1. `CREATE DATABASE water_plant`（如果不存在）
2. `core_schema.sql`（16 张核心表，从 dev 库导出，**首次部署前必须先准备这个文件**）
3. `init_handover.sql`（6 张表）
4. `init_rbac.sql`（3 张表）
5. `init_workorder_templates.sql`（1 张表）

## 4. 部署应用

```bash
# 4.1 克隆代码
cd /home/<your-user>     # 建议放在用户家目录下
git clone https://github.com/horis188/water-plant-equipment.git
cd water-plant-equipment

# 4.2 安装依赖
npm install

# 4.3 配置环境变量
cp .env.example .env
vim .env
```

`.env` 关键变量（**生产环境必改**）：

```ini
PORT=3000

# 上面 §2 创建的 swsc 账号
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=swsc
MYSQL_PASSWORD=<第 2 步填的强密码>
MYSQL_DATABASE=water_plant

# 用 openssl rand -hex 32 生成
JWT_SECRET=<32 字节随机字符串>
JWT_EXPIRES_IN=8h

UPLOAD_DIR=server/uploads

VITE_PORT=5175
VITE_API_BASE=http://localhost:3000
```

```bash
# 4.4 构建前端(可选,仅生产环境需要)
npm run build
# 产物: dist/

# 4.5 创建运行时目录
mkdir -p server/uploads
chmod 755 server/uploads
```

## 5. 配置 systemd 托管

```bash
# 5.1 复制 service 模板
mkdir -p ~/.config/systemd/user
cp systemd/water-plant-backend.service  ~/.config/systemd/user/
cp systemd/water-plant-frontend.service ~/.config/systemd/user/

# 5.2 修改 service 文件(部署环境路径可能不同)
vim ~/.config/systemd/user/water-plant-backend.service
#  关键修改:
#    User=<your-linux-user>
#    WorkingDirectory=/home/<your-user>/water-plant-equipment
#    EnvironmentFile=/home/<your-user>/water-plant-equipment/.env

vim ~/.config/systemd/user/water-plant-frontend.service
#  关键修改: 同上(WorkingDirectory + EnvironmentFile)

# 5.3 启用并启动
systemctl --user daemon-reload
systemctl --user enable --now water-plant-backend
systemctl --user enable --now water-plant-frontend

# 5.4 设置 linger(允许 user service 在用户未登录时继续运行)
sudo loginctl enable-linger <your-linux-user>
```

### 5.5 验证服务状态

```bash
systemctl --user status water-plant-backend
systemctl --user status water-plant-frontend

# 实时日志
journalctl --user -u water-plant-backend -f
journalctl --user -u water-plant-frontend -f
```

## 6. 插入种子数据（首次部署必需）

数据库表结构建好后，**必须** 插入至少一个管理员账号，否则无法登录。

```bash
mysql -u swsc -p water_plant
```

```sql
-- 6.1 插入一个超级管理员(role = 'admin' 是代码里写死的超级角色)
-- 密码: admin123(请立刻登录后改掉!)
-- 哈希值用 bcrypt 生成(见下方 Node 一行命令)
INSERT INTO users (username, name, role, password, created_at, updated_at)
VALUES ('admin', '系统管理员', 'admin', '<bcrypt 哈希>', NOW(), NOW());

-- 6.2 插入基础位置字典(根据实际现场调整)
INSERT INTO locations (name, code, sort, created_at) VALUES
  ('一厂',  'PLANT_1', 1, NOW()),
  ('二厂',  'PLANT_2', 2, NOW()),
  ('加压站', 'PUMP_1',  3, NOW());

-- 6.3 插入基础职位字典
INSERT INTO position_dict (name, code, sort, created_at) VALUES
  ('厂长',   'FACTORY_HEAD', 1, NOW()),
  ('副厂长', 'DEPUTY_HEAD',  2, NOW()),
  ('运行班长', 'SHIFT_LEADER', 3, NOW()),
  ('运行员',   'OPERATOR',      4, NOW()),
  ('维修工',   'MAINTENANCE',   5, NOW());
```

生成 bcrypt 哈希的 Node 一行命令：

```bash
node -e "console.log(require('bcryptjs').hashSync('admin123', 10))"
```

把输出粘到上面 SQL 的 `<bcrypt 哈希>` 处。

## 7. 验证

```bash
# 7.1 后端健康检查
curl http://localhost:3000/api/health
# 期望: {"status":"ok","timestamp":"..."}

# 7.2 登录测试
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# 期望: 返回 { token: "..." }

# 7.3 访问前端
# 浏览器打开 http://localhost:5175/login
# 用 admin / admin123 登录,进入驾驶舱
```

## 8. 常见问题

### Q1: 启动报 "EADDRINUSE :::3000"
端口 3000 被占用。修改 `.env` 的 `PORT=3001`，同时改 `VITE_API_BASE`。

### Q2: 启动报 "ER_ACCESS_DENIED_ERROR"
MySQL 账号密码错。检查 `.env` 的 `MYSQL_USER` / `MYSQL_PASSWORD`。
同时确认账号对 `water_plant` 库有权限：
```sql
SHOW GRANTS FOR 'swsc'@'localhost';
```

### Q3: 登录页打不开 / API 404
确认前端 `.env` 的 `VITE_API_BASE` 和后端 `PORT` 一致。
前端 dev 模式通过 vite proxy 转发 `/api` 和 `/uploads`，所以 VITE_API_BASE 只在**生产构建**下走直连。

### Q4: 上传文件后访问 404
确认 `server/uploads/` 目录存在且可写：
```bash
ls -ld server/uploads
# 期望: drwxr-xr-x ...
chmod 755 server/uploads
```

### Q5: 缺 "core_schema.sql" 怎么办
必须从 dev 库导出（见 §3.1），或者在 dev 库上跑：
```bash
mysqldump --no-data --skip-comments water_plant > all_schema.sql
```
然后把不需要的表（`devices` / `roles` 等 10 张已有表）删掉，只留缺的 16 张。

### Q6: 想用 nginx 反向代理代替 Vite dev server
```bash
npm run build  # 生成 dist/
```
nginx 配置示例：
```nginx
server {
  listen 80;
  server_name your.domain;

  location / {
    root /home/<user>/water-plant-equipment/dist;
    try_files $uri $uri/ /index.html;
  }

  location /api/  { proxy_pass http://127.0.0.1:3000; }
  location /uploads/ { proxy_pass http://127.0.0.1:3000; }

  # SSE 需要禁用缓冲
  location /api/events {
    proxy_pass http://127.0.0.1:3000;
    proxy_buffering off;
    proxy_cache off;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
  }
}
```
然后停掉 `water-plant-frontend.service`，禁用 `water-plant-frontend.service` 即可。

---

部署完成 🎉 遇到问题先看 `journalctl --user -u water-plant-backend -n 100`。
