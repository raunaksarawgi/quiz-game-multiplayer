// Test data for room question initialization
export const testQuestions = [
  {
    question: "What is 2 + 2?",
    options: ["3", "4", "5", "6"],
    correctAnswer: 1,
    timeLimit: 30,
    category: "Mathematics",
    difficulty: "easy" as const
  },
  {
    question: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    correctAnswer: 2,
    timeLimit: 30,
    category: "Geography", 
    difficulty: "easy" as const
  },
  {
    question: "Who painted the Mona Lisa?",
    options: ["Van Gogh", "Da Vinci", "Picasso", "Monet"],
    correctAnswer: 1,
    timeLimit: 30,
    category: "Art",
    difficulty: "medium" as const
  },
  {
    question: "What is the largest planet in our solar system?",
    options: ["Earth", "Mars", "Jupiter", "Saturn"],
    correctAnswer: 2,
    timeLimit: 30,
    category: "Science",
    difficulty: "easy" as const
  },
  {
    question: "In which year did World War II end?",
    options: ["1944", "1945", "1946", "1947"],
    correctAnswer: 1,
    timeLimit: 30,
    category: "History",
    difficulty: "medium" as const
  },
  {
    question: "What is the square root of 64?",
    options: ["6", "7", "8", "9"],
    correctAnswer: 2,
    timeLimit: 30,
    category: "Mathematics",
    difficulty: "easy" as const
  }
]

// Function to add test questions to database
export async function addTestQuestions() {
  const { questionsService } = await import('../services/firestore')
  
  console.log('Adding test questions...')
  for (const question of testQuestions) {
    try {
      await questionsService.addQuestion(question)
      console.log(`✅ Added: ${question.question}`)
    } catch (error) {
      console.error(`❌ Failed to add: ${question.question}`, error)
    }
  }
  console.log('Test questions added successfully!')
}
