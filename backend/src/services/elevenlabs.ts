import axios from 'axios';
import fs from 'fs';
import path from 'path';

export interface ElevenLabsResponse {
  audio_url?: string;
  file_path?: string;
  success: boolean;
}

export interface Voice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
}

export interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
  speed?: number;
}

// 🎛️ VOICE SETTINGS CONFIGURATION
// Modify these values to customize the voice output
const VOICE_CONFIG: VoiceSettings = {
  stability: 0.5,           // 0-1: Lower = more emotional range, Higher = more stable
  similarity_boost: 0.5,    // 0-1: How closely AI adheres to original voice
  style: 0.3,                 // 0-1: Style exaggeration (0 = faster, >0 = more style)
  use_speaker_boost: false, // Boolean: Boosts similarity but increases latency
  speed: 1.4               // 0.25-4.0: Speech speed (1.0 = normal)
};

export class ElevenLabsService {
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private audioDir = path.join(process.cwd(), 'public', 'audio');

  constructor() {
    // Ensure audio directory exists
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  private getApiKey() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      throw new Error('ElevenLabs API key is required. Please set ELEVENLABS_API_KEY in your .env file');
    }
    
    return apiKey;
  }

  async listVoices(): Promise<Voice[]> {
    try {
      const apiKey = this.getApiKey();
      
      console.log('Fetching available voices from ElevenLabs...');
      
      const response = await axios.get(
        `${this.baseUrl}/voices`,
        {
          headers: {
            'xi-api-key': apiKey,
            'Accept': 'application/json'
          }
        }
      );

      console.log('ElevenLabs voices fetched successfully');
      return response.data.voices;
    } catch (error) {
      console.error('Error fetching ElevenLabs voices:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response status:', error.response?.status);
        console.error('Response data:', error.response?.data);
      }
      throw new Error('Failed to fetch available voices');
    }
  }

  async generateSpeech(
    text: string, 
    voiceId: string = 'Z71pmCaOEMH9jS5ZdMfF'
  ): Promise<ElevenLabsResponse> {
    try {
      const apiKey = this.getApiKey();
      
      console.log('Generating speech with ElevenLabs...');
      console.log('Voice ID:', voiceId);
      console.log('Text length:', text.length);
      console.log('Voice settings:', VOICE_CONFIG);
      
      // Use the provided voice ID directly
      let selectedVoiceId = voiceId;
      
      if (voiceId === 'peter-griffin' || voiceId === 'default') {
        selectedVoiceId = 'Z71pmCaOEMH9jS5ZdMfF'; // Your specific voice
        console.log('Using your custom voice ID');
      }

      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${selectedVoiceId}`,
        {
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: VOICE_CONFIG
        },
        {
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          responseType: 'arraybuffer'
        }
      );

      console.log('ElevenLabs speech generation successful!');
      
      // Generate a unique filename
      const timestamp = Date.now();
      const filename = `speech_${timestamp}.mp3`;
      const filePath = path.join(this.audioDir, filename);
      
      // Save the MP3 file to disk
      fs.writeFileSync(filePath, Buffer.from(response.data));
      console.log('MP3 file saved to:', filePath);
      
      // Return the URL path that can be served by Express
      const audioUrl = `/audio/${filename}`;
      
      return {
        audio_url: audioUrl,
        file_path: filePath,
        success: true
      };
    } catch (error) {
      console.error('ElevenLabs API error:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response status:', error.response?.status);
        console.error('Response data:', error.response?.data);
        console.error('Request URL:', error.config?.url);
        console.error('Request headers:', error.config?.headers);
      }
      throw new Error(`Failed to generate speech: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getVoiceInfo(voiceId: string): Promise<Voice> {
    try {
      const apiKey = this.getApiKey();
      
      const response = await axios.get(
        `${this.baseUrl}/voices/${voiceId}`,
        {
          headers: {
            'xi-api-key': apiKey,
            'Accept': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching voice info:', error);
      throw new Error('Failed to fetch voice information');
    }
  }
} 