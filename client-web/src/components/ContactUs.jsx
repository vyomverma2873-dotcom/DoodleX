import React from 'react'

const ContactUs = ({ onBack }) => {
  return (
    <div className="page-container">
      <div className="page-content">
        <button className="back-btn" onClick={onBack}>
          ← Back to Home
        </button>
        
        <h1 className="page-title">Contact Us</h1>
        <p className="page-subtitle">We'd love to hear from you! Reach out with any questions, feedback, or suggestions.</p>

        <div className="contact-info-section">
          <h2>Get in Touch</h2>
          
          <div className="contact-card">
            <div className="contact-icon">📧</div>
            <div className="contact-details">
              <h3>Email Us</h3>
              <p>For general inquiries:</p>
              <a href="mailto:vyomverma2873@gmail.com" className="contact-email">
                vyomverma2873@gmail.com
              </a>
              <p style={{ marginTop: '8px' }}>For technical support:</p>
              <a href="mailto:vansh.chaudhary4456@gmail.com" className="contact-email">
                vansh.chaudhary4456@gmail.com
              </a>
            </div>
          </div>

          <div className="contact-card">
            <div className="contact-icon">💬</div>
            <div className="contact-details">
              <h3>Response Time</h3>
              <p>We typically respond within 24-48 hours. For urgent matters, please mention "URGENT" in your subject line.</p>
            </div>
          </div>

          <div className="contact-card">
            <div className="contact-icon">🎮</div>
            <div className="contact-details">
              <h3>Bug Reports</h3>
              <p>Found a bug? Please include your browser, device, and steps to reproduce the issue.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContactUs
