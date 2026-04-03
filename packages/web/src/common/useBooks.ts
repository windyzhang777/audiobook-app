import { api } from '@/services/api';
import { type Book } from '@audiobook/shared';
import { useCallback, useEffect, useState } from 'react';

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const books = await api.books.getAll();
      setBooks(books);
    } catch (error) {
      console.error('❌ Failed to load books: ', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateBook = async (_id: string, updates: Partial<Book>, file?: File | undefined) => {
    if (!updates) return;
    setBooks((prev) => prev.map((b) => (b._id === _id ? { ...b, ...updates } : b)));
    try {
      let updatedBook;
      if (file) {
        updatedBook = await api.books.updateWithCover(_id, updates, file);
      } else {
        updatedBook = await api.books.update(_id, updates);
      }
      setBooks((prev) => prev.map((b) => (b._id === _id ? updatedBook : b)));
    } catch (error) {
      await loadBooks();
      console.error('❌ Failed to update book with cover: ', updates, error);
    }
  };

  const deleteBook = useCallback(
    async (_id: string) => {
      const original = books;
      setBooks((prev) => prev.filter((b) => b._id !== _id));
      try {
        await api.books.delete(_id);
      } catch (error) {
        setBooks(original);
        console.error('❌ Failed to delete book: ', error);
      }
    },
    [books],
  );

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  return { books, loading, loadBooks, updateBook, deleteBook };
}
