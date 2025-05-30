import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { WhisperService, type WhisperResponse } from './whisper';

const execAsync = promisify(exec);

export interface VideoGenerationOptions {
  audioPath: string;
  text?: string;
  outputPath: string;
  subtitleSegments?: SubtitleSegment[];
  useWordByWordCaptions?: boolean;
  dialogueSegments?: Array<{ start: number; end: number; speaker: string; text: string }>;
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
  private whisperService: WhisperService;

  constructor() {
    // Ensure video directory exists
    if (!fs.existsSync(this.videoDir)) {
      fs.mkdirSync(this.videoDir, { recursive: true });
    }
    
    // Initialize WhisperService
    this.whisperService = new WhisperService();
  }

  async createVideoFromAudio(options: VideoGenerationOptions): Promise<VideoResponse> {
    const { audioPath, text, outputPath, subtitleSegments, useWordByWordCaptions, dialogueSegments } = options;
    
    try {
      if (useWordByWordCaptions) {
        // Use Whisper for word-by-word captions
        
        let whisperResponse: WhisperResponse;
        
        if (dialogueSegments && dialogueSegments.length > 0) {
          // For dialogue with known speakers and timing
          whisperResponse = await this.whisperService.transcribeDialogueAudio(audioPath, dialogueSegments);
        } else {
          // For single voice or unknown dialogue structure
          whisperResponse = await this.whisperService.transcribeAudioWithWordTimestamps(audioPath);
        }
        
        // Create word-by-word subtitle segments
        const wordSubtitles = this.whisperService.createWordByWordSubtitles(whisperResponse);
        
        // Create SRT file with word-by-word timing
        const srtPath = audioPath.replace('.mp3', '_words.srt');
        this.createWordByWordSubtitleFile(wordSubtitles, srtPath);
        
        if (dialogueSegments && dialogueSegments.length > 0) {
          // Create dialogue video with word-by-word subtitles
          await this.createDialogueVideoWithSubtitles(audioPath, srtPath, outputPath);
        } else {
          // Create single voice video with word-by-word subtitles
          await this.createVideoWithWordSubtitles(audioPath, srtPath, outputPath);
        }
        
        // Clean up subtitle file
        if (fs.existsSync(srtPath)) {
          fs.unlinkSync(srtPath);
        }
      } else if (subtitleSegments && subtitleSegments.length > 0) {
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
        throw new Error('Either text, subtitleSegments, or useWordByWordCaptions must be provided');
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

  private createWordByWordSubtitleFile(wordSubtitles: Array<{ start: number; end: number; text: string; speaker?: string }>, filePath: string): void {
    let srtContent = '';
    
    for (let i = 0; i < wordSubtitles.length; i++) {
      const word = wordSubtitles[i];
      const startTimeStr = this.formatTime(word.start);
      const endTimeStr = this.formatTime(word.end);
      
      // Include speaker name in subtitle for character overlay parsing
      // We'll handle hiding it in the video rendering
      const subtitleText = word.speaker ? `${word.speaker}: ${word.text}` : word.text;
      
      srtContent += `${i + 1}\n${startTimeStr} --> ${endTimeStr}\n${subtitleText}\n\n`;
    }
    
    fs.writeFileSync(filePath, srtContent);
  }

  private createCleanSubtitleFile(originalSrtPath: string, cleanSrtPath: string): void {
    try {
      const srtContent = fs.readFileSync(originalSrtPath, 'utf8');
      const blocks = srtContent.split('\n\n').filter(block => block.trim());
      
      let cleanContent = '';
      
      for (const block of blocks) {
        const lines = block.split('\n');
        if (lines.length >= 3) {
          const indexLine = lines[0];
          const timeLine = lines[1];
          const textLine = lines[2];
          
          // Remove speaker prefix from text line
          const cleanText = textLine.replace(/^(Peter|Stewie):\s*/, '');
          
          cleanContent += `${indexLine}\n${timeLine}\n${cleanText}\n\n`;
        }
      }
      
      fs.writeFileSync(cleanSrtPath, cleanContent);
    } catch (error) {
      console.error('Error creating clean subtitle file:', error);
      // Fallback: copy original file
      fs.copyFileSync(originalSrtPath, cleanSrtPath);
    }
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  }

  private async createVideoWithSubtitles(audioPath: string, text: string, outputPath: string): Promise<void> {
    try {
      
      // Check if background video exists
      if (!fs.existsSync(this.backgroundVideoPath)) {
        console.warn('Background video not found, creating video without background');
        return this.createSingleVideoWithoutBackground(audioPath, text, outputPath);
      }
      
      // Get the duration of the audio to match the background video length
      const audioDuration = await this.getAudioDuration(audioPath);
      
      // Create subtitle file
      const srtPath = audioPath.replace('.mp3', '.srt');
      this.createSubtitleFile(text, srtPath);
      
      // Escape the subtitle path for FFmpeg
      const escapedSrtPath = srtPath.replace(/'/g, "'\\''");
      
      // FFmpeg command with background video
      const ffmpegCommand = `ffmpeg -stream_loop -1 -i "${this.backgroundVideoPath}" -i "${audioPath}" -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS[bg];[bg]subtitles='${escapedSrtPath}':force_style='Fontsize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=3,Alignment=2,MarginV=150,Bold=1'[v]" -map "[v]" -map 1:a -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -t ${audioDuration} -y "${outputPath}"`;
      
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      // Verify the output file was created and has content
      if (!fs.existsSync(outputPath)) {
        throw new Error('Single voice video file was not created');
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Single voice video file is empty');
      }
      
      
      // Clean up subtitle file
      if (fs.existsSync(srtPath)) {
        fs.unlinkSync(srtPath);
      }
      
    } catch (error) {
      console.error('Error creating single voice video:', error);
      // Fallback to creating video without background
      await this.createSingleVideoWithoutBackground(audioPath, text, outputPath);
    }
  }

  private async createSingleVideoWithoutBackground(audioPath: string, text: string, outputPath: string): Promise<void> {
    try {
      
      // Create subtitle file
      const srtPath = audioPath.replace('.mp3', '.srt');
      this.createSubtitleFile(text, srtPath);
      
      // Escape the subtitle path for FFmpeg
      const escapedSrtPath = srtPath.replace(/'/g, "'\\''");
      
      // FFmpeg command with black background (9:16 format)
      const ffmpegCommand = `ffmpeg -f lavfi -i color=c=black:s=1080x1920:d=600 -i "${audioPath}" -vf "subtitles='${escapedSrtPath}':force_style='Fontsize=22,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Alignment=2,MarginV=150'" -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -shortest -y "${outputPath}"`;
      
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      // Verify the output file was created and has content
      if (!fs.existsSync(outputPath)) {
        throw new Error('Single voice fallback video file was not created');
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Single voice fallback video file is empty');
      }
      
      
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
      
      // Check if all required files exist
      if (!fs.existsSync(this.backgroundVideoPath)) {
        console.warn('Background video not found, creating video without background');
        return this.createVideoWithoutBackground(audioPath, srtPath, outputPath);
      }
      
      if (!fs.existsSync(this.peterImagePath) || !fs.existsSync(this.stewieImagePath)) {
        console.warn('Character images not found, creating video without characters');  
        return this.createDialogueVideoWithoutCharacters(audioPath, srtPath, outputPath);
      }
      
      // Get the duration of the audio to match the background video length
      const audioDuration = await this.getAudioDuration(audioPath);
      
      // Parse subtitle timing to know when each character speaks (using original file with speaker names)
      const characterTimings = await this.parseSubtitleTimings(srtPath);
      
      // Create clean subtitle file without speaker names for video rendering
      const cleanSrtPath = srtPath.replace('.srt', '_clean.srt');
      this.createCleanSubtitleFile(srtPath, cleanSrtPath);
      
      // Escape the clean subtitle path for FFmpeg
      const escapedSrtPath = cleanSrtPath.replace(/'/g, "'\\''");
      
      // Build the complete filter complex
      let filterComplex = '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS[bg];';
      
      // Create character overlay filters based on dialogue timing
      const characterFilters = this.createCharacterOverlayFilters(characterTimings, audioDuration);
      
      if (characterFilters) {
        // Add character overlays and get the final video stream
        const finalLabel = characterFilters.match(/\[overlay_\d+\]$/)?.[0] || '[bg]';
        filterComplex += characterFilters + `;${finalLabel}subtitles='${escapedSrtPath}':force_style='Fontsize=22,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=3,Alignment=2,MarginV=150,Bold=1'[v]`;
      } else {
        // No character overlays, just add subtitles to background
        filterComplex += '[bg]subtitles=\'' + escapedSrtPath + '\':force_style=\'Fontsize=22,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=3,Alignment=2,MarginV=150,Bold=1\'[v]';
      }
      
      // FFmpeg command with background video, character overlays, and subtitles
      const ffmpegCommand = `ffmpeg -stream_loop -1 -i "${this.backgroundVideoPath}" -i "${audioPath}" -i "${this.peterImagePath}" -i "${this.stewieImagePath}" -filter_complex "${filterComplex}" -map "[v]" -map 1:a -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -t ${audioDuration} -y "${outputPath}"`;
      
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      // Verify the output file was created and has content
      if (!fs.existsSync(outputPath)) {
        throw new Error('Character dialogue video file was not created');
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Character dialogue video file is empty');
      }
      
      // Clean up the clean subtitle file
      if (fs.existsSync(cleanSrtPath)) {
        fs.unlinkSync(cleanSrtPath);
      }
    } catch (error) {
      console.error('Error creating character dialogue video:', error);
      // Fallback to creating video without characters
      await this.createDialogueVideoWithoutCharacters(audioPath, srtPath, outputPath);
    }
  }

  private async parseSubtitleTimings(srtPath: string): Promise<{ speaker: string; start: number; end: number }[]> {
    try {
      const srtContent = fs.readFileSync(srtPath, 'utf8');
      
      const timings: { speaker: string; start: number; end: number }[] = [];
      const blocks = srtContent.split('\n\n').filter(block => block.trim());
      
      let currentSpeaker: string | null = null;
      let currentSegmentStart: number | null = null;
      let currentSegmentEnd: number | null = null;
      
      for (const block of blocks) {
        const lines = block.split('\n');
        
        if (lines.length >= 3) {
          const timeLine = lines[1];
          const textLine = lines[2];
          
          // Parse time format: 00:00:00,000 --> 00:00:05,000
          const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
          if (timeMatch) {
            const startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
            const endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
            
            // Extract speaker from text (format: "Peter: text" or "Stewie: text")
            const speakerMatch = textLine.match(/^(Peter|Stewie):/);
            if (speakerMatch) {
              const speaker = speakerMatch[1];
              
              // Check if this is a continuation of the same speaker or a new speaker
              if (currentSpeaker === speaker && currentSegmentStart !== null && currentSegmentEnd !== null) {
                // Same speaker - extend the current segment
                currentSegmentEnd = endTime;
              } else {
                // Different speaker or first segment - save previous segment if exists
                if (currentSpeaker && currentSegmentStart !== null && currentSegmentEnd !== null) {
                  timings.push({
                    speaker: currentSpeaker,
                    start: currentSegmentStart,
                    end: currentSegmentEnd
                  });
                }
                
                // Start new segment
                currentSpeaker = speaker;
                currentSegmentStart = startTime;
                currentSegmentEnd = endTime;
              }
            } else {
            }
          } else {
          }
        }
      }
      
      // Don't forget to save the last segment
      if (currentSpeaker && currentSegmentStart !== null && currentSegmentEnd !== null) {
        timings.push({
          speaker: currentSpeaker,
          start: currentSegmentStart,
          end: currentSegmentEnd
        });
      }
      
      return timings;
    } catch (error) {
      console.error('Error parsing subtitle timings:', error);
      return [];
    }
  }

  private createCharacterOverlayFilters(timings: { speaker: string; start: number; end: number }[], totalDuration: number): string {
    
    if (timings.length === 0) {
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
      
      // Adjust timing for early slide-in and late slide-out
      const animationStart = Math.max(0, timing.start - slideInEarly); // Don't go below 0
      const animationEnd = timing.end + slideOutLate;
      const slideInEnd = animationStart + slideAnimationDuration;
      const slideOutStart = animationEnd - slideAnimationDuration;
      
      
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
      }
    }
    
    // Return the filters without the trailing semicolon
    const finalFilters = filters.slice(0, -1);
    return finalFilters;
  }

  private async createDialogueVideoWithoutCharacters(audioPath: string, srtPath: string, outputPath: string): Promise<void> {
    try {
      
      if (!fs.existsSync(this.backgroundVideoPath)) {
        return this.createVideoWithoutBackground(audioPath, srtPath, outputPath);
      }
      
      // Get the duration of the audio to match the background video length
      const audioDuration = await this.getAudioDuration(audioPath);
      
      // Create clean subtitle file without speaker names for video rendering
      const cleanSrtPath = srtPath.replace('.srt', '_clean.srt');
      this.createCleanSubtitleFile(srtPath, cleanSrtPath);
      
      // Escape the clean subtitle path for FFmpeg
      const escapedSrtPath = cleanSrtPath.replace(/'/g, "'\\''");
      
      // FFmpeg command without character overlays
      const ffmpegCommand = `ffmpeg -stream_loop -1 -i "${this.backgroundVideoPath}" -i "${audioPath}" -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS[bg];[bg]subtitles='${escapedSrtPath}':force_style='Fontsize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=3,Alignment=2,MarginV=150,Bold=1'[v]" -map "[v]" -map 1:a -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -t ${audioDuration} -y "${outputPath}"`;
      
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      if (!fs.existsSync(outputPath)) {
        throw new Error('Dialogue video without characters was not created');
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Dialogue video without characters is empty');
      }
      
      
      // Clean up the clean subtitle file
      if (fs.existsSync(cleanSrtPath)) {
        fs.unlinkSync(cleanSrtPath);
      }
    } catch (error) {
      console.error('Error creating dialogue video without characters:', error);
      await this.createVideoWithoutBackground(audioPath, srtPath, outputPath);
    }
  }

  private async createVideoWithoutBackground(audioPath: string, srtPath: string, outputPath: string): Promise<void> {
    try {
      
      // Check if this is a word-by-word subtitle file (contains speaker names)
      let finalSrtPath = srtPath;
      let cleanSrtPath: string | null = null;
      
      try {
        const srtContent = fs.readFileSync(srtPath, 'utf8');
        if (srtContent.includes('Peter:') || srtContent.includes('Stewie:')) {
          // This is a word-by-word subtitle file, create clean version
          cleanSrtPath = srtPath.replace('.srt', '_clean.srt');
          this.createCleanSubtitleFile(srtPath, cleanSrtPath);
          finalSrtPath = cleanSrtPath;
        }
      } catch (error) {
      }
      
      // Escape the subtitle path for FFmpeg
      const escapedSrtPath = finalSrtPath.replace(/'/g, "'\\''");
      
      // FFmpeg command with black background (9:16 format)
      const ffmpegCommand = `ffmpeg -f lavfi -i color=c=black:s=1080x1920:d=600 -i "${audioPath}" -vf "subtitles='${escapedSrtPath}':force_style='Fontsize=20,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Alignment=2,MarginV=150'" -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -shortest -y "${outputPath}"`;
      
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      // Verify the output file was created and has content
      if (!fs.existsSync(outputPath)) {
        throw new Error('Fallback video file was not created');
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Fallback video file is empty');
      }
      
      // Clean up the clean subtitle file if we created one
      if (cleanSrtPath && fs.existsSync(cleanSrtPath)) {
        fs.unlinkSync(cleanSrtPath);
      }
    } catch (error) {
      console.error('Error creating fallback video:', error);
      throw new Error(`Failed to create video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createVideoWithWordSubtitles(audioPath: string, srtPath: string, outputPath: string): Promise<void> {
    try {
      
      // Check if background video exists
      if (!fs.existsSync(this.backgroundVideoPath)) {
        console.warn('Background video not found, creating video without background');
        return this.createVideoWithoutBackground(audioPath, srtPath, outputPath);
      }
      
      // Get the duration of the audio to match the background video length
      const audioDuration = await this.getAudioDuration(audioPath);
      
      // Create clean subtitle file without speaker names for video rendering
      const cleanSrtPath = srtPath.replace('.srt', '_clean.srt');
      this.createCleanSubtitleFile(srtPath, cleanSrtPath);
      
      // Escape the clean subtitle path for FFmpeg
      const escapedSrtPath = cleanSrtPath.replace(/'/g, "'\\''");
      
      // FFmpeg command with background video and word-by-word subtitles
      // Using smaller font size and different positioning for word-by-word display
      const ffmpegCommand = `ffmpeg -stream_loop -1 -i "${this.backgroundVideoPath}" -i "${audioPath}" -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS[bg];[bg]subtitles='${escapedSrtPath}':force_style='Fontsize=28,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=3,Alignment=2,MarginV=150,Bold=1'[v]" -map "[v]" -map 1:a -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -t ${audioDuration} -y "${outputPath}"`;
      
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      
      // Verify the output file was created and has content
      if (!fs.existsSync(outputPath)) {
        throw new Error('Word-by-word video file was not created');
      }
      
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Word-by-word video file is empty');
      }
      
      // Clean up the clean subtitle file
      if (fs.existsSync(cleanSrtPath)) {
        fs.unlinkSync(cleanSrtPath);
      }
      
    } catch (error) {
      console.error('Error creating word-by-word video:', error);
      // Fallback to creating video without background
      await this.createVideoWithoutBackground(audioPath, srtPath, outputPath);
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