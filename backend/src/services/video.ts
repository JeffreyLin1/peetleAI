import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AssetService, type AssetPaths } from './assets';

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
  private assetService: AssetService;

  constructor() {
    // Ensure video directory exists
    if (!fs.existsSync(this.videoDir)) {
      fs.mkdirSync(this.videoDir, { recursive: true });
    }
    
    // Initialize services
    this.assetService = new AssetService();
  }

  async createVideoFromAudio(options: VideoGenerationOptions): Promise<VideoResponse> {
    const { audioPath, text, outputPath, subtitleSegments, useWordByWordCaptions, dialogueSegments } = options;
    
    // Get asset paths (local or cloud)
    const assetPaths = await this.assetService.getAssetPaths();
    
    // Validate all required assets exist
    await this.validateRequiredAssets(audioPath, assetPaths);
    
    try {
      if (useWordByWordCaptions) {
        // Use script-based word timing instead of Whisper transcription
        if (dialogueSegments && dialogueSegments.length > 0) {
          // For dialogue with known speakers and timing - use script directly
          const wordSubtitles = this.createWordTimingsFromScript(dialogueSegments);
          
          // Create SRT file with word-by-word timing
          const srtPath = audioPath.replace('.mp3', '_words.srt');
          this.createWordByWordSubtitleFile(wordSubtitles, srtPath);
          
          // Create the final video
          await this.createVideo(audioPath, srtPath, outputPath, assetPaths);
          
          // Clean up subtitle file
          if (fs.existsSync(srtPath)) {
            fs.unlinkSync(srtPath);
          }
        } else {
          // For single voice, fall back to simple word estimation
          throw new Error('Word-by-word captions require dialogue segments with timing information');
        }
      } else if (subtitleSegments && subtitleSegments.length > 0) {
        // Create dialogue video with character overlays
        const srtPath = audioPath.replace('.mp3', '.srt');
        this.createDialogueSubtitleFile(subtitleSegments, srtPath);
        
        // Create the final video
        await this.createVideo(audioPath, srtPath, outputPath, assetPaths);
        
        // Clean up subtitle file
        if (fs.existsSync(srtPath)) {
          fs.unlinkSync(srtPath);
        }
      } else if (text) {
        // Create single voice video with subtitles
        const srtPath = audioPath.replace('.mp3', '.srt');
        this.createSubtitleFile(text, srtPath);
        
        // Create the final video
        await this.createVideo(audioPath, srtPath, outputPath, assetPaths);
        
        // Clean up subtitle file
        if (fs.existsSync(srtPath)) {
          fs.unlinkSync(srtPath);
        }
      } else {
        throw new Error('Either text, subtitleSegments, or useWordByWordCaptions must be provided');
      }

      const filename = path.basename(outputPath);
      const videoUrl = `/videos/${filename}`;

      // Clean up temporary cloud assets if used
      this.assetService.cleanupTempAssets();

      return {
        video_url: videoUrl,
        file_path: outputPath,
        success: true
      };
    } catch (error) {
      // Clean up temporary cloud assets on error too
      this.assetService.cleanupTempAssets();
      console.error('Error creating video:', error);
      throw new Error(`Failed to create video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateRequiredAssets(audioPath: string, assetPaths: AssetPaths): Promise<void> {
    // Check if audio file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    // Use AssetService to validate all assets
    await this.assetService.validateAssets(assetPaths);
  }

  private async createVideo(audioPath: string, srtPath: string, outputPath: string, assetPaths: AssetPaths): Promise<void> {
    // Get the duration of the audio to match the background video length
    const audioDuration = await this.getAudioDuration(audioPath);
    
    // Parse subtitle timing to know when each character speaks (using original file with speaker names)
    const characterTimings = await this.parseSubtitleTimings(srtPath);
    
    // Check if this is word-by-word captions (indicated by filename)
    const isWordByWord = srtPath.includes('_words.srt');
    
    // Build the complete filter complex
    let filterComplex = '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setpts=PTS-STARTPTS[bg];';
    
    // Create character overlay filters based on dialogue timing
    const characterFilters = this.createCharacterOverlayFilters(characterTimings, audioDuration);
    
    let currentVideoStream = '[bg]';
    if (characterFilters) {
      // Add character overlays and get the final video stream
      const finalLabel = characterFilters.match(/\[overlay_\d+\]$/)?.[0] || '[bg]';
      filterComplex += characterFilters + ';';
      currentVideoStream = finalLabel;
    }
    
    if (isWordByWord) {
      // Use animated drawtext filters for word-by-word captions with pulsing effect
      const drawtextFilters = this.createAnimatedDrawTextFilters(srtPath);
      if (drawtextFilters) {
        filterComplex += `${currentVideoStream}${drawtextFilters}[v]`;
      } else {
        filterComplex += `${currentVideoStream}copy[v]`;
      }
    } else {
      // Use traditional subtitles for dialogue/single voice
      const cleanSrtPath = srtPath.replace('.srt', '_clean.srt');
      this.createCleanSubtitleFile(srtPath, cleanSrtPath);
      
      // Escape the clean subtitle path for FFmpeg
      const escapedSrtPath = cleanSrtPath.replace(/'/g, "'\\''");
      
      filterComplex += `${currentVideoStream}subtitles='${escapedSrtPath}':force_style='Fontsize=172,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=8,Alignment=2,MarginV=300,Bold=1'[v]`;
      
      // Clean up the clean subtitle file after FFmpeg command
      setTimeout(() => {
        if (fs.existsSync(cleanSrtPath)) {
          fs.unlinkSync(cleanSrtPath);
        }
      }, 1000);
    }
    
    // FFmpeg command with background video, character overlays, and subtitles/drawtext
    const ffmpegCommand = `ffmpeg -threads 1 -stream_loop -1 -i "${assetPaths.backgroundVideo}" -i "${audioPath}" -i "${assetPaths.peterImage}" -i "${assetPaths.stewieImage}" -filter_complex "${filterComplex}" -map "[v]" -map 1:a -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -t ${audioDuration} -y "${outputPath}"`;
    
    const { stdout, stderr } = await execAsync(ffmpegCommand);
    
    // Verify the output file was created and has content
    if (!fs.existsSync(outputPath)) {
      throw new Error('Video file was not created by FFmpeg');
    }
    
    const stats = fs.statSync(outputPath);
    if (stats.size === 0) {
      throw new Error('Video file is empty');
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
      throw new Error(`Failed to create clean subtitle file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private createWordTimingsFromScript(dialogueSegments: Array<{ start: number; end: number; speaker: string; text: string }>): Array<{ start: number; end: number; text: string; speaker?: string }> {
    // Script-based word timing approach:
    // Instead of using Whisper to transcribe ElevenLabs audio (which can miss 30% of words),
    // we estimate word timing directly from the original script that generated the audio.
    // This ensures 100% accuracy since we use the exact text that created the speech.
    
    const wordSubtitles: Array<{ start: number; end: number; text: string; speaker?: string }> = [];
    
    for (const segment of dialogueSegments) {
      // Split the text into words
      const words = segment.text.trim().split(/\s+/).filter(word => word.length > 0);
      
      if (words.length === 0) continue;
      
      // Clean words for display (remove punctuation except ! and ?)
      const cleanWords = words.map(word => {
        // Remove all punctuation except ! and ?
        return word.replace(/[^\w!?]/g, '').trim();
      }).filter(word => word.length > 0); // Remove empty strings after cleaning
      
      // Calculate timing for each word within this segment
      const segmentDuration = segment.end - segment.start;
      const averageWordDuration = segmentDuration / cleanWords.length;
      
      // Add some variation to make it feel more natural
      // Shorter words get less time, longer words get more time
      const wordDurations = cleanWords.map(word => {
        const baseTime = averageWordDuration;
        const lengthFactor = Math.min(word.length / 6, 1.5); // Normalize word length
        return baseTime * (0.7 + (lengthFactor * 0.6)); // Range: 0.7x to 1.3x average
      });
      
      // Normalize durations to fit exactly within the segment
      const totalCalculatedDuration = wordDurations.reduce((sum, duration) => sum + duration, 0);
      const scaleFactor = segmentDuration / totalCalculatedDuration;
      const normalizedDurations = wordDurations.map(duration => duration * scaleFactor);
      
      // Create word timing entries
      let currentTime = segment.start;
      for (let i = 0; i < cleanWords.length; i++) {
        const word = cleanWords[i];
        const duration = normalizedDurations[i];
        const endTime = currentTime + duration;
        
        wordSubtitles.push({
          start: currentTime,
          end: endTime,
          text: word,
          speaker: segment.speaker
        });
        
        currentTime = endTime;
      }
    }
    
    return wordSubtitles;
  }

  private createAnimatedDrawTextFilters(srtPath: string): string {
    try {
      const srtContent = fs.readFileSync(srtPath, 'utf8');
      const blocks = srtContent.split('\n\n').filter(block => block.trim());
      
      let drawtextFilters = '';
      
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
            
            // Remove speaker prefix from text line for display
            const cleanText = textLine.replace(/^(Peter|Stewie):\s*/, '');
            
            // Escape text for FFmpeg (escape single quotes and backslashes)
            const escapedText = cleanText.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            
            // Create pulsing animation effect with bounce/recoil
            // The word pulses in over 0.15 seconds, stays normal, then fades out over 0.1 seconds
            const duration = endTime - startTime;
            const pulseInDuration = Math.min(0.2, duration * 0.4); // Slightly longer for bounce effect
            const pulseOutDuration = Math.min(0.1, duration * 0.2); // 20% of duration or 0.1s max
            const pulseInEnd = startTime + pulseInDuration;
            const pulseOutStart = endTime - pulseOutDuration;
            
            // Alpha animation: 0 -> 1 (pulse in) -> 1 (stay) -> 0 (fade out)
            let alphaExpression = '';
            if (pulseOutStart <= pulseInEnd) {
              // Short duration - just pulse in and out
              const midPoint = startTime + duration / 2;
              alphaExpression = `if(between(t,${startTime},${midPoint}),(t-${startTime})/${pulseInDuration},if(between(t,${midPoint},${endTime}),1-(t-${midPoint})/${pulseOutDuration},0))`;
            } else {
              // Full animation: pulse in, stay, fade out
              alphaExpression = `if(between(t,${startTime},${pulseInEnd}),(t-${startTime})/${pulseInDuration},if(between(t,${pulseInEnd},${pulseOutStart}),1,if(between(t,${pulseOutStart},${endTime}),1-(t-${pulseOutStart})/${pulseOutDuration},0)))`;
            }
            
            // Scale animation with bounce: 0.3x -> 1.2x -> 1.0x (pop and recoil effect)
            const bouncePoint = startTime + pulseInDuration * 0.7; // 70% through the pulse-in
            const recoilEnd = startTime + pulseInDuration;
            const scaleExpression = `if(between(t,${startTime},${bouncePoint}),0.3+0.9*(t-${startTime})/${pulseInDuration*0.7},if(between(t,${bouncePoint},${recoilEnd}),1.2-0.2*(t-${bouncePoint})/${pulseInDuration*0.3},1.0))`;
            
            // Create drawtext filter with pulsing animation
            drawtextFilters += `drawtext=text='${escapedText}':fontsize=132:fontcolor=white:bordercolor=black:borderw=8:x=(w-text_w)/2:y=h-900:alpha='${alphaExpression}':fontsize='132*${scaleExpression}':enable='between(t,${startTime},${endTime})',`;
          }
        }
      }
      
      // Remove trailing comma and return
      return drawtextFilters ? drawtextFilters.slice(0, -1) : '';
    } catch (error) {
      console.error('Error creating animated drawtext filters:', error);
      return '';
    }
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
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
            }
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
    const slideAnimationDuration = 0.8;
    const slideInEarly = 0.2;
    const slideOutLate = 0.6;
    
    let filters = '';
    let currentInput = '[bg]';
    
    // Process each timing individually with eased animations
    for (let i = 0; i < timings.length; i++) {
      const timing = timings[i];
      
      // Adjust timing for early slide-in and late slide-out
      const animationStart = Math.max(0, timing.start - slideInEarly);
      const animationEnd = timing.end + slideOutLate;
      const slideInEnd = animationStart + slideAnimationDuration;
      const slideOutStart = animationEnd - slideAnimationDuration;
      
      if (timing.speaker === 'Stewie') {
        // Create a unique scaled version for this specific overlay
        filters += `[3:v]scale=600:600:force_original_aspect_ratio=decrease[stewie_${i}];`;
        
        // Stewie slides from left: x goes from -600 to 50 with easing
        let xExpression;
        
        if (slideOutStart <= slideInEnd) {
          // Short dialogue - just slide in with easing and stay
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
        
        // Positioned higher up on screen for 9:16 format
        filters += `${currentInput}[stewie_${i}]overlay='${xExpression}':1200:enable='between(t,${animationStart},${animationEnd})'[overlay_${i}];`;
        currentInput = `[overlay_${i}]`;
        
      } else if (timing.speaker === 'Peter') {
        // Create a unique scaled version for this specific overlay
        filters += `[2:v]scale=1600:1600:force_original_aspect_ratio=decrease[peter_${i}];`;
        
        // Peter slides from right: x goes from 1080 to 20 with easing
        let xExpression;
        
        if (slideOutStart <= slideInEnd) {
          // Short dialogue - just slide in with easing and stay
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
        
        // Positioned at bottom of screen for 9:16 format
        filters += `${currentInput}[peter_${i}]overlay='${xExpression}':520:enable='between(t,${animationStart},${animationEnd})'[overlay_${i}];`;
        currentInput = `[overlay_${i}]`;
      }
    }
    
    // Return the filters without the trailing semicolon
    const finalFilters = filters.slice(0, -1);
    return finalFilters;
  }

  async getAudioDuration(audioPath: string): Promise<number> {
    try {
      const command = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`;
      const { stdout } = await execAsync(command);
      const duration = parseFloat(stdout.trim());
      if (isNaN(duration)) {
        throw new Error('Could not parse audio duration');
      }
      return duration;
    } catch (error) {
      console.error('Error getting audio duration:', error);
      throw new Error(`Failed to get audio duration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 