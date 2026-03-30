import { useSaveToLocal } from '@/common/useSaveToLocal';
import { useSearchBook } from '@/common/useSearchBook';
import { useUpdateBook } from '@/common/useUpdateBook';
import { FEATURES } from '@/config/features';
import { triggerSuccess } from '@/helper';
import { api } from '@/services/api';
import { speechService, type SpeechConfigs } from '@/services/SpeechService';
import { bookTitleWithAuthor, calculateProgress, CHAPTER_PREFIX, PAGE_SIZE, type Book, type BookContent, type BookMark, type Chapter, type SpeechOptions, type TextOptions } from '@audiobook/shared';
import {
  ArrowBigDown,
  ArrowBigUp,
  ArrowLeft,
  AudioLines,
  BookIcon,
  Bookmark,
  BookmarkPlus,
  BookmarkX,
  LibraryBig,
  ListEnd,
  ListStart,
  ListX,
  Loader,
  Loader2,
  MapPin,
  Minus,
  Pause,
  Play,
  Plus,
  Save,
  Search,
  TableOfContents,
  UsersRound,
  X,
} from 'lucide-react';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Virtuoso, type LocationOptions, type VirtuosoHandle } from 'react-virtuoso';

export type ReadingMode = 'user' | 'focus' | 'edit';

const SPEECH_RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const BOOKMARK_TEXT_LIMIT = 20;

type VoiceType = 'system' | 'cloud';

export interface VoiceOption {
  type: VoiceType;
  id: string;
  displayName: string;
  enabled: boolean;
}
const VOICE_FALLBACK: VoiceOption = { type: 'system', id: 'system-default', displayName: 'System (Browser)', enabled: true };

