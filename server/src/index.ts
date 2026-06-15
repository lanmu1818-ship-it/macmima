import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import credentialRoutes from './routes/credentials'
import syncRoutes from './routes/sync'
import adminRoutes from './routes/admin'
import chatRoutes from './routes/chat'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '127.0.0.1'
const API_RATE_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX || 600)

app.set('trust proxy', 1)

// 安全中间件
app.use(helmet())

// CORS配置
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',')
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
  })
)

// 限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: Number.isFinite(API_RATE_LIMIT_MAX) && API_RATE_LIMIT_MAX > 0 ? API_RATE_LIMIT_MAX : 600,
  message: '请求过于频繁，请稍后再试',
})
app.use('/api/', limiter)

// 认证接口更严格的限流
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: '认证请求过多，请稍后再试',
})

// 解析JSON。聊天图片附件需要更大的请求体，其他接口保持较小上限。
app.use('/api/chat', express.json({ limit: '8mb' }))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 路由
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/credentials', credentialRoutes)
app.use('/api/sync', syncRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/chat', chatRoutes)

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' })
})

// 错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    error: err.message || '服务器内部错误',
  })
})

app.listen(Number(PORT), HOST, () => {
  console.log(`🚀 服务器运行在 ${HOST}:${PORT}`)
  console.log(`环境: ${process.env.NODE_ENV}`)
})

export default app
