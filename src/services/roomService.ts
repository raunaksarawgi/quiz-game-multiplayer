import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  Timestamp
} from 'firebase/firestore'
import { db, auth } from '../config/firebase'
import { questionsService, type QuizQuestion } from './firestore'

export interface RoomInfo {
  id: string
  hostUID: string
  hostName: string
  status: 'waiting' | 'active' | 'completed'
  questionCount: number
  currentQuestionIndex: number
  createdAt: Timestamp
  roomCode: string
  questionsInitialized?: boolean
  selectedCategory?: string
  settings: {
    timePerQuestion: number
    showCorrectAnswer: boolean
    allowLateJoin: boolean
  }
}

export interface Participant {
  id: string
  name: string
  joinedAt: Timestamp
  isHost: boolean
  avatar: string
}

export interface CreateRoomResponse {
  success: boolean
  roomId?: string
  roomCode?: string
  error?: string
}

export interface JoinRoomResponse {
  success: boolean
  roomId?: string
  error?: string
}

class RoomService {
  /**
   * Generate a unique 6-digit room code
   */
  generateRoomCode(): string {
    // Generate 6-digit number (100000 to 999999)
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  /**
   * Check if a room code already exists
   */
  private async isRoomCodeUnique(roomCode: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, 'rooms'),
        where('roomCode', '==', roomCode),
        where('status', 'in', ['waiting', 'active']) // Only check active rooms
      )
      const querySnapshot = await getDocs(q)
      return querySnapshot.empty
    } catch (error) {
      console.error('Error checking room code uniqueness:', error)
      return false
    }
  }

  /**
   * Generate a unique room code by checking against existing codes
   */
  private async generateUniqueRoomCode(): Promise<string> {
    let roomCode: string
    let isUnique = false
    let attempts = 0
    const maxAttempts = 10

    do {
      roomCode = this.generateRoomCode()
      isUnique = await this.isRoomCodeUnique(roomCode)
      attempts++
    } while (!isUnique && attempts < maxAttempts)

    if (!isUnique) {
      throw new Error('Failed to generate unique room code after multiple attempts')
    }

    return roomCode
  }

  /**
   * Create a new room
   */
  async createRoom(
    hostUID: string, 
    hostName: string, 
    questionCount: number,
    category?: string
  ): Promise<CreateRoomResponse> {
    try {
      // Check authentication first
      if (!auth.currentUser) {
        console.error('❌ User not authenticated for room creation')
        return {
          success: false,
          error: 'User must be authenticated to create a room'
        }
      }

      // Validate required parameters
      if (!hostUID || !hostName) {
        console.error('❌ Missing required parameters:', { hostUID, hostName })
        return {
          success: false,
          error: 'Host UID and name are required'
        }
      }

      if (!questionCount || questionCount < 1) {
        console.error('❌ Invalid question count:', questionCount)
        return {
          success: false,
          error: 'Question count must be at least 1'
        }
      }

      // Generate unique room ID and code
      const roomId = doc(collection(db, 'rooms')).id
      const roomCode = await this.generateUniqueRoomCode()

      // Create room info with proper field validation
      const roomInfo: Omit<RoomInfo, 'id'> = {
        hostUID: hostUID || '',
        hostName: hostName || 'Unknown Host',
        status: 'waiting',
        questionCount: questionCount || 10,
        currentQuestionIndex: 0,
        createdAt: Timestamp.now(),
        roomCode: roomCode || '',
        questionsInitialized: false,
        selectedCategory: category || 'ANY',
        settings: {
          timePerQuestion: 30,
          showCorrectAnswer: true,
          allowLateJoin: true
        }
      }

      // Create room document
      await setDoc(doc(db, 'rooms', roomId), roomInfo)

      // Add host as first participant
      const hostParticipant: Omit<Participant, 'id'> = {
        name: hostName || 'Unknown Host',
        joinedAt: Timestamp.now(),
        isHost: true,
        avatar: '👑'
      }

      await setDoc(doc(db, 'rooms', roomId, 'participants', hostUID || 'unknown'), hostParticipant)

      // Initialize questions for the room
      const questionsInitialized = await this.initializeRoomQuestions(roomId, questionCount, category)
      
      if (!questionsInitialized) {
        console.error('Failed to initialize questions for room')
        // Note: We still return success as the room was created, but with a warning
      }

      return {
        success: true,
        roomId,
        roomCode
      }
    } catch (error) {
      console.error('❌ Error creating room:', error)
      
      // Provide more specific error information
      let errorMessage = 'Failed to create room'
      if (error instanceof Error) {
        errorMessage = error.message
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        })
      }
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Find room by room code
   */
  private async findRoomByCode(roomCode: string): Promise<string | null> {
    try {
      const q = query(
        collection(db, 'rooms'),
        where('roomCode', '==', roomCode)
      )
      const querySnapshot = await getDocs(q)
      
      if (querySnapshot.empty) {
        return null
      }

      // Return the first matching room ID
      return querySnapshot.docs[0].id
    } catch (error) {
      console.error('Error finding room by code:', error)
      return null
    }
  }

  /**
   * Join an existing room
   */
  async joinRoom(
    roomCode: string, 
    userUID: string, 
    userName: string
  ): Promise<JoinRoomResponse> {
    try {
      // Find room by code
      const roomId = await this.findRoomByCode(roomCode)
      if (!roomId) {
        return {
          success: false,
          error: 'Room not found. Please check the room code.'
        }
      }

      // Get room info to check status and capacity
      const roomInfo = await this.getRoomInfo(roomId)
      if (!roomInfo) {
        return {
          success: false,
          error: 'Room not found or no longer available.'
        }
      }

      // Check if room is joinable
      if (roomInfo.status === 'completed') {
        return {
          success: false,
          error: 'This game has already ended.'
        }
      }

      if (roomInfo.status === 'active' && !roomInfo.settings.allowLateJoin) {
        return {
          success: false,
          error: 'Game is in progress and late joining is not allowed.'
        }
      }

      // Check if user is already in the room
      const existingParticipant = await getDoc(doc(db, 'rooms', roomId, 'participants', userUID))
      if (existingParticipant.exists()) {
        return {
          success: true,
          roomId // User already in room, just return success
        }
      }

      // Add user as participant
      const participant: Omit<Participant, 'id'> = {
        name: userName,
        joinedAt: Timestamp.now(),
        isHost: false,
        avatar: '🎮'
      }

      await setDoc(doc(db, 'rooms', roomId, 'participants', userUID), participant)

      return {
        success: true,
        roomId
      }
    } catch (error) {
      console.error('❌ Error joining room:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to join room'
      }
    }
  }

  /**
   * Get room information
   */
  async getRoomInfo(roomId: string): Promise<RoomInfo | null> {
    try {
      const roomDoc = await getDoc(doc(db, 'rooms', roomId))
      
      if (!roomDoc.exists()) {
        return null
      }

      return {
        id: roomId,
        ...roomDoc.data()
      } as RoomInfo
    } catch (error) {
      console.error('❌ Error getting room info:', error)
      return null
    }
  }

  /**
   * Update room status
   */
  async updateRoomStatus(
    roomId: string, 
    status: 'waiting' | 'active' | 'completed'
  ): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        status,
        updatedAt: Timestamp.now()
      })

      return true
    } catch (error) {
      console.error('❌ Error updating room status:', error)
      return false
    }
  }

  /**
   * Update current question index
   */
  async updateCurrentQuestion(roomId: string, questionIndex: number): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        currentQuestionIndex: questionIndex,
        updatedAt: Timestamp.now()
      })

      return true
    } catch (error) {
      console.error('❌ Error updating current question:', error)
      return false
    }
  }

  /**
   * Update room settings
   */
  async updateRoomSettings(
    roomId: string, 
    settings: Partial<RoomInfo['settings']>
  ): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        settings,
        updatedAt: Timestamp.now()
      })

      return true
    } catch (error) {
      console.error('❌ Error updating room settings:', error)
      return false
    }
  }

  /**
   * Initialize questions for a room based on category selection
   */
  async initializeRoomQuestions(
    roomId: string,
    questionCount: number,
    category?: string
  ): Promise<boolean> {
    try {
      let selectedQuestions: QuizQuestion[]

      if (category && category !== 'ANY') {
        // Get questions from specific category
        selectedQuestions = await questionsService.getRandomQuestions(questionCount, { category })
      } else {
        // Get random questions from any category
        selectedQuestions = await questionsService.getRandomQuestions(questionCount)
      }

      if (selectedQuestions.length === 0) {
        console.error('❌ No questions available in database')
        return false
      }

      if (selectedQuestions.length < questionCount) {
        console.warn(`⚠️ Only ${selectedQuestions.length} questions available, requested ${questionCount}`)
      }

      // Add questions to the room's questions subcollection with proper data structure
      const questionPromises = selectedQuestions.map((question, index) => {
        // Ensure all fields are properly set and no undefined values
        const questionData = {
          id: question.id || `q_${index}`,
          question: question.question || '',
          options: question.options || [],
          correctAnswer: question.correctAnswer || 0,
          timeLimit: question.timeLimit || 30,
          category: question.category || 'general',
          difficulty: question.difficulty || 'medium',
          createdAt: question.createdAt || Timestamp.now(),
          questionIndex: index,
          addedAt: Timestamp.now()
        }
        
        return setDoc(doc(db, 'rooms', roomId, 'questions', index.toString()), questionData)
      })

      await Promise.all(questionPromises)

      // Update room info with actual question count
      const updateData = {
        questionCount: selectedQuestions.length,
        questionsInitialized: true,
        selectedCategory: category || 'ANY',
        updatedAt: Timestamp.now()
      }
      
      await updateDoc(doc(db, 'rooms', roomId), updateData)

      return true
    } catch (error) {
      console.error('❌ Error initializing room questions:', error)
      
      // Provide detailed error information
      if (error instanceof Error) {
        console.error('Question initialization error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        })
      }
      
      return false
    }
  }

  /**
   * Get available question categories
   */
  async getAvailableCategories(): Promise<string[]> {
    try {
      return await questionsService.getCategories()
    } catch (error) {
      console.error('❌ Error getting categories:', error)
      return []
    }
  }

  /**
   * Test Firestore connectivity and authentication
   */
  async testFirestoreConnection(): Promise<{ success: boolean; error?: string; user?: string }> {
    try {
      // Test if we can read from questions collection (should be allowed for all)
      await questionsService.getAllQuestions({ limitCount: 1 })
      
      // Test if we can create a simple document
      const testDoc = doc(collection(db, 'test'))
      await setDoc(testDoc, {
        message: 'Test connection',
        timestamp: Timestamp.now()
      })
      
      return { success: true }
    } catch (error) {
      console.error('❌ Firestore connection test failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  }
}

// Create and export functions instead of singleton class
const roomServiceInstance = new RoomService()

export const createRoom = roomServiceInstance.createRoom.bind(roomServiceInstance)
export const joinRoom = roomServiceInstance.joinRoom.bind(roomServiceInstance)
export const getRoomInfo = roomServiceInstance.getRoomInfo.bind(roomServiceInstance)
export const updateRoomStatus = roomServiceInstance.updateRoomStatus.bind(roomServiceInstance)
export const updateCurrentQuestion = roomServiceInstance.updateCurrentQuestion.bind(roomServiceInstance)
export const updateRoomSettings = roomServiceInstance.updateRoomSettings.bind(roomServiceInstance)
export const generateRoomCode = roomServiceInstance.generateRoomCode.bind(roomServiceInstance)
export const initializeRoomQuestions = roomServiceInstance.initializeRoomQuestions.bind(roomServiceInstance)
export const getAvailableCategories = roomServiceInstance.getAvailableCategories.bind(roomServiceInstance)
export const testFirestoreConnection = roomServiceInstance.testFirestoreConnection.bind(roomServiceInstance)

export default roomServiceInstance
