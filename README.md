# 🎵 ListenRoom

**Real-time audio sharing — no accounts, no limits, completely free.**

Stream audio from any app on your computer to a friend in real-time. Like a Discord music bot, but you're the DJ — choose any app or your entire system sound.

---

## How It Works

1. **Host** opens the site → clicks "Create a Room" → gets a 6-character code
2. **Host** shares the code with a friend
3. **Guest** enters the code → clicks "Join Room"
4. **Host** clicks "Start Streaming Audio" → browser asks what to share (pick an app, browser tab, or system audio)
5. **Guest** hears the audio in real-time, fully synced
6. Pause/resume is synced instantly

---

## Setup & Deployment (Free, No Credit Card)

### Step 1 — Deploy the Backend on Render

1. Push this whole folder to a **GitHub repository** (public or private)
2. Go to [render.com](https://render.com) → Sign up (free, no credit card)
3. Click **New → Web Service**
4. Connect your GitHub repo
5. Render will auto-detect the settings from `render.yaml`:
   - Build: `npm install`
   - Start: `npm start`
   - Plan: **Free**
6. Click **Deploy**
7. Wait ~2 minutes → you'll get a URL like: `https://listenroom-xxxx.onrender.com`

> ⚠️ **Free Render services sleep after 15 minutes of inactivity.** The first connection after sleep takes ~30 seconds to wake up. That's fine for casual use.

---

### Step 2 — Update the Frontend URL

Open `public/index.html` and find this line near the top of the `<script>`:

```js
const BACKEND = "REPLACE_WITH_YOUR_RENDER_WS_URL";
```

Replace it with your Render URL using `wss://` (not `https://`):

```js
const BACKEND = "wss://listenroom-xxxx.onrender.com";
```

---

### Step 3 — Host the Frontend on GitHub Pages

1. In your GitHub repo → **Settings → Pages**
2. Set source to: **Deploy from a branch** → branch: `main`, folder: `/public`
3. Click Save
4. Your site will be live at: `https://yourusername.github.io/listenroom/`

That's it! Share that link with your friend.

---

## Browser Compatibility

| Browser | Hosting | Joining |
|---------|---------|---------|
| Chrome ✅ | Full support (best) | ✅ |
| Edge ✅ | Full support | ✅ |
| Firefox ⚠️ | Limited audio capture | ✅ |
| Safari ❌ | No audio capture API | ✅ (listen only) |

**Use Chrome or Edge for the best hosting experience.**

---

## Platform Notes

### Windows
- System audio capture works natively in Chrome/Edge
- When the sharing dialog appears, check **"Share system audio"**

### macOS
- macOS does not allow system audio capture by default
- Install **[BlackHole](https://github.com/ExistingUserName/BlackHole)** (free) or **[Loopback](https://rogueamoeba.com/loopback/)** (paid)
- Set your audio output to the virtual device, then share that as a microphone source

### Linux
- Use PulseAudio monitor source or PipeWire loopback
- Set up a virtual sink and share it

---

## Local Development

```bash
npm install
npm start
# Open http://localhost:3000
```

No environment variables needed for local use.

---

## Architecture

```
Host Browser                    Render Server              Guest Browser
──────────────                  ─────────────              ─────────────
getDisplayMedia()          
  → Float32Array audio    →→→   WebSocket relay    →→→    AudioContext
  → pause/resume events   →→→   room management    →→→    BufferSource playback
                                code generation
```

- **No STUN/TURN/WebRTC** — pure WebSocket relay (simpler, works everywhere, no firewall issues)
- **No database** — rooms live in memory, gone when the server restarts
- **No accounts** — just a code
- **Latency**: ~100–400ms depending on server location. Perfect for music, not for video sync.

---

## Limitations

- Free Render instances have ~512MB RAM and shared CPU — fine for a few simultaneous rooms
- Audio quality: 44.1kHz stereo Float32 (CD quality)
- No end-to-end encryption (WebSocket relay)
- No persistent rooms — refresh = new room

---

## License

MIT — do whatever you want.
