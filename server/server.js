const { app, BrowserWindow, ipcMain, desktopCapturer } = require("electron");
const path = require("path");
const WebSocket = require("ws");
const https = require("https");

let mainWindow;
let ws = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 680,
    minWidth: 420,
    minHeight: 580,
    frame: false,
    transparent: false,
    backgroundColor: "#0a0a0f",
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, "assets", "icon.png"),
    resizable: true,
  });

  mainWindow.loadFile("index.html");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (ws) ws.close();
  app.quit();
});

// ─── Window controls ─────────────────────────────────────────────────────────
ipcMain.on("window-minimize", () => mainWindow.minimize());
ipcMain.on("window-close", () => mainWindow.close());

// ─── Wake up Render before connecting ────────────────────────────────────────
// Render free tier sleeps after inactivity. We do an HTTP ping first,
// wait for it to respond, then open the WebSocket.
const RENDER_URL = "https://listenroom.onrender.com";
const WS_URL = "wss://listenroom.onrender.com";

function wakeServer() {
  return new Promise((resolve) => {
    mainWindow.webContents.send("ws-message", JSON.stringify({ type: "status", text: "Waking server..." }));
    const req = https.get(RENDER_URL, (res) => {
      res.resume(); // drain
      resolve();
    });
    req.on("error", () => resolve()); // resolve anyway, let WS fail with its own error
    req.setTimeout(40000, () => { req.destroy(); resolve(); });
  });
}

// ─── WebSocket relay via main process ────────────────────────────────────────
ipcMain.handle("ws-connect", async () => {
  if (ws && ws.readyState <= 1) return "already connected";

  // Wake Render first (can take up to 30s on free tier)
  await wakeServer();

  return new Promise((resolve, reject) => {
    ws = new WebSocket(WS_URL);
    ws.binaryType = "arraybuffer";

    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error("Connection timed out. Server may still be waking up — try again in a few seconds."));
    }, 15000);

    ws.onopen = () => {
      clearTimeout(timeout);
      resolve("connected");
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Could not connect to server. Check your internet connection."));
    };

    ws.onclose = () => {
      ws = null;
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send("ws-closed");
    };

    ws.onmessage = (ev) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (ev.data instanceof ArrayBuffer) {
        mainWindow.webContents.send("audio-chunk", ev.data);
      } else {
        mainWindow.webContents.send("ws-message", ev.data);
      }
    };
  });
});

ipcMain.on("ws-send-json", (_, obj) => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
});

ipcMain.on("ws-send-audio", (_, buffer) => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(buffer, { binary: true });
});

ipcMain.on("ws-disconnect", () => {
  if (ws) { ws.close(); ws = null; }
});
