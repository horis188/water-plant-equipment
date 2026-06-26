import mysql from 'mysql2/promise'

// 全部从环境变量读取,带默认值以兼容本地直接 `node server/index.js` 启动
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'swsc',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'water_plant',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  // DATETIME/DATE 直接返回字符串 (BJT 字面值), 避免 mysql2 默认时区转换造成 8h 错位
  dateStrings: true,
  timezone: '+08:00'
})

export default pool
