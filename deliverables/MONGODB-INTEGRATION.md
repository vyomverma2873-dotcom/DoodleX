# MongoDB Integration - DoodleX

## Summary

Successfully integrated MongoDB for persistent data storage in the DoodleX multiplayer game.

## What Was Added

### 1. Dependencies
- **mongoose** (v8+): MongoDB ODM for Node.js

### 2. Database Models

#### Room Model (`server/models/Room.model.js`)
- Stores complete room state (players, strokes, settings)
- Auto-expires after 24 hours of inactivity
- Indexes on `roomId`, `lastActivity`, and `players.id`

#### GameHistory Model (`server/models/GameHistory.model.js`)
- Records completed games for leaderboards/statistics
- Stores final scores, rankings, and game settings
- Auto-expires after 30 days
- Indexes on `completedAt` and `winner.id`

### 3. Database Connection (`server/db/mongodb.js`)
- Automatic connection on server startup
- Graceful fallback to in-memory storage if MongoDB unavailable
- Connection state tracking and error handling

### 4. Server Integration
- Rooms automatically save to MongoDB on:
  - Creation
  - Player join/leave
  - Settings update
  - Round end
- Game history saved when game completes
- Rooms deleted from MongoDB when empty

## Environment Configuration

Added to `.env`:
```env
MONGODB_URI=mongodb+srv://DoodleX:DoodleX%402873@cluster0.cywwieh.mongodb.net/?appName=Cluster0
```

## Features

✅ **Persistent Rooms**: Survive server restarts (24h expiry)  
✅ **Game History**: Track completed games for stats/leaderboards  
✅ **Graceful Fallback**: Works without MongoDB (in-memory mode)  
✅ **Automatic Cleanup**: Old rooms/games auto-delete  
✅ **Indexed Queries**: Optimized for performance  

## How It Works

### Without MongoDB
- Server uses in-memory Maps (original behavior)
- All data lost on restart
- Logs: `⚠️  Using in-memory storage`

### With MongoDB
- Rooms persist across restarts
- Game history tracked
- Logs: `✅ MongoDB connected successfully`

## Testing

Server starts successfully with MongoDB connection:
```bash
cd server && npm run dev
```

Output:
```
🎨 DoodleX server running on port 3001
🔗 Health check: http://localhost:3001/health
📊 Allowed origins: ...
💾 MongoDB: Connected
```

## Future Enhancements

Potential additions:
1. Player accounts/authentication
2. Global leaderboards endpoint
3. Match history API
4. Room recovery after server restart
5. Statistics dashboard

## Database Schema

### Rooms Collection
```javascript
{
  roomId: "ABC12",
  hostId: "player-123",
  players: [{ id, name, score, ... }],
  stage: "drawing",
  currentWord: "elephant",
  strokes: [...],
  settings: { timeLimit: 80, ... },
  lastActivity: ISODate("2025-12-13...")
}
```

### GameHistories Collection
```javascript
{
  roomId: "ABC12",
  players: [{ id, name, finalScore, rank }],
  winner: { id, name, score },
  duration: 180,
  completedAt: ISODate("2025-12-13...")
}
```
