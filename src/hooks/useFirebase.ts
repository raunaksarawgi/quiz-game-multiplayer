/**
 * useFirebase - Comprehensive React hooks for Firebase/Firestore operations
 * 
 * This module provides custom React hooks for managing Firebase/Firestore operations
 * in the QUIZMO multiplayer quiz application.
 * 
 * Available hooks:
 * 
 * 1. useQuestions() - Manage quiz questions CRUD operations
 *    - loadAllQuestions() - Load all questions with optional sorting/filtering
 *    - loadQuestionsByCategory() - Load questions filtered by category
 *    - loadQuestionsByDifficulty() - Load questions filtered by difficulty
 *    - loadRandomQuestions() - Load random questions for quiz generation
 *    - addQuestion() - Add new question to Firestore
 * 
 * 2. useQuestionMetadata() - Manage question categories and statistics
 *    - loadCategories() - Get all available question categories
 *    - loadStats() - Get question statistics (total, by category, by difficulty)
 *    - loadMetadata() - Load both categories and stats
 * 
 * 3. useRoomAnswers(roomId) - Manage multiplayer room answers and scoring
 *    - collectQuestionAnswers() - Collect all answers for a specific question
 *    - updateLiveScores() - Calculate and update live scores after each question
 *    - createQuestionResult() - Create question result summary for answer reveal
 *    - getLiveLeaderboard() - Get current leaderboard for the room
 * 
 * 4. useFirestoreUtils() - Access utility functions
 *    - formatTimestamp() - Format Firestore timestamps to readable dates
 *    - getRelativeTime() - Get relative time (e.g., "2 hours ago")
 *    - validateQuestionData() - Validate question data before saving
 *    - generateQuizSummary() - Generate quiz summary statistics
 * 
 * 5. useQuestionValidation() - Real-time question validation
 *    - validateQuestion() - Validate question data and get errors
 *    - clearValidation() - Clear validation state
 * 
 * 6. useFirebase() - Main hook that provides access to all other hooks
 *    - questions, metadata, utils, validation - Direct access to other hooks
 *    - createRoomAnswersHook() - Factory function to create room-specific hooks
 * 
 * Example usage:
 * 
 * ```tsx
 * // Load and display questions
 * const { questions, loading, error, loadAllQuestions } = useQuestions()
 * 
 * useEffect(() => {
 *   loadAllQuestions({ orderBy: 'createdAt', limitCount: 10 })
 * }, [])
 * 
 * // Manage room answers
 * const roomAnswers = useRoomAnswers(roomId)
 * const answers = await roomAnswers.collectQuestionAnswers(0)
 * 
 * // Use the main hook
 * const firebase = useFirebase()
 * const roomHook = firebase.createRoomAnswersHook(roomId)
 * ```
 */

import { useState, useCallback } from 'react'
import { 
  questionsService, 
  roomAnswerService, 
  firestoreUtils,
  type QuizQuestion,
  type RoomAnswer,
  type LiveScore,
  type QuestionResult
} from '../services/firestore'

