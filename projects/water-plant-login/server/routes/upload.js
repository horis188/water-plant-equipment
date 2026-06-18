import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads')
const IMG_DIR = path.join(UPLOAD_ROOT, 'images')
const VID_DIR = path.join(UPLOAD_ROOT, 'videos')
const DOC_DIR = path.join(UPLOAD_ROOT, 'docs')

// 启动时确保目录存在
;[UPLOAD_ROOT, IMG_DIR, VID_DIR, DOC_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
})

const router = express.Router()

// P0-5 安全修复: 所有业务 API 强制登录
router.use(requireAuth)

// 文件类型白名单
const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'])
const VID_EXTS = new Set(['.mp4', '.mov', '.webm', '.avi', '.mkv'])
const DOC_EXTS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.zip', '.rar', '.7z', '.dwg'])

// 限制
const LIMITS = { fileSize: 50 * 1024 * 1024 } // 50MB 总上限/请求

// multer 默认将 multipart filename 按 latin1 传输, 中文名需要转 utf8
function decodeName(name) {
  if (!name) return ''
  return Buffer.from(name, 'latin1').toString('utf8')
}

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
    const origName = decodeName(file.originalname)
    const ext = path.extname(origName).toLowerCase()
    const isImage = file.mimetype.startsWith('image/') || IMG_EXTS.has(ext)
    const isVideo = file.mimetype.startsWith('video/') || VID_EXTS.has(ext)
    const isDoc = !isImage && !isVideo && (file.mimetype === 'application/pdf' || file.mimetype.includes('msword') || file.mimetype.includes('officedocument') || file.mimetype === 'text/plain' || file.mimetype === 'text/csv' || file.mimetype === 'application/zip' || DOC_EXTS.has(ext))
    if (isVideo) return cb(null, VID_DIR)
    if (isDoc) return cb(null, DOC_DIR)
    // 默认当图片
    return cb(null, IMG_DIR)
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '') || '.bin'
    cb(null, genFilename(ext))
  }
})

function fileFilter(req, file, cb) {
  const origName = decodeName(file.originalname)
  const ext = path.extname(origName).toLowerCase()
  const ok =
    file.mimetype.startsWith('image/') || IMG_EXTS.has(ext) ||
    file.mimetype.startsWith('video/') || VID_EXTS.has(ext) ||
    file.mimetype === 'application/pdf' ||
    file.mimetype.includes('msword') ||
    file.mimetype.includes('officedocument') ||
    file.mimetype === 'text/plain' ||
    file.mimetype === 'text/csv' ||
    file.mimetype === 'application/zip' ||
    DOC_EXTS.has(ext)
  if (!ok) return cb(new Error(`不支持的文件类型: ${file.mimetype || ext}`))
  cb(null, true)
}

const upload = multer({ storage, fileFilter, limits: LIMITS })

// 通用上传: 字段名 files(可多个)
router.post('/', (req, res) => {
  upload.array('files', 12)(req, res, err => {
    if (err) return res.status(400).json({ error: err.message })
    const files = req.files || []
    const items = files.map(f => {
      const rel = path.relative(UPLOAD_ROOT, f.path).split(path.sep).join('/')
      return {
        url: `/uploads/${rel}`,
        name: decodeName(f.originalname),
        size: f.size
      }
    })
    res.json({ items, urls: items.map(i => i.url), count: items.length })
  })
})

export default router
