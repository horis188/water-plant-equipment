const { spawn } = require('child_process')
const srv = spawn('node', ['/home/hzh/文档/project/projects/water-plant-login/start-server.cjs'], { stdio: 'inherit', detached: true })
srv.on('error', e => { console.error(e); process.exit(1) })