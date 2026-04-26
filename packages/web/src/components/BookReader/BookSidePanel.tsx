import { useSaveToLocal } from '@/common/useSaveToLocal';
import useScroll from '@/common/useScroll';
import { Button } from '@/components//ui/button';
import { useTheme } from '@/components/theme-provider';
import { ButtonGroup } from '@/components/ui/button-group';
import { SidePanel } from '@/components/ui/SidePanel';
import { Slider } from '@/components/ui/slider';
import { useBookContext, useCommonContext, useContentContext, useSearchContext, useSettingContext, useViewLineContext } from '@/config/contexts';
import { FEATURES } from '@/config/features';
import { cn } from '@/lib/utils';
import { getChapter } from '@/utils';
import {
  bookTitleWithAuthor,
  DELETE_MARKER,
  escapeRegExp,
  FONT_SIZE_DEFAULT,
  FONT_SIZE_STEP,
  INDENT_DEFAULT,
  INDENT_STEP,
  LINE_HEIGHT_DEFAULT,
  LINE_HEIGHT_STEP,
  MAX_FONT_SIZE,
  MAX_INDENT,
  MAX_LINE_HEIGHT,
  MAX_PARAGRAPH_SPACING,
  MIN_FONT_SIZE,
  MIN_INDENT,
  MIN_LINE_HEIGHT,
  MIN_PARAGRAPH_SPACING,
  PARAGRAPH_SPACING_DEFAULT,
  PARAGRAPH_SPACING_STEP,
  removeMarker,
  type BookMark,
} from '@audiobook/shared';
import {
  AArrowDown,
  AArrowUp,
  Bookmark,
  BookmarkX,
  CaseSensitive,
  Eraser,
  Highlighter,
  ListChevronsDownUp,
  ListChevronsUpDown,
  ListIndentDecrease,
  ListIndentIncrease,
  LocateFixed,
  Minus,
  Moon,
  Plus,
  Rows2,
  Rows4,
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

          {index === 0 && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                scrollToView(viewChapter?.chapterIndex);
              }}
              title="To read"
            >
              <LocateFixed />
            </Button>
          )}

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
                variant={index === viewChapter?.chapterIndex ? 'secondary' : 'ghost'}
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
                className="w-full justify-start px-2! py-2! h-auto! focus:ring-0 focus-visible:ring-0"
              >
                <span className="w-full text-wrap text-left font-normal!">{chapter.title}</span>
              </Button>
            ))}
        {index === 1 &&
          bookmarks?.length > 0 &&
          bookmarks.map((bookmark) => (
            <Button
              variant={bookmark.index === selectedBookmark ? 'secondary' : 'ghost'}
              key={`bookmark-${bookmark.index}`}
              value={bookmark.index}
              onClick={async () => {
                await jumpToIndex(bookmark.index, true);
                setSelectedBookmark(bookmark.index);
                const targetIndex = bookmarks.findIndex((b) => b.index === bookmark.index);
                scrollToView(targetIndex);
              }}
              title={`${bookmark.index + 1}: ${bookmark.text}`}
              className="w-full justify-start px-2! py-2! h-auto! focus:ring-0 focus-visible:ring-0"
            >
              <span className="w-full text-wrap text-left font-normal!">{bookmark.text}</span>
            </Button>
          ))}
        {index === 2 &&
          highlights?.length > 0 &&
          highlights.map((highlight) => (
            <Button
              variant={selectedHighlight && highlight.indices.includes(selectedHighlight) ? 'secondary' : 'ghost'}
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
              className="w-full justify-start px-2! py-2! h-auto! focus:ring-0 focus-visible:ring-0"
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
  const { chapters, toggleChapter, deleteLine } = useBookContext();
  const { lines } = useContentContext();
  const { readingMode } = useCommonContext();
  const { viewLine } = useViewLineContext();
  const { fontSize, setFontSize, lineHeight, setLineHeight, paragraphSpacing, setParagraphSpacing, indent, setIndent, alignment, setAlignment } = useSettingContext();
  const { searchText, searchRes, currentMatch, clickMatch, prevMatch, nextMatch, closeSearch } = useSearchContext();

  const renderHighlightedText = (text: string, highlight: string) => {
    if (!highlight?.trim()) return text;
    const parts = text.split(new RegExp(`(${escapeRegExp(highlight)})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className={`rounded-md py-1 outline-none bg-primary`}>
              {part}
            </mark>
          ) : (
            part
          ),
        )}
      </span>
    );
  };

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
                  variant={viewLine === res.index ? 'secondary' : 'ghost'}
                  onClick={async () => {
                    const index = searchRes.findIndex((r) => r === res);
                    await clickMatch(index);
                  }}
                  className={cn('relative w-full flex-col justify-start items-start! h-auto! gap-2! py-4 focus:ring-0 focus-visible:ring-0', lines[res.index]?.startsWith(DELETE_MARKER) && 'hidden')}
                >
                  <span>{getChapter(res.index, chapters)?.title}</span>
                  <span className="w-full text-wrap text-left font-normal!">{renderHighlightedText(removeMarker(res.text), searchText)}</span>
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
      </div>

      <div className="no-scrollbar overflow-y-auto overflow-x-hidden flex flex-col items-start [&_button]:rounded-none!">
        {index === 0 && (
          <div className="flex flex-col gap-4">
            {/* Mode */}
            <div className="flex flex-col gap-2">
              <div className="uppercase text-xs">mood</div>
              <ButtonGroup className="flex-wrap w-full gap-2">
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
            <ButtonGroup className="flex-wrap w-full gap-2">
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
              <ButtonGroup className="flex-wrap w-full gap-2">
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
                onValueChange={async (indices: number[]) => setFontSize(indices[0])}
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                step={FONT_SIZE_STEP}
                className="mt-2"
              />
            </div>

            {/* Line Height */}
            <div className="flex flex-col gap-2">
              <div className="uppercase text-xs">line height</div>
              <ButtonGroup className="flex-wrap w-full gap-2">
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
                onValueChange={async (indices: number[]) => setLineHeight(indices[0])}
                min={MIN_LINE_HEIGHT}
                max={MAX_LINE_HEIGHT}
                step={LINE_HEIGHT_STEP}
                className="mt-2"
              />
            </div>

            {/* Paragraph Spacing */}
            <div className="flex flex-col gap-2">
              <div className="uppercase text-xs">paragraph spacing</div>
              <ButtonGroup className="flex-wrap w-full gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  disabled={paragraphSpacing! <= MIN_PARAGRAPH_SPACING}
                  onClick={() => setParagraphSpacing((prev) => Math.max(MIN_PARAGRAPH_SPACING, prev! - PARAGRAPH_SPACING_STEP))}
                  className="grow border! border-sidebar-accent!"
                >
                  <Rows4 strokeWidth={1.5} className="w-5! h-5!" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  disabled={paragraphSpacing! >= MAX_PARAGRAPH_SPACING}
                  onClick={() => setParagraphSpacing((prev) => Math.min(MAX_PARAGRAPH_SPACING, prev! + PARAGRAPH_SPACING_STEP))}
                  className="grow border! border-sidebar-accent!"
                >
                  <Rows2 strokeWidth={1.5} className="w-5! h-5!" />
                </Button>
              </ButtonGroup>
              <Slider
                value={[paragraphSpacing || PARAGRAPH_SPACING_DEFAULT]}
                onValueChange={async (indices: number[]) => setParagraphSpacing(indices[0])}
                min={MIN_PARAGRAPH_SPACING}
                max={MAX_PARAGRAPH_SPACING}
                step={PARAGRAPH_SPACING_STEP}
                className="mt-2"
              />
            </div>

            {/* Indent */}
            <div className="flex flex-col gap-2">
              <div className="uppercase text-xs">indent</div>
              <ButtonGroup className="flex-wrap w-full gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  disabled={indent! <= MIN_INDENT}
                  onClick={() => setIndent((prev) => Math.max(MIN_INDENT, prev! - INDENT_STEP))}
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
              <Slider value={[indent ?? INDENT_DEFAULT]} onValueChange={async (indices: number[]) => setIndent(indices[0])} min={MIN_INDENT} max={MAX_INDENT} step={INDENT_STEP} className="mt-2" />
            </div>

            {/* Alignment */}
            <div className="flex flex-col gap-2">
              <div className="uppercase text-xs">alignment</div>
              <ButtonGroup className="flex-wrap w-full">
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
      </div>
    </SidePanel>
  );
};
