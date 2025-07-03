import { useState, useEffect, useCallback } from 'react'
import { doc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useRoomInfo, useCurrentQuestion } from '../hooks/useRoomListeners'
import { useQuizTimer, type QuizTimerState } from '../services/quizControl'
import { useLiveScores } from '../hooks/useLiveScores'
import Leaderboard from './Leaderboard'
import './QuizScreen.css'

interface QuizScreenProps {
  roomId: string
  userUID: string
  playerName: string
  onQuizComplete: () => void
  onLeaveRoom: () => void
}

export default function QuizScreen({
  roomId,
  userUID,
  playerName,
  onQuizComplete,
  onLeaveRoom
}: QuizScreenProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [timeLeft, setTimeLeft] = useState(30)
  const [currentScore, setCurrentScore] = useState(0)
  const [timerState, setTimerState] = useState<QuizTimerState | null>(null)
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  // Room listeners
  const { roomInfo, loading: roomLoading, error: roomError } = useRoomInfo(roomId)
  const { currentQuestion, loading: questionLoading } = useCurrentQuestion(
    roomId, 
    roomInfo?.currentQuestionIndex || 0
  )

  // Live scores for leaderboard
  const { liveScores, loading: scoresLoading } = useLiveScores(roomId)

  // Timer subscription
  const { subscribeToTimer } = useQuizTimer(roomId)

  // Subscribe to synchronized timer
  useEffect(() => {
    const unsubscribe = subscribeToTimer((timer) => {
      setTimerState(timer)
      if (timer) {
        const newTimeLeft = Math.floor(timer.timeRemaining)
        setTimeLeft(newTimeLeft)
      }
    })

    return unsubscribe
  }, [roomId])

  // Real-time countdown effect
  useEffect(() => {
    if (!timerState?.isActive || !timerState?.questionStartTime) {
      return
    }

    const interval = setInterval(() => {
      const now = Date.now() / 1000 // Convert to seconds
      const startTime = timerState.questionStartTime.seconds
      const elapsed = now - startTime
      const remaining = timerState.questionDuration - elapsed
      
      setTimeLeft(Math.floor(remaining))
      
      // Stop the interval if time goes below -1 (after answer processing)
      if (remaining <= -2) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [timerState?.isActive, timerState?.questionStartTime, timerState?.questionDuration])

  // Current question details
  const questionNumber = (roomInfo?.currentQuestionIndex || 0) + 1
  const totalQuestions = roomInfo?.questionCount || 0
  const progressPercentage = ((questionNumber - 1) / totalQuestions) * 100

  // Reset state when question changes
  useEffect(() => {
    if (currentQuestion && currentQuestion.id !== currentQuestionId) {      
      // Reset state for new question
      setSelectedAnswer(null)
      setAnswered(false)
      setCurrentQuestionId(currentQuestion.id)
    }
  }, [roomInfo?.currentQuestionIndex, currentQuestion?.id, currentQuestionId])

  // Handle quiz completion
  useEffect(() => {
    if (roomInfo?.status === 'completed') {
      onQuizComplete()
    }
  }, [roomInfo?.status, onQuizComplete])

  const submitAnswer = useCallback(async (finalAnswer: number) => {
    try {
      const timeSpent = (timerState?.questionDuration || 30) - timeLeft
      const isCorrect = finalAnswer === (currentQuestion?.correctAnswer || -1)
      const questionIndex = roomInfo?.currentQuestionIndex || 0
      
      // Calculate score for this question
      let questionScore = 0
      if (isCorrect && finalAnswer !== -1) {
        // Score based on speed: max points for fastest answer
        const maxPoints = 1000
        const timeBonus = Math.max(0, (timeLeft / (timerState?.questionDuration || 30)) * 200)
        questionScore = Math.round(maxPoints + timeBonus)
      }

      // Update personal score
      setCurrentScore(prev => prev + questionScore)

      // Submit answer to room's answers subcollection
      const answerData = {
        [`q${questionIndex}`]: {
          answer: finalAnswer,
          isCorrect,
          timeSpent,
          score: questionScore,
          submittedAt: Timestamp.now()
        }
      }

      await setDoc(
        doc(db, 'rooms', roomId, 'answers', userUID),
        answerData,
        { merge: true }
      )
    } catch (error) {
      console.error('❌ Error submitting answer:', error)
    }
  }, [timerState, timeLeft, currentQuestion, roomInfo, roomId, userUID])

  const handleTimeUp = useCallback(async () => {
    // Don't auto-submit if already answered or no current question
    if (answered || !currentQuestion) {
      return
    }
    
    setAnswered(true)
    
    // Submit selected answer or -1 if no selection
    await submitAnswer(selectedAnswer !== null ? selectedAnswer : -1)
  }, [answered, selectedAnswer, submitAnswer, currentQuestion])

  // Auto-submit when timer reaches -1 - SIMPLE AND RELIABLE APPROACH
  useEffect(() => {
    // Simple rule: Only auto-submit if ALL conditions are met:
    // 1. Timer has reached -1 (so 0 is shown as part of countdown)
    // 2. User hasn't answered yet  
    // 3. Timer is active
    // 4. We have a current question
    // 5. Current question matches the timer's question (prevents stale state)
    const timerQuestionIndex = timerState?.currentQuestionIndex
    const currentQuestionIndex = roomInfo?.currentQuestionIndex
    const questionIndexMatches = timerQuestionIndex === currentQuestionIndex
    
    if (
      timeLeft === -1 && 
      !answered && 
      timerState?.isActive && 
      currentQuestion &&
      questionIndexMatches
    ) {
      handleTimeUp()
    }
  }, [timeLeft, answered, timerState?.isActive, timerState?.currentQuestionIndex, currentQuestion, roomInfo?.currentQuestionIndex, handleTimeUp])

  const handleAnswerSelection = (answerIndex: number) => {
    // Only allow answer selection if timer is active, time > 0, not answered, and we have current question
    // Allow selection at 0 but not at -1 (so 0 is part of the countdown)
    if (answered || timeLeft < 0 || !timerState?.isActive || !currentQuestion) {
      return
    }
    
    setSelectedAnswer(answerIndex)
    // Don't submit immediately - wait for timer to end
  }

  const getAnswerClass = (index: number) => {
    if (!answered) return 'answer-option'
    
    if (index === currentQuestion?.correctAnswer) {
      return 'answer-option correct'
    } else if (index === selectedAnswer) {
      return 'answer-option incorrect'
    }
    return 'answer-option'
  }

  // Loading states
  if (roomLoading || questionLoading) {
    return (
      <div className="quiz-screen loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading quiz...</p>
        </div>
      </div>
    )
  }

  // Error states
  if (roomError) {
    return (
      <div className="quiz-screen error">
        <div className="error-container">
          <h2>⚠️ Error</h2>
          <p>{roomError}</p>
          <button onClick={onLeaveRoom} className="leave-button">
            Leave Room
          </button>
        </div>
      </div>
    )
  }

  // No current question
  if (!currentQuestion) {
    return (
      <div className="quiz-screen waiting">
        <div className="waiting-container">
          <h2>🎯 Waiting for Quiz</h2>
          <p>The host will start the quiz soon...</p>
          <button onClick={onLeaveRoom} className="leave-button">
            Leave Room
          </button>
        </div>
      </div>
    )
  }

  const timePercentage = timerState?.questionDuration 
    ? (Math.max(0, timeLeft) / timerState.questionDuration) * 100 
    : (Math.max(0, timeLeft) / (currentQuestion?.timeLimit || 30)) * 100

  return (
    <div className="quiz-screen">
      <div className="quiz-header">
        <div className="player-info">
          <span className="player-name">👤 {playerName}</span>
          <span className="current-score">🏆 {currentScore}</span>
        </div>
        
        <div className="header-controls">
          <button 
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className={`leaderboard-toggle ${showLeaderboard ? 'active' : ''}`}
            title="Toggle Leaderboard"
          >
            🏆 Leaderboard
          </button>
        </div>
        
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
          <span className="question-counter">
            {questionNumber} / {totalQuestions}
          </span>
        </div>
      </div>

      <div className={`quiz-main ${showLeaderboard ? 'with-leaderboard' : ''}`}>
        <div className="quiz-content">
          <div className="timer-container">
            <div className="timer-circle">
              <svg width="80" height="80" className="timer-svg">
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  stroke="#e1e5e9"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="35"
                  stroke={timeLeft <= 5 ? "#ff4757" : "#667eea"}
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={220}
                  strokeDashoffset={220 - (220 * timePercentage) / 100}
                  className="timer-progress"
                />
              </svg>
              <span className={`timer-text ${timeLeft <= 5 && timeLeft >= 0 ? 'urgent' : ''}`}>
                {Math.max(0, timeLeft)}
              </span>
            </div>
          </div>

          <div className="question-container">
            <h2 className="question-text">{currentQuestion.question}</h2>
            
            <div className="answers-grid">
              {currentQuestion.options?.map((option: string, index: number) => (
                <button
                  key={index}
                  className={`${getAnswerClass(index)} ${selectedAnswer === index ? 'selected' : ''}`}
                  onClick={() => handleAnswerSelection(index)}
                  disabled={answered || timeLeft < 0 || !timerState?.isActive}
                >
                  <span className="answer-letter">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="answer-text">{option}</span>
                </button>
              ))}
            </div>

            {selectedAnswer !== null && !answered && (
              <div className="selection-info">
                <p>Answer selected: <strong>{String.fromCharCode(65 + selectedAnswer)}</strong></p>
                <p>⏱️ Will submit when timer ends</p>
              </div>
            )}

            {answered && (
              <div className="answer-result">
                {selectedAnswer === currentQuestion.correctAnswer ? (
                  <p className="correct-answer">🎉 Correct! +{Math.round(1000 + (timeLeft / (timerState?.questionDuration || currentQuestion.timeLimit || 30)) * 200)} points</p>
                ) : (
                  <p className="incorrect-answer">❌ Incorrect. Correct answer: {String.fromCharCode(65 + (currentQuestion.correctAnswer || 0))}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {showLeaderboard && (
          <div className="leaderboard-sidebar">
            {scoresLoading ? (
              <div className="leaderboard-loading">
                <div className="loading-spinner"></div>
                <p>Loading scores...</p>
              </div>
            ) : (
              <Leaderboard 
                liveScores={liveScores} 
                currentUserUID={userUID}
                isCompact={true}
              />
            )}
          </div>
        )}
      </div>

      <div className="quiz-footer">
        <button onClick={onLeaveRoom} className="leave-room-button">
          🚪 Leave Room
        </button>
      </div>
    </div>
  )
}
