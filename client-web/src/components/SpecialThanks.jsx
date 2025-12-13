import React, { useRef } from 'react'

const SpecialThanks = ({ onBack, winSoundRef, wrongGuessSoundRef }) => {
  // Play win sound followed by wrong guess sound
  const playSpecialThanksSounds = () => {
    if (winSoundRef && wrongGuessSoundRef) {
      // Reset and play win sound first
      winSoundRef.current.currentTime = 0;
      winSoundRef.current.play().catch(e => console.log('Sound play failed:', e));
      
      // Play wrong guess sound after win sound finishes
      setTimeout(() => {
        wrongGuessSoundRef.current.currentTime = 0;
        wrongGuessSoundRef.current.play().catch(e => console.log('Sound play failed:', e));
      }, winSoundRef.current.duration * 1000 || 3000); // Fallback to 3 seconds if duration is not available
    }
  };

  return (
    <div className="page-container">
      <div className="page-content">
        <button className="back-btn" onClick={onBack}>
          ← Back to Home
        </button>
        
        <h1 className="page-title">Special Thanks</h1>
        <p className="page-subtitle">Heartfelt gratitude to the legendary voices that bring magic to DoodleX</p>

        <div className="special-thanks-container">
          <div className="special-thanks-image-container">
            <img 
              src="/special-thanks.jpg" 
              alt="Special Thanks to Amitabh Bachchan and Dadi ji" 
              className="special-thanks-image"
              onClick={playSpecialThanksSounds}
            />
          </div>

          <div className="special-thanks-text">
            <p>We extend our heartfelt gratitude to two remarkable individuals whose contributions have significantly enhanced the DoodleX gaming experience:</p>
            
            <div className="contributor-section">
              <h2>Amitabh Bachchan</h2>
              <p>The legendary Bollywood icon whose distinctive voice brings excitement to our game. His voice is featured as the winning announcement, adding a touch of cinematic grandeur to every victory moment.</p>
            </div>
            
            <div className="contributor-section">
              <h2>Dadi ji</h2>
              <p>Our beloved grandmother figure whose warm and familiar voice provides gentle feedback during gameplay. Her voice plays when a player makes an incorrect guess, offering encouragement with a touch of familial warmth.</p>
            </div>
            
            <div className="contribution-note">
              <p>Their voices transform DoodleX from a simple drawing game into an emotionally engaging experience, connecting players with the magic of Indian cinema and the comfort of family bonds.</p>
            </div>
            
            <p className="closing-message">Thank you for being part of our journey and for making DoodleX truly special!</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SpecialThanks