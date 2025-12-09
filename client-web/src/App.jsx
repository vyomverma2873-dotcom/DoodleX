import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { GridScan } from './components/GridScan'
import VoiceChat from './components/VoiceChat'
import AudioWaveform from './components/AudioWaveform'
import ContactUs from './components/ContactUs'
import HowToPlay from './components/HowToPlay'
import FAQ from './components/FAQ'
import ClickSpark from './components/ClickSpark'
import LoadingSpinner from './components/LoadingSpinner'

// Footer Component with Navigation
const Footer = ({ onNavigate }) => (
  <footer className="app-footer">
    <div className="footer-links">
      <button className="footer-link" onClick={() => onNavigate('howtoplay')}>How to Play</button>
      <span className="footer-divider">•</span>
      <button className="footer-link" onClick={() => onNavigate('faq')}>FAQ</button>
      <span className="footer-divider">•</span>
      <button className="footer-link" onClick={() => onNavigate('contact')}>Contact Us</button>
    </div>
    <div className="footer-credits">
      <span>Made by Vyom Verma and Vansh Chaudhary</span>
      <span className="footer-divider">•</span>
      <span>© DoodleX 2025</span>
    </div>
  </footer>
)

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

// Screens
const SCREENS = {
  HOME: 'home',
  LOBBY: 'lobby',
  GAME: 'game',
  CONTACT: 'contact',
  HOWTOPLAY: 'howtoplay',
  FAQ: 'faq'
}