export const BookReader = () => {
  const navigate = useNavigate();
  const { id: _id } = useParams<{ id: string }>();

  const [book, setBook] = useState<Book>();
  const [lines, setLines] = useState<BookContent['lines']>([]);
  const [lang, setLang] = useState('eng');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [totalLines, setTotalLines] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [readingMode, setReadingMode] = useState<ReadingMode>('focus');
  const [error, setError] = useState<string>();
  const [indicatorMessage, setIndicatorMessage] = useState<React.ReactNode>(null);
  const [currentLine, setCurrentLine] = useState<Book['currentLine']>(0);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [fontSize, setFontSize] = useState<NonNullable<TextOptions['fontSize']>>(18);
  const [speechRate, setSpeechRate] = useState<NonNullable<SpeechOptions['rate']>>(1.0);
  const [voice, setVoice] = useState<VoiceOption['id']>();
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICE_FALLBACK);
  const [lastCompleted, setlastCompleted] = useState<string>();
  const [bookmarks, setBookmarks] = useState<BookMark[]>([]);
  const updatedBook: Partial<Book> = useMemo(
    () => ({
      currentLine,
      lastCompleted,
      bookmarks,
      settings: { ...(book?.settings || {}), fontSize, rate: speechRate, voice: selectedVoice.id },
    }),
    [book?.settings, currentLine, lastCompleted, bookmarks, fontSize, speechRate, selectedVoice.id],
  );

  const canUpdate =
    !loading &&
    JSON.stringify(updatedBook) !==
      JSON.stringify({
        currentLine: book?.currentLine,
        lastCompleted: book?.lastCompleted,
        bookmarks: book?.bookmarks,
        settings: book?.settings,
      });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isUserScrollRef = useRef(true);
  const isUserFocusRef = useRef(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const isSearchJumping = useRef(false);
  const shouldResumeRef = useRef(false);
  const isFetchingRef = useRef(false);

  const speechConfigs = useCallback(
    (rate: number = speechRate): SpeechConfigs => ({ bookId: _id || '', lines, lang, rate, totalLines, selectedVoice }),
    [_id, lines, lang, totalLines, selectedVoice, speechRate],
  );

  const availableVoices = useMemo(() => {
    const nativeVoices = speechService.getNativeVoices(lang);
    const nativeOptions: VoiceOption[] = nativeVoices.map((voice) => ({ type: 'system', id: voice.name, displayName: voice.name, enabled: true }));
    const cloudOptions: VoiceOption[] = [{ type: 'cloud', id: 'google-neural2', displayName: 'Google AI (Neural2)', enabled: true }];
    return [...(nativeOptions.length > 0 ? nativeOptions : [VOICE_FALLBACK]), ...cloudOptions];
  }, [lang]);

  const navigateBack = (replace: boolean = false) => {
    flushUpdate();
    navigate('/', { replace });
  };

  const forceControl = (isUserControl: boolean = true, mode: ReadingMode = 'focus') => {
    isUserScrollRef.current = isUserControl;
    isUserFocusRef.current = isUserControl;
    if (readingMode === mode) return;

    if (isUserControl) {
      setReadingMode(mode);
    } else {
      clearSearch();
      setReadingMode(mode);
    }
  };

  const getChapterIndex = useCallback((lineIndex: number, chapters: Chapter[] | undefined) => {
    if (!chapters || chapters.length <= 1) return 0;

    for (let i = chapters.length - 1; i >= 0; i--) {
      const startIndex = chapters[i]?.startIndex;
      if (startIndex === undefined) continue;
      if (startIndex <= lineIndex) return i;
    }
    return 0;
  }, []);

  const updateViewIndex = useCallback(
    (lineIndex: number) => {
      const chapters = book?.chapters;
      if (!chapters) return;

      const chapterIndex = getChapterIndex(lineIndex, chapters);
      if (chapterIndex !== currentChapter) {
        setCurrentChapter(chapterIndex);
        if (!isSearchJumping.current) toggleIndicatorMessage(renderChapterIndicator(chapters[chapterIndex]));
      }
    },
    [book?.chapters, getChapterIndex, currentChapter],
  );

  const scrollToLine = useCallback(
    (index: number, behavior: LocationOptions['behavior'] = 'smooth') => {
      virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior, offset: 120 });
      updateViewIndex(index);
    },
    [updateViewIndex],
  );

  const toggleIndicatorMessage = (content: React.ReactNode) => {
    if (!content) return;

    // Rate Indicator (Debounced)
    if (timerRef.current) clearTimeout(timerRef.current);
    setIndicatorMessage(content);
    timerRef.current = setTimeout(() => {
      setIndicatorMessage(null);
    }, 2000);
  };

  const handlePlayPause = () => {
    if (!_id) return;

    if (isPlaying) {
      speechService.pause();
    } else {
      toggleIndicatorMessage(renderRateIndicator(speechRate));
      scrollToLine(currentLine, 'auto');
      forceControl(false, 'focus');
      const startFrom = currentLine >= totalLines ? 0 : currentLine;
      // if at the end, reset to start from the first line
      if (startFrom === 0) setCurrentLine(0);

      speechService.start(startFrom, speechConfigs());
    }
  };

  const handleLineClick = (lineIndex: number) => {
    if (readingMode === 'edit') return;

    forceControl(false, 'focus');
    setCurrentLine(lineIndex);
    speechService.stop();
    clearSearch();
  };

  const jumpToRead = (mode: ReadingMode = 'focus') => {
    scrollToLine(currentLine, 'auto');
    forceControl(false, mode);
  };

  const jumpToIndex = async (lineIndex: number | undefined) => {
    if (!_id || lineIndex === undefined) return;

    isSearchJumping.current = true;
    if (lineIndex >= lines.length) {
      await loadMoreLines(0, lineIndex + PAGE_SIZE);
    }
    scrollToLine(lineIndex, 'auto');
    forceControl(true, 'user');

    setTimeout(() => {
      isSearchJumping.current = false;
    }, 2000);
  };

  const loadBookContent = useCallback(
    async (offset: number = 0, limit: number = PAGE_SIZE) => {
      if (!_id) return;

      const content = await api.books.getContent(_id, offset, limit);
      if (!content) return;

      setLines((prev) => (offset === 0 ? content.lines : [...prev, ...content.lines]));
      setLang(content.lang);
      setHasMore(content.pagination.hasMore);
    },
    [_id],
  );

  const loadBook = useCallback(async () => {
    if (!_id) return;

    try {
      const book = await api.books.getById(_id);
      if (!book) return;

      setBook(book);
      setCurrentLine(book.currentLine || 0);
      setTotalLines(book.totalLines);
      setFontSize(book.settings?.fontSize || 18);
      setSpeechRate(book.settings?.rate || 1.0);
      setVoice(book.settings?.voice || VOICE_FALLBACK.id);
      setlastCompleted(book.lastCompleted || undefined);
      setBookmarks(book.bookmarks || []);

      await loadBookContent(0, (book.currentLine || 0) + PAGE_SIZE);
    } catch (error) {
      setError('Failed to load book');
      console.error('Failed to load book: ', error);
    } finally {
      setLoading(false);
    }
  }, [_id, loadBookContent]);

  const hydrateChapterByIndex = useCallback(
    async (chapterIndex: number) => {
      if (!_id || !book || book.source !== 'web') return;

      console.log(`[JIT] Hydrating Chapter ${chapterIndex} / ${book?.chapters.length}: ${book.chapters[chapterIndex].title}`);

      try {
        const updatedBook = await api.books.hydrateChapter(_id, chapterIndex);
        if (updatedBook) setBook(updatedBook);
        if (updatedBook?.totalLines && updatedBook.totalLines > totalLines) setTotalLines(updatedBook.totalLines);
        if (updatedBook) {
          const nextUnloadedIndex = updatedBook.chapters.findIndex((chapter) => !chapter.isLoaded);
          const lastLoadedChapter = updatedBook.chapters[nextUnloadedIndex - 1];
          if (!isSearchJumping.current) toggleIndicatorMessage(renderChapterIndicator(lastLoadedChapter));
          return updatedBook;
        }
      } catch (error) {
        console.error(`Failed to hydrate chapter ${chapterIndex}:`, error);
      }
    },
    [_id, book, totalLines],
  );

  const hydrateNextChapterIfNeeded = useCallback(
    async (requestedEnd: number) => {
      if (!book?.chapters || book.chapters.length === 0 || book.source !== 'web') return;

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
      if (!hasMore || !_id || loadingMore || isFetchingRef.current) return;

      const loadedCount = lines.length;
      const requestedEnd = offset + limit;
      // no need to fetch if requested range is already covered
      if (requestedEnd <= loadedCount) return;

      isFetchingRef.current = true;
      setLoadingMore(true);

      try {
        if (book?.source === 'web') {
          await hydrateNextChapterIfNeeded(requestedEnd);
        }

        await loadBookContent(offset, limit);
      } finally {
        setLoadingMore(false);
        isFetchingRef.current = false;
      }
    },
    [hasMore, _id, loadingMore, loadBookContent, lines.length, book?.source, hydrateNextChapterIfNeeded],
  );

  const toggleBookmark = (index: number, text: string) => {
    const truncatedText = text.length > BOOKMARK_TEXT_LIMIT ? text.slice(0, BOOKMARK_TEXT_LIMIT) + '...' : text;
    setBookmarks((prev) => {
      const exists = prev.find((b) => b.index === index);
      if (exists) {
        return prev.filter((b) => b.index !== index);
      }
      return [...prev, { index, text: truncatedText }].sort((a, b) => a.index - b.index);
    });
  };

  const deleteLine = async (lineIndex: number) => {
    if (!_id) return;

    await api.books.deleteLine(_id, lineIndex);
    setLines((prev) => prev.filter((_, i) => i !== lineIndex));
    setTotalLines((prev) => prev - 1);
    flushUpdate();
  };

  const { flushUpdate } = useUpdateBook(_id, updatedBook, canUpdate, setBook);
  const { searchInputRef, searchText, setSearchText, searchRes, currentMatch, prevMatch, nextMatch, clearSearch } = useSearchBook(_id, currentLine, jumpToIndex, forceControl);
  const { saveBookmarksToLocal, importBookmarksFromLocal } = useSaveToLocal();

  useEffect(() => {
    if (!_id) return;

    loadBook();

    return () => {
      speechService.stop();

      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [_id, loadBook]);

  useEffect(() => {
    speechService.onLineEnd = (lineIndex) => setCurrentLine(lineIndex);
    speechService.onIsPlayingChange = (playing) => setIsPlaying(playing);
    speechService.onLoadMoreLines = (linesIndex) => {
      shouldResumeRef.current = true;
      loadMoreLines(linesIndex);
    };
    speechService.onBookCompleted = (date) => {
      if (!lastCompleted) triggerSuccess();
      setlastCompleted(date);
    };

    return () => {
      speechService.onLineEnd = null;
      speechService.onIsPlayingChange = null;
      speechService.onLoadMoreLines = null;
      speechService.onBookCompleted = null;
    };
  }, [lastCompleted, loadMoreLines]);

  useEffect(() => {
    if (!isPlaying || !lines[currentLine] || !shouldResumeRef.current) return;

    shouldResumeRef.current = false;
    speechService.resume(currentLine, speechConfigs());
  }, [currentLine, lines, speechConfigs, isPlaying]);

  useEffect(() => {
    if (isUserScrollRef.current || !isPlaying) return;
    isUserFocusRef.current = false;

    const timer = setTimeout(() => {
      scrollToLine(currentLine);
    }, 100);

    return () => clearTimeout(timer);
  }, [isPlaying, currentLine, scrollToLine]);

  useEffect(() => {
    if (!voice || availableVoices.length <= 2) return;

    const found = availableVoices.find((v) => v.id === voice);

    if (found) {
      setSelectedVoice(found);
    }
  }, [availableVoices, voice]);

  // hijack the browser's default scroll
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        handlePlayPause();
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveToLine(Math.min(currentLine + 1, totalLines - 1));
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveToLine(Math.max(currentLine - 1, 0));
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        forceControl(true, 'focus');
      }
    };

    const moveToLine = (lineIndex: number) => {
      if (lineIndex == currentLine) return;

      scrollToLine(lineIndex, 'auto');
      forceControl(false, 'focus');
      setCurrentLine(lineIndex);

      if (isPlaying) {
        speechService.resume(lineIndex, speechConfigs());
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentLine, totalLines, handlePlayPause]);

  if (loading) {
    return (
      <div aria-label="loading" className="min-h-full flex justify-center items-center gap-2">
        <Loader />
      </div>
    );
  }

  if (!book || error) {
    return (
      <div className="absolute top-0 left-0 h-full w-full bg-white opacity-50 flex flex-col justify-center items-center gap-2">
        {error}
        <button onClick={() => navigateBack(true)}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-full relative overflow-hidden">
      {/* Book Lines */}
      <Virtuoso
        id="book-lines"
        ref={virtuosoRef}
        className="w-full leading-loose transition-transform duration-500 ease-in-out"
        style={{
          minHeight: 'calc(100vh - 10px)',
          height: '50vh',
          maxHeight: '75%',
        }}
        data={lines}
        initialTopMostItemIndex={{ index: 0, align: 'center' }}
        increaseViewportBy={200}
        endReached={(index) => {
          if (!hasMore || loadingMore || isSearchJumping.current || isFetchingRef.current) return;
          if (index < lines.length - 1) return;
          loadMoreLines(lines.length);
        }}
        atBottomStateChange={(atBottom) => {
          if (!atBottom || !hasMore || loadingMore || isFetchingRef.current) return;
          loadMoreLines(lines.length);
        }}
        rangeChanged={(range) => {
          const isVisible = currentLine >= range.startIndex && currentLine <= range.endIndex;
          setShowJumpButton(!isVisible);
        }}
        // Custom List Container (Replacing <ol>)
        components={{
          Header: () => (
            <header className="relative text-center my-6 mx-12">
              <button className="absolute top-2 left-0 p-0!" onClick={() => navigateBack()} title="Back to Books">
                <ArrowLeft size={16} />
                <LibraryBig size={16} />
              </button>
              <h3 className="font-semibold">{bookTitleWithAuthor(book)}</h3>
            </header>
          ),
          List: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ style, children, ...props }, ref) => (
            <div
              {...props}
              ref={ref}
              tabIndex={0}
              onWheel={() => {
                forceControl(true, 'focus');
              }}
              onTouchMove={() => {
                forceControl(true, 'focus');
              }}
              className="outline-none list-none text-left pl-16 pr-12"
              style={{ ...style, fontSize }}
            >
              {children}
            </div>
          )),
          Footer: () => (
            <div className="h-20 w-full flex justify-center items-center text-sm text-gray-300">
              {loadingMore ? (
                <span className="flex justify-center items-center">
                  <Loader2 className="animate-spin mr-2" size={16} />
                  &nbsp;Loading more...
                </span>
              ) : !hasMore ? (
                <span>You've reach the end</span>
              ) : null}
            </div>
          ),
        }}
        // Individual Line Item
        itemContent={(index, line) => {
          const isBookmarked = bookmarks.some((b) => b.index === index);

          const isCurrentMatch = searchRes[currentMatch] === index;
          const getHighlightedText = (text: string, highlight: string) => {
            if (!highlight.trim()) return text;
            const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
            return (
              <span>
                {parts.map((part, i) =>
                  part.toLowerCase() === highlight.toLowerCase() ? (
                    <mark key={i} className={`rounded-md py-1 outline-none bg-amber-200 ${isCurrentMatch ? 'bg-amber-500 ' : 'outline-none'}`}>
                      {part}
                    </mark>
                  ) : (
                    part
                  ),
                )}
              </span>
            );
          };

          const cleanLine = line.startsWith(CHAPTER_PREFIX) ? line.substring(CHAPTER_PREFIX.length) : line;

          return (
            <li
              key={`line-${index}`}
              role="button"
              tabIndex={index === currentLine ? 0 : -1}
              aria-current={index === currentLine ? 'location' : undefined}
              onContextMenu={(e) => {
                e.preventDefault();
                toggleBookmark(index, cleanLine);
              }}
              onDoubleClick={() => handleLineClick(index)}
              className={`group relative cursor-pointer my-1 px-2 transition-colors duration-200 ease-in-out rounded-lg ${line.startsWith(CHAPTER_PREFIX) ? 'font-semibold italic text-center uppercase tracking-widest' : ''} ${index === currentLine ? 'bg-amber-100 font-medium' : 'hover:bg-gray-50'} focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-opacity-50 ${isBookmarked ? 'border border-r-4 border-amber-400 pr-2' : 'border-r-4 border-transparent'}`}
            >
              {searchText ? getHighlightedText(cleanLine, searchText) : cleanLine}

              {readingMode === 'edit' ? (
                <button
                  aria-label="Delete this line from the book"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteLine(index);
                  }}
                  title="Delete this line from the book"
                  className={`absolute -right-9 top-0 text-gray-400 hover:opacity-100 transition-opacity duration-150 ${isBookmarked ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}
                >
                  <X size={16} fill="currentColor" />
                </button>
              ) : (
                <button
                  aria-label={`${isBookmarked ? 'Remove' : 'Add'} bookmark for line ${index + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBookmark(index, cleanLine);
                  }}
                  title={isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
                  className={`absolute -right-9 top-0 text-amber-400 hover:opacity-100 transition-opacity duration-150 ${isBookmarked ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}
                >
                  <Bookmark size={16} fill="currentColor" />
                </button>
              )}
            </li>
          );
        }}
      />

      {/* Scrollbar Marker */}
      <div
        id="scrollbar-marker"
        className="absolute top-3 right-0.5 w-3 pointer-events-none z-10 transition-transform duration-500 ease-in-out"
        style={{
          minHeight: 'calc(100vh - 10px - 1.5rem)',
          height: 'calc(50vh - 1.5rem)',
          maxHeight: 'calc(75% - 1.5rem)',
        }}
      >
        <button
          onClick={() => jumpToRead('focus')}
          title="Jump to read"
          className={`absolute right-0 w-full h-1 rounded-full bg-amber-200 cursor-pointer pointer-events-auto transition-all duration-300 p-0! hover:scale-125`}
          style={{
            top: `${calculateProgress(currentLine, lines.length - 1)}%`,
            transform: 'translateY(-50%)',
          }}
        />
      </div>

      {/* Indicator Message */}
      <div
        id="indicator-message"
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4 justify-center items-center rounded-2xl p-6 z-10 pointer-events-none bg-amber-200 backdrop-blur-mg shadow-lg transition-all duration-300 ease-out ${indicatorMessage ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
      >
        {indicatorMessage}
      </div>

      {/* Control Panel */}
      <div
        id="control-panel"
        className="fixed top-1/2 -translate-y-1/2 left-2 h-auto text-sm text-gray-400 flex flex-col items-start gap-1 rounded-full bg-transparent z-10 *:flex *:items-center [&>button]:ml-1! [&>button]:bg-transparent [&>button:enabled]:hover:bg-amber-200 [&>button:enabled]:hover:text-gray-600 [&>button:disabled]:hover:transparent [&>button:disabled]:hover:text-default [&>button]:rounded-full! select-none"
      >
        {/* Jump to Line */}
        <div className="my-1 p-1! flex flex-col items-start gap-1 rounded-full shadow *:flex *:items-center *:py-1 *:bg-transparent [&>button:enabled]:hover:bg-amber-200 [&>button:enabled]:hover:text-gray-600 [&>button:disabled]:hover:transparent [&>button:disabled]:hover:text-default *:rounded-full!">
          {/* Jump to start */}
          <button
            id="jump-to-start"
            title="Jump To Start"
            onClick={() => {
              jumpToIndex(0);
              forceControl(true, 'user');
            }}
          >
            <ArrowBigUp size={16} />
          </button>

          {/* Jump to read button */}
          <button id="jump-to-read" title="Jump To Read" onClick={() => jumpToRead('focus')} className={showJumpButton ? 'text-gray-600!' : 'text-inherit'}>
            <MapPin size={16} />
          </button>

          {/* Jump to end */}
          {FEATURES.ENABLE_SCROLL_TO_END ? (
            <button
              id="jump-to-end"
              title="Jump To End"
              onClick={() => {
                jumpToIndex(totalLines - 1);
                forceControl(true, 'user');
              }}
            >
              <ArrowBigDown size={16} />
            </button>
          ) : null}
        </div>

        {/* Bookmarks */}
        <div className="my-1 p-1! flex flex-col items-start gap-1 rounded-full shadow *:flex *:items-center *:py-1 *:bg-transparent *:hover:bg-amber-200 *:hover:text-gray-600 *:rounded-full!">
          {/* Select Bookmark */}
          <span title="Bookmarks" className="relative h-8 w-8 px-1">
            <label htmlFor="select-bookmark" className="absolute top-1/2 -translate-y-1/2 left-2 pointer-events-none">
              <Bookmark size={16} />
            </label>
            <select
              id="select-bookmark"
              value=""
              onClick={() => {
                if (isPlaying) isUserFocusRef.current = true;
              }}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== '') {
                  jumpToIndex(parseInt(val));
                  forceControl(true, 'user');
                  e.target.blur();
                }
              }}
              className="cursor-pointer text-center text-transparent bg-transparent py-1 w-6!"
            >
              <option value="" disabled>
                {bookmarks.length > 0 ? 'Bookmarks' : 'No Bookmarks'}
              </option>
              {bookmarks.map((bookmark) => (
                <option key={`bookmark-${bookmark.index}`} value={bookmark.index} className="text-ellipsis">
                  {bookmark.text}({bookmark.index + 1})
                </option>
              ))}
            </select>
          </span>

          {/* Save Bookmarks to Local */}
          {FEATURES.ENABLE_BOOKMARK_EDIT ? (
            <button
              disabled={!book?.title || bookmarks.length === 0}
              onClick={() => {
                if (!book?.title || bookmarks.length === 0) return;
                const titleWithAuthor = bookTitleWithAuthor(book);
                if (!confirm(`Overwrite local bookmarks for ${titleWithAuthor}?`)) return;
                saveBookmarksToLocal(titleWithAuthor, bookmarks);
              }}
              title="Save bookmarks to local"
            >
              <Save size={16} />
            </button>
          ) : null}

          {/* Import Bookmarks */}
          {FEATURES.ENABLE_BOOKMARK_EDIT ? (
            <button
              disabled={!book?.title}
              onClick={async () => {
                if (!_id || !book?.title) return;
                const titleWithAuthor = bookTitleWithAuthor(book);
                if (!confirm(`Import bookmarks for ${titleWithAuthor} from last saved?`)) return;
                const merged = await importBookmarksFromLocal(_id, titleWithAuthor, bookmarks);
                if (!merged || merged.length === 0) return;
                setBookmarks(merged);
                alert(`Imported ${merged.length} bookmarks for ${titleWithAuthor}!`);
                setTimeout(() => {
                  console.log(`updatedBook, canUpdate :`, updatedBook, canUpdate);
                  flushUpdate();
                }, 100);
              }}
              title="Import bookmarks from last saved"
            >
              <BookmarkPlus size={16} />
            </button>
          ) : null}

          {/* Clear Bookmarks */}
          <button
            disabled={!book?.title || bookmarks.length === 0}
            onClick={() => {
              if (!confirm(`Deleted all ${bookmarks.length} bookmarks for [${book?.title}]?`)) return;
              setBookmarks([]);
            }}
            title={`Deleted all ${bookmarks.length} bookmarks for [${book.title}]`}
          >
            <BookmarkX size={16} />
          </button>
        </div>

        {/* Jump to Chapter */}
        {book?.chapters.length > 1 && (
          <div className="my-1 p-1! flex flex-col items-start gap-1 rounded-full shadow *:flex *:items-center *:py-1 *:bg-transparent [&>button:enabled]:hover:bg-amber-200 [&>button:enabled]:hover:text-gray-600 [&>button:disabled]:hover:transparent [&>button:disabled]:hover:text-default *:rounded-full!">
            <button
              id="prev-chapter"
              disabled={currentChapter === 0}
              onClick={() => {
                if (isPlaying) isUserFocusRef.current = true;
                const targetChapterIndex = Math.max(0, currentChapter - 1);
                jumpToIndex(book.chapters[targetChapterIndex].startIndex);
              }}
              title="Prev chapter"
            >
              <ListStart size={16} />
            </button>

            {/* Select Chapter */}
            <span title="Chapters" className="relative h-8 w-8 px-1">
              <label htmlFor="select-chapter" className="absolute top-1/2 -translate-y-1/2 left-2 pointer-events-none">
                <TableOfContents size={16} />
              </label>
              <select
                id="select-chapter"
                value={currentChapter}
                onClick={() => {
                  if (isPlaying) isUserFocusRef.current = true;
                }}
                onChange={async (e) => {
                  const targetChapterIndex = parseInt(e.target.value);
                  let targetLineIndex = book.chapters[targetChapterIndex].startIndex;
                  if (targetLineIndex === undefined) {
                    console.log(`🚰 JIT: Hydrating target chapter ${targetChapterIndex} before jump...`);

                    // This call should return the updated book with the new startIndex
                    const updatedBook = await hydrateChapterByIndex(targetChapterIndex);
                    if (updatedBook) targetLineIndex = updatedBook.chapters[targetChapterIndex].startIndex;
                  }
                  jumpToIndex(targetLineIndex);
                }}
                className="cursor-pointer text-center text-transparent bg-transparent py-1 w-6!"
              >
                {book.chapters
                  .filter((chapter) => chapter.isLoaded)
                  .map((chapter, index) => (
                    <option key={`chapter-${index}`} value={index} className="text-ellipsis">
                      {chapter.title}
                      {chapter.startIndex ? `(${chapter.startIndex})` : ''}
                    </option>
                  ))}
                {!book.chapters.at(-1)?.isLoaded && (
                  <option value="" disabled>
                    ... load more chapters
                  </option>
                )}
              </select>
            </span>

            <button
              id="next-chapter"
              disabled={currentChapter === book.chapters.length - 1}
              onClick={() => {
                if (isPlaying) isUserFocusRef.current = true;
                const targetChapterIndex = Math.min(currentChapter + 1, book.chapters.length - 1);
                jumpToIndex(book.chapters[targetChapterIndex].startIndex);
              }}
              title="Next chapter"
            >
              <ListEnd size={16} />
            </button>
          </div>
        )}

        {/* Text Size */}
        <div className="my-1 p-1! flex flex-col items-start gap-1 rounded-full shadow *:flex *:items-center *:py-1 *:bg-transparent [&>button:enabled]:hover:bg-amber-200 [&>button:enabled]:hover:text-gray-600 [&>button:disabled]:hover:transparent [&>button:disabled]:hover:text-default *:rounded-full!">
          <button id="text-size-up" onClick={() => setFontSize(fontSize + 1)} title="Text Size Up">
            <Plus size={16} />
          </button>

          <span title="Text Size" className="h-8 w-8 pl-2 text-xs bg-transparent! text-gray-600 cursor-default">
            {fontSize}
          </span>

          <button id="text-size-down" onClick={() => setFontSize(fontSize - 1)} title="Text Size Down">
            <Minus size={16} />
          </button>
        </div>

        {/* Play/Pause */}
        <button id={isPlaying ? 'pause' : 'play'} onClick={handlePlayPause} title={isPlaying ? 'Pause' : 'Play'} className={isPlaying ? 'text-gray-600' : 'text-green-600'}>
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        {/* Voice & Rate */}
        <div className="my-1 p-1! flex flex-col items-start gap-1 rounded-full shadow *:flex *:items-center *:py-1 *:bg-transparent *:hover:bg-amber-200 *:hover:text-gray-600 *:rounded-full!">
          {/* Select Voice */}
          <span title="Select Voice" className="relative h-8 w-8 px-1">
            <label htmlFor="select-voice" className="absolute top-1/2 -translate-y-1/2 left-2 pointer-events-none">
              <UsersRound size={16} />
            </label>
            <select
              id="select-voice"
              value={selectedVoice.id}
              onClick={() => {
                if (isPlaying) isUserFocusRef.current = true;
              }}
              onChange={(e) => {
                const found = availableVoices.find((voiceOption) => voiceOption.id === e.target.value);
                if (found) setSelectedVoice(found);
                speechService.stop();
                e.target.blur();
              }}
              className="cursor-pointer text-center text-transparent bg-transparent py-1 w-6!"
            >
              <option value="" disabled>
                Speech Voices
              </option>
              {availableVoices.map((voice) => (
                <option
                  key={`voice-${voice.id}`}
                  value={voice.id}
                  style={{
                    backgroundColor: voice.enabled ? '#fff' : 'gray',
                  }}
                >
                  {voice.displayName}
                </option>
              ))}
            </select>
          </span>

          {/* Select Speech Rate */}
          <span title="Speech Rate" className="relative h-8 w-8 px-1">
            <label htmlFor="select-rate" className="absolute top-1/2 -translate-y-1/2 left-2 pointer-events-none">
              <AudioLines size={16} />
            </label>
            <select
              id="select-rate"
              value={speechRate}
              onClick={() => {
                if (isPlaying) isUserFocusRef.current = true;
              }}
              onChange={(e) => {
                const newRate = parseFloat(e.target.value);
                setSpeechRate(newRate);

                toggleIndicatorMessage(renderRateIndicator(newRate));
                if (isPlaying) {
                  speechService.resume(currentLine, speechConfigs(newRate));
                }
                e.target.blur();
              }}
              className="cursor-pointer text-center text-transparent bg-transparent py-1 w-6!"
            >
              <option value="" disabled>
                Speech Rates
              </option>
              {SPEECH_RATE_OPTIONS.map((rate) => (
                <option key={`rate-${rate}`} value={rate}>
                  {rate}x
                </option>
              ))}
            </select>
          </span>
        </div>

        {/* Search text */}
        <button
          id="search"
          onClick={() => {
            searchInputRef.current?.focus();
            forceControl(true, 'user');
          }}
          title="Search text"
          className={searchText.length > 0 ? 'bg-amber-200! shadow-md' : 'bg-inherit gap-0!'}
        >
          <Search size={16} className={readingMode === 'user' ? 'text-gray-600' : 'text-inherit'} />
          {readingMode === 'user' && (
            <>
              <input
                id="search-text"
                name="search-text"
                type="text"
                ref={searchInputRef}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={async (e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) {
                      await prevMatch();
                    } else {
                      await nextMatch();
                    }
                  }
                  if (e.key === 'Escape') {
                    clearSearch();
                    setReadingMode(readingMode);
                  }
                }}
                className="h-4 outline-none text-gray-600"
                style={{
                  width: searchText.length > 0 ? `${Math.min(searchText.length, 20)}rem` : '0',
                }}
              />
              {searchText.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSearch();
                    setReadingMode(readingMode);
                  }}
                  className="p-0! text-gray-600 transition-colors"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
              {searchRes.length > 0 && (
                <div className={`flex items-center border-l pl-1 mx-1 text-xs text-gray-400/60 animate-in fade-in ${readingMode !== 'user' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {currentMatch + 1}/{searchRes.length}
                </div>
              )}
            </>
          )}
        </button>

        {/* Edit book */}
        {FEATURES.ENABLE_LINE_EDIT ? (
          <button
            id="edit-book"
            onClick={() => {
              if (readingMode !== 'edit') {
                forceControl(true, 'edit');
              } else {
                forceControl(false, 'focus');
              }
            }}
            title="Edit book"
            className={readingMode === 'edit' ? 'text-gray-600 bg-green-400!' : 'text-inherit bg-inherit'}
          >
            <ListX size={16} />
          </button>
        ) : null}

        <div className="my-1 p-1! flex flex-col items-start gap-1 rounded-full shadow *:flex *:items-center *:py-1 *:bg-transparent *:hover:bg-amber-200 *:hover:text-gray-600 *:rounded-full!">
          <span title={book?.title} className="h-8 w-8 pl-2 text-xs text-gray-600 bg-transparent! cursor-default">
            <BookIcon size={16} />
          </span>

          {/* Progress Indicator */}
          {book?.chapters.at(-1)?.isLoaded !== false ? (
            <span title={`Progress: Line ${currentLine} of ${totalLines}`} className="h-8 w-8 flex justify-center items-center text-xs text-gray-600 bg-transparent! cursor-default">
              {calculateProgress(currentLine, totalLines)}%
            </span>
          ) : null}

          {/* Nav back to books */}
          <button id="back-to-books" onClick={() => navigateBack()} title="Back to Books">
            <LibraryBig size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const renderRateIndicator = (rate: number) => (
  <>
    <AudioLines size={24} />
    <span className="font-semibold text-xl whitespace-nowrap">{rate}x</span>
  </>
);

const renderChapterIndicator = (chapter: Chapter) => {
  if (!chapter?.title) return <></>;

  return (
    <>
      <TableOfContents size={24} />
      <span className="font-semibold text-xl whitespace-nowrap">
        {chapter.title} ({chapter.startIndex})
      </span>
    </>
  );
};
