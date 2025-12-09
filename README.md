# Mehfil - Draw, Guess, Enjoy! 🎨

A Skribbl.io-style realtime multiplayer Draw & Guess game that runs on:
- **Web** (desktop & mobile browsers)
- **Android** (standalone APK)
- **iOS** (via Expo Go or TestFlight)

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### 1. Start the Server

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

Server runs at `http://localhost:3001`

### 2. Start the Web Client

```bash
cd client-web
npm install
npm run dev
```

Web app runs at `http://localhost:5173`

### 3. Start the Mobile Client (Optional)

```bash
cd client-mobile
npm install
npx expo start
```

Scan QR code with Expo Go app on your phone.

---

## Project Structure

```
Mehfil/
├── server/                 # Node.js + Socket.IO server
│   ├── server.js          # Main server file
│   ├── game/              # Game logic
│   │   ├── Room.js        # Room management
│   │   └── WordBank.js    # Word lists
│   └── utils/             # Utilities
│       └── profanityFilter.js
│
├── client-web/            # React (Vite) web client
│   ├── src/
│   │   ├── App.jsx        # Main app component
│   │   └── index.css      # Styles
│   └── public/
│
├── client-mobile/         # React Native (Expo) mobile client
│   ├── App.js             # Main app
│   ├── app.json           # Expo config
│   └── assets/            # Icons and splash
│
├── shared/                # Shared constants
│   └── constants.js
│
└── deliverables/          # Build instructions
    ├── iOS-DEPLOYMENT-OPTIONS.txt
    ├── ANDROID-BUILD-INSTRUCTIONS.txt
    └── WEB-DEPLOYMENT-INSTRUCTIONS.txt
```

---

## Features

### Core Gameplay
- Create/join rooms with human-friendly codes
- Real-time drawing with smooth strokes
- Guess the word via chat
- Point scoring system
- Round-based gameplay

### Drawing Tools
- 7 color palette
- Adjustable brush size
- Eraser
- Clear canvas

### Multiplayer
- Up to 10 players per room
- Host controls
- Real-time stroke broadcasting
- Canvas rehydration for late joiners

---

## Testing Locally with ngrok

To test with multiple devices:

```bash
# Install ngrok
npm install -g ngrok

# Start server
cd server && npm run dev

# In another terminal, expose server
ngrok http 3001
```

Use the ngrok URL in your clients.

---

## Environment Variables

### Server (.env)
```
PORT=3001
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173,http://localhost:19006
ADMIN_KEY=your-secret-key
```

### Web Client (.env)
```
VITE_SERVER_URL=http://localhost:3001
```

---

## Deployment

See the `deliverables/` folder for detailed instructions:

- **Web**: `WEB-DEPLOYMENT-INSTRUCTIONS.txt`
- **Android**: `ANDROID-BUILD-INSTRUCTIONS.txt`  
- **iOS**: `iOS-DEPLOYMENT-OPTIONS.txt`

### Quick Deploy Commands

```bash
# Deploy server to Railway
cd server
railway up

# Deploy web to Vercel
cd client-web
vercel

# Build Android APK
cd client-mobile
eas build --platform android --profile preview
```

---

## iOS Distribution Options

| Option | Cost | Setup Difficulty |
|--------|------|------------------|
| Expo Go | FREE | Easy |
| TestFlight | $99/year | Medium |
| Ad-Hoc | $99/year | Hard |

**Recommended**: Use Expo Go for free distribution.

---

## Socket API Reference

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `createRoom` | `{name}` | Create new room |
| `joinRoom` | `{roomId, name}` | Join existing room |
| `startRound` | `{roomId, difficulty?}` | Host starts game |
| `stroke` | `{roomId, stroke}` | Send drawing stroke |
| `clearCanvas` | `{roomId}` | Clear the canvas |
| `guess` | `{roomId, text}` | Submit a guess |
| `leaveRoom` | `{roomId}` | Leave the room |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `roomUpdate` | `{roomId, players, stage}` | Room state changed |
| `roundStarted` | `{drawerId, timeLimit, word?}` | New round began |
| `stroke` | `{stroke}` | Stroke from drawer |
| `clearCanvas` | `{}` | Canvas cleared |
| `correctGuess` | `{playerId, name, points}` | Someone guessed correctly |
| `gameOver` | `{finalScores}` | Game ended |

---

## Stroke Data Format

```javascript
{
  id: "player123-1699876543210",
  color: "#FF7043",
  width: 5,
  points: [[0.5, 0.3], [0.52, 0.32], ...], // Normalized 0-1
  ts: 1699876543210
}
```

---

## Tech Stack

- **Server**: Node.js, Express, Socket.IO
- **Web**: React, Vite, HTML5 Canvas
- **Mobile**: React Native, Expo, react-native-svg
- **Realtime**: Socket.IO WebSockets

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## License

MIT License - feel free to use for personal or commercial projects.

---

## Credits

**Mehfil** - Made with ❤️ for drawing and guessing fun!

*Tagline: Draw, Guess, Enjoy!*
