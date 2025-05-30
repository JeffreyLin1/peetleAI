import { authService } from './auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  /**
   * Make an authenticated request to the API
   */
  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = await authService.getAccessToken()
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      }

      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Request failed')
      }

      return data
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

// Create a singleton instance
export const apiClient = new ApiClient()

// Convenience methods for common API calls
export const api = {
  // Auth endpoints
  auth: {
    me: () => apiClient.get('/api/auth/me'),
    verify: (token: string) => apiClient.post('/api/auth/verify', { token }),
  },

  // Chat endpoints
  chat: {
    generate: (topic: string) => apiClient.post('/api/chat/generate', { topic }),
    speak: (text: string, dialogue?: any[]) => 
      apiClient.post('/api/chat/speak', { text, dialogue }),
  },
} 