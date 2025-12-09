import React, { useState, useEffect, useRef } from 'react'

// Audio waveform visualization component with continuous animation
const AudioWaveform = ({ audioLevel = 0, isActive = false, isMuted = false, barCount = 5 }) => {
  const [bars, setBars] = useState(() => Array(barCount).fill(0.15))
  const animationFrameRef = useRef(null)
  const lastUpdateRef = useRef(0)
  
  useEffect(() => {
    // Animation loop for smooth waveform
    const animate = (timestamp) => {
      // Throttle updates to ~60fps
      if (timestamp - lastUpdateRef.current < 16) {
        animationFrameRef.current = requestAnimationFrame(animate)
        return
      }
      lastUpdateRef.current = timestamp
      
      if (!isActive || isMuted || audioLevel <= 0) {
        setBars(Array(barCount).fill(0.15))
      } else {
        // Create varied heights based on audio level with smooth animation
        const newBars = Array(barCount).fill(0).map((_, i) => {
          const time = timestamp / 100
          const variation = Math.sin(time + i * 1.5) * 0.2
          const baseHeight = audioLevel * (0.6 + Math.sin(time * 2 + i) * 0.2)
          return Math.min(Math.max(baseHeight + variation, 0.15), 1)
        })
        setBars(newBars)
      }
      
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    
    // Start animation when active
    if (isActive && !isMuted && audioLevel > 0) {
      animationFrameRef.current = requestAnimationFrame(animate)
    } else {
      setBars(Array(barCount).fill(0.15))
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [audioLevel, isActive, isMuted, barCount])

  return (
    <div className={`audio-waveform ${isActive && !isMuted ? 'active' : ''}`}>
      {bars.map((height, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{
            height: `${Math.max(height * 100, 15)}%`,
            opacity: isActive && !isMuted ? 1 : 0.3
          }}
        />
      ))}
    </div>
  )
}

export default AudioWaveform
