import { signInAnonymously, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../config/firebase'

export interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
}

export class AuthService {
  /**
   * Sign in anonymously to get a unique user ID
   * @returns Promise<User> - The authenticated anonymous user
   */
  static async signInAnonymously(): Promise<User> {
    try {
      const userCredential = await signInAnonymously(auth)
      const user = userCredential.user
      return user
    } catch (error: any) {
      console.error('❌ Anonymous sign-in failed:', error)
      throw new Error(`Authentication failed: ${error.message}`)
    }
  }

  /**
   * Get the current user if already authenticated
   * @returns User | null - The current user or null if not authenticated
   */
  static getCurrentUser(): User | null {
    return auth.currentUser
  }

  /**
   * Get the current user's UID
   * @returns string | null - The user's UID or null if not authenticated
   */
  static getCurrentUserUID(): string | null {
    const user = auth.currentUser
    return user ? user.uid : null
  }

  /**
   * Check if user is currently authenticated
   * @returns boolean - True if user is authenticated
   */
  static isAuthenticated(): boolean {
    return auth.currentUser !== null
  }

  /**
   * Sign out the current user
   * @returns Promise<void>
   */
  static async signOut(): Promise<void> {
    try {
      await signOut(auth)
    } catch (error: any) {
      console.error('❌ Sign-out failed:', error)
      throw new Error(`Sign-out failed: ${error.message}`)
    }
  }
}
