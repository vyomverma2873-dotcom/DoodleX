const mongoose = require('mongoose');

const gameHistorySchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  players: [{
    id: String,
    name: String,
    finalScore: Number,
    rank: Number
  }],
  totalRounds: Number,
  duration: Number, // in seconds
  winner: {
    id: String,
    name: String,
    score: Number
  },
  settings: {
    timeLimit: Number,
    difficulty: String,
    hintsEnabled: Boolean
  },
  completedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now, expires: '30d' } // Auto-delete after 30 days
});

// Index for leaderboard queries
gameHistorySchema.index({ completedAt: -1 });
gameHistorySchema.index({ 'winner.id': 1 });

const GameHistory = mongoose.model('GameHistory', gameHistorySchema);

module.exports = GameHistory;
