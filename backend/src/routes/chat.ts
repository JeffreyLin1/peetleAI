import express from 'express';
import { OpenAIService } from '../services/openai';
import { ElevenLabsService, DialogueLine } from '../services';
import { AuthMiddleware } from '../middleware/auth';

const router = express.Router();
const testMode = process.env.USE_TEST_AUDIO === 'true';

// Lazy initialization to ensure environment variables are loaded
let authMiddleware: AuthMiddleware;

function getAuthMiddleware() {
  if (!authMiddleware) {
    authMiddleware = new AuthMiddleware();
  }
  return authMiddleware;
}

// POST /api/chat/generate
router.post('/generate', (req, res, next) => getAuthMiddleware().authenticate(req, res, next), async (req, res) => {
  try {
    const { topic } = req.body;

    if (!testMode) {
      // Normal validation for live mode
      if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        return res.status(400).json({ 
          error: 'Topic is required and must be a non-empty string' 
        });
      }

      if (topic.length > 1000) {
        return res.status(400).json({ 
          error: 'Topic is too long. Please keep it under 1000 characters.' 
        });
      }
    }

    // Create OpenAI service instance when needed
    const openaiService = new OpenAIService();
    
    // In test mode, topic is ignored but we still generate the response
    const response = await openaiService.generateResponse(testMode ? 'test' : topic.trim());
    
    res.json({
      success: true,
      data: response,
      user: req.user // Include user info in response for debugging
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to generate response',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/chat/speak
router.post('/speak', (req, res, next) => getAuthMiddleware().authenticate(req, res, next), async (req, res) => {
  try {
    const { text, dialogue } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Text is required and must be a non-empty string' 
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({ 
        error: 'Text is too long. Please keep it under 5000 characters.' 
      });
    }

    // Create ElevenLabsService instance when needed
    const elevenLabsService = new ElevenLabsService();

    let speechResponse;

    // Check if we have dialogue data to generate multi-voice speech
    if (dialogue && Array.isArray(dialogue) && dialogue.length > 0) {
      speechResponse = await elevenLabsService.generateDialogueSpeech(dialogue);
    } else {
      // Generate speech with preconfigured voice settings (fallback to single voice)
      speechResponse = await elevenLabsService.generateSpeech(
        text.trim(), 
        'peter-griffin' // This will use your custom voice ID
      );
    }
    
    if (!speechResponse.success || !speechResponse.video_url) {
      throw new Error('No video data received from ElevenLabs API');
    }
    
    res.json({
      success: true,
      data: {
        videoUrl: speechResponse.video_url,
        provider: 'elevenlabs'
      },
      user: req.user // Include user info in response for debugging
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to generate speech',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as chatRouter }; 