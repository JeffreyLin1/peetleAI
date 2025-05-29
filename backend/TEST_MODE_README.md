# Test Mode for Complete Offline Development

This allows you to use pre-saved audio files and a pre-defined dialogue script instead of calling OpenAI and ElevenLabs APIs during development.

## What Test Mode Does

When `USE_TEST_AUDIO=true`:
- ✅ **Skips OpenAI API** - Uses a pre-defined Peter & Stewie dialogue about photosynthesis
- ✅ **Skips ElevenLabs API** - Uses pre-saved audio files
- ✅ **Ignores user input** - Always generates the same test dialogue regardless of topic
- ✅ **Generates videos instantly** - No API delays
- ✅ **Saves API costs** - Zero API calls

## How to Use

### Step 1: Generate Test Audio Files (One Time)
1. Make sure `USE_TEST_AUDIO` is NOT set in your `.env` file (or set to `false`)
2. Enter "photosynthesis" as the topic (to match the test script)
3. Generate a video normally - this will:
   - Call OpenAI API to generate dialogue
   - Call ElevenLabs API to create audio
   - Save test audio files to `backend/public/test_audio/`
4. Check `backend/public/test_audio/` - you should see files like:
   - `stewie_0.mp3` (Stewie's first line)
   - `peter_1.mp3` (Peter's second line)
   - `stewie_2.mp3` (Stewie's third line)
   - etc.

### Step 2: Enable Test Mode
Add this to your `backend/.env` file:
```
USE_TEST_AUDIO=true
```

### Step 3: Test Video Generation
Now when you generate videos:
- Enter ANY topic (it will be ignored)
- Click "Generate Video"
- Get the same test dialogue every time
- Video generates super fast with no API calls

## Test Dialogue Content

The test script is a Peter & Stewie conversation about photosynthesis:
- **8 dialogue exchanges** (4 from each character)
- **Alternating speakers** starting with Stewie
- **Matches the saved audio files** perfectly
- **Typical Peter/Stewie humor** and personalities

## File Structure
```
backend/public/
├── test_audio/           # Pre-saved audio files
│   ├── stewie_0.mp3     # "So Peter, how exactly does photosynthesis work?"
│   ├── peter_1.mp3      # "Oh, that's easy Stewie! Plants eat sunlight..."
│   ├── stewie_2.mp3     # "That's... not entirely accurate..."
│   └── ...              # (8 total files)
├── audio/               # Temporary working files
├── videos/              # Generated videos
├── backgrounds/         # Background videos (Minecraft.mp4)
└── characters/          # Character images (peter.png, stewie.png)
```

## Perfect for Testing

Test mode is ideal for:
- 🎨 **UI/UX development** - Test frontend without API delays
- 🎬 **Video generation testing** - Test FFmpeg, character overlays, timing
- 🐛 **Debugging** - Consistent output for reproducible testing
- 💰 **Cost savings** - No API usage during development
- ⚡ **Speed** - Instant video generation

## Switching Back to Live Mode
Remove or comment out the `USE_TEST_AUDIO` line in your `.env` file:
```
# USE_TEST_AUDIO=true
```

## Verifying Test Mode

You can verify test mode is working with the included test script:

```bash
cd backend
npm run build
node test-mode-check.js
```

This will:
- ✅ Check if test mode is enabled
- ✅ Test the OpenAI service with different topics
- ✅ Verify the same dialogue is always returned
- ✅ Confirm no API tokens are being used

## Notes
- Test audio files are named by speaker and dialogue order: `{speaker}_{index}.mp3`
- The test dialogue is hardcoded and always the same
- User input is completely ignored in test mode
- All timing and character overlays work exactly the same as live mode
- Test mode preserves all working files for debugging 