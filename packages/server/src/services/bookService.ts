import {
  ALIGNMENT_DEFAULT,
  ALL_LINES,
  Book,
  BookContent,
  BookFileType,
  BookSetting,
  Chapter,
  CHAPTER_MARKER,
  CHAPTER_SIZE,
  DELETE_MARKER,
  FONT_SIZE_DEFAULT,
  INDENT_DEFAULT,
  LINE_HEIGHT_DEFAULT,
  RATE_DEFAULT,
  SearchMatch,
} from '@audiobook/shared';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadsDir } from '../index';
import { BookRepository } from '../repositories/book';
import { CoverService } from './coverService';
import { ScraperService } from './scraperService';
import { TextProcessorService } from './textProcessorService';

interface SaveBook {
  _id: Book['_id'];
  title: Book['title'];
  source: Book['source'];
  localPath: Book['localPath'];
  coverPath?: Book['coverPath'];
  extractedImages?: Book['extractedImages'];
  bookUrl?: Book['bookUrl'];
  fileType: Book['fileType'];
  lines: BookContent['lines'];
  chapters: Book['chapters'];
  lang: BookContent['lang'];
}

export class BookService {
  private uploadsDir = uploadsDir;

  constructor(
    private bookRepository: BookRepository,
    private textProcessorService: TextProcessorService,
    private scraperService: ScraperService,
    private coverService: CoverService,
  ) {
    // Ensure temp directory exists
    this.ensureDirectories();
  }

  getAll = async () => {
    return await this.bookRepository.getAll();
  };

  checkExisting = async (bookTitle: string, filePath?: string, onError?: (message: string) => boolean) => {
    const found = await this.bookRepository.getByTitle(bookTitle);
    if (found) {
      if (filePath) this.deleteFile(filePath);
      if (onError) {
        onError?.('Book with the same title already exists');
      }
      throw new Error('Book with the same title already exists');
    }
  };

  scrapeWithProgress = async (
    url: string,
    onProgress?: (current: number, total: number) => void,
    onStatus?: (message: string, title?: string) => void,
    onError?: (message: string) => boolean,
  ): Promise<Book> => {
    const bookId = uuidv4();

    // Discovery - gets Title, Cover URL, and all chapter URLs
    const { title, coverUrl, chapters } = await this.scraperService.discoverBook(url);
    onStatus?.(`Found ${chapters.length} chapters for ${title}...`, title);
    await this.checkExisting(title, url, onError);

    // Download cover before content scraping
    onStatus?.('Download cover...', title);
    let coverPath = coverUrl ? await this.coverService.downloadCover(bookId, coverUrl) : undefined;

    // Create book entry with cover
    const book = await this.saveBookToRepository({
      _id: bookId,
      title,
      source: 'web',
      lines: [],
      chapters,
      lang: 'en-US',
      localPath: '',
      bookUrl: url,
      fileType: 'web' as BookFileType,
      coverPath: coverPath ? `/uploads/${coverPath}` : undefined,
    });

    // HydratE initial chapters
    const batchSize = Math.min(chapters.length, CHAPTER_SIZE);
    onStatus?.(`Hydrating first ${batchSize} chapters...`);
    await this.hydrateInitialChapters(bookId, chapters.slice(0, batchSize), onProgress);

    return book;
  };

  hydrateChapter = async (bookId: string, chapterIndex: number): Promise<Book | null> => {
    const book = await this.bookRepository.getById(bookId);
    if (!book) throw new Error('Book not found');

    const chapter = book?.chapters[chapterIndex];
    if (!chapter) throw new Error('Chapter index out of bounds');

    if (chapter?.isLoaded) {
      console.log(`[JIT] Chapter ${chapterIndex + 1} already loaded, skipping.`);
      return book;
    }

    console.log(`[JIT] Hydrating Chapter ${chapterIndex} / ${book?.chapters.length}: ${chapter.title}`);

    await this.fetchAndSaveChapter(bookId, chapter, chapterIndex);
    return await this.bookRepository.getById(bookId);
  };

  reHydrateFromChapter = async (bookId: string, chapterIndex: number): Promise<Book | null> => {
    console.log(`[Reset] Truncating book ${bookId} from chapter index ${chapterIndex}`);
    await this.bookRepository.truncateFromIndex(bookId, chapterIndex);

    const book = await this.bookRepository.getById(bookId);
    if (!book) throw new Error('Book not found');

    const chapter = book?.chapters[chapterIndex];
    if (!chapter) throw new Error('Target chapter missing after truncate');

    await this.fetchAndSaveChapter(bookId, chapter, chapterIndex);

    return await this.updateChapters(bookId);
  };

  /**
   * Core logic to fetch, format, and save a specific chapter.
   */
  private fetchAndSaveChapter = async (bookId: string, chapter: Chapter, index: number): Promise<void> => {
    // 1. Scrape content
    const { lines } = await this.scraperService.scrapeSingleChapter(chapter.source);

    // 2. Format: Add chapter title prefix
    lines.unshift(`${CHAPTER_MARKER}${chapter.title.toUpperCase()}`);

    // 3. Persist: Order is critical (update metadata first to set correct startIndex)
    await this.bookRepository.updateChapter(bookId, index);
    await this.bookRepository.appendLines(bookId, lines);
    await this.bookRepository.syncTotalLines(bookId);
  };

