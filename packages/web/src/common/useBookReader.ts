import { api } from '@/services/api';
import { getNowISOString, MAX_BOOKMARK_TEXT, PAGE_SIZE, type Book, type BookContent } from '@audiobook/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { triggerSuccess } from './triggerSuccess';
import { useBookUpdate } from './useBookUpdate';

export function useBookReader(_id: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState<Book>();
  const [lines, setLines] = useState<BookContent['lines']>([]);
  const [lang, setLang] = useState('eng');
  const [hasMore, setHasMore] = useState(true);
  const [totalLines, setTotalLines] = useState<Book['totalLines']>(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const [currentLine, setCurrentLine] = useState<Book['currentLine']>(0);
  const [lastCompleted, setlastCompleted] = useState<NonNullable<Book['lastCompleted']>>('');
  const [bookmarks, setBookmarks] = useState<NonNullable<Book['bookmarks']>>([]);
  const [highlights, setHighlights] = useState<NonNullable<Book['highlights']>>([]);

  const isFetchingRef = useRef(false);

  const updates: Partial<Book> = useMemo(() => ({ currentLine, lastCompleted, bookmarks, highlights }), [currentLine, lastCompleted, bookmarks, highlights]);
  const canUpdate =
    !loading &&
    !loadingMore &&
    JSON.stringify(updates) !== JSON.stringify({ currentLine: book?.currentLine, lastCompleted: book?.lastCompleted, bookmarks: book?.bookmarks, highlights: book?.highlights });
  const canFetch = useMemo(() => _id && hasMore && !loadingMore && !isFetchingRef.current, [_id, hasMore, loadingMore]);

  const loadBookContent = useCallback(
    async (offset: number = 0, limit: number = PAGE_SIZE) => {
      if (!_id) return;

      isFetchingRef.current = true;
      setLoadingMore(true);

      try {
        const content = await api.books.getContent(_id, offset, limit);
        if (!content) return;

        setLines((prev) => (offset === 0 ? content.lines : [...prev, ...content.lines]));
        setLang(content.lang);
        setHasMore(content.pagination.hasMore);
      } finally {
        setLoadingMore(false);
        isFetchingRef.current = false;
      }
    },
    [_id],
  );

  const hydrateChapterByIndex = useCallback(
    async (chapterIndex: number) => {
      if (!_id || !book || book.source !== 'web') return;

      console.log(`[JIT] Hydrating Chapter ${chapterIndex} / ${book?.chapters.length}: ${book.chapters[chapterIndex].title}`);

      try {
        const updatedBook = await api.books.hydrateChapter(_id, chapterIndex);
        if (!updatedBook) return;

        setBook(updatedBook);
        if (updatedBook.totalLines > totalLines) {
          setTotalLines(updatedBook.totalLines);
        }
        // const nextUnloadedIndex = updatedBook.chapters.findIndex((chapter) => !chapter.isLoaded);
        // const lastLoadedChapter = updatedBook.chapters[nextUnloadedIndex - 1];
        // if (!isSearchJumping.current) toggleIndicatorMessage(renderChapterIndicator(lastLoadedChapter));
        return updatedBook;
      } catch (error) {
        console.error(`❌ Failed to hydrate chapter ${chapterIndex}:`, error);
      }
    },
    [_id, book, totalLines],
  );

  const hydrateNextChapterIfNeeded = useCallback(
    async (_id: string, requestedEnd: number) => {
      if (!_id || !book?.chapters || book.chapters.length === 0 || book.source !== 'web') return;

      // Load chapters until the the next chapter after the currentLine
      const nextUnloadedIndex = book.chapters.findIndex((chapter) => !chapter.isLoaded);
      if (nextUnloadedIndex - 1 === -1 || nextUnloadedIndex === -1) return; // All chapters loaded

      const lastLoadedChapter = book.chapters[nextUnloadedIndex - 1];
      if (!lastLoadedChapter?.title || (lastLoadedChapter.startIndex && lastLoadedChapter.startIndex >= requestedEnd)) return;

      await hydrateChapterByIndex(nextUnloadedIndex);
    },
    [book, hydrateChapterByIndex],
  );

  const loadMoreLines = useCallback(
    async (offset: number = 0, limit: number = PAGE_SIZE) => {
      if (!_id || !canFetch) return;

      const loadedCount = lines.length;
      const requestedEnd = offset + limit;
      // no need to fetch if requested range is already covered
      if (requestedEnd <= loadedCount) return;

      isFetchingRef.current = true;
      setLoadingMore(true);

      try {
        if (book?.source === 'web') {
          await hydrateNextChapterIfNeeded(_id, requestedEnd);
        }

        await loadBookContent(offset, limit);
      } finally {
        setLoadingMore(false);
        isFetchingRef.current = false;
      }
    },
    [_id, canFetch, loadBookContent, lines.length, book?.source, hydrateNextChapterIfNeeded],
  );

  const toggleBookmark = (index: number, text: string) => {
    const truncatedText = text.length > MAX_BOOKMARK_TEXT ? text.slice(0, MAX_BOOKMARK_TEXT) + '...' : text;
    setBookmarks((prev) => {
      const exists = prev.find((b) => b.index === index);
      if (exists) {
        return prev.filter((b) => b.index !== index);
      }
      return [...prev, { index, text: truncatedText }].sort((a, b) => a.index - b.index);
    });
  };

  const toggleHighlight = (indices: number[], texts: string[]) => {
    setHighlights((prev) => {
      const exists = prev.find((b) => indices.every((i) => b.indices.includes(i)));
      if (exists) {
        return prev.filter((b) => !indices.every((i) => b.indices.includes(i)));
      }
      return [...prev, { indices, texts }].sort((a, b) => a.indices[0] - b.indices[0]);
    });
  };

  const deleteLine = async (index: number) => {
    if (!_id) return;

    await api.books.deleteLine(_id, index);
    setLines((prev) => prev.filter((_, i) => i !== index));
    setTotalLines((prev) => prev - 1);
    // flushUpdate();
  };

  const updateBook = async (_id: string, updates: Partial<Book>) => {
    if (!_id) return;

    try {
      const updated = await api.books.update(_id, updates);
      setBook(updated);
    } catch (error) {
      console.error('❌ Failed to update book: ', updates, error);
    }
  };

  const onBookCompleted = () => {
    if (!lastCompleted) triggerSuccess();
    setlastCompleted(getNowISOString());
  };

  const { flushUpdate: flushBook } = useBookUpdate(_id, updates, canUpdate, updateBook);

  useEffect(() => {
    const loadBook = async () => {
      if (!_id) return;

      try {
        const book = await api.books.getById(_id);
        if (!book) return;

        setBook(book);
        setTotalLines(book.totalLines);
        setCurrentLine(book.currentLine || 0);
        setlastCompleted(book.lastCompleted || '');
        setBookmarks(book.bookmarks || []);
        setHighlights(book.highlights || []);

        await loadBookContent(0, (book.currentLine || 0) + PAGE_SIZE);
      } catch (error) {
        console.error('❌ Failed to load book: ', error);
      } finally {
        setLoading(false);
      }
    };

    loadBook();
  }, [_id, loadBookContent]);

  return {
    loading: loading,
    book,
    lines,
    lang,
    hasMore,
    totalLines,
    loadingMore,

    currentLine,
    setCurrentLine,
    lastCompleted,
    bookmarks,
    setBookmarks,
    toggleBookmark,
    highlights,
    setHighlights,
    toggleHighlight,
    onBookCompleted,

    canFetch,

    flushBook,
    hydrateChapterByIndex,
    loadMoreLines,
    deleteLine,
  };
}
