import WebSocket, { WebSocketServer } from 'ws'
import { validateWSMessage } from '../validation/websocket.js'
import { WebSocketRateLimiter } from './rateLimiter.js'

function sendJson(socket, payload) {
	if (socket.readyState != WebSocket.OPEN) return

	socket.send(JSON.stringify(payload))
}

function broadcast(wss, payload) {
	for (const client of wss.clients) {
		if (client.readyState != WebSocket.OPEN) continue
		sendJson(client, payload)
	}
}

export function attachWebSocketServer(server) {
	//receives the HTTP server instance created by Express, we will attach our WebSocket server to it
	const wss = new WebSocketServer({
		server,
		path: '/ws',
		maxPayload: 1024 * 1024, //1MB (maximum size of a singular websocket message) - set a reasonable limit for incoming messages to prevent abuse
	})

	const rateLimiter = new WebSocketRateLimiter(60, 60000)
	// Counter to generate unique client IDs
	let clientIdCounter = 0

	wss.on('connection', socket => {
		// Assign unique ID to this client
		const clientId = ++clientIdCounter
		socket.clientId = clientId

		socket.isAlive = true
		socket.on('pong', () => {
			socket.isAlive = true
		})

		sendJson(socket, { type: 'welcome' })

		socket.on('message', (data) =>  {

			if(rateLimiter.isRateLimited(clientId))
			{
				sendJson(socket, {
					type: 'error',
					data: {
						message: 'Rate limited. Max 60 messages per 60 seconds.',
            			remaining: rateLimiter.getRemaining(clientId)
					}
				})
				return
			}
			const validation = validateWSMessage(data)
			if(!validation.success)
			{
				sendJson(socket, {
					type: 'error',
					data: { message: 'Invalid message' }
				})
				return
			}
			console.log('Valid message received:', validation.data)
		})

		socket.on('error', console.error)

		socket.on('close' , () => {
			    rateLimiter.removeClient(clientId)
    			console.log(`Client ${clientId} disconnected`)
		})
	})

	const interval = setInterval(() => {
		wss.clients.forEach(ws => {
			if (ws.isAlive === false) return ws.terminate()
			ws.isAlive = false
			ws.ping()
		})
	}, 30000)

	wss.on('close', () => clearInterval(interval))

	function broadcastMatchCreated(match) {
		broadcast(wss, { type: 'match_created', data: match })
	}

	return { broadcastMatchCreated }
}
