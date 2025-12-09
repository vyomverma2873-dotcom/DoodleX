// Shared constants between server and clients
// These can be imported in both web and mobile clients

export const GAME_CONFIG = {
  MAX_PLAYERS: 10,
  MIN_PLAYERS: 2,
  DEFAULT_TIME_LIMIT: 80,
  DEFAULT_ROUNDS: 3,
  MAX_STROKES: 500,
  GUESS_RATE_LIMIT: 3,
  GUESS_RATE_WINDOW_MS: 5000,
};

export const STAGES = {
  LOBBY: 'lobby',
  WAITING: 'waiting',
  DRAWING: 'drawing',
  ENDED: 'ended',
};

export const DIFFICULTIES = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

export const SOCKET_EVENTS = {
  // Client -> Server
  CREATE_ROOM: 'createRoom',
  JOIN_ROOM: 'joinRoom',
  START_ROUND: 'startRound',
  STROKE: 'stroke',
  CLEAR_CANVAS: 'clearCanvas',
  GUESS: 'guess',
  CHAT: 'chat',
  LEAVE_ROOM: 'leaveRoom',
  TOGGLE_READY: 'toggleReady',
  
  // Server -> Client
  ROOM_UPDATE: 'roomUpdate',
  ROUND_STARTED: 'roundStarted',
  ROUND_ENDED: 'roundEnded',
  CORRECT_GUESS: 'correctGuess',
  GAME_OVER: 'gameOver',
  ERROR: 'error',
};

export const COLORS = {
  PRIMARY: '#FF7043',
  PRIMARY_DARK: '#E64A19',
  SECONDARY: '#6D4C41',
  ACCENT: '#FFEB3B',
  WHITE: '#FFFFFF',
  DARK: '#212121',
  GRAY: '#757575',
  LIGHT_GRAY: '#F5F5F5',
  SUCCESS: '#4CAF50',
  ERROR: '#F44336',
};

export const DRAWING_COLORS = [
  '#212121', // Black
  '#F44336', // Red
  '#2196F3', // Blue
  '#4CAF50', // Green
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#FFFFFF', // White (eraser)
];

export const BRUSH_SIZES = {
  MIN: 2,
  MAX: 30,
  DEFAULT: 5,
};

// Point scoring
export const SCORING = {
  BASE_CORRECT_GUESS: 100,
  PENALTY_PER_POSITION: 20,
  MIN_POINTS: 20,
  DRAWER_BONUS_PER_GUESSER: 20,
  MAX_DRAWER_BONUS: 100,
};
