import OpenAI from 'openai';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface DialogueLine {
  speaker: 'Peter' | 'Stewie';
  text: string;
}

export interface ChatResponse {
  message: string;
  dialogue: DialogueLine[];
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

      const systemPrompt = `You are creating a dialogue between Peter Griffin and Stewie Griffin from Family Guy. 

Peter is simple-minded, enthusiastic, and explains things in a basic, sometimes incorrect way. He uses simple language and gets excited about topics.

Stewie is intelligent, sophisticated, and asks probing questions. He speaks in a more advanced vocabulary and often corrects or challenges Peter.

Create a short dialogue (4-6 exchanges total) where:
1. Stewie starts by asking a question about the topic
2. Peter explains part of it in his characteristic style
3. They go back and forth with Stewie asking follow-ups and Peter responding
4. Keep it educational but entertaining
5. Each line should be 1-2 sentences max
6. End with Peter giving a final, enthusiastic summary

Format your response as a dialogue with clear speaker labels:
Peter: [text]
Stewie: [text]

Keep the total response under 400 words.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Create a dialogue between Peter and Stewie about: ${topic}` }
        ],
        max_tokens: 600,
        temperature: 0.8,
      });

      const message = completion.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';
      
      // Parse the dialogue from the response
      const dialogue = this.parseDialogue(message);
      
      return {
        message,
        dialogue,
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

  private parseDialogue(text: string): DialogueLine[] {
    const lines = text.split('\n').filter(line => line.trim());
    const dialogue: DialogueLine[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('Peter:')) {
        dialogue.push({
          speaker: 'Peter',
          text: trimmedLine.replace('Peter:', '').trim()
        });
      } else if (trimmedLine.startsWith('Stewie:')) {
        dialogue.push({
          speaker: 'Stewie',
          text: trimmedLine.replace('Stewie:', '').trim()
        });
      }
    }
    
    return dialogue;
  }
} 