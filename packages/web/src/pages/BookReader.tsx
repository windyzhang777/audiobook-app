import { useAnimationFrame } from '@/common/useAnimationFrame';
import useBookNavigation from '@/common/useBookNavigation';
import { useBookReader } from '@/common/useBookReader';
import { useBookSearch } from '@/common/useBookSearch';
import { useReaderSettings } from '@/common/useBookSettings';
import useBookSpeech from '@/common/useBookSpeech';
import useTimer from '@/common/useTimer';
import { BookControl } from '@/components/BookReader/BookControl';
import { BookHeader } from '@/components/BookReader/BookHeader';
import { BookLine } from '@/components/BookReader/BookLine';
import { SidePanelLeft, SidePanelRight } from '@/components/BookReader/BookSidePanel';
import { Button } from '@/components/ui/button';
import { TextContextMenu } from '@/components/ui/ContextMenu';
import { BookContext, CommonContext, ContentContext, SearchContext, SettingContext, SpeechContext, ViewLineContext } from '@/config/contexts';
import { focusBody, getChapterIndex } from '@/utils';
import { bookTitleWithAuthor, type BookMark } from '@audiobook/shared';
import { ChevronRight, Loader, Loader2 } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';

export type ReadingMode = 'tts' | 'search' | 'edit';

