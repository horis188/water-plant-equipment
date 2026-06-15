-- 设备主表
CREATE TABLE IF NOT EXISTS devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL COMMENT '设备名称',
  type VARCHAR(100) DEFAULT NULL COMMENT '设备类型',
  model VARCHAR(200) DEFAULT NULL COMMENT '型号',
  location VARCHAR(200) DEFAULT NULL COMMENT '安装地点',
  params VARCHAR(500) DEFAULT NULL COMMENT '参数（电压:xxx,电流:xxx,功率:xxx等）',
  status VARCHAR(20) DEFAULT '在用' COMMENT '状态：在用/告警/维修中',
  value DECIMAL(12,2) DEFAULT NULL COMMENT '价值金额',
  vendor VARCHAR(200) DEFAULT NULL COMMENT '厂家',
  remark TEXT COMMENT '备注',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备主表';

-- 设备变动记录表
CREATE TABLE IF NOT EXISTS device_changes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_name VARCHAR(200) NOT NULL COMMENT '设备名称',
  change_type VARCHAR(50) DEFAULT NULL COMMENT '变动类型',
  operator VARCHAR(100) DEFAULT NULL COMMENT '操作人',
  content TEXT COMMENT '变动内容',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备变动记录';

-- 班组岗位人员候选表（一个班组多个岗位人员，供接班时选择）
CREATE TABLE IF NOT EXISTS shift_team_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_name VARCHAR(10) NOT NULL COMMENT '班组：A班/B班/C班/D班',
  member_name VARCHAR(50) NOT NULL COMMENT '岗位人员姓名',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_team_member (team_name, member_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='班组岗位人员候选表';

-- 班组交接记录表
CREATE TABLE IF NOT EXISTS handover_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  handing_over_user VARCHAR(100) NOT NULL COMMENT '交班人姓名',
  handing_over_role VARCHAR(50) NOT NULL COMMENT '交班人角色',
  handing_over_member VARCHAR(50) DEFAULT NULL COMMENT '交班岗位人员',
  taking_over_user VARCHAR(100) DEFAULT NULL COMMENT '接班人姓名',
  taking_over_role VARCHAR(50) DEFAULT NULL COMMENT '接班人角色',
  taking_over_member VARCHAR(50) DEFAULT NULL COMMENT '接班岗位人员（选择的成员）',
  shift_type VARCHAR(20) NOT NULL COMMENT '班次类型：日班/夜班/早班',
  team VARCHAR(10) NOT NULL COMMENT '班组：A班/B班/C班/D班',
  handover_time DATETIME NOT NULL COMMENT '交接时间',
  shift_start DATETIME DEFAULT NULL COMMENT '本班开始时间',
  shift_end DATETIME DEFAULT NULL COMMENT '本班结束时间',
  notes TEXT COMMENT '值班纪事',
  tasks_status VARCHAR(20) DEFAULT 'pending' COMMENT '任务状态：completed/pending',
  workorders_status VARCHAR(20) DEFAULT 'pending' COMMENT '工单状态：completed/pending',
  status VARCHAR(20) DEFAULT 'pending' COMMENT '交接状态：pending等待接班/completed已完成',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_active (handing_over_role, shift_type, team, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='班组交接记录';

-- 值班纪事表
CREATE TABLE IF NOT EXISTS duty_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team VARCHAR(10) NOT NULL COMMENT '班组：A班/B班/C班/D班',
  role VARCHAR(50) NOT NULL COMMENT '角色',
  shift_type VARCHAR(20) NOT NULL COMMENT '班次类型：日班/夜班/早班',
  member_name VARCHAR(50) DEFAULT NULL COMMENT '岗位人员姓名',
  date DATE NOT NULL COMMENT '日期',
  notes TEXT COMMENT '值班纪事内容',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_duty_note (team, role, date, shift_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='值班纪事';

-- 班组班次表
CREATE TABLE IF NOT EXISTS handover_shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role VARCHAR(50) NOT NULL COMMENT '角色',
  user_id VARCHAR(100) NOT NULL COMMENT '当前值班人',
  user_name VARCHAR(100) NOT NULL COMMENT '值班人姓名',
  member_name VARCHAR(50) DEFAULT NULL COMMENT '岗位人员姓名',
  leader_name VARCHAR(50) DEFAULT NULL COMMENT '带班人姓名',
  shift_type VARCHAR(20) NOT NULL COMMENT '班次类型：日班/夜班/早班',
  team VARCHAR(10) NOT NULL COMMENT '班组：A班/B班/C班/D班',
  shift_start DATETIME NOT NULL COMMENT '上班时间',
  shift_end DATETIME DEFAULT NULL COMMENT '下班时间',
  inherited_workorders JSON DEFAULT NULL COMMENT '继承的进行中工单',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='班组班次记录';
