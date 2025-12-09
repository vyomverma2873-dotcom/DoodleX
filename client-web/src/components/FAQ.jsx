import React, { useState } from 'react'

const faqData = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'What is DoodleX?',
        a: 'DoodleX is an online multiplayer Draw & Guess game where players take turns drawing a secret word while others try to guess it. It\'s perfect for playing with friends, family, or meeting new people!'
      },
      {
        q: 'How many players do I need to play?',
        a: 'You need at least 2 players to start a game. However, the game is most fun with 4-8 players. There\'s no strict upper limit, but we recommend keeping it under 12 for the best experience.'
      },
      {
        q: 'Is DoodleX free to play?',
        a: 'Yes! DoodleX is completely free to play. No downloads, no accounts required - just enter your name and start playing!'
      },
      {
        q: 'Do I need to create an account?',
        a: 'No account is needed. Just enter a display name when you join, and you\'re ready to play. Your progress isn\'t saved between sessions, so each game is a fresh start.'
      }
    ]
  },
  {
    category: 'Gameplay',
    questions: [
      {
        q: 'How do I join a room?',
        a: 'To join a room, enter your name on the home screen, input the 6-character room code shared by the host, and click "Join Room". You\'ll be connected to the game lobby instantly.'
      },
      {
        q: 'How does the scoring system work?',
        a: 'Points are awarded based on how quickly you guess correctly. Early guessers earn more points (up to 150). The artist also earns points when players guess their drawing correctly (25 points per correct guess).'
      },
      {
        q: 'What happens if no one guesses the word?',
        a: 'If time runs out without anyone guessing correctly, the round ends with no points awarded. The correct word is revealed, and the next player becomes the artist.'
      },
      {
        q: 'Can I skip my turn as the artist?',
        a: 'Currently, you cannot skip your turn. However, you can draw something simple and let the timer run out if needed. We recommend always trying your best though!'
      }
    ]
  },
  {
    category: 'Drawing Tools',
    questions: [
      {
        q: 'What drawing tools are available?',
        a: 'You have access to: multiple colors, adjustable brush sizes, an eraser, a bucket fill tool for filling areas, and a clear canvas button. These tools help you create drawings quickly and effectively.'
      },
      {
        q: 'How does the bucket fill tool work?',
        a: 'Select the bucket fill tool, choose a color, and click on any area of the canvas. The tool will fill that connected area with your selected color. Great for backgrounds and large shapes!'
      },
      {
        q: 'Can I undo my drawing?',
        a: 'There\'s no undo button currently, but you can use the eraser to remove mistakes or the clear button to start fresh. Draw carefully!'
      }
    ]
  },
  {
    category: 'Voice Chat',
    questions: [
      {
        q: 'How do I use voice chat?',
        a: 'Click the microphone icon in the game header to join voice chat. You\'ll need to grant microphone permission in your browser. Once connected, you can talk with other players in real-time.'
      },
      {
        q: 'Can I mute myself or others?',
        a: 'Yes! You can mute/unmute yourself using the microphone button. The room host can also mute any player if needed. Muted players will show a muted indicator next to their name.'
      },
      {
        q: 'Why can\'t others hear me?',
        a: 'Check if: 1) You\'ve granted microphone permission, 2) You\'re not muted, 3) Your microphone is properly connected and selected in browser settings, 4) You haven\'t been muted by the host.'
      },
      {
        q: 'Is voice chat required to play?',
        a: 'No, voice chat is optional. You can play the entire game using just the text chat for guessing. Voice chat just adds to the fun!'
      }
    ]
  },
  {
    category: 'Technical Issues',
    questions: [
      {
        q: 'The game is lagging. What can I do?',
        a: 'Try: 1) Refreshing the page, 2) Closing other browser tabs, 3) Using a stable internet connection, 4) Switching to Chrome or Firefox if using another browser, 5) Disabling browser extensions.'
      },
      {
        q: 'I got disconnected. Can I rejoin?',
        a: 'Yes! Simply re-enter the same room code and your name. You\'ll rejoin the game in progress. Note that your previous score in that session will be reset.'
      },
      {
        q: 'Which browsers are supported?',
        a: 'DoodleX works best on Chrome, Firefox, Edge, and Safari. We recommend using the latest version of your browser for the best experience.'
      },
      {
        q: 'Can I play on mobile?',
        a: 'Yes! DoodleX is designed to work on mobile browsers. For the best drawing experience on mobile, we recommend using a stylus or playing in landscape mode.'
      }
    ]
  },
  {
    category: 'Room & Host Controls',
    questions: [
      {
        q: 'What can the host do?',
        a: 'The host can: start the game, adjust game settings (time limit, rounds, difficulty), mute any player in voice chat, and has the crown icon next to their name.'
      },
      {
        q: 'What happens if the host leaves?',
        a: 'If the host leaves, hosting privileges automatically transfer to the next player in the room. The game continues uninterrupted.'
      },
      {
        q: 'How do I change game settings?',
        a: 'Only the host can change settings. In the lobby, click the settings button to adjust time limits, number of rounds, and difficulty level before starting the game.'
      }
    ]
  }
]

const FAQ = ({ onBack }) => {
  const [openQuestion, setOpenQuestion] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const toggleQuestion = (categoryIdx, questionIdx) => {
    const key = `${categoryIdx}-${questionIdx}`
    setOpenQuestion(openQuestion === key ? null : key)
  }

  const filteredFaq = searchQuery
    ? faqData.map(category => ({
        ...category,
        questions: category.questions.filter(
          q => q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
               q.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(category => category.questions.length > 0)
    : faqData

  return (
    <div className="page-container">
      <div className="page-content">
        <button className="back-btn" onClick={onBack}>
          ← Back to Home
        </button>
        
        <h1 className="page-title">Frequently Asked Questions</h1>
        <p className="page-subtitle">Find answers to common questions about DoodleX</p>

        <div className="faq-search">
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="faq-search-input"
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              ✕
            </button>
          )}
        </div>

        <div className="faq-container">
          {filteredFaq.length === 0 ? (
            <div className="no-results">
              <p>No questions found matching "{searchQuery}"</p>
              <button className="btn btn-secondary" onClick={() => setSearchQuery('')}>
                Clear Search
              </button>
            </div>
          ) : (
            filteredFaq.map((category, categoryIdx) => (
              <div key={categoryIdx} className="faq-category">
                <h2 className="faq-category-title">{category.category}</h2>
                <div className="faq-questions">
                  {category.questions.map((item, questionIdx) => {
                    const key = `${categoryIdx}-${questionIdx}`
                    const isOpen = openQuestion === key
                    
                    return (
                      <div 
                        key={questionIdx} 
                        className={`faq-item ${isOpen ? 'open' : ''}`}
                      >
                        <button 
                          className="faq-question"
                          onClick={() => toggleQuestion(categoryIdx, questionIdx)}
                        >
                          <span>{item.q}</span>
                          <span className="faq-toggle">{isOpen ? '−' : '+'}</span>
                        </button>
                        {isOpen && (
                          <div className="faq-answer">
                            <p>{item.a}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="faq-footer">
          <h3>Still have questions?</h3>
          <p>Can't find what you're looking for? We're here to help!</p>
          <button className="btn btn-primary" onClick={() => onBack('contact')}>
            Contact Us
          </button>
        </div>
      </div>
    </div>
  )
}

export default FAQ
