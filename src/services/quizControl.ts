import { 
  doc, 
  updateDoc, 
  getDoc, 
  setDoc,
  Timestamp,
  onSnapshot,
  type Unsubscribe
} from 'firebase/firestore'
import { db, auth } from '../config/firebase'
import { roomAnswerService } from './firestore'

export interface QuizTimerState {
  currentQuestionIndex: number
  questionStartTime: Timestamp
  timeRemaining: number
  isActive: boolean
  questionDuration: number
}

export interface QuizControlService {
  startQuestion: (roomId: string, questionIndex: number, duration: number) => Promise<boolean>
  nextQuestion: (roomId: string) => Promise<boolean>
  endQuiz: (roomId: string) => Promise<boolean>
  subscribeToTimer: (roomId: string, callback: (timer: QuizTimerState | null) => void) => Unsubscribe
}

class QuizControlServiceImpl implements QuizControlService {
  
  /**
   * Start a specific question with synchronized timer
   */
  async startQuestion(roomId: string, questionIndex: number, duration: number): Promise<boolean> {
    try {
      // Check authentication first
      if (!auth.currentUser) {
        return false
      }

      // Wait for auth token to be ready
      await auth.currentUser.getIdToken(true)
      
      // Verify room exists and we can read it first
      try {
        const roomDoc = await getDoc(doc(db, 'rooms', roomId))
        if (!roomDoc.exists()) {
          return false
        }
      } catch (roomReadError) {
        return false
      }
      
      const timerState: QuizTimerState = {
        currentQuestionIndex: questionIndex,
        questionStartTime: Timestamp.now(),
        timeRemaining: duration,
        isActive: true,
        questionDuration: duration
      }

      // Update room with current question and timer state
      await updateDoc(doc(db, 'rooms', roomId), {
        currentQuestionIndex: questionIndex,
        status: 'active',
        updatedAt: Timestamp.now()
      })

      await setDoc(doc(db, 'rooms', roomId, 'timer', 'current'), timerState)

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Move to next question or end quiz if last question
   * Includes answer collection and scoring
   */
  async nextQuestion(roomId: string): Promise<boolean> {
    try {
      // Get current room info
      const roomDoc = await getDoc(doc(db, 'rooms', roomId))
      if (!roomDoc.exists()) {
        throw new Error('Room not found')
      }

      const roomData = roomDoc.data()
      const currentIndex = roomData.currentQuestionIndex || 0
      const totalQuestions = roomData.questionCount || 0

      // Collect answers and update scores for the current question that just ended
      
      try {
        // Collect all answers for current question
        await roomAnswerService.collectQuestionAnswers(roomId, currentIndex)
        
        // Update live scores after this question
        await roomAnswerService.updateLiveScores(roomId, currentIndex)
        
        // Create question result for answer reveal
        await roomAnswerService.createQuestionResult(roomId, currentIndex)
        
      } catch (processingError) {
        // Continue with next question even if processing fails
      }

      if (currentIndex + 1 >= totalQuestions) {
        // Quiz is complete - process final results
        return await this.endQuiz(roomId)
      } else {
        // Move to next question
        const nextIndex = currentIndex + 1
        
        // Get next question to determine duration
        const nextQuestionDoc = await getDoc(
          doc(db, 'rooms', roomId, 'questions', nextIndex.toString())
        )
        
        if (!nextQuestionDoc.exists()) {
          throw new Error('Next question not found')
        }

        const nextQuestion = nextQuestionDoc.data()
        const duration = nextQuestion.timeLimit || 30

        return await this.startQuestion(roomId, nextIndex, duration)
      }
    } catch (error) {
      return false
    }
  }

  /**
   * End the quiz and mark room as completed
   * Process final results and create final leaderboard
   */
  async endQuiz(roomId: string): Promise<boolean> {
    try {
      // Get room info for final processing
      const roomDoc = await getDoc(doc(db, 'rooms', roomId))
      if (!roomDoc.exists()) {
        throw new Error('Room not found')
      }

      const roomData = roomDoc.data()
      const finalQuestionIndex = (roomData.questionCount || 1) - 1

      // Process final question results
      try {
        await roomAnswerService.collectQuestionAnswers(roomId, finalQuestionIndex)
        await roomAnswerService.updateLiveScores(roomId, finalQuestionIndex)
        await roomAnswerService.createQuestionResult(roomId, finalQuestionIndex)
        
      } catch (processingError) {
        // Continue with quiz end
      }

      // Update room status to completed
      await updateDoc(doc(db, 'rooms', roomId), {
        status: 'completed',
        completedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })

      // Deactivate timer
      await updateDoc(doc(db, 'rooms', roomId, 'timer', 'current'), {
        isActive: false,
        timeRemaining: 0,
        updatedAt: Timestamp.now()
      })

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Subscribe to real-time timer updates
   */
  subscribeToTimer(roomId: string, callback: (timer: QuizTimerState | null) => void): Unsubscribe {
    
    return onSnapshot(
      doc(db, 'rooms', roomId, 'timer', 'current'),
      (snapshot) => {
        if (snapshot.exists()) {
          const timerData = snapshot.data() as QuizTimerState
          
          // Calculate current time remaining if timer is active
          if (timerData.isActive && timerData.questionStartTime) {
            const now = Timestamp.now()
            const elapsed = now.seconds - timerData.questionStartTime.seconds
            const remaining = Math.max(0, timerData.questionDuration - elapsed)
            
            callback({
              ...timerData,
              timeRemaining: remaining
            })
          } else {
            callback(timerData)
          }
        } else {
          callback(null)
        }
      },
      () => {
        callback(null)
      }
    )
  }
}

// Host-only quiz control functions
export class HostQuizControl {
  private quizControl = new QuizControlServiceImpl()

  /**
   * Start the quiz from the first question
   */
  async startQuiz(roomId: string): Promise<boolean> {
    try {
      
      // Check authentication first
      if (!auth.currentUser) {
        return false
      }
      
      // Get first question
      const firstQuestionDoc = await getDoc(
        doc(db, 'rooms', roomId, 'questions', '0')
      )
      
      if (!firstQuestionDoc.exists()) {
        throw new Error('No questions found in room')
      }

      const firstQuestion = firstQuestionDoc.data()
      const duration = firstQuestion.timeLimit || 30

      const result = await this.quizControl.startQuestion(roomId, 0, duration)
      return result
    } catch (error) {
      return false
    }
  }

  /**
   * Auto-advance to next question when timer expires
   */
  startAutoAdvance(roomId: string): Unsubscribe {
    
    let unsubscribeTimer: Unsubscribe | null = null
    let checkInterval: ReturnType<typeof setInterval> | null = null
    let isAdvancing = false // Prevent duplicate advances
    let currentTimerData: QuizTimerState | null = null
    
    // Subscribe to timer updates
    unsubscribeTimer = this.quizControl.subscribeToTimer(roomId, async (timer) => {
      // Store the latest timer data
      currentTimerData = timer
      
      if (timer && timer.isActive) {
        
        // Clear any existing interval
        if (checkInterval) {
          clearInterval(checkInterval)
          checkInterval = null
        }
        
        // Always set up interval for active timer, even if currently advancing
        // The interval will check isAdvancing flag before proceeding
        checkInterval = setInterval(async () => {
          if (isAdvancing || !currentTimerData || !currentTimerData.isActive) return
          
          // Calculate current remaining time using latest timer data
          const now = Date.now() / 1000
          const startTime = currentTimerData.questionStartTime.seconds
          const elapsed = now - startTime
          const remaining = currentTimerData.questionDuration - elapsed
          
          if (remaining <= -1) {
            isAdvancing = true
            
            try {
              // Advance to next question
              await this.quizControl.nextQuestion(roomId)
            } catch (error) {
              // Continue
            } finally {
              isAdvancing = false
            }
          }
        }, 1000) // Check every second
      } else if (timer && !timer.isActive) {
        // Clear interval if timer becomes inactive
        if (checkInterval) {
          clearInterval(checkInterval)
          checkInterval = null
        }
        isAdvancing = false
      }
    })
    
    // Return cleanup function
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval)
      }
      if (unsubscribeTimer) {
        unsubscribeTimer()
      }
    }
  }

  /**
   * Manually advance to next question (for host control if needed)
   */
  async nextQuestion(roomId: string): Promise<boolean> {
    return await this.quizControl.nextQuestion(roomId)
  }

  /**
   * End the quiz manually
   */
  async endQuiz(roomId: string): Promise<boolean> {
    return await this.quizControl.endQuiz(roomId)
  }
}

// Export services
export const quizControlService = new QuizControlServiceImpl()
export const hostQuizControl = new HostQuizControl()

// Hook for participants to sync with quiz timer
export const useQuizTimer = (roomId: string | null) => {
  return {
    subscribeToTimer: (callback: (timer: QuizTimerState | null) => void) => {
      if (!roomId) return () => {}
      return quizControlService.subscribeToTimer(roomId, callback)
    }
  }
}
