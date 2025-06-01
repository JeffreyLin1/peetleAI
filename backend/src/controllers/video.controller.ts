import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { ElevenLabsService } from '../services/elevenlabs';
import { VideoGenerationRequest, VideoGenerationResponse, VideoFile, VideoListResponse } from '../types/video.types';
import { sendSuccess, sendError, sendValidationError, sendNotFound } from '../utils/response';
import { ERROR_MESSAGES, HTTP_STATUS } from '../config/constants';
import { ValidationError } from '../utils/validation';
import { CloudStorageService } from '../services/storage';

export class VideoController {
  private elevenLabsService: ElevenLabsService;
  private videosDir: string;
  private cloudStorage: CloudStorageService;

  constructor() {
    this.elevenLabsService = new ElevenLabsService();
    this.videosDir = path.join(process.cwd(), 'public', 'videos');
    this.cloudStorage = new CloudStorageService();
  }

  /**
   * Generate video from text and dialogue
   * POST /api/video/generate
   */
  async generateVideo(req: Request, res: Response): Promise<void> {
    try {
      const { dialogue, imagePlaceholders }: VideoGenerationRequest = req.body;

      // Validate that dialogue is provided
      if (!dialogue || !Array.isArray(dialogue) || dialogue.length === 0) {
        throw new ValidationError('Dialogue is required and must be a non-empty array');
      }

      // Generate video with dialogue and optional image placeholders
      const speechResponse = await this.elevenLabsService.generateDialogueSpeech(dialogue, imagePlaceholders);

      if (!speechResponse.success || !speechResponse.video_url) {
        throw new Error('No video data received from speech service');
      }

      const response: VideoGenerationResponse = {
        videoUrl: speechResponse.video_url,
        provider: 'elevenlabs',
      };

      sendSuccess(res, {
        ...response,
        user: req.user, // Include user info for debugging
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        sendValidationError(res, error.message);
      } else {
        console.error('Video generation error:', error);
        sendError(
          res,
          ERROR_MESSAGES.VIDEO_GENERATION_FAILED,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  }

  /**
   * List available videos
   * GET /api/video/list
   */
  async listVideos(req: Request, res: Response): Promise<void> {
    try {
      if (!fs.existsSync(this.videosDir)) {
        const response: VideoListResponse = {
          videos: [],
          total: 0,
        };
        sendSuccess(res, response);
        return;
      }

      const files = fs.readdirSync(this.videosDir);
      const videoFiles = files.filter(file => file.endsWith('.mp4'));

      const videos: VideoFile[] = videoFiles.map(file => {
        const filePath = path.join(this.videosDir, file);
        const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;

        return {
          filename: file,
          url: `/videos/${file}`,
          fullUrl: `${req.protocol}://${req.get('host')}/videos/${file}`,
          streamUrl: `${req.protocol}://${req.get('host')}/api/video/stream/${file}`,
          size: stats?.size,
        };
      });

      const response: VideoListResponse = {
        videos,
        total: videos.length,
      };

      sendSuccess(res, response);
    } catch (error) {
      console.error('Error listing videos:', error);
      sendError(res, 'Failed to list videos');
    }
  }

  /**
   * Stream video file with range support
   * GET /api/video/stream/:filename
   */
  async streamVideo(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      
      // In production with cloud storage, redirect to cloud URL
      if (process.env.NODE_ENV === 'production' && this.cloudStorage.isConfigured()) {
        const cloudUrl = this.cloudStorage.getVideoPublicUrl(filename);
        
        if (cloudUrl) {
          // Redirect to the cloud storage URL
          res.redirect(302, cloudUrl);
          return;
        }
      }
      
      // Fallback to local file serving (development or if cloud storage fails)
      const videoPath = path.join(this.videosDir, filename);

      if (!fs.existsSync(videoPath)) {
        sendNotFound(res, 'Video');
        return;
      }

      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        // Handle range requests for video seeking
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });

        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        };

        res.writeHead(206, head);
        file.pipe(res);
      } else {
        // Serve the entire file
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
        };

        res.writeHead(HTTP_STATUS.OK, head);
        fs.createReadStream(videoPath).pipe(res);
      }
    } catch (error) {
      console.error('Error streaming video:', error);
      sendError(res, 'Failed to stream video');
    }
  }
} 