// Colors for drawing
const COLORS = ['#212121', '#F44336', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#FFFFFF']
const DEFAULT_BRUSH_SIZE = 5

function App() {
  const [screen, setScreen] = useState(SCREENS.HOME)
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Loading states for different operations
  const [isConnecting, setIsConnecting] = useState(true)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [isStartingGame, setIsStartingGame] = useState(false)
  const [isLoadingGame, setIsLoadingGame] = useState(false)
  
  // Player state
  const [playerName, setPlayerName] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [joinRoomCode, setJoinRoomCode] = useState('')
  
  // Room state
  const [room, setRoom] = useState(null)
  const [players, setPlayers] = useState([])
  const [isHost, setIsHost] = useState(false)
  const [hostId, setHostId] = useState(null)
  
  // Game state
  const [stage, setStage] = useState('lobby')
  const [drawerId, setDrawerId] = useState(null)
  const [secretWord, setSecretWord] = useState(null)
  const [wordLength, setWordLength] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [currentRound, setCurrentRound] = useState(0)
  const [totalRounds, setTotalRounds] = useState(3)
  const [messages, setMessages] = useState([])
  const [guessInput, setGuessInput] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [finalScores, setFinalScores] = useState([])
  const [roundWord, setRoundWord] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [wordHint, setWordHint] = useState(null) // Current hint for guessers
  const [hintsEnabled, setHintsEnabled] = useState(true)
  
  // Game settings (host can modify)
  const [gameSettings, setGameSettings] = useState({
    timeLimit: 80,
    totalRounds: 3,
    difficulty: 'medium',
    hintsEnabled: true
  })
  
  // Drawing state
  const [color, setColor] = useState(COLORS[0])
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE)
  const [isEraser, setIsEraser] = useState(false)
  const [isFillMode, setIsFillMode] = useState(false)
  
  // Voice chat state (synced from VoiceChat component)
  const [voiceState, setVoiceState] = useState({
    isVoiceEnabled: false,
    isMuted: true,
    speakingPlayers: [],
    mutedPlayers: {},
    voiceConnected: [],
    locallyMutedPlayers: [],
    audioLevels: {},
    localAudioLevel: 0
  })
  
  // Voice state change handler
  const handleVoiceStateChange = useCallback((newState) => {
    setVoiceState(newState)
  }, [])
  
  // Sound refs
  const winSoundRef = useRef(null)
  const wrongGuessSoundRef = useRef(null)
  
  // Voice chat ref
  const voiceChatRef = useRef(null)
  
  // Refs
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef(null)
  const strokeThrottleRef = useRef(null)
  const timerRef = useRef(null)
  const messagesEndRef = useRef(null)

  // Initialize sounds
  useEffect(() => {
    // Win sound
    const winAudio = new Audio('/win-sound.mp3')
    winAudio.volume = 0.5
    winAudio.preload = 'auto'
    winAudio.load()
    winSoundRef.current = winAudio
    
    // Wrong guess sound
    const wrongAudio = new Audio('/wrong-guess.mp3')
    wrongAudio.volume = 0.6
    wrongAudio.preload = 'auto'
    wrongAudio.load()
    wrongGuessSoundRef.current = wrongAudio
    
    return () => {
      if (winSoundRef.current) {
        winSoundRef.current.pause()
        winSoundRef.current.src = ''
        winSoundRef.current = null
      }
      if (wrongGuessSoundRef.current) {
        wrongGuessSoundRef.current.pause()
        wrongGuessSoundRef.current.src = ''
        wrongGuessSoundRef.current = null
      }
    }
  }, [])
  
  const playWinSound = useCallback(() => {
    if (winSoundRef.current) {
      const audio = winSoundRef.current.cloneNode()
      audio.volume = winSoundRef.current.volume
      audio.play().catch((err) => {
        console.log('Audio play failed:', err.message)
      })
    }
  }, [])
  
  const playWrongGuessSound = useCallback(() => {
    if (wrongGuessSoundRef.current) {
      const audio = wrongGuessSoundRef.current.cloneNode()
      audio.volume = wrongGuessSoundRef.current.volume
      audio.play().catch((err) => {
        console.log('Audio play failed:', err.message)
      })
    }
  }, [])

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })
    
    newSocket.on('connect', () => {
      console.log('Connected to server')
      setConnected(true)
      setIsConnecting(false)
      setError('')
    })
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from server')
      setConnected(false)
      setIsConnecting(true)
    })
    
    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err)
      setError('Cannot connect to server. Please try again.')
      setIsConnecting(false)
    })
    
    setSocket(newSocket)
    
    return () => {
      newSocket.close()
    }
  }, [])

  // Socket event listeners
  useEffect(() => {
    if (!socket) return
    
    socket.on('roomUpdate', (data) => {
      setPlayers(data.players)
      setStage(data.stage)
      setHostId(data.hostId)
      setIsHost(data.hostId === playerId)
      if (data.settings) {
        setGameSettings(prev => ({
          ...prev,
          ...data.settings
        }))
      }
    })
    
    socket.on('hostChanged', ({ newHostId }) => {
      setHostId(newHostId)
      setIsHost(newHostId === playerId)
    })
    
    socket.on('roundStarted', (data) => {
      setStage('drawing')
      setDrawerId(data.drawerId)
      setSecretWord(data.word)
      setWordLength(data.wordLength)
      setWordHint(data.wordHint || null) // Store initial hint
      setHintsEnabled(data.hintsEnabled !== false)
      setTimeRemaining(data.timeLimit)
      setCurrentRound(data.round)
      setTotalRounds(data.totalRounds)
      setScreen(SCREENS.GAME)
      setRoundWord(null)
      
      // Clear canvas for new round
      if (ctxRef.current && canvasRef.current) {
        ctxRef.current.fillStyle = '#FFFFFF'
        ctxRef.current.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
      
      // Start timer
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
      addMessage({
        id: 'system',
        name: 'System',
        text: `Round ${data.round} started! ${data.drawerName} is drawing.`,
        isSystem: true
      })
    })
    
    // Listen for progressive hint updates
    socket.on('hintUpdate', ({ hint, stage }) => {
      setWordHint(hint)
      if (stage === 1) {
        addMessage({
          id: 'hint',
          name: 'System',
          text: '💡 Hint: First letter revealed!',
          isSystem: true,
          isHint: true
        })
      } else if (stage === 2) {
        addMessage({
          id: 'hint',
          name: 'System',
          text: '💡 Hint: More letters revealed!',
          isSystem: true,
          isHint: true
        })
      } else if (stage === 3) {
        addMessage({
          id: 'hint',
          name: 'System',
          text: '💡 Final hint: Half the word revealed!',
          isSystem: true,
          isHint: true
        })
      }
    })
    
    socket.on('stroke', ({ stroke }) => {
      drawStroke(stroke)
    })
    
    socket.on('clearCanvas', () => {
      if (ctxRef.current && canvasRef.current) {
        ctxRef.current.fillStyle = '#FFFFFF'
        ctxRef.current.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    })
    
    socket.on('chat', (msg) => {
      addMessage(msg)
      // Play wrong guess sound if this is the current player's incorrect guess
      if (msg.isGuess && msg.id === playerId) {
        playWrongGuessSound()
      }
    })
    
    socket.on('correctGuess', (data) => {
      addMessage({
        id: 'correct',
        name: 'System',
        text: `🎉 ${data.name} guessed correctly! (+${data.pointsAwarded} points)`,
        isSystem: true,
        isCorrect: true
      })
      // Play win sound for the player who guessed correctly
      if (data.playerId === playerId && data.isWinner) {
        playWinSound()
      }
    })
    
    socket.on('fill', ({ fill }) => {
      applyFill(fill)
    })
    
    socket.on('roundEnded', (data) => {
      setStage('waiting')
      setRoundWord(data.word)
      setWordHint(null) // Clear hint for next round
      setPlayers(data.scores)
      if (timerRef.current) clearInterval(timerRef.current)
      
      addMessage({
        id: 'system',
        name: 'System',
        text: `Round ended! The word was "${data.word}"`,
        isSystem: true
      })
    })
    
    socket.on('gameOver', (data) => {
      setFinalScores(data.finalScores)
      setShowResults(true)
      setStage('lobby')
      if (timerRef.current) clearInterval(timerRef.current)
      // Play win sound for top scorer
      if (data.finalScores[0]?.id === playerId) {
        playWinSound()
      }
    })
    
    socket.on('error', (err) => {
      setError(err.message)
      setTimeout(() => setError(''), 3000)
    })
    
    return () => {
      socket.off('roomUpdate')
      socket.off('hostChanged')
      socket.off('roundStarted')
      socket.off('hintUpdate')
      socket.off('stroke')
      socket.off('clearCanvas')
      socket.off('fill')
      socket.off('chat')
      socket.off('correctGuess')
      socket.off('roundEnded')
      socket.off('gameOver')
      socket.off('error')
    }
  }, [socket, playerId])

  // Auto-reconnect on page load if session exists
  useEffect(() => {
    if (!socket || !connected) return
    
    // Check for existing session
    const savedSession = localStorage.getItem('doodlex_session')
    if (!savedSession) return
    
    try {
      const session = JSON.parse(savedSession)
      
      // Check if session is not too old (5 minutes)
      const SESSION_TIMEOUT = 5 * 60 * 1000
      if (Date.now() - session.timestamp > SESSION_TIMEOUT) {
        localStorage.removeItem('doodlex_session')
        return
      }
      
      // Only auto-rejoin if we're on the home screen
      if (screen !== SCREENS.HOME) return
      
      console.log('Attempting to rejoin room:', session.roomCode)
      setIsReconnecting(true)
      
      socket.emit('rejoinRoom', {
        roomId: session.roomCode,
        playerId: session.playerId,
        name: session.playerName
      }, (response) => {
        setIsReconnecting(false)
        if (response.success) {
          console.log('Rejoined room successfully')
          setPlayerId(response.playerId)
          setRoomCode(response.roomId)
          setRoom(response.room)
          setPlayers(response.room.players)
          setPlayerName(session.playerName)
          setHostId(response.room.hostId)
          setIsHost(response.room.hostId === response.playerId)
          
          if (response.room.settings) {
            setGameSettings(prev => ({ ...prev, ...response.room.settings }))
          }
          
          // Update session timestamp
          localStorage.setItem('doodlex_session', JSON.stringify({
            ...session,
            timestamp: Date.now()
          }))
          
          // Restore game state if in progress
          if (response.room.stage === 'drawing') {
            setDrawerId(response.room.drawerId)
            setSecretWord(response.room.secretWord || null)
            setWordLength(response.room.wordLength || 0)
            setTimeRemaining(response.room.timeRemaining || 0)
            setCurrentRound(response.room.currentRound || 1)
            setTotalRounds(response.room.totalRounds || 3)
            setScreen(SCREENS.GAME)
            setStage('drawing')
            
            // Rehydrate strokes
            if (response.room.strokes?.length > 0) {
              setTimeout(() => {
                response.room.strokes.forEach(stroke => drawStroke(stroke))
              }, 100)
            }
            
            // Restart timer
            if (timerRef.current) clearInterval(timerRef.current)
            timerRef.current = setInterval(() => {
              setTimeRemaining(prev => {
                if (prev <= 1) {
                  clearInterval(timerRef.current)
                  return 0
                }
                return prev - 1
              })
            }, 1000)
          } else {
            setScreen(SCREENS.LOBBY)
            setStage(response.room.stage || 'lobby')
          }
          
          addMessage({
            id: 'system',
            name: 'System',
            text: 'Reconnected to game!',
            isSystem: true
          })
        } else {
          console.log('Failed to rejoin:', response.error?.message)
          localStorage.removeItem('doodlex_session')
        }
      })
    } catch (e) {
      console.error('Failed to parse session:', e)
      localStorage.removeItem('doodlex_session')
      setIsReconnecting(false)
    }
  }, [socket, connected, screen])

  // Initialize canvas
  useEffect(() => {
    if (screen !== SCREENS.GAME || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const container = canvas.parentElement
    
    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctxRef.current = ctx
    }
    
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [screen])

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessage = (msg) => {
    setMessages(prev => [...prev.slice(-100), { ...msg, ts: Date.now() }])
  }

  const createRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }
    
    setLoading(true)
    setError('')
    
    socket.emit('createRoom', { name: playerName.trim() }, (response) => {
      setLoading(false)
      if (response.success) {
        setPlayerId(response.playerId)
        setRoomCode(response.roomId)
        setRoom(response.room)
        setPlayers(response.room.players)
        setIsHost(true)
        setScreen(SCREENS.LOBBY)
        
        // Save session for reconnect
        localStorage.setItem('doodlex_session', JSON.stringify({
          playerId: response.playerId,
          playerName: playerName.trim(),
          roomCode: response.roomId,
          timestamp: Date.now()
        }))
      } else {
        setError(response.error?.message || 'Failed to create room')
      }
    })
  }

  const joinRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }
    if (!joinRoomCode.trim()) {
      setError('Please enter room code')
      return
    }
    
    setLoading(true)
    setError('')
    
    socket.emit('joinRoom', { 
      roomId: joinRoomCode.trim().toUpperCase(), 
      name: playerName.trim() 
    }, (response) => {
      setLoading(false)
      if (response.success) {
        setPlayerId(response.playerId)
        setRoomCode(response.roomId)
        setRoom(response.room)
        setPlayers(response.room.players)
        setIsHost(response.room.hostId === response.playerId)
        
        // Save session for reconnect
        localStorage.setItem('doodlex_session', JSON.stringify({
          playerId: response.playerId,
          playerName: playerName.trim(),
          roomCode: response.roomId,
          timestamp: Date.now()
        }))
        
        // Rehydrate strokes if joining mid-game
        if (response.room.strokes?.length > 0) {
          setTimeout(() => {
            response.room.strokes.forEach(stroke => drawStroke(stroke))
          }, 100)
        }
        
        if (response.room.stage === 'drawing') {
          setDrawerId(response.room.drawerId)
          setTimeRemaining(response.room.timeRemaining || 0)
          setScreen(SCREENS.GAME)
        } else {
          setScreen(SCREENS.LOBBY)
        }
      } else {
        setError(response.error?.message || 'Failed to join room')
      }
    })
  }

  const startGame = () => {
    if (!isHost) return
    setIsStartingGame(true)
    socket.emit('startRound', { roomId: roomCode, difficulty: gameSettings.difficulty }, (response) => {
      setIsStartingGame(false)
      if (!response?.success) {
        setError(response?.error?.message || 'Failed to start game')
      }
    })
  }

  const updateSettings = (newSettings) => {
    if (!isHost) return
    
    socket.emit('updateSettings', { roomId: roomCode, settings: newSettings }, (response) => {
      if (!response?.success) {
        setError(response?.error?.message || 'Failed to update settings')
      }
    })
    
    setGameSettings(prev => ({ ...prev, ...newSettings }))
  }

  const leaveRoom = () => {
    socket.emit('leaveRoom', { roomId: roomCode })
    
    // Clear session on intentional leave
    localStorage.removeItem('doodlex_session')
    
    setScreen(SCREENS.HOME)
    setRoom(null)
    setPlayers([])
    setMessages([])
    setRoomCode('')
    setPlayerId('')
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode)
    addMessage({ id: 'system', name: 'System', text: 'Room code copied!', isSystem: true })
  }

  // Drawing functions
  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    }
  }

  const startDrawing = (e) => {
    if (drawerId !== playerId) return
    e.preventDefault()
    
    isDrawingRef.current = true
    const point = getCanvasPoint(e)
    
    currentStrokeRef.current = {
      id: `${playerId}-${Date.now()}`,
      color: isEraser ? '#FFFFFF' : color,
      width: brushSize,
      points: [[point.x, point.y]],
      ts: Date.now()
    }
  }

  const draw = useCallback((e) => {
    if (!isDrawingRef.current || drawerId !== playerId) return
    e.preventDefault()
    
    const point = getCanvasPoint(e)
    const stroke = currentStrokeRef.current
    
    if (stroke) {
      stroke.points.push([point.x, point.y])
      drawStroke(stroke)
      
      // Throttle broadcast
      if (!strokeThrottleRef.current) {
        strokeThrottleRef.current = setTimeout(() => {
          socket.emit('stroke', { roomId: roomCode, stroke: { ...stroke } })
          strokeThrottleRef.current = null
        }, 50)
      }
    }
  }, [drawerId, playerId, roomCode, socket, color, brushSize, isEraser])

  const stopDrawing = useCallback((e) => {
    if (!isDrawingRef.current) return
    e?.preventDefault()
    
    isDrawingRef.current = false
    
    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
      socket.emit('stroke', { roomId: roomCode, stroke: currentStrokeRef.current })
    }
    
    currentStrokeRef.current = null
    if (strokeThrottleRef.current) {
      clearTimeout(strokeThrottleRef.current)
      strokeThrottleRef.current = null
    }
  }, [roomCode, socket])

  const drawStroke = (stroke) => {
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas || !stroke.points || stroke.points.length === 0) return
    
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    ctx.beginPath()
    const [startX, startY] = stroke.points[0]
    ctx.moveTo(startX * canvas.width, startY * canvas.height)
    
    for (let i = 1; i < stroke.points.length; i++) {
      const [x, y] = stroke.points[i]
      ctx.lineTo(x * canvas.width, y * canvas.height)
    }
    
    ctx.stroke()
  }

  const clearCanvas = () => {
    if (drawerId !== playerId && !isHost) return
    socket.emit('clearCanvas', { roomId: roomCode })
  }
  
  // Flood fill algorithm
  const floodFill = useCallback((startX, startY, fillColor) => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const width = canvas.width
    const height = canvas.height
    
    // Convert hex color to RGB
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 0, g: 0, b: 0 }
    }
    
    const fillRgb = hexToRgb(fillColor)
    
    // Get pixel color at position
    const getPixel = (x, y) => {
      const idx = (y * width + x) * 4
      return {
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
        a: data[idx + 3]
      }
    }
    
    // Set pixel color
    const setPixel = (x, y) => {
      const idx = (y * width + x) * 4
      data[idx] = fillRgb.r
      data[idx + 1] = fillRgb.g
      data[idx + 2] = fillRgb.b
      data[idx + 3] = 255
    }
    
    // Check if colors match (with tolerance)
    const colorsMatch = (c1, c2, tolerance = 32) => {
      return Math.abs(c1.r - c2.r) <= tolerance &&
             Math.abs(c1.g - c2.g) <= tolerance &&
             Math.abs(c1.b - c2.b) <= tolerance
    }
    
    const targetColor = getPixel(startX, startY)
    
    // Don't fill if clicking on same color
    if (colorsMatch(targetColor, fillRgb, 10)) return
    
    // BFS flood fill with limit to prevent hanging
    const stack = [[startX, startY]]
    const visited = new Set()
    const maxPixels = 500000 // Limit for performance
    let pixelCount = 0
    
    while (stack.length > 0 && pixelCount < maxPixels) {
      const [x, y] = stack.pop()
      const key = `${x},${y}`
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue
      if (visited.has(key)) continue
      
      const currentColor = getPixel(x, y)
      if (!colorsMatch(currentColor, targetColor)) continue
      
      visited.add(key)
      setPixel(x, y)
      pixelCount++
      
      stack.push([x + 1, y])
      stack.push([x - 1, y])
      stack.push([x, y + 1])
      stack.push([x, y - 1])
    }
    
    ctx.putImageData(imageData, 0, 0)
  }, [])
  
  const applyFill = useCallback((fill) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const x = Math.floor(fill.x * canvas.width)
    const y = Math.floor(fill.y * canvas.height)
    floodFill(x, y, fill.color)
  }, [floodFill])
  
  const handleCanvasClick = useCallback((e) => {
    if (!isFillMode || drawerId !== playerId) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    
    const x = (clientX - rect.left) / rect.width
    const y = (clientY - rect.top) / rect.height
    
    const fillData = { x, y, color: color }
    
    // Apply locally
    floodFill(
      Math.floor(x * canvas.width),
      Math.floor(y * canvas.height),
      color
    )
    
    // Broadcast to others
    socket.emit('fill', { roomId: roomCode, fill: fillData })
  }, [isFillMode, drawerId, playerId, color, floodFill, socket, roomCode])

  const sendGuess = () => {
    if (!guessInput.trim() || drawerId === playerId) return
    socket.emit('guess', { roomId: roomCode, text: guessInput.trim() })
    setGuessInput('')
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendGuess()
    }
  }

  const getWordDisplay = () => {
    // Drawer sees the full word
    if (drawerId === playerId && secretWord) {
      return secretWord.toUpperCase()
    }
    
    // Guessers see hint if enabled and available
    if (hintsEnabled && wordHint) {
      // Format hint with spaces between characters for readability
      return wordHint.toUpperCase().split('').join(' ')
    }
    
    // Fallback: show underscores for word length
    return '_'.repeat(wordLength).split('').join(' ')
  }

  const isDrawer = drawerId === playerId

  // Handle footer navigation
  const handleNavigate = useCallback((page) => {
    if (page === 'contact') setScreen(SCREENS.CONTACT)
    else if (page === 'howtoplay') setScreen(SCREENS.HOWTOPLAY)
    else if (page === 'faq') setScreen(SCREENS.FAQ)
    else setScreen(SCREENS.HOME)
  }, [])

  // Render info pages
  if (screen === SCREENS.CONTACT) {
    return (
      <ClickSpark sparkColor="#FFD700" sparkSize={12} sparkRadius={20} sparkCount={10} duration={500}>
        <div className="app">
          <GridScan
            sensitivity={0.55}
            lineThickness={1}
            linesColor="#392e4e"
            gridScale={0.1}
            scanColor="#FF9FFC"
            scanOpacity={0.4}
            enablePost
            bloomIntensity={0.6}
            chromaticAberration={0.002}
            noiseIntensity={0.01}
          />
          <ContactUs onBack={() => setScreen(SCREENS.HOME)} />
          <Footer onNavigate={handleNavigate} />
        </div>
      </ClickSpark>
    )
  }

  if (screen === SCREENS.HOWTOPLAY) {
    return (
      <ClickSpark sparkColor="#FFD700" sparkSize={12} sparkRadius={20} sparkCount={10} duration={500}>
        <div className="app">
          <GridScan
            sensitivity={0.55}
            lineThickness={1}
            linesColor="#392e4e"
            gridScale={0.1}
            scanColor="#FF9FFC"
            scanOpacity={0.4}
            enablePost
            bloomIntensity={0.6}
            chromaticAberration={0.002}
            noiseIntensity={0.01}
          />
          <HowToPlay onBack={() => setScreen(SCREENS.HOME)} />
          <Footer onNavigate={handleNavigate} />
        </div>
      </ClickSpark>
    )
  }

  if (screen === SCREENS.FAQ) {
    return (
      <ClickSpark sparkColor="#FFD700" sparkSize={12} sparkRadius={20} sparkCount={10} duration={500}>
        <div className="app">
          <GridScan
            sensitivity={0.55}
            lineThickness={1}
            linesColor="#392e4e"
            gridScale={0.1}
            scanColor="#FF9FFC"
            scanOpacity={0.4}
            enablePost
            bloomIntensity={0.6}
            chromaticAberration={0.002}
            noiseIntensity={0.01}
          />
          <FAQ onBack={(page) => page === 'contact' ? setScreen(SCREENS.CONTACT) : setScreen(SCREENS.HOME)} />
          <Footer onNavigate={handleNavigate} />
        </div>
      </ClickSpark>
    )
  }

  // Render screens
  if (screen === SCREENS.HOME) {
    // Show full-screen loading while connecting initially
    if (isConnecting && !connected) {
      return (
        <div className="app">
          <GridScan
            sensitivity={0.55}
            lineThickness={1}
            linesColor="#392e4e"
            gridScale={0.1}
            scanColor="#FF9FFC"
            scanOpacity={0.4}
            enablePost
            bloomIntensity={0.6}
            chromaticAberration={0.002}
            noiseIntensity={0.01}
          />
          <LoadingSpinner fullScreen size="large" message="Connecting to server..." />
        </div>
      )
    }
    
    // Show reconnecting overlay
    if (isReconnecting) {
      return (
        <div className="app">
          <GridScan
            sensitivity={0.55}
            lineThickness={1}
            linesColor="#392e4e"
            gridScale={0.1}
            scanColor="#FF9FFC"
            scanOpacity={0.4}
            enablePost
            bloomIntensity={0.6}
            chromaticAberration={0.002}
            noiseIntensity={0.01}
          />
          <LoadingSpinner fullScreen size="large" message="Reconnecting to your game..." />
        </div>
      )
    }
    
    return (
      <ClickSpark sparkColor="#FFD700" sparkSize={12} sparkRadius={20} sparkCount={10} duration={500}>
        <div className="app">
        <GridScan
          sensitivity={0.55}
          lineThickness={1}
          linesColor="#392e4e"
          gridScale={0.1}
          scanColor="#FF9FFC"
          scanOpacity={0.4}
          enablePost
          bloomIntensity={0.6}
          chromaticAberration={0.002}
          noiseIntensity={0.01}
        />
        
        {/* Connection Status Indicator */}
        {!connected && !isConnecting && (
          <div className="connection-status disconnected">
            <span className="status-dot"></span>
            <span>Disconnected</span>
          </div>
        )}
        
        <div className="home">
          <div className="logo">
            <h1>DoodleX</h1>
            <p className="tagline">Draw, Guess, Enjoy!</p>
          </div>
          
          <div className="home-card">
            {error && <div className="error-message">{error}</div>}
            
            <div className="input-group">
              <label>Your Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
                disabled={loading}
              />
            </div>
            
            <button 
              className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
              onClick={createRoom}
              disabled={loading || !connected}
            >
              {loading ? 'Creating Room...' : 'Create Room'}
            </button>
            
            <div className="divider"><span>or</span></div>
            
            <div className="input-group">
              <label>Room Code</label>
              <input
                type="text"
                placeholder="Enter room code"
                value={joinRoomCode}
                onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{ textTransform: 'uppercase' }}
                disabled={loading}
              />
            </div>
            
            <button 
              className={`btn btn-secondary ${loading ? 'btn-loading' : ''}`}
              onClick={joinRoom}
              disabled={loading || !connected}
            >
              {loading ? 'Joining Room...' : 'Join Room'}
            </button>
            
            {!connected && !isConnecting && (
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <LoadingSpinner size="small" message="Reconnecting..." />
              </div>
            )}
          </div>
        </div>
        <Footer onNavigate={handleNavigate} />
        </div>
      </ClickSpark>
    )
  }

  if (screen === SCREENS.LOBBY) {
    return (
      <ClickSpark sparkColor="#FFD700" sparkSize={12} sparkRadius={20} sparkCount={10} duration={500}>
        <div className="app">
        <GridScan
          sensitivity={0.55}
          lineThickness={1}
          linesColor="#392e4e"
          gridScale={0.1}
          scanColor="#FF9FFC"
          scanOpacity={0.4}
          enablePost
          bloomIntensity={0.6}
          chromaticAberration={0.002}
          noiseIntensity={0.01}
        />
        <div className="lobby">
          <div className="logo" style={{ marginBottom: '20px' }}>
            <h1 style={{ fontSize: '2.5rem' }}>DoodleX</h1>
          </div>
          
          <div className="lobby-card">
            {error && <div className="error-message">{error}</div>}
            
            <div className="room-code">
              <h2>Room Code</h2>
              <div className="code">{roomCode}</div>
              <button onClick={copyRoomCode}>📋 Copy Code</button>
            </div>
            
            <div className="player-list">
              <h3>Players ({players.length}/10)</h3>
              {players.map(player => (
                <div key={player.id} className={`player-item ${player.isHost ? 'host' : ''}`}>
                  <div className="player-info">
                    <div className="player-avatar">{player.name[0].toUpperCase()}</div>
                    <span className="player-name">{player.name}</span>
                    {player.isHost && <span className="host-badge">👑 Host</span>}
                  </div>
                  <span className="player-score">{player.score} pts</span>
                </div>
              ))}
            </div>
            
            {/* Game Settings - visible to all, editable by host */}
            <div className="settings-section">
              <div 
                className="settings-header" 
                onClick={() => isHost && setShowSettings(!showSettings)}
                style={{ cursor: isHost ? 'pointer' : 'default' }}
              >
                <h3>⚙️ Game Settings</h3>
                {isHost && <span className="settings-toggle">{showSettings ? '▲' : '▼'}</span>}
              </div>
              
              {/* Settings summary - visible to all */}
              <div className="settings-summary">
                <span>⏱️ {gameSettings.timeLimit}s</span>
                <span>🔄 {gameSettings.totalRounds} rounds</span>
                <span>📊 {gameSettings.difficulty}</span>
              </div>
              
              {/* Expandable settings panel - host only */}
              {isHost && showSettings && (
                <div className="settings-panel">
                  <div className="setting-row">
                    <label>Drawing Time (seconds)</label>
                    <input
                      type="range"
                      min="30"
                      max="180"
                      step="10"
                      value={gameSettings.timeLimit}
                      onChange={(e) => updateSettings({ timeLimit: Number(e.target.value) })}
                    />
                    <span className="setting-value">{gameSettings.timeLimit}s</span>
                  </div>
                  
                  <div className="setting-row">
                    <label>Number of Rounds</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={gameSettings.totalRounds}
                      onChange={(e) => updateSettings({ totalRounds: Number(e.target.value) })}
                    />
                    <span className="setting-value">{gameSettings.totalRounds}</span>
                  </div>
                  
                  <div className="setting-row">
                    <label>Difficulty</label>
                    <div className="setting-buttons">
                      {['easy', 'medium'].map(diff => (
                        <button
                          key={diff}
                          className={`setting-btn ${gameSettings.difficulty === diff ? 'active' : ''}`}
                          onClick={() => updateSettings({ difficulty: diff })}
                        >
                          {diff.charAt(0).toUpperCase() + diff.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="setting-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={gameSettings.hintsEnabled}
                        onChange={(e) => updateSettings({ hintsEnabled: e.target.checked })}
                      />
                      Enable Hints
                    </label>
                  </div>
                </div>
              )}
            </div>
            
            {isHost ? (
              <button 
                className={`btn btn-primary ${isStartingGame ? 'btn-loading' : ''}`}
                onClick={startGame}
                disabled={players.length < 2 || isStartingGame}
              >
                {isStartingGame ? 'Starting...' : players.length < 2 ? 'Need 2+ Players' : 'Start Game'}
              </button>
            ) : (
              <div className="waiting-host">
                <LoadingSpinner size="small" message="Waiting for host to start the game..." />
              </div>
            )}
            
            <button 
              className="btn btn-secondary"
              onClick={leaveRoom}
              style={{ marginTop: '10px' }}
            >
              Leave Room
            </button>
          </div>
        </div>
        {/* Voice Chat in Lobby */}
        <VoiceChat
          ref={voiceChatRef}
          socket={socket}
          roomId={roomCode}
          playerId={playerId}
          players={players}
          isHost={isHost}
          hostId={hostId}
          onStateChange={handleVoiceStateChange}
        />
        <Footer onNavigate={handleNavigate} />
        </div>
      </ClickSpark>
    )
  }

  return (
    <ClickSpark sparkColor="#FFD700" sparkSize={12} sparkRadius={20} sparkCount={10} duration={500}>
      <div className="app">
      <div 
        className="game"
        onClick={() => voiceChatRef.current?.resumeAudioContext?.()}
        onTouchStart={() => voiceChatRef.current?.resumeAudioContext?.()}
      >
        <div className="game-header">
          <div className="game-info">
            <div className={`timer ${timeRemaining <= 10 ? 'warning' : ''}`}>
              {timeRemaining}s
            </div>
            <div className="word-display">{getWordDisplay()}</div>
          </div>
          <div className="header-controls">
            <div className="round-info">
              Round {currentRound} / {totalRounds * players.length}
              {roundWord && <span style={{ marginLeft: '10px', color: 'var(--success)' }}>Word: {roundWord}</span>}
            </div>
            {/* Mic Toggle Button */}
            <button 
              className={`header-mic-btn ${voiceState.isVoiceEnabled ? (voiceState.isMuted ? 'muted' : 'unmuted') : 'off'}`}
              onClick={() => {
                if (voiceState.isVoiceEnabled) {
                  voiceChatRef.current?.toggleMute()
                } else {
                  voiceChatRef.current?.joinVoice()
                }
              }}
              title={voiceState.isVoiceEnabled ? (voiceState.isMuted ? 'Unmute' : 'Mute') : 'Join Voice'}
            >
              {voiceState.isVoiceEnabled ? (
                voiceState.isMuted ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="1" y1="1" x2="23" y2="23"/>
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  </svg>
                )
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                </svg>
              )}
            </button>
            <button 
              className="leave-btn"
              onClick={leaveRoom}
              title="Leave game"
            >
              🚪 Exit
            </button>
          </div>
        </div>
        
        <div className="game-content">
          <div className="canvas-section">
            <div className="canvas-container">
              <canvas
                ref={canvasRef}
                className="drawing-canvas"
                onClick={isFillMode ? handleCanvasClick : undefined}
                onMouseDown={isFillMode ? undefined : startDrawing}
                onMouseMove={isFillMode ? undefined : draw}
                onMouseUp={isFillMode ? undefined : stopDrawing}
                onMouseLeave={isFillMode ? undefined : stopDrawing}
                onTouchStart={isFillMode ? handleCanvasClick : startDrawing}
                onTouchMove={isFillMode ? undefined : draw}
                onTouchEnd={isFillMode ? undefined : stopDrawing}
                style={{ cursor: isDrawer ? (isFillMode ? 'crosshair' : 'crosshair') : 'default' }}
              />
            </div>
            
            {isDrawer && (
              <div className="tools">
                {COLORS.map(c => (
                  <button
                    key={c}
                    className={`color-btn ${color === c && !isEraser && !isFillMode ? 'active' : ''}`}
                    style={{ backgroundColor: c, border: c === '#FFFFFF' ? '2px solid #ccc' : 'none' }}
                    onClick={() => { setColor(c); setIsEraser(false); setIsFillMode(false); }}
                  />
                ))}
                <button
                  className={`tool-btn ${isEraser ? 'active' : ''}`}
                  onClick={() => { setIsEraser(!isEraser); setIsFillMode(false); }}
                >
                  🧹 Eraser
                </button>
                <button
                  className={`tool-btn ${isFillMode ? 'active' : ''}`}
                  onClick={() => { setIsFillMode(!isFillMode); setIsEraser(false); }}
                >
                  🪣 Fill
                </button>
                <div className="size-slider">
                  <span>Size:</span>
                  <input
                    type="range"
                    min="2"
                    max="30"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                  />
                  <span>{brushSize}</span>
                </div>
                <button className="tool-btn" onClick={clearCanvas}>
                  🗑️ Clear
                </button>
              </div>
            )}
          </div>
          
          <div className="sidebar">
            <div className="players-sidebar">
              <h4>🏆 Leaderboard</h4>
              {[...players].sort((a, b) => b.score - a.score).map((player, index) => {
                const isSelf = player.id === playerId
                // For local player, check localAudioLevel; for others, check speakingPlayers
                const isSpeaking = isSelf 
                  ? (voiceState.isVoiceEnabled && !voiceState.isMuted && voiceState.localAudioLevel > 0.1)
                  : voiceState.speakingPlayers.includes(player.id)
                const isPlayerMuted = voiceState.mutedPlayers[player.id] || (isSelf && voiceState.isMuted)
                const isInVoice = voiceState.voiceConnected.includes(player.id) || (isSelf && voiceState.isVoiceEnabled)
                // Check if local user has muted this player's audio
                const isLocallyMuted = voiceState.locallyMutedPlayers?.includes(player.id) || false
                // For local player, use localAudioLevel; for others, use audioLevels
                const playerAudioLevel = isSelf ? voiceState.localAudioLevel : (voiceState.audioLevels[player.id] || 0)
                // Ranking medal
                const getRankBadge = (rank) => {
                  if (rank === 0) return <span className="rank-badge gold">🥇</span>
                  if (rank === 1) return <span className="rank-badge silver">🥈</span>
                  if (rank === 2) return <span className="rank-badge bronze">🥉</span>
                  return <span className="rank-badge">#{rank + 1}</span>
                }
                
                return (
                  <div 
                    key={player.id} 
                    className={`sidebar-player ${player.id === drawerId ? 'drawing' : ''} ${player.hasGuessedCorrectly ? 'guessed' : ''} ${isSpeaking ? 'speaking' : ''} ${index === 0 && player.score > 0 ? 'leader' : ''}`}
                  >
                    <div className="player-main-info">
                      <div className="player-left-section">
                        {getRankBadge(index)}
                        {/* Waveform */}
                        {isInVoice && (
                          <AudioWaveform 
                            audioLevel={playerAudioLevel}
                            isActive={isSpeaking}
                            isMuted={isPlayerMuted || isLocallyMuted}
                            barCount={5}
                          />
                        )}
                        <span className="player-name-section">
                          {player.id === hostId && <span className="host-crown" title="Host">👑</span>}
                          {player.id === drawerId && '🎨 '}
                          {player.hasGuessedCorrectly && '✅ '}
                          {player.name}
                          {isSelf && <span className="you-badge">(You)</span>}
                          {isPlayerMuted && isInVoice && (
                            <span className="muted-badge" title="Player is muted">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                                <line x1="1" y1="1" x2="23" y2="23"/>
                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
                              </svg>
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="player-right-section">
                        {/* Individual audio control - any player can mute/unmute audio from others */}
                        {!isSelf && isInVoice && voiceState.isVoiceEnabled && (
                          <button 
                            className={`sidebar-mute-btn ${isLocallyMuted ? 'locally-muted' : ''}`}
                            onClick={() => voiceChatRef.current?.togglePlayerAudio(player.id)}
                            title={isLocallyMuted ? 'Click to hear this player' : 'Click to mute this player'}
                          >
                            {isLocallyMuted ? '🔇' : '🔊'}
                          </button>
                        )}
                        <span className="player-score">{player.score} pts</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            
            <div className="chat-section">
              <div className="chat-messages">
                {messages.map((msg, i) => (
                  <div 
                    key={`${msg.id}-${i}`}
                    className={`chat-message ${msg.isSystem ? 'system' : ''} ${msg.isCorrect ? 'correct' : ''}`}
                  >
                    {!msg.isSystem && <span className="sender">{msg.name}: </span>}
                    {msg.text}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              
              {!isDrawer && (
                <div className="chat-input">
                  <input
                    type="text"
                    placeholder="Type your guess..."
                    value={guessInput}
                    onChange={(e) => setGuessInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    maxLength={50}
                  />
                  <button onClick={sendGuess}>Send</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Voice Chat */}
      <VoiceChat
        ref={voiceChatRef}
        socket={socket}
        roomId={roomCode}
        playerId={playerId}
        players={players}
        isHost={isHost}
        hostId={hostId}
        onStateChange={handleVoiceStateChange}
      />

      {showResults && (
        <div className="modal-overlay" onClick={() => setShowResults(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>🏆 Game Over!</h2>
            <div className="final-scores">
              {finalScores.map((player, i) => (
                <div key={player.id} className="score-item">
                  <span className="rank">#{i + 1}</span>
                  <span className="name">{player.name}</span>
                  <span className="points">{player.score} pts</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => { setShowResults(false); setScreen(SCREENS.LOBBY); }}>
              Back to Lobby
            </button>
          </div>
        </div>
      )}
      </div>
    </ClickSpark>
  )
}

export default App
