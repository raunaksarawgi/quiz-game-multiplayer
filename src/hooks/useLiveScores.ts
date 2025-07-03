import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../config/firebase'
import type { LiveScore } from '../services/firestore'

/**
 * Hook to subscribe to live scores in real-time
 */
export const useLiveScores = (roomId: string | null) => {
  const [liveScores, setLiveScores] = useState<LiveScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) {
      setLiveScores([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Subscribe to live scores collection, ordered by rank
    const scoresQuery = query(
      collection(db, 'rooms', roomId, 'liveScores'),
      orderBy('rank', 'asc')
    )

    const unsubscribe = onSnapshot(
      scoresQuery,
      (snapshot) => {
        const scores: LiveScore[] = []
        snapshot.forEach((doc) => {
          scores.push({ ...doc.data() } as LiveScore)
        })
        
        // Sort by rank to ensure correct order
        scores.sort((a, b) => a.rank - b.rank)
        
        setLiveScores(scores)
        setLoading(false)
      },
      (err) => {
        console.error('❌ Error subscribing to live scores:', err)
        setError('Failed to load leaderboard')
        setLoading(false)
      }
    )

    return unsubscribe
  }, [roomId])

  return { liveScores, loading, error }
}
