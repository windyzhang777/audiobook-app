type BookSource = 'local' | 'web';

export type BookFileType = 'txt' | 'epub' | 'pdf' | 'mobi' | 'web';

export interface BookMark {
  index: number;
  text: string;
}

export interface Chapter {
  title: string;
  source: string; // line index for upload; URL for scraper
  isLoaded: boolean;
  startIndex?: number;
  href?: string;
}

/**
 * Book
 */
export interface Book {
  _id: string;
  userId: string;
  title: string;
  author?: string;
  source: BookSource;
  localPath: string;
  coverPath?: string;
  extractedImages?: Record<string, string>;
  bookUrl?: string;
  fileType: BookFileType;

  currentLine: number;
  totalLines: number;

  createdAt: string; // ISO string
  lastReadAt?: string; // ISO string
  updatedAt: string; // ISO string
  lastCompleted?: string; // ISO string
  chapters: Chapter[];
  bookmarks?: BookMark[];
}

/**
 * BookContent
 */
export interface BookContent {
  bookId: string;
  lines: string[];
  lang: string;
  pagination?: Pagination;
}

export interface BookContentPaginated extends BookContent {
  pagination: Pagination;
}

export interface Pagination {
  offset?: number;
  limit?: number;
  total: number;
  hasMore: boolean;
}

/**
 * Setting
 */
export type VoiceType = 'system' | 'cloud';
export type Alignment = 'left' | 'center' | 'right';
export type Theme = 'light' | 'dark';

export interface SpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: string;
}

export interface TextOptions {
  fontSize?: number;
  lineHeight?: number;
  indent?: number;
  alignment?: Alignment;
}

export interface BookSetting extends SpeechOptions, TextOptions {
  bookId: string;
  audioPath?: string;
}

export interface BookDto {
  bookId: string;
  userId: string;
  title: string;
  source: BookSource;
  coverPath?: string;
}

export interface UpdateProgressRequest {
  bookId: string;
  currentLine: number;
}

export interface UploadBookResponse {
  book: Book;
}

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  percentage: number;
  currentChunk: number;
  totalChunks: number;
  speed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
}

export interface ChunkedUploadConfig {
  chunkSize: number; // bytes
  maxParallel: number; // number of parallel chunk uploads
  maxRetries: number; // retry attempts per chunk
  onProgress?: (progress: UploadProgress) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
  onError?: (error: Error) => void;
}

export interface ChunkMetadata {
  index: number;
  start: number;
  end: number;
  size: number;
  retries: number;
}

export type BookAction = { type: 'select'; book: Book } | { type: 'edit'; book: Book } | { type: 'delete'; book: Book } | { type: 'resetProgress'; book: Book } | { type: 'markCompleted'; book: Book };
