const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  socketId: { type: String },
  score: { type: Number, default: 0 },
  isHost: { type: Boolean, default: false },
  isReady: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const strokeSchema = new mongoose.Schema({
  id: String,
  color: String,
  width: Number,
  points: [[Number]],
  ts: Number
}, { _id: false });

const roomSchema = new mongoose.Schema({
  roomId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  hostId: String,
  players: [playerSchema],
  stage: { 
    type: String, 
    enum: ['lobby', 'waiting', 'drawing', 'ended'],
    default: 'lobby'
  },
  currentDrawerId: String,
  currentWord: String,
  currentRound: { type: Number, default: 0 },
  strokes: [strokeSchema],
  roundStartTime: Date,
  playersGuessedCorrectly: [String],
  drawerOrder: [String],
  drawerIndex: { type: Number, default: 0 },
  settings: {
    timeLimit: { type: Number, default: 80 },
    totalRounds: { type: Number, default: 3 },
    difficulty: { type: String, default: 'medium' },
    maxPlayers: { type: Number, default: 10 },
    hintsEnabled: { type: Boolean, default: true }
  },
  createdAt: { type: Date, default: Date.now, expires: '24h' }, // Auto-delete after 24h
  lastActivity: { type: Date, default: Date.now }
});

// Index for efficient queries
roomSchema.index({ lastActivity: 1 });
roomSchema.index({ 'players.id': 1 });

// Update lastActivity on save
roomSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  next();
});

const RoomModel = mongoose.model('Room', roomSchema);

module.exports = RoomModel;
