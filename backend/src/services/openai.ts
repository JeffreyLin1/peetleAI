import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

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
  private testMode: boolean;
  private testScriptPath = path.join(process.cwd(), 'public', 'test_script', 'script.txt');

  constructor() {
    this.testMode = process.env.USE_TEST_AUDIO === 'true';
  }

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
      if (this.testMode) {
        return this.generateTestResponse(topic);
      }

      const openai = this.getOpenAIClient();

      const systemPrompt = `You are creating a dialogue between Peter Griffin and Stewie Griffin from Family Guy. 

Peter is, enthusiastic, and explains things in an in-depth yet simple way. He uses simple language and gets excited about topics.

Stewie is intelligent, sophisticated, and asks probing questions. He speaks in a more advanced vocabulary.

Create a short dialogue (4-6 exchanges total) where:
1. Stewie starts by asking a question about the topic
2. Peter explains part of it
3. They go back and forth with Stewie asking follow-ups and Peter responding
4. Keep it educational but entertaining
5. Each line should be 1-2 sentences max
6. End with Peter giving a final, enthusiastic summary

Format your response as a dialogue with clear speaker labels:
Peter: [text]
Stewie: [text]

Keep the total response under 350 words.`;

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
      throw new Error('Failed to generate response from OpenAI');
    }
  }

  private generateTestResponse(topic: string): ChatResponse {
    try {
      // Load the test script from file
      if (!fs.existsSync(this.testScriptPath)) {
        throw new Error(`Test script file not found: ${this.testScriptPath}`);
      }
      
      const testMessage = fs.readFileSync(this.testScriptPath, 'utf8').trim();
      
      // Parse the dialogue from the file
      const testDialogue = this.parseDialogue(testMessage);
      
      if (testDialogue.length === 0) {
        throw new Error('No valid dialogue found in test script file');
      }
      
      return {
        message: testMessage,
        dialogue: testDialogue,
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
    } catch (error) {
      throw new Error(`Failed to load test dialogue: ${error instanceof Error ? error.message : 'Unknown error'}`);
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