import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import path from 'path'
import { addClient, removeClient, sseEmit } from './events.js'
import devicesRouter from './routes/devices.js'
import sparepartsRouter from './routes/spareparts.js'
import workordersRouter from './routes/workorders.js'
import inspectionRouter from './routes/inspection.js'
import usersRouter from './routes/users.js'
import authRouter from './routes/auth.js'
import maintenanceRouter from './routes/maintenance.js'
import handoverRouter from './routes/handover.js'
import shiftTeamsRouter from './routes/shiftTeams.js'
import shiftTeamMembersRouter from './routes/shiftTeamMembers.js'
import uploadRouter from './routes/upload.js'
import adminRouter from './routes/admin.js'
import workorderTemplatesRouter from './routes/workorderTemplates.js'

const app = express()
const PORT = 3000

app.use(cors())
app.use(bodyParser.json())

// 静态服务: 上传的图片/视频(单独目录,便于备份与迁移)
app.use('/uploads', express.static(path.resolve('server/uploads'), {
  maxAge: '7d',
  setHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
}))

// ── SSE 端点 ──
app.get('/api/events', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5175')
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  const clientId = addClient(res)
  console.log(`[SSE] client ${clientId} connected`)
  req.on('close', () => {
    removeClient(clientId)
    console.log(`[SSE] client ${clientId} disconnected`)
  })
})

export { sseEmit }

// 路由
app.use('/api/devices', devicesRouter)
app.use('/api/spareparts', sparepartsRouter)
app.use('/api/workorders', workordersRouter)
app.use('/api/inspection', inspectionRouter)
app.use('/api/users', usersRouter)
app.use('/api/auth', authRouter)
app.use('/api/maintenance', maintenanceRouter)
app.use('/api/handover', handoverRouter)
app.use('/api/shift-teams', shiftTeamsRouter)
app.use('/api/shift-team-members', shiftTeamMembersRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/admin', adminRouter)
app.use('/api/workorder-templates', workorderTemplatesRouter)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`后端服务运行在 http://localhost:${PORT}`)
})