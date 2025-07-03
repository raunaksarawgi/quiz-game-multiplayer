import './HomeScreen.css'

interface HomeScreenProps {
  onJoinRoom: () => void
  onHostRoom: () => void
  isAuthenticating?: boolean
}

export default function HomeScreen({ onJoinRoom, onHostRoom, isAuthenticating = false }: HomeScreenProps) {
  return (
    <div className="home-screen">
      <div className="home-container">
        <div className="home-header">
          <h1 className="home-title">QUIZMO</h1>
          <p className="home-subtitle">Challenge your knowledge with friends!</p>
        </div>
        
        <div className="home-options">
          <button 
            className="home-button join-button"
            onClick={onJoinRoom}
            disabled={isAuthenticating}
          >
            <div className="button-content">
              <h3>{isAuthenticating ? 'Authenticating...' : 'Join Room'}</h3>
              <p>Enter a room code to join an existing quiz</p>
            </div>
          </button>
          
          <button 
            className="home-button host-button"
            onClick={onHostRoom}
            disabled={isAuthenticating}
          >
            <div className="button-content">
              <h3>{isAuthenticating ? 'Authenticating...' : 'Host Room'}</h3>
              <p>Create a new quiz room for others to join</p>
            </div>
          </button>
        </div>
        
        <div className="home-footer">
          <p>Real-time multiplayer quiz experience</p>
        </div>
      </div>
    </div>
  )
}
