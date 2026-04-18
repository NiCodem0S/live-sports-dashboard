import WebSocket, { WebSocketServer } from 'ws'
import { validateWSMessage } from '../validation/websocket.js'
import { WebSocketRateLimiter } from './rateLimiter.js'

const matchSubscribers = new Map();

function subscribe(matchId, socket) {
	if (!matchSubscribers.has(matchId)) {
		matchSubscribers.set(matchId, new Set());
	}
	matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
	if (matchSubscribers.has(matchId)) {
		matchSubscribers.get(matchId).delete(socket);
		if (matchSubscribers.get(matchId).size === 0) {
			matchSubscribers.delete(matchId);
		}
	}
}

function cleanupSubscriptions(socket){
	for(const matchId of socket.subscribtions){
		unsubscribe(matchId, socket);
	}
}

function broadcastToMatch(matchId, payload) {
	const subscribers = matchSubscribers.get(matchId);
	if(!subscribers || subscribers.size == 0) return;

	const message = JSON.stringify(payload);

	for(const client of subscribers)
	{
		if(client.readyState == WebSocket.OPEN)
		{
			client.send(message);
		}
	}
}

function handleMessage(socket, data) {
	let message;

	try{
		message = JSON.parse(data.toString());
	}catch{
		sendJson(socket, {
			type: 'error',
			data: { message: 'Invalid JSON' },
		})
		return;
	}

	if(message?.type == "subscribe" && Number.isInteger(message.matchId)){
		subscribe(message.matchId, socket);
		socket.subscribtions.add(message.matchId);
		sendJson(socket, {
			type: 'subscribed',
			data: { matchId: message.matchId },
		})
	}

	if(message?.type == "unsubscribe" && Number.isInteger(message.matchId)){
		unsubscribe(message.matchId, socket);
		socket.subscribtions.delete(message.matchId);
		sendJson(socket, {
			type: 'unsubscribed',
			data: { matchId: message.matchId },
		})
	}
}

function sendJson(socket, payload) {
	if (socket.readyState != WebSocket.OPEN) return

	socket.send(JSON.stringify(payload))
}

function broadcastToAll(wss, payload) {
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
	// No longer need clientIdCounter since we use stable remoteAddress

	wss.on('connection', socket => {
		// Use stable client identity based on remote address
		const clientKey = socket.remoteAddress || 'unknown'

		socket.isAlive = true
		socket.on('pong', () => {
			socket.isAlive = true
		})

		socket.subscribtions = new Set();

		sendJson(socket, { type: 'welcome' })

		socket.on('message', data => {
			if (rateLimiter.isRateLimited(clientKey)) {
				sendJson(socket, {
					type: 'error',
					data: {
						message: 'Rate limited. Max 60 messages per 60 seconds.',
						remaining: rateLimiter.getRemaining(clientKey),
					},
				})
				return
			}
			const validation = validateWSMessage(data)
			if (!validation.success) {
				sendJson(socket, {
					type: 'error',
					data: { message: 'Invalid message' },
				})
				return
			}
			handleMessage(socket, data)
		})

		socket.on('error', () => {
			console.log(`Client ${clientKey} connection error`)
			socket.terminate();
		})

		socket.on('close', () => {
			rateLimiter.removeClient(clientKey)
			cleanupSubscriptions(socket);
			console.log(`Client ${clientKey} disconnected`)
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
		broadcastToAll(wss, { type: 'match_created', data: match })
	}

	function broadcastCommentary(matchId, comment){
		broadcastToMatch(matchId, { type: 'commentary', data: comment })
	}

	return { broadcastMatchCreated, broadcastCommentary }
}
