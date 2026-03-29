import type { ScrapeProgress } from '@/common/useScrape';
import { ChunkedUploader } from '@/services/ChunkedUploader';
import { UPLOAD_CHUNK_SIZE, type Book, type BookContentPaginated, type ChunkedUploadConfig } from '@audiobook/shared';

export const api = {
  books: {
    /**
     * Scrape a book from a web URL (e.g., xpxs.net)
     */
    scrape: (url: string, onProgress: (progress: ScrapeProgress) => void, onComplete: (book: Book) => void, onError: (error: string) => void) => {
      const eventSource = new EventSource(`/api/books/scrape?url=${encodeURIComponent(url)}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.error) {
          onError(data.error);
          eventSource.close();
        } else if (data.complete) {
          onComplete(data.book);
          eventSource.close();
        } else if (data.message) {
          onProgress({
            message: data.message, // "Gathering chapters..."
            title: data.title,
            percentage: 0,
            uploadedBytes: 0,
            totalBytes: 0,
            currentChunk: 0,
            totalChunks: 0,
            speed: 0,
            estimatedTimeRemaining: 0,
          });
        } else {
          onProgress({
            message: data.title,
            title: data.title,
            percentage: (data.current / data.total) * 100,
            uploadedBytes: data.current,
            totalBytes: data.total,
            currentChunk: data.current,
            totalChunks: data.total, // Total chapters
            speed: 0,
            estimatedTimeRemaining: 0,
          });
        }
      };

      eventSource.onerror = () => {
        onError('Connection to scraping server lost.');
        eventSource.close();
      };

      return () => eventSource.close();
    },

    hydrateChapter: async (_id: string, chapterIndex: number): Promise<Book | null> => {
      const response = await fetch(`/api/books/${_id}/hydrate/${chapterIndex}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.message || `Failed to hydrate for chapter ${chapterIndex} for book ${_id}`);
      }

      return response.json();
    },

    /**
     * Truncates the book from this chapter index and re-fetches content and metadata.
     */
    reHydrateFromChapter: async (_id: string, chapterIndex: number): Promise<Book | null> => {
      const response = await fetch(`/api/books/${_id}/rehydrate/${chapterIndex}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.message || `Failed to re-hydrate from chapter ${chapterIndex}`);
      }

      return response.json();
    },

    /**
     * Checks all web books for new chapters
     * Returns a map of { [bookId: string]: numberOfNewChapters }
     */
    checkUpdates: async (): Promise<Record<string, number>> => {
      const response = await fetch('/api/books/check-updates');

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.message || 'Update check failed');
      }

      return response.json();
    },

    /**
     * Refresh a specific book's chapter list
     */
    updateChapters: async (_id: string): Promise<Book> => {
      const response = await fetch(`/api/books/${_id}/refresh`, { method: 'POST' });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.message || `Update chapters failed for book ${_id}`);
      }

      return response.json();
    },

    /**
     * Legacy upload (simple, for small files < 1MB)
     */
    upload: async (file: File): Promise<Book> => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/books/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.message);
      }

      return response.json();
    },

    getAll: async (): Promise<Book[]> => {
      const response = await fetch('/api/books');

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.message);
      }
      return response.json();
    },

    getById: async (_id: string): Promise<Book> => {
      const response = await fetch(`/api/books/${_id}`);

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.message);
      }
      return response.json();
    },

    getContent: async (_id: string, offset: number, limit: number): Promise<BookContentPaginated> => {
      const response = await fetch(`/api/books/${_id}/content?offset=${offset}&limit=${limit}`);

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.message);
      }
      return response.json();
    },

    search: async (_id: string, query: string): Promise<{ count: number; indices: number[] }> => {
      const response = await fetch(`/api/books/${_id}/search?q=${query}`);

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.message);
      }
      return response.json();
    },

    update: async (_id: string, updates: Partial<Book>): Promise<Book> => {
      try {
        const response = await fetch(`/api/books/${_id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...updates }),
          keepalive: true,
        });

        if (!response.ok) {
          const json = await response.json();
          throw new Error(json.message);
        }
        return response.json();
      } catch {
        throw new Error('api to update book failed');
      }
    },

    deleteLine: async (_id: string, lineIndex: number) => {
      await fetch(`/api/books/${_id}/content?line=${lineIndex}`, {
        method: 'DELETE',
      });
    },

    delete: async (_id: string) => {
      await fetch(`/api/books/${_id}`, {
        method: 'DELETE',
      });
    },
  },

  upload: {
    /**
     * Upload book with chunked upload (recommended for files > 1MB)
     */
    uploadChunked: async (file: File, config?: Partial<ChunkedUploadConfig>): Promise<Book> => {
      const uploader = new ChunkedUploader(file, config);
      return uploader.upload();
    },

    /**
     * Smart upload - automatically chooses chunked or simple based on file size
     */
    smartUpload: async (file: File, config?: Partial<ChunkedUploadConfig>): Promise<Book> => {
      const threshold = UPLOAD_CHUNK_SIZE;

      if (file.size > threshold) {
        return api.upload.uploadChunked(file, config);
      } else {
        return api.books.upload(file);
      }
    },
  },
};
