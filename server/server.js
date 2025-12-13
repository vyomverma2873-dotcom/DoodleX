require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const { WordBank } = require('./game/WordBank');
const { Room } = require('./game/Room');
const { filterProfanity, sanitizeHtml } = require('./utils/profanityFilter');
const { connectDB, isMongoConnected } = require('./db/mongodb');
const RoomModel = require('./models/Room.model');
const GameHistory = require('./models/GameHistory.model');

const app = express();
const server = http.createServer(app);

const CORS_ORIGINS = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',') 
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:19006', 'http://localhost:8081', 'https://doodlex.vercel.app'];

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(express.json());

// In-memory room storage
const rooms = new Map();
const playerSockets = new Map(); // socketId -> { roomId, playerId }
const disconnectedPlayers = new Map(); // playerId -> { roomId, name, score, disconnectedAt }
const REJOIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes to rejoin

// Rate limiting for guesses
const guessRateLimits = new Map(); // playerId -> { count, resetTime }
const GUESS_LIMIT = 3;
const GUESS_WINDOW_MS = 5000;

// Rate limiting for strokes
const strokeRateLimits = new Map(); // playerId -> { count, resetTime }
const STROKE_LIMIT = 100; // Max strokes per window
const STROKE_WINDOW_MS = 1000; // Per second
const MAX_POINTS_PER_STROKE = 1000; // Max points in a single stroke

// ==================== Helper Functions ====================

