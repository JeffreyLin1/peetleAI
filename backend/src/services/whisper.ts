import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptionSegment {
  text: string;
  start: number;
  end: number;
  words: WordTimestamp[];
  speaker?: string;
}

export interface WhisperResponse {
  segments: TranscriptionSegment[];
  fullText: string;
  duration: number;
}

export class WhisperService {
  private openai: OpenAI | null = null;

  constructor() {
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

  async transcribeAudioWithWordTimestamps(audioPath: string): Promise<WhisperResponse> {
    try {
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      const openai = this.getOpenAIClient();
      
      // Create a readable stream from the audio file
      const audioStream = fs.createReadStream(audioPath);
      
      // Use Whisper API with word-level timestamps
      const transcription = await openai.audio.transcriptions.create({
        file: audioStream,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word']
      });
      
      // Process the response to extract word-level timestamps
      const segments: TranscriptionSegment[] = [];
      let fullText = '';
      let duration = 0;

      if (transcription.words && transcription.words.length > 0) {
        // Group words into segments (sentences or logical breaks)
        const words = transcription.words;
        let currentSegment: WordTimestamp[] = [];
        let segmentStart = words[0].start;
        let segmentText = '';

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          currentSegment.push({
            word: word.word,
            start: word.start,
            end: word.end
          });
          segmentText += word.word;

          // Check if we should end the current segment
          const shouldEndSegment = 
            word.word.includes('.') || 
            word.word.includes('!') || 
            word.word.includes('?') ||
            (i === words.length - 1); // Last word

          if (shouldEndSegment) {
            segments.push({
              text: segmentText.trim(),
              start: segmentStart,
              end: word.end,
              words: [...currentSegment]
            });

            // Reset for next segment
            currentSegment = [];
            segmentText = '';
            if (i < words.length - 1) {
              segmentStart = words[i + 1].start;
            }
          }
        }

        fullText = words.map(w => w.word).join('');
        duration = words[words.length - 1].end;
      } else {
        // Fallback if word timestamps are not available
        if (transcription.segments) {
          for (const segment of transcription.segments) {
            // Estimate word timing within the segment
            const words = segment.text.trim().split(/\s+/);
            const segmentDuration = segment.end - segment.start;
            const wordDuration = segmentDuration / words.length;
            
            const wordTimestamps: WordTimestamp[] = words.map((word, index) => ({
              word: word,
              start: segment.start + (index * wordDuration),
              end: segment.start + ((index + 1) * wordDuration)
            }));

            segments.push({
              text: segment.text,
              start: segment.start,
              end: segment.end,
              words: wordTimestamps
            });
          }
          
          fullText = transcription.text || '';
          duration = transcription.segments[transcription.segments.length - 1]?.end || 0;
        }
      }
      
      return {
        segments,
        fullText,
        duration
      };

    } catch (error) {
      throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async transcribeDialogueAudio(audioPath: string, dialogueSegments: { start: number; end: number; speaker: string; text: string }[]): Promise<WhisperResponse> {
    try {
      // First get the word-level transcription
      const transcription = await this.transcribeAudioWithWordTimestamps(audioPath);
      
      // Map the word timestamps to the known dialogue segments
      const enhancedSegments: TranscriptionSegment[] = [];
      
      for (const dialogueSegment of dialogueSegments) {
        // Find words that fall within this dialogue segment's time range
        const segmentWords: WordTimestamp[] = [];
        
        for (const segment of transcription.segments) {
          for (const word of segment.words) {
            // Check if word timing overlaps with dialogue segment
            if (word.start >= dialogueSegment.start - 0.5 && word.end <= dialogueSegment.end + 0.5) {
              segmentWords.push(word);
            }
          }
        }
        
        if (segmentWords.length > 0) {
          enhancedSegments.push({
            text: dialogueSegment.text,
            start: dialogueSegment.start,
            end: dialogueSegment.end,
            words: segmentWords,
            speaker: dialogueSegment.speaker
          });
        } else {
          // Fallback: estimate word timing for this segment
          const words = dialogueSegment.text.trim().split(/\s+/);
          const segmentDuration = dialogueSegment.end - dialogueSegment.start;
          const wordDuration = segmentDuration / words.length;
          
          const estimatedWords: WordTimestamp[] = words.map((word, index) => ({
            word: word,
            start: dialogueSegment.start + (index * wordDuration),
            end: dialogueSegment.start + ((index + 1) * wordDuration)
          }));

          enhancedSegments.push({
            text: dialogueSegment.text,
            start: dialogueSegment.start,
            end: dialogueSegment.end,
            words: estimatedWords,
            speaker: dialogueSegment.speaker
          });
        }
      }
      
      return {
        segments: enhancedSegments,
        fullText: transcription.fullText,
        duration: transcription.duration
      };

    } catch (error) {
      throw new Error(`Failed to transcribe dialogue audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper method to create word-by-word subtitle segments for video generation
  createWordByWordSubtitles(whisperResponse: WhisperResponse): Array<{ start: number; end: number; text: string; speaker?: string }> {
    const wordSubtitles: Array<{ start: number; end: number; text: string; speaker?: string }> = [];
    
    for (const segment of whisperResponse.segments) {
      for (const word of segment.words) {
        wordSubtitles.push({
          start: word.start,
          end: word.end,
          text: word.word.trim(),
          speaker: segment.speaker
        });
      }
    }
    
    return wordSubtitles;
  }
} 