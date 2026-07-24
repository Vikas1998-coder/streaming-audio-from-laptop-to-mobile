# AGENTS.md

## Architecture

This is a static frontend + Netlify Functions app — no SPA framework or bundler.

- `public/` — static pages served as-is by Netlify.
  - `index.html` — landing page linking to Broadcast / Listen.
  - `broadcast.html` + `broadcast.js` — laptop sender. Captures audio via
    `getUserMedia` (mic) or `getDisplayMedia` (tab/system audio), creates an
    `RTCPeerConnection`, posts an offer to create a room, then polls for the
    answer and remote ICE candidates.
  - `listen.html` + `listen.js` — phone receiver. Joins a room by code, polls
    for the offer, answers it, and plays the incoming audio track.
  - `style.css` — shared dark theme for all pages.
- `netlify/functions/room-create.mts` — `POST /api/rooms`, creates a room row
  with the broadcaster's offer and returns a short numeric room code.
- `netlify/functions/room.mts` — `GET/POST /api/rooms/:code`, the polling
  signaling endpoint. GET returns the room's current state (offer, answer,
  both sides' ICE candidates). POST accepts either `{ type: "answer", answer }`
  or `{ type: "candidate", role, candidate }`.
- `db/schema.ts` — Drizzle schema for the `rooms` table.
- `db/index.ts` — Drizzle client using the Netlify Database adapter.
- `netlify/database/migrations/` — generated SQL migrations (auto-applied on
  deploy). Regenerate with `npx drizzle-kit generate` after any schema change.

## Why polling instead of WebSockets

Netlify Functions are request/response only — they don't hold long-lived
WebSocket connections. Since only a handful of signaling messages are needed
per session (one offer, one answer, a few ICE candidates), both peers simply
poll the room's state every ~1.5s via `GET /api/rooms/:code` until the WebRTC
handshake completes. Once connected, all audio flows peer-to-peer and no more
polling of the actual media occurs.

## Conventions

- Netlify Functions use the `.mts` (TypeScript, ESM) format with an exported
  `config` object for routing.
- Room codes are 6-digit numeric strings, generated client-request-side in
  `room-create.mts`. Rooms are not currently garbage-collected; this is fine
  for a small-scale/local-use tool but would need a TTL/cleanup job for
  heavier use.
- No authentication — anyone with a room code can join. Codes are short-lived
  in practice (rooms are only useful while the broadcaster's tab stays open).
