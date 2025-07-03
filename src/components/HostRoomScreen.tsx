import { useState, useEffect } from 'react'
import { createRoom, getAvailableCategories } from '../services/roomService'
import './HostRoomScreen.css'

interface HostRoomScreenProps {
  userUID: string
  onRoomCreated: (roomId: string, roomCode: string, isHost: boolean, hostName: string) => void
  onBack: () => void
  maxQuestions?: number
}

export default function HostRoomScreen({ userUID, onRoomCreated, onBack, maxQuestions = 20 }: HostRoomScreenProps) {
  const [hostName, setHostName] = useState('')
  const [numberOfQuestions, setNumberOfQuestions] = useState(5)
  const [selectedCategory, setSelectedCategory] = useState('ANY')
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)

  // Load available categories on component mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setIsLoadingCategories(true)
        const categories = await getAvailableCategories()
        setAvailableCategories(categories)
      } catch (err) {
        console.error('Error loading categories:', err)
        setError('Failed to load question categories')
      } finally {
        setIsLoadingCategories(false)
      }
    }

    loadCategories()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!hostName.trim() || numberOfQuestions <= 0) {
      setError('Please fill in all fields correctly')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      // Small delay to ensure auth state is stable
      await new Promise(resolve => setTimeout(resolve, 100))

      const result = await createRoom(
        userUID, 
        hostName.trim(), 
        numberOfQuestions,
        selectedCategory === 'ANY' ? undefined : selectedCategory
      )
      
      if (result.success && result.roomId && result.roomCode) {
        // Immediately redirect to lobby - no success screen
        onRoomCreated(result.roomId, result.roomCode, true, hostName.trim())
      } else {
        setError(result.error || 'Failed to create room')
        setIsCreating(false)
      }
    } catch (err) {
      console.error('Error creating room:', err)
      setError('Failed to create room. Please try again.')
      setIsCreating(false)
    }
  }

  const handleQuestionCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    if (value >= 1 && value <= maxQuestions) {
      setNumberOfQuestions(value)
    }
  }

  // Helper function to get category icons
  const getCategoryIcon = (category: string): string => {
    const iconMap: Record<string, string> = {
      'Science': '🔬',
      'Mathematics': '🔢',
      'History': '📚',
      'Geography': '🌍',
      'Art': '🎨',
      'Sports': '⚽',
      'Music': '🎵',
      'Literature': '📖',
      'Technology': '💻',
      'General Knowledge': '🧠',
      'Nature': '🌿',
      'Food': '🍽️'
    }
    return iconMap[category] || '📝'
  }

  const isFormValid = hostName.trim() !== '' && numberOfQuestions >= 1 && numberOfQuestions <= maxQuestions && !isCreating && !isLoadingCategories

  return (
    <div className="host-room-screen">
      <div className="host-room-container">
        <button className="back-button" onClick={onBack} disabled={isCreating}>
          ← Back
        </button>
        
        <div className="host-room-header">
          <h1 className="host-room-title">🎯 Host Room</h1>
          <p className="host-room-subtitle">Set up a new quiz room for others to join</p>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}
        
        <form className="host-room-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="hostName">Your Name (Host)</label>
            <input
              id="hostName"
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              required
              disabled={isCreating}
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="numberOfQuestions">Number of Questions</label>
            <div className="question-count-container">
              <input
                id="numberOfQuestions"
                type="range"
                min="1"
                max={maxQuestions}
                value={numberOfQuestions}
                onChange={handleQuestionCountChange}
                className="question-slider"
                disabled={isCreating}
              />
              <div className="question-display">
                <span className="question-count">{numberOfQuestions}</span>
                <span className="question-label">questions</span>
              </div>
            </div>
            <div className="slider-labels">
              <span>1</span>
              <span>{maxQuestions}</span>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="categorySelect">Question Category</label>
            {isLoadingCategories ? (
              <div className="category-loading">
                <div className="loading-spinner-small"></div>
                <span>Loading categories...</span>
              </div>
            ) : (
              <select
                id="categorySelect"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="category-select"
                disabled={isCreating}
              >
                <option value="ANY">🎲 Any Category</option>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>
                    {getCategoryIcon(category)} {category}
                  </option>
                ))}
              </select>
            )}
            <div className="category-description">
              {selectedCategory === 'ANY' 
                ? 'Questions will be randomly selected from all available categories'
                : `Questions will be selected from the ${selectedCategory} category`
              }
            </div>
          </div>
          
          <button 
            type="submit" 
            className={`host-button ${isFormValid ? 'active' : 'disabled'}`}
            disabled={!isFormValid}
          >
            {isCreating ? (
              <>
                <div className="button-loading-spinner"></div>
                Creating Room...
              </>
            ) : (
              <>🚀 Create Room</>
            )}
          </button>
        </form>
        
        <div className="host-room-info">
          <div className="info-item">
            <span className="info-icon">📱</span>
            <span>Share room code with players</span>
          </div>
          <div className="info-item">
            <span className="info-icon">⏱️</span>
            <span>Control quiz pace as host</span>
          </div>
          <div className="info-item">
            <span className="info-icon">📊</span>
            <span>View real-time leaderboard</span>
          </div>
        </div>
      </div>
    </div>
  )
}
