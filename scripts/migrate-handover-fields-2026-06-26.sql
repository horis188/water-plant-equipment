-- ============================================================
-- 迁移脚本: handover_records 字段语义规范化
-- 日期: 2026-06-26
-- 作者: 虾子 (openclaw main)
-- 备份: ~/.openclaw/workspace/backups/water-plant-2026-06-26/
-- ============================================================
--
-- 目标:
--   1. handover_records: 弃用 _user (varchar, 语义混乱)
--      新增 _user_id (INT, 引用 users.id, 纯数字 JOIN)
--      保留 _role (岗位名) + _member (个人名)
--   2. handover_shifts: user_id (varchar) 保留兼容 (存 username)
--      不强迁历史脏数据
--   3. 修正 杨雪峰 team: A班 → B班
--   4. 修正 problem_orders 杨雪峰关联工单 team: A班 → B班
--
-- 兼容性: 旧字段 _user 暂不删除, 用 NULL 兜底以防漏改代码报错
--         (后续确认无依赖再 DROP)
-- ============================================================

START TRANSACTION;

-- 1. handover_records: 新增 _user_id 字段
ALTER TABLE handover_records
  ADD COLUMN handing_over_user_id INT NULL COMMENT '交班人 users.id (数字)' AFTER handing_over_user,
  ADD COLUMN taking_over_user_id INT NULL COMMENT '接班人 users.id (数字)' AFTER taking_over_user,
  ADD INDEX idx_handing_over_user_id (handing_over_user_id),
  ADD INDEX idx_taking_over_user_id (taking_over_user_id);

-- 2. 修正 杨雪峰 班组: A班 → B班
--    (handover_shifts.id=8 是杨雪峰夜班的当前活班次)
UPDATE handover_shifts
SET team = 'B班'
WHERE member_name = '杨雪峰' AND team = 'A班';

-- 3. 修正 problem_orders: 杨雪峰关联工单 team: A班 → B班
UPDATE problem_orders
SET team = 'B班'
WHERE member_name = '杨雪峰' AND team = 'A班';

UPDATE maintenance_orders
SET team = 'B班'
WHERE member_name = '杨雪峰' AND team = 'A班';

-- 4. 验证迁移
SELECT 'handover_records' AS tbl, COUNT(*) AS total,
       SUM(handing_over_user_id IS NOT NULL) AS with_user_id
  FROM handover_records
UNION ALL
SELECT 'handover_shifts', COUNT(*), SUM(team='B班' AND member_name='杨雪峰')
  FROM handover_shifts;

COMMIT;
