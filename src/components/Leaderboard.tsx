import type { LiveScore } from '../services/firestore'
import './Leaderboard.css'

interface LeaderboardProps {
  liveScores: LiveScore[]
  currentUserUID: string
  isCompact?: boolean
}

export default function Leaderboard({ liveScores, currentUserUID, isCompact = false }: LeaderboardProps) {
  if (liveScores.length === 0) {
    return (
      <div className={`leaderboard ${isCompact ? 'compact' : ''}`}>
        <div className="leaderboard-header">
          <h3>🏆 Leaderboard</h3>
        </div>
        <div className="leaderboard-empty">
          <p>No scores yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`leaderboard ${isCompact ? 'compact' : ''}`}>
      <div className="leaderboard-header">
        <h3>🏆 Leaderboard</h3>
        <span className="scores-count">{liveScores.length} players</span>
      </div>
      
      <div className="leaderboard-list">
        {liveScores.map((score) => (
          <div
            key={score.userId}
            className={`leaderboard-item ${score.userId === currentUserUID ? 'current-user' : ''}`}
          >
            <div className="rank-badge">
              {score.rank <= 3 ? (
                <span className={`medal rank-${score.rank}`}>
                  {score.rank === 1 ? '🥇' : score.rank === 2 ? '🥈' : '🥉'}
                </span>
              ) : (
                <span className="rank-number">#{score.rank}</span>
              )}
            </div>
            
            <div className="player-info">
              <div className="player-name">
                {score.playerName}
                {score.userId === currentUserUID && <span className="you-badge">You</span>}
              </div>
              {!isCompact && (
                <div className="player-stats">
                  <span className="correct-answers">
                    ✅ {score.correctAnswers}/{score.questionsAnswered}
                  </span>
                  <span className="average-time">
                    ⏱️ {score.averageTime}s avg
                  </span>
                </div>
              )}
            </div>
            
            <div className="score-info">
              <span className="total-score">{score.totalScore.toLocaleString()}</span>
              {!isCompact && <span className="score-label">pts</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
