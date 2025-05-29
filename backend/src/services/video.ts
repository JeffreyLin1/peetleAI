import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface VideoGenerationOptions {
  audioPath: string;
  text?: string;
  outputPath: string;
  subtitleSegments?: SubtitleSegment[];
}

export interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface VideoResponse {
  video_url: string;
  file_path: string;
  success: boolean;
}

export class VideoService {
  private videoDir = path.join(process.cwd(), 'public', 'videos');
  private backgroundVideoPath = path.join(process.cwd(), 'public', 'backgrounds', 'Minecraft.mp4');
  private peterImagePath = path.join(process.cwd(), 'public', 'characters', 'peter.png');
  private stewieImagePath = path.join(process.cwd(), 'public', 'characters', 'stewie.png');

  constructor() {
    // Ensure video directory exists
    if (!fs.existsSync(this.videoDir)) {
      fs.mkdirSync(this.videoDir, { recursive: true });
    }
  }

  async createVideoFromAudio(options: VideoGenerationOptions): Promise<VideoResponse> {
    const { audioPath, text, outputPath, subtitleSegments } = options;
    
    try {
      if (subtitleSegments && subtitleSegments.length > 0) {
        // Create dialogue video with character overlays
        const srtPath = audioPath.replace('.mp3', '.srt');
        this.createDialogueSubtitleFile(subtitleSegments, srtPath);
        await this.createDialogueVideoWithSubtitles(audioPath, srtPath, outputPath);
        
        // Clean up subtitle file
        if (fs.existsSync(srtPath)) {
          fs.unlinkSync(srtPath);
        }
      } else if (text) {
        // Create single voice video with subtitles
        await this.createVideoWithSubtitles(audioPath, text, outputPath);
      } else {
        throw new Error('Either text or subtitleSegments must be provided');
      }

      const filename = path.basename(outputPath);
      const videoUrl = `/videos/${filename}`;

      return {
        video_url: videoUrl,
        file_path: outputPath,
        success: true
      };
    } catch (error) {
      console.error('Error creating video:', error);
      throw new Error(`Failed to create video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

  private createDialogueSubtitleFile(segments: SubtitleSegment[], filePath: string): void {
    let srtContent = '';
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const startTimeStr = this.formatTime(Math.floor(segment.start));
      const endTimeStr = this.formatTime(Math.floor(segment.end));
      
      // Include speaker name in subtitle if available
      const subtitleText = segment.speaker ? `${segment.speaker}: ${segment.text}` : segment.text;
      
      srtContent += `${i + 1}\n${startTimeStr} --> ${endTimeStr}\n${subtitleText}\n\n`;
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
      console.log('Creating video with background and subtitles...');
      
      // Check if background video exists
      if (!fs.existsSync(this.backgroundVideoPath)) {
        console.warn('Background video not found, creating video without background');
        return this.createSingleVideoWithoutBackground(audioPath, text, outputPath);
      }
      
      // Get the duration of the audio to match the background video length
      const audioDuration = await this.getAudioDuration(audioPath);
      console.log(`Audio duration: ${audioDuration.toFixed(2)}s`);
      
      // Create subtitle file
      const srtPath = audioPath.replace('.mp3', '.srt');
      this.createSubtitleFile(text, srtPath);
      
      // Escape the subtitle path for FFmpeg
      const escapedSrtPath = srtPath.replace(/'/g, "'\\''");
      
      // FFmpeg command with background video
      const ffmpegCommand = `ffmpeg -stream_loop -1 -i "${this.backgroundVideoPath}" -i "${audioPath}" -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS[bg];[bg]subtitles='${escapedSrtPath}':force_style='Fontsize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=3,Alignment=2,MarginV=80,Bold=1'[v]" -map "[v]" -map 1:a -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -t ${audioDuration} -y "${outputPath}"`;
      
      console.log('Running FFmpeg single voice background command:', ffmpegCommand);
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      if (stderr) console.log('FFmpeg single voice stderr:', stderr);
      if (stdout) console.log('FFmpeg single voice stdout:', stdout);
      
      // Verify the output file was created and has content
      if (!fs.existsSync(outputPath)) {
        throw new Error('Single voice video file was not created');
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Single voice video file is empty');
      }
      
      console.log(`Single voice video created successfully: ${outputPath} (${stats.size} bytes)`);
      
      // Clean up subtitle file
      if (fs.existsSync(srtPath)) {
        fs.unlinkSync(srtPath);
      }
      
    } catch (error) {
      console.error('Error creating single voice video:', error);
      // Fallback to creating video without background
      console.log('Falling back to single voice video without background...');
      await this.createSingleVideoWithoutBackground(audioPath, text, outputPath);
    }
  }

  private async createSingleVideoWithoutBackground(audioPath: string, text: string, outputPath: string): Promise<void> {
    try {
      console.log('Creating single voice video without background...');
      
      // Create subtitle file
      const srtPath = audioPath.replace('.mp3', '.srt');
      this.createSubtitleFile(text, srtPath);
      
      // Escape the subtitle path for FFmpeg
      const escapedSrtPath = srtPath.replace(/'/g, "'\\''");
      
      // FFmpeg command with black background (9:16 format)
      const ffmpegCommand = `ffmpeg -f lavfi -i color=c=black:s=1080x1920:d=600 -i "${audioPath}" -vf "subtitles='${escapedSrtPath}':force_style='Fontsize=22,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Alignment=2,MarginV=60'" -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -shortest -y "${outputPath}"`;
      
      console.log('Running FFmpeg single voice fallback command:', ffmpegCommand);
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      if (stderr) console.log('FFmpeg single voice fallback stderr:', stderr);
      if (stdout) console.log('FFmpeg single voice fallback stdout:', stdout);
      
      // Verify the output file was created and has content
      if (!fs.existsSync(outputPath)) {
        throw new Error('Single voice fallback video file was not created');
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Single voice fallback video file is empty');
      }
      
      console.log(`Single voice fallback video created successfully: ${outputPath} (${stats.size} bytes)`);
      
      // Clean up subtitle file
      if (fs.existsSync(srtPath)) {
        fs.unlinkSync(srtPath);
      }
      
    } catch (error) {
      console.error('Error creating single voice fallback video:', error);
      throw new Error(`Failed to create single voice video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createDialogueVideoWithSubtitles(audioPath: string, srtPath: string, outputPath: string): Promise<void> {
    try {
      console.log('Creating dialogue video with background, characters, and subtitles...');
      
      // Check if all required files exist
      if (!fs.existsSync(this.backgroundVideoPath)) {
        console.warn('Background video not found, creating video without background');
        return this.createVideoWithoutBackground(audioPath, srtPath, outputPath);
      }
      
      if (!fs.existsSync(this.peterImagePath) || !fs.existsSync(this.stewieImagePath)) {
        console.warn('Character images not found, creating video without characters');
        console.log('Peter image exists:', fs.existsSync(this.peterImagePath), 'Path:', this.peterImagePath);
        console.log('Stewie image exists:', fs.existsSync(this.stewieImagePath), 'Path:', this.stewieImagePath);
        return this.createDialogueVideoWithoutCharacters(audioPath, srtPath, outputPath);
      }
      
      console.log('✅ All files found:');
      console.log('  Background video:', this.backgroundVideoPath);
      console.log('  Peter image:', this.peterImagePath);
      console.log('  Stewie image:', this.stewieImagePath);
      console.log('  SRT file:', srtPath);
      
      // Get the duration of the audio to match the background video length
      const audioDuration = await this.getAudioDuration(audioPath);
      console.log(`Audio duration: ${audioDuration.toFixed(2)}s`);
      
      // Parse subtitle timing to know when each character speaks
      const characterTimings = await this.parseSubtitleTimings(srtPath);
      
      console.log('🎭 Character timings parsed:', characterTimings.length);
      characterTimings.forEach((timing, index) => {
        console.log(`  ${index}: ${timing.speaker} speaks from ${timing.start.toFixed(2)}s to ${timing.end.toFixed(2)}s`);
      });
      
      // Escape the subtitle path for FFmpeg
      const escapedSrtPath = srtPath.replace(/'/g, "'\\''");
      
      // Build the complete filter complex
      let filterComplex = '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS[bg];';
      
      // Create character overlay filters based on dialogue timing
      const characterFilters = this.createCharacterOverlayFilters(characterTimings, audioDuration);
      
      console.log('🎬 Character filters generated:', characterFilters ? 'YES' : 'NO');
      if (characterFilters) {
        console.log('Character filters content:', characterFilters);
      }
      
      if (characterFilters) {
        // Add character overlays and get the final video stream
        const finalLabel = characterFilters.match(/\[overlay_\d+\]$/)?.[0] || '[bg]';
        filterComplex += characterFilters + `;${finalLabel}subtitles='${escapedSrtPath}':force_style='Fontsize=22,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=3,Alignment=2,MarginV=60,Bold=1'[v]`;
        console.log('Final label extracted:', finalLabel);
      } else {
        // No character overlays, just add subtitles to background
        filterComplex += '[bg]subtitles=\'' + escapedSrtPath + '\':force_style=\'Fontsize=22,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=3,Alignment=2,MarginV=60,Bold=1\'[v]';
        console.log('⚠️ No character filters - using background only');
      }
      
      console.log('🎥 Final filter complex:', filterComplex);
      
      // FFmpeg command with background video, character overlays, and subtitles
      const ffmpegCommand = `ffmpeg -stream_loop -1 -i "${this.backgroundVideoPath}" -i "${audioPath}" -i "${this.peterImagePath}" -i "${this.stewieImagePath}" -filter_complex "${filterComplex}" -map "[v]" -map 1:a -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -t ${audioDuration} -y "${outputPath}"`;
      
      console.log('🚀 Running FFmpeg character dialogue command:');
      console.log(ffmpegCommand);
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      if (stderr) console.log('FFmpeg character dialogue stderr:', stderr);
      if (stdout) console.log('FFmpeg character dialogue stdout:', stdout);
      
      // Verify the output file was created and has content
      if (!fs.existsSync(outputPath)) {
        throw new Error('Character dialogue video file was not created');
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Character dialogue video file is empty');
      }
      
      console.log(`Character dialogue video created successfully: ${outputPath} (${stats.size} bytes)`);
    } catch (error) {
      console.error('Error creating character dialogue video:', error);
      // Fallback to creating video without characters
      console.log('Falling back to dialogue video without characters...');
      await this.createDialogueVideoWithoutCharacters(audioPath, srtPath, outputPath);
    }
  }

  private async parseSubtitleTimings(srtPath: string): Promise<{ speaker: string; start: number; end: number }[]> {
    try {
      console.log('📄 Parsing subtitle file:', srtPath);
      const srtContent = fs.readFileSync(srtPath, 'utf8');
      console.log('📄 SRT content length:', srtContent.length);
      console.log('📄 SRT content preview:', srtContent.substring(0, 200) + '...');
      
      const timings: { speaker: string; start: number; end: number }[] = [];
      
      const blocks = srtContent.split('\n\n').filter(block => block.trim());
      console.log('📄 SRT blocks found:', blocks.length);
      
      for (const block of blocks) {
        const lines = block.split('\n');
        console.log('📄 Processing block with', lines.length, 'lines:', lines);
        
        if (lines.length >= 3) {
          const timeLine = lines[1];
          const textLine = lines[2];
          
          console.log('📄 Time line:', timeLine);
          console.log('📄 Text line:', textLine);
          
          // Parse time format: 00:00:00,000 --> 00:00:05,000
          const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
          if (timeMatch) {
            const startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
            const endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
            
            console.log('📄 Parsed times:', startTime, 'to', endTime);
            
            // Extract speaker from text (format: "Peter: text" or "Stewie: text")
            const speakerMatch = textLine.match(/^(Peter|Stewie):/);
            if (speakerMatch) {
              console.log('📄 Speaker found:', speakerMatch[1]);
              timings.push({
                speaker: speakerMatch[1],
                start: startTime,
                end: endTime
              });
            } else {
              console.log('📄 No speaker match found in:', textLine);
            }
          } else {
            console.log('📄 No time match found in:', timeLine);
          }
        }
      }
      
      console.log('📄 Final timings array:', timings);
      return timings;
    } catch (error) {
      console.error('Error parsing subtitle timings:', error);
      return [];
    }
  }

  private createCharacterOverlayFilters(timings: { speaker: string; start: number; end: number }[], totalDuration: number): string {
    console.log('🎬 Creating character overlay filters...');
    console.log('🎬 Input timings:', timings);
    console.log('🎬 Total duration:', totalDuration);
    
    if (timings.length === 0) {
      console.log('🎬 No timings provided, returning empty filters');
      return '';
    }
    
    // Animation parameters
    const slideAnimationDuration = 0.8; // Increased duration for more obvious easing
    const slideInEarly = 0.2; // Slide in 0.3 seconds before dialogue starts
    const slideOutLate = 0.6; // Slide out 0.3 seconds after dialogue ends
    
    let filters = '';
    let currentInput = '[bg]';
    
    // Process each timing individually with eased animations
    // Each overlay gets its own scaled version to avoid input conflicts
    for (let i = 0; i < timings.length; i++) {
      const timing = timings[i];
      console.log(`🎬 Processing timing ${i}: ${timing.speaker} from ${timing.start} to ${timing.end}`);
      
      // Adjust timing for early slide-in and late slide-out
      const animationStart = Math.max(0, timing.start - slideInEarly); // Don't go below 0
      const animationEnd = timing.end + slideOutLate;
      const slideInEnd = animationStart + slideAnimationDuration;
      const slideOutStart = animationEnd - slideAnimationDuration;
      
      console.log(`🎬 Animation timing ${i}: starts at ${animationStart.toFixed(2)}s, ends at ${animationEnd.toFixed(2)}s`);
      
      if (timing.speaker === 'Stewie') {
        // Create a unique scaled version for this specific overlay (positioned higher up)
        filters += `[3:v]scale=600:600:force_original_aspect_ratio=decrease[stewie_${i}];`;
        
        // Stewie slides from left: x goes from -600 to 50 with easing (adjusted for 1080 width)
        let xExpression;
        
        if (slideOutStart <= slideInEnd) {
          // Short dialogue - just slide in with easing and stay
          // Using stronger ease-out function: 1 - (1-t)^4 for more obvious deceleration
          const progress = `min(1,(t-${animationStart})/${slideAnimationDuration})`;
          const easedProgress = `(1-pow(1-${progress},4))`;
          xExpression = `if(between(t,${animationStart},${animationEnd}),-600+650*${easedProgress},-600)`;
        } else {
          // Full animation: slide in with easing, stay, slide out with easing
          const slideInProgress = `(t-${animationStart})/${slideAnimationDuration}`;
          const slideInEased = `(1-pow(1-${slideInProgress},4))`;
          const slideOutProgress = `(t-${slideOutStart})/${slideAnimationDuration}`;
          const slideOutEased = `(1-pow(1-${slideOutProgress},4))`;
          
          xExpression = `if(between(t,${animationStart},${slideInEnd}),-600+650*${slideInEased},if(between(t,${slideInEnd},${slideOutStart}),50,if(between(t,${slideOutStart},${animationEnd}),50-650*${slideOutEased},-600)))`;
        }
        
        // Positioned higher up on screen for 9:16 format (y=1200 instead of 1420)
        filters += `${currentInput}[stewie_${i}]overlay='${xExpression}':1200:enable='between(t,${animationStart},${animationEnd})'[overlay_${i}];`;
        currentInput = `[overlay_${i}]`;
        console.log(`🎬 Stewie eased overlay ${i}: ${xExpression}`);
        
      } else if (timing.speaker === 'Peter') {
        // Create a unique scaled version for this specific overlay (extra large size for Peter)
        filters += `[2:v]scale=1600:1600:force_original_aspect_ratio=decrease[peter_${i}];`;
        
        // Peter slides from right: x goes from 1080 to 200 with easing (not going too far left)
        let xExpression;
        
        if (slideOutStart <= slideInEnd) {
          // Short dialogue - just slide in with easing and stay
          // Using stronger ease-out function: 1 - (1-t)^4 for more obvious deceleration
          const progress = `min(1,(t-${animationStart})/${slideAnimationDuration})`;
          const easedProgress = `(1-pow(1-${progress},4))`;
          xExpression = `if(between(t,${animationStart},${animationEnd}),1080-1060*${easedProgress},1080)`;
        } else {
          // Full animation: slide in with easing, stay, slide out with easing
          const slideInProgress = `(t-${animationStart})/${slideAnimationDuration}`;
          const slideInEased = `(1-pow(1-${slideInProgress},4))`;
          const slideOutProgress = `(t-${slideOutStart})/${slideAnimationDuration}`;
          const slideOutEased = `(1-pow(1-${slideOutProgress},4))`;
          
          xExpression = `if(between(t,${animationStart},${slideInEnd}),1080-1060*${slideInEased},if(between(t,${slideInEnd},${slideOutStart}),20,if(between(t,${slideOutStart},${animationEnd}),20+1060*${slideOutEased},1080)))`;
        }
        
        // Positioned at bottom of screen for 9:16 format (y=520 for extra large Peter)
        filters += `${currentInput}[peter_${i}]overlay='${xExpression}':520:enable='between(t,${animationStart},${animationEnd})'[overlay_${i}];`;
        currentInput = `[overlay_${i}]`;
        console.log(`🎬 Peter eased overlay ${i}: ${xExpression}`);
      }
    }
    
    // Return the filters without the trailing semicolon
    const finalFilters = filters.slice(0, -1);
    console.log('🎬 Final eased overlay filters generated:', finalFilters);
    return finalFilters;
  }

  private async createDialogueVideoWithoutCharacters(audioPath: string, srtPath: string, outputPath: string): Promise<void> {
    try {
      console.log('Creating dialogue video without characters...');
      
      if (!fs.existsSync(this.backgroundVideoPath)) {
        return this.createVideoWithoutBackground(audioPath, srtPath, outputPath);
      }
      
      // Get the duration of the audio to match the background video length
      const audioDuration = await this.getAudioDuration(audioPath);
      
      // Escape the subtitle path for FFmpeg
      const escapedSrtPath = srtPath.replace(/'/g, "'\\''");
      
      // FFmpeg command without character overlays
      const ffmpegCommand = `ffmpeg -stream_loop -1 -i "${this.backgroundVideoPath}" -i "${audioPath}" -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS[bg];[bg]subtitles='${escapedSrtPath}':force_style='Fontsize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=3,Alignment=2,MarginV=80,Bold=1'[v]" -map "[v]" -map 1:a -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -t ${audioDuration} -y "${outputPath}"`;
      
      console.log('Running FFmpeg dialogue without characters command:', ffmpegCommand);
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      if (stderr) console.log('FFmpeg dialogue without characters stderr:', stderr);
      if (stdout) console.log('FFmpeg dialogue without characters stdout:', stdout);
      
      if (!fs.existsSync(outputPath)) {
        throw new Error('Dialogue video without characters was not created');
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Dialogue video without characters is empty');
      }
      
      console.log(`Dialogue video without characters created successfully: ${outputPath} (${stats.size} bytes)`);
    } catch (error) {
      console.error('Error creating dialogue video without characters:', error);
      await this.createVideoWithoutBackground(audioPath, srtPath, outputPath);
    }
  }

  private async createVideoWithoutBackground(audioPath: string, srtPath: string, outputPath: string): Promise<void> {
    try {
      console.log('Creating video without background...');
      
      // Escape the subtitle path for FFmpeg
      const escapedSrtPath = srtPath.replace(/'/g, "'\\''");
      
      // FFmpeg command with black background (9:16 format)
      const ffmpegCommand = `ffmpeg -f lavfi -i color=c=black:s=1080x1920:d=600 -i "${audioPath}" -vf "subtitles='${escapedSrtPath}':force_style='Fontsize=20,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Alignment=2,MarginV=60'" -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -shortest -y "${outputPath}"`;
      
      console.log('Running FFmpeg fallback command:', ffmpegCommand);
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      if (stderr) console.log('FFmpeg fallback stderr:', stderr);
      if (stdout) console.log('FFmpeg fallback stdout:', stdout);
      
      // Verify the output file was created and has content
      if (!fs.existsSync(outputPath)) {
        throw new Error('Fallback video file was not created');
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Fallback video file is empty');
      }
      
      console.log(`Fallback video created successfully: ${outputPath} (${stats.size} bytes)`);
    } catch (error) {
      console.error('Error creating fallback video:', error);
      throw new Error(`Failed to create video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAudioDuration(audioPath: string): Promise<number> {
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
} 