import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads')
const IMG_DIR = path.join(UPLOAD_ROOT, 'images')
const VID_DIR = path.join(UPLOAD_ROOT, 'videos')

// 启动时确保目录存在
;[UPLOAD_ROOT, IMG_DIR, VID_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
})

const router = express.Router()

// 文件类型白名单
const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'])
const VID_EXTS = new Set(['.mp4', '.mov', '.webm', '.avi', '.mkv'])

// 限制
const LIMITS = { fileSize: 50 * 1024 * 1024 } // 50MB 总上限/请求

// 文件名: yyyyMMdd-HHmmss-XXXXXX.ext
function genFilename(ext) {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  const rand = Math.random().toString(36).slice(2, 8)
  return `${ts}-${rand}${ext.toLowerCase()}`
}

// 分类存储: 根据 mime/扩展名决定子目录
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase()
    const isImage = file.mimetype.startsWith('image/') || IMG_EXTS.has(ext)
    const isVideo = file.mimetype.startsWith('video/') || VID_EXTS.has(ext)
    if (isVideo && !isImage) return cb(null, VID_DIR)
    // 默认当图片
    return cb(null, IMG_DIR)
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '') || '.bin'
    cb(null, genFilename(ext))
  }
})

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase()
  const ok =
    file.mimetype.startsWith('image/') || IMG_EXTS.has(ext) ||
    file.mimetype.startsWith('video/') || VID_EXTS.has(ext)
  if (!ok) return cb(new Error(`不支持的文件类型: ${file.mimetype || ext}`))
  cb(null, true)
}

const upload = multer({ storage, fileFilter, limits: LIMITS })

// 通用上传: 字段名 files(可多个)
router.post('/', (req, res) => {
  upload.array('files', 12)(req, res, err => {
    if (err) return res.status(400).json({ error: err.message })
    const files = req.files || []
    const urls = files.map(f => {
      // 转换为 /uploads/images 或 /uploads/videos 相对路径
      const rel = path.relative(UPLOAD_ROOT, f.path).split(path.sep).join('/')
      return `/uploads/${rel}`
    })
    res.json({ urls, count: urls.length })
  })
})

export default router
