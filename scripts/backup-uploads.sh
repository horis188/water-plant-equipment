#!/bin/bash
# 备份 uploads 目录(图片/视频)
# 建议: 一年备份一次,备份后用 tar 压缩到外部存储
# 用法: bash scripts/backup-uploads.sh
# 输出: backups/uploads-{yyyyMMdd}.tar.gz

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
UPLOADS_DIR="$PROJECT_DIR/server/uploads"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y%m%d)

mkdir -p "$BACKUP_DIR"

if [ ! -d "$UPLOADS_DIR" ] || [ -z "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
  echo "[备份] uploads 目录为空,无需备份"
  exit 0
fi

TOTAL_SIZE=$(du -sh "$UPLOADS_DIR" | cut -f1)
echo "[备份] 源目录: $UPLOADS_DIR ($TOTAL_SIZE)"
echo "[备份] 输出:   $BACKUP_DIR/uploads-$DATE.tar.gz"

tar -czf "$BACKUP_DIR/uploads-$DATE.tar.gz" -C "$UPLOADS_DIR" .

ARCHIVE_SIZE=$(du -sh "$BACKUP_DIR/uploads-$DATE.tar.gz" | cut -f1)
echo "[备份] 完成:   $ARCHIVE_SIZE"
echo "[备份] 迁移提示:"
echo "  - 上传到云存储/外部硬盘后,可清理本地: rm $BACKUP_DIR/uploads-$DATE.tar.gz"
echo "  - 恢复时: tar -xzf uploads-$DATE.tar.gz -C server/uploads/"
