// ====================================================================
// MySQL JSON 列辅助工具
// ====================================================================
// mysql2 默认把 JSON 列当字符串返回. 前端拿到字符串后, v-for 会按字符
// 迭代渲染 (例如 46 字符 → "+42" 被误读为 42 张图), 必须统一在 GET
// 路由里 parse 成数组/对象再返回.
//
// 兼容场景: 有些表用 TEXT 存文件路径 (单路径或逗号分隔多路径),
// JSON.parse 会失败. 这种情况下回退为单元素数组.
//
// 用法:
//   import { parseJsonFields } from '../db/jsonFields.js'
//   const [rows] = await pool.query(...)
//   for (const r of rows) parseJsonFields(r, ['images', 'videos'])
// ====================================================================

// 判断是否像文件路径 (例如 /uploads/images/xxx.jpg)
function looksLikePath(s) {
  return typeof s === 'string' && s.startsWith('/') && /\.[a-zA-Z0-9]{2,5}$/.test(s)
}

// 判断是否像逗号分隔的多路径
function looksLikeCommaList(s) {
  return typeof s === 'string' && s.includes(',') && s.split(',').every(p => p.trim().startsWith('/'))
}

/**
 * 把行里指定的 JSON 字符串字段安全地解析成对象/数组
 * - null/undefined 字段 → 空数组
 * - JSON 字符串 → JSON.parse 成数组/对象
 * - 单个文件路径 (以 / 开头) → 包成单元素数组
 * - 逗号分隔的多路径 → split 成数组
 * - JSON.parse 失败且不像路径 → 空数组
 * - 已是对象/数组 → 原样保留
 */
export function parseJsonFields(row, fields) {
  if (!row) return row
  for (const f of fields) {
    const v = row[f]
    if (v == null) {
      row[f] = []
      continue
    }
    if (typeof v === 'string') {
      // 先尝试 JSON.parse
      try {
        row[f] = JSON.parse(v)
        continue
      } catch {}
      // JSON.parse 失败, 尝试作为路径字符串
      if (looksLikePath(v)) {
        row[f] = [v]
      } else if (looksLikeCommaList(v)) {
        row[f] = v.split(',').map(s => s.trim()).filter(Boolean)
      } else {
        row[f] = []
      }
    }
  }
  return row
}

/**
 * 批量处理多行
 */
export function parseJsonFieldsInRows(rows, fields) {
  for (const r of rows) parseJsonFields(r, fields)
  return rows
}
