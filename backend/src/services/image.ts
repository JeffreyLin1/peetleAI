import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import sharp from 'sharp';
import { CloudStorageService } from './storage';

const writeFile = promisify(fs.writeFile);

export class ImageService {
  private imageDir = path.join(process.cwd(), 'public', 'images', 'placeholders');
  private cloudStorage: CloudStorageService;

  constructor() {
    // Ensure image directory exists
    if (!fs.existsSync(this.imageDir)) {
      fs.mkdirSync(this.imageDir, { recursive: true });
    }
    
    // Initialize cloud storage
    this.cloudStorage = new CloudStorageService();
  }

  async saveImageForPlaceholder(
    imageBuffer: Buffer,
    placeholder: string,
    originalName: string,
    userId?: string
  ): Promise<string> {
    try {
      // Clean placeholder name for filename
      const cleanPlaceholder = placeholder.replace(/[^\w]/g, '_').toLowerCase();
      const timestamp = Date.now();
      const extension = path.extname(originalName).toLowerCase() || '.jpg';
      const filename = `${cleanPlaceholder}_${timestamp}${extension}`;
      const imagePath = path.join(this.imageDir, filename);

      // Process and resize image to optimal size for video (max 800x600)
      const processedBuffer = await sharp(imageBuffer)
        .resize(800, 600, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Save locally first
      await writeFile(imagePath, processedBuffer);

      // Handle storage based on environment
      if (process.env.NODE_ENV === 'production' && this.cloudStorage.isConfigured() && userId) {
        // Upload to cloud storage in production
        const uploadResult = await this.cloudStorage.uploadPlaceholderImage(imagePath, userId);
        
        // Return the local path for video processing (will be cleaned up after video generation)
        // The cloud URL is not needed for FFmpeg processing
        return imagePath;
      } else {
        // Return relative path for local development
        return path.join('public', 'images', 'placeholders', filename);
      }
    } catch (error) {
      throw new Error(`Failed to save image for placeholder ${placeholder}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteImage(imagePath: string): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'production' && this.cloudStorage.isConfigured()) {
        // Delete from cloud storage in production
        const bucket = imagePath.startsWith('placeholders/') ? 'user-content' : 'generated-content';
        await this.cloudStorage.deleteFile(bucket, imagePath);
        console.log(`Deleted cloud image: ${imagePath}`);
      } else {
        // Delete local file in development
        const fullPath = path.join(process.cwd(), imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`Deleted local image: ${fullPath}`);
        }
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  }

  getImageUrl(imagePath: string): string {
    if (process.env.NODE_ENV === 'production' && this.cloudStorage.isConfigured()) {
      // For cloud storage, the imagePath is already the full URL or can be constructed
      if (imagePath.startsWith('http')) {
        return imagePath;
      }
      // If it's a storage path, construct the Supabase URL
      const bucket = imagePath.startsWith('placeholders/') ? 'user-content' : 'generated-content';
      return `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${imagePath}`;
    } else {
      // Convert file path to URL path for local development
      const relativePath = imagePath.replace('public/', '');
      return `/${relativePath}`;
    }
  }

  validateImageFile(buffer: Buffer, originalName: string): void {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const extension = path.extname(originalName).toLowerCase();
    
    if (!allowedExtensions.includes(extension)) {
      throw new Error('Invalid file type. Only JPG, PNG, GIF, and WebP images are allowed.');
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (buffer.length > maxSize) {
      throw new Error('File too large. Maximum size is 10MB.');
    }
  }
} 