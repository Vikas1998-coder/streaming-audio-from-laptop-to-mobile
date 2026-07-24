# WiFi Audio Stream

Stream audio from a laptop's browser to an Android phone's browser over a shared
Wi-Fi network — no app install, no cloud audio relay.

## How it works

- The laptop opens **Broadcast**, captures audio (microphone, or a shared browser
  tab/system audio), and gets a 6-digit room code.
- The phone opens **Listen**, enters that code, and connects.
- Audio flows directly between the two devices over **WebRTC**. A tiny Netlify
  Function backed by Netlify Database is only used to exchange the initial
  WebRTC connection details (offer/answer/ICE candidates) — the audio itself
  never touches the server.

## Key technologies

- Plain HTML/CSS/JS on the frontend (no framework needed for two simple pages).
- **WebRTC** (`RTCPeerConnection`) for peer-to-peer audio streaming.
- **Netlify Functions** for signaling endpoints (`/api/rooms`, `/api/rooms/:code`).
- **Netlify Database** (Postgres via Drizzle ORM) to store each room's offer,
  answer, and ICE candidates while the two peers find each other.

## Running locally

```bash
npm install
netlify dev
```

Then, on a laptop connected to your Wi-Fi:
1. Open the dev URL and click **Broadcast**, pick a source, and start.
2. On an Android phone connected to the **same Wi-Fi network**, open the same
   URL (use the laptop's local IP, not `localhost`), click **Listen**, and
   enter the room code shown on the laptop.

Browser tab/system audio capture currently works best in Chrome/Edge.