// Hook for managing quiz questions
export const useQuestions = () => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAllQuestions = useCallback(async (options?: {
    orderBy?: 'createdAt' | 'timeLimit' | 'category'
    orderDirection?: 'asc' | 'desc'
    limitCount?: number
  }) => {
    setLoading(true)
    setError(null)
    try {
      const data = await questionsService.getAllQuestions(options)
      setQuestions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadQuestionsByCategory = useCallback(async (
    category: string, 
    options?: { difficulty?: 'easy' | 'medium' | 'hard'; limitCount?: number }
  ) => {
    setLoading(true)
    setError(null)
    try {
      const data = await questionsService.getQuestionsByCategory(category, options)
      setQuestions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions by category')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadQuestionsByDifficulty = useCallback(async (
    difficulty: 'easy' | 'medium' | 'hard',
    limitCount?: number
  ) => {
    setLoading(true)
    setError(null)
    try {
      const data = await questionsService.getQuestionsByDifficulty(difficulty, limitCount)
      setQuestions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions by difficulty')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRandomQuestions = useCallback(async (
    count: number,
    filters?: {
      category?: string
      difficulty?: 'easy' | 'medium' | 'hard'
      excludeIds?: string[]
    }
  ) => {
    setLoading(true)
    setError(null)
    try {
      const data = await questionsService.getRandomQuestions(count, filters)
      setQuestions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load random questions')
    } finally {
      setLoading(false)
    }
  }, [])

  const addQuestion = useCallback(async (questionData: Omit<QuizQuestion, 'id' | 'createdAt'>) => {
    setLoading(true)
    setError(null)
    try {
      const questionId = await questionsService.addQuestion(questionData)
      // Reload questions to include the new one
      await loadAllQuestions()
      return questionId
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add question')
      throw err
    } finally {
      setLoading(false)
    }
  }, [loadAllQuestions])

  return {
    questions,
    loading,
    error,
    loadAllQuestions,
    loadQuestionsByCategory,
    loadQuestionsByDifficulty,
    loadRandomQuestions,
    addQuestion
  }
}

// Hook for managing question metadata
export const useQuestionMetadata = () => {
  const [categories, setCategories] = useState<string[]>([])
  const [stats, setStats] = useState<{
    total: number
    byCategory: Record<string, number>
    byDifficulty: Record<string, number>
    averageTimeLimit: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await questionsService.getCategories()
      setCategories(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await questionsService.getQuestionStats()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load question stats')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMetadata = useCallback(async () => {
    await Promise.all([loadCategories(), loadStats()])
  }, [loadCategories, loadStats])

  return {
    categories,
    stats,
    loading,
    error,
    loadCategories,
    loadStats,
    loadMetadata
  }
}

// Hook for managing room answers and scoring
export const useRoomAnswers = (roomId: string) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const collectQuestionAnswers = useCallback(async (questionIndex: number): Promise<RoomAnswer[]> => {
    if (!roomId) return []
    
    setLoading(true)
    setError(null)
    try {
      const answers = await roomAnswerService.collectQuestionAnswers(roomId, questionIndex)
      return answers
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to collect question answers')
      throw err
    } finally {
      setLoading(false)
    }
  }, [roomId])

  const updateLiveScores = useCallback(async (questionIndex: number): Promise<LiveScore[]> => {
    if (!roomId) return []
    
    setLoading(true)
    setError(null)
    try {
      const scores = await roomAnswerService.updateLiveScores(roomId, questionIndex)
      return scores
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update live scores')
      throw err
    } finally {
      setLoading(false)
    }
  }, [roomId])

  const createQuestionResult = useCallback(async (questionIndex: number): Promise<QuestionResult> => {
    if (!roomId) throw new Error('Room ID is required')
    
    setLoading(true)
    setError(null)
    try {
      const result = await roomAnswerService.createQuestionResult(roomId, questionIndex)
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create question result')
      throw err
    } finally {
      setLoading(false)
    }
  }, [roomId])

  const getLiveLeaderboard = useCallback(async (): Promise<LiveScore[]> => {
    if (!roomId) return []
    
    setLoading(true)
    setError(null)
    try {
      const leaderboard = await roomAnswerService.getLiveLeaderboard(roomId)
      return leaderboard
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get live leaderboard')
      throw err
    } finally {
      setLoading(false)
    }
  }, [roomId])

  return {
    loading,
    error,
    collectQuestionAnswers,
    updateLiveScores,
    createQuestionResult,
    getLiveLeaderboard
  }
}

// Hook for firestore utilities
export const useFirestoreUtils = () => {
  const formatTimestamp = useCallback((timestamp: any) => {
    return firestoreUtils.formatTimestamp(timestamp)
  }, [])

  const getRelativeTime = useCallback((timestamp: any) => {
    return firestoreUtils.getRelativeTime(timestamp)
  }, [])

  const validateQuestionData = useCallback((questionData: Partial<QuizQuestion>) => {
    return firestoreUtils.validateQuestionData(questionData)
  }, [])

  const generateQuizSummary = useCallback((questions: QuizQuestion[]) => {
    return firestoreUtils.generateQuizSummary(questions)
  }, [])

  return {
    formatTimestamp,
    getRelativeTime,
    validateQuestionData,
    generateQuizSummary
  }
}

// Hook for question validation with real-time feedback
export const useQuestionValidation = () => {
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isValid, setIsValid] = useState(false)

  const validateQuestion = useCallback((questionData: Partial<QuizQuestion>) => {
    const errors = firestoreUtils.validateQuestionData(questionData)
    setValidationErrors(errors)
    setIsValid(errors.length === 0)
    return errors
  }, [])

  const clearValidation = useCallback(() => {
    setValidationErrors([])
    setIsValid(false)
  }, [])

  return {
    validationErrors,
    isValid,
    validateQuestion,
    clearValidation
  }
}

// Main hook that combines all Firebase functionality
export const useFirebase = () => {
  const questions = useQuestions()
  const metadata = useQuestionMetadata()
  const utils = useFirestoreUtils()
  const validation = useQuestionValidation()

  // Create room answers hook factory
  const createRoomAnswersHook = useCallback((roomId: string) => {
    return useRoomAnswers(roomId)
  }, [])

  return {
    questions,
    metadata,
    utils,
    validation,
    createRoomAnswersHook
  }
}

export default useFirebase
