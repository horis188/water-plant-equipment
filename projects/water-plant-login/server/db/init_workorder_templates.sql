-- ====================================================================
-- P2.1 工单模板表
-- ====================================================================
CREATE TABLE IF NOT EXISTS workorder_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '模板名',
  type VARCHAR(20) NOT NULL COMMENT '类型: problem/maintenance',
  default_content TEXT NOT NULL COMMENT '默认内容',
  default_level VARCHAR(10) DEFAULT NULL COMMENT '默认等级 (仅 maintenance, 重/中/轻)',
  default_sla_hours INT DEFAULT NULL COMMENT '默认 SLA 小时 (覆盖规则, 可选)',
  category VARCHAR(50) DEFAULT NULL COMMENT '分类 (如水泵/阀门/电气)',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_type (type, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工单模板表';

-- 种子数据
INSERT INTO workorder_templates (name, type, default_content, default_level, default_sla_hours, category, sort_order) VALUES
  -- 问题工单模板
  ('设备漏水',           'problem',    '设备发现漏水, 待维修人员处理',               NULL,    NULL, '水泵', 1),
  ('设备异响',           'problem',    '设备运行出现异响, 需要检查',                NULL,    NULL, '通用', 2),
  ('设备停机',           'problem',    '设备突然停机, 无法正常运行',                NULL,    NULL, '通用', 3),
  ('仪表读数异常',       'problem',    '仪表读数偏离正常范围, 请检查',              NULL,    NULL, '仪表', 4),
  -- 维修工单模板
  ('紧急漏水抢修',       'maintenance', '漏水点紧急封堵 + 排查漏因',                  '重',  4,  '水泵', 1),
  ('阀门更换',           'maintenance', '更换损坏阀门, 含管路排空与试压',            '中', 24,  '阀门', 2),
  ('常规保养',           'maintenance', '设备例行保养: 清洁 / 润滑 / 紧固',          '轻', 72,  '通用', 3),
  ('电气故障维修',       'maintenance', '电气线路/控制柜故障排查与修复',              '重',  4,  '电气', 4),
  ('轴承更换',           'maintenance', '拆装轴承, 含对中调整',                       '中', 24,  '机械', 5)
ON DUPLICATE KEY UPDATE name = VALUES(name), default_content = VALUES(default_content);
