import { spawn } from 'child_process'
import { createServer } from 'http'
import { fileURLToPath } from 'url'
import path from 'path'

const serverPath = '/home/hzh/文档/project/projects/water-plant-login/server/index.js'

const server = spawn('node', [serverPath], { stdio: 'inherit' })

server.on('error', (err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})