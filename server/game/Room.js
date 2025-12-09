const { WordBank } = require('./WordBank');

class Room {
  constructor(id) {
    this.id = id;
    this.players = [];
    this.hostId = null;
    this.stage = 'lobby'; // lobby, waiting, drawing, ended
    this.currentDrawerId = null;
    this.currentWord = null;
    this.currentRound = 0;
    this.strokes = [];
    this.roundStartTime = null;
    this.roundTimer = null;
    this.playersGuessedCorrectly = new Set();
    this.drawerOrder = [];
    this.drawerIndex = 0;
    
    this.settings = {
      timeLimit: 80,
      totalRounds: 3,
      difficulty: 'medium',
      maxPlayers: 10,
      hintsEnabled: true
    };
    
    this.wordBank = new WordBank();
  }
  
  updateSettings(newSettings) {
    // Only allow updating specific settings
    const allowedKeys = ['timeLimit', 'totalRounds', 'difficulty', 'hintsEnabled'];
    
    for (const key of allowedKeys) {
      if (newSettings[key] !== undefined) {
        if (key === 'timeLimit') {
          this.settings.timeLimit = Math.min(180, Math.max(30, Number(newSettings.timeLimit)));
        } else if (key === 'totalRounds') {
          this.settings.totalRounds = Math.min(10, Math.max(1, Number(newSettings.totalRounds)));
        } else if (key === 'difficulty' && ['easy', 'medium'].includes(newSettings.difficulty)) {
          this.settings.difficulty = newSettings.difficulty;
        } else if (key === 'hintsEnabled') {
          this.settings.hintsEnabled = Boolean(newSettings.hintsEnabled);
        }
      }
    }
    
    return this.settings;
  }
  
  addPlayer(id, name, socketId, isHost = false) {
    const player = {
      id,
      name: name.substring(0, 20),
      socketId,
      score: 0,
      isHost,
      isReady: false,
      joinedAt: Date.now()
    };
    
    this.players.push(player);
    
    if (isHost || this.players.length === 1) {
      this.hostId = id;
      player.isHost = true;
    }
    
    return player;
  }
  
  removePlayer(playerId) {
    const index = this.players.findIndex(p => p.id === playerId);
    if (index === -1) return { removed: false };
    
    const removedPlayer = this.players[index];
    const wasHost = this.hostId === playerId;
    const wasDrawer = this.currentDrawerId === playerId;
    
    this.players.splice(index, 1);
    
    // If host left, assign new host
    let newHostId = null;
    if (wasHost && this.players.length > 0) {
      this.hostId = this.players[0].id;
      this.players[0].isHost = true;
      newHostId = this.hostId;
    }
    
    // Update drawer order
    this.drawerOrder = this.drawerOrder.filter(id => id !== playerId);
    
    // Return info about what happened for server to handle
    return {
      removed: true,
      playerName: removedPlayer.name,
      wasHost,
      wasDrawer,
      newHostId,
      shouldEndRound: wasDrawer && this.stage === 'drawing',
      remainingPlayers: this.players.length
    };
  }
  
  togglePlayerReady(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.isReady = !player.isReady;
    }
  }
  
  getPublicPlayerList() {
    return this.players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      isHost: p.isHost,
      isReady: p.isReady,
      isDrawing: p.id === this.currentDrawerId,
      hasGuessedCorrectly: this.playersGuessedCorrectly.has(p.id)
    }));
  }
  
  getPlayerName(playerId) {
    const player = this.players.find(p => p.id === playerId);
    return player ? player.name : 'Unknown';
  }
  
  startRound(difficulty = 'medium') {
    this.settings.difficulty = difficulty;
    this.currentRound++;
    this.stage = 'drawing';
    this.strokes = [];
    this.playersGuessedCorrectly = new Set();
    
    // Initialize drawer order if empty
    if (this.drawerOrder.length === 0) {
      this.drawerOrder = this.players.map(p => p.id);
      this.shuffleArray(this.drawerOrder);
      this.drawerIndex = 0;
    }
    
    // Get next drawer
    this.currentDrawerId = this.drawerOrder[this.drawerIndex % this.drawerOrder.length];
    this.drawerIndex++;
    
    // Ensure drawer is still in the game
    if (!this.players.find(p => p.id === this.currentDrawerId)) {
      this.drawerOrder = this.players.map(p => p.id);
      this.shuffleArray(this.drawerOrder);
      this.drawerIndex = 0;
      this.currentDrawerId = this.drawerOrder[0];
      this.drawerIndex++;
    }
    
    // Get random word
    this.currentWord = this.wordBank.getRandomWord(difficulty);
    this.roundStartTime = Date.now();
    
    return {
      drawerId: this.currentDrawerId,
      word: this.currentWord,
      timeLimit: this.settings.timeLimit
    };
  }
  
  endRound() {
    this.stage = 'waiting';
    this.strokes = [];
    
    // Award points to drawer if anyone guessed correctly
    if (this.playersGuessedCorrectly.size > 0) {
      const drawer = this.players.find(p => p.id === this.currentDrawerId);
      if (drawer) {
        drawer.score += Math.min(this.playersGuessedCorrectly.size * 20, 100);
      }
    }
  }
  
  addStroke(stroke) {
    this.strokes.push(stroke);
    // Keep only last 500 strokes for memory
    if (this.strokes.length > 500) {
      this.strokes = this.strokes.slice(-400);
    }
  }
  
  clearStrokes() {
    this.strokes = [];
  }
  
  getCurrentStrokes() {
    return this.strokes;
  }
  
  awardPoints(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return 0;
    
    // Points based on guess order
    const guessOrder = this.playersGuessedCorrectly.size;
    const timeBonus = Math.max(0, Math.floor((this.getTimeRemaining() / this.settings.timeLimit) * 50));
    const basePoints = Math.max(100 - guessOrder * 20, 20);
    const points = basePoints + timeBonus;
    
    player.score += points;
    this.playersGuessedCorrectly.add(playerId);
    
    return points;
  }
  
  hasPlayerGuessed(playerId) {
    return this.playersGuessedCorrectly.has(playerId);
  }
  
  hasEveryoneGuessed() {
    const nonDrawerCount = this.players.filter(p => p.id !== this.currentDrawerId).length;
    return this.playersGuessedCorrectly.size >= nonDrawerCount;
  }
  
  getTimeRemaining() {
    if (!this.roundStartTime) return this.settings.timeLimit;
    const elapsed = (Date.now() - this.roundStartTime) / 1000;
    return Math.max(0, Math.floor(this.settings.timeLimit - elapsed));
  }
  
  isGameOver() {
    // Game is over when all players have drawn in all rounds
    const totalDraws = this.players.length * this.settings.totalRounds;
    return this.currentRound >= totalDraws;
  }
  
  resetGame() {
    this.stage = 'lobby';
    this.currentDrawerId = null;
    this.currentWord = null;
    this.currentRound = 0;
    this.strokes = [];
    this.playersGuessedCorrectly = new Set();
    this.drawerOrder = [];
    this.drawerIndex = 0;
    
    // Reset player scores
    this.players.forEach(p => {
      p.score = 0;
      p.isReady = false;
    });
  }
  
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

module.exports = { Room };
