import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import './VoiceChat.css'

// WebRTC configuration with STUN and free TURN servers for mobile NAT traversal
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Free TURN servers for better mobile connectivity
    { 
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
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
  const isVoiceEnabledRef = useRef(isVoiceEnabled) // Ref for voice enabled state
  const pendingOffersRef = useRef(new Map()) // Track pending offers to avoid collisions
  const pendingIceCandidatesRef = useRef(new Map()) // Queue ICE candidates until remote description is set

  // Keep refs in sync with state
  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])
  
  useEffect(() => {
    isVoiceEnabledRef.current = isVoiceEnabled
  }, [isVoiceEnabled])

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

  // Resume audio context and pending audio on mobile (handles iOS restrictions)
  const resumeAudioContext = useCallback(async () => {
    // Resume audio context if suspended
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume()
        console.log('Audio context resumed')
      } catch (err) {
        console.error('Failed to resume audio context:', err)
      }
    }
    
    // Try to play any audio elements that were blocked
    document.querySelectorAll('audio[data-needs-play="true"]').forEach(audio => {
      audio.play().then(() => {
        audio.dataset.needsPlay = 'false'
      }).catch(err => {
        console.log('Still cannot play audio:', err)
      })
    })
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
      
      // Create audio context with mobile-compatible settings
      const AudioContext = window.AudioContext || window.webkitAudioContext
      audioContextRef.current = new AudioContext()
      
      // Resume audio context if suspended (iOS requirement)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }
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
    // Return existing connection if available and not closed
    if (peerConnectionsRef.current.has(targetId)) {
      const existingPc = peerConnectionsRef.current.get(targetId)
      if (existingPc.connectionState !== 'closed' && existingPc.connectionState !== 'failed') {
        return existingPc
      }
      // Clean up old connection
      existingPc.close()
      peerConnectionsRef.current.delete(targetId)
    }
    
    console.log(`[VoiceChat] Creating peer connection to ${targetId}`)
    const pc = new RTCPeerConnection(RTC_CONFIG)
    
    // Add local stream tracks
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getTracks()
      console.log(`[VoiceChat] Adding ${tracks.length} tracks to peer connection`)
      tracks.forEach(track => {
        pc.addTrack(track, localStreamRef.current)
      })
    } else {
      console.warn('[VoiceChat] No local stream available when creating peer connection')
    }
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[VoiceChat] Sending ICE candidate to ${targetId}`)
        socket.emit('voiceIceCandidate', {
          roomId,
          targetId,
          candidate: event.candidate
        })
      }
    }
    
    // Log ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log(`[VoiceChat] ICE connection state with ${targetId}: ${pc.iceConnectionState}`)
    }
    
    // Handle incoming audio with mobile-compatible settings
    pc.ontrack = (event) => {
      console.log(`[VoiceChat] Received audio track from ${targetId}`, event.streams)
      
      // Remove existing audio element if any
      const existing = document.getElementById(`audio-${targetId}`)
      if (existing) {
        existing.srcObject = null
        existing.remove()
      }
      
      const audio = document.createElement('audio')
      audio.id = `audio-${targetId}`
      audio.srcObject = event.streams[0]
      audio.autoplay = true
      audio.playsInline = true // Required for iOS
      audio.setAttribute('playsinline', '') // Attribute form for older browsers
      audio.volume = 1.0 // Ensure full volume
      audio.muted = false // Ensure not muted
      
      document.body.appendChild(audio)
      
      // Handle playback with retries for mobile browsers
      const attemptPlay = async (retries = 3) => {
        try {
          await audio.play()
          console.log(`[VoiceChat] Audio playing from ${targetId}`)
          audio.dataset.needsPlay = 'false'
        } catch (err) {
          console.log(`[VoiceChat] Audio autoplay blocked for ${targetId}:`, err.message)
          audio.dataset.needsPlay = 'true'
          if (retries > 0) {
            setTimeout(() => attemptPlay(retries - 1), 500)
          }
        }
      }
      attemptPlay()
      
      setVoiceConnected(prev => new Set([...prev, targetId]))
    }
    
    pc.onconnectionstatechange = () => {
      console.log(`[VoiceChat] Connection state with ${targetId}: ${pc.connectionState}`)
      if (pc.connectionState === 'connected') {
        console.log(`[VoiceChat] Successfully connected to ${targetId}`)
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        const audio = document.getElementById(`audio-${targetId}`)
        if (audio) {
          audio.srcObject = null
          audio.remove()
        }
        
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
    console.log('[VoiceChat] Joining voice chat...')
    
    try {
      // Resume any suspended audio context first (mobile requirement)
      await resumeAudioContext()
      
      await initializeVoice()
      setIsVoiceEnabled(true)
      isVoiceEnabledRef.current = true // Update ref immediately
      
      console.log('[VoiceChat] Voice initialized, notifying server')
      
      // Notify server that we're joining voice
      socket.emit('voiceJoin', { roomId })
      
      // Small delay to ensure server broadcasts voiceJoin before we send offers
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Create offers to all existing players who might be in voice
      const otherPlayers = players.filter(p => p.id !== playerId)
      console.log(`[VoiceChat] Creating offers to ${otherPlayers.length} other players`)
      
      for (const player of otherPlayers) {
        const pc = createPeerConnection(player.id)
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false
          })
          await pc.setLocalDescription(offer)
          
          // Mark as pending offer for collision detection
          pendingOffersRef.current.set(player.id, true)
          
          console.log(`[VoiceChat] Sending offer to ${player.id}`)
          socket.emit('voiceOffer', {
            roomId,
            targetId: player.id,
            offer
          })
        } catch (err) {
          console.error(`[VoiceChat] Failed to create offer for ${player.id}:`, err)
        }
      }
      
      console.log('[VoiceChat] Voice chat joined successfully')
    } catch (err) {
      console.error('[VoiceChat] Failed to join voice:', err)
      setIsVoiceEnabled(false)
      isVoiceEnabledRef.current = false
    } finally {
      setIsJoiningVoice(false)
    }
  }, [initializeVoice, socket, roomId, players, playerId, createPeerConnection, resumeAudioContext])

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

    // Handle incoming voice offer with proper collision detection
    const handleVoiceOffer = async ({ fromId, offer }) => {
      // Use ref to get current voice enabled state (avoids stale closure)
      if (!isVoiceEnabledRef.current) {
        console.log(`[VoiceChat] Ignoring offer from ${fromId} - voice not enabled`)
        return
      }
      
      console.log(`[VoiceChat] Received offer from ${fromId}`)
      
      // Check if we have a pending offer to this peer (collision)
      const hasPendingOffer = pendingOffersRef.current.has(fromId)
      
      // Use "polite peer" algorithm - the peer with lower ID is polite
      const isPolite = playerId < fromId
      
      if (hasPendingOffer && !isPolite) {
        // We're impolite and have a pending offer, ignore incoming offer
        console.log(`[VoiceChat] Ignoring offer from ${fromId} - we have pending offer and are impolite`)
        return
      }
      
      const pc = createPeerConnection(fromId)
      
      try {
        // If collision and we're polite, rollback our offer
        if (hasPendingOffer && isPolite) {
          console.log(`[VoiceChat] Rolling back our offer to ${fromId} - we are polite`)
          await pc.setLocalDescription({ type: 'rollback' })
          pendingOffersRef.current.delete(fromId)
        }
        
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        
        // Apply any queued ICE candidates now that we have remote description
        await applyQueuedIceCandidates(fromId)
        
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        
        console.log(`[VoiceChat] Sending answer to ${fromId}`)
        socket.emit('voiceAnswer', {
          roomId,
          targetId: fromId,
          answer
        })
      } catch (err) {
        console.error(`[VoiceChat] Failed to handle voice offer from ${fromId}:`, err)
      }
    }

    // Handle incoming voice answer
    const handleVoiceAnswer = async ({ fromId, answer }) => {
      console.log(`[VoiceChat] Received answer from ${fromId}`)
      
      const pc = peerConnectionsRef.current.get(fromId)
      if (!pc) {
        console.warn(`[VoiceChat] No peer connection found for ${fromId}`)
        return
      }
      
      // Clear pending offer flag
      pendingOffersRef.current.delete(fromId)
      
      try {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer))
          console.log(`[VoiceChat] Set remote description for ${fromId}`)
          
          // Apply any queued ICE candidates now that we have remote description
          await applyQueuedIceCandidates(fromId)
        } else {
          console.warn(`[VoiceChat] Unexpected signaling state for ${fromId}: ${pc.signalingState}`)
        }
      } catch (err) {
        console.error(`[VoiceChat] Failed to handle voice answer from ${fromId}:`, err)
      }
    }
    
    // Helper to apply queued ICE candidates - defined before use
    const applyQueuedIceCandidates = async (peerId) => {
      const candidates = pendingIceCandidatesRef.current.get(peerId)
      if (!candidates || candidates.length === 0) return
      
      const pc = peerConnectionsRef.current.get(peerId)
      if (!pc || !pc.remoteDescription) return
      
      console.log(`[VoiceChat] Applying ${candidates.length} queued ICE candidates for ${peerId}`)
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (err) {
          console.error(`[VoiceChat] Failed to add queued ICE candidate:`, err)
        }
      }
      pendingIceCandidatesRef.current.delete(peerId)
    }
    
    // Handle ICE candidate with queuing for early candidates
    const handleIceCandidate = async ({ fromId, candidate }) => {
      const pc = peerConnectionsRef.current.get(fromId)
      if (!pc) {
        // Queue candidate for when peer connection is created
        if (!pendingIceCandidatesRef.current.has(fromId)) {
          pendingIceCandidatesRef.current.set(fromId, [])
        }
        pendingIceCandidatesRef.current.get(fromId).push(candidate)
        console.log(`[VoiceChat] Queuing ICE candidate from ${fromId} - no peer connection yet`)
        return
      }
      
      try {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } else {
          // Queue candidate until remote description is set
          if (!pendingIceCandidatesRef.current.has(fromId)) {
            pendingIceCandidatesRef.current.set(fromId, [])
          }
          pendingIceCandidatesRef.current.get(fromId).push(candidate)
          console.log(`[VoiceChat] Queuing ICE candidate from ${fromId} - no remote description yet`)
        }
      } catch (err) {
        console.error(`[VoiceChat] Failed to add ICE candidate from ${fromId}:`, err)
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
      // Use ref to avoid stale closure
      if (!isVoiceEnabledRef.current || joinedId === playerId) return
      
      console.log(`[VoiceChat] Player ${joinedId} joined voice, creating offer`)
      
      // Create offer to newly joined player
      const pc = createPeerConnection(joinedId)
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        
        // Mark as pending offer for collision detection
        pendingOffersRef.current.set(joinedId, true)
        
        socket.emit('voiceOffer', {
          roomId,
          targetId: joinedId,
          offer
        })
        console.log(`[VoiceChat] Sent offer to ${joinedId}`)
      } catch (err) {
        console.error(`[VoiceChat] Failed to create offer for ${joinedId}:`, err)
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
  }, [socket, roomId, playerId, createPeerConnection])

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
    resumeAudioContext, // Expose for parent to call on user interaction
    getPlayerVoiceStatus: (player) => {
      const isSelf = player.id === playerId
      const isConnected = isSelf ? isVoiceEnabled : voiceConnected.has(player.id)
      const playerMuted = isSelf ? isMuted : mutedPlayers.get(player.id)
      const playerSpeaking = isSelf ? false : speakingPlayers.has(player.id)
      const isLocallyMuted = locallyMutedPlayers.has(player.id)
      return { isConnected, playerMuted, playerSpeaking, isLocallyMuted }
    }
  }), [isVoiceEnabled, isMuted, micPermission, speakingPlayers, mutedPlayers, voiceConnected, locallyMutedPlayers, isJoiningVoice, joinVoice, leaveVoice, toggleMute, togglePlayerAudio, resumeAudioContext, playerId])

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
