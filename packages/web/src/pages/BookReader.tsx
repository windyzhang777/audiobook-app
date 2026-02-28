import { useSearchBook } from '@/common/useSearchBook';
import { useUpdateBook } from '@/common/useUpdateBook';
import { triggerSuccess } from '@/helper';
import { api } from '@/services/api';
import { speechService, type SpeechConfigs } from '@/services/SpeechService';
import { calculateProgress, PAGE_SIZE, type Book, type BookContent, type BookMark, type SpeechOptions, type TextOptions } from '@audiobook/shared';
import { ArrowBigUp, ArrowLeft, AudioLines, Bookmark, BookmarkX, LibraryBig, Loader, Loader2, MapPin, Minus, Pause, Play, Plus, Search, UsersRound, X } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Virtuoso, type LocationOptions, type VirtuosoHandle } from 'react-virtuoso';

export type ReadingMode = 'user' | 'focus';

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
  const { id } = useParams<{ id: string }>();

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
  const [showRateIndicator, setShowRateIndicator] = useState(false);
  const [currentLine, setCurrentLine] = useState<Book['currentLine']>(0);
  const [fontSize, setFontSize] = useState<NonNullable<TextOptions['fontSize']>>(18);
  const [speechRate, setSpeechRate] = useState<NonNullable<SpeechOptions['rate']>>(1.0);
  const [voice, setVoice] = useState<VoiceOption['id']>();
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICE_FALLBACK);
  const [lastCompleted, setLastCompleted] = useState<string>();
  const [bookmarks, setBookmarks] = useState<BookMark[]>([]);
  const updatedBook = useMemo(
    () => ({
      currentLine,
      lastCompleted,
      bookmarks,
      settings: { ...(book?.settings || {}), fontSize, rate: speechRate, voice: selectedVoice.id },
    }),
    [book?.settings, currentLine, lastCompleted, bookmarks, fontSize, speechRate, selectedVoice.id],
  );
  const canUpdate = !loading && JSON.stringify(updatedBook) !== JSON.stringify({ currentLine: book?.currentLine, settings: book?.settings });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isUserScrollRef = useRef(true);
  const isUserFocusRef = useRef(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const isSearchJumping = useRef(false);
  const shouldResumeRef = useRef(false);
  const isFetchingRef = useRef(false);

  const speechConfigs = useCallback(
    (rate: number = speechRate): SpeechConfigs => ({ bookId: id || '', lines, lang, rate, totalLines, selectedVoice }),
    [id, lines, lang, totalLines, selectedVoice, speechRate],
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
      setReadingMode(readingMode);
    }
  };

  const scrollToLine = useCallback((index: number, behavior: LocationOptions['behavior'] = 'smooth') => {
    virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior });
  }, []);

  const handlePlayPause = () => {
    if (!id) return;

    if (isPlaying) {
      speechService.pause();
    } else {
      const startFrom = currentLine >= totalLines ? 0 : currentLine;
      // if at the end, reset to start from the first line
      if (startFrom === 0) setCurrentLine(0);

      speechService.start(startFrom, speechConfigs());
    }
  };

  const handleLineClick = (lineIndex: number) => {
    forceControl(false, 'focus');
    setCurrentLine(lineIndex);
    speechService.stop();
    clearSearch();
  };

  const jumpToRead = (mode: ReadingMode = 'focus') => {
    forceControl(false, mode);
    scrollToLine(currentLine, 'auto');
  };

  const jumpToIndex = async (lineIndex: number = currentLine) => {
    if (!id) return;

    isSearchJumping.current = true;
    if (lineIndex >= lines.length) {
      await loadMoreLines(0, lineIndex);
    }
    scrollToLine(lineIndex, 'auto');
    setTimeout(() => {
      isSearchJumping.current = false;
    }, 500);
  };

  const loadBookContent = async (id: string, offset: number = 0, limit: number = PAGE_SIZE) => {
    const content = await api.books.getContent(id, offset, limit);
    if (!content) return;

    setLines((prev) => (offset === 0 ? content.lines : [...prev, ...content.lines]));
    setLang(content.lang);
    setTotalLines(content.pagination.total);
    setHasMore(content.pagination.hasMore);
  };

  const loadMoreLines = useCallback(
    async (offset: number = 0, limit: number = PAGE_SIZE) => {
      if (!hasMore || !id || loadingMore || isFetchingRef.current) return;

      isFetchingRef.current = true;
      setLoadingMore(true);
      try {
        await loadBookContent(id, offset, limit);
      } finally {
        setLoadingMore(false);
        isFetchingRef.current = false;
      }
    },
    [hasMore, id, loadingMore],
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

  const { flushUpdate } = useUpdateBook(id, updatedBook, canUpdate, setBook);
  const { searchInputRef, searchText, setSearchText, searchRes, currentMatch, prevMatch, nextMatch, clearSearch } = useSearchBook(id, currentLine, jumpToIndex, forceControl);

  useEffect(() => {
    if (!id) return;

    const loadBook = async (id: string) => {
      try {
        const book = await api.books.getById(id);
        if (!book) return;

        setBook(book);
        setCurrentLine(book.currentLine || 0);
        setFontSize(book.settings?.fontSize || 18);
        setSpeechRate(book.settings?.rate || 1.0);
        setVoice(book.settings?.voice || VOICE_FALLBACK.id);
        setLastCompleted(book.lastCompleted || undefined);
        setBookmarks(book.bookmarks || []);

        await loadBookContent(id, 0, (book.currentLine || 0) + PAGE_SIZE);
      } catch (error) {
        setError('Failed to load book');
        console.error('Failed to load book: ', error);
      } finally {
        setLoading(false);
      }
    };

    loadBook(id);

    return () => {
      speechService.stop();

      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [id]);

  useEffect(() => {
    speechService.onLineEnd = (lineIndex) => setCurrentLine(lineIndex);
    speechService.onIsPlayingChange = (playing) => setIsPlaying(playing);
    speechService.onLoadMoreLines = (linesIndex) => {
      shouldResumeRef.current = true;
      loadMoreLines(linesIndex);
    };
    speechService.onBookCompleted = (date) => {
      if (!lastCompleted) triggerSuccess();
      setLastCompleted(date);
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
    };

    const moveToLine = (lineIndex: number) => {
      if (lineIndex == currentLine) return;

      forceControl(false, 'focus');
      scrollToLine(currentLine, 'auto');
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
          if (!hasMore || loadingMore || isSearchJumping.current) return;
          if (index < lines.length - 1) return;
          loadMoreLines(lines.length);
        }}
        atBottomStateChange={(atBottom) => {
          if (!atBottom || !hasMore || loadingMore) return;
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
              <h3 className="font-semibold">{book.title}</h3>
            </header>
          ),
          List: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ style, children, ...props }, ref) => (
            <div
              {...props}
              ref={ref}
              tabIndex={0}
              onWheel={() => forceControl(true, 'focus')}
              onTouchMove={() => forceControl(true, 'focus')}
              className="outline-none list-none text-left pl-14 pr-11"
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
                  &nbsp;Loading more lines...
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

          return (
            <li
              key={`line-${index}`}
              role="button"
              tabIndex={index === currentLine ? 0 : -1}
              aria-current={index === currentLine ? 'location' : undefined}
              onContextMenu={(e) => {
                e.preventDefault();
                toggleBookmark(index, line);
              }}
              onDoubleClick={() => handleLineClick(index)}
              className={`group relative cursor-pointer my-1 px-2 transition-colors duration-200 ease-in-out rounded-lg ${index === currentLine ? 'bg-amber-100 font-medium' : 'hover:bg-gray-50'} focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-opacity-50 ${isBookmarked ? 'border border-r-4 border-amber-400 pr-2' : 'border-r-4 border-transparent'}`}
            >
              {searchText ? getHighlightedText(line, searchText) : line}
              <button
                aria-label={`${isBookmarked ? 'Remove' : 'Add'} bookmark for line ${index + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBookmark(index, line);
                }}
                title={isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
                className={`absolute -right-9 top-0 text-amber-400 hover:opacity-100 transition-opacity duration-150 ${isBookmarked ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}
              >
                <Bookmark size={16} fill="currentColor" />
              </button>
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

      {/* Rate Indicator */}
      <div
        id="rate-indicator"
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4 justify-center items-center rounded-2xl p-6 z-10 pointer-events-none bg-amber-200 backdrop-blur-mg shadow-lg transition-all duration-300 ease-out ${showRateIndicator ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
      >
        <AudioLines size={24} />
        <span className="font-semibold text-xl">{speechRate}x</span>
      </div>

      {/* Control Panel */}
      <div
        id="control-panel"
        className="fixed top-1/2 -translate-y-1/2 left-2 h-auto text-sm text-gray-400 flex flex-col items-start gap-1 rounded-full bg-transparent z-10 *:flex *:items-center [&>button]:ml-1! [&>button]:bg-transparent [&>button]:hover:bg-amber-200 [&>button]:hover:text-gray-600 [&>button]:rounded-full! select-none"
      >
        <div className="my-1 p-1! flex flex-col items-start gap-1 rounded-full shadow *:flex *:items-center *:py-1 *:bg-transparent [&>button]:hover:bg-amber-200 [&>button]:hover:text-gray-600 *:rounded-full!">
          {/* Jump to start */}
          <button
            id="jump-to-top"
            title="Jump To Top"
            onClick={() => {
              jumpToIndex(0);
              forceControl(true, 'user');
            }}
            className={showJumpButton ? 'text-gray-600!' : 'text-inherit'}
          >
            <ArrowBigUp size={16} />
          </button>

          {/* Jump to read button */}
          <button id="jump-to-read" title="Jump To Read" onClick={() => jumpToRead('focus')} className={showJumpButton ? 'text-gray-600!' : 'text-inherit'}>
            <MapPin size={16} />
          </button>
        </div>

        {/* Play/Pause */}
        <button id={isPlaying ? 'pause' : 'play'} onClick={handlePlayPause} title={isPlaying ? 'Pause' : 'Play'} className={isPlaying ? 'text-gray-600' : 'text-green-600'}>
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        {/* Text Size */}
        <div className="my-1 p-1! flex flex-col items-start gap-1 rounded-full shadow *:flex *:items-center *:py-1 *:bg-transparent [&>button]:hover:bg-amber-200 [&>button]:hover:text-gray-600 *:rounded-full!">
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

                // Rate Indicator (Debounced)
                if (timerRef.current) clearTimeout(timerRef.current);
                setShowRateIndicator(true);
                timerRef.current = setTimeout(() => {
                  setShowRateIndicator(false);
                }, 1200);

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
                  Line {bookmark.index + 1}: {bookmark.text}
                </option>
              ))}
            </select>
          </span>

          {/* Clear Bookmarks */}
          <button
            disabled={bookmarks.length === 0}
            onClick={() => {
              if (!confirm('Deleted all bookmarks?')) return;
              setBookmarks([]);
            }}
            title="Remove all bookmarks"
          >
            <BookmarkX size={16} />
          </button>
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

        <span title={`Progress: Line ${currentLine} of ${totalLines}`} className="h-8 w-8 ml-2 text-xs text-gray-600 bg-transparent! cursor-default">
          {calculateProgress(currentLine, totalLines)}%
        </span>

        {/* Nav back to books */}
        <button id="back-to-books" onClick={() => navigateBack()} title="Back to Books">
          <LibraryBig size={16} />
        </button>
      </div>
    </div>
  );
};
