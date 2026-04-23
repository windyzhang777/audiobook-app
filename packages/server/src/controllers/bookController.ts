import { Book, fixEncoding, PAGE_SIZE } from '@audiobook/shared';
import { Request, Response } from 'express';
import path from 'path';
import { AudiobookService } from '../services/audiobookService';
import { BookService } from '../services/bookService';

export class BookController {
  constructor(
    private bookService: BookService,
    private audiobookService: AudiobookService,
  ) {}

  /**
   * Scrape a book from a provided URL (e.g. xpxs.net)
   */
  scrapeWithProgress = async (req: Request, res: Response) => {
    const { url } = req.query; // SSE uses query params
    let bookTitle = '';

    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return res.status(400).json({ message: 'Valid URL is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const onStatus = (message: string, title?: string) => {
      if (title) bookTitle = title;
      res.write(`data: ${JSON.stringify({ message, title: bookTitle })}\n\n`);
    };
    const onProgress = (current: number, total: number) => res.write(`data: ${JSON.stringify({ current, total, title: bookTitle })}\n\n`);
    const onComplete = (book: Book) => res.write(`data: ${JSON.stringify({ complete: true, book })}\n\n`);
    const onError = (message: string) => res.write(`data: ${JSON.stringify({ error: message })}\n\n`);

    onStatus('Connecting to source...');

    try {
      console.log(`Starting SSE scrape for: ${url}`);
      const book = await this.bookService.scrapeWithProgress(url, onProgress, onStatus, onError);
      onComplete(book);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scraping failed';
      onError(message);
    } finally {
      res.end();
    }

    // Handle client disconnect
    req.on('close', () => {
      console.log('Client disconnected from scrape stream');
      if (!res.writableEnded) res.end();
    });
  };

  checkUpdates = async (_: Request, res: Response) => {
    try {
      const updates = await this.bookService.checkAllForUpdates();
      res.json(updates);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check updates';
      res.status(500).json({ message });
    }
  };

  updateChapters = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const updatedBook = await this.bookService.updateChapters(id as string);

      if (!updatedBook) {
        return res.status(404).json({ message: 'Book not found' });
      }

      res.json(updatedBook);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh chapters';
      res.status(500).json({ message });
    }
  };

  hydrateChapter = async (req: Request, res: Response) => {
    const { id, index } = req.params;

    try {
      const chapterIndex = parseInt(index as string, 10);
      if (isNaN(chapterIndex)) {
        return res.status(400).json({ message: 'Invalid chapter index' });
      }

      const updatedBook = await this.bookService.hydrateChapter(id as string, chapterIndex);
      res.status(200).json(updatedBook);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Hydration failed';
      res.status(500).json({ message });
    }
  };

  reHydrateFromChapter = async (req: Request, res: Response) => {
    const { id, index } = req.params;

    try {
      const chapterIndex = parseInt(index as string, 10);
      if (isNaN(chapterIndex)) {
        return res.status(400).json({ message: 'Invalid chapter index' });
      }

      const updatedBook = await this.bookService.reHydrateFromChapter(id as string, chapterIndex);
      res.status(200).json(updatedBook);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Truncate and Re-hydration failed';
      console.error(`❌ [Controller] ${message}`, error);
      res.status(500).json({ message });
    }
  };

  /**
   * Legacy upload (simple, for small files < 1MB)
   */
  upload = async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const fileType = req.file.originalname.split('.').pop()?.toLowerCase();
      if (!fileType) {
        return res.status(400).json({ message: 'Invalid file type' });
      }

      const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
      const cleanTitle = fixEncoding(baseName);

      await this.bookService.checkExisting(cleanTitle, req.file.path);
      const book = await this.bookService.upload(cleanTitle, req.file.path, fileType);

      res.status(201).json(book);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error adding book';
      return res.status(400).json({ message });
    }
  };

  updateWithCover = async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = { ...req.body };

    try {
      if (!id) {
        return res.status(400).json({ message: 'Book ID is required' });
      }

      if (!updates) {
        return res.status(400).json({ message: 'No updates provided' });
      }

      const updatedBook = await this.bookService.updateWithCover(id as string, updates, req.file?.path);

      res.json(updatedBook);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error updating book cover';
      return res.status(400).json({ message });
    }
  };

  getAll = async (_req: Request, res: Response) => {
    const books = await this.bookService.getAll();
    res.json(books);
  };

  getById = async (req: Request, res: Response) => {
    const book = await this.bookService.getById(req.params.id as string);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    res.json(book);
  };

  getAudioForLine = async (req: Request, res: Response) => {
    const { id, lineIndex } = req.params;

    try {
      const buffer = await this.audiobookService.getAudioForLine(id as string, parseInt(lineIndex as string));

      // Set headers for MP3 audio
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length,
        'Accept-Ranges': 'bytes',
      });

      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate audio' });
    }
  };

  getContent = async (req: Request, res: Response) => {
    const { id } = req.params;
    // Parse pagination params from query (e.g., ?offset=0&limit=50)
    const offset = parseInt(req.query.offset as string) || 0;
    const limit = parseInt(req.query.limit as string) || PAGE_SIZE;

    try {
      const content = await this.bookService.getContent(id as string, offset, limit);
      res.json(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error retrieving book content';
      return res.status(404).json({ message });
    }
  };

  getSetting = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const content = await this.bookService.getSetting(id as string);
      res.json(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error retrieving book setting';
      return res.status(404).json({ message });
    }
  };

  search = async (req: Request, res: Response) => {
    const { id } = req.params;
    const query = req.query.q as string;

    if (!query) {
      return res.status(400).json({ message: 'No query provided' });
    }

    try {
      const matches = await this.bookService.search(id as string, query);

      res.json({ count: matches.length, matches });
    } catch (error) {
      const message = error instanceof Error ? error.message : `Error text search for "${query}"`;
      return res.status(500).json({ message });
    }
  };

  updateBook = async (req: Request, res: Response) => {
    try {
      const updatedBook = await this.bookService.updateBook(req.params.id as string, {
        ...req.body,
        lastReadAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      res.json(updatedBook);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error updating book';
      return res.status(400).json({ message });
    }
  };

  updateSetting = async (req: Request, res: Response) => {
    try {
      const updatedSetting = await this.bookService.updateSetting(req.params.id as string, { ...req.body });

      res.json(updatedSetting);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error updating setting';
      return res.status(400).json({ message });
    }
  };

  deleteLine = async (req: Request, res: Response) => {
    const { id } = req.params;
    const index = parseInt(req.query.line as string);

    try {
      await this.bookService.deleteLine(id as string, index);
      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : `Error deleting line ${index} from book`;
      return res.status(400).json({ message });
    }
  };

  restoreLine = async (req: Request, res: Response) => {
    const { id } = req.params;
    const index = parseInt(req.query.line as string);

    try {
      const line = await this.bookService.restoreLine(id as string, index);
      res.json({ line });
    } catch (error) {
      const message = error instanceof Error ? error.message : `Error restoring line ${index} from book`;
      return res.status(400).json({ message });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      await this.bookService.delete(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error deleting book';
      return res.status(400).json({ message });
    }
  };
}
