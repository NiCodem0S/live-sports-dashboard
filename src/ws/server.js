import { WebSocket } from 'ws';

function sendJson(socket, payload) {
    if(socket.readyState != WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
    for (const client of wss.clients) {
        if(client.readyState != WebSocket.OPEN) return;
        sendJson(client, payload);
    }
}

export function attachWebSocketServer(server){ //receives the HTTP server instance created by Express, we will attach our WebSocket server to it
    const wss = new WebSocket.Server({ 
        server,
        path: '/ws',
        maxPayload: 1024 * 1024, //1MB (maximum size of a singular websocket message) - set a reasonable limit for incoming messages to prevent abuse
     });

     wss.on('connection', (socket) => {
        sendJson(socket, { type: 'welcome', message: 'Welcome to the Live Sports Dashboard WebSocket server!' });

        socket.on('error', console.error); 
    });

    wss.on('error', console.error);

    function broadcastMatchCreated(match) {
        broadcast(wss, { type: 'match_created', data: match });
    }

    return { broadcastMatchCreated };
}