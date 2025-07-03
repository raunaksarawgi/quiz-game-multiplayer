import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  doc,
  query, 
  orderBy, 
  limit,
  where,
  Timestamp,
  setDoc
} from 'firebase/firestore'
import { db } from '../config/firebase'

// Types for Firestore data
export interface QuizQuestion {
  id?: string
  question: string
  options: string[]
  correctAnswer: number
  timeLimit: number
  category?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  createdAt: Timestamp
}

export interface SinglePlayerScore {
  id?: string
  playerName: string
  score: number
  correctAnswers: number
  totalQuestions: number
  accuracy: number
  completedAt: Timestamp
  timeSpent: number
  category?: string
}

// Real-time multiplayer quiz services
export interface RoomAnswer {
  userId: string
  playerName: string
  questionIndex: number
  answer: number
  isCorrect: boolean
  timeSpent: number
  score: number
  submittedAt: Timestamp
}

export interface LiveScore {
  userId: string
  playerName: string
  totalScore: number
  correctAnswers: number
  questionsAnswered: number
  averageTime: number
  rank: number
  lastUpdated: Timestamp
}

export interface QuestionResult {
  questionIndex: number
  question: string
  correctAnswer: number
  options: string[]
  totalParticipants: number
  answers: RoomAnswer[]
  correctCount: number
  incorrectCount: number
  averageTime: number
  revealedAt: Timestamp
}



// Enhanced Quiz Questions Service
export const questionsService = {
  // Add a new question to Firestore with validation
  async addQuestion(questionData: Omit<QuizQuestion, 'id' | 'createdAt'>): Promise<string> {
    try {
      // Validate question data
      if (!questionData.question?.trim()) {
        throw new Error('Question text is required')
      }
      if (!questionData.options || questionData.options.length < 2) {
        throw new Error('At least 2 options are required')
      }
      if (questionData.correctAnswer < 0 || questionData.correctAnswer >= questionData.options.length) {
        throw new Error('Correct answer index is invalid')
      }
      if (questionData.timeLimit <= 0) {
        throw new Error('Time limit must be positive')
      }

      const validatedData = {
        ...questionData,
        question: questionData.question.trim(),
        options: questionData.options.map(opt => opt.trim()).filter(opt => opt.length > 0),
        createdAt: Timestamp.now()
      }

      const docRef = await addDoc(collection(db, 'questions'), validatedData)
      return docRef.id
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to add question')
    }
  },

  // Get all questions with optional sorting and filtering
  async getAllQuestions(options: {
    orderBy?: 'createdAt' | 'timeLimit' | 'category'
    orderDirection?: 'asc' | 'desc'
    limitCount?: number
  } = {}): Promise<QuizQuestion[]> {
    try {
      const { 
        orderBy: orderField = 'createdAt', 
        orderDirection = 'desc', 
        limitCount 
      } = options

      let q = query(
        collection(db, 'questions'),
        orderBy(orderField, orderDirection)
      )

      if (limitCount) {
        q = query(q, limit(limitCount))
      }

      const querySnapshot = await getDocs(q)
      const questions: QuizQuestion[] = []
      
      querySnapshot.forEach((doc) => {
        questions.push({
          id: doc.id,
          ...doc.data()
        } as QuizQuestion)
      })
      
      return questions
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch questions')
    }
  },

  // Get questions by category with improved filtering
  async getQuestionsByCategory(
    category: string, 
    options: { 
      difficulty?: 'easy' | 'medium' | 'hard'
      limitCount?: number 
    } = {}
  ): Promise<QuizQuestion[]> {
    try {
      let q = query(
        collection(db, 'questions'),
        where('category', '==', category),
        orderBy('createdAt', 'desc')
      )

      if (options.limitCount) {
        q = query(q, limit(options.limitCount))
      }

      const querySnapshot = await getDocs(q)
      const questions: QuizQuestion[] = []
      
      querySnapshot.forEach((doc) => {
        const data = doc.data() as QuizQuestion
        // Additional filtering by difficulty if specified
        if (!options.difficulty || data.difficulty === options.difficulty) {
          questions.push({
            id: doc.id,
            ...data
          })
        }
      })
      
      return questions
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch questions by category')
    }
  },

  // Get questions by difficulty
  async getQuestionsByDifficulty(
    difficulty: 'easy' | 'medium' | 'hard',
    limitCount?: number
  ): Promise<QuizQuestion[]> {
    try {
      let q = query(
        collection(db, 'questions'),
        where('difficulty', '==', difficulty),
        orderBy('createdAt', 'desc')
      )

      if (limitCount) {
        q = query(q, limit(limitCount))
      }

      const querySnapshot = await getDocs(q)
      const questions: QuizQuestion[] = []
      
      querySnapshot.forEach((doc) => {
        questions.push({
          id: doc.id,
          ...doc.data()
        } as QuizQuestion)
      })
      
      return questions
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch questions by difficulty')
    }
  },

  // Get random questions for quiz generation
  async getRandomQuestions(
    count: number,
    filters: {
      category?: string
      difficulty?: 'easy' | 'medium' | 'hard'
      excludeIds?: string[]
    } = {}
  ): Promise<QuizQuestion[]> {
    try {
      // First get all questions that match filters
      let allQuestions: QuizQuestion[] = []

      if (filters.category) {
        allQuestions = await this.getQuestionsByCategory(filters.category, { 
          difficulty: filters.difficulty 
        })
      } else if (filters.difficulty) {
        allQuestions = await this.getQuestionsByDifficulty(filters.difficulty)
      } else {
        allQuestions = await this.getAllQuestions()
      }

      // Filter out excluded IDs
      if (filters.excludeIds?.length) {
        allQuestions = allQuestions.filter(q => !filters.excludeIds!.includes(q.id!))
      }

      // Shuffle and take requested count
      const shuffled = allQuestions.sort(() => Math.random() - 0.5)
      const selected = shuffled.slice(0, Math.min(count, shuffled.length))

      return selected
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch random questions')
    }
  },

  // Get question by ID
  async getQuestionById(questionId: string): Promise<QuizQuestion | null> {
    try {
      const docSnap = await getDoc(doc(db, 'questions', questionId))
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as QuizQuestion
      }
      
      return null
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch question')
    }
  },

  // Get available categories
  async getCategories(): Promise<string[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'questions'))
      const categories = new Set<string>()
      
      querySnapshot.forEach((doc) => {
        const data = doc.data() as QuizQuestion
        if (data.category) {
          categories.add(data.category)
        }
      })
      
      const categoryList = Array.from(categories).sort()
      return categoryList
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch categories')
    }
  },

  // Get question statistics
  async getQuestionStats(): Promise<{
    total: number
    byCategory: Record<string, number>
    byDifficulty: Record<string, number>
    averageTimeLimit: number
  }> {
    try {
      const querySnapshot = await getDocs(collection(db, 'questions'))
      const questions: QuizQuestion[] = []
      
      querySnapshot.forEach((doc) => {
        questions.push(doc.data() as QuizQuestion)
      })

      const byCategory: Record<string, number> = {}
      const byDifficulty: Record<string, number> = {}
      let totalTimeLimit = 0

      questions.forEach(q => {
        if (q.category) {
          byCategory[q.category] = (byCategory[q.category] || 0) + 1
        }
        if (q.difficulty) {
          byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] || 0) + 1
        }
        totalTimeLimit += q.timeLimit
      })

      return {
        total: questions.length,
        byCategory,
        byDifficulty,
        averageTimeLimit: questions.length > 0 ? Math.round(totalTimeLimit / questions.length) : 0
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch question statistics')
    }
  }
}

