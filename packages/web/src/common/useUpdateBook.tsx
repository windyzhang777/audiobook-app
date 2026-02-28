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
  }, [debounceUpdate, canUpdate, updatedBook]);

  useEffect(() => {
    const handlePageExit = () => {
      flushUpdate();
    };

    document.addEventListener('visibilitychange', handlePageExit);
    window.addEventListener('beforeunload', handlePageExit);
    window.addEventListener('pagehide', handlePageExit);

    return () => {
      document.removeEventListener('visibilitychange', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
      window.removeEventListener('pagehide', handlePageExit);
      flushUpdate();
    };
  }, [flushUpdate]);

  return { flushUpdate };
}
