import { useAnimationFrame } from '@/common/useAnimationFrame';
import useBookNavigation from '@/common/useBookNavigation';
import { useBookReader } from '@/common/useBookReader';
import { useBookSearch } from '@/common/useBookSearch';
import { useReaderSettings } from '@/common/useBookSettings';
import useBookSpeech from '@/common/useBookSpeech';
import useTimer from '@/common/useTimer';
import { BookHeader } from '@/components/BookReader/BookHeader';
import { BookLine } from '@/components/BookReader/BookLine';
import { SidePanelLeft, SidePanelRight } from '@/components/BookReader/BookSidePanel';
import { Button } from '@/components/ui/button';
import { BookContext, CommonContext, SearchContext, SettingContext, SpeechContext } from '@/config/contexts';
import { focusBody, getChapterIndex } from '@/utils';
import { bookTitleWithAuthor, calculateProgress, type BookMark } from '@audiobook/shared';
import { Loader, Loader2 } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';

export type ReadingMode = 'tts' | 'search' | 'edit';

export const BookReader = () => {
  const navigate = useNavigate();
  const { id: _id } = useParams<{ id: string }>();

  const [readingMode, setReadingMode] = useState<ReadingMode>('tts');
  const [openPanelLeft, setOpenPanelLeft] = useState(false);
  const [openPanelRight, setOpenPanelRight] = useState(true);

  // timer hook
  const { startTimer } = useTimer();
  const { startAnimationFrame } = useAnimationFrame();

  // data hooks
  const {
    loading: loadingBook,
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
    onBookCompleted,
    canFetch,
    flushBook,
    hydrateChapterByIndex,
    loadMoreLines,
    deleteLine,
  } = useBookReader(_id);

  const {
    loading: loadingSetting,
    fontSize,
    setFontSize,
    rate,
    setRate,
    setVoice,
    selectedVoice,
    lineHeight,
    setLineHeight,
    indent,
    setIndent,
    alignment,
    setAlignment,
    flushSetting,
    availableVoices,
  } = useReaderSettings(_id, lang);

  // navigation hook
  const { viewLine, setViewLine, virtuosoRef, isSearchJumpingRef, isViewLineVisibleRef, shouldReadViewLineRef, isUserScrollRef, userScroll, ttsScroll, scrollToLine, jumpToRead, jumpToIndex } =
    useBookNavigation(lines, loadMoreLines);

  // speech hook
  const { isPlaying, play, pause, resume, stop } = useBookSpeech(_id, lines, lang, totalLines, selectedVoice, rate, currentLine, setCurrentLine, (index) => loadMoreLines(index), onBookCompleted);

  // search hook
  const { searchInputRef, searchText, setSearchText, searchRes, currentMatch, prevMatch, nextMatch, openSearch, clearSearch } = useBookSearch(_id, viewLine, jumpToIndex, () => {
    userScroll();
    setReadingMode('search');
  });

  const viewChapter = useMemo(() => {
    const chapters = book?.chapters;
    if (!chapters) return undefined;
    const chapterIndex = getChapterIndex(viewLine, chapters);
    const chapter = chapters[chapterIndex];
    if (!chapter) return undefined;
    return { chapterIndex, ...chapter };
  }, [viewLine, book?.chapters]);

  const loading = useMemo(() => !_id || loadingBook || loadingSetting, [_id, loadingBook, loadingSetting]);

  const flushUpdate = () => {
    flushBook();
    flushSetting();
  };

  const startFromLine = useCallback(
    (index: number) => {
      setCurrentLine((prev) => (prev !== index ? index : prev));
      setViewLine((prev) => (prev !== index ? index : prev));
      ttsScroll();
    },
    [setCurrentLine, setViewLine, ttsScroll],
  );

  const navigateBack = (replace: boolean = false) => {
    flushUpdate();
    navigate('/', { replace });
  };

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      let startFrom = shouldReadViewLineRef.current ? viewLine : currentLine;
      startFrom = startFrom >= totalLines ? 0 : startFrom; // if at the end, reset to start from the first line
      startFromLine(startFrom);

      startAnimationFrame(() => scrollToLine(startFrom, 'auto'));
      play(startFrom);
      shouldReadViewLineRef.current = false;
    }
  }, [currentLine, startFromLine, isPlaying, startAnimationFrame, scrollToLine, totalLines, viewLine, shouldReadViewLineRef, play, pause]);

  const handleLineClick = (index: number) => {
    // if (readingMode === 'edit') return;
    startFromLine(index);
    stop();
  };

  // cleanup on unmount
  useEffect(() => () => stop(), [_id, stop]);

  // tts autoscroll
  useEffect(() => {
    if (isUserScrollRef.current || !isPlaying) return;
    scrollToLine(currentLine, 'smooth');

    startTimer(() => setViewLine((prev) => (!isSearchJumpingRef.current && currentLine !== prev ? currentLine : prev)));
  }, [isPlaying, currentLine, scrollToLine, startTimer, isSearchJumpingRef, isUserScrollRef, setViewLine]);

  // hijack the browser's default scroll
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;

      if (e.key === 'Escape') {
        e.preventDefault();
        ttsScroll();
        focusBody();
        return;
      }

      if (activeElement !== document.body) return;

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

    const moveToLine = (index: number) => {
      if (index == currentLine) return;

      scrollToLine(index, 'auto');
      startFromLine(index);

      if (isPlaying) resume(index);
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentLine, startFromLine, totalLines, handlePlayPause, scrollToLine, ttsScroll, isPlaying, resume]);

  if (loading) {
    return (
      <div aria-label="loading" className="min-h-full flex justify-center items-center gap-2">
        <Loader />
      </div>
    );
  }

  if (!_id || !book) {
    return (
      <div className="absolute top-0 left-0 h-full w-full bg-white opacity-50 flex flex-col justify-center items-center gap-2">
        <Button onClick={() => navigateBack(true)}>Go Back</Button>
      </div>
    );
  }

  return (
    <CommonContext.Provider
      value={{
        viewLine,
        isPlaying,
        handlePlayPause,
        readingMode,
        setReadingMode,
        jumpToIndex,
        jumpToRead: () => jumpToRead(currentLine),
        userScroll,
        navigateBack,
        hydrateChapterByIndex,
        handleLineClick,
      }}
    >
      <BookContext.Provider value={{ _id, currentLine, totalLines, lastCompleted, bookmarks, setBookmarks, viewChapter, book, toggleBookmark, deleteLine }}>
        <SearchContext.Provider value={{ searchInputRef, searchText, setSearchText, searchRes, currentMatch, prevMatch, nextMatch, openSearch, clearSearch }}>
          <SettingContext.Provider value={{ fontSize, setFontSize, rate, setRate, setVoice, selectedVoice, lineHeight, setLineHeight, indent, setIndent, alignment, setAlignment, availableVoices }}>
            <SpeechContext.Provider value={{ isPlaying, play, pause, resume: () => resume(currentLine), stop }}>
              <div className="min-h-full relative overflow-hidden">
                <BookHeader setOpenPanelLeft={setOpenPanelLeft} setOpenPanelRight={setOpenPanelRight} />

                {/* Book Lines */}
                <Virtuoso
                  id="book-lines"
                  ref={virtuosoRef}
                  className="fixed top-20 leading-loose transition-transform duration-500 ease-in-out"
                  style={{ minHeight: 'calc(100vh - 5rem)' }}
                  data={lines}
                  initialTopMostItemIndex={{ index: 0, align: 'center' }}
                  increaseViewportBy={200}
                  endReached={(index) => {
                    if (!canFetch || isSearchJumpingRef.current) return;
                    if (index < lines.length - 1) return;
                    loadMoreLines(lines.length);
                  }}
                  atBottomStateChange={(atBottom) => {
                    if (!canFetch || !atBottom) return;
                    loadMoreLines(lines.length);
                  }}
                  rangeChanged={(range) => {
                    isViewLineVisibleRef.current = viewLine >= range.startIndex && viewLine <= range.endIndex;
                  }}
                  components={{
                    List: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ style, children, ...props }, ref) => (
                      <div
                        {...props}
                        ref={ref}
                        tabIndex={0}
                        onWheel={() => {
                          userScroll();
                          setReadingMode('tts');
                        }}
                        onTouchMove={() => {
                          userScroll();
                          setReadingMode('tts');
                        }}
                        className="top-20 outline-none list-none text-left mx-auto md:w-4/7"
                        style={{ ...style, fontSize, lineHeight, textAlign: alignment, width: `calc(4 / 7 * 100% - ${indent}ch)` }}
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
                  itemContent={(index, line) => <BookLine index={index} line={line} />}
                />

                {/* Scrollbar Marker */}
                <div id="scrollbar-marker" className="absolute top-20 right-0.5 w-3 pointer-events-none z-10 transition-transform duration-500 ease-in-out" style={{ minHeight: 'calc(100vh - 5rem)' }}>
                  <Button
                    variant="ghost"
                    tabIndex={-1}
                    onClick={() => jumpToRead(currentLine)}
                    title="Jump to read"
                    className={`absolute right-0 w-full h-1 rounded-full bg-highlight cursor-pointer pointer-events-auto transition-all duration-300 p-0! hover:scale-125`}
                    style={{
                      top: `${calculateProgress(currentLine, lines.length - 1)}%`,
                      transform: 'translateY(-50%)',
                    }}
                  />
                </div>

                {/* Left Panel */}
                <SidePanelLeft
                  open={openPanelLeft}
                  onOpenChange={() => setOpenPanelLeft(false)}
                  onUpdateBookmark={(merged: BookMark[]) => {
                    setBookmarks(merged);
                    alert(`Imported ${merged.length} bookmarks for ${bookTitleWithAuthor(book)}!`);
                    setTimeout(() => {
                      flushUpdate();
                    }, 100);
                  }}
                />

                {/* Right Panel */}
                <SidePanelRight open={openPanelRight} onOpenChange={() => setOpenPanelRight(false)} />
              </div>
            </SpeechContext.Provider>
          </SettingContext.Provider>
        </SearchContext.Provider>
      </BookContext.Provider>
    </CommonContext.Provider>
  );
};
