import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface AudioSegment {
  path: string;
  start: number;
  end: number;
  speaker?: string;
  text?: string;
}

export class AudioService {
  private audioDir = path.join(process.cwd(), 'public', 'audio');
  private testAudioDir = path.join(process.cwd(), 'public', 'test_audio');

  constructor() {
    // Ensure directories exist
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
    if (!fs.existsSync(this.testAudioDir)) {
      fs.mkdirSync(this.testAudioDir, { recursive: true });
    }
  }

  async getAudioDuration(audioPath: string): Promise<number> {
    try {
      const command = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`;
      const { stdout } = await execAsync(command);
      const duration = parseFloat(stdout.trim());
      return isNaN(duration) ? 3.0 : duration; // fallback to 3 seconds if parsing fails
    } catch (error) {
      return 3.0; // fallback duration
    }
  }

  async combineAudioSegmentsWithTiming(
    audioSegments: string[], 
    timingInfo: { start: number; end: number }[], 
    outputPath: string
  ): Promise<void> {
    try {
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
      
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
    } catch (error) {
      // Fallback to simple concatenation
      await this.combineAudioSegments(audioSegments, outputPath);
    }
  }

  async combineAudioSegments(audioSegments: string[], outputPath: string): Promise<void> {
    try {
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
      
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      // Clean up temporary files
      tempFiles.forEach(file => {
        if ((file.includes('_with_silence.mp3') || file.includes('_boosted.mp3')) && fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
      if (fs.existsSync(listFilePath)) fs.unlinkSync(listFilePath);
      
    } catch (error) {
      throw new Error(`Failed to combine audio segments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async saveAudioBuffer(buffer: Buffer, filename: string): Promise<string> {
    const audioPath = path.join(this.audioDir, filename);
    fs.writeFileSync(audioPath, buffer);
    return audioPath;
  }

  async copyTestAudioFile(speaker: string, index: number, targetFilename: string): Promise<string> {
    const testAudioFile = path.join(this.testAudioDir, `${speaker.toLowerCase()}_${index}.mp3`);
    
    if (!fs.existsSync(testAudioFile)) {
      throw new Error(`Test audio file not found: ${testAudioFile}. Please generate audio files first with USE_TEST_AUDIO=false`);
    }
    
    const targetPath = path.join(this.audioDir, targetFilename);
    fs.copyFileSync(testAudioFile, targetPath);
    
    return targetPath;
  }

  cleanupAudioFiles(filePaths: string[]): void {
    filePaths.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  }

  getAudioDir(): string {
    return this.audioDir;
  }

  getTestAudioDir(): string {
    return this.testAudioDir;
  }
} 