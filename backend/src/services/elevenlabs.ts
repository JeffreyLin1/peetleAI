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

  async generateDialogueSpeech(dialogue: DialogueLine[]): Promise<ElevenLabsResponse> {
    try {
      const apiKey = this.getApiKey();
      
      console.log('Generating dialogue speech with multiple voices...');
      console.log('Dialogue lines:', dialogue.length);
      
      const timestamp = Date.now();
      const audioSegments: string[] = [];
      const subtitleSegments: { start: number; end: number; text: string; speaker: string }[] = [];
      
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
        const segmentPath = path.join(this.audioDir, segmentFilename);
        fs.writeFileSync(segmentPath, Buffer.from(response.data));
        audioSegments.push(segmentPath);
        
        // Get actual audio duration using FFprobe
        const actualDuration = await this.getAudioDuration(segmentPath);
        
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
      const combinedAudioPath = path.join(this.audioDir, `dialogue_combined_${timestamp}.mp3`);
      await this.combineAudioSegmentsWithTiming(audioSegments, subtitleSegments, combinedAudioPath);
      
      // Create subtitle file for dialogue
      const srtPath = combinedAudioPath.replace('.mp3', '.srt');
      this.createDialogueSubtitleFile(subtitleSegments, srtPath);
      
      // Create video with combined audio and dialogue subtitles
      const videoFilename = `dialogue_video_${timestamp}.mp4`;
      const videoPath = path.join(this.videoDir, videoFilename);
      await this.createDialogueVideoWithSubtitles(combinedAudioPath, srtPath, videoPath);
      
      // Clean up temporary files
      audioSegments.forEach(segment => {
        if (fs.existsSync(segment)) fs.unlinkSync(segment);
      });
      if (fs.existsSync(combinedAudioPath)) fs.unlinkSync(combinedAudioPath);
      if (fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
      
      const videoUrl = `/videos/${videoFilename}`;
      
      return {
        video_url: videoUrl,
        file_path: videoPath,
        success: true
      };
    } catch (error) {
      console.error('Dialogue speech generation error:', error);
      throw new Error(`Failed to generate dialogue speech: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getAudioDuration(audioPath: string): Promise<number> {
    try {
      const command = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`;
      const { stdout } = await execAsync(command);
      const duration = parseFloat(stdout.trim());
      return isNaN(duration) ? 3.0 : duration; // fallback to 3 seconds if parsing fails
    } catch (error) {
      console.error('Error getting audio duration:', error);
      return 3.0; // fallback duration
    }
  }

  private async combineAudioSegmentsWithTiming(
    audioSegments: string[], 
    timingInfo: { start: number; end: number }[], 
    outputPath: string
  ): Promise<void> {
    try {
      console.log('Combining audio segments with proper timing...');
      
      if (audioSegments.length === 1) {
        fs.copyFileSync(audioSegments[0], outputPath);
        return;
      }
      
      // Create a filter complex that properly spaces the audio segments
      let filterComplex = '';
      let inputs = '';
      
      // Add all input files
      for (let i = 0; i < audioSegments.length; i++) {
        inputs += `-i "${audioSegments[i]}" `;
      }
      
      // Create the filter complex to delay each segment appropriately and normalize volume
      for (let i = 0; i < audioSegments.length; i++) {
        const delay = timingInfo[i].start;
        if (i === 0) {
          if (delay > 0) {
            filterComplex += `[${i}:a]volume=2.0,adelay=${Math.round(delay * 1000)}|${Math.round(delay * 1000)}[delayed${i}];`;
          } else {
            filterComplex += `[${i}:a]volume=2.0[delayed${i}];`;
          }
        } else {
          filterComplex += `[${i}:a]volume=2.0,adelay=${Math.round(delay * 1000)}|${Math.round(delay * 1000)}[delayed${i}];`;
        }
      }
      
      // Mix all delayed segments together with no automatic normalization
      filterComplex += audioSegments.map((_, i) => `[delayed${i}]`).join('') + `amix=inputs=${audioSegments.length}:duration=longest:normalize=0[out]`;
      
      const ffmpegCommand = `ffmpeg ${inputs} -filter_complex "${filterComplex}" -map "[out]" -y "${outputPath}"`;
      
      console.log('Running FFmpeg timing command:', ffmpegCommand);
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      if (stderr) console.log('FFmpeg timing stderr:', stderr);
      if (stdout) console.log('FFmpeg timing stdout:', stdout);
      
      console.log('Audio segments combined with timing successfully');
    } catch (error) {
      console.error('Error combining audio segments with timing:', error);
      // Fallback to simple concatenation
      await this.combineAudioSegments(audioSegments, outputPath);
    }
  }

  private async combineAudioSegments(audioSegments: string[], outputPath: string): Promise<void> {
    try {
      console.log('Combining audio segments (fallback method)...');
      
      if (audioSegments.length === 1) {
        // Apply volume boost to single segment too
        const boostCommand = `ffmpeg -i "${audioSegments[0]}" -filter:a "volume=2.0" -y "${outputPath}"`;
        await execAsync(boostCommand);
        return;
      }
      
      // Simple concatenation with small pauses and volume boost
      const tempFiles: string[] = [];
      
      for (let i = 0; i < audioSegments.length; i++) {
        const segment = audioSegments[i];
        
        if (i < audioSegments.length - 1) {
          // Add silence after each segment except the last, with volume boost
          const tempWithSilence = segment.replace('.mp3', '_with_silence.mp3');
          const silenceCommand = `ffmpeg -i "${segment}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t 0.8 -filter_complex "[0:a]volume=2.0[boosted];[boosted][1:a]concat=n=2:v=0:a=1[out]" -map "[out]" -y "${tempWithSilence}"`;
          
          await execAsync(silenceCommand);
          tempFiles.push(tempWithSilence);
        } else {
          // Boost volume of last segment
          const tempBoosted = segment.replace('.mp3', '_boosted.mp3');
          const boostCommand = `ffmpeg -i "${segment}" -filter:a "volume=2.0" -y "${tempBoosted}"`;
          await execAsync(boostCommand);
          tempFiles.push(tempBoosted);
        }
      }
      
      // Concatenate all files
      const inputList = tempFiles.map(file => `file '${file}'`).join('\n');
      const listFilePath = outputPath.replace('.mp3', '_list.txt');
      fs.writeFileSync(listFilePath, inputList);
      
      const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${listFilePath}" -c copy -y "${outputPath}"`;
      
      console.log('Running FFmpeg fallback command:', ffmpegCommand);
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      if (stderr) console.log('FFmpeg fallback stderr:', stderr);
      if (stdout) console.log('FFmpeg fallback stdout:', stdout);
      
      // Clean up temporary files
      tempFiles.forEach(file => {
        if ((file.includes('_with_silence.mp3') || file.includes('_boosted.mp3')) && fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
      if (fs.existsSync(listFilePath)) fs.unlinkSync(listFilePath);
      
      console.log('Audio segments combined successfully (fallback)');
    } catch (error) {
      console.error('Error combining audio segments (fallback):', error);
      throw new Error(`Failed to combine audio segments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private createDialogueSubtitleFile(segments: { start: number; end: number; text: string; speaker: string }[], filePath: string): void {
    let srtContent = '';
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const startTimeStr = this.formatTime(Math.floor(segment.start));
      const endTimeStr = this.formatTime(Math.floor(segment.end));
      
      // Include speaker name in subtitle
      const subtitleText = `${segment.speaker}: ${segment.text}`;
      
      srtContent += `${i + 1}\n${startTimeStr} --> ${endTimeStr}\n${subtitleText}\n\n`;
    }
    
    fs.writeFileSync(filePath, srtContent);
  }

  private async createDialogueVideoWithSubtitles(audioPath: string, srtPath: string, outputPath: string): Promise<void> {
    try {
      console.log('Creating dialogue video with subtitles...');
      
      // Escape the subtitle path for FFmpeg
      const escapedSrtPath = srtPath.replace(/'/g, "'\\''");
      
      // FFmpeg command with browser-compatible settings and dialogue-specific styling
      const ffmpegCommand = `ffmpeg -f lavfi -i color=c=black:s=1280x720:d=600 -i "${audioPath}" -vf "subtitles='${escapedSrtPath}':force_style='Fontsize=16,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Alignment=2,MarginV=40'" -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -shortest -y "${outputPath}"`;
      
      console.log('Running FFmpeg dialogue video command:', ffmpegCommand);
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      if (stderr) console.log('FFmpeg dialogue stderr:', stderr);
      if (stdout) console.log('FFmpeg dialogue stdout:', stdout);
      
      // Verify the output file was created and has content
      if (!fs.existsSync(outputPath)) {
        throw new Error('Dialogue video file was not created');
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Dialogue video file is empty');
      }
      
      console.log(`Dialogue video created successfully: ${outputPath} (${stats.size} bytes)`);
    } catch (error) {
      console.error('Error creating dialogue video:', error);
      throw new Error(`Failed to create dialogue video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 