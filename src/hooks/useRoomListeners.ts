import { useState, useEffect } from 'react'
import { 
  doc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  type Unsubscribe 
} from 'firebase/firestore'
import { db } from '../config/firebase'
import type { RoomInfo, Participant } from '../services/roomService'

// Hook for listening to room status and info changes
export const useRoomInfo = (roomId: string | null) => {
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) {
      setRoomInfo(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribe = onSnapshot(
      doc(db, 'rooms', roomId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data()
          setRoomInfo({
            id: roomId,
            ...data
          } as RoomInfo)
        } else {
          setError('Room not found')
          setRoomInfo(null)
        }
        setLoading(false)
      },
      (error) => {
        console.error('Room info listener error:', error)
        setError('Failed to load room information')
        setLoading(false)
      }
    )

    return unsubscribe
  }, [roomId])

  return { roomInfo, loading, error }
}

// Hook for listening to room participants
export const useRoomParticipants = (roomId: string | null) => {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [participantCount, setParticipantCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) {
      setParticipants([])
      setParticipantCount(0)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'rooms', roomId, 'participants'),
        orderBy('joinedAt', 'asc')
      ),
      (snapshot) => {
        try {
          const participantList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Participant[]

          setParticipants(participantList)
          setParticipantCount(participantList.length)
          setLoading(false)
        } catch (err) {
          console.error('Participants processing error:', err)
          setError('Failed to process participants')
          setLoading(false)
        }
      },
      (error) => {
        console.error('Participants listener error:', error)
        setError('Failed to load participants')
        setLoading(false)
      }
    )

    return unsubscribe
  }, [roomId])

  return { participants, participantCount, loading, error }
}

// Hook for listening to current question changes
export const useCurrentQuestion = (roomId: string | null, questionIndex: number = 0) => {
  const [currentQuestion, setCurrentQuestion] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) {
      setCurrentQuestion(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribe = onSnapshot(
      doc(db, 'rooms', roomId, 'questions', questionIndex.toString()),
      (snapshot) => {
        if (snapshot.exists()) {
          setCurrentQuestion({
            id: snapshot.id,
            ...snapshot.data()
          })
        } else {
          setCurrentQuestion(null)
        }
        setLoading(false)
      },
      (error) => {
        console.error('Current question listener error:', error)
        setError('Failed to load current question')
        setLoading(false)
      }
    )

    return unsubscribe
  }, [roomId, questionIndex])

  return { currentQuestion, loading, error }
}

// Hook for listening to all questions in a room
export const useRoomQuestions = (roomId: string | null) => {
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) {
      setQuestions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribe = onSnapshot(
      collection(db, 'rooms', roomId, 'questions'),
      (snapshot) => {
        try {
          const questionList = snapshot.docs
            .map(doc => ({
              id: doc.id,
              index: parseInt(doc.id),
              ...doc.data()
            }))
            .sort((a, b) => a.index - b.index) // Sort by question index

          setQuestions(questionList)
          setLoading(false)
        } catch (err) {
          console.error('Questions processing error:', err)
          setError('Failed to process questions')
          setLoading(false)
        }
      },
      (error) => {
        console.error('Questions listener error:', error)
        setError('Failed to load questions')
        setLoading(false)
      }
    )

    return unsubscribe
  }, [roomId])

  return { questions, loading, error }
}

// Hook for listening to participant answers for a specific question
export const useQuestionAnswers = (roomId: string | null, questionIndex: number = 0) => {
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [answerCount, setAnswerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) {
      setAnswers({})
      setAnswerCount(0)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribe = onSnapshot(
      collection(db, 'rooms', roomId, 'answers'),
      (snapshot) => {
        try {
          const answerData: Record<string, any> = {}
          let count = 0

          snapshot.docs.forEach(doc => {
            const userAnswers = doc.data()
            const questionKey = `q${questionIndex}`
            
            if (userAnswers[questionKey]) {
              answerData[doc.id] = {
                userId: doc.id,
                ...userAnswers[questionKey]
              }
              count++
            }
          })

          setAnswers(answerData)
          setAnswerCount(count)
          setLoading(false)
        } catch (err) {
          console.error('Answer processing error:', err)
          setError('Failed to process answers')
          setLoading(false)
        }
      },
      (error) => {
        console.error('Answer listener error:', error)
        setError('Failed to load answers')
        setLoading(false)
      }
    )

    return unsubscribe
  }, [roomId, questionIndex])

  return { answers, answerCount, loading, error }
}

