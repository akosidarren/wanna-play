OBBY RACE — daa & lalaaa Edition
================================

WHAT'S INCLUDED
- 3D browser-based obstacle race
- Create Room and Join Room using a 5-character room code
- Multiplayer room support (up to 8 players)
- Live player positions
- Jumping, falling, obstacles, checkpoints, and finish screen
- Keyboard controls and mobile touch controls

REQUIREMENTS
- Node.js 18 or newer
- Internet connection (Three.js is loaded from a CDN)

RUN LOCALLY
1. Extract this ZIP.
2. Open the extracted folder in VS Code.
3. Open Terminal > New Terminal.
4. Run: npm install
5. Run: npm start
6. Open http://localhost:3000 in your browser.

PLAY SOLO
- Open the game and click Play Solo. This works without starting the Node.js server.
- Multiplayer room creation and joining require the server steps above.

PLAY WITH FRIENDS ON THE SAME WIFI
- The host runs the server.
- Find the host computer's local IP address (for example 192.168.1.5).
- Friends open http://192.168.1.5:3000 on the same network.
- Host clicks Create Room and shares the room code.
- Friends enter the code using Join Room.

CONTROLS
PC:
- W A S D or Arrow Keys = move
- Space = jump

Mobile:
- Direction pad = move
- JUMP button = jump

DEPLOYMENT NOTES
This project needs a Node.js hosting provider for multiplayer. Netlify by itself
does not run this Socket.IO server as a persistent Node process. Deploy the
server.js project to a Node-capable host (such as Render, Railway, or another
Node.js VPS), then configure the website to connect to that server URL before
public deployment. For a first test, run it locally using the steps above.

CURRENT PROTOTYPE LIMITATIONS
- This is a playable starter prototype, not a finished commercial game.
- Multiplayer movement is synchronized, but authoritative physics and anti-cheat
  validation are not yet implemented.
- Character appearance uses simple block-style 3D parts; custom skins and
  advanced animations can be added in a later version.
- Players joining an existing race start at the beginning.

TROUBLESHOOTING
- If npm is not recognized, install Node.js LTS and restart VS Code.
- If the page says it cannot reach the server, check that "npm start" is running.
- If friends cannot connect, check firewall settings and make sure both devices
  can reach the host server.
