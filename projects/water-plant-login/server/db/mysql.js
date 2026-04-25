import mysql from 'mysql2/promise'

const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'swsc',
  password: 'Swsc123456',
  database: 'water_plant',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

export default pool