// Hook for listening to all participant answers (for host dashboard)
export const useAllAnswers = (roomId: string | null) => {
  const [allAnswers, setAllAnswers] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) {
      setAllAnswers({})
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribe = onSnapshot(
      collection(db, 'rooms', roomId, 'answers'),
      (snapshot) => {
        try {
          const answerData: Record<string, any> = {}

          snapshot.docs.forEach(doc => {
            answerData[doc.id] = {
              userId: doc.id,
              ...doc.data()
            }
          })

          setAllAnswers(answerData)
          setLoading(false)
        } catch (err) {
          console.error('All answers processing error:', err)
          setError('Failed to process all answers')
          setLoading(false)
        }
      },
      (error) => {
        console.error('All answers listener error:', error)
        setError('Failed to load all answers')
        setLoading(false)
      }
    )

    return unsubscribe
  }, [roomId])

  return { allAnswers, loading, error }
}

// Hook for listening to live scores/leaderboard
export const useRoomScores = (roomId: string | null) => {
  const [scores, setScores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) {
      setScores([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'rooms', roomId, 'scores'),
        orderBy('totalScore', 'desc') // Order by highest score first
      ),
      (snapshot) => {
        try {
          const scoreList = snapshot.docs.map((doc, index) => ({
            id: doc.id,
            userId: doc.id,
            rank: index + 1, // Calculate rank based on order
            ...doc.data()
          }))

          setScores(scoreList)
          setLoading(false)
        } catch (err) {
          console.error('Scores processing error:', err)
          setError('Failed to process scores')
          setLoading(false)
        }
      },
      (error) => {
        console.error('Scores listener error:', error)
        setError('Failed to load scores')
        setLoading(false)
      }
    )

    return unsubscribe
  }, [roomId])

  return { scores, loading, error }
}

// Hook for listening to live leaderboard
export const useLiveLeaderboard = (roomId: string | null) => {
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) {
      setLeaderboard([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'rooms', roomId, 'liveScores'),
        orderBy('totalScore', 'desc')
      ),
      (snapshot) => {
        try {
          const scores = snapshot.docs.map((doc, index) => ({
            id: doc.id,
            rank: index + 1,
            ...doc.data()
          }))

          setLeaderboard(scores)
          setLoading(false)
        } catch (err) {
          console.error('Live leaderboard processing error:', err)
          setError('Failed to process leaderboard')
          setLoading(false)
        }
      },
      (error) => {
        console.error('Live leaderboard listener error:', error)
        setError('Failed to load leaderboard')
        setLoading(false)
      }
    )

    return unsubscribe
  }, [roomId])

  return { leaderboard, loading, error }
}

// Hook for listening to question results
export const useQuestionResult = (roomId: string | null, questionIndex: number = 0) => {
  const [questionResult, setQuestionResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) {
      setQuestionResult(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribe = onSnapshot(
      doc(db, 'rooms', roomId, 'questionResults', questionIndex.toString()),
      (snapshot) => {
        if (snapshot.exists()) {
          setQuestionResult({
            id: snapshot.id,
            ...snapshot.data()
          })
        } else {
          setQuestionResult(null)
        }
        setLoading(false)
      },
      (error) => {
        console.error('Question result listener error:', error)
        setError('Failed to load question result')
        setLoading(false)
      }
    )

    return unsubscribe
  }, [roomId, questionIndex])

  return { questionResult, loading, error }
}

// Comprehensive hook that combines multiple listeners for room dashboard
export const useRoomDashboard = (roomId: string | null) => {
  const roomInfo = useRoomInfo(roomId)
  const participants = useRoomParticipants(roomId)
  const questions = useRoomQuestions(roomId)
  const scores = useRoomScores(roomId)

  // Current question based on room info
  const currentQuestion = useCurrentQuestion(
    roomId, 
    roomInfo.roomInfo?.currentQuestionIndex || 0
  )

  // Answers for current question
  const currentAnswers = useQuestionAnswers(
    roomId, 
    roomInfo.roomInfo?.currentQuestionIndex || 0
  )

  const loading = 
    roomInfo.loading || 
    participants.loading || 
    questions.loading || 
    scores.loading

  const error = 
    roomInfo.error || 
    participants.error || 
    questions.error || 
    scores.error

  return {
    // Room data
    roomInfo: roomInfo.roomInfo,
    
    // Participants
    participants: participants.participants,
    participantCount: participants.participantCount,
    
    // Questions
    questions: questions.questions,
    currentQuestion: currentQuestion.currentQuestion,
    
    // Answers & Scores
    currentAnswers: currentAnswers.answers,
    answerCount: currentAnswers.answerCount,
    scores: scores.scores,
    
    // Loading & Error states
    loading,
    error
  }
}

// Hook for cleanup when leaving a room
export const useRoomCleanup = () => {
  const unsubscribeFunctions = useState<Unsubscribe[]>([])

  const addUnsubscribe = (unsubscribe: Unsubscribe) => {
    unsubscribeFunctions[0].push(unsubscribe)
  }

  const cleanupAll = () => {
    unsubscribeFunctions[0].forEach(unsubscribe => unsubscribe())
    unsubscribeFunctions[1]([])
  }

  useEffect(() => {
    return cleanupAll // Cleanup on component unmount
  }, [])

  return { addUnsubscribe, cleanupAll }
}
