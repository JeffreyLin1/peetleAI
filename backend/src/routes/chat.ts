import express from 'express';
import { OpenAIService } from '../services/openai';

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

export { router as chatRouter }; 