import { useState, useEffect } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../config/firebase'
import type { LiveScore } from '../services/firestore'
import './MultiplayerResultsScreen.css'

interface MultiplayerResultsScreenProps {
  roomId: string
  currentUserUID: string
  playerName: string
  onPlayAgain: () => void
}

export default function MultiplayerResultsScreen({
  roomId,
  currentUserUID,
  playerName, // Current user's name (for fallback if needed)
  onPlayAgain
}: MultiplayerResultsScreenProps) {
  const [finalResults, setFinalResults] = useState<LiveScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserStats, setCurrentUserStats] = useState<LiveScore | null>(null)

  useEffect(() => {
    const loadFinalResults = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get final scores from the room's liveScores collection
        const scoresQuery = query(
          collection(db, 'rooms', roomId, 'liveScores'),
          orderBy('rank', 'asc')
        )

        const scoresSnapshot = await getDocs(scoresQuery)
        const scores: LiveScore[] = []
        
        scoresSnapshot.forEach((doc) => {
          const scoreData = { ...doc.data() } as LiveScore
          scores.push(scoreData)
          
          // Find current user's stats
          if (scoreData.userId === currentUserUID) {
            setCurrentUserStats(scoreData)
          }
        })

        // Sort by rank to ensure correct order
        scores.sort((a, b) => a.rank - b.rank)
        setFinalResults(scores)
      } catch (err) {
        console.error('❌ Error loading final results:', err)
        setError('Failed to load results. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    if (roomId) {
      loadFinalResults()
    }
    
  }, [roomId, currentUserUID, playerName])

  const getPlayerRankDisplay = (rank: number) => {
    switch (rank) {
      case 1:
        return { emoji: '🥇', text: '1st Place', class: 'gold' }
      case 2:
        return { emoji: '🥈', text: '2nd Place', class: 'silver' }
      case 3:
        return { emoji: '🥉', text: '3rd Place', class: 'bronze' }
      default:
        return { emoji: `#${rank}`, text: `${rank}${getOrdinalSuffix(rank)} Place`, class: 'other' }
    }
  }

  const getOrdinalSuffix = (num: number) => {
    const lastDigit = num % 10
    const lastTwoDigits = num % 100
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return 'th'
    
    switch (lastDigit) {
      case 1: return 'st'
      case 2: return 'nd'
      case 3: return 'rd'
      default: return 'th'
    }
  }

  const getAccuracyPercentage = (score: LiveScore) => {
    return score.questionsAnswered > 0 
      ? Math.round((score.correctAnswers / score.questionsAnswered) * 100)
      : 0
  }

  if (loading) {
    return (
      <div className="results-screen loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h2>📊 Calculating Final Results...</h2>
          <p>Please wait while we compile the leaderboard</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="results-screen error">
        <div className="error-container">
          <h2>⚠️ Error Loading Results</h2>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={onPlayAgain} className="play-again-button">
              🔄 Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="results-screen">
      <div className="results-header">
        <h1>🏆 Quiz Complete!</h1>
        <p>Final Results & Rankings</p>
      </div>

      {/* Current User's Performance */}
      {currentUserStats && (
        <div className="user-performance">
          <div className="performance-card">
            <div className="performance-header">
              <h2>Your Performance</h2>
              <div className={`user-rank ${getPlayerRankDisplay(currentUserStats.rank).class}`}>
                <span className="rank-emoji">{getPlayerRankDisplay(currentUserStats.rank).emoji}</span>
                <span className="rank-text">{getPlayerRankDisplay(currentUserStats.rank).text}</span>
              </div>
            </div>
            
            <div className="performance-stats">
              <div className="stat-item">
                <span className="stat-value">{currentUserStats.totalScore.toLocaleString()}</span>
                <span className="stat-label">Total Points</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{getAccuracyPercentage(currentUserStats)}%</span>
                <span className="stat-label">Accuracy</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{currentUserStats.correctAnswers}/{currentUserStats.questionsAnswered}</span>
                <span className="stat-label">Correct Answers</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Final Leaderboard */}
      <div className="final-leaderboard">
        <h2>🏅 Final Rankings</h2>
        <div className="leaderboard-container">
          {finalResults.map((player) => {
            const rankDisplay = getPlayerRankDisplay(player.rank)
            const isCurrentUser = player.userId === currentUserUID
            
            return (
              <div
                key={player.userId}
                className={`result-item ${rankDisplay.class} ${isCurrentUser ? 'current-user' : ''}`}
              >
                <div className="player-rank">
                  <span className="rank-display">{rankDisplay.emoji}</span>
                </div>
                
                <div className="player-info">
                  <div className="player-name">
                    {player.playerName}
                    {isCurrentUser && <span className="you-badge">You</span>}
                  </div>
                  <div className="player-details">
                    <span className="accuracy">{getAccuracyPercentage(player)}% accuracy</span>
                    <span className="correct-count">{player.correctAnswers}/{player.questionsAnswered} correct</span>
                  </div>
                </div>
                
                <div className="player-score">
                  <span className="score-value">{player.totalScore.toLocaleString()}</span>
                  <span className="score-label">points</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="results-actions">
        <button onClick={onPlayAgain} className="play-again-button">
          🎮 Play Again
        </button>
      </div>
    </div>
  )
}
