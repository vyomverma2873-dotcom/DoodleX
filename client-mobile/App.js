import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Clipboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';
import { io } from 'socket.io-client';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  State,
} from 'react-native-gesture-handler';

// Configuration
const SERVER_URL = 'http://localhost:3001'; // Change this to your server URL
const COLORS = ['#212121', '#F44336', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#FFFFFF'];
const SCREENS = { HOME: 'home', LOBBY: 'lobby', GAME: 'game' };

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function App() {
  const [screen, setScreen] = useState(SCREENS.HOME);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Player state
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');

  // Room state
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);

  // Game state
  const [stage, setStage] = useState('lobby');
  const [drawerId, setDrawerId] = useState(null);
  const [secretWord, setSecretWord] = useState(null);
  const [wordLength, setWordLength] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(3);
  const [messages, setMessages] = useState([]);
  const [guessInput, setGuessInput] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [finalScores, setFinalScores] = useState([]);
  const [roundWord, setRoundWord] = useState(null);

  // Drawing state
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(5);
  const [isEraser, setIsEraser] = useState(false);
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);

  // Refs
  const timerRef = useRef(null);
  const scrollViewRef = useRef(null);
  const strokeThrottleRef = useRef(null);
  const canvasLayoutRef = useRef({ x: 0, y: 0, width: 300, height: 300 });

  // Initialize socket
  useEffect(() => {
    const newSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      setConnected(true);
      setError('');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('connect_error', () => {
      setError('Cannot connect to server');
    });

    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('roomUpdate', (data) => {
      setPlayers(data.players);
      setStage(data.stage);
      setIsHost(data.hostId === playerId);
    });

    socket.on('roundStarted', (data) => {
      setStage('drawing');
      setDrawerId(data.drawerId);
      setSecretWord(data.word);
      setWordLength(data.wordLength);
      setTimeRemaining(data.timeLimit);
      setCurrentRound(data.round);
      setTotalRounds(data.totalRounds);
      setScreen(SCREENS.GAME);
      setRoundWord(null);
      setPaths([]);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);

      addMessage({
        id: 'system',
        name: 'System',
        text: `Round ${data.round}! ${data.drawerName} is drawing.`,
        isSystem: true,
      });
    });

    socket.on('stroke', ({ stroke }) => {
      setPaths((prev) => [...prev, stroke]);
    });

    socket.on('clearCanvas', () => {
      setPaths([]);
    });

    socket.on('chat', (msg) => {
      addMessage(msg);
    });

    socket.on('correctGuess', (data) => {
      addMessage({
        id: 'correct',
        name: 'System',
        text: `🎉 ${data.name} guessed! +${data.pointsAwarded}`,
        isSystem: true,
        isCorrect: true,
      });
    });

    socket.on('roundEnded', (data) => {
      setStage('waiting');
      setRoundWord(data.word);
      setPlayers(data.scores);
      if (timerRef.current) clearInterval(timerRef.current);

      addMessage({
        id: 'system',
        name: 'System',
        text: `Word was "${data.word}"`,
        isSystem: true,
      });
    });

    socket.on('gameOver', (data) => {
      setFinalScores(data.finalScores);
      setShowResults(true);
      setStage('lobby');
      if (timerRef.current) clearInterval(timerRef.current);
    });

    socket.on('error', (err) => {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      socket.off('roomUpdate');
      socket.off('roundStarted');
      socket.off('stroke');
      socket.off('clearCanvas');
      socket.off('chat');
      socket.off('correctGuess');
      socket.off('roundEnded');
      socket.off('gameOver');
      socket.off('error');
    };
  }, [socket, playerId]);

  const addMessage = (msg) => {
    setMessages((prev) => [...prev.slice(-50), { ...msg, ts: Date.now() }]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const createRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    setLoading(true);
    socket.emit('createRoom', { name: playerName.trim() }, (response) => {
      setLoading(false);
      if (response.success) {
        setPlayerId(response.playerId);
        setRoomCode(response.roomId);
        setPlayers(response.room.players);
        setIsHost(true);
        setScreen(SCREENS.LOBBY);
      } else {
        setError(response.error?.message || 'Failed to create room');
      }
    });
  };

  const joinRoom = () => {
    if (!playerName.trim() || !joinRoomCode.trim()) {
      setError('Please enter name and room code');
      return;
    }
    setLoading(true);
    socket.emit('joinRoom', { roomId: joinRoomCode.trim().toUpperCase(), name: playerName.trim() }, (response) => {
      setLoading(false);
      if (response.success) {
        setPlayerId(response.playerId);
        setRoomCode(response.roomId);
        setPlayers(response.room.players);
        setIsHost(response.room.hostId === response.playerId);
        
        if (response.room.strokes?.length > 0) {
          setPaths(response.room.strokes);
        }
        
        if (response.room.stage === 'drawing') {
          setDrawerId(response.room.drawerId);
          setTimeRemaining(response.room.timeRemaining || 0);
          setScreen(SCREENS.GAME);
        } else {
          setScreen(SCREENS.LOBBY);
        }
      } else {
        setError(response.error?.message || 'Failed to join room');
      }
    });
  };

  const startGame = () => {
    if (!isHost) return;
    socket.emit('startRound', { roomId: roomCode, difficulty: 'medium' }, (response) => {
      if (!response?.success) {
        setError(response?.error?.message || 'Failed to start');
      }
    });
  };

  const leaveRoom = () => {
    socket.emit('leaveRoom', { roomId: roomCode });
    setScreen(SCREENS.HOME);
    setPlayers([]);
    setMessages([]);
    setRoomCode('');
    setPaths([]);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const copyRoomCode = () => {
    Clipboard.setString(roomCode);
    Alert.alert('Copied!', 'Room code copied to clipboard');
  };

  const sendGuess = () => {
    if (!guessInput.trim() || drawerId === playerId) return;
    socket.emit('guess', { roomId: roomCode, text: guessInput.trim() });
    setGuessInput('');
    Keyboard.dismiss();
  };

  const clearCanvas = () => {
    if (drawerId !== playerId && !isHost) return;
    socket.emit('clearCanvas', { roomId: roomCode });
  };

  const isDrawer = drawerId === playerId;

  const getWordDisplay = () => {
    if (isDrawer && secretWord) return secretWord.toUpperCase();
    return '_ '.repeat(wordLength).trim();
  };

  // Drawing handlers
  const onGestureEvent = useCallback((event) => {
    if (!isDrawer) return;

    const { x, y } = event.nativeEvent;
    const layout = canvasLayoutRef.current;
    const normX = x / layout.width;
    const normY = y / layout.height;

    if (currentPath) {
      const updatedPath = {
        ...currentPath,
        points: [...currentPath.points, [normX, normY]],
      };
      setCurrentPath(updatedPath);

      if (!strokeThrottleRef.current) {
        strokeThrottleRef.current = setTimeout(() => {
          socket.emit('stroke', { roomId: roomCode, stroke: updatedPath });
          strokeThrottleRef.current = null;
        }, 50);
      }
    }
  }, [isDrawer, currentPath, roomCode, socket]);

  const onHandlerStateChange = useCallback((event) => {
    if (!isDrawer) return;

    const { state, x, y } = event.nativeEvent;
    const layout = canvasLayoutRef.current;
    const normX = x / layout.width;
    const normY = y / layout.height;

    if (state === State.BEGAN) {
      const newPath = {
        id: `${playerId}-${Date.now()}`,
        color: isEraser ? '#FFFFFF' : color,
        width: brushSize,
        points: [[normX, normY]],
        ts: Date.now(),
      };
      setCurrentPath(newPath);
    } else if (state === State.END || state === State.CANCELLED) {
      if (currentPath) {
        setPaths((prev) => [...prev, currentPath]);
        socket.emit('stroke', { roomId: roomCode, stroke: currentPath });
        setCurrentPath(null);
      }
      if (strokeThrottleRef.current) {
        clearTimeout(strokeThrottleRef.current);
        strokeThrottleRef.current = null;
      }
    }
  }, [isDrawer, playerId, color, brushSize, isEraser, currentPath, roomCode, socket]);

  const pathToSvg = (stroke) => {
    if (!stroke.points || stroke.points.length < 2) return '';
    const layout = canvasLayoutRef.current;
    let d = `M ${stroke.points[0][0] * layout.width} ${stroke.points[0][1] * layout.height}`;
    for (let i = 1; i < stroke.points.length; i++) {
      d += ` L ${stroke.points[i][0] * layout.width} ${stroke.points[i][1] * layout.height}`;
    }
    return d;
  };

  // HOME SCREEN
  if (screen === SCREENS.HOME) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.homeContainer}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>DoodleX</Text>
            <Text style={styles.tagline}>Draw, Guess, Enjoy!</Text>
          </View>

          <View style={styles.card}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Text style={styles.label}>Your Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              value={playerName}
              onChangeText={setPlayerName}
              maxLength={20}
            />

            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, (!connected || loading) && styles.btnDisabled]}
              onPress={createRoom}
              disabled={!connected || loading}
            >
              <Text style={styles.btnText}>{loading ? 'Creating...' : 'Create Room'}</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.label}>Room Code</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter room code"
              value={joinRoomCode}
              onChangeText={(t) => setJoinRoomCode(t.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary, (!connected || loading) && styles.btnDisabled]}
              onPress={joinRoom}
              disabled={!connected || loading}
            >
              <Text style={styles.btnText}>{loading ? 'Joining...' : 'Join Room'}</Text>
            </TouchableOpacity>

            {!connected && <Text style={styles.connectingText}>Connecting to server...</Text>}
          </View>
        </View>
      </GestureHandlerRootView>
    );
  }

  // LOBBY SCREEN
  if (screen === SCREENS.LOBBY) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.lobbyContainer}>
          <Text style={styles.lobbyTitle}>DoodleX</Text>

          <View style={styles.card}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.roomCodeSection}>
              <Text style={styles.roomCodeLabel}>Room Code</Text>
              <Text style={styles.roomCodeValue}>{roomCode}</Text>
              <TouchableOpacity style={styles.copyBtn} onPress={copyRoomCode}>
                <Text style={styles.copyBtnText}>📋 Copy</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.playersTitle}>Players ({players.length}/10)</Text>
            <ScrollView style={styles.playerList}>
              {players.map((p) => (
                <View key={p.id} style={[styles.playerItem, p.isHost && styles.playerItemHost]}>
                  <View style={styles.playerInfo}>
                    <View style={styles.playerAvatar}>
                      <Text style={styles.playerAvatarText}>{p.name[0].toUpperCase()}</Text>
                    </View>
                    <Text style={styles.playerName}>{p.name}</Text>
                    {p.isHost && <Text style={styles.hostBadge}>👑</Text>}
                  </View>
                  <Text style={styles.playerScore}>{p.score} pts</Text>
                </View>
              ))}
            </ScrollView>

            {isHost ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, players.length < 2 && styles.btnDisabled]}
                onPress={startGame}
                disabled={players.length < 2}
              >
                <Text style={styles.btnText}>{players.length < 2 ? 'Need 2+ Players' : 'Start Game'}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.waitingText}>Waiting for host to start...</Text>
            )}

            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={leaveRoom}>
              <Text style={styles.btnText}>Leave Room</Text>
            </TouchableOpacity>
          </View>
        </View>
      </GestureHandlerRootView>
    );
  }

  // GAME SCREEN
  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.gameContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={styles.gameHeader}>
          <View style={[styles.timer, timeRemaining <= 10 && styles.timerWarning]}>
            <Text style={styles.timerText}>{timeRemaining}s</Text>
          </View>
          <Text style={styles.wordDisplay}>{getWordDisplay()}</Text>
          <Text style={styles.roundInfo}>
            R{currentRound}/{totalRounds * players.length}
          </Text>
        </View>

        {/* Canvas */}
        <View
          style={styles.canvasContainer}
          onLayout={(e) => {
            canvasLayoutRef.current = e.nativeEvent.layout;
          }}
        >
          <PanGestureHandler
            onGestureEvent={onGestureEvent}
            onHandlerStateChange={onHandlerStateChange}
            enabled={isDrawer}
          >
            <View style={styles.canvas}>
              <Svg style={StyleSheet.absoluteFill}>
                {paths.map((stroke, i) => (
                  <Path
                    key={`${stroke.id}-${i}`}
                    d={pathToSvg(stroke)}
                    stroke={stroke.color}
                    strokeWidth={stroke.width}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {currentPath && (
                  <Path
                    d={pathToSvg(currentPath)}
                    stroke={currentPath.color}
                    strokeWidth={currentPath.width}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </Svg>
            </View>
          </PanGestureHandler>
        </View>

        {/* Tools */}
        {isDrawer && (
          <View style={styles.tools}>
            <View style={styles.colorPicker}>
              {COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorBtn,
                    { backgroundColor: c },
                    color === c && !isEraser && styles.colorBtnActive,
                    c === '#FFFFFF' && styles.colorBtnWhite,
                  ]}
                  onPress={() => {
                    setColor(c);
                    setIsEraser(false);
                  }}
                />
              ))}
            </View>
            <View style={styles.toolBtns}>
              <TouchableOpacity
                style={[styles.toolBtn, isEraser && styles.toolBtnActive]}
                onPress={() => setIsEraser(!isEraser)}
              >
                <Text style={styles.toolBtnText}>🧹</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolBtn} onPress={clearCanvas}>
                <Text style={styles.toolBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Chat */}
        <View style={styles.chatSection}>
          <ScrollView ref={scrollViewRef} style={styles.chatMessages}>
            {messages.map((msg, i) => (
              <View
                key={`${msg.id}-${i}`}
                style={[styles.chatMessage, msg.isSystem && styles.chatMessageSystem, msg.isCorrect && styles.chatMessageCorrect]}
              >
                <Text style={styles.chatText}>
                  {!msg.isSystem && <Text style={styles.chatSender}>{msg.name}: </Text>}
                  {msg.text}
                </Text>
              </View>
            ))}
          </ScrollView>

          {!isDrawer && (
            <View style={styles.chatInput}>
              <TextInput
                style={styles.chatInputField}
                placeholder="Type your guess..."
                value={guessInput}
                onChangeText={setGuessInput}
                onSubmitEditing={sendGuess}
                returnKeyType="send"
              />
              <TouchableOpacity style={styles.chatSendBtn} onPress={sendGuess}>
                <Text style={styles.chatSendBtnText}>Send</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Results Modal */}
        {showResults && (
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>🏆 Game Over!</Text>
              {finalScores.map((p, i) => (
                <View key={p.id} style={[styles.scoreItem, i === 0 && styles.scoreItemFirst]}>
                  <Text style={styles.scoreRank}>#{i + 1}</Text>
                  <Text style={styles.scoreName}>{p.name}</Text>
                  <Text style={styles.scorePoints}>{p.score}</Text>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => {
                  setShowResults(false);
                  setScreen(SCREENS.LOBBY);
                }}
              >
                <Text style={styles.btnText}>Back to Lobby</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FF7043' },
  homeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  logo: { alignItems: 'center', marginBottom: 30 },
  logoText: { fontSize: 48, fontWeight: 'bold', color: '#FFF', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4 },
  tagline: { fontSize: 18, color: '#FFEB3B', marginTop: 5 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 25, width: '100%', maxWidth: 400, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  label: { fontSize: 14, fontWeight: '600', color: '#6D4C41', marginBottom: 8 },
  input: { backgroundColor: '#F5F5F5', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 15, borderWidth: 2, borderColor: '#E0E0E0' },
  btn: { padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnPrimary: { backgroundColor: '#FF7043' },
  btnSecondary: { backgroundColor: '#6D4C41' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  dividerText: { paddingHorizontal: 15, color: '#757575' },
  errorText: { backgroundColor: '#FFEBEE', color: '#F44336', padding: 12, borderRadius: 8, marginBottom: 15, textAlign: 'center' },
  connectingText: { textAlign: 'center', marginTop: 15, color: '#999' },
  lobbyContainer: { flex: 1, alignItems: 'center', padding: 20, paddingTop: 60 },
  lobbyTitle: { fontSize: 32, fontWeight: 'bold', color: '#FFF', marginBottom: 20 },
  roomCodeSection: { alignItems: 'center', marginBottom: 20 },
  roomCodeLabel: { fontSize: 14, color: '#757575' },
  roomCodeValue: { fontSize: 36, fontWeight: '800', color: '#FF7043', letterSpacing: 6, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  copyBtn: { marginTop: 10, padding: 8, backgroundColor: '#F5F5F5', borderRadius: 8 },
  copyBtnText: { fontSize: 14 },
  playersTitle: { fontSize: 16, fontWeight: '600', color: '#6D4C41', marginBottom: 10 },
  playerList: { maxHeight: 200 },
  playerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 12, borderRadius: 10, marginBottom: 8 },
  playerItemHost: { backgroundColor: '#FFF3E0' },
  playerInfo: { flexDirection: 'row', alignItems: 'center' },
  playerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF7043', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  playerAvatarText: { color: '#FFF', fontWeight: '600' },
  playerName: { fontWeight: '500' },
  hostBadge: { marginLeft: 5 },
  playerScore: { fontWeight: '600', color: '#FF7043' },
  waitingText: { textAlign: 'center', color: '#666', marginVertical: 10 },
  gameContainer: { flex: 1, backgroundColor: '#F5F5F5' },
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  timer: { backgroundColor: '#F5F5F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  timerWarning: { backgroundColor: '#FFEBEE' },
  timerText: { fontSize: 18, fontWeight: '700', color: '#FF7043' },
  wordDisplay: { fontSize: 16, color: '#6D4C41', letterSpacing: 4 },
  roundInfo: { fontSize: 12, color: '#757575' },
  canvasContainer: { flex: 1, margin: 10, backgroundColor: '#FFF', borderRadius: 15, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  canvas: { flex: 1, backgroundColor: '#FFF' },
  tools: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#FFF' },
  colorPicker: { flexDirection: 'row', gap: 8 },
  colorBtn: { width: 32, height: 32, borderRadius: 16 },
  colorBtnActive: { borderWidth: 3, borderColor: '#212121' },
  colorBtnWhite: { borderWidth: 1, borderColor: '#CCC' },
  toolBtns: { flexDirection: 'row', gap: 10 },
  toolBtn: { padding: 8, backgroundColor: '#F5F5F5', borderRadius: 8 },
  toolBtnActive: { backgroundColor: '#FF7043' },
  toolBtnText: { fontSize: 20 },
  chatSection: { height: 180, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  chatMessages: { flex: 1, padding: 10 },
  chatMessage: { backgroundColor: '#F5F5F5', padding: 8, borderRadius: 8, marginBottom: 6 },
  chatMessageSystem: { backgroundColor: '#E3F2FD' },
  chatMessageCorrect: { backgroundColor: '#E8F5E9' },
  chatText: { fontSize: 14 },
  chatSender: { fontWeight: '600', color: '#FF7043' },
  chatInput: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  chatInputField: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 10 },
  chatSendBtn: { backgroundColor: '#FF7043', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, justifyContent: 'center' },
  chatSendBtnText: { color: '#FFF', fontWeight: '600' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#FFF', borderRadius: 20, padding: 25, width: '85%', maxWidth: 350 },
  modalTitle: { fontSize: 24, fontWeight: '700', color: '#FF7043', textAlign: 'center', marginBottom: 20 },
  scoreItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F5F5F5', borderRadius: 10, marginBottom: 8 },
  scoreItemFirst: { backgroundColor: '#FFF8E1' },
  scoreRank: { width: 30, fontWeight: '700', color: '#FF7043' },
  scoreName: { flex: 1, fontWeight: '500' },
  scorePoints: { fontWeight: '700', color: '#6D4C41' },
});