// Utility functions for data processing
export const firestoreUtils = {
  // Convert Firestore timestamp to readable date
  formatTimestamp(timestamp: Timestamp): string {
    return timestamp.toDate().toLocaleDateString()
  },

  // Convert Firestore timestamp to relative time
  getRelativeTime(timestamp: Timestamp): string {
    const now = new Date()
    const date = timestamp.toDate()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffMs / (1000 * 60))

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
    return 'Just now'
  },

  // Validate single player score data before saving
  validateScoreData(scoreData: Partial<SinglePlayerScore>): string[] {
    const errors: string[] = []
    
    if (!scoreData.playerName?.trim()) {
      errors.push('Player name is required')
    }
    if (typeof scoreData.score !== 'number' || scoreData.score < 0) {
      errors.push('Score must be a non-negative number')
    }
    if (typeof scoreData.correctAnswers !== 'number' || scoreData.correctAnswers < 0) {
      errors.push('Correct answers must be a non-negative number')
    }
    if (typeof scoreData.totalQuestions !== 'number' || scoreData.totalQuestions <= 0) {
      errors.push('Total questions must be a positive number')
    }
    if (scoreData.correctAnswers && scoreData.totalQuestions && 
        scoreData.correctAnswers > scoreData.totalQuestions) {
      errors.push('Correct answers cannot exceed total questions')
    }

    return errors
  },

  // Validate question data
  validateQuestionData(questionData: Partial<QuizQuestion>): string[] {
    const errors: string[] = []
    
    if (!questionData.question?.trim()) {
      errors.push('Question text is required')
    }
    if (!questionData.options || questionData.options.length < 2) {
      errors.push('At least 2 options are required')
    }
    if (questionData.options && questionData.options.some(opt => !opt?.trim())) {
      errors.push('All options must have text')
    }
    if (typeof questionData.correctAnswer !== 'number' || 
        questionData.correctAnswer < 0 || 
        (questionData.options && questionData.correctAnswer >= questionData.options.length)) {
      errors.push('Correct answer index is invalid')
    }
    if (typeof questionData.timeLimit !== 'number' || questionData.timeLimit <= 0) {
      errors.push('Time limit must be a positive number')
    }

    return errors
  },

  // Generate quiz summary
  generateQuizSummary(questions: QuizQuestion[]): {
    totalQuestions: number
    categoriesCount: number
    averageDifficulty: number
    mostPopularCategory: string | null
    questionHealthScore: number
  } {
    if (questions.length === 0) {
      return {
        totalQuestions: 0,
        categoriesCount: 0,
        averageDifficulty: 0,
        mostPopularCategory: null,
        questionHealthScore: 0
      }
    }

    const categories = new Set(questions.map(q => q.category).filter(Boolean))
    const categoryUsage: Record<string, number> = {}
    
    questions.forEach(q => {
      if (q.category) {
        categoryUsage[q.category] = (categoryUsage[q.category] || 0) + 1
      }
    })

    const categoryKeys = Object.keys(categoryUsage)
    const mostPopularCategory = categoryKeys.length > 0 
      ? categoryKeys.reduce((a, b) => categoryUsage[a] > categoryUsage[b] ? a : b)
      : null

    // Calculate difficulty score (easy=1, medium=2, hard=3)
    const difficultyScores = questions.map(q => {
      switch (q.difficulty) {
        case 'easy': return 1
        case 'medium': return 2
        case 'hard': return 3
        default: return 2
      }
    })
    const averageDifficulty = difficultyScores.reduce((sum, score) => sum + score, 0) / difficultyScores.length

    // Question health score (based on variety and completeness)
    const hasCategories = questions.some(q => q.category)
    const hasDifficulties = questions.some(q => q.difficulty)
    const hasVariedTimeLimits = new Set(questions.map(q => q.timeLimit)).size > 1
    const questionHealthScore = Math.round(
      (hasCategories ? 30 : 0) + 
      (hasDifficulties ? 30 : 0) + 
      (hasVariedTimeLimits ? 20 : 0) + 
      (categories.size >= 3 ? 20 : categories.size * 6.67)
    )

    return {
      totalQuestions: questions.length,
      categoriesCount: categories.size,
      averageDifficulty: Math.round(averageDifficulty * 10) / 10,
      mostPopularCategory,
      questionHealthScore
    }
  }
}

