import express from 'express'
import http from 'http'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { matchRouter } from './routes/matches.js'
import { attachWebSocketServer } from './ws/server.js'

const PORT = Number(process.env.PORT || 8000)
const HOST = process.env.HOST || '0.0.0.0'

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // limit each IP to 100 requests per windowMs
	message: { error: 'Too many requests, please try again later.' },
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})
//Expandable to some more complicated logic like 5 tries and 2 minutes break then on another 3 failures it jumps to 5 then 15 then 30 then 1h etc and resets every day or sth
const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 6,
	message: `Too many login attempts, please try again later`,
	standardHeaders: true,
	legacyHeaders: false,
})

/* for future login endpoint
app.post('/auth/login', authLimiter, (req, res) => {
  // ... login logic
})
*/

const app = express()
const server = http.createServer(app)

app.use(express.json())
app.use(limiter)
app.use(helmet())

app.get('/', (req, res) => {
	res.json({ message: 'Live Sports Dashboard server is running.' })
})
app.use('/matches', matchRouter)

const { broadcastMatchCreated } = attachWebSocketServer(server)
app.locals.broadcastMatchCreated = broadcastMatchCreated

server.listen(PORT, HOST, () => {
	const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`
	console.log(`Server started on ${baseUrl}`)
	console.log(`WebSocket server available on ${baseUrl.replace(/^http/, 'ws')}/ws`)
})
