import { renderDeleteToaster } from '@/components/toaster';
import { api } from '@/services/api';
import { DELETE_MARKER, getNowISOString, IMAGE_MARKER, MAX_BOOKMARK_TEXT, PAGE_SIZE, removeMarker, type Book, type BookContent } from '@audiobook/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { triggerSuccess } from './triggerSuccess';
import { useBookUpdate } from './useBookUpdate';
import useToaster from './useToaster';

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
  const [chapters, setChapters] = useState<NonNullable<Book['chapters']>>([]);
  const [bookmarks, setBookmarks] = useState<NonNullable<Book['bookmarks']>>([]);
  const [highlights, setHighlights] = useState<NonNullable<Book['highlights']>>([]);

  const { toaster, showToaster, hideToaster } = useToaster();

  const updates: Partial<Book> = useMemo(() => ({ currentLine, lastCompleted, chapters, bookmarks, highlights }), [currentLine, lastCompleted, chapters, bookmarks, highlights]);
  const canUpdate =
    !loading &&
    !loadingMore &&
    JSON.stringify(updates) !==
      JSON.stringify({ currentLine: book?.currentLine, lastCompleted: book?.lastCompleted, chapters: book?.chapters, bookmarks: book?.bookmarks, highlights: book?.highlights });

  const isFetchingRef = useRef(false);
  const canFetch = useMemo(() => _id && hasMore, [_id, hasMore]);

  const loadBookContent = useCallback(
    async (offset: number = 0, limit: number = PAGE_SIZE) => {
      if (!_id) return;

      setLoadingMore(true);
      try {
        const content = await api.books.getContent(_id, offset, limit);
        if (!content) return;

        setLines((prev) => (offset === 0 ? content.lines : [...prev, ...content.lines]));
        setLang(content.lang);
        setHasMore(content.pagination.hasMore);
      } finally {
        setLoadingMore(false);
      }
    },
    [_id],
  );

  const hydrateChapterByIndex = useCallback(
    async (chapterIndex: number) => {
      if (!_id) return;

      try {
        const updatedBook = await api.books.hydrateChapter(_id, chapterIndex);
        if (!updatedBook) return;

        setBook(updatedBook);

        if (updatedBook.chapters) {
          setChapters(updatedBook.chapters);
        }

        if (updatedBook.totalLines > totalLines) {
          setTotalLines(updatedBook.totalLines);
        }
        return updatedBook;
      } catch (error) {
        console.error(`❌ Failed to hydrate chapter ${chapterIndex}:`, error);
      }
    },
    [_id, totalLines],
  );

  const hydrateNextChapterIfNeeded = useCallback(
    async (_id: string, requestedEnd: number) => {
      if (!_id || chapters.length === 0) return;

      // Load chapters until the the next chapter after the currentLine
      const nextUnloadedIndex = chapters.findIndex((chapter) => !chapter.isLoaded);
      if (nextUnloadedIndex - 1 === -1 || nextUnloadedIndex === -1) return; // All chapters loaded

      const lastLoadedChapter = chapters[nextUnloadedIndex - 1];
      if (!lastLoadedChapter?.title || (lastLoadedChapter.startIndex && lastLoadedChapter.startIndex >= requestedEnd)) return;

      console.log(`[JIT] Hydrating Chapter ${nextUnloadedIndex} / ${chapters.length}: ${chapters[nextUnloadedIndex].title}`);
      await hydrateChapterByIndex(nextUnloadedIndex);
    },
    [chapters, hydrateChapterByIndex],
  );

  const loadMoreLines = useCallback(
    async (offset: number = 0, limit: number = PAGE_SIZE) => {
      if (!_id || !canFetch || isFetchingRef.current) return;

      const requestedEnd = offset + limit;
      // no need to fetch if requested range is already covered
      if (requestedEnd <= lines.length) return;

      console.log(`[Flow] Loading more: current ${lines.length} -> ${requestedEnd} `);
      isFetchingRef.current = true;
      setLoadingMore(true);

      try {
        if (book?.source === 'web') {
          await hydrateNextChapterIfNeeded(_id, requestedEnd);
        }

        await loadBookContent(offset, limit);
      } finally {
        isFetchingRef.current = false;
        setLoadingMore(false);
      }
    },
    [_id, canFetch, lines.length, loadBookContent, book?.source, hydrateNextChapterIfNeeded],
  );

  const toggleChapter = (index: number, text: string) => {
    if (text.startsWith(IMAGE_MARKER)) return;
    setChapters((prev) => {
      const exists = prev.find((c) => c.startIndex === index);
      if (exists) {
        return prev.filter((c) => c.startIndex !== index);
      }
      return [...prev, { title: removeMarker(text), source: '' + index, isLoaded: true, startIndex: index }].sort((a, b) => a.startIndex! - b.startIndex!);
    });
  };

  const toggleBookmark = (index: number, text: string) => {
    if (text.startsWith(IMAGE_MARKER)) return;
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
    if (texts.join('').startsWith(IMAGE_MARKER)) return;
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
    if (!confirm(`Delete line ${index}: ${lines[index].length > MAX_BOOKMARK_TEXT ? lines[index].slice(0, MAX_BOOKMARK_TEXT) + '...' : lines[index]}?`)) return;

    showToaster(
      renderDeleteToaster(index, async () => {
        hideToaster();
        await restoreLine(index);
      }),
    );
    await api.books.deleteLine(_id, index);
    setLines((prev) => prev.map((line, i) => (i === index ? DELETE_MARKER + line : line)));
  };

  const restoreLine = async (index: number) => {
    if (!_id) return;

    await api.books.restoreLine(_id, index);
    setLines((prev) => prev.map((line, i) => (i === index && line.startsWith(DELETE_MARKER) ? line.substring(DELETE_MARKER.length) : line)));
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
        setChapters(book.chapters || []);
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
    chapters,
    setChapters,
    toggleChapter,
    bookmarks,
    setBookmarks,
    toggleBookmark,
    highlights,
    setHighlights,
    toggleHighlight,
    onBookCompleted,

    canFetch,
    isFetchingRef,

    flushBook,
    hydrateChapterByIndex,
    loadMoreLines,
    deleteLine,
    restoreLine,
    toaster,
  };
}