// Real-time Answer Collection Service
export const roomAnswerService = {
  // Collect all answers for a specific question when timer ends
  async collectQuestionAnswers(roomId: string, questionIndex: number): Promise<RoomAnswer[]> {
    try {
      const answersSnapshot = await getDocs(collection(db, 'rooms', roomId, 'answers'))
      const questionAnswers: RoomAnswer[] = []

      // Get participant names
      const participantsSnapshot = await getDocs(collection(db, 'rooms', roomId, 'participants'))
      const participantNames: Record<string, string> = {}
      
      participantsSnapshot.forEach(doc => {
        const data = doc.data()
        participantNames[doc.id] = data.name || 'Unknown'
      })

      // Extract answers for this specific question
      answersSnapshot.forEach(doc => {
        const userAnswers = doc.data()
        const questionKey = `q${questionIndex}`
        
        if (userAnswers[questionKey]) {
          const answerData = userAnswers[questionKey]
          questionAnswers.push({
            userId: doc.id,
            playerName: participantNames[doc.id] || 'Unknown',
            questionIndex,
            answer: answerData.answer,
            isCorrect: answerData.isCorrect,
            timeSpent: answerData.timeSpent,
            score: answerData.score,
            submittedAt: answerData.submittedAt
          })
        }
      })

      return questionAnswers
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to collect answers')
    }
  },

  // Calculate and update live scores after each question
  async updateLiveScores(roomId: string, questionIndex: number): Promise<LiveScore[]> {
    try {
      // Get all answers up to current question
      const answersSnapshot = await getDocs(collection(db, 'rooms', roomId, 'answers'))
      const participantsSnapshot = await getDocs(collection(db, 'rooms', roomId, 'participants'))
      
      // Build participant names map
      const participantNames: Record<string, string> = {}
      participantsSnapshot.forEach(doc => {
        const data = doc.data()
        participantNames[doc.id] = data.name || 'Unknown'
      })

      // Calculate cumulative scores for each participant
      const userScores: Record<string, {
        totalScore: number
        correctAnswers: number
        questionsAnswered: number
        totalTime: number
      }> = {}

      answersSnapshot.forEach(doc => {
        const userId = doc.id
        const userAnswers = doc.data()
        
        let totalScore = 0
        let correctAnswers = 0
        let questionsAnswered = 0
        let totalTime = 0

        // Sum up scores for all questions up to current index
        for (let i = 0; i <= questionIndex; i++) {
          const questionKey = `q${i}`
          if (userAnswers[questionKey]) {
            const answer = userAnswers[questionKey]
            totalScore += answer.score || 0
            correctAnswers += answer.isCorrect ? 1 : 0
            questionsAnswered += 1
            totalTime += answer.timeSpent || 0
          }
        }

        userScores[userId] = {
          totalScore,
          correctAnswers,
          questionsAnswered,
          totalTime
        }
      })

      // Convert to LiveScore array and sort by score
      const liveScores: LiveScore[] = Object.entries(userScores)
        .map(([userId, scores]) => ({
          userId,
          playerName: participantNames[userId] || 'Unknown',
          totalScore: scores.totalScore,
          correctAnswers: scores.correctAnswers,
          questionsAnswered: scores.questionsAnswered,
          averageTime: scores.questionsAnswered > 0 ? Math.round(scores.totalTime / scores.questionsAnswered) : 0,
          rank: 0, // Will be set below
          lastUpdated: Timestamp.now()
        }))
        .sort((a, b) => b.totalScore - a.totalScore)

      // Assign ranks
      liveScores.forEach((score, index) => {
        score.rank = index + 1
      })

      // Save live scores to Firestore
      const scoresCollection = collection(db, 'rooms', roomId, 'liveScores')
      const savePromises = liveScores.map(score =>
        setDoc(doc(scoresCollection, score.userId), score)
      )
      await Promise.all(savePromises)

      return liveScores
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to update live scores')
    }
  },

  // Create question result summary for answer reveal
  async createQuestionResult(roomId: string, questionIndex: number): Promise<QuestionResult> {
    try {
      // Get the question details
      const questionDoc = await getDoc(doc(db, 'rooms', roomId, 'questions', questionIndex.toString()))
      if (!questionDoc.exists()) {
        throw new Error('Question not found')
      }

      const questionData = questionDoc.data()
      const participantCount = (await getDocs(collection(db, 'rooms', roomId, 'participants'))).size
      
      // Collect all answers for this question
      const answers = await this.collectQuestionAnswers(roomId, questionIndex)
      
      const correctCount = answers.filter(a => a.isCorrect).length
      const incorrectCount = answers.length - correctCount
      const averageTime = answers.length > 0 
        ? Math.round(answers.reduce((sum, a) => sum + a.timeSpent, 0) / answers.length)
        : 0

      const result: QuestionResult = {
        questionIndex,
        question: questionData.question,
        correctAnswer: questionData.correctAnswer,
        options: questionData.options,
        totalParticipants: participantCount,
        answers,
        correctCount,
        incorrectCount,
        averageTime,
        revealedAt: Timestamp.now()
      }

      // Save question result for historical purposes
      await setDoc(
        doc(db, 'rooms', roomId, 'questionResults', questionIndex.toString()),
        result
      )

      return result
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to create question result')
    }
  },

  // Get live leaderboard
  async getLiveLeaderboard(roomId: string): Promise<LiveScore[]> {
    try {
      const scoresSnapshot = await getDocs(
        query(
          collection(db, 'rooms', roomId, 'liveScores'),
          orderBy('totalScore', 'desc')
        )
      )

      const leaderboard: LiveScore[] = []
      scoresSnapshot.forEach(doc => {
        leaderboard.push({
          ...doc.data(),
          userId: doc.id
        } as LiveScore)
      })

      return leaderboard
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to get leaderboard')
    }
  }
}

// Export all services as a unified API
export const firestoreAPI = {
  questions: questionsService,
  roomAnswers: roomAnswerService,
  utils: {
    formatTimestamp: firestoreUtils.formatTimestamp,
    getRelativeTime: firestoreUtils.getRelativeTime,
    validateScoreData: firestoreUtils.validateScoreData,
    validateQuestionData: firestoreUtils.validateQuestionData,
    generateQuizSummary: firestoreUtils.generateQuizSummary
  }
}
