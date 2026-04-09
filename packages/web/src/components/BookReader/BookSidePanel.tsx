import { useSaveToLocal } from '@/common/useSaveToLocal';
import useScroll from '@/common/useScroll';
import useToaster from '@/common/useToaster';
import { Button } from '@/components//ui/button';
import { useTheme } from '@/components/theme-provider';
import { ButtonGroup } from '@/components/ui/button-group';
import { SidePanel } from '@/components/ui/SidePanel';
import { Slider } from '@/components/ui/slider';
import { useBookContext, useCommonContext, useContentContext, useSearchContext, useSettingContext, useSpeechContext } from '@/config/contexts';
import { FEATURES } from '@/config/features';
import { cn } from '@/lib/utils';
import {
  bookTitleWithAuthor,
  DELETE_MARKER,
  FONT_SIZE_DEFAULT,
  FONT_SIZE_STEP,
  INDENT_DEFAULT,
  INDENT_STEP,
  LINE_HEIGHT_DEFAULT,
  LINE_HEIGHT_STEP,
  MAX_FONT_SIZE,
  MAX_INDENT,
  MAX_LINE_HEIGHT,
  MAX_RATE,
  MIN_FONT_SIZE,
  MIN_INDENT,
  MIN_LINE_HEIGHT,
  MIN_RATE,
  RATE_DEFAULT,
  RATE_STEP,
  removeMarker,
  type BookMark,
  type Chapter,
} from '@audiobook/shared';
import {
  AArrowDown,
  AArrowUp,
  AudioLines,
  Bookmark,
  BookmarkX,
  CaseSensitive,
  Eraser,
  FastForward,
  Headphones,
  Highlighter,
  ListChevronsDownUp,
  ListChevronsUpDown,
  ListIndentDecrease,
  ListIndentIncrease,
  Minus,
  Moon,
  Plus,
  Rewind,
  Save,
  SquareArrowDown,
  SquareArrowUp,
  Sun,
  TableOfContents,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface BookSidePanelProps {
  open: boolean;
  onClose: () => void;
}

interface SidePanelLeftProps extends BookSidePanelProps {
  onUpdateBookmark: (merged: BookMark[]) => void;
}

export const SidePanelLeft = ({ open, onClose, onUpdateBookmark }: SidePanelLeftProps) => {
  const { book, chapters, bookmarks, viewChapter, highlights } = useBookContext();
  const showChapters = useMemo(() => chapters?.length > 1, [chapters]);
  const [index, setIndex] = useState(showChapters ? 0 : 1);
  const [selectedBookmark, setSelectedBookmark] = useState<number>();
  const [selectedHighlight, setSelectedHighlight] = useState<number>();
  const { listRef, isAtTop, isAtBottom, onScroll, scrollToView, scrollToTop, scrollToBottom } = useScroll();

  const { setBookmarks, setHighlights } = useBookContext();
  const { hydrateChapterByIndex, jumpToIndex } = useCommonContext();
  const { saveBookmarksToLocal, importBookmarksFromLocal } = useSaveToLocal();

  const selectTab = (index: number) => {
    setIndex(index);
    setSelectedBookmark(undefined);
  };

  return (
    <SidePanel direction="left" open={open} onClose={onClose}>
      <div className="px-2 relative flex flex-wrap mb-2 md:justify-start items-center text-sm text-muted-foreground">
        <Button size="icon" variant={index === 0 ? 'default' : 'outline'} onClick={() => selectTab(0)} disabled={!showChapters} title="Chapters">
          <TableOfContents />
        </Button>
        <Button size="icon" variant={index === 1 ? 'default' : 'outline'} onClick={() => selectTab(1)} title="Bookmarks">
          <Bookmark />
        </Button>
        <Button size="icon" variant={index === 2 ? 'default' : 'outline'} onClick={() => selectTab(2)} title="Highlights">
          <Highlighter />
        </Button>
      </div>

      <div aria-label="jump buttons" className="mx-2.5 mb-4 px-1 rounded-sm flex flex-wrap md:justify-end items-center gap-1 md:flex-row [&_button]:my-1 [&_button]:p-0! [&_button]:w-6 [&_button]:h-6">
        {/* Bookmarks feature buttons */}
        {index === 1 && (
          <>
            {/* Save Bookmarks to Local */}
            {FEATURES.ENABLE_BOOKMARK_EDIT && (
              <Button
                size="icon"
                variant="ghost"
                disabled={bookmarks?.length === 0}
                onClick={() => {
                  if (!book || !bookmarks || bookmarks?.length === 0) return;
                  const titleWithAuthor = bookTitleWithAuthor(book);
                  if (!confirm(`Overwrite local bookmarks for ${titleWithAuthor}?`)) return;
                  saveBookmarksToLocal(titleWithAuthor, bookmarks);
                }}
                title="Save bookmarks to local"
              >
                <Save />
              </Button>
            )}

            {/* Import Bookmarks */}
            {FEATURES.ENABLE_BOOKMARK_EDIT && (
              <Button
                size="icon"
                variant="ghost"
                disabled={!book?.title}
                onClick={async () => {
                  if (!book?._id || !book?.title) return;
                  const titleWithAuthor = bookTitleWithAuthor(book);
                  if (!confirm(`Import bookmarks for ${titleWithAuthor} from last saved?`)) return;
                  const merged = await importBookmarksFromLocal(book._id, titleWithAuthor, bookmarks ?? []);
                  if (!merged || merged.length === 0) return;
                  onUpdateBookmark?.(merged);
                }}
                title="Import bookmarks from last saved"
              >
                <Plus />
              </Button>
            )}

            {/* Delete Bookmarks */}
            <Button
              size="icon"
              variant="ghost"
              disabled={!book?.title || bookmarks.length === 0}
              onClick={() => {
                if (!book) return;
                if (!confirm(`Deleted all ${bookmarks.length} bookmarks for ${book?.title}?`)) return;
                setBookmarks([]);
              }}
              title={`Deleted all ${bookmarks.length} bookmarks`}
            >
              <BookmarkX size={16} />
            </Button>
          </>
        )}

        {/* Highlight feature buttons */}
        {index === 2 && (
          <>
            {/* Delete Highlights */}
            <Button
              size="icon"
              variant="ghost"
              disabled={!book?.title || highlights.length === 0}
              onClick={() => {
                if (!book) return;
                if (!confirm(`Deleted all ${highlights.length} highlights for ${book?.title}?`)) return;
                setHighlights([]);
              }}
              title={`Deleted all ${highlights.length} highlights`}
            >
              <Eraser size={16} />
            </Button>
          </>
        )}

        {/* Jump buttons */}
        <>
          <Button size="icon" variant="ghost" disabled={isAtTop} onClick={scrollToTop} title="To list top">
            <SquareArrowUp />
          </Button>

          <Button size="icon" variant="ghost" disabled={isAtBottom} onClick={scrollToBottom} title="To list end">
            <SquareArrowDown />
          </Button>
        </>
      </div>

      <div
        ref={listRef}
        onScroll={onScroll}
        onKeyDown={async (e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          e.preventDefault();

          const isDown = e.key === 'ArrowDown';
          let nextIndex = 0;
          let targetLine = 0;

          if (index === 0) {
            // Chapters
            if (!chapters?.length) return;
            const current = viewChapter?.chapterIndex ?? -1;
            nextIndex = isDown ? Math.min(current + 1, chapters.length - 1) : Math.max(0, current - 1);
            targetLine = chapters[nextIndex].startIndex || 0;
          } else if (index === 1) {
            // Bookmarks
            if (!bookmarks?.length) return;
            const current = bookmarks.findIndex((b) => b.index === selectedBookmark);
            nextIndex = isDown ? Math.min(current + 1, bookmarks.length - 1) : Math.max(0, current - 1);
            targetLine = bookmarks[nextIndex].index;
            setSelectedBookmark(targetLine);
          } else if (index === 2) {
            // Highlights
            if (!highlights?.length) return;
            const current = highlights.findIndex((h) => h.indices[0] === selectedHighlight);
            nextIndex = isDown ? Math.min(current + 1, highlights.length - 1) : Math.max(0, current - 1);
            targetLine = highlights[nextIndex].indices[0];
            setSelectedHighlight(targetLine);
          }
          await jumpToIndex(targetLine, true);
          scrollToView(nextIndex);
        }}
        className="no-scrollbar overflow-y-auto overflow-x-hidden flex flex-col items-start [&_button]:rounded-none!"
      >
        {index === 0 &&
          chapters?.length > 0 &&
          chapters
            .filter((chapter) => chapter.isLoaded)
            .map((chapter, index) => (
              <Button
                autoFocus={index === viewChapter?.chapterIndex}
                variant={index === viewChapter?.chapterIndex ? 'default' : 'outline'}
                key={`chapter-${index}`}
                value={index}
                onClick={async () => {
                  const chapter = chapters[index];
                  if (!chapter) return;
                  let targetLineIndex = chapter.startIndex;
                  if (targetLineIndex === undefined) {
                    console.log(`🚰 JIT: Hydrating target chapter ${index} before jump...`);

                    // This call should return the updated book with the new startIndex
                    const updatedBook = await hydrateChapterByIndex(index);
                    if (updatedBook && updatedBook.chapters[index].startIndex) {
                      targetLineIndex = updatedBook.chapters[index].startIndex;
                    } else {
                      return;
                    }
                  }
                  await jumpToIndex(targetLineIndex);
                  setSelectedBookmark(undefined);
                }}
                title={chapter.title}
                className="w-full justify-start px-2! py-2! h-auto!"
              >
                <span className="w-full text-wrap text-left font-normal!">{chapter.title}</span>
              </Button>
            ))}
        {index === 1 &&
          bookmarks?.length > 0 &&
          bookmarks.map((bookmark) => (
            <Button
              variant={bookmark.index === selectedBookmark ? 'default' : 'outline'}
              key={`bookmark-${bookmark.index}`}
              value={bookmark.index}
              onClick={async () => {
                await jumpToIndex(bookmark.index, true);
                setSelectedBookmark(bookmark.index);
                const targetIndex = bookmarks.findIndex((b) => b.index === bookmark.index);
                scrollToView(targetIndex);
              }}
              title={`${bookmark.index + 1}: ${bookmark.text}`}
              className="w-full justify-start px-2! py-2! h-auto!"
            >
              <span className="w-full text-wrap text-left font-normal!">{bookmark.text}</span>
            </Button>
          ))}
        {index === 2 &&
          highlights?.length > 0 &&
          highlights.map((highlight) => (
            <Button
              variant={selectedHighlight && highlight.indices.includes(selectedHighlight) ? 'default' : 'outline'}
              key={`highlight-${highlight.indices[0]}`}
              value={highlight.texts.join('')}
              onClick={async () => {
                const lineIndex = highlight.indices[0];
                await jumpToIndex(lineIndex, true);
                setSelectedHighlight(lineIndex);
                const targetIndex = highlights.findIndex((h) => h.indices[0] === lineIndex);
                scrollToView(targetIndex);
              }}
              title={highlight.texts.join('')}
              className="w-full justify-start px-2! py-2! h-auto!"
            >
              <span className="w-full text-wrap text-left font-normal!">{highlight.texts.join(' ')}</span>
            </Button>
          ))}
      </div>
    </SidePanel>
  );
};

export const SidePanelRight = ({ open, onClose }: BookSidePanelProps) => {
  const [index, setIndex] = useState(0);
  const { listRef, isAtTop, isAtBottom, onScroll, scrollToView, scrollToTop, scrollToBottom } = useScroll();

  const selectTab = (index: number) => {
    setIndex(index);
  };

  const { theme, setTheme } = useTheme();
  const { toaster, showToaster } = useToaster();
  const { toggleChapter, deleteLine } = useBookContext();
  const { lines } = useContentContext();
  const { viewLine, readingMode } = useCommonContext();
  const { fontSize, setFontSize, rate, setRate, setVoice, selectedVoice, lineHeight, setLineHeight, indent, setIndent, alignment, setAlignment, availableVoices } = useSettingContext();
  const { isPlaying, resume } = useSpeechContext();
  const { searchRes, currentMatch, clickMatch, prevMatch, nextMatch, closeSearch } = useSearchContext();

  useEffect(() => {
    scrollToView(currentMatch);
  }, [currentMatch, scrollToView, viewLine]);

  if (readingMode === 'search' && searchRes.length > 0) {
    return (
      <SidePanel direction="right" open={open} onClose={onClose}>
        {searchRes.length > 0 && (
          <div className="mx-2.5 mb-4 px-1 rounded-sm flex flex-wrap flex-between items-center gap-1 md:flex-row [&_button]:my-1 [&_button]:p-0! [&_button]:w-6 [&_button]:h-6">
            <div aria-label="search matches" className="px-1 w-fit rounded-sm shadow flex flex-wrap items-center gap-1 md:flex-row">
              {currentMatch + 1}/{searchRes.length}
            </div>

            <div className="grow" />
            {/* Jump buttons */}
            <>
              <Button size="icon" variant="ghost" disabled={isAtTop} onClick={scrollToTop} title="To list top">
                <SquareArrowUp />
              </Button>

              <Button size="icon" variant="ghost" disabled={isAtBottom} onClick={scrollToBottom} title="To list end">
                <SquareArrowDown />
              </Button>
            </>
          </div>
        )}

        <div
          ref={listRef}
          onScroll={onScroll}
          onKeyDown={async (e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              await nextMatch();
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              await prevMatch();
            }
            if (e.key === 'Escape') {
              closeSearch();
            }
          }}
          className="no-scrollbar overflow-y-auto overflow-x-hidden"
        >
          {searchRes
            .filter((res) => !lines[res.index]?.startsWith(DELETE_MARKER))
            .map((res) => (
              <div key={res.index} className="relative flex flex-col items-start [&_button]:rounded-none!">
                <Button
                  autoFocus={viewLine === res.index}
                  variant={viewLine === res.index ? 'default' : 'outline'}
                  onClick={async () => {
                    const index = searchRes.findIndex((r) => r === res);
                    await clickMatch(index);
                  }}
                  className={cn('relative w-full justify-start h-auto!', lines[res.index]?.startsWith(DELETE_MARKER) && 'hidden')}
                >
                  <span className="w-full text-wrap text-left font-normal!">{removeMarker(res.text)}</span>
                </Button>

                {FEATURES.ENABLE_CAHPTER_EDIT && (
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      toggleChapter(res.index, res.text);
                    }}
                    title="Add as chapter"
                    className="absolute right-1 top-1/4 -translate-y-1/2 p-0! w-4! h-4! bg-popover text-popover-foreground shadow"
                  >
                    <Plus />
                  </Button>
                )}

                {FEATURES.ENABLE_LINE_EDIT && (
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={async (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      await deleteLine(res.index);
                    }}
                    title="Delete line"
                    className="absolute right-1 top-3/4 -translate-y-1/2 p-0! w-4! h-4! bg-popover text-popover-foreground shadow"
                  >
                    <Minus />
                  </Button>
                )}
              </div>
            ))}
        </div>
      </SidePanel>
    );
  }

  return (
    <SidePanel direction="right" open={open} onClose={onClose} className="px-2">
      <div className="relative flex flex-wrap mb-2 md:justify-end items-center text-sm text-muted-foreground">
        <Button size="icon" variant={index === 0 ? 'default' : 'outline'} onClick={() => selectTab(0)}>
          <CaseSensitive strokeWidth={1.5} className="w-5! h-5!" />
        </Button>
        <Button size="icon" variant={index === 1 ? 'default' : 'outline'} onClick={() => selectTab(1)}>
          <Headphones />
        </Button>

        {/* Indicator Message */}
        {toaster ? (
          <div
            id="indicator-message"
            className="absolute top-1/2 left-0 -translate-y-1/2 px-4 py-1 text-sm rounded-sm flex justify-center items-center gap-2 bg-highlight z-50 pointer-events-none transition-opacity duration-300"
          >
            {toaster}
          </div>
        ) : null}
      </div>

      {index === 0 && (
        <div className="flex flex-col gap-4">
          {/* Mode */}
          <div className="flex flex-col gap-2">
            <div className="uppercase text-xs">mood</div>
            <ButtonGroup className="flex-wrap row w-full gap-2">
              <Button size="icon" variant={theme === 'light' ? 'default' : 'outline'} onClick={() => setTheme('light')} className="grow border! border-sidebar-accent!">
                <Sun strokeWidth={1.5} className="w-5! h-5!" />
              </Button>
              <Button size="icon" variant={theme === 'dark' ? 'default' : 'outline'} onClick={() => setTheme('dark')} className="grow border! border-sidebar-accent!">
                <Moon strokeWidth={1.5} className="w-5! h-5!" />
              </Button>
            </ButtonGroup>
            <div className="p-2 bg-highlight">Switch between different modes to enhance your reading experience</div>
          </div>

          {/* Page View */}
          {/* <div className="flex flex-col gap-2">
            <div className="uppercase text-xs">page view</div>
            <ButtonGroup className="flex-wrap row w-full gap-2">
              <Button size="icon" variant="outline" onClick={() => setFontSize((prev) => pPrev - 1)} className="grow border! border-sidebar-accent!">
                <RectangleVertical strokeWidth={1.5} className="w-5! h-5!" />
              </Button>
              <Button size="icon" variant="outline" onClick={() => setFontSize((prev) => Pprev + 1)} className="grow border! border-sidebar-accent!">
                <Columns2 strokeWidth={1.5} className="w-5! h-5!" />
              </Button>
            </ButtonGroup>
          </div> */}

          {/* Font Size */}
          <div className="flex flex-col gap-2">
            <div className="uppercase text-xs">font size</div>
            <ButtonGroup className="flex-wrap row w-full gap-2">
              <Button
                size="icon"
                variant="outline"
                disabled={fontSize! <= MIN_FONT_SIZE}
                onClick={() => setFontSize((prev) => Math.max(MIN_FONT_SIZE, prev! - FONT_SIZE_STEP))}
                className="grow border! border-sidebar-accent!"
              >
                <AArrowDown strokeWidth={1} className="w-6! h-6!" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                disabled={fontSize! >= MAX_FONT_SIZE}
                onClick={() => setFontSize((prev) => Math.min(MAX_FONT_SIZE, prev! + FONT_SIZE_STEP))}
                className="grow border! border-sidebar-accent!"
              >
                <AArrowUp strokeWidth={1} className="w-6! h-6!" />
              </Button>
            </ButtonGroup>
            <Slider
              value={[fontSize || FONT_SIZE_DEFAULT]}
              onValueChange={async (indexes: number[]) => setFontSize(indexes[0])}
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              step={FONT_SIZE_STEP}
              className="mt-2"
            />
          </div>

          {/* Line Height */}
          <div className="flex flex-col gap-2">
            <div className="uppercase text-xs">line height</div>
            <ButtonGroup className="flex-wrap row w-full gap-2">
              <Button
                size="icon"
                variant="outline"
                disabled={lineHeight! <= MIN_LINE_HEIGHT}
                onClick={() => setLineHeight((prev) => Math.max(MIN_LINE_HEIGHT, prev! - LINE_HEIGHT_STEP))}
                className="grow border! border-sidebar-accent!"
              >
                <ListChevronsDownUp strokeWidth={1.5} className="w-5! h-5!" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                disabled={lineHeight! >= MAX_LINE_HEIGHT}
                onClick={() => setLineHeight((prev) => Math.min(MAX_LINE_HEIGHT, prev! + LINE_HEIGHT_STEP))}
                className="grow border! border-sidebar-accent!"
              >
                <ListChevronsUpDown strokeWidth={1.5} className="w-5! h-5!" />
              </Button>
            </ButtonGroup>
            <Slider
              value={[lineHeight || LINE_HEIGHT_DEFAULT]}
              onValueChange={async (indexes: number[]) => setLineHeight(indexes[0])}
              min={MIN_LINE_HEIGHT}
              max={MAX_LINE_HEIGHT}
              step={LINE_HEIGHT_STEP}
              className="mt-2"
            />
          </div>

          {/* Indent */}
          <div className="flex flex-col gap-2">
            <div className="uppercase text-xs">indent</div>
            <ButtonGroup className="flex-wrap row w-full gap-2">
              <Button
                size="icon"
                variant="outline"
                disabled={indent! <= MIN_INDENT}
                onClick={() => setIndent((prev) => Math.max(0, prev! - INDENT_STEP))}
                className="grow border! border-sidebar-accent!"
              >
                <ListIndentDecrease strokeWidth={1.5} className="w-5! h-5!" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                disabled={indent! >= MAX_INDENT}
                onClick={() => setIndent((prev) => Math.min(MAX_INDENT, prev! + INDENT_STEP))}
                className="grow border! border-sidebar-accent!"
              >
                <ListIndentIncrease strokeWidth={1.5} className="w-5! h-5!" />
              </Button>
            </ButtonGroup>
            <Slider value={[indent || INDENT_DEFAULT]} onValueChange={async (indexes: number[]) => setIndent(indexes[0])} min={MIN_INDENT} max={MAX_INDENT} step={INDENT_STEP} className="mt-2" />
          </div>

          {/* Alignment */}
          <div className="flex flex-col gap-2">
            <div className="uppercase text-xs">alignment</div>
            <ButtonGroup className="flex-wrap row w-full">
              <Button size="icon" variant={alignment === 'left' ? 'default' : 'outline'} onClick={() => setAlignment('left')} className="grow border! border-sidebar-accent! rounded-r-none!">
                <TextAlignStart strokeWidth={1.5} className="w-5! h-5!" />
              </Button>
              <Button
                size="icon"
                variant={alignment === 'center' ? 'default' : 'outline'}
                onClick={() => setAlignment('center')}
                className="grow border! border-l-0! border-r-0! border-sidebar-accent! rounded-none!"
              >
                <TextAlignCenter strokeWidth={1.5} className="w-5! h-5!" />
              </Button>
              <Button size="icon" variant={alignment === 'right' ? 'default' : 'outline'} onClick={() => setAlignment('right')} className="grow border! border-sidebar-accent! rounded-l-none!">
                <TextAlignEnd strokeWidth={1.5} className="w-5! h-5!" />
              </Button>
            </ButtonGroup>
          </div>

          <div className="grow" />
        </div>
      )}
      {index === 1 && (
        <div className="flex flex-col gap-4">
          {/* Voice */}
          <div className="flex flex-col gap-2">
            <div className="uppercase text-xs">voice</div>
            <ButtonGroup className="w-full flex flex-col gap-1">
              {availableVoices.map((option) => (
                <Button
                  key={option.id}
                  size="icon"
                  variant={selectedVoice.id === option.id ? 'default' : 'outline'}
                  onClick={() => setVoice(option.id)}
                  className="w-full border! border-sidebar-accent! truncate"
                >
                  <span className="w-full truncate">{option.displayName}</span>
                </Button>
              ))}
            </ButtonGroup>
          </div>

          {/* Rate */}
          <div className="flex flex-col gap-2">
            <div className="uppercase text-xs">speech rate</div>
            <ButtonGroup className="flex-wrap row w-full gap-2">
              <Button
                size="icon"
                variant="outline"
                disabled={rate! <= MIN_RATE}
                onClick={() => {
                  const newRate = Math.max(MIN_RATE, rate! - RATE_STEP);
                  setRate(newRate);
                  showToaster(renderRateToaster(newRate));
                  if (isPlaying) resume();
                }}
                className="grow border! border-sidebar-accent!"
              >
                <Rewind strokeWidth={1} className="w-6! h-6!" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                disabled={rate! >= MAX_RATE}
                onClick={() => {
                  const newRate = Math.min(MAX_RATE, rate! + RATE_STEP);
                  setRate(newRate);
                  showToaster(renderRateToaster(newRate));
                  if (isPlaying) resume();
                }}
                className="grow border! border-sidebar-accent!"
              >
                <FastForward strokeWidth={1} className="w-6! h-6!" />
              </Button>
            </ButtonGroup>
            <Slider
              value={[rate || RATE_DEFAULT]}
              onValueChange={async (indexes: number[]) => {
                const newRate = indexes[0];
                setRate(newRate);
                showToaster(renderRateToaster(newRate));
                if (isPlaying) resume();
              }}
              min={MIN_RATE}
              max={MAX_RATE}
              step={RATE_STEP}
              className="mt-2"
            />
          </div>

          <div className="grow" />
        </div>
      )}
    </SidePanel>
  );
};

const renderRateToaster = (rate: number): React.ReactNode => (
  <>
    <AudioLines size={16} className="hidden md:block" />
    <span className="font-semibold whitespace-nowrap">{rate}x</span>
  </>
);

export const renderChapterToaster = (chapter: Chapter): React.ReactNode => {
  if (!chapter?.title) return <></>;

  return <span className="font-semibold whitespace-nowrap">{chapter.title}</span>;
};
