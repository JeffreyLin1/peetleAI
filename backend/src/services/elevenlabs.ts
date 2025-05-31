import axios from 'axios';
import path from 'path';
import { VideoService, SubtitleSegment } from './video';
import { AudioService } from './audio';

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

export interface DialogueLine {
  speaker: 'Peter' | 'Stewie';
  text: string;
  imagePlaceholder?: string;
}

// Voice IDs for the characters
const VOICE_IDS = {
  Peter: 'Z71pmCaOEMH9jS5ZdMfF', // Your Peter Griffin voice
  Stewie: 'kBUruHAgU5NBnV7Rkqiw'  // Stewie's voice ID
};

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
  private testMode = process.env.TEST_MODE === 'true';
  private videoService: VideoService;
  private audioService: AudioService;

  constructor() {
    this.videoService = new VideoService();
    this.audioService = new AudioService();
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
      
      const response = await axios.get(
        `${this.baseUrl}/voices`,
        {
          headers: {
            'xi-api-key': apiKey,
            'Accept': 'application/json'
          }
        }
      );

      return response.data.voices;
    } catch (error) {
      if (axios.isAxiosError(error)) {
      }
      throw new Error('Failed to fetch available voices');
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
      throw new Error('Failed to fetch voice information');
    }
  }

  async generateDialogueSpeech(dialogue: DialogueLine[], imagePlaceholders?: { [placeholder: string]: string }): Promise<ElevenLabsResponse> {
    try {
      if (this.testMode) {
        return this.generateDialogueSpeechFromTestFiles(dialogue, imagePlaceholders);
      }
      
      const apiKey = this.getApiKey();
      
      const timestamp = Date.now();
      const audioSegments: string[] = [];
      const subtitleSegments: SubtitleSegment[] = [];
      
      let currentTime = 0;
      
      // Generate audio for each dialogue line
      for (let i = 0; i < dialogue.length; i++) {
        const line = dialogue[i];
        const voiceId = VOICE_IDS[line.speaker];
        
        const requestBody = {
          text: line.text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.3,
            use_speaker_boost: false
          }
        };

        const response = await axios.post(
          `${this.baseUrl}/text-to-speech/${voiceId}`,
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

        // Save individual audio segment
        const segmentFilename = `dialogue_${timestamp}_${i}_${line.speaker.toLowerCase()}.mp3`;
        const segmentPath = await this.audioService.saveAudioBuffer(
          Buffer.from(response.data),
          segmentFilename
        );
        audioSegments.push(segmentPath);
        
        // Get actual audio duration
        const actualDuration = await this.audioService.getAudioDuration(segmentPath);
        
        subtitleSegments.push({
          start: currentTime,
          end: currentTime + actualDuration,
          text: line.text,
          speaker: line.speaker
        });
        
        currentTime += actualDuration + 0.8; // Add pause between speakers
      }
      
      // Combine all audio segments into one file with proper spacing
      const combinedAudioPath = path.join(this.audioService.getAudioDir(), `dialogue_combined_${timestamp}.mp3`);
      await this.audioService.combineAudioSegmentsWithTiming(
        audioSegments, 
        subtitleSegments.map(s => ({ start: s.start, end: s.end })), 
        combinedAudioPath
      );
      
      // Create video with combined audio and dialogue subtitles using VideoService
      const videoFilename = `dialogue_video_${timestamp}.mp4`;
      const videoPath = path.join(this.videoService['videoDir'], videoFilename);
      
      // Prepare dialogue segments for video generation
      const dialogueSegments = subtitleSegments.map((segment, index) => ({
        start: segment.start,
        end: segment.end,
        speaker: segment.speaker || 'Unknown',
        text: segment.text,
        imagePlaceholder: dialogue[index]?.imagePlaceholder
      }));
      
      const videoResponse = await this.videoService.createVideoFromAudio({
        audioPath: combinedAudioPath,
        outputPath: videoPath,
        useWordByWordCaptions: true,
        dialogueSegments,
        imagePlaceholders
      });
      
      // Clean up temporary files (but keep test files and let VideoService handle final audio cleanup)
      if (!this.testMode) {
        this.audioService.cleanupAudioFiles(audioSegments); // Only clean up individual segments, not combined audio
      }
      
      return {
        video_url: videoResponse.video_url,
        file_path: videoResponse.file_path,
        success: true
      };
    } catch (error) {
      throw new Error(`Failed to generate dialogue speech: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateDialogueSpeechFromTestFiles(dialogue: DialogueLine[], imagePlaceholders?: { [placeholder: string]: string }): Promise<ElevenLabsResponse> {
    try {
      const timestamp = Date.now();
      const audioSegments: string[] = [];
      const subtitleSegments: SubtitleSegment[] = [];
      
      let currentTime = 0;
      
      // Use pre-saved test audio files
      for (let i = 0; i < dialogue.length; i++) {
        const line = dialogue[i];
        
        // Copy test file to working directory
        const segmentFilename = `dialogue_${timestamp}_${i}_${line.speaker.toLowerCase()}.mp3`;
        const segmentPath = await this.audioService.copyTestAudioFile(
          line.speaker,
          i,
          segmentFilename
        );
        audioSegments.push(segmentPath);
        
        // Get actual audio duration
        const actualDuration = await this.audioService.getAudioDuration(segmentPath);
        
        subtitleSegments.push({
          start: currentTime,
          end: currentTime + actualDuration,
          text: line.text,
          speaker: line.speaker
        });
        
        currentTime += actualDuration + 0.8;
      }
      
      // Combine all audio segments
      const combinedAudioPath = path.join(this.audioService.getAudioDir(), `dialogue_combined_${timestamp}.mp3`);
      await this.audioService.combineAudioSegmentsWithTiming(
        audioSegments,
        subtitleSegments.map(s => ({ start: s.start, end: s.end })),
        combinedAudioPath
      );
      
      // Create video using VideoService
      const videoFilename = `dialogue_video_${timestamp}.mp4`;
      const videoPath = path.join(this.videoService['videoDir'], videoFilename);
      
      // Prepare dialogue segments for video generation
      const dialogueSegments = subtitleSegments.map((segment, index) => ({
        start: segment.start,
        end: segment.end,
        speaker: segment.speaker || 'Unknown',
        text: segment.text,
        imagePlaceholder: dialogue[index]?.imagePlaceholder
      }));
      
      const videoResponse = await this.videoService.createVideoFromAudio({
        audioPath: combinedAudioPath,
        outputPath: videoPath,
        useWordByWordCaptions: true,
        dialogueSegments,
        imagePlaceholders
      });
      
      // Clean up working files (let VideoService handle final audio cleanup)
      this.audioService.cleanupAudioFiles(audioSegments); // Only clean up individual segments, not combined audio
      
      return {
        video_url: videoResponse.video_url,
        file_path: videoResponse.file_path,
        success: true
      };
    } catch (error) {
      throw new Error(`Failed to generate test dialogue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 