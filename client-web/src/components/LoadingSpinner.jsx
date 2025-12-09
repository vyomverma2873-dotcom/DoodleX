import React from 'react'

const LoadingSpinner = ({ 
  size = 'medium', 
  message = 'Loading...', 
  fullScreen = false,
  overlay = false 
}) => {
  const sizeClasses = {
    small: 'spinner-small',
    medium: 'spinner-medium',
    large: 'spinner-large'
  }

  const spinnerContent = (
    <div className={`loading-spinner-container ${fullScreen ? 'full-screen' : ''} ${overlay ? 'overlay' : ''}`}>
      <div className={`loading-spinner ${sizeClasses[size]}`}>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-dot"></div>
      </div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  )

  return spinnerContent
}

export default LoadingSpinner
