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
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', 'out')
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

function handle(req, res) {
  let url = req.url.split('?')[0]

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
    const res = await fetch(`http://localhost:${PORT}/`, { signal: controller.signal })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

// ---------- 自动打开浏览器 ----------

function openBrowser(url) {
  if (process.env.CI || process.env.OPEN_BROWSER === 'false') return
  try {
    execSync(`open "${url}"`, { stdio: 'ignore' })
  } catch {
    /* 忽略（无 open 命令时静默） */
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
  try {
    execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`)
  } catch {
    /* 忽略 */
  }
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
