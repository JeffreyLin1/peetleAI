import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResult {
  publicUrl: string;
  path: string;
  size: number;
  contentType: string;
}

export interface StorageConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  bucket: string;
  folder: string;
}

export class CloudStorageService {
  private supabase: SupabaseClient | null = null;
  
  // Storage configurations for different asset types
  private readonly storageConfigs = {
    videos: {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
      bucket: 'generated-content',
      folder: 'videos'
    },
    audio: {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'],
      bucket: 'generated-content',
      folder: 'audio'
    },
    images: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      bucket: 'generated-content',
      folder: 'images'
    },
    placeholders: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      bucket: 'user-content',
      folder: 'placeholders'
    }
  };

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('CloudStorageService initialization:', {
      hasUrl: Boolean(supabaseUrl),
      hasKey: Boolean(supabaseServiceKey),
      nodeEnv: process.env.NODE_ENV,
      urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'undefined'
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('Missing Supabase configuration for cloud storage - falling back to local storage');
      // Don't throw error, just log warning and continue without cloud storage
      return;
    }

    try {
      this.supabase = createClient(supabaseUrl, supabaseServiceKey);
      console.log('Supabase client created successfully');
    } catch (error) {
      console.error('Failed to create Supabase client:', error);
      throw new Error('Failed to initialize cloud storage service');
    }
  }

  /**
   * Upload a video file to cloud storage
   */
  async uploadVideo(filePath: string, userId?: string): Promise<UploadResult> {
    return this.uploadFile(filePath, 'videos', userId);
  }

  /**
   * Upload an audio file to cloud storage
   */
  async uploadAudio(filePath: string, userId?: string): Promise<UploadResult> {
    return this.uploadFile(filePath, 'audio', userId);
  }

  /**
   * Upload an image file to cloud storage
   */
  async uploadImage(filePath: string, userId?: string): Promise<UploadResult> {
    return this.uploadFile(filePath, 'images', userId);
  }

  /**
   * Upload a placeholder image to cloud storage
   */
  async uploadPlaceholderImage(filePath: string, userId: string): Promise<UploadResult> {
    return this.uploadFile(filePath, 'placeholders', userId);
  }

  /**
   * Generic file upload method with validation and security
   */
  private async uploadFile(filePath: string, type: keyof typeof this.storageConfigs, userId?: string): Promise<UploadResult> {
    if (!this.supabase) {
      throw new Error('Cloud storage not configured');
    }
    
    const config = this.storageConfigs[type];
    
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Get file stats and validate size
    const stats = fs.statSync(filePath);
    if (stats.size > config.maxFileSize) {
      throw new Error(`File too large. Maximum size: ${config.maxFileSize / (1024 * 1024)}MB`);
    }

    // Determine content type from file extension
    const extension = path.extname(filePath).toLowerCase();
    const contentType = this.getContentType(extension);
    
    if (!config.allowedMimeTypes.includes(contentType)) {
      throw new Error(`Invalid file type. Allowed types: ${config.allowedMimeTypes.join(', ')}`);
    }

    // Generate secure file path
    const fileName = this.generateSecureFileName(filePath, userId);
    const storagePath = `${config.folder}/${fileName}`;

    try {
      // Read file buffer
      const fileBuffer = fs.readFileSync(filePath);

      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(config.bucket)
        .upload(storagePath, fileBuffer, {
          contentType,
          upsert: false, // Prevent overwriting for security
          cacheControl: '3600' // Cache for 1 hour
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(config.bucket)
        .getPublicUrl(storagePath);

      return {
        publicUrl: urlData.publicUrl,
        path: storagePath,
        size: stats.size,
        contentType
      };

    } catch (error) {
      throw new Error(`Failed to upload ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a file from cloud storage
   */
  async deleteFile(bucket: string, filePath: string): Promise<boolean> {
    if (!this.supabase) {
      console.warn('Supabase not configured, cannot delete file');
      return false;
    }
    
    try {
      const { error } = await this.supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) {
        console.error(`Failed to delete file ${filePath}:`, error);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple files from cloud storage
   */
  async deleteFiles(bucket: string, filePaths: string[]): Promise<{ success: string[]; failed: string[] }> {
    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };

    for (const filePath of filePaths) {
      const deleted = await this.deleteFile(bucket, filePath);
      if (deleted) {
        results.success.push(filePath);
      } else {
        results.failed.push(filePath);
      }
    }

    return results;
  }

  /**
   * Generate a secure, unique filename
   */
  private generateSecureFileName(originalPath: string, userId?: string): string {
    const extension = path.extname(originalPath);
    const timestamp = Date.now();
    const uuid = uuidv4();
    
    // Include user ID for better organization and security
    const userPrefix = userId ? `${userId}/` : '';
    
    return `${userPrefix}${timestamp}_${uuid}${extension}`;
  }

  /**
   * Get content type from file extension
   */
  private getContentType(extension: string): string {
    const contentTypeMap: { [key: string]: string } = {
      // Video
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      
      // Audio
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      
      // Images
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };

    const contentType = contentTypeMap[extension];
    if (!contentType) {
      throw new Error(`Unsupported file extension: ${extension}`);
    }

    return contentType;
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(bucket: string): Promise<{ totalFiles: number; totalSize: number }> {
    if (!this.supabase) {
      console.warn('Supabase not configured, cannot get storage stats');
      return { totalFiles: 0, totalSize: 0 };
    }
    
    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .list('', {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        throw error;
      }

      const totalFiles = data?.length || 0;
      const totalSize = data?.reduce((sum, file) => sum + (file.metadata?.size || 0), 0) || 0;

      return { totalFiles, totalSize };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return { totalFiles: 0, totalSize: 0 };
    }
  }

  /**
   * Check if cloud storage is properly configured
   */
  isConfigured(): boolean {
    return Boolean(this.supabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  }

  /**
   * Get public URL for a video file
   */
  getVideoPublicUrl(filename: string): string | null {
    if (!this.supabase) {
      console.warn('Supabase not configured, cannot get video public URL');
      return null;
    }
    
    try {
      const { data } = this.supabase.storage
        .from('generated-content')
        .getPublicUrl(`videos/${filename}`);
      
      return data?.publicUrl || null;
    } catch (error) {
      console.error('Error getting video public URL:', error);
      return null;
    }
  }

  /**
   * Get public URL for any file in any bucket
   */
  getPublicUrl(bucket: string, filePath: string): string | null {
    if (!this.supabase) {
      console.warn('Supabase not configured, cannot get public URL');
      return null;
    }
    
    try {
      const { data } = this.supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);
      
      return data?.publicUrl || null;
    } catch (error) {
      console.error('Error getting public URL:', error);
      return null;
    }
  }

  /**
   * Test cloud storage connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.supabase) {
      return false;
    }
    
    try {
      // Try to list files in the generated-content bucket
      const { error } = await this.supabase.storage
        .from('generated-content')
        .list('', { limit: 1 });

      return !error;
    } catch (error) {
      console.error('Cloud storage connection test failed:', error);
      return false;
    }
  }
} 