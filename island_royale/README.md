# Island Royale — online browser game prototype

## Deploy on Render
1. Upload this folder to a GitHub repository.
2. In Render, choose **New → Web Service** and connect that repository.
3. Set **Build Command** to `npm install`.
4. Set **Start Command** to `npm start`.
5. Choose a plan and deploy. Render supplies the public HTTPS URL.
6. Open the URL. The game uses secure WebSockets automatically on HTTPS.

## Run locally
Requires Node.js 18+ and an internet connection for the Three.js module.
```bash
npm install
npm start
```
Open http://localhost:3000.

## Controls
- WASD / arrow keys: move
- Mouse: aim / look
- Left click: fire
- B: place a simple floor (not available in Zero Build)

## Included prototype features
- Three.js island scene, third-person camera and movement
- Basic shooting visuals, ammo, health/shield HUD
- Contracting storm
- Simple build placement and Zero Build selection
- WebSocket player presence/position synchronization
- Server-side 20-connection cap

## Important limitations
This is an early prototype, not a finished Fortnite clone. Multiplayer currently synchronizes player positions and names; it does not yet include server-authoritative damage, proper weapon/inventory systems, loot/chests, matchmaking queues, persistent accounts, anti-cheat, or production scaling. Free hosting may sleep when idle.
