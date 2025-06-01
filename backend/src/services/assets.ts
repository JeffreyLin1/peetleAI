import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

export interface AssetPaths {
  backgroundVideo: string;
  peterImage: string;
  stewieImage: string;
}

export class AssetService {
  private supabase: SupabaseClient | null = null;
  private localAssetsDir = path.join(process.cwd(), 'public');
  private tempDir = path.join(process.cwd(), 'temp', 'assets');
  
  // Cloud asset URLs (you'll set these after uploading to Supabase)
  private cloudAssets = {
    backgroundVideo: process.env.SUPABASE_BACKGROUND_VIDEO_URL || '',
    peterImage: process.env.SUPABASE_PETER_IMAGE_URL || '',
    stewieImage: process.env.SUPABASE_STEWIE_IMAGE_URL || ''
  };

  constructor() {
    // Initialize Supabase client if credentials are available
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );
    }

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async getAssetPaths(): Promise<AssetPaths> {
    const useCloud = this.shouldUseCloudAssets();
    
    if (useCloud) {
      return await this.getCloudAssetPaths();
    } else {
      return this.getLocalAssetPaths();
    }
  }

  private shouldUseCloudAssets(): boolean {
    // Use cloud assets if:
    // 1. We're in production (NODE_ENV=production)
    // 2. Supabase is configured
    // 3. Cloud asset URLs are set
    return (
      process.env.NODE_ENV === 'production' &&
      this.supabase !== null &&
      Boolean(this.cloudAssets.backgroundVideo) &&
      Boolean(this.cloudAssets.peterImage) &&
      Boolean(this.cloudAssets.stewieImage)
    );
  }

  private getLocalAssetPaths(): AssetPaths {
    return {
      backgroundVideo: path.join(this.localAssetsDir, 'backgrounds', 'Minecraft.mp4'),
      peterImage: path.join(this.localAssetsDir, 'characters', 'peter.png'),
      stewieImage: path.join(this.localAssetsDir, 'characters', 'stewie.png')
    };
  }

  private async getCloudAssetPaths(): Promise<AssetPaths> {
    // For cloud assets, we need to download them temporarily for FFmpeg
    const backgroundPath = await this.downloadAssetIfNeeded(
      this.cloudAssets.backgroundVideo,
      'Minecraft.mp4'
    );
    
    const peterPath = await this.downloadAssetIfNeeded(
      this.cloudAssets.peterImage,
      'peter.png'
    );
    
    const stewiePath = await this.downloadAssetIfNeeded(
      this.cloudAssets.stewieImage,
      'stewie.png'
    );

    return {
      backgroundVideo: backgroundPath,
      peterImage: peterPath,
      stewieImage: stewiePath
    };
  }

  private async downloadAssetIfNeeded(url: string, filename: string): Promise<string> {
    const localPath = path.join(this.tempDir, filename);
    
    // Check if file already exists and is recent (less than 1 hour old)
    if (fs.existsSync(localPath)) {
      const stats = fs.statSync(localPath);
      const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
      
      if (ageInHours < 1) {
        return localPath; // Use cached version
      }
    }

    // Download the file
    await this.downloadFile(url, localPath);
    return localPath;
  }

  private downloadFile(url: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      
      const file = fs.createWriteStream(outputPath);
      
      client.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
        
        file.on('error', (err) => {
          fs.unlink(outputPath, () => {}); // Delete partial file
          reject(err);
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  async validateAssets(assetPaths: AssetPaths): Promise<void> {
    const errors: string[] = [];

    if (!fs.existsSync(assetPaths.backgroundVideo)) {
      errors.push(`Background video not found: ${assetPaths.backgroundVideo}`);
    }

    if (!fs.existsSync(assetPaths.peterImage)) {
      errors.push(`Peter character image not found: ${assetPaths.peterImage}`);
    }

    if (!fs.existsSync(assetPaths.stewieImage)) {
      errors.push(`Stewie character image not found: ${assetPaths.stewieImage}`);
    }

    if (errors.length > 0) {
      throw new Error(`Asset validation failed:\n${errors.join('\n')}`);
    }
  }

  // Method to upload assets to Supabase (run this once to set up your cloud storage)
  async uploadAssetsToSupabase(): Promise<{ [key: string]: string }> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    const localPaths = this.getLocalAssetPaths();
    const uploadedUrls: { [key: string]: string } = {};

    // Upload background video
    const backgroundBuffer = fs.readFileSync(localPaths.backgroundVideo);
    const { data: bgData, error: bgError } = await this.supabase.storage
      .from('video-assets')
      .upload('backgrounds/Minecraft.mp4', backgroundBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });

    if (bgError) throw bgError;
    
    const { data: bgUrl } = this.supabase.storage
      .from('video-assets')
      .getPublicUrl('backgrounds/Minecraft.mp4');
    uploadedUrls.backgroundVideo = bgUrl.publicUrl;

    // Upload Peter image
    const peterBuffer = fs.readFileSync(localPaths.peterImage);
    const { data: peterData, error: peterError } = await this.supabase.storage
      .from('video-assets')
      .upload('characters/peter.png', peterBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (peterError) throw peterError;
    
    const { data: peterUrl } = this.supabase.storage
      .from('video-assets')
      .getPublicUrl('characters/peter.png');
    uploadedUrls.peterImage = peterUrl.publicUrl;

    // Upload Stewie image
    const stewieBuffer = fs.readFileSync(localPaths.stewieImage);
    const { data: stewieData, error: stewieError } = await this.supabase.storage
      .from('video-assets')
      .upload('characters/stewie.png', stewieBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (stewieError) throw stewieError;
    
    const { data: stewieUrl } = this.supabase.storage
      .from('video-assets')
      .getPublicUrl('characters/stewie.png');
    uploadedUrls.stewieImage = stewieUrl.publicUrl;

    return uploadedUrls;
  }

  // Cleanup temporary downloaded files
  cleanupTempAssets(): void {
    if (fs.existsSync(this.tempDir)) {
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.warn(`Failed to cleanup temp asset: ${filePath}`);
        }
      }
    }
  }
} 