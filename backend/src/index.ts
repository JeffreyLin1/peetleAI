import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { chatRouter } from './routes/chat';
import fs from 'fs';

dotenv.config();

// Debug: Log environment variables (without exposing the full API key)
console.log('🔧 Environment check:');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('USE_TEST_AUDIO:', process.env.USE_TEST_AUDIO);
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('ELEVENLABS_API_KEY exists:', !!process.env.ELEVENLABS_API_KEY);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      mediaSrc: ["'self'", "data:", "blob:"],
      imgSrc: ["'self'", "data:", "blob:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static audio and video files
app.use('/audio', express.static(path.join(process.cwd(), 'public', 'audio')));

// Serve video files with proper headers for browser compatibility
app.use('/videos', express.static(path.join(process.cwd(), 'public', 'videos'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) {
      // Only log once per video file, not every range request
      const filename = path.basename(filePath);
      if (!res.headersSent) {
        console.log('📹 Serving video:', filename);
      }
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }
}));

// Test endpoint to list available videos
app.get('/api/videos/list', (req, res) => {
  try {
    const videosDir = path.join(process.cwd(), 'public', 'videos');
    if (!fs.existsSync(videosDir)) {
      return res.json({ videos: [], message: 'Videos directory does not exist' });
    }
    
    const files = fs.readdirSync(videosDir);
    const videoFiles = files.filter(file => file.endsWith('.mp4'));
    
    res.json({ 
      videos: videoFiles.map(file => ({
        filename: file,
        url: `/videos/${file}`,
        fullUrl: `http://localhost:${PORT}/videos/${file}`,
        testUrl: `http://localhost:${PORT}/api/videos/test/${file}`
      }))
    });
  } catch (error) {
    console.error('Error listing videos:', error);
    res.status(500).json({ error: 'Failed to list videos' });
  }
});

// Test endpoint to serve video with minimal headers
app.get('/api/videos/test/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const videoPath = path.join(process.cwd(), 'public', 'videos', filename);
    
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: 'Video not found' });
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
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    console.error('Error serving test video:', error);
    res.status(500).json({ error: 'Failed to serve video' });
  }
});

// Routes
app.use('/api/chat', chatRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🎵 Audio files served at: http://localhost:${PORT}/audio/`);
  console.log(`🎥 Video files served at: http://localhost:${PORT}/videos/`);
}); 