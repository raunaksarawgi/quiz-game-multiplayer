import { useState, useEffect } from 'react'
import { useRoomInfo, useRoomParticipants } from '../hooks/useRoomListeners'
import { hostQuizControl } from '../services/quizControl'
import './RoomLobbyScreen.css'

interface RoomLobbyScreenProps {
  roomId: string
  userUID: string
  isHost: boolean
  onStartGame: () => void
  onLeaveRoom: () => void
}

export default function RoomLobbyScreen({ 
  roomId, 
  userUID, 
  isHost, 
  onStartGame, 
  onLeaveRoom 
}: RoomLobbyScreenProps) {
  const { roomInfo, loading: roomLoading, error: roomError } = useRoomInfo(roomId)
  const { participants, participantCount, loading: participantsLoading } = useRoomParticipants(roomId)
  const [isStarting, setIsStarting] = useState(false)

  // Auto-redirect to quiz when room becomes active (for non-hosts)
  useEffect(() => {
    if (roomInfo?.status === 'active' && !isHost) {
      onStartGame()
    }
  }, [roomInfo?.status, isHost, onStartGame])

  const handleStartGame = async () => {
    if (!isHost || !roomId) return

    setIsStarting(true)
    try {
      // Ensure user is authenticated and wait for token to be ready
      const { auth } = await import('../config/firebase')
      if (!auth.currentUser) {
        console.error('❌ No authenticated user when starting quiz')
        setIsStarting(false)
        alert('Authentication error. Please refresh and try again.')
        return
      }

      // Force token refresh and wait for auth state stability
      await auth.currentUser.getIdToken(true)
      await new Promise(resolve => setTimeout(resolve, 500))

      // Start the quiz with timer control
      const quizStarted = await hostQuizControl.startQuiz(roomId)
      if (quizStarted) {
        // Auto-advance will be managed by App component
        onStartGame()
      } else {
        setIsStarting(false)
        alert('Failed to start quiz. Please try again.')
      }
    } catch (error) {
      console.error('Error starting quiz:', error)
      setIsStarting(false)
      alert('Failed to start quiz. Please try again.')
    }
  }

  const handleLeaveRoom = () => {
    if (isHost) {
      const confirmLeave = window.confirm(
        'As the host, leaving will end the game for all participants. Are you sure?'
      )
      if (confirmLeave) {
        onLeaveRoom()
      }
    } else {
      onLeaveRoom()
    }
  }

  const copyRoomCode = async () => {
    if (roomInfo?.roomCode) {
      try {
        await navigator.clipboard.writeText(roomInfo.roomCode)
        // Could add a toast notification here
        alert('Room code copied to clipboard!')
      } catch (err) {
        console.error('Failed to copy room code:', err)
        alert(`Room code: ${roomInfo.roomCode}`)
      }
    } else {
      console.warn('No room code available to copy')
    }
  }

  if (roomLoading) {
    return (
      <div className="room-lobby-screen">
        <div className="room-lobby-container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading room...</p>
          </div>
        </div>
      </div>
    )
  }

  if (roomError || !roomInfo) {
    return (
      <div className="room-lobby-screen">
        <div className="room-lobby-container">
          <div className="error-state">
            <span className="error-icon">⚠️</span>
            <h2>Room Not Found</h2>
            <p>{roomError || 'This room may have been deleted or does not exist.'}</p>
            <button className="leave-button" onClick={onLeaveRoom}>
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="room-lobby-screen">
      <div className="room-lobby-container">
        <div className="lobby-header">
          <div className="room-info">
            <h1 className="lobby-title">
              {isHost ? '👑 Hosting Room' : '🎮 Joined Room'}
            </h1>
            <div className="room-code-section">
              <p className="room-code-label">Room Code:</p>
              <div className="room-code-display" onClick={copyRoomCode}>
                <span className="room-code">{roomInfo?.roomCode || 'Loading...'}</span>
                <span className="copy-hint">📋 Click to copy</span>
              </div>
            </div>
          </div>
          
          <button className="leave-button" onClick={handleLeaveRoom}>
            {isHost ? 'End Game' : 'Leave Room'}
          </button>
        </div>

        <div className="lobby-content">
          <div className="participants-section">
            <div className="participants-header">
              <h2>👥 Players ({participantCount})</h2>
              {participantsLoading && <div className="mini-spinner"></div>}
            </div>
            
            <div className="participants-list">
              {participants.map((participant) => (
                <div 
                  key={participant.id} 
                  className={`participant-card ${participant.isHost ? 'host' : 'player'}`}
                >
                  <div className="participant-avatar">
                    {participant.avatar}
                  </div>
                  <div className="participant-info">
                    <span className="participant-name">{participant.name}</span>
                    <span className="participant-role">
                      {participant.isHost ? 'Host' : 'Player'}
                    </span>
                  </div>
                  {participant.id === userUID && (
                    <div className="you-indicator">You</div>
                  )}
                </div>
              ))}
            </div>

            {participantCount === 0 && (
              <div className="empty-participants">
                <p>Waiting for players to join...</p>
                <div className="waiting-animation">⏳</div>
              </div>
            )}
          </div>

          <div className="game-info-section">
            <div className="game-details">
              <h3>🎯 Game Details</h3>
              <div className="detail-item">
                <span className="detail-icon">📝</span>
                <span>{roomInfo?.questionCount || 0} Questions</span>
              </div>
              {roomInfo?.selectedCategory && (
                <div className="detail-item">
                  <span className="detail-icon">📂</span>
                  <span>Category: {roomInfo.selectedCategory}</span>
                </div>
              )}
              <div className="detail-item">
                <span className="detail-icon">👁️</span>
                <span>
                  {roomInfo?.settings?.showCorrectAnswer ? 'Show answers' : 'Hide answers'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">🚪</span>
                <span>
                  {roomInfo?.settings?.allowLateJoin ? 'Late join allowed' : 'No late join'}
                </span>
              </div>
            </div>

            {isHost && (
              <div className="host-controls">
                <button 
                  className={`start-game-button ${participantCount > 0 ? 'ready' : 'waiting'}`}
                  onClick={handleStartGame}
                  disabled={participantCount === 0 || isStarting}
                >
                  {isStarting ? (
                    <>
                      <div className="button-spinner"></div>
                      Starting Game...
                    </>
                  ) : participantCount === 0 ? (
                    'Waiting for Players'
                  ) : (
                    `🚀 Start Game (${participantCount} ${participantCount === 1 ? 'player' : 'players'})`
                  )}
                </button>
                
                {participantCount === 0 && (
                  <p className="host-hint">
                    Share the room code with friends to get started!
                  </p>
                )}
              </div>
            )}

            {!isHost && (
              <div className="player-waiting">
                <div className="waiting-host">
                  <span className="waiting-icon">⏳</span>
                  <p>Waiting for host to start the game...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lobby-footer">
          <div className="status-indicator">
            <div className="status-dot waiting"></div>
            <span>Waiting in lobby</span>
          </div>
        </div>
      </div>
    </div>
  )
}
