import OpenAI from 'openai';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  message: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIService {
  private openai: OpenAI | null = null;

  private getOpenAIClient(): OpenAI {
    if (!this.openai) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }
      
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.openai;
  }

  async generateResponse(topic: string): Promise<ChatResponse> {
    try {
      const openai = this.getOpenAIClient();

      const systemPrompt = `You are Peter Griffin from Family Guy, and you're explaining topics in your characteristic style - simple, enthusiastic, and sometimes going off on tangents. Keep explanations engaging but educational. You can reference pop culture, make comparisons to everyday things, and use Peter's speech patterns. Keep responses under 500 words.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Explain this topic: ${topic}` }
        ],
        max_tokens: 500,
        temperature: 0.8,
      });

      const message = completion.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';
      
      return {
        message,
        usage: completion.usage ? {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens,
        } : undefined
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to generate response from OpenAI');
    }
  }
} 