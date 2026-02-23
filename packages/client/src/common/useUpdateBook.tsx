import { api } from '@/services/api';
import { FIVE_MINUTES, type Book } from '@audiobook/shared';
import { useEffect } from 'react';
import { useDebounceCallback } from './useDebounceCallback';

export function useUpdateBook(id: string | undefined, updatedBook: Partial<Book>, canUpdate: boolean, setBook: React.Dispatch<React.SetStateAction<Book | undefined>>) {
  const handleBookUpdate = async () => {
    if (!id) return;
    try {
      await api.books.update(id, updatedBook);
      setBook((prev) => (prev ? { ...prev, ...updatedBook } : prev));
    } catch (error) {
      console.error('Failed to update book: ', updatedBook, error);
    }
  };

  const { run: debounceUpdate, flush: flushUpdate } = useDebounceCallback(handleBookUpdate, FIVE_MINUTES);

  useEffect(() => {
    if (canUpdate) {
      debounceUpdate();
    }
  }, [debounceUpdate, canUpdate]);

  useEffect(() => {
    const handlePageVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushUpdate();
      }
    };

    document.addEventListener('visibilitychange', handlePageVisibility);
    window.addEventListener('pagehide', handlePageVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handlePageVisibility);
      window.removeEventListener('pagehide', handlePageVisibility);
      flushUpdate();
    };
  }, [flushUpdate]);

  return { flushUpdate };
}
