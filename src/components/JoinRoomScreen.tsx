import { useState } from 'react'
import { joinRoom } from '../services/roomService'
import './JoinRoomScreen.css'

interface JoinRoomScreenProps {
  userUID: string
  onRoomJoined: (roomId: string, roomCode: string, isHost: boolean, playerName: string) => void
  onBack: () => void
}

export default function JoinRoomScreen({ userUID, onRoomJoined, onBack }: JoinRoomScreenProps) {
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!playerName.trim() || roomCode.length !== 6) {
      setError('Please fill in all fields correctly')
      return
    }

    setIsJoining(true)
    setError(null)

    try {
      const result = await joinRoom(roomCode.trim().toUpperCase(), userUID, playerName.trim())
      
      if (result.success && result.roomId) {
        // Successfully joined room - navigate to lobby
        onRoomJoined(result.roomId, roomCode.trim().toUpperCase(), false, playerName.trim())
      } else {
        setError(result.error || 'Failed to join room')
        setIsJoining(false)
      }
    } catch (err) {
      console.error('Error joining room:', err)
      setError('Failed to join room. Please try again.')
      setIsJoining(false)
    }
  }

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    if (value.length <= 6) {
      setRoomCode(value)
    }
  }

  const isFormValid = playerName.trim() !== '' && roomCode.length === 6 && !isJoining

  return (
    <div className="join-room-screen">
      <div className="join-room-container">
        <button className="back-button" onClick={onBack} disabled={isJoining}>
          ← Back
        </button>
        
        <div className="join-room-header">
          <h1 className="join-room-title">Join Room</h1>
          <p className="join-room-subtitle">Enter your details to join an existing quiz</p>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}
        
        <form className="join-room-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="playerName">Your Name</label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              required
              disabled={isJoining}
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="roomCode">Room Code</label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={handleRoomCodeChange}
              placeholder="6-digit code"
              className="room-code-input"
              required
              disabled={isJoining}
            />
            <small className="input-hint">
              {roomCode.length}/6 characters
            </small>
          </div>
          
          <button 
            type="submit" 
            className={`join-button ${isFormValid ? 'active' : 'disabled'}`}
            disabled={!isFormValid}
          >
            {isJoining ? (
              <>
                <div className="button-loading-spinner"></div>
                Joining Room...
              </>
            ) : (
              'Join Room'
            )}
          </button>
        </form>
        
        <div className="join-room-info">
          <div className="info-item">
            <span className="info-icon">🔍</span>
            <span>Ask the host for the 6-digit room code</span>
          </div>
          <div className="info-item">
            <span className="info-icon">🎮</span>
            <span>Join active games or wait in lobby</span>
          </div>
          <div className="info-item">
            <span className="info-icon">🏆</span>
            <span>Compete with other players in real-time</span>
          </div>
        </div>
      </div>
    </div>
  )
}
