import WebSocket, { WebSocketServer } from 'ws'

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

	wss.on('connection', socket => {
		socket.isAlive = true
		socket.on('pong', () => {
			socket.isAlive = true
		})

		sendJson(socket, { type: 'welcome' })

		socket.on('error', console.error)
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
