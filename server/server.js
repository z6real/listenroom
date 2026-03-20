const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3000;

// Serve static files
const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, "../public", req.url === "/" ? "index.html" : req.url);
  const ext = path.extname(filePath);
  const mimeTypes = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".ico": "image/x-icon",
  };
  const contentType = mimeTypes[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

// rooms: { [code]: { host: ws, guests: Set<ws>, paused: bool, volume: number } }
const rooms = {};

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function broadcast(room, data, exclude = null) {
  const allClients = [room.host, ...room.guests].filter((c) => c && c !== exclude && c.readyState === WebSocket.OPEN);
  for (const client of allClients) client.send(data);
}

function sendJSON(ws, obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

wss.on("connection", (ws) => {
  ws.roomCode = null;
  ws.role = null;

  ws.on("message", (data, isBinary) => {
    // Binary = audio chunk, relay to guests
    if (isBinary) {
      const room = rooms[ws.roomCode];
      if (!room || ws !== room.host) return;
      for (const guest of room.guests) {
        if (guest.readyState === WebSocket.OPEN) guest.send(data, { binary: true });
      }
      return;
    }

    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    switch (msg.type) {
      case "create": {
        let code;
        do { code = generateCode(); } while (rooms[code]);
        rooms[code] = { host: ws, guests: new Set(), paused: false };
        ws.roomCode = code;
        ws.role = "host";
        sendJSON(ws, { type: "created", code });
        console.log(`[+] Room created: ${code}`);
        break;
      }

      case "join": {
        const code = msg.code?.toUpperCase();
        const room = rooms[code];
        if (!room) { sendJSON(ws, { type: "error", message: "Room not found. Check the code and try again." }); return; }
        if (ws === room.host) { sendJSON(ws, { type: "error", message: "You are the host of this room." }); return; }
        room.guests.add(ws);
        ws.roomCode = code;
        ws.role = "guest";
        sendJSON(ws, { type: "joined", code, paused: room.paused });
        sendJSON(room.host, { type: "guest_joined", count: room.guests.size });
        console.log(`[+] Guest joined room: ${code} (${room.guests.size} guests)`);
        break;
      }

      case "pause":
      case "resume": {
        const room = rooms[ws.roomCode];
        if (!room || ws !== room.host) return;
        room.paused = msg.type === "pause";
        for (const guest of room.guests) sendJSON(guest, { type: msg.type, ts: msg.ts });
        console.log(`[~] Room ${ws.roomCode}: ${msg.type}`);
        break;
      }

      case "ping": {
        sendJSON(ws, { type: "pong" });
        break;
      }
    }
  });

  ws.on("close", () => {
    const room = rooms[ws.roomCode];
    if (!room) return;

    if (ws.role === "host") {
      // Notify all guests and destroy room
      for (const guest of room.guests) sendJSON(guest, { type: "host_left" });
      delete rooms[ws.roomCode];
      console.log(`[-] Room closed: ${ws.roomCode}`);
    } else {
      room.guests.delete(ws);
      if (room.host?.readyState === WebSocket.OPEN) sendJSON(room.host, { type: "guest_left", count: room.guests.size });
      console.log(`[-] Guest left room: ${ws.roomCode} (${room.guests.size} remaining)`);
    }
  });
});

server.listen(PORT, () => console.log(`ListenRoom server running on port ${PORT}`));
