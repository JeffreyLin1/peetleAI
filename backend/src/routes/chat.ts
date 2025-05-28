import express from 'express';
import { OpenAIService } from '../services/openai';
import { ElevenLabsService } from '../services/elevenlabs';

const router = express.Router();
const openaiService = new OpenAIService();

// POST /api/chat/generate
router.post('/generate', async (req, res) => {
  try {
    const { topic } = req.body;

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

    const response = await openaiService.generateResponse(topic.trim());
    
    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Chat generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/chat/speak
router.post('/speak', async (req, res) => {
  try {
    const { text } = req.body;

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

    // Generate speech with preconfigured voice settings
    const speechResponse = await elevenLabsService.generateSpeech(
      text.trim(), 
      'peter-griffin' // This will use your custom voice ID
    );
    
    if (!speechResponse.success || !speechResponse.video_url) {
      throw new Error('No video data received from ElevenLabs API');
    }
    
    res.json({
      success: true,
      data: {
        videoUrl: speechResponse.video_url,
        provider: 'elevenlabs'
      }
    });
  } catch (error) {
    console.error('Speech generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate speech',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as chatRouter }; 