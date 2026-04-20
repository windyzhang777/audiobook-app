import type { ScrapeProgress } from '@/common/useBookScrape';
import { ChunkedUploader } from '@/services/ChunkedUploader';
import { UPLOAD_CHUNK_SIZE, type Book, type BookContentPaginated, type BookSetting, type ChunkedUploadConfig, type SearchMatch } from '@audiobook/shared';

const getErrorMessage = async (response: Response, message?: string): Promise<string> => {
  try {
    const json = await response.json();
    return json.message || json.error || message || 'Unknown error';
  } catch {
    return message || response.statusText || 'Request failed';
  }
};

export const api = {
  books: {
    /**
     * Scrape a book from a web URL (e.g., xpxs.net)
     */
    scrape: (url: string, onProgress: (progress: ScrapeProgress) => void, onComplete: (book: Book) => void, onError: (error: string) => void) => {
      const eventSource = new EventSource(`/api/books/scrape?url=${encodeURIComponent(url)}`);

      eventSource.onmessage = (event) => {
        try {
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
        } catch {
          onError('Failed to parse server response');
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        onError('Connection to scraping server lost');
        eventSource.close();
      };

      return () => eventSource.close();
    },

    hydrateChapter: async (_id: string, chapterIndex: number): Promise<Book | null> => {
      const response = await fetch(`/api/books/${_id}/hydrate/${chapterIndex}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response, `Failed to hydrate for chapter ${chapterIndex} for book ${_id}`);
        throw new Error(errorMessage);
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
        const errorMessage = await getErrorMessage(response, `Failed to re-hydrate from chapter ${chapterIndex}`);
        throw new Error(errorMessage);
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
        const errorMessage = await getErrorMessage(response, 'Failed to check chapter updates');
        throw new Error(errorMessage);
      }

      return response.json();
    },

    /**
     * Refresh a specific book's chapter list
     */
    updateChapters: async (_id: string): Promise<Book> => {
      const response = await fetch(`/api/books/${_id}/refresh`, { method: 'POST' });

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response, `Failed to update chapters for book ${_id}`);
        throw new Error(errorMessage);
      }

      return response.json();
    },

    /**
     * Legacy upload (simple, for small files < 1MB)
     */
    upload: async (file: File, options?: RequestInit): Promise<Book> => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/books/upload', {
        ...options,
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response);
        throw new Error(errorMessage);
      }

      return response.json();
    },

    updateWithCover: async (_id: string, updates: Partial<Book>, file: File | null): Promise<Book> => {
      const formData = new FormData();

      formData.append('title', updates.title || '');
      formData.append('author', updates.author || '');
      formData.append('coverPath', updates.coverPath || '');
      if (file) formData.append('cover', file);

      const response = await fetch(`/api/books/${_id}/upload`, {
        method: 'PUT',
        body: formData,
      });

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response);
        throw new Error(errorMessage);
      }

      return response.json();
    },

    update: async (_id: string, updates: Partial<Book>): Promise<Book> => {
      const response = await fetch(`/api/books/${_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...updates }),
        keepalive: true,
      });

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response, `Failed to update for book ${_id}`);
        throw new Error(errorMessage);
      }
      return response.json();
    },

    getAll: async (): Promise<Book[]> => {
      const response = await fetch('/api/books');

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response);
        throw new Error(errorMessage);
      }
      return response.json();
    },

    getById: async (_id: string): Promise<Book> => {
      const response = await fetch(`/api/books/${_id}`);

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response);
        throw new Error(errorMessage);
      }
      return response.json();
    },

    getContent: async (_id: string, offset: number, limit: number): Promise<BookContentPaginated> => {
      const response = await fetch(`/api/books/${_id}/content?offset=${offset}&limit=${limit}`);

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response);
        throw new Error(errorMessage);
      }
      return response.json();
    },

    getSetting: async (_id: string): Promise<BookSetting> => {
      const response = await fetch(`/api/books/${_id}/setting`);

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response);
        throw new Error(errorMessage);
      }
      return response.json();
    },

    updateSetting: async (_id: string, updates: Partial<BookSetting>): Promise<BookSetting> => {
      const response = await fetch(`/api/books/${_id}/setting`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...updates }),
        keepalive: true,
      });

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response, `Failed to update setting for book ${_id}`);
        throw new Error(errorMessage);
      }
      return response.json();
    },

    search: async (_id: string, query: string): Promise<{ count: number; matches: SearchMatch[] }> => {
      const response = await fetch(`/api/books/${_id}/search?q=${query}`);

      if (!response.ok) {
        const errorMessage = await getErrorMessage(response);
        throw new Error(errorMessage);
      }
      return response.json();
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
    uploadChunked: async (file: File, config?: Partial<ChunkedUploadConfig>) => {
      const uploader = new ChunkedUploader(file, config);
      return { book: uploader.upload(), uploader };
    },

    /**
     * Smart upload - automatically chooses chunked or simple based on file size
     */
    smartUpload: async (file: File, config?: Partial<ChunkedUploadConfig>) => {
      const threshold = UPLOAD_CHUNK_SIZE;

      if (file.size > threshold) {
        return api.upload.uploadChunked(file, config);
      } else {
        const controller = new AbortController();
        return {
          book: api.books.upload(file, { signal: controller.signal }),
          uploader: {
            cancel: () => controller.abort(),
          },
        };
      }
    },
  },
};
