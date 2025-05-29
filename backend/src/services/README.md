# Services Directory

This directory contains the organized service layer for the backend application. Each service has a specific responsibility and follows the single responsibility principle.

## Service Organization

### 📢 ElevenLabsService (`elevenlabs.ts`)
**Responsibility**: Text-to-speech functionality using the ElevenLabs API

**Key Features**:
- Generate speech from text using ElevenLabs API
- Support for multiple voices (Peter Griffin, Stewie)
- Voice configuration and settings management
- Test mode support for development
- Dialogue generation with multiple speakers

**Methods**:
- `generateSpeech(text, voiceId)` - Generate single voice speech
- `generateDialogueSpeech(dialogue)` - Generate multi-speaker dialogue
- `listVoices()` - Get available voices from ElevenLabs
- `getVoiceInfo(voiceId)` - Get information about a specific voice

### 🎥 VideoService (`video.ts`)
**Responsibility**: Video generation and processing

**Key Features**:
- Create videos from audio files with subtitles
- Support for background videos and character overlays
- Subtitle generation and timing
- Multiple video formats and fallbacks
- Character-based dialogue videos with visual overlays

**Methods**:
- `createVideoFromAudio(options)` - Main video creation method
- `getAudioDuration(audioPath)` - Get duration of audio files

### 🎵 AudioService (`audio.ts`)
**Responsibility**: Audio processing and manipulation

**Key Features**:
- Audio file management and storage
- Combining multiple audio segments with timing
- Audio duration analysis
- Test audio file management
- Audio cleanup utilities

**Methods**:
- `combineAudioSegmentsWithTiming()` - Combine audio with precise timing
- `combineAudioSegments()` - Simple audio concatenation
- `saveAudioBuffer()` - Save audio data to files
- `copyTestAudioFile()` - Handle test audio files
- `getAudioDuration()` - Get audio file duration
- `cleanupAudioFiles()` - Clean up temporary files

### 🤖 OpenAIService (`openai.ts`)
**Responsibility**: AI text generation using OpenAI API

**Key Features**:
- Generate Family Guy style dialogue
- Character-specific response formatting
- Topic-based content generation

## Usage Examples

### Basic Text-to-Speech
```typescript
import { ElevenLabsService } from '../services';

const elevenLabs = new ElevenLabsService();
const result = await elevenLabs.generateSpeech("Hello world!", "peter-griffin");
```

### Dialogue Generation
```typescript
import { ElevenLabsService, DialogueLine } from '../services';

const dialogue: DialogueLine[] = [
  { speaker: 'Peter', text: 'Hey Stewie!' },
  { speaker: 'Stewie', text: 'What do you want, fat man?' }
];

const elevenLabs = new ElevenLabsService();
const result = await elevenLabs.generateDialogueSpeech(dialogue);
```

### Direct Video Creation
```typescript
import { VideoService } from '../services';

const videoService = new VideoService();
const result = await videoService.createVideoFromAudio({
  audioPath: '/path/to/audio.mp3',
  text: 'Subtitle text',
  outputPath: '/path/to/output.mp4'
});
```

## File Structure Benefits

1. **Separation of Concerns**: Each service handles one specific domain
2. **Maintainability**: Easier to find and modify specific functionality
3. **Testability**: Services can be tested independently
4. **Reusability**: Services can be used across different parts of the application
5. **Scalability**: Easy to add new services or extend existing ones

## Environment Variables

- `ELEVENLABS_API_KEY` - Required for ElevenLabs text-to-speech
- `USE_TEST_AUDIO` - Set to 'true' to use pre-recorded test audio files

## Dependencies

- **FFmpeg**: Required for video and audio processing
- **ElevenLabs API**: For text-to-speech generation
- **OpenAI API**: For AI text generation

## Migration Notes

The original `elevenlabs.ts` file was ~919 lines and contained mixed responsibilities. It has been refactored into:

- `elevenlabs.ts` (396 lines) - Pure text-to-speech functionality
- `video.ts` (454 lines) - All video generation logic
- `audio.ts` (195 lines) - Audio processing utilities
- `index.ts` (20 lines) - Centralized exports

This reduces complexity and improves maintainability while preserving all existing functionality. 