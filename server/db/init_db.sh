#!/bin/bash
# ====================================================================
# 供水厂设备管理平台 - 数据库一键初始化脚本
#
# 用法:
#   bash server/db/init_db.sh
#
# 行为:
#   1. 提示输入 MySQL root 密码
#   2. 创建数据库(如不存在)
#   3. 按顺序执行 SQL 文件:
#        a) core_schema.sql(从 dev 库导出的 16 张核心表)  ← 可选,不存在则跳过
#        b) init_handover.sql
#        c) init_rbac.sql
#        d) init_workorder_templates.sql
#
# 退出码: 0 成功 / 非零 失败
# ====================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_NAME="${MYSQL_DATABASE:-water_plant}"
DB_USER="${MYSQL_USER:-root}"

echo "============================================================"
echo "  供水厂平台 - 数据库初始化"
echo "  数据库名: $DB_NAME"
echo "  目标目录: $SCRIPT_DIR"
echo "============================================================"

# 询问 root 密码
read -s -p "MySQL [$DB_USER] 密码: " MYSQL_PWD
echo ""

run_sql() {
  local file="$1"
  local label="$2"
  if [ ! -f "$file" ]; then
    echo "  - 跳过 $label (文件不存在: $file)"
    return 0
  fi
  echo "  - 执行 $label ..."
  MYSQL_PWD="$MYSQL_PWD" mysql -u "$DB_USER" "$DB_NAME" < "$file"
  echo "    ✓ $label 完成"
}

# 1. 创建数据库
echo ""
echo "[1/2] 创建数据库"
MYSQL_PWD="$MYSQL_PWD" mysql -u "$DB_USER" -e \
  "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "  ✓ 数据库 \`$DB_NAME\` 就绪"

# 2. 执行 SQL 文件
echo ""
echo "[2/2] 执行初始化 SQL"
run_sql "$SCRIPT_DIR/core_schema.sql"                "core_schema.sql (16 张核心表,从 dev 库导出)"
run_sql "$SCRIPT_DIR/init_handover.sql"              "init_handover.sql"
run_sql "$SCRIPT_DIR/init_rbac.sql"                  "init_rbac.sql"
run_sql "$SCRIPT_DIR/init_workorder_templates.sql"   "init_workorder_templates.sql"

echo ""
echo "============================================================"
echo "  ✓ 数据库初始化完成"
echo "============================================================"
echo "下一步:"
echo "  1. 在 .env 中配置 MYSQL_USER / MYSQL_PASSWORD (用户需有 $DB_NAME 库权限)"
echo "  2. (可选) 插入种子数据 / 默认管理员账号"
echo "  3. 启动后端: npm run server   或   systemctl --user start water-plant-backend"
