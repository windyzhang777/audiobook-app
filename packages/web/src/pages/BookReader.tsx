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
import { TextContextMenu } from '@/components/ui/ContextMenu';
import { BookContext, CommonContext, ContentContext, SearchContext, SettingContext, SpeechContext, ViewLineContext } from '@/config/contexts';
import { focusBody, getChapterIndex } from '@/utils';
import { bookTitleWithAuthor, type BookMark } from '@audiobook/shared';
import { Loader, Loader2 } from 'lucide-react';
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
  const { isPlaying, play, pause, resume, stop } = useBookSpeech(_id, lines, lang, totalLines, selectedVoice, rate, currentLine, setCurrentLine, loadMoreLines, onBookCompleted);

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

  const isViewLineVisibleRef = useRef(false);

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
      setCurrentLine((prev) => (prev !== index ? index : prev));
      startTimer(() => updateViewLine(index), 100);
      closeSearch();
      ttsScroll();
    },
    [setCurrentLine, startTimer, updateViewLine, closeSearch, ttsScroll],
  );

  const navigateBack = (replace: boolean = false) => {
    flushUpdate();
    navigate('/', { replace });
  };

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      let startFrom = shouldReadViewLineRef.current ? viewLineRef.current : currentLine;
      startFrom = startFrom >= totalLines ? 0 : startFrom; // if at the end, reset to start from the first line
      startFromLine(startFrom);

      startAnimationFrame(() => scrollToLine(startFrom));
      play(startFrom);
      shouldReadViewLineRef.current = false;
    }
    focusBody();
  }, [currentLine, startFromLine, isPlaying, startAnimationFrame, scrollToLine, totalLines, viewLineRef, shouldReadViewLineRef, play, pause]);

  const handleLineClick = (index: number) => {
    // if (readingMode === 'edit') return;
    startFromLine(index);
    if (isPlaying) {
      resume(index);
    } else {
      play(index);
    }
  };

  // cleanup on unmount
  useEffect(() => () => stop(), [_id, stop]);

  // tts autoscroll
  useEffect(() => {
    if (isUserScrollRef.current || !isPlaying) return;
    scrollToLine(currentLine, 'smooth');

    if (!isSearchJumpingRef.current && currentLine !== viewLine) startTimer(() => updateViewLine(currentLine), 100);
  }, [isPlaying, currentLine, scrollToLine, startTimer, isSearchJumpingRef, isUserScrollRef, viewLine, updateViewLine]);

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
        const index = Math.min(currentLine + 1, totalLines - 1);
        moveToLine(index);
      }

      if (activeElement === document.body && e.key === 'ArrowUp') {
        e.preventDefault();
        const index = Math.max(currentLine - 1, 0);
        moveToLine(index);
      }
    };

    const moveToLine = (index: number) => {
      if (index == currentLine) return;
      scrollToLine(index);
      startFromLine(index);
      if (isPlaying) stop();
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentLine, closeSearch, isPlaying, scrollToLine, startFromLine, totalLines, handlePlayPause, stop]);

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
      value={{ isPlaying, handlePlayPause, readingMode, jumpToIndex, jumpToRead: () => jumpToRead(currentLine), ttsScroll, userScroll, navigateBack, hydrateChapterByIndex, handleLineClick }}
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
                <SpeechContext.Provider value={{ isPlaying, play, pause, resume: () => resume(currentLine), stop }}>
                  <div className="min-h-full relative overflow-hidden">
                    <BookHeader setOpenPanelLeft={setOpenPanelLeft} setOpenPanelRight={setOpenPanelRight} toaster={toaster} />

                    <TextContextMenu />

                    {/* Start of Virtuoso */}
                    <Virtuoso
                      id="book-lines"
                      ref={virtuosoRef}
                      className="fixed top-22 leading-loose transition-transform duration-500 ease-in-out"
                      style={{ minHeight: 'calc(100vh - 5rem)' }}
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
                      rangeChanged={(range) => {
                        isViewLineVisibleRef.current = viewLineRef.current >= range.startIndex && viewLineRef.current <= range.endIndex;
                        // const centerIndex = Math.floor((range.startIndex + range.endIndex) / 2);
                        // if (isUserScrollRef.current && readingMode !== 'search') setViewLine(centerIndex);
                      }}
                      components={{
                        List: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ style, children, ...props }, ref) => (
                          <div
                            {...props}
                            ref={ref}
                            tabIndex={0}
                            onWheel={userScroll}
                            onTouchMove={userScroll}
                            className="top-20 outline-none list-none text-left mx-auto w-11/12 md:w-8/12"
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