// Save room to MongoDB
async function saveRoomToMongo(room) {
  if (!isMongoConnected()) return;
  
  try {
    const roomData = {
      roomId: room.id,
      hostId: room.hostId,
      players: room.players,
      stage: room.stage,
      currentDrawerId: room.currentDrawerId,
      currentWord: room.currentWord,
      currentRound: room.currentRound,
      strokes: room.strokes,
      roundStartTime: room.roundStartTime,
      playersGuessedCorrectly: Array.from(room.playersGuessedCorrectly || []),
      drawerOrder: room.drawerOrder,
      drawerIndex: room.drawerIndex,
      settings: room.settings
    };
    
    await RoomModel.findOneAndUpdate(
      { roomId: room.id },
      roomData,
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('Failed to save room to MongoDB:', err.message);
  }
}

// Delete room from MongoDB
async function deleteRoomFromMongo(roomId) {
  if (!isMongoConnected()) return;
  
  try {
    await RoomModel.deleteOne({ roomId });
  } catch (err) {
    console.error('Failed to delete room from MongoDB:', err.message);
  }
}

// Save game history to MongoDB
async function saveGameHistory(roomId, players, settings, startTime) {
  if (!isMongoConnected()) return;
  
  try {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const duration = Math.floor((Date.now() - startTime) / 1000);
    
    await GameHistory.create({
      roomId,
      players: sortedPlayers.map((p, idx) => ({
        id: p.id,
        name: p.name,
        finalScore: p.score,
        rank: idx + 1
      })),
      totalRounds: settings.totalRounds,
      duration,
      winner: sortedPlayers[0] ? {
        id: sortedPlayers[0].id,
        name: sortedPlayers[0].name,
        score: sortedPlayers[0].score
      } : null,
      settings: {
        timeLimit: settings.timeLimit,
        difficulty: settings.difficulty,
        hintsEnabled: settings.hintsEnabled
      }
    });
  } catch (err) {
    console.error('Failed to save game history:', err.message);
  }
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generatePlayerId() {
  return uuidv4().substring(0, 8);
}

function checkGuessRateLimit(playerId) {
  const now = Date.now();
  let limit = guessRateLimits.get(playerId);
  
  if (!limit || now > limit.resetTime) {
    limit = { count: 0, resetTime: now + GUESS_WINDOW_MS };
    guessRateLimits.set(playerId, limit);
  }
  
  if (limit.count >= GUESS_LIMIT) {
    return false;
  }
  
  limit.count++;
  return true;
}

function checkStrokeRateLimit(playerId) {
  const now = Date.now();
  let limit = strokeRateLimits.get(playerId);
  
  if (!limit || now > limit.resetTime) {
    limit = { count: 0, resetTime: now + STROKE_WINDOW_MS };
    strokeRateLimits.set(playerId, limit);
  }
  
  if (limit.count >= STROKE_LIMIT) {
    return false;
  }
  
  limit.count++;
  return true;
}

function validateStroke(stroke) {
  // Validate stroke structure
  if (!stroke || typeof stroke !== 'object') return false;
  if (!stroke.id || typeof stroke.id !== 'string') return false;
  if (!stroke.color || typeof stroke.color !== 'string') return false;
  if (typeof stroke.width !== 'number' || stroke.width < 1 || stroke.width > 100) return false;
  if (!Array.isArray(stroke.points)) return false;
  if (stroke.points.length === 0 || stroke.points.length > MAX_POINTS_PER_STROKE) return false;
  
  // Validate each point is a valid coordinate pair
  for (const point of stroke.points) {
    if (!Array.isArray(point) || point.length !== 2) return false;
    if (typeof point[0] !== 'number' || typeof point[1] !== 'number') return false;
    if (point[0] < 0 || point[0] > 1 || point[1] < 0 || point[1] > 1) return false;
  }
  
  return true;
}

function broadcastRoomUpdate(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  io.to(roomId).emit('roomUpdate', {
    roomId: room.id,
    players: room.getPublicPlayerList(),
    stage: room.stage,
    hostId: room.hostId,
    settings: room.settings
  });
}

async function cleanupPlayer(socket, isDisconnect = true) {
  const playerData = playerSockets.get(socket.id);
  if (!playerData) return;
  
  const { roomId, playerId, name } = playerData;
  const room = rooms.get(roomId);
  
  if (room) {
    // Get player score before removal for potential rejoin
    const player = room.players.find(p => p.id === playerId);
    const playerScore = player ? player.score : 0;
    
    // Store disconnected player data for potential rejoin (only on disconnect, not leave)
    if (isDisconnect && player) {
      disconnectedPlayers.set(playerId, {
        roomId,
        name,
        score: playerScore,
        disconnectedAt: Date.now(),
        wasHost: room.hostId === playerId,
        wasDrawer: room.currentDrawerId === playerId
      });
      
      // Set timeout to clean up disconnected player data
      setTimeout(() => {
        disconnectedPlayers.delete(playerId);
      }, REJOIN_TIMEOUT_MS);
    }
    
    const removalResult = room.removePlayer(playerId);
    socket.leave(roomId);
    
    if (room.players.length === 0) {
      // Clean up room timer if exists
      if (room.roundTimer) {
        clearTimeout(room.roundTimer);
      }
      
      // Delete from MongoDB
      await deleteRoomFromMongo(roomId);
      
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (empty)`);
    } else {
      // Notify remaining players
      io.to(roomId).emit('chat', {
        id: 'system',
        name: 'System',
        text: `${name || 'A player'} left the game`,
        ts: Date.now(),
        isSystem: true
      });
      
      // If host changed, notify everyone
      if (removalResult.wasHost && removalResult.newHostId) {
        const newHostName = room.getPlayerName(removalResult.newHostId);
        io.to(roomId).emit('chat', {
          id: 'system',
          name: 'System',
          text: `${newHostName} is now the host`,
          ts: Date.now(),
          isSystem: true
        });
        io.to(roomId).emit('hostChanged', {
          newHostId: removalResult.newHostId,
          newHostName
        });
      }
      
      // If drawer left during game, end the round
      if (removalResult.shouldEndRound) {
        io.to(roomId).emit('chat', {
          id: 'system',
          name: 'System',
          text: 'Drawer left - round ended early',
          ts: Date.now(),
          isSystem: true
        });
        endRound(roomId, null);
      }
      
      // If only 1 player remains during a game, end it
      if (removalResult.remainingPlayers < 2 && room.stage !== 'lobby') {
        io.to(roomId).emit('chat', {
          id: 'system',
          name: 'System',
          text: 'Not enough players - returning to lobby',
          ts: Date.now(),
          isSystem: true
        });
        if (room.roundTimer) {
          clearTimeout(room.roundTimer);
        }
        room.resetGame();
        io.to(roomId).emit('gameOver', {
          finalScores: room.getPublicPlayerList().sort((a, b) => b.score - a.score),
          reason: 'Not enough players'
        });
      }
      
      broadcastRoomUpdate(roomId);
    }
  }
  
  playerSockets.delete(socket.id);
}

// ==================== Socket.IO Events ====================

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // Create Room
  socket.on('createRoom', async ({ roomId: requestedRoomId, name }, callback) => {
    const roomId = requestedRoomId || generateRoomCode();
    
    if (rooms.has(roomId)) {
      return callback({ success: false, error: { code: 'ROOM_EXISTS', message: 'Room already exists' } });
    }
    
    const playerId = generatePlayerId();
    const room = new Room(roomId);
    room.addPlayer(playerId, name, socket.id, true);
    rooms.set(roomId, room);
    
    // Save to MongoDB
    await saveRoomToMongo(room);
    
    socket.join(roomId);
    playerSockets.set(socket.id, { roomId, playerId, name });
    
    console.log(`Room ${roomId} created by ${name} (${playerId})`);
    
    callback({
      success: true,
      roomId,
      playerId,
      room: {
        roomId: room.id,
        players: room.getPublicPlayerList(),
        stage: room.stage,
        hostId: room.hostId,
        settings: room.settings
      }
    });
  });
  
  // Join Room
  socket.on('joinRoom', ({ roomId, name }, callback) => {
    const room = rooms.get(roomId.toUpperCase());
    
    if (!room) {
      return callback({ success: false, error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } });
    }
    
    if (room.stage !== 'lobby' && room.stage !== 'waiting') {
      // Game is in progress - player joins as spectator initially
      // They'll receive strokes for rehydration in the response
      console.log(`Player ${name} joining mid-game in room ${room.id}`);
    }
    
    if (room.players.length >= 10) {
      return callback({ success: false, error: { code: 'ROOM_FULL', message: 'Room is full (max 10 players)' } });
    }
    
    const playerId = generatePlayerId();
    room.addPlayer(playerId, name, socket.id, false);
    
    socket.join(room.id);
    playerSockets.set(socket.id, { roomId: room.id, playerId, name });
    
    console.log(`${name} (${playerId}) joined room ${room.id}`);
    
    // Send current strokes for rehydration if game is in progress
    const rehydrationData = room.stage === 'drawing' ? room.getCurrentStrokes() : [];
    
    callback({
      success: true,
      roomId: room.id,
      playerId,
      room: {
        roomId: room.id,
        players: room.getPublicPlayerList(),
        stage: room.stage,
        hostId: room.hostId,
        settings: room.settings,
        drawerId: room.currentDrawerId,
        timeRemaining: room.getTimeRemaining(),
        strokes: rehydrationData
      }
    });
    
    broadcastRoomUpdate(room.id);
    
    io.to(room.id).emit('chat', {
      id: 'system',
      name: 'System',
      text: `${name} joined the room!`,
      ts: Date.now(),
      isSystem: true
    });
  });
  
  // Rejoin Room (for reconnecting after disconnect)
  socket.on('rejoinRoom', ({ roomId, playerId, name }, callback) => {
    const room = rooms.get(roomId?.toUpperCase());
    
    if (!room) {
      // Check if we have disconnected player data
      const disconnectedData = disconnectedPlayers.get(playerId);
      if (!disconnectedData) {
        return callback({ success: false, error: { code: 'ROOM_NOT_FOUND', message: 'Room no longer exists' } });
      }
      return callback({ success: false, error: { code: 'ROOM_NOT_FOUND', message: 'Room no longer exists' } });
    }
    
    // Check if this player was disconnected from this room
    const disconnectedData = disconnectedPlayers.get(playerId);
    let restoredScore = 0;
    
    if (disconnectedData && disconnectedData.roomId === room.id) {
      // Player is rejoining - restore their score
      restoredScore = disconnectedData.score;
      disconnectedPlayers.delete(playerId);
      console.log(`${name} (${playerId}) rejoining room ${room.id} with score ${restoredScore}`);
    }
    
    // Check if player is already in the room (reconnecting with same session)
    const existingPlayer = room.players.find(p => p.id === playerId);
    if (existingPlayer) {
      // Update socket ID
      existingPlayer.socketId = socket.id;
      socket.join(room.id);
      playerSockets.set(socket.id, { roomId: room.id, playerId, name: existingPlayer.name });
      
      console.log(`${existingPlayer.name} (${playerId}) reconnected to room ${room.id}`);
      
      // Send current game state
      const rehydrationData = room.stage === 'drawing' ? room.getCurrentStrokes() : [];
      const isDrawer = room.currentDrawerId === playerId;
      
      callback({
        success: true,
        roomId: room.id,
        playerId,
        isRejoin: true,
        room: {
          roomId: room.id,
          players: room.getPublicPlayerList(),
          stage: room.stage,
          hostId: room.hostId,
          settings: room.settings,
          drawerId: room.currentDrawerId,
          secretWord: isDrawer ? room.currentWord : null,
          wordLength: room.currentWord?.length || 0,
          timeRemaining: room.getTimeRemaining(),
          currentRound: room.currentRound,
          totalRounds: room.settings.totalRounds,
          strokes: rehydrationData
        }
      });
      
      broadcastRoomUpdate(room.id);
      return;
    }
    
    // Player is not in room - add them back
    if (room.players.length >= 10) {
      return callback({ success: false, error: { code: 'ROOM_FULL', message: 'Room is full' } });
    }
    
    // Add player with restored score
    const player = room.addPlayer(playerId, name, socket.id, false);
    player.score = restoredScore;
    
    socket.join(room.id);
    playerSockets.set(socket.id, { roomId: room.id, playerId, name });
    
    // Send current game state
    const rehydrationData = room.stage === 'drawing' ? room.getCurrentStrokes() : [];
    
    callback({
      success: true,
      roomId: room.id,
      playerId,
      isRejoin: true,
      room: {
        roomId: room.id,
        players: room.getPublicPlayerList(),
        stage: room.stage,
        hostId: room.hostId,
        settings: room.settings,
        drawerId: room.currentDrawerId,
        wordLength: room.currentWord?.length || 0,
        timeRemaining: room.getTimeRemaining(),
        currentRound: room.currentRound,
        totalRounds: room.settings.totalRounds,
        strokes: rehydrationData
      }
    });
    
    broadcastRoomUpdate(room.id);
    
    io.to(room.id).emit('chat', {
      id: 'system',
      name: 'System',
      text: `${name} reconnected!`,
      ts: Date.now(),
      isSystem: true
    });
  });
  
  // Start Round
  socket.on('startRound', ({ roomId, difficulty = 'medium' }, callback) => {
    const room = rooms.get(roomId);
    const playerData = playerSockets.get(socket.id);
    
    if (!room) {
      return callback?.({ success: false, error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } });
    }
    
    if (playerData?.playerId !== room.hostId) {
      return callback?.({ success: false, error: { code: 'NOT_HOST', message: 'Only host can start the round' } });
    }
    
    if (room.players.length < 2) {
      return callback?.({ success: false, error: { code: 'NOT_ENOUGH_PLAYERS', message: 'Need at least 2 players' } });
    }
    
    const { drawerId, timeLimit } = room.startRound(difficulty);
    const secretWord = room.currentWord;
    const hintsEnabled = room.settings.hintsEnabled;
    
    // Get initial hint (stage 0 - all blanks)
    const initialHint = hintsEnabled ? room.wordBank.getHintAtStage(secretWord, 0) : null;
    
    // Send round started to all players (without secret word)
    room.players.forEach(player => {
      const isDrawer = player.id === drawerId;
      io.to(player.socketId).emit('roundStarted', {
        roomId,
        drawerId,
        drawerName: room.getPlayerName(drawerId),
        timeLimit,
        word: isDrawer ? secretWord : null,
        wordLength: secretWord.length,
        wordHint: isDrawer ? null : initialHint,
        hintsEnabled,
        round: room.currentRound,
        totalRounds: room.settings.totalRounds,
        serverTime: Date.now(),
        roundEndTime: room.roundStartTime + (timeLimit * 1000)
      });
    });
    
    broadcastRoomUpdate(roomId);
    
    // Set up progressive hint timers if hints are enabled
    if (hintsEnabled) {
      room.hintTimers = [];
      
      // Hint at 25% time elapsed (reveal first letter)
      room.hintTimers.push(setTimeout(() => {
        if (room.stage === 'drawing') {
          const hint = room.wordBank.getHintAtStage(secretWord, 1);
          room.players.forEach(player => {
            if (player.id !== room.currentDrawerId) {
              io.to(player.socketId).emit('hintUpdate', { hint, stage: 1 });
            }
          });
        }
      }, timeLimit * 0.25 * 1000));
      
      // Hint at 50% time elapsed (reveal first + last letter)
      room.hintTimers.push(setTimeout(() => {
        if (room.stage === 'drawing') {
          const hint = room.wordBank.getHintAtStage(secretWord, 2);
          room.players.forEach(player => {
            if (player.id !== room.currentDrawerId) {
              io.to(player.socketId).emit('hintUpdate', { hint, stage: 2 });
            }
          });
        }
      }, timeLimit * 0.5 * 1000));
      
      // Hint at 75% time elapsed (reveal ~50% of letters)
      room.hintTimers.push(setTimeout(() => {
        if (room.stage === 'drawing') {
          const hint = room.wordBank.getHintAtStage(secretWord, 3);
          room.players.forEach(player => {
            if (player.id !== room.currentDrawerId) {
              io.to(player.socketId).emit('hintUpdate', { hint, stage: 3 });
            }
          });
        }
      }, timeLimit * 0.75 * 1000));
    }
    
    // Set timer for round end
    room.roundTimer = setTimeout(() => {
      endRound(roomId, null);
    }, timeLimit * 1000);
    
    callback?.({ success: true });
  });
  
  // Stroke broadcast
  socket.on('stroke', ({ roomId, stroke }) => {
    const room = rooms.get(roomId);
    const playerData = playerSockets.get(socket.id);
    
    if (!room || !playerData) return;
    if (playerData.playerId !== room.currentDrawerId) return;
    
    // Validate stroke data
    if (!validateStroke(stroke)) {
      console.log(`Invalid stroke from ${playerData.playerId}`);
      return;
    }
    
    // Rate limiting for strokes
    if (!checkStrokeRateLimit(playerData.playerId)) {
      // Silently drop excess strokes
      return;
    }
    
    room.addStroke(stroke);
    socket.to(roomId).emit('stroke', { stroke });
  });
  
  // Clear Canvas
  socket.on('clearCanvas', ({ roomId }) => {
    const room = rooms.get(roomId);
    const playerData = playerSockets.get(socket.id);
    
    if (!room || !playerData) return;
    if (playerData.playerId !== room.currentDrawerId && playerData.playerId !== room.hostId) return;
    
    room.clearStrokes();
    io.to(roomId).emit('clearCanvas', {});
  });
  
  // Fill operation (bucket tool)
  socket.on('fill', ({ roomId, fill }) => {
    const room = rooms.get(roomId);
    const playerData = playerSockets.get(socket.id);
    
    if (!room || !playerData) return;
    if (playerData.playerId !== room.currentDrawerId) return;
    
    // Broadcast fill to all other players
    socket.to(roomId).emit('fill', { fill });
  });
  
  // Guess
  socket.on('guess', ({ roomId, text }) => {
    const room = rooms.get(roomId);
    const playerData = playerSockets.get(socket.id);
    
    if (!room || !playerData) return;
    if (room.stage !== 'drawing') return;
    if (playerData.playerId === room.currentDrawerId) return;
    if (room.hasPlayerGuessed(playerData.playerId)) return;
    
    // Rate limiting
    if (!checkGuessRateLimit(playerData.playerId)) {
      socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many guesses, slow down!' });
      return;
    }
    
    const sanitizedText = sanitizeHtml(filterProfanity(text.trim()));
    const guess = sanitizedText.toLowerCase();
    const correctWord = room.currentWord.toLowerCase();
    
    // Broadcast chat (hide if correct guess)
    const isCorrect = guess === correctWord;
    
    if (!isCorrect) {
      io.to(roomId).emit('chat', {
        id: playerData.playerId,
        name: playerData.name,
        text: sanitizedText,
        ts: Date.now(),
        isGuess: true
      });
    }
    
    if (isCorrect) {
      const pointsAwarded = room.awardPoints(playerData.playerId);
      
      io.to(roomId).emit('correctGuess', {
        playerId: playerData.playerId,
        name: playerData.name,
        pointsAwarded,
        isWinner: true // Flag for sound notification
      });
      
      broadcastRoomUpdate(roomId);
      
      // Check if everyone has guessed
      if (room.hasEveryoneGuessed()) {
        endRound(roomId, playerData.playerId);
      }
    }
  });
  
  // Chat message
  socket.on('chat', ({ roomId, text }) => {
    const room = rooms.get(roomId);
    const playerData = playerSockets.get(socket.id);
    
    if (!room || !playerData) return;
    
    const sanitizedText = sanitizeHtml(filterProfanity(text.trim().substring(0, 200)));
    
    io.to(roomId).emit('chat', {
      id: playerData.playerId,
      name: playerData.name,
      text: sanitizedText,
      ts: Date.now()
    });
  });
  
  // Leave Room (intentional leave - don't store for rejoin)
  socket.on('leaveRoom', async ({ roomId }) => {
    await cleanupPlayer(socket, false); // false = intentional leave, don't store for rejoin
  });
  
  // Disconnect (unintentional - store for rejoin)
  socket.on('disconnect', async () => {
    console.log(`Client disconnected: ${socket.id}`);
    await cleanupPlayer(socket, true); // true = store data for potential rejoin
  });
  
  // Player Ready Toggle
  socket.on('toggleReady', ({ roomId }) => {
    const room = rooms.get(roomId);
    const playerData = playerSockets.get(socket.id);
    
    if (!room || !playerData) return;
    
    room.togglePlayerReady(playerData.playerId);
    broadcastRoomUpdate(roomId);
  });
  
  // Update Room Settings (host only)
  socket.on('updateSettings', async ({ roomId, settings }, callback) => {
    const room = rooms.get(roomId);
    const playerData = playerSockets.get(socket.id);
    
    if (!room) {
      return callback?.({ success: false, error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } });
    }
    
    if (playerData?.playerId !== room.hostId) {
      return callback?.({ success: false, error: { code: 'NOT_HOST', message: 'Only host can change settings' } });
    }
    
    if (room.stage !== 'lobby') {
      return callback?.({ success: false, error: { code: 'GAME_IN_PROGRESS', message: 'Cannot change settings during game' } });
    }
    
    const updatedSettings = room.updateSettings(settings);
    broadcastRoomUpdate(roomId);
    
    callback?.({ success: true, settings: updatedSettings });
    
    // Save to MongoDB
    await saveRoomToMongo(room);
  });
  
  // ==================== Voice Chat WebRTC Signaling ====================
  
  // WebRTC Offer - player sends offer to connect with another peer
  socket.on('voiceOffer', ({ roomId, targetId, offer }) => {
    const playerData = playerSockets.get(socket.id);
    if (!playerData) return;
    
    // Find target player's socket
    const room = rooms.get(roomId);
    if (!room) return;
    
    const targetPlayer = room.players.find(p => p.id === targetId);
    if (!targetPlayer) return;
    
    io.to(targetPlayer.socketId).emit('voiceOffer', {
      fromId: playerData.playerId,
      fromName: playerData.name,
      offer
    });
  });
  
  // WebRTC Answer - player responds to an offer
  socket.on('voiceAnswer', ({ roomId, targetId, answer }) => {
    const playerData = playerSockets.get(socket.id);
    if (!playerData) return;
    
    const room = rooms.get(roomId);
    if (!room) return;
    
    const targetPlayer = room.players.find(p => p.id === targetId);
    if (!targetPlayer) return;
    
    io.to(targetPlayer.socketId).emit('voiceAnswer', {
      fromId: playerData.playerId,
      answer
    });
  });
  
  // ICE Candidate exchange for WebRTC connection
  socket.on('voiceIceCandidate', ({ roomId, targetId, candidate }) => {
    const playerData = playerSockets.get(socket.id);
    if (!playerData) return;
    
    const room = rooms.get(roomId);
    if (!room) return;
    
    const targetPlayer = room.players.find(p => p.id === targetId);
    if (!targetPlayer) return;
    
    io.to(targetPlayer.socketId).emit('voiceIceCandidate', {
      fromId: playerData.playerId,
      candidate
    });
  });
  
  // Player mute status update
  socket.on('voiceMuteStatus', ({ roomId, isMuted }) => {
    const playerData = playerSockets.get(socket.id);
    if (!playerData) return;
    
    const room = rooms.get(roomId);
    if (!room) return;
    
    // Broadcast to all other players in room
    socket.to(roomId).emit('voiceMuteStatus', {
      playerId: playerData.playerId,
      isMuted
    });
  });
  
  // Player speaking status update with audio levels (for waveform visualization)
  socket.on('voiceSpeaking', ({ roomId, isSpeaking, audioLevel = 0 }) => {
    const playerData = playerSockets.get(socket.id);
    if (!playerData) return;
    
    socket.to(roomId).emit('voiceSpeaking', {
      playerId: playerData.playerId,
      isSpeaking,
      audioLevel
    });
  });
  
  // Host force mute a player
  socket.on('hostMutePlayer', ({ roomId, targetPlayerId, mute }) => {
    const playerData = playerSockets.get(socket.id);
    if (!playerData) return;
    
    const room = rooms.get(roomId);
    if (!room) return;
    
    // Only host can force mute
    if (playerData.playerId !== room.hostId) return;
    
    const targetPlayer = room.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer) return;
    
    // Notify target player they've been muted/unmuted by host
    io.to(targetPlayer.socketId).emit('hostMutePlayer', {
      mute,
      hostName: playerData.name
    });
    
    // Broadcast mute status to room
    io.to(roomId).emit('voiceMuteStatus', {
      playerId: targetPlayerId,
      isMuted: mute,
      forcedByHost: true
    });
  });
  
  // Player requesting to join voice chat
  socket.on('voiceJoin', ({ roomId }) => {
    const playerData = playerSockets.get(socket.id);
    if (!playerData) return;
    
    // Notify others that a new player joined voice
    socket.to(roomId).emit('voiceJoin', {
      playerId: playerData.playerId,
      playerName: playerData.name
    });
  });
  
  // Player leaving voice chat
  socket.on('voiceLeave', ({ roomId }) => {
    const playerData = playerSockets.get(socket.id);
    if (!playerData) return;
    
    socket.to(roomId).emit('voiceLeave', {
      playerId: playerData.playerId
    });
  });
});

// End Round Logic
async function endRound(roomId, winnerId) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }
  
  // Clear hint timers
  if (room.hintTimers) {
    room.hintTimers.forEach(timer => clearTimeout(timer));
    room.hintTimers = [];
  }
  
  const word = room.currentWord;
  room.endRound();
  
  io.to(roomId).emit('roundEnded', {
    word,
    scores: room.getPublicPlayerList(),
    winnerId
  });
  
  broadcastRoomUpdate(roomId);
  
  // Save to MongoDB
  await saveRoomToMongo(room);
  
  // Check if game is over
  if (room.isGameOver()) {
    const finalScores = room.getPublicPlayerList().sort((a, b) => b.score - a.score);
    
    // Save game history before room deletion
    await saveGameHistory(
      roomId,
      room.players,
      room.settings,
      room.createdAt || Date.now()
    );
    
    // Emit game over to all players
    io.to(roomId).emit('gameOver', {
      finalScores,
      roomExpiring: true,
      message: 'Game completed! Room will be closed in 30 seconds.'
    });
    
    // Schedule room deletion after 30 seconds to allow players to see results
    setTimeout(async () => {
      console.log(`🗑️  Auto-expiring completed room: ${roomId}`);
      
      // Delete from MongoDB immediately
      await deleteRoomFromMongo(roomId);
      
      // Remove from in-memory storage
      rooms.delete(roomId);
      
      // Notify any remaining players
      io.to(roomId).emit('roomExpired', {
        message: 'This room has been closed. Thank you for playing!'
      });
      
      // Disconnect all sockets from the room
      io.in(roomId).socketsLeave(roomId);
    }, 30000); // 30 seconds delay
    
    // Don't reset game - room will be deleted
  } else {
    // Auto-start next round after delay
    setTimeout(() => {
      if (rooms.has(roomId) && room.stage === 'waiting') {
        const { drawerId, timeLimit } = room.startRound();
        const secretWord = room.currentWord;
        const hintsEnabled = room.settings.hintsEnabled;
        
        // Get initial hint
        const initialHint = hintsEnabled ? room.wordBank.getHintAtStage(secretWord, 0) : null;
        
        room.players.forEach(player => {
          const isDrawer = player.id === drawerId;
          io.to(player.socketId).emit('roundStarted', {
            roomId,
            drawerId,
            drawerName: room.getPlayerName(drawerId),
            timeLimit,
            word: isDrawer ? secretWord : null,
            wordLength: secretWord.length,
            wordHint: isDrawer ? null : initialHint,
            hintsEnabled,
            round: room.currentRound,
            totalRounds: room.settings.totalRounds,
            serverTime: Date.now(),
            roundEndTime: room.roundStartTime + (timeLimit * 1000)
          });
        });
        
        broadcastRoomUpdate(roomId);
        
        // Set up progressive hint timers if hints are enabled
        if (hintsEnabled) {
          room.hintTimers = [];
          
          // Hint at 25% (first letter)
          room.hintTimers.push(setTimeout(() => {
            if (room.stage === 'drawing') {
              const hint = room.wordBank.getHintAtStage(secretWord, 1);
              room.players.forEach(player => {
                if (player.id !== room.currentDrawerId) {
                  io.to(player.socketId).emit('hintUpdate', { hint, stage: 1 });
                }
              });
            }
          }, timeLimit * 0.25 * 1000));
          
          // Hint at 50% (first + last)
          room.hintTimers.push(setTimeout(() => {
            if (room.stage === 'drawing') {
              const hint = room.wordBank.getHintAtStage(secretWord, 2);
              room.players.forEach(player => {
                if (player.id !== room.currentDrawerId) {
                  io.to(player.socketId).emit('hintUpdate', { hint, stage: 2 });
                }
              });
            }
          }, timeLimit * 0.5 * 1000));
          
          // Hint at 75% (half letters)
          room.hintTimers.push(setTimeout(() => {
            if (room.stage === 'drawing') {
              const hint = room.wordBank.getHintAtStage(secretWord, 3);
              room.players.forEach(player => {
                if (player.id !== room.currentDrawerId) {
                  io.to(player.socketId).emit('hintUpdate', { hint, stage: 3 });
                }
              });
            }
          }, timeLimit * 0.75 * 1000));
        }
        
        room.roundTimer = setTimeout(() => {
          endRound(roomId, null);
        }, timeLimit * 1000);
      }
    }, 5000);
  }
}

// ==================== HTTP Endpoints ====================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    rooms: rooms.size,
    connections: io.engine.clientsCount
  });
});

app.get('/rooms', (req, res) => {
  // Protected admin endpoint - in production, add auth
  const adminKey = req.headers['x-admin-key'];
  if (process.env.ADMIN_KEY && adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const roomList = [];
  rooms.forEach((room, id) => {
    roomList.push({
      id,
      players: room.players.length,
      stage: room.stage,
      currentRound: room.currentRound
    });
  });
  
  res.json({ rooms: roomList, total: roomList.length });
});

// ==================== Server Start ====================

const PORT = process.env.PORT || 3001;

// Connect to MongoDB then start server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🎨 DoodleX server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Allowed origins: ${CORS_ORIGINS.join(', ')}`);
    console.log(`💾 MongoDB: ${isMongoConnected() ? 'Connected' : 'Using in-memory storage'}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
