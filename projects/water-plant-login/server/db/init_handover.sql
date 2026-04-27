-- 班组交接记录表
CREATE TABLE IF NOT EXISTS handover_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  handing_over_user VARCHAR(100) NOT NULL COMMENT '交班人姓名',
  handing_over_role VARCHAR(50) NOT NULL COMMENT '交班人角色',
  taking_over_user VARCHAR(100) DEFAULT NULL COMMENT '接班人姓名',
  taking_over_role VARCHAR(50) DEFAULT NULL COMMENT '接班人角色',
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

-- 班组班次表
CREATE TABLE IF NOT EXISTS handover_shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role VARCHAR(50) NOT NULL COMMENT '角色',
  user_id VARCHAR(100) NOT NULL COMMENT '当前值班人',
  user_name VARCHAR(100) NOT NULL COMMENT '值班人姓名',
  shift_type VARCHAR(20) NOT NULL COMMENT '班次类型：日班/夜班/早班',
  team VARCHAR(10) NOT NULL COMMENT '班组：A班/B班/C班/D班',
  shift_start DATETIME NOT NULL COMMENT '上班时间',
  shift_end DATETIME DEFAULT NULL COMMENT '下班时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='班组班次记录';
