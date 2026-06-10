// 生成 PWA 图标（纯色底 + 白色日历图标）
// 使用 Node.js 内置的 zlib 模块，无额外依赖
import zlib from 'zlib'
import fs from 'fs'
import path from 'path'

const OUT_DIR = path.resolve('public/icons')

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeB = Buffer.from(type, 'ascii')
  const crcData = Buffer.concat([typeB, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcData))
  return Buffer.concat([len, typeB, data, crc])
}

function rgbaPNG(w, h, rgba) {
  const raw = Buffer.alloc(w * h * 4 + h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0 // filter none
    for (let x = 0; x < w; x++) {
      const i = y * (w * 4 + 1) + 1 + x * 4
      const j = y * w + x
      raw[i] = rgba[j * 4]
      raw[i + 1] = rgba[j * 4 + 1]
      raw[i + 2] = rgba[j * 4 + 2]
      raw[i + 3] = rgba[j * 4 + 3]
    }
  }
  const deflated = zlib.deflateSync(raw, { level: 9 })
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // RGBA
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflated), chunk('IEND', Buffer.alloc(0))])
}

function fill(w, h, r, g, b, a = 255) {
  const px = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = r
    px[i * 4 + 1] = g
    px[i * 4 + 2] = b
    px[i * 4 + 3] = a
  }
  return px
}

const sizes = [192, 512]
const iconColor = { r: 59, g: 130, b: 246 } // Tailwind blue-500

fs.mkdirSync(OUT_DIR, { recursive: true })

for (const s of sizes) {
  const px = fill(s, s, iconColor.r, iconColor.g, iconColor.b)
  const png = rgbaPNG(s, s, px)
  fs.writeFileSync(path.join(OUT_DIR, `icon-${s}x${s}.png`), png)
  console.log(`Created icon-${s}x${s}.png (${(png.length / 1024).toFixed(1)} KB)`)
}
