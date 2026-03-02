const WebSocket = require('ws');
const PORT = process.env.PORT || 10000;

// Render par WebSocket server start kar rahe hain
const wss = new WebSocket.Server({ port: PORT });

// Ye wo kursi hai jahan pehla user aakar baithega aur dusre ka wait karega
let waitingUser = null; 

// Har user aur uske 'partner' ka record rakhne ke liye
const users = new Map(); 

wss.on('connection', (ws) => {
    // Jaise hi koi connect hoga, usko ek secret ID milegi aur uska partner null hoga
    ws.id = Math.random().toString(36).substring(2, 15);
    users.set(ws, { partner: null });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // 1. PING-PONG (Server ko sone se bachane ke liye)
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
                return;
            }

            // 2. FIND STRANGER (Matchmaking Engine ⚡)
            if (data.type === 'find_stranger') {
                cleanupPartner(ws); 
                
                if (waitingUser && waitingUser !== ws && waitingUser.readyState === WebSocket.OPEN) {
                    const partner = waitingUser;
                    waitingUser = null; // Kursi khali kar do

                    users.get(ws).partner = partner;
                    users.get(partner).partner = ws;

                    ws.send(JSON.stringify({ type: 'matched' }));
                    partner.send(JSON.stringify({ type: 'matched' }));
                    
                    console.log("⚡ Match Successful!");
                } else {
                    waitingUser = ws;
                    console.log("⏳ User waiting for stranger...");
                }
            }

            // 3. MESSAGE RELAY (Post Office System 📨)
            else if (['chat', 'image', 'audio', 'typing', 'intro'].includes(data.type)) {
                const partner = users.get(ws).partner;
                if (partner && partner.readyState === WebSocket.OPEN) {
                    partner.send(message.toString());
                }
            }

            // 4. LEAVE CHAT
            else if (data.type === 'leave') {
                cleanupPartner(ws);
            }

        } catch (err) {
            console.error("❌ Data Parse Error:", err.message);
        }
    });

    ws.on('close', () => {
        cleanupPartner(ws);
        users.delete(ws);
    });
});

function cleanupPartner(ws) {
    if (waitingUser === ws) {
        waitingUser = null;
    }
    
    const partner = users.get(ws)?.partner;
    if (partner) {
        if (partner.readyState === WebSocket.OPEN) {
            partner.send(JSON.stringify({ type: 'partner_left' }));
        }
        if (users.has(partner)) {
            users.get(partner).partner = null;
        }
        users.get(ws).partner = null;
    }
}

console.log(`🚀 Plan A Relay Server is RUNNING on port ${PORT}`);