export const BookReader = () => {
  const navigate = useNavigate();
  const { id: _id } = useParams<{ id: string }>();

  const [readingMode, setReadingMode] = useState<ReadingMode>('tts');

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
    updateCurrentLine,
    currentLineRef,
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
    paragraphSpacing,
    setParagraphSpacing,
    indent,
    setIndent,
    alignment,
    setAlignment,
    flushSetting,
    availableVoices,
  } = useReaderSettings(_id, lang);

  // navigation hook
  const { viewLine, updateViewLine, viewLineRef, virtuosoRef, isSearchJumpingRef, shouldReadViewLineRef, isUserScrollRef, userScroll, ttsScroll, scrollToLine, jumpToRead, jumpToIndex } =
    useBookNavigation(lines, loadMoreLines);

  // speech hook
  const { isPlaying, play, pause, resume, stop } = useBookSpeech(_id, lines, lang, totalLines, selectedVoice, rate, currentLine, updateCurrentLine, loadMoreLines, onBookCompleted);

  // search hook
  const { searchInputRef, searchText, setSearchText, searchRes, currentMatch, clickMatch, prevMatch, nextMatch, openSearch, closeSearch } = useBookSearch(
    _id,
    viewLine,
    jumpToIndex,
    () => setReadingMode('search'),
    () => setReadingMode('tts'),
  );

  const [openPanelLeft, setOpenPanelLeft] = useState(true);
  const [openPanelRight, setOpenPanelRight] = useState(readingMode === 'search' ? searchRes.length > 0 : true);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const [isCurrentLineVisible, setIsCurrentLineVisible] = useState(false);
  const isCurrentLineVisibleRef = useRef(false);

  const viewChapter = useMemo(() => {
    if (!chapters) return undefined;
    const chapterIndex = getChapterIndex(viewLine, chapters);
    const chapter = chapters[chapterIndex];
    if (!chapter) return undefined;
    return { chapterIndex, ...chapter };
  }, [viewLine, chapters]);

  const loading = useMemo(() => !_id || loadingBook || loadingSetting, [_id, loadingBook, loadingSetting]);

  const flushUpdate = () => {
    flushBook();
    flushSetting();
  };

  const startFromLine = useCallback(
    (index: number) => {
      updateCurrentLine(index);
      updateViewLine(index);
    },
    [updateCurrentLine, updateViewLine],
  );

  const ttsFocus = useCallback(() => {
    closeSearch();
    ttsScroll();
  }, [closeSearch, ttsScroll]);

  const navigateBack = (replace: boolean = false) => {
    flushUpdate();
    navigate('/', { replace });
  };

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      let startFrom = shouldReadViewLineRef.current ? viewLineRef.current : currentLineRef.current;
      startFrom = startFrom >= totalLines ? 0 : startFrom; // if at the end, reset to start from the first line
      startFromLine(startFrom);
      ttsFocus();

      startAnimationFrame(() => scrollToLine(startFrom));
      play(startFrom);
      shouldReadViewLineRef.current = false;
    }
    focusBody();
  }, [currentLineRef, viewLineRef, startFromLine, ttsFocus, isPlaying, startAnimationFrame, scrollToLine, totalLines, shouldReadViewLineRef, play, pause]);

  const handleLineClick = (index: number) => {
    // if (readingMode === 'edit') return;
    startFromLine(index);
    scrollToLine(currentLine, 'smooth');
    ttsFocus();
    if (isPlaying) {
      resume(index);
    } else {
      play(index);
    }
  };

  const moveToLine = useCallback(
    (index: number) => {
      if (index == currentLineRef.current) return;
      scrollToLine(index);
      startFromLine(index);
      ttsFocus();
      if (isPlaying) stop();
    },
    [currentLineRef, isPlaying, scrollToLine, startFromLine, ttsFocus, stop],
  );

  const prevLine = useCallback(() => {
    const index = Math.max(currentLineRef.current - 1, 0);
    moveToLine(index);
  }, [currentLineRef, moveToLine]);

  const nextLine = useCallback(() => {
    const index = Math.min(currentLineRef.current + 1, totalLines - 1);
    moveToLine(index);
  }, [currentLineRef, totalLines, moveToLine]);

  const checkLineVisibility = useCallback((index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const target = scroller.querySelector(`[data-item-index="${index}"]`);
    if (!target) return false;

    const scrollerRect = scroller.getBoundingClientRect();
    const itemRect = target.getBoundingClientRect();
    const isVisible = itemRect.top >= scrollerRect.top && itemRect.bottom <= scrollerRect.bottom;
    return isVisible;
  }, []);

  // cleanup on unmount
  useEffect(() => () => stop(), [_id, stop]);

  // tts autoscroll
  useEffect(() => {
    const isVisible = checkLineVisibility(currentLine);
    isCurrentLineVisibleRef.current = isVisible || false;
    if (isCurrentLineVisibleRef.current !== isCurrentLineVisible) {
      startTimer(() => setIsCurrentLineVisible(isCurrentLineVisibleRef.current));
    }

    if (isUserScrollRef.current || isVisible || !isPlaying) return;
    scrollToLine(currentLine, 'smooth');

    if (!isSearchJumpingRef.current && currentLine !== viewLineRef.current) {
      startTimer(() => updateViewLine(currentLine), 100);
    }
  }, [checkLineVisibility, isCurrentLineVisible, isPlaying, currentLine, viewLineRef, scrollToLine, startTimer, isSearchJumpingRef, isUserScrollRef, updateViewLine]);

  // hijack the browser's default scroll
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      // console.log(`activeElement :`, activeElement);

      if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
        return;
      }

      if (activeElement === document.body && e.key === ' ') {
        e.preventDefault();
        handlePlayPause();
      }

      if (activeElement === document.body && e.key === 'ArrowDown') {
        e.preventDefault();
        nextLine();
      }

      if (activeElement === document.body && e.key === 'ArrowUp') {
        e.preventDefault();
        prevLine();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [closeSearch, handlePlayPause, nextLine, prevLine]);

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
        isPlaying,
        handlePlayPause,
        readingMode,
        jumpToIndex,
        jumpToRead: () => jumpToRead(currentLineRef.current),
        ttsScroll,
        userScroll,
        navigateBack,
        hydrateChapterByIndex,
        handleLineClick,
        prevLine,
        nextLine,
      }}
    >
      <ViewLineContext.Provider value={{ viewLine, updateViewLine }}>
        <BookContext.Provider
          value={{
            _id,
            currentLine,
            totalLines,
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
            viewChapter,
            book,
            deleteLine,
            restoreLine,
          }}
        >
          <ContentContext.Provider value={{ lines, lang, hasMore }}>
            <SearchContext.Provider value={{ searchInputRef, searchText, setSearchText, searchRes, currentMatch, clickMatch, prevMatch, nextMatch, openSearch, closeSearch }}>
              <SettingContext.Provider
                value={{
                  fontSize,
                  setFontSize,
                  rate,
                  setRate,
                  setVoice,
                  selectedVoice,
                  lineHeight,
                  setLineHeight,
                  paragraphSpacing,
                  setParagraphSpacing,
                  indent,
                  setIndent,
                  alignment,
                  setAlignment,
                  availableVoices,
                }}
              >
                <SpeechContext.Provider value={{ isPlaying, play, pause, resume: () => resume(currentLineRef.current), stop }}>
                  <div className="h-full relative">
                    <div className="flex flex-col h-full overflow-hidden">
                      <BookHeader setOpenPanelLeft={setOpenPanelLeft} setOpenPanelRight={setOpenPanelRight} toaster={toaster} />

                      {/* Start of Virtuoso */}
                      <Virtuoso
                        id="book-lines"
                        ref={virtuosoRef}
                        scrollerRef={(el) => (scrollerRef.current = el as HTMLElement)}
                        className="flex-1 leading-loose transition-transform duration-500 ease-in-out"
                        data={lines}
                        initialTopMostItemIndex={{ index: 0, align: 'center' }}
                        increaseViewportBy={200}
                        endReached={(index) => {
                          if (!canFetch || isFetchingRef.current || isSearchJumpingRef.current) return;
                          if (index < lines.length - 1) return;
                          loadMoreLines(lines.length);
                        }}
                        atBottomStateChange={(atBottom) => {
                          if (!canFetch || isFetchingRef.current || !atBottom) return;
                          loadMoreLines(lines.length);
                        }}
                        // rangeChanged={onRangeChange}
                        components={{
                          List: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ style, children, ...props }, ref) => (
                            <div
                              {...props}
                              ref={ref}
                              tabIndex={0}
                              onWheel={userScroll}
                              onTouchMove={userScroll}
                              className="outline-none list-none text-left mx-auto w-11/12 md:w-8/12"
                              style={{ ...style, fontSize, lineHeight, textAlign: alignment, paddingLeft: indent + 'ch', paddingRight: indent + 'ch' }}
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
                      {/* End of Virtuoso */}
                    </div>

                    <BookControl />
                    <TextContextMenu />

                    {/* Indicator Message */}
                    {!isCurrentLineVisible && (
                      <Button
                        variant="ghost"
                        id="indicator-message"
                        onClick={() => jumpToRead(currentLineRef.current)}
                        className="z-20 w-[40%] p-2 truncate absolute top-25 left-1/2 -translate-x-1/2 px-4 py-1 text-sm justify-start bg-highlight"
                      >
                        <ChevronRight size={12} />
                        <span className="w-full truncate">{lines[currentLine]}</span>
                      </Button>
                    )}

                    {/* Left Panel */}
                    <SidePanelLeft
                      open={openPanelLeft}
                      onClose={() => setOpenPanelLeft(false)}
                      onUpdateBookmark={(merged: BookMark[]) => {
                        setBookmarks(merged);
                        alert(`Imported ${merged.length} bookmarks for ${bookTitleWithAuthor(book)}!`);
                        setTimeout(() => {
                          flushUpdate();
                        }, 100);
                      }}
                    />

                    {/* Right Panel */}
                    <SidePanelRight
                      open={openPanelRight}
                      onClose={() => {
                        closeSearch();
                        setOpenPanelRight(false);
                      }}
                    />
                  </div>
                </SpeechContext.Provider>
              </SettingContext.Provider>
            </SearchContext.Provider>
          </ContentContext.Provider>
        </BookContext.Provider>
      </ViewLineContext.Provider>
    </CommonContext.Provider>
  );
};
