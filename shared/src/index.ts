// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Chat Types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ChatResponse {
  message: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatRequest {
  topic: string;
}

// Video Types (for future use)
export interface VideoRequest {
  topic: string;
  backgroundType: 'subway-surfers' | 'minecraft-parkour';
  character: 'peter' | 'stewie' | 'both';
  duration?: number;
}

export interface VideoResponse {
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  status: 'processing' | 'completed' | 'failed';
}

// User Types (for future use)
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  subscription?: 'free' | 'premium';
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
} 