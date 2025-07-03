import { useState, useEffect, useRef } from 'react'
import './App.css'
import HomeScreen from './components/HomeScreen'
import JoinRoomScreen from './components/JoinRoomScreen'
import HostRoomScreen from './components/HostRoomScreen'
import QuizScreen from './components/QuizScreen'
import RoomLobbyScreen from './components/RoomLobbyScreen'
import MultiplayerResultsScreen from './components/MultiplayerResultsScreen'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthService } from './services/auth'
import { hostQuizControl } from './services/quizControl'
import type { User } from 'firebase/auth'
import type { Unsubscribe } from 'firebase/firestore'
import { questionsService } from './services/firestore'

type Screen = 'home' | 'join-room' | 'host-room' | 'room-lobby' | 'multiplayer-quiz' | 'results'

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)
  const [isHost, setIsHost] = useState<boolean>(false)
  const [playerName, setPlayerName] = useState<string>('')
  const autoAdvanceUnsubscribe = useRef<Unsubscribe | null>(null)

  // Navigation functions with authentication
  const goToJoinRoom = async () => {
    setIsAuthenticating(true)
    try {
      const authenticatedUser = await AuthService.signInAnonymously()
      setUser(authenticatedUser)
      setCurrentScreen('join-room')
    } catch (error) {
      // Handle authentication error silently in production
    } finally {
      setIsAuthenticating(false)
    }
  }

  const goToHostRoom = async () => {
    setIsAuthenticating(true)
    try {
      const authenticatedUser = await AuthService.signInAnonymously()
      setUser(authenticatedUser)
      setCurrentScreen('host-room')
    } catch (error) {
      // Handle authentication error silently in production
    } finally {
      setIsAuthenticating(false)
    }
  }

  const goHome = () => setCurrentScreen('home')

  // Room functions with user authentication
  const handleJoinRoom = (roomId: string, _roomCode: string, isHost: boolean, playerName: string) => {
    setCurrentRoomId(roomId)
    setIsHost(isHost)
    setPlayerName(playerName) // Store the player name
    setCurrentScreen('room-lobby')
  }

  const handleRoomCreated = (roomId: string, _roomCode: string, isHost: boolean, hostName: string) => {
    setCurrentRoomId(roomId)
    setIsHost(isHost)
    setPlayerName(hostName) // Store the host name as player name
    setCurrentScreen('room-lobby')
  }

  // Load questions from Firestore on app start (for validation only)
  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true)
      try {
        // Just check if questions exist for validation
        await questionsService.getAllQuestions()
        // Silently validate - no console output in production
      } catch (error: any) {
        // Handle errors silently in production
      } finally {
        setIsLoading(false)
      }
    }

    initializeApp()
  }, [])

  const handleStartGame = () => {
    // Start auto-advance for host users in multiplayer quiz
    if (isHost && currentRoomId) {
      autoAdvanceUnsubscribe.current = hostQuizControl.startAutoAdvance(currentRoomId)
    }
    
    // Multiplayer quiz
    setCurrentScreen('multiplayer-quiz')
  }

  const handleLeaveRoom = () => {
    // Clean up auto-advance when leaving room
    if (autoAdvanceUnsubscribe.current) {
      autoAdvanceUnsubscribe.current()
      autoAdvanceUnsubscribe.current = null
    }
    
    setCurrentRoomId(null)
    setIsHost(false)
    setCurrentScreen('home')
  }

  const handleQuizComplete = () => {
    // Clean up auto-advance when quiz completes
    if (autoAdvanceUnsubscribe.current) {
      autoAdvanceUnsubscribe.current()
      autoAdvanceUnsubscribe.current = null
    }
    
    // Go to results screen instead of home
    setCurrentScreen('results')
  }

  const handlePlayAgain = async () => {
    // Clean up current session
    if (autoAdvanceUnsubscribe.current) {
      autoAdvanceUnsubscribe.current()
      autoAdvanceUnsubscribe.current = null
    }
    
    // Sign out current user and reset state
    try {
      await AuthService.signOut()
      setUser(null)
    } catch (error) {
      // Handle sign out error silently in production
    }
    
    // Reset everything and go back to home for a fresh start with new auth
    setCurrentRoomId(null)
    setIsHost(false)
    setPlayerName('')
    setCurrentScreen('home')
  }

  // Cleanup auto-advance on component unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceUnsubscribe.current) {
        autoAdvanceUnsubscribe.current()
      }
    }
  }, [])

  if (isLoading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <h2>📚 Loading questions...</h2>
            <p>Please wait while we prepare your quiz</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="app">
        {currentScreen === 'home' && (
        <HomeScreen
          onJoinRoom={goToJoinRoom}
          onHostRoom={goToHostRoom}
          isAuthenticating={isAuthenticating}
        />
      )}

      {currentScreen === 'join-room' && (
        <JoinRoomScreen
          userUID={user?.uid || ''}
          onRoomJoined={handleJoinRoom}
          onBack={goHome}
        />
      )}

      {currentScreen === 'host-room' && (
        <HostRoomScreen 
          userUID={user?.uid || ''}
          onRoomCreated={handleRoomCreated}
          onBack={() => setCurrentScreen('home')}
        />
      )}

      {currentScreen === 'room-lobby' && currentRoomId && (
        <RoomLobbyScreen 
          roomId={currentRoomId}
          userUID={user?.uid || ''}
          isHost={isHost}
          onStartGame={handleStartGame}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {currentScreen === 'multiplayer-quiz' && currentRoomId && user && (
        <QuizScreen
          roomId={currentRoomId}
          userUID={user.uid}
          playerName={playerName || "Player"} // Use stored player name or default
          onQuizComplete={handleQuizComplete}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {currentScreen === 'results' && currentRoomId && user && (
        <MultiplayerResultsScreen
          roomId={currentRoomId}
          currentUserUID={user.uid}
          playerName={playerName || "Player"}
          onPlayAgain={handlePlayAgain}
        />
      )}
      </div>
    </ErrorBoundary>
  )
}

export default App
