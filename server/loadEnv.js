// 轻量 .env 加载器(零依赖)
// 用法: import { loadEnv } from './loadEnv.js'; loadEnv()
// 规则: 跳过空行 / # 注释 / 已有 process.env 的 key(命令行 > .env)
import fs from 'node:fs'
import path from 'node:path'

export function loadEnv(filename = '.env') {
  const envPath = path.resolve(process.cwd(), filename)
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // 去掉包裹的引号
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    // 命令行注入优先
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}
