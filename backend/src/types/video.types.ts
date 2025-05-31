import { DialogueLine } from './content.types';

export interface VideoGenerationRequest {
  dialogue: DialogueLine[];
}

export interface VideoGenerationResponse {
  videoUrl: string;
  provider: string;
  duration?: number;
  fileSize?: number;
}

export interface VideoFile {
  filename: string;
  url: string;
  fullUrl: string;
  streamUrl: string;
  size?: number;
  duration?: number;
}

export interface VideoListResponse {
  videos: VideoFile[];
  total: number;
}

export interface VideoStreamOptions {
  range?: string;
  quality?: 'low' | 'medium' | 'high';
} 