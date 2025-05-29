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
  private testMode = process.env.USE_TEST_AUDIO === 'true';
  private videoService: VideoService;
  private audioService: AudioService;

  constructor() {
    this.videoService = new VideoService();
    this.audioService = new AudioService();
    console.log(`ElevenLabs Service initialized in ${this.testMode ? 'TEST' : 'LIVE'} mode`);
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

      // Request body for ElevenLabs API
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
      
      // Save the MP3 file to disk
      const audioPath = await this.audioService.saveAudioBuffer(
        Buffer.from(response.data), 
        audioFilename
      );
      
      // Create video with subtitles using VideoService
      const videoPath = path.join(this.videoService['videoDir'], videoFilename);
      const videoResponse = await this.videoService.createVideoFromAudio({
        audioPath,
        text,
        outputPath: videoPath
      });
      
      // Clean up the temporary audio file
      this.audioService.cleanupAudioFiles([audioPath]);
      
      return {
        video_url: videoResponse.video_url,
        file_path: videoResponse.file_path,
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

  async generateDialogueSpeech(dialogue: DialogueLine[]): Promise<ElevenLabsResponse> {
    try {
      if (this.testMode) {
        return this.generateDialogueSpeechFromTestFiles(dialogue);
      }
      
      const apiKey = this.getApiKey();
      
      console.log('Generating dialogue speech with multiple voices...');
      console.log('Dialogue lines:', dialogue.length);
      
      const timestamp = Date.now();
      const audioSegments: string[] = [];
      const subtitleSegments: SubtitleSegment[] = [];
      
      let currentTime = 0;
      
      // Generate audio for each dialogue line
      for (let i = 0; i < dialogue.length; i++) {
        const line = dialogue[i];
        const voiceId = VOICE_IDS[line.speaker];
        
        console.log(`Generating audio for ${line.speaker}: "${line.text}"`);
        
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
        
        console.log(`Generated audio segment for ${line.speaker} (${actualDuration.toFixed(2)}s)`);
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
      
      // Prepare dialogue segments for Whisper transcription
      const dialogueSegments = subtitleSegments.map(segment => ({
        start: segment.start,
        end: segment.end,
        speaker: segment.speaker || 'Unknown',
        text: segment.text
      }));
      
      const videoResponse = await this.videoService.createVideoFromAudio({
        audioPath: combinedAudioPath,
        outputPath: videoPath,
        useWordByWordCaptions: true,
        dialogueSegments
      });
      
      // Clean up temporary files (but keep test files)
      if (!this.testMode) {
        this.audioService.cleanupAudioFiles([...audioSegments, combinedAudioPath]);
      } else {
        console.log('Test mode: Keeping audio files for inspection');
      }
      
      return {
        video_url: videoResponse.video_url,
        file_path: videoResponse.file_path,
        success: true
      };
    } catch (error) {
      console.error('Dialogue speech generation error:', error);
      throw new Error(`Failed to generate dialogue speech: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateDialogueSpeechFromTestFiles(dialogue: DialogueLine[]): Promise<ElevenLabsResponse> {
    try {
      console.log('Using test audio files for dialogue generation...');
      
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
        
        console.log(`Using test audio for ${line.speaker} (${actualDuration.toFixed(2)}s)`);
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
      
      // Prepare dialogue segments for Whisper transcription
      const dialogueSegments = subtitleSegments.map(segment => ({
        start: segment.start,
        end: segment.end,
        speaker: segment.speaker || 'Unknown',
        text: segment.text
      }));
      
      const videoResponse = await this.videoService.createVideoFromAudio({
        audioPath: combinedAudioPath,
        outputPath: videoPath,
        useWordByWordCaptions: true,
        dialogueSegments
      });
      
      // Clean up working files
      this.audioService.cleanupAudioFiles([...audioSegments, combinedAudioPath]);
      
      return {
        video_url: videoResponse.video_url,
        file_path: videoResponse.file_path,
        success: true
      };
    } catch (error) {
      console.error('Test dialogue generation error:', error);
      throw new Error(`Failed to generate test dialogue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 