const WebSocket = require('ws');

// Render ke liye port ki setting (Internet par chalane ke liye zaroori)
const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: port });

let waitingUser = null; 
const users = new Map(); 

console.log(`🚀 CTO's Custom Omegle Server is RUNNING on port ${port}!`);

wss.on('connection', (ws) => {
    const userId = 'peer_' + Math.random().toString(36).substr(2, 9);
    ws.userId = userId;
    users.set(userId, { socket: ws, partner: null });

    console.log(`[+] User Connected: ${userId}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'find_stranger') {
                if (waitingUser && waitingUser !== ws) {
                    const partnerId = waitingUser.userId;
                    users.get(userId).partner = partnerId;
                    users.get(partnerId).partner = userId;

                    ws.send(JSON.stringify({ type: 'matched', role: 'target' }));
                    waitingUser.send(JSON.stringify({ type: 'matched', role: 'initiator' }));

                    console.log(`[🎯] MATCHED: ${userId} <---> ${partnerId}`);
                    waitingUser = null; 
                } else {
                    waitingUser = ws;
                    console.log(`[⏳] Waiting in Queue: ${userId}`);
                }
            }
            else if (['offer', 'answer', 'ice_candidate', 'leave'].includes(data.type)) {
                const partnerId = users.get(userId).partner;
                if (partnerId && users.has(partnerId)) {
                    users.get(partnerId).socket.send(JSON.stringify(data));
                }
            }
        } catch (err) { console.log("Error:", err); }
    });

    ws.on('close', () => {
        console.log(`[-] User Disconnected: ${userId}`);
        if (waitingUser === ws) waitingUser = null;
        const partnerId = users.get(userId).partner;
        if (partnerId && users.has(partnerId)) {
            users.get(partnerId).partner = null; 
            users.get(partnerId).socket.send(JSON.stringify({ type: 'partner_left' }));
        }
        users.delete(userId); 
    });
});
