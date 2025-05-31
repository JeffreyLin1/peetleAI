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
   * Upload file (multipart/form-data)
   */
  async uploadFile<T = any>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    try {
      const token = await authService.getAccessToken()
      
      const headers: Record<string, string> = {}

      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Request failed')
      }

      return data
    } catch (error) {
      console.error('API upload failed:', error)
      throw error
    }
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    })
  }
}

// Create a singleton instance
export const apiClient = new ApiClient()

// Convenience methods for common API calls
export const api = {
  // Authentication endpoints
  auth: {
    me: () => apiClient.get('/api/auth/me'),
    verify: (token: string) => apiClient.post('/api/auth/verify', { token }),
  },

  // Content generation endpoints
  content: {
    generate: (topic: string) => apiClient.post('/api/content/generate', { topic }),
  },

  // Video generation and management endpoints
  video: {
    generate: (dialogue: any[], imagePlaceholders?: { [placeholder: string]: string }) => 
      apiClient.post('/api/video/generate', { dialogue, imagePlaceholders }),
    list: () => apiClient.get('/api/video/list'),
    stream: (filename: string) => `${API_BASE_URL}/api/video/stream/${filename}`,
  },

  // Image upload and management endpoints
  images: {
    upload: (file: File, placeholder: string) => {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('placeholder', placeholder);
      return apiClient.uploadFile('/api/images/upload', formData);
    },
    delete: (imagePath: string) => 
      apiClient.delete('/api/images/delete', { imagePath }),
  },
} 