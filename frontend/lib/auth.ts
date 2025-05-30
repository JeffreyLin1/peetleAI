import { createClient } from './supabase'
import { User } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string
  created_at: string
  updated_at: string
}

export class AuthService {
  private supabase = createClient()

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }

    return data
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }

    return data
  }

  /**
   * Sign out the current user
   */
  async signOut() {
    const { error } = await this.supabase.auth.signOut()
    
    if (error) {
      throw new Error(error.message)
    }
  }

  /**
   * Get the current user
   */
  async getCurrentUser(): Promise<User | null> {
    const { data: { user }, error } = await this.supabase.auth.getUser()
    
    if (error) {
      console.error('Error getting current user:', error)
      return null
    }

    return user
  }

  /**
   * Get the current session
   */
  async getSession() {
    const { data: { session }, error } = await this.supabase.auth.getSession()
    
    if (error) {
      console.error('Error getting session:', error)
      return null
    }

    return session
  }

  /**
   * Get the access token for API calls
   */
  async getAccessToken(): Promise<string | null> {
    const session = await this.getSession()
    return session?.access_token || null
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return this.supabase.auth.onAuthStateChange(callback)
  }

  /**
   * Reset password
   */
  async resetPassword(email: string) {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  /**
   * Update password
   */
  async updatePassword(password: string) {
    const { error } = await this.supabase.auth.updateUser({
      password,
    })

    if (error) {
      throw new Error(error.message)
    }
  }
}

// Create a singleton instance
export const authService = new AuthService() 