import React from 'react'

const HowToPlay = ({ onBack }) => {
  return (
    <div className="page-container">
      <div className="page-content">
        <button className="back-btn" onClick={onBack}>
          ← Back to Home
        </button>
        
        <h1 className="page-title">How to Play</h1>
        <p className="page-subtitle">Learn the basics of DoodleX - the ultimate Draw & Guess party game!</p>

        <div className="instructions-container">
          {/* Getting Started */}
          <section className="instruction-section">
            <div className="section-header">
              <span className="section-number">1</span>
              <h2>Getting Started</h2>
            </div>
            <div className="section-content">
              <div className="step-card">
                <h3>🏠 Create or Join a Room</h3>
                <p>Enter your name and either create a new room or join an existing one using a room code shared by a friend.</p>
              </div>
              <div className="step-card">
                <h3>📤 Share the Room Code</h3>
                <p>If you created the room, share the 6-character room code with friends so they can join your game.</p>
              </div>
              <div className="step-card">
                <h3>👥 Wait for Players</h3>
                <p>You need at least 2 players to start a game. The more players, the more fun!</p>
              </div>
            </div>
          </section>

          {/* Game Flow */}
          <section className="instruction-section">
            <div className="section-header">
              <span className="section-number">2</span>
              <h2>Game Flow</h2>
            </div>
            <div className="section-content">
              <div className="step-card">
                <h3>🎯 Taking Turns</h3>
                <p>Players take turns being the artist. When it's your turn, you'll see a secret word that you need to draw.</p>
              </div>
              <div className="step-card">
                <h3>⏱️ Time Limit</h3>
                <p>Each round has a time limit (default: 80 seconds). Draw quickly but clearly!</p>
              </div>
              <div className="step-card">
                <h3>🔄 Multiple Rounds</h3>
                <p>The game consists of multiple rounds. Each player gets to draw once per round.</p>
              </div>
            </div>
          </section>

          {/* Drawing Rules */}
          <section className="instruction-section">
            <div className="section-header">
              <span className="section-number">3</span>
              <h2>Drawing Rules</h2>
            </div>
            <div className="section-content">
              <div className="rules-grid">
                <div className="rule-item allowed">
                  <span className="rule-icon">✓</span>
                  <span>Draw pictures and symbols</span>
                </div>
                <div className="rule-item allowed">
                  <span className="rule-icon">✓</span>
                  <span>Use different colors and brush sizes</span>
                </div>
                <div className="rule-item allowed">
                  <span className="rule-icon">✓</span>
                  <span>Use the bucket fill tool for large areas</span>
                </div>
                <div className="rule-item forbidden">
                  <span className="rule-icon">✗</span>
                  <span>Write letters or numbers</span>
                </div>
                <div className="rule-item forbidden">
                  <span className="rule-icon">✗</span>
                  <span>Tell others the word via voice chat</span>
                </div>
                <div className="rule-item forbidden">
                  <span className="rule-icon">✗</span>
                  <span>Use gestures or sign language</span>
                </div>
              </div>
            </div>
          </section>

          {/* Guessing */}
          <section className="instruction-section">
            <div className="section-header">
              <span className="section-number">4</span>
              <h2>Guessing Mechanics</h2>
            </div>
            <div className="section-content">
              <div className="step-card">
                <h3>💭 Type Your Guess</h3>
                <p>When you're not drawing, type your guesses in the chat box. Each guess is checked automatically.</p>
              </div>
              <div className="step-card">
                <h3>🔤 Word Hints</h3>
                <p>You'll see underscores showing the word length. As time passes, letters may be revealed as hints!</p>
              </div>
              <div className="step-card">
                <h3>✅ Correct Guess</h3>
                <p>Guess correctly and you'll see a green confirmation. Keep guessing until you get it right!</p>
              </div>
            </div>
          </section>

          {/* Scoring */}
          <section className="instruction-section">
            <div className="section-header">
              <span className="section-number">5</span>
              <h2>Scoring System</h2>
            </div>
            <div className="section-content">
              <div className="scoring-table">
                <div className="score-row header">
                  <span>Action</span>
                  <span>Points</span>
                </div>
                <div className="score-row">
                  <span>🎯 Guess correctly (early)</span>
                  <span className="points">+100-150</span>
                </div>
                <div className="score-row">
                  <span>✅ Guess correctly (later)</span>
                  <span className="points">+50-100</span>
                </div>
                <div className="score-row">
                  <span>🎨 Your drawing is guessed</span>
                  <span className="points">+25 per guess</span>
                </div>
                <div className="score-row">
                  <span>⭐ First to guess</span>
                  <span className="points">Bonus points!</span>
                </div>
              </div>
              <p className="scoring-note">💡 Tip: Guess early for maximum points! The faster you guess, the more you earn.</p>
            </div>
          </section>

          {/* Voice Chat */}
          <section className="instruction-section">
            <div className="section-header">
              <span className="section-number">6</span>
              <h2>Voice Chat</h2>
            </div>
            <div className="section-content">
              <div className="step-card">
                <h3>🎙️ Join Voice Chat</h3>
                <p>Click the microphone button in the header to join voice chat with other players.</p>
              </div>
              <div className="step-card">
                <h3>🔇 Mute Controls</h3>
                <p>You can mute/unmute yourself anytime. The host can also mute players if needed.</p>
              </div>
              <div className="step-card">
                <h3>📊 Speaking Indicator</h3>
                <p>See who's talking with the audio waveform animation next to each player's name.</p>
              </div>
              <div className="step-card warning">
                <h3>⚠️ Important Rule</h3>
                <p>Never say the secret word in voice chat when you're drawing! That's cheating and ruins the fun.</p>
              </div>
            </div>
          </section>

          {/* Tips */}
          <section className="instruction-section tips-section">
            <div className="section-header">
              <span className="section-number">💡</span>
              <h2>Pro Tips</h2>
            </div>
            <div className="section-content">
              <ul className="tips-list">
                <li>Start with simple shapes and add details as time allows</li>
                <li>Use the eraser to correct mistakes quickly</li>
                <li>Pay attention to the word length hint</li>
                <li>Think creatively - sometimes abstract representations work best!</li>
                <li>Communicate with other guessers via voice chat (but don't give hints!)</li>
                <li>Watch the timer and prioritize key elements of your drawing</li>
              </ul>
            </div>
          </section>
        </div>

        <div className="page-cta">
          <h3>Ready to Play?</h3>
          <button className="btn btn-primary" onClick={onBack}>
            Start Playing Now! 🎮
          </button>
        </div>
      </div>
    </div>
  )
}

export default HowToPlay
