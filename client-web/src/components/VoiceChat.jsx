import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import './VoiceChat.css'

// WebRTC configuration with public STUN servers
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
}

const VoiceChat = forwardRef(({ 
  socket, 
  roomId, 
  playerId, 
  players, 
  isHost, 
  hostId,
  onStateChange 
}, ref) => {
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [speakingPlayers, setSpeakingPlayers] = useState(new Set())
  const [audioLevels, setAudioLevels] = useState(new Map()) // playerId -> audioLevel (0-1)
  const [mutedPlayers, setMutedPlayers] = useState(new Map())
  const [voiceConnected, setVoiceConnected] = useState(new Set())
  const [micPermission, setMicPermission] = useState('unknown')
  const [showVoicePanel, setShowVoicePanel] = useState(false)
  const [localAudioLevel, setLocalAudioLevel] = useState(0)
  const [locallyMutedPlayers, setLocallyMutedPlayers] = useState(new Set()) // Players this user has chosen not to hear
  const [isJoiningVoice, setIsJoiningVoice] = useState(false) // Loading state for joining voice
  
  const localStreamRef = useRef(null)
  const peerConnectionsRef = useRef(new Map())
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const speakingCheckIntervalRef = useRef(null)
  const isMutedRef = useRef(isMuted)

  // Keep refs in sync with state
  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }
    
    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => {
      pc.close()
    })
    peerConnectionsRef.current.clear()
    
    // Clear speaking check interval
    if (speakingCheckIntervalRef.current) {
      clearInterval(speakingCheckIntervalRef.current)
      speakingCheckIntervalRef.current = null
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    setVoiceConnected(new Set())
    setSpeakingPlayers(new Set())
  }, [])

  // Get user media and set up audio analysis
  const initializeVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      
      localStreamRef.current = stream
      setMicPermission('granted')
      
      // Set up audio analysis for speaking detection
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)
      
      // Check speaking status and audio levels periodically
      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      let wasSpeaking = false
      
      speakingCheckIntervalRef.current = setInterval(() => {
        // Use refs to get current mute state (avoids stale closure)
        if (!analyserRef.current || isMutedRef.current) {
          if (wasSpeaking) {
            wasSpeaking = false
            socket.emit('voiceSpeaking', { roomId, isSpeaking: false, audioLevel: 0 })
          }
          setLocalAudioLevel(0)
          return
        }
        
        analyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength
        const normalizedLevel = Math.min(average / 128, 1) // Normalize to 0-1
        const isSpeaking = average > 20 // Threshold for speaking detection
        
        setLocalAudioLevel(normalizedLevel)
        
        // Always emit audio level when speaking (for waveform visualization)
        if (isSpeaking || wasSpeaking) {
          socket.emit('voiceSpeaking', { roomId, isSpeaking, audioLevel: normalizedLevel })
        }
        
        wasSpeaking = isSpeaking
      }, 50) // Faster update rate for smooth waveform animation
      
      // Start muted by default
      stream.getAudioTracks().forEach(track => {
        track.enabled = false
      })
      
      return stream
    } catch (err) {
      console.error('Failed to get microphone access:', err)
      setMicPermission('denied')
      throw err
    }
  }, [socket, roomId])

  // Create peer connection to another player
  const createPeerConnection = useCallback((targetId) => {
    if (peerConnectionsRef.current.has(targetId)) {
      return peerConnectionsRef.current.get(targetId)
    }
    
    const pc = new RTCPeerConnection(RTC_CONFIG)
    
    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current)
      })
    }
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('voiceIceCandidate', {
          roomId,
          targetId,
          candidate: event.candidate
        })
      }
    }
    
    // Handle incoming audio
    pc.ontrack = (event) => {
      const audio = new Audio()
      audio.srcObject = event.streams[0]
      audio.autoplay = true
      audio.id = `audio-${targetId}`
      
      // Remove existing audio element if any
      const existing = document.getElementById(`audio-${targetId}`)
      if (existing) existing.remove()
      
      document.body.appendChild(audio)
      
      setVoiceConnected(prev => new Set([...prev, targetId]))
    }
    
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        const audio = document.getElementById(`audio-${targetId}`)
        if (audio) audio.remove()
        
        setVoiceConnected(prev => {
          const newSet = new Set(prev)
          newSet.delete(targetId)
          return newSet
        })
      }
    }
    
    peerConnectionsRef.current.set(targetId, pc)
    return pc
  }, [socket, roomId])

  // Join voice chat
  const joinVoice = useCallback(async () => {
    setIsJoiningVoice(true)
    try {
      await initializeVoice()
      setIsVoiceEnabled(true)
      
      // Notify server that we're joining voice
      socket.emit('voiceJoin', { roomId })
      
      // Create offers to all existing players
      const otherPlayers = players.filter(p => p.id !== playerId)
      for (const player of otherPlayers) {
        const pc = createPeerConnection(player.id)
        try {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          socket.emit('voiceOffer', {
            roomId,
            targetId: player.id,
            offer
          })
        } catch (err) {
          console.error('Failed to create offer for', player.id, err)
        }
      }
    } catch (err) {
      console.error('Failed to join voice:', err)
    } finally {
      setIsJoiningVoice(false)
    }
  }, [initializeVoice, socket, roomId, players, playerId, createPeerConnection])

  // Leave voice chat
  const leaveVoice = useCallback(() => {
    socket.emit('voiceLeave', { roomId })
    cleanup()
    setIsVoiceEnabled(false)
    setIsMuted(true)
  }, [socket, roomId, cleanup])

  // Toggle mute
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted
    setIsMuted(newMuted)
    
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMuted
      })
    }
    
    socket.emit('voiceMuteStatus', { roomId, isMuted: newMuted })
  }, [isMuted, socket, roomId])

  // Toggle listening to a specific player's audio (local control only)
  const togglePlayerAudio = useCallback((targetPlayerId) => {
    setLocallyMutedPlayers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(targetPlayerId)) {
        newSet.delete(targetPlayerId)
        // Unmute the audio element
        const audio = document.getElementById(`audio-${targetPlayerId}`)
        if (audio) audio.muted = false
      } else {
        newSet.add(targetPlayerId)
        // Mute the audio element
        const audio = document.getElementById(`audio-${targetPlayerId}`)
        if (audio) audio.muted = true
      }
      return newSet
    })
  }, [])

  // Socket event handlers
  useEffect(() => {
    if (!socket) return

    // Handle incoming voice offer
    const handleVoiceOffer = async ({ fromId, offer }) => {
      if (!isVoiceEnabled) return
      
      const pc = createPeerConnection(fromId)
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('voiceAnswer', {
          roomId,
          targetId: fromId,
          answer
        })
      } catch (err) {
        console.error('Failed to handle voice offer:', err)
      }
    }

    // Handle incoming voice answer
    const handleVoiceAnswer = async ({ fromId, answer }) => {
      const pc = peerConnectionsRef.current.get(fromId)
      if (!pc) return
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
      } catch (err) {
        console.error('Failed to handle voice answer:', err)
      }
    }

    // Handle ICE candidate
    const handleIceCandidate = async ({ fromId, candidate }) => {
      const pc = peerConnectionsRef.current.get(fromId)
      if (!pc) return
      
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (err) {
        console.error('Failed to add ICE candidate:', err)
      }
    }

    // Handle mute status
    const handleMuteStatus = ({ playerId: mutedId, isMuted: muted }) => {
      setMutedPlayers(prev => {
        const newMap = new Map(prev)
        newMap.set(mutedId, muted)
        return newMap
      })
    }

    // Handle speaking status and audio levels
    const handleSpeaking = ({ playerId: speakingId, isSpeaking, audioLevel = 0 }) => {
      setSpeakingPlayers(prev => {
        const newSet = new Set(prev)
        if (isSpeaking) {
          newSet.add(speakingId)
        } else {
          newSet.delete(speakingId)
        }
        return newSet
      })
      
      // Update audio levels
      setAudioLevels(prev => {
        const newMap = new Map(prev)
        if (isSpeaking && audioLevel > 0) {
          newMap.set(speakingId, audioLevel)
        } else {
          newMap.delete(speakingId)
        }
        return newMap
      })
    }

    // Handle new player joining voice
    const handleVoiceJoin = async ({ playerId: joinedId }) => {
      if (!isVoiceEnabled || joinedId === playerId) return
      
      // Create offer to newly joined player
      const pc = createPeerConnection(joinedId)
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('voiceOffer', {
          roomId,
          targetId: joinedId,
          offer
        })
      } catch (err) {
        console.error('Failed to create offer for new player:', err)
      }
    }

    // Handle player leaving voice
    const handleVoiceLeave = ({ playerId: leftId }) => {
      const pc = peerConnectionsRef.current.get(leftId)
      if (pc) {
        pc.close()
        peerConnectionsRef.current.delete(leftId)
      }
      
      const audio = document.getElementById(`audio-${leftId}`)
      if (audio) audio.remove()
      
      setVoiceConnected(prev => {
        const newSet = new Set(prev)
        newSet.delete(leftId)
        return newSet
      })
      
      setSpeakingPlayers(prev => {
        const newSet = new Set(prev)
        newSet.delete(leftId)
        return newSet
      })
      
      setAudioLevels(prev => {
        const newMap = new Map(prev)
        newMap.delete(leftId)
        return newMap
      })
    }

    socket.on('voiceOffer', handleVoiceOffer)
    socket.on('voiceAnswer', handleVoiceAnswer)
    socket.on('voiceIceCandidate', handleIceCandidate)
    socket.on('voiceMuteStatus', handleMuteStatus)
    socket.on('voiceSpeaking', handleSpeaking)
    socket.on('voiceJoin', handleVoiceJoin)
    socket.on('voiceLeave', handleVoiceLeave)

    return () => {
      socket.off('voiceOffer', handleVoiceOffer)
      socket.off('voiceAnswer', handleVoiceAnswer)
      socket.off('voiceIceCandidate', handleIceCandidate)
      socket.off('voiceMuteStatus', handleMuteStatus)
      socket.off('voiceSpeaking', handleSpeaking)
      socket.off('voiceJoin', handleVoiceJoin)
      socket.off('voiceLeave', handleVoiceLeave)
    }
  }, [socket, roomId, playerId, isVoiceEnabled, createPeerConnection])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  // Expose methods and state via ref for parent component access
  useImperativeHandle(ref, () => ({
    isVoiceEnabled,
    isMuted,
    micPermission,
    speakingPlayers,
    mutedPlayers,
    voiceConnected,
    locallyMutedPlayers,
    isJoiningVoice,
    joinVoice,
    leaveVoice,
    toggleMute,
    togglePlayerAudio,
    getPlayerVoiceStatus: (player) => {
      const isSelf = player.id === playerId
      const isConnected = isSelf ? isVoiceEnabled : voiceConnected.has(player.id)
      const playerMuted = isSelf ? isMuted : mutedPlayers.get(player.id)
      const playerSpeaking = isSelf ? false : speakingPlayers.has(player.id)
      const isLocallyMuted = locallyMutedPlayers.has(player.id)
      return { isConnected, playerMuted, playerSpeaking, isLocallyMuted }
    }
  }), [isVoiceEnabled, isMuted, micPermission, speakingPlayers, mutedPlayers, voiceConnected, locallyMutedPlayers, isJoiningVoice, joinVoice, leaveVoice, toggleMute, togglePlayerAudio, playerId])

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange) {
      // Build audio levels object including local level
      const audioLevelsObj = Object.fromEntries(audioLevels)
      if (isVoiceEnabled && !isMuted && localAudioLevel > 0) {
        audioLevelsObj[playerId] = localAudioLevel
      }
      
      onStateChange({
        isVoiceEnabled,
        isMuted,
        speakingPlayers: Array.from(speakingPlayers),
        mutedPlayers: Object.fromEntries(mutedPlayers),
        voiceConnected: Array.from(voiceConnected),
        locallyMutedPlayers: Array.from(locallyMutedPlayers),
        audioLevels: audioLevelsObj,
        localAudioLevel
      })
    }
  }, [isVoiceEnabled, isMuted, speakingPlayers, mutedPlayers, voiceConnected, locallyMutedPlayers, audioLevels, localAudioLevel, onStateChange, playerId])

  // Get player speaking/mute status for UI
  const getPlayerVoiceStatus = (player) => {
    const isSelf = player.id === playerId
    const isConnected = isSelf ? isVoiceEnabled : voiceConnected.has(player.id)
    const playerMuted = isSelf ? isMuted : mutedPlayers.get(player.id)
    const playerSpeaking = isSelf ? false : speakingPlayers.has(player.id)
    
    return { isConnected, playerMuted, playerSpeaking }
  }

  return null // UI is handled by App.jsx header - this component only manages voice state
}
)

export default VoiceChat
