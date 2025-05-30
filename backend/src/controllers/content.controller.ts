import { Request, Response } from 'express';
import { OpenAIService } from '../services/openai';
import { ContentGenerationRequest, ContentGenerationResponse } from '../types/content.types';
import { validateTopic, ValidationError } from '../utils/validation';
import { sendSuccess, sendError, sendValidationError } from '../utils/response';
import { ERROR_MESSAGES } from '../config/constants';

export class ContentController {
  private openaiService: OpenAIService;
  private testMode: boolean;

  constructor() {
    this.openaiService = new OpenAIService();
    this.testMode = process.env.TEST_MODE === 'true';
  }

  /**
   * Generate dialogue content from a topic
   * POST /api/content/generate
   */
  async generateContent(req: Request, res: Response): Promise<void> {
    try {
      const { topic }: ContentGenerationRequest = req.body;

      // Skip validation in test mode
      let validatedTopic = topic;
      if (!this.testMode) {
        validatedTopic = validateTopic(topic);
      }

      // Generate content using OpenAI service
      const response: ContentGenerationResponse = await this.openaiService.generateResponse(
        this.testMode ? 'test' : validatedTopic
      );

      sendSuccess(res, {
        ...response,
        user: req.user, // Include user info for debugging
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        sendValidationError(res, error.message);
      } else {
        console.error('Content generation error:', error);
        sendError(
          res,
          ERROR_MESSAGES.CONTENT_GENERATION_FAILED,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  }
} 