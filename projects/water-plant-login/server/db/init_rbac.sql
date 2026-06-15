-- ====================================================================
-- P0-5 完整 RBAC: 角色 / 权限点 / 角色-权限关联
-- ====================================================================

-- 1. 角色表
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE COMMENT '角色代码 (与 users.role 字符串对应, 兼容旧逻辑)',
  name VARCHAR(50) NOT NULL COMMENT '角色显示名',
  description VARCHAR(200) DEFAULT NULL COMMENT '角色说明',
  is_system TINYINT(1) NOT NULL DEFAULT 0 COMMENT '系统内置角色, 不可删除/改 code',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

-- 2. 权限点表 (菜单/按钮/API)
CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE COMMENT '权限点代码 (e.g. menu:dashboard, btn:wo_create)',
  name VARCHAR(80) NOT NULL COMMENT '权限点显示名',
  module VARCHAR(40) NOT NULL COMMENT '所属模块 (dashboard/inspection/workorder/admin/...)',
  type VARCHAR(20) NOT NULL DEFAULT 'menu' COMMENT '类型: menu/button/api',
  path VARCHAR(200) DEFAULT NULL COMMENT '对应路由或 API 路径 (可选)',
  remark VARCHAR(200) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限点表';

-- 3. 角色-权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL COMMENT '角色ID',
  permission_id INT NOT NULL COMMENT '权限点ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_role_perm (role_id, permission_id),
  KEY idx_role (role_id),
  KEY idx_perm (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色-权限关联表';

-- ====================================================================
-- 种子数据: 4 个内置角色 (code 与现有 users.role 字符串一致, 兼容)
-- ====================================================================
INSERT INTO roles (code, name, description, is_system, enabled, sort_order) VALUES
  ('系统管理人', '系统管理人', '最高权限, 可管理用户/角色/业务配置', 1, 1, 1),
  ('带班',     '带班',     '值班长, 可审核/派发工单, 可见全部班组事务', 1, 1, 2),
  ('值班岗位', '值班岗位', '一线值班员, 处理巡检/问题工单/交接班',     1, 1, 3),
  ('维修组',   '维修组',   '维修人员, 处理维修工单与保养',              1, 1, 4)
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

-- ====================================================================
-- 种子数据: 权限点
-- 模块划分: dashboard / inspection / workorder / maintenance / spareparts / device / handover / admin
-- ====================================================================
INSERT INTO permissions (code, name, module, type, path) VALUES
  -- 顶层菜单 (进入各主页面)
  ('menu:dashboard',   '主面板',         'dashboard',   'menu', '/dashboard'),
  ('menu:handover',    '班组交接',       'handover',    'menu', '/handover'),
  ('menu:inspection',  '巡检管理',       'inspection',  'menu', '/inspection'),
  ('menu:workorder',   '工单管理',       'workorder',   'menu', '/workorder'),
  ('menu:maintenance', '保养计划',       'maintenance', 'menu', '/maintenance'),
  ('menu:device',      '设备管理',       'device',      'menu', '/device'),
  ('menu:spareparts',  '备品备件',       'spareparts',  'menu', '/spareparts'),
  ('menu:admin',       '系统管理',       'admin',       'menu', '/admin'),

  -- 班组交接按钮
  ('btn:handover_submit', '提交交接',   'handover',    'button', NULL),

  -- 工单按钮 (按角色区分, 与 WorkOrderView 现有判断对齐)
  ('btn:wo_create_problem',    '新建问题工单',  'workorder', 'button', NULL),
  ('btn:wo_create_maintenance','新建维修工单',  'workorder', 'button', NULL),
  ('btn:wo_review',            '审核工单',      'workorder', 'button', NULL),
  ('btn:wo_complete',          '完成工单',      'workorder', 'button', NULL),
  ('btn:wo_close_problem',     '问题工单闭环',  'workorder', 'button', NULL),
  ('btn:wo_delete_problem',    '删除问题工单',  'workorder', 'button', NULL),
  ('btn:wo_delete_maintenance','删除维修工单',  'workorder', 'button', NULL),
  ('btn:wo_edit',              '编辑工单',      'workorder', 'button', NULL),

  -- 巡检按钮
  ('btn:inspection_create', '创建巡检任务', 'inspection', 'button', NULL),

  -- 设备按钮
  ('btn:device_edit',    '编辑设备',     'device', 'button', NULL),
  ('btn:device_delete',  '删除设备',     'device', 'button', NULL),

  -- 系统管理子菜单
  ('menu:admin_positions', '岗位字典', 'admin', 'menu', '/admin/positions'),
  ('menu:admin_shifts',    '班次时间', 'admin', 'menu', '/admin/shifts'),
  ('menu:admin_teams',     '班组配置', 'admin', 'menu', '/admin/teams'),
  ('menu:admin_users',     '用户管理', 'admin', 'menu', '/admin/users'),
  ('menu:admin_roles',     '角色权限', 'admin', 'menu', '/admin/roles'),

  -- 系统管理按钮
  ('btn:role_create', '新建角色',   'admin', 'button', NULL),
  ('btn:role_edit',   '编辑角色',   'admin', 'button', NULL),
  ('btn:role_delete', '删除角色',   'admin', 'button', NULL),
  ('btn:user_create', '新建用户',   'admin', 'button', NULL),
  ('btn:user_edit',   '编辑用户',   'admin', 'button', NULL),
  ('btn:user_delete', '删除用户',   'admin', 'button', NULL),
  ('btn:user_reset',  '重置密码',   'admin', 'button', NULL)
ON DUPLICATE KEY UPDATE name = VALUES(name), module = VALUES(module), type = VALUES(type), path = VALUES(path);

-- ====================================================================
-- 角色-权限默认分配 (按现有硬编码 role === 'X' 逻辑反推)
-- ====================================================================
-- 系统管理人: 全部权限
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = '系统管理人';

-- 带班: 全部菜单 + 工单相关按钮(审核/创建/编辑) + 巡检创建 + 设备编辑 + 系统管理(不含角色权限)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = '带班'
  AND (
    p.type = 'menu'
    OR p.code IN (
      'btn:handover_submit',
      'btn:wo_create_problem', 'btn:wo_create_maintenance', 'btn:wo_review',
      'btn:wo_edit', 'btn:wo_delete_problem', 'btn:wo_delete_maintenance',
      'btn:inspection_create',
      'btn:device_edit', 'btn:device_delete',
      'btn:user_create', 'btn:user_edit', 'btn:user_reset'
    )
  );

-- 值班岗位: 业务菜单 + 创建问题工单 + 巡检 + 设备只读
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = '值班岗位'
  AND (
    p.code IN (
      'menu:dashboard','menu:handover','menu:inspection','menu:workorder',
      'menu:maintenance','menu:device','menu:spareparts',
      'btn:handover_submit',
      'btn:wo_create_problem',
      'btn:inspection_create'
    )
  );

-- 维修组: 工单(维修相关) + 巡检 + 设备 + 主面板 + 备件
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = '维修组'
  AND (
    p.code IN (
      'menu:dashboard','menu:workorder','menu:inspection',
      'menu:maintenance','menu:device','menu:spareparts',
      'btn:wo_create_maintenance','btn:wo_complete','btn:wo_close_problem','btn:wo_edit'
    )
  );

-- ====================================================================
-- 迁移: users 表新增 role_id 字段, 关联到 roles.id (存储过程实现幂等)
-- ====================================================================
DROP PROCEDURE IF EXISTS migrate_users_role_id;
DELIMITER $$
CREATE PROCEDURE migrate_users_role_id()
BEGIN
  DECLARE col_exists INT DEFAULT 0;
  DECLARE idx_exists INT DEFAULT 0;

  -- 检查列是否存在
  SELECT COUNT(*) INTO col_exists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role_id';
  IF col_exists = 0 THEN
    ALTER TABLE users ADD COLUMN role_id INT DEFAULT NULL
      COMMENT '角色ID (关联 roles.id)' AFTER role;
  END IF;

  -- 检查索引是否存在
  SELECT COUNT(*) INTO idx_exists
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_role_id';
  IF idx_exists = 0 THEN
    ALTER TABLE users ADD KEY idx_role_id (role_id);
  END IF;

  -- 回填: 把现有 users.role 字符串映射到 roles.id
  UPDATE users u
  JOIN roles r ON r.code = u.role
  SET u.role_id = r.id
  WHERE u.role_id IS NULL;

  -- 兜底: 未匹配的 role 字符串, 默认设为 '值班岗位'
  UPDATE users u
  LEFT JOIN roles r ON r.code = u.role
  SET u.role_id = (SELECT id FROM roles WHERE code = '值班岗位' LIMIT 1)
  WHERE u.role_id IS NULL;
END$$
DELIMITER ;

CALL migrate_users_role_id();
DROP PROCEDURE migrate_users_role_id;
