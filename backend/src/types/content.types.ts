export interface DialogueLine {
  speaker: 'Peter' | 'Stewie';
  text: string;
  imagePlaceholder?: string;
}

export interface ContentGenerationRequest {
  topic: string;
}

export interface ContentGenerationResponse {
  message: string;
  dialogue?: DialogueLine[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ContentValidationRules {
  maxTopicLength: number;
  maxTextLength: number;
  minTopicLength: number;
} 