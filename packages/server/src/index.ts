import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { BookController } from './controllers/bookController';
import { UploadController } from './controllers/uploadController';
import { BookRepository } from './repositories/book';
import { bookRoutes } from './routes/bookRoutes';
import { uploadRoutes } from './routes/uploadRoutes';
import { AudiobookService } from './services/AudiobookService';
import { BookService } from './services/bookService';
import { TextProcessorService } from './services/textProcessorService';
import { TTSGoogle } from './services/TTSService';
import { UploadService } from './services/uploadService';
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Server uploaded files
export const uploadsDir = path.join(process.cwd(), 'uploads');
app.use(uploadsDir, express.static(uploadsDir));

// Instances
const bookRepository = new BookRepository();
const textProcessorService = new TextProcessorService();
const ttsService = new TTSGoogle();
const audiobookService = new AudiobookService(bookRepository, ttsService);
const bookService = new BookService(bookRepository, textProcessorService);
const bookController = new BookController(bookService, audiobookService);
const uploadService = new UploadService();
const uploadController = new UploadController(uploadService, bookService);

// Routes
app.use('/api/books', bookRoutes(bookController));
app.use('/api/upload', uploadRoutes(uploadController));

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    features: {
      chunkedUpload: true,
      maxChunkSize: '10MB',
      supportedFormats: ['txt', 'pdf', 'epub', 'mobi'],
    },
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: err.message || 'Internal server error' });
});

export default app;

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Audiobook server is running on http://localhost:${PORT}`);
  });
}
