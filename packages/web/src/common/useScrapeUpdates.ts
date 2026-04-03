import { api } from '@/services/api';
import { type Book } from '@audiobook/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useScrapeUpdates(books: Book[]) {
  const [updatedBooks, setUpdatedBooks] = useState<Record<string, number>>({});
  const [checking, setChecking] = useState(false);

  const prevWebBooksCount = useRef(0);

  const checkAllForUpdates = useCallback(async () => {
    setChecking(true);
    try {
      const updatedChapterCountByBookId = await api.books.checkUpdates();
      setUpdatedBooks(updatedChapterCountByBookId);
    } catch (error) {
      console.error('❌ Failed to check for updates:', error);
    } finally {
      setChecking(false);
    }
  }, []);

  const updateChapters = useCallback(async (_id: string): Promise<Book | null> => {
    try {
      const updatedBook = await api.books.updateChapters(_id);

      // Remove update badge for the book
      setUpdatedBooks((prev) => {
        const next = { ...prev };
        delete next[_id];
        return next;
      });

      return updatedBook;
    } catch (error) {
      console.error('❌ Failed to update chapters:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    const webBooks = books.filter((b) => b.source === 'web' && b.bookUrl);
    const currentCount = webBooks.length;
    // Fetch only on mount or new web books are added
    if (currentCount > 0 && currentCount > prevWebBooksCount.current) {
      checkAllForUpdates();
    }
    prevWebBooksCount.current = currentCount;
  }, [books, checkAllForUpdates]);

  return { checking, updatedBooks, checkAllForUpdates, updateChapters };
}
