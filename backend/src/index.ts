import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST
dotenv.config();

// Import routes AFTER environment variables are loaded
import { authRouter, contentRouter, videoRouter, imageRouter } from './routes';
import { sendError } from './utils/response';
import { HTTP_STATUS } from './config/constants';

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
app.use('/videos', express.static(path.join(process.cwd(), 'public', 'videos'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }
}));
app.use('/images', express.static(path.join(process.cwd(), 'public', 'images')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/content', contentRouter);
app.use('/api/video', videoRouter);
app.use('/api/images', imageRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'PeetleAI Backend'
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  sendError(
    res,
    'Internal server error',
    process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    HTTP_STATUS.INTERNAL_SERVER_ERROR
  );
});

// 404 handler
app.use('*', (req, res) => {
  sendError(res, 'Route not found', `Cannot ${req.method} ${req.originalUrl}`, HTTP_STATUS.NOT_FOUND);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth service: http://localhost:${PORT}/api/auth/health`);
  console.log(`🎬 Video service: http://localhost:${PORT}/api/video/list`);
  console.log(`📝 Content service: http://localhost:${PORT}/api/content/generate`);
}); 