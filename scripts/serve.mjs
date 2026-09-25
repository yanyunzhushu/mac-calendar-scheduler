#!/usr/bin/env node
/**
 * 轻量级静态文件服务器
 * 提供 Next.js static export (`out/`) 的静态资源。
 *
 * - 端口空闲 → 直接启动（毫秒级就绪）
 * - 端口被健康服务器占用 → 退出不做任何事
 * - 端口被僵尸进程占用 → 杀掉重启
 * - out/ 不存在 → 自动构建
 * - 服务器就绪后自动打开浏览器
 */
import http from 'http'
import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const ROOT = path.join(PROJECT_ROOT, 'out')
const BACKUP_DIR = path.join(PROJECT_ROOT, 'backups')
const MAX_BACKUP_BYTES = 10 * 1024 * 1024
const PORT = parseInt(process.env.PORT || '3000', 10)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
}

function serveFile(res, filePath) {
  try {
    const data = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    res.end(data)
    return true
  } catch {
    return false
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

/** 备份只接受来自当前本地页面的请求，其他网站不能借浏览器写入本机。 */
function isLocalBackupRequest(req) {
  const host = req.headers.host
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
    && [`localhost:${PORT}`, `127.0.0.1:${PORT}`, `[::1]:${PORT}`].includes(host)
    && req.headers.origin === `http://${host}`
}

async function saveBackup(req, res) {
  if (!isLocalBackupRequest(req)) {
    sendJson(res, 403, { error: '仅允许从本地日程页面保存备份。' })
    return
  }
  const kind = req.headers['x-calendar-backup']
  if (!['manual', 'before-restore'].includes(kind) || req.headers['content-type']?.split(';')[0] !== 'application/json') {
    sendJson(res, 415, { error: '备份请求格式无效。' })
    return
  }
  if (Number(req.headers['content-length']) > MAX_BACKUP_BYTES) {
    sendJson(res, 413, { error: '备份超过 10 MB，未保存。' })
    return
  }

  try {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > MAX_BACKUP_BYTES) {
        sendJson(res, 413, { error: '备份超过 10 MB，未保存。' })
        return
      }
      chunks.push(chunk)
    }
    const content = Buffer.concat(chunks).toString('utf8')
    let backup
    try {
      backup = JSON.parse(content)
    } catch {
      sendJson(res, 400, { error: '备份不是有效的 JSON。' })
      return
    }
    if (backup?.version !== 1 || !Array.isArray(backup.state?.tasks) || !Array.isArray(backup.state?.holidays)) {
      sendJson(res, 400, { error: '备份内容无效。' })
      return
    }

    await fs.promises.mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 })
    const prefix = kind === 'manual' ? '日程安排备份' : '恢复前备份'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${prefix}-${timestamp}-${randomBytes(4).toString('hex')}.json`
    await fs.promises.writeFile(path.join(BACKUP_DIR, fileName), content, { flag: 'wx', mode: 0o600 })
    sendJson(res, 201, { saved: true, fileName })
  } catch (error) {
    console.error('保存本地备份失败:', error)
    sendJson(res, 500, { error: '无法写入项目备份目录。' })
  }
}

function handle(req, res) {
  let url = req.url.split('?')[0]

  if (url === '/__local/backup/status' && req.method === 'GET') {
    sendJson(res, 200, { service: 'calendar-local-backup' })
    return
  }
  if (url === '/__local/backup') {
    if (req.method === 'POST') void saveBackup(req, res)
    else sendJson(res, 405, { error: '仅支持 POST。' })
    return
  }

  let filePath = path.join(ROOT, url === '/' ? 'index.html' : url)
  if (serveFile(res, filePath)) return

  if (!url.endsWith('/') && url !== '/') {
    filePath = path.join(ROOT, url, 'index.html')
    if (serveFile(res, filePath)) return
  }

  if (serveFile(res, path.join(ROOT, 'index.html'))) return

  res.writeHead(404)
  res.end('Not Found')
}

// ---------- 确保构建产物存在 ----------

if (!fs.existsSync(ROOT)) {
  console.log('构建静态文件…')
  execSync('npx next build', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' })
  console.log('构建完成。')
}

// ---------- 端口检测 ----------

/** 尝试监听端口，成功返回 true（端口空闲），失败返回 false（被占用） */
function tryListen(port) {
  return new Promise((resolve) => {
    const srv = http.createServer()
    srv.once('error', (err) => {
      resolve(err.code !== 'EADDRINUSE') // 非"地址已用"错误也视为可用（继续尝试）
    })
    srv.listen(port, () => {
      srv.close()
      resolve(true) // 端口空闲
    })
  })
}

/** 检查端口上的 HTTP 服务是否正常响应 */
async function isHealthy() {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 500)
    const res = await fetch(`http://localhost:${PORT}/__local/backup/status`, { signal: controller.signal })
    clearTimeout(timer)
    return res.ok && (await res.json()).service === 'calendar-local-backup'
  } catch {
    return false
  }
}

// ---------- 跨平台工具 ----------

function isWindows() {
  return process.platform === 'win32'
}

function openBrowser(url) {
  if (process.env.CI || process.env.OPEN_BROWSER === 'false') return
  try {
    const cmd = isWindows() ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`
    execSync(cmd, { stdio: 'ignore' })
  } catch {
    /* 忽略（无对应命令时静默） */
  }
}

function killPort(port) {
  try {
    if (isWindows()) {
      // Windows: netstat 查 PID → taskkill
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' })
      const pid = out.split('\n')
        .map((line) => line.trim().split(/\s+/))
        .find((parts) => parts[0] === 'TCP' && parts[1]?.endsWith(`:${port}`) && parts[3] === 'LISTENING')?.[4]
      if (pid && pid !== '0') execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
    } else {
      execSync(`lsof -tiTCP:${port} -sTCP:LISTEN | xargs kill -9 2>/dev/null`, { stdio: 'ignore' })
    }
  } catch {
    /* 忽略 */
  }
}

// ---------- 启动 ----------

async function start() {
  const free = await tryListen(PORT)

  if (free) {
    // 端口空闲 → 直接启动（最快路径，无任何额外延迟）
    const server = http.createServer(handle)
    server.listen(PORT, () => {
      console.log(`Server ready on http://localhost:${PORT}`)
      openBrowser(`http://localhost:${PORT}/`)
    })
    return
  }

  // 端口被占用：检查是否健康服务器
  if (await isHealthy()) {
    console.log(`Server ready on http://localhost:${PORT}`)
    openBrowser(`http://localhost:${PORT}/`)
    process.exit(0)
  }

  // 僵尸进程 → 杀掉重启
  console.log(`端口 ${PORT} 被僵尸进程占用，正在释放…`)
  killPort(PORT)
  // 等待端口释放
  for (let i = 0; i < 10; i++) {
    if (await tryListen(PORT)) break
    await new Promise((r) => setTimeout(r, 200))
  }

  const server = http.createServer(handle)
  server.listen(PORT, () => {
    console.log(`Server ready on http://localhost:${PORT}`)
    openBrowser(`http://localhost:${PORT}/`)
  })
}

start()
