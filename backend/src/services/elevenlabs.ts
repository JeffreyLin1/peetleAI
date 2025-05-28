import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ElevenLabsResponse {
  audio_url?: string;
  video_url?: string;
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
  private videoDir = path.join(process.cwd(), 'public', 'videos');

  constructor() {
    // Ensure directories exist
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
    if (!fs.existsSync(this.videoDir)) {
      fs.mkdirSync(this.videoDir, { recursive: true });
    }
  }

  private getApiKey() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      throw new Error('ElevenLabs API key is required. Please set ELEVENLABS_API_KEY in your .env file');
    }
    
    return apiKey;
  }

  private createSubtitleFile(text: string, filePath: string): void {
    // Create a simple SRT subtitle file
    // Split long text into multiple subtitle segments for better readability
    const maxCharsPerLine = 60;
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    
    // Create subtitle segments (each showing for 5 seconds)
    let srtContent = '';
    for (let i = 0; i < lines.length; i++) {
      const startTime = i * 5;
      const endTime = (i + 1) * 5;
      const startTimeStr = this.formatTime(startTime);
      const endTimeStr = this.formatTime(endTime);
      
      srtContent += `${i + 1}\n${startTimeStr} --> ${endTimeStr}\n${lines[i]}\n\n`;
    }
    
    fs.writeFileSync(filePath, srtContent);
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},000`;
  }

  private async createVideoWithSubtitles(audioPath: string, text: string, outputPath: string): Promise<void> {
    try {
      console.log('Creating video with subtitles...');
      
      // Create subtitle file
      const srtPath = audioPath.replace('.mp3', '.srt');
      this.createSubtitleFile(text, srtPath);
      
      // Escape the subtitle path for FFmpeg
      const escapedSrtPath = srtPath.replace(/'/g, "'\\''");
      
      // FFmpeg command with browser-compatible settings
      const ffmpegCommand = `ffmpeg -f lavfi -i color=c=black:s=1280x720:d=600 -i "${audioPath}" -vf "subtitles='${escapedSrtPath}':force_style='Fontsize=18,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Alignment=2,MarginV=40'" -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -shortest -y "${outputPath}"`;
      
      console.log('Running FFmpeg command:', ffmpegCommand);
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      if (stderr) {
        console.log('FFmpeg stderr:', stderr);
      }
      if (stdout) {
        console.log('FFmpeg stdout:', stdout);
      }
      
      // Verify the output file was created and has content
      if (!fs.existsSync(outputPath)) {
        throw new Error('Video file was not created');
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Video file is empty');
      }
      
      console.log(`Video created successfully: ${outputPath} (${stats.size} bytes)`);
      
      // Clean up subtitle file
      if (fs.existsSync(srtPath)) {
        fs.unlinkSync(srtPath);
      }
      
    } catch (error) {
      console.error('Error creating video:', error);
      throw new Error(`Failed to create video with subtitles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
      
      // Check text length - ElevenLabs has limits
      if (text.length > 5000) {
        throw new Error(`Text too long: ${text.length} characters. Maximum is 5000 characters.`);
      }
      
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

      // Simplified request body to troubleshoot
      const requestBody = {
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.3,
          use_speaker_boost: false
        }
      };

      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${selectedVoiceId}`,
        requestBody,
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
      
      // Generate unique filenames
      const timestamp = Date.now();
      const audioFilename = `speech_${timestamp}.mp3`;
      const videoFilename = `video_${timestamp}.mp4`;
      const audioPath = path.join(this.audioDir, audioFilename);
      const videoPath = path.join(this.videoDir, videoFilename);
      
      // Save the MP3 file to disk
      fs.writeFileSync(audioPath, Buffer.from(response.data));
      console.log('MP3 file saved to:', audioPath);
      
      // Create video with subtitles
      await this.createVideoWithSubtitles(audioPath, text, videoPath);
      
      // Clean up the temporary audio file
      fs.unlinkSync(audioPath);
      
      // Return the video URL path that can be served by Express
      const videoUrl = `/videos/${videoFilename}`;
      
      return {
        video_url: videoUrl,
        file_path: videoPath,
        success: true
      };
    } catch (error) {
      console.error('ElevenLabs API error:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response status:', error.response?.status);
        console.error('Response data:', error.response?.data);
        console.error('Response headers:', error.response?.headers);
        console.error('Request URL:', error.config?.url);
        console.error('Request headers:', error.config?.headers);
        console.error('Request data:', error.config?.data);
        
        // Check if it's a text length issue
        if (error.response?.status === 400) {
          console.error('Text length:', text.length);
          console.error('Text preview:', text.substring(0, 200) + '...');
        }
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