  /**
   * Scrapes the first batch of chapters immediately on init
   */
  private hydrateInitialChapters = async (bookId: string, chapters: Chapter[], onProgress?: (current: number, total: number) => void) => {
    let lang: string | undefined;

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const { lines } = await this.scraperService.scrapeSingleChapter(chapter.source);
      const chapterTitle = chapters[i].title;
      lines.unshift(`${CHAPTER_MARKER}${chapterTitle.toUpperCase()}`);

      if (i === 0) {
        const sampleText = lines.slice(0, 10).join(' ');
        lang = this.textProcessorService.detectLanguage(sampleText);
      }

      await this.bookRepository.updateChapter(bookId, i);
      await this.bookRepository.appendLines(bookId, lines, lang);
      await this.bookRepository.syncTotalLines(bookId);

      if (onProgress) onProgress(i + 1, chapters.length);
      console.log(`[${i + 1}/${chapters.length}] Scraped: ${chapters[i].source} ${chapters[i].title} (lines + ${lines.length})`);
    }
  };

  async checkAllForUpdates(): Promise<Record<string, number>> {
    const allBooks = await this.bookRepository.getAll();
    const webBooks = allBooks.filter((b) => b.source === 'web' && b.bookUrl);

    const updatesNeeded: Record<string, number> = {};

    await Promise.all(
      webBooks.map(async (book) => {
        try {
          const { chapters: latestChapters } = await this.scraperService.discoverBook(book.bookUrl!);

          if (latestChapters.length > book.chapters.length) {
            updatesNeeded[book._id] = latestChapters.length - book.chapters.length;
          }
        } catch (e) {
          console.error(`❌ Failed to check update for ${book.title}`);
        }
      }),
    );

    return updatesNeeded;
  }

  async updateChapters(bookId: string) {
    const book = await this.bookRepository.getById(bookId);
    if (!book || book.source !== 'web' || !book.bookUrl) return book;

    const { chapters } = await this.scraperService.discoverBook(book.bookUrl);

    const existingUrls = new Set(book.chapters.map((c) => c.source));
    const newChapters = chapters.filter((c) => !existingUrls.has(c.source));

    if (newChapters.length > 0) {
      const firstNew = newChapters[0].title;
      const lastNew = newChapters.at(-1)?.title;
      console.log(`✨ Found ${newChapters.length} new chapters: [${firstNew}] to [${lastNew}]`);

      await this.bookRepository.appendChapters(bookId, newChapters);
    }

    return await this.bookRepository.getById(bookId);
  }

  upload = async (bookId: string, bookTitle: string, filePath: string, fileType: string) => {
    let coverPath;
    try {
      coverPath = await this.coverService.extractCover(bookId, filePath, fileType);

      const { lang, lines, chapters, extractedImages } = await this.textProcessorService.processBookData(bookId, bookTitle, filePath, fileType);

      return this.saveBookToRepository({
        _id: bookId,
        title: bookTitle,
        source: 'local',
        lines,
        chapters,
        lang,
        localPath: filePath,
        fileType: fileType as BookFileType,
        coverPath: coverPath ? `/uploads/${coverPath}` : undefined,
        extractedImages,
      });
    } catch (error) {
      this.deleteFile(filePath);
      this.deleteFile(coverPath);
      throw new Error(`Failed to extract text from file: ${error}`);
    }
  };

  private saveBookToRepository = async ({ _id, title, source, lines, chapters, lang, localPath, coverPath, extractedImages, bookUrl, fileType }: SaveBook) => {
    const now = new Date().toISOString();

    const book: Book = {
      _id,
      userId: 'local-user',
      title,
      source,
      localPath,
      coverPath,
      extractedImages,
      bookUrl,
      fileType,
      currentLine: 0,
      totalLines: lines.length,
      chapters,
      createdAt: now,
      updatedAt: now,
    };

    await Promise.all([
      this.bookRepository.addBook(book),
      this.bookRepository.setContent(book._id, {
        bookId: book._id,
        lines,
        lang,
      }),
      this.bookRepository.setSetting(book._id, {
        bookId: book._id,
        fontSize: FONT_SIZE_DEFAULT,
        lineHeight: LINE_HEIGHT_DEFAULT,
        indent: INDENT_DEFAULT,
        rate: RATE_DEFAULT,
        alignment: ALIGNMENT_DEFAULT,
      }),
    ]);

    this.deleteFile(localPath);

    return book;
  };

  getById = async (_id: string) => {
    return await this.bookRepository.getById(_id);
  };

  getByTitle = async (title: string) => {
    return await this.bookRepository.getByTitle(title);
  };

  updateBook = async (_id: string, updates: Partial<Book>) => {
    const updated = await this.bookRepository.updateBook(_id, updates);
    if (!updated) {
      throw new Error(`Book with ID ${_id} not found`);
    }
    return updated;
  };

  updateWithCover = async (_id: string, updates: Partial<Book>, filePath: string | undefined) => {
    try {
      let book = await this.bookRepository.getById(_id);
      if (!book) {
        await this.delete(_id);
        throw new Error(`Book with ID ${_id} not found`);
      }

      // new upload
      if (filePath) {
        // delete old cover
        if (book.coverPath) {
          this.deleteFile(book.coverPath);
        }
        updates.coverPath = `/uploads/${_id}${path.extname(filePath)}`;
      } else if (!updates.coverPath && book.coverPath) {
        // user delete exisitng cover
        this.deleteFile(book.coverPath);
      }

      const updated = await this.bookRepository.updateBook(_id, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });

      return updated;
    } catch (error) {
      this.deleteFile(filePath);
      throw new Error(`Failed to update book cover: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  updateSetting = async (_id: string, updates: Partial<BookSetting>) => {
    const updated = await this.bookRepository.updateSetting(_id, updates);
    if (!updated) {
      throw new Error(`Setting with ID ${_id} not found`);
    }
    return updated;
  };

  deleteLine = async (_id: string, index: number) => {
    let book = await this.bookRepository.getById(_id);
    if (!book) {
      throw new Error(`Book with ID ${_id} not found`);
    }

    const content = await this.bookRepository.getContent(_id, 0, ALL_LINES);
    if (!content) {
      throw new Error(`Content for book with ID ${_id} not found`);
    }

    if (index < 0 || index >= content.lines.length) {
      throw new Error(`Line index ${index} is out of bounds`);
    }

    // Mark line as deleted
    content.lines[index] = DELETE_MARKER + content.lines[index];
    console.warn(`⚠️ Delete line ${index} for book ${_id}`);

    // Clean up metadata
    const chapters = (book.chapters || []).filter((c) => c.startIndex !== index && c.source !== '' + index);
    const bookmarks = (book.bookmarks || []).filter((b) => b.index !== index);
    const highlights = (book.highlights || []).filter((h) => !h.indices.includes(index));

    await this.bookRepository.updateBook(_id, { chapters, bookmarks, highlights });
    await this.bookRepository.setContent(_id, content);
  };

  restoreLine = async (_id: string, index: number) => {
    let book = await this.bookRepository.getById(_id);
    if (!book) {
      throw new Error(`Book with ID ${_id} not found`);
    }

    const content = await this.bookRepository.getContent(_id, 0, ALL_LINES);
    if (!content) {
      throw new Error(`Content for book with ID ${_id} not found`);
    }

    if (index < 0 || index >= content.lines.length) {
      throw new Error(`Line index ${index} is out of bounds`);
    }

    // Restore deleted line
    const lines = [...content.lines].map((line, i) => (i === index && line.startsWith(DELETE_MARKER) ? line.substring(DELETE_MARKER.length) : line));
    await this.bookRepository.setContent(_id, { ...content, lines });
  };

  delete = async (_id: string) => {
    const found = await this.bookRepository.getById(_id);
    if (!found) {
      throw new Error(`Book with ID ${_id} not found`);
    }

    this.deleteFile(found.localPath);
    this.deleteFile(found.coverPath);
    if (found.extractedImages) {
      const imagePaths = Object.values(found.extractedImages);
      if (imagePaths.length > 0) {
        console.log(`Cleaning up ${imagePaths.length} extracted images`);
        for (const imgPath of imagePaths) {
          await this.deleteFile(imgPath);
        }
      }
    }

    return await this.bookRepository.delete(_id);
  };

  getContent = async (_id: string, offset: number, limit: number) => {
    const content = await this.bookRepository.getContent(_id, offset, limit);
    if (!content) {
      throw new Error(`Content for book with ID ${_id} not found`);
    }
    return content;
  };

  getSetting = async (_id: string) => {
    const setting = await this.bookRepository.getSetting(_id);
    if (!setting) {
      throw new Error(`Setting for book with ID ${_id} not found`);
    }
    return setting;
  };

  search = async (_id: string, query: string) => {
    const content = await this.bookRepository.getContent(_id, 0, ALL_LINES);
    if (!content) {
      throw new Error(`Content for book with ID ${_id} not found`);
    }

    const matches: SearchMatch[] = [];

    try {
      const regex = new RegExp(query, 'ig');
      content.lines.forEach((line, index) => {
        if (regex.test(line) && !line.startsWith(DELETE_MARKER)) {
          matches.push({ index, text: line });
        }
      });
    } catch (e) {
      console.error('Invalid Regex pattern', e);
      return [];
    }

    return matches;
  };

  private deleteFile = async (rawPath: string | undefined) => {
    if (!rawPath) return;

    try {
      const fileName = path.basename(rawPath);
      const fullPath = path.join(this.uploadsDir, fileName);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (error) {
      console.error(`❌ Failed to delete file at ${rawPath}:`, error);
    }
  };

  private ensureDirectories = async () => {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  };
}
