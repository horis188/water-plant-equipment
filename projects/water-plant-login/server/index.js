import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import devicesRouter from './routes/devices.js'
import sparepartsRouter from './routes/spareparts.js'
import workordersRouter from './routes/workorders.js'
import inspectionRouter from './routes/inspection.js'
import usersRouter from './routes/users.js'

const app = express()
const PORT = 3000

app.use(cors())
app.use(bodyParser.json())

// 路由
app.use('/api/devices', devicesRouter)
app.use('/api/spareparts', sparepartsRouter)
app.use('/api/workorders', workordersRouter)
app.use('/api/inspection', inspectionRouter)
app.use('/api/users', usersRouter)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`后端服务运行在 http://localhost:${PORT}`)
})