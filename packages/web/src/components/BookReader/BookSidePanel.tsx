import { useSaveToLocal } from '@/common/useSaveToLocal';
import useToaster from '@/common/useToaster';
import { Button } from '@/components//ui/button';
import { useTheme } from '@/components/theme-provider';
import { ButtonGroup } from '@/components/ui/button-group';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Slider } from '@/components/ui/slider';
import { useBookContext, useCommonContext, useSettingContext, useSpeechContext } from '@/config/contexts';
import { FEATURES } from '@/config/features';
import {
  bookTitleWithAuthor,
  FONT_SIZE_STEP,
  INDENT_STEP,
  LINE_HEIGHT_STEP,
  MAX_FONT_SIZE,
  MAX_INDENT,
  MAX_LINE_HEIGHT,
  MAX_RATE,
  MIN_LINE_HEIGHT,
  MIN_RATE,
  RATE_STEP,
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
  FastForward,
  Headphones,
  ListChevronsDownUp,
  ListChevronsUpDown,
  ListIndentDecrease,
  ListIndentIncrease,
  Moon,
  Plus,
  Rewind,
  Save,
  Sun,
  TableOfContents,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface BookSidePanelProps {
  open: boolean;
  onOpenChange: () => void;
}

interface SidePanelLeftProps extends BookSidePanelProps {
  onUpdateBookmark: (merged: BookMark[]) => void;
}

export const SidePanelLeft = ({ open, onOpenChange, onUpdateBookmark }: SidePanelLeftProps) => {
  const { book, bookmarks, viewChapter } = useBookContext();
  const chapters = book?.chapters;
  const showChapters = useMemo(() => !!book?.chapters && book.chapters?.length > 1, [book?.chapters]);

  const [index, setIndex] = useState(showChapters ? 0 : 1);
  const [selectedBookmark, setSelectedBookmark] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { setBookmarks } = useBookContext();
  const { hydrateChapterByIndex, jumpToIndex } = useCommonContext();
  const { saveBookmarksToLocal, importBookmarksFromLocal } = useSaveToLocal();

  const selectTab = (index: number) => {
    setIndex(index);
    setSelectedBookmark(null);
  };

  useEffect(() => {
    if (index !== 0) return;
    const chapterIndex = viewChapter?.chapterIndex;
    if (chapterIndex === undefined) return;
    const targetElement = listRef.current?.children[chapterIndex] as HTMLElement;

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
    }
  }, [index, viewChapter?.chapterIndex]);

  return (
    <Drawer direction="left" open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="relative flex-wrap md:justify-start">
          <DrawerTitle className="hidden" />
          <Button size="icon" variant={index === 0 ? 'default' : 'outline'} onClick={() => selectTab(0)} disabled={!showChapters} title="Chapters">
            <TableOfContents />
          </Button>
          <Button size="icon" variant={index === 1 ? 'default' : 'outline'} onClick={() => selectTab(1)} title="Bookmarks">
            <Bookmark />
          </Button>
        </DrawerHeader>
        {index === 1 && (
          <DrawerDescription className="px-4 flex flex-wrap items-center gap-1 md:flex-row [&_button]:p-0! [&_button]:w-4">
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
                if (!confirm(`Deleted all ${bookmarks.length} bookmarks for [${book?.title}]?`)) return;
                setBookmarks([]);
              }}
              title={`Deleted all ${bookmarks.length} bookmarks`}
            >
              <BookmarkX size={16} />
            </Button>
          </DrawerDescription>
        )}

        <div ref={listRef} className="no-scrollbar overflow-y-auto overflow-x-hidden px-1 flex flex-col items-start">
          {index === 0 &&
            chapters &&
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
                  }}
                  className="w-full truncate justify-start"
                >
                  {chapter.title}
                </Button>
              ))}
          {index === 1 &&
            bookmarks &&
            bookmarks?.length > 0 &&
            bookmarks.map((bookmark) => (
              <Button
                variant={bookmark.index === selectedBookmark ? 'default' : 'outline'}
                key={`bookmark-${bookmark.index}`}
                value={bookmark.index}
                title={`${bookmark.index + 1}: ${bookmark.text}`}
                onClick={async () => {
                  await jumpToIndex(bookmark.index, true);
                  setSelectedBookmark(bookmark.index);
                }}
                className="w-full justify-start"
              >
                <span className="w-full truncate text-left font-normal!">{bookmark.text}</span>
              </Button>
            ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export const SidePanelRight = ({ open, onOpenChange }: BookSidePanelProps) => {
  const [index, setIndex] = useState(0);

  const selectTab = (index: number) => {
    setIndex(index);
  };

  const { theme, setTheme } = useTheme();
  const { toaster, showToaster } = useToaster();
  const { fontSize, setFontSize, rate, setRate, setVoice, selectedVoice, lineHeight, setLineHeight, indent, setIndent, alignment, setAlignment, availableVoices } = useSettingContext();
  const { isPlaying, resume } = useSpeechContext();

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="relative flex-wrap md:justify-end">
          <DrawerTitle className="hidden" />
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
              className="absolute top-1/2 left-4 -translate-y-1/2 px-4 py-1 text-sm rounded-sm flex justify-center items-center gap-2 bg-highlight z-50 pointer-events-none transition-opacity duration-300"
            >
              {toaster}
            </div>
          ) : null}
        </DrawerHeader>
        <div className="no-scrollbar overflow-y-auto overflow-x-hidden px-4 flex flex-col gap-6 ">
          {index === 0 && (
            <>
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
                  <Button size="icon" variant="outline" onClick={() => setFontSize((prev) => Math.max(0, prev! - FONT_SIZE_STEP))} className="grow border! border-sidebar-accent!">
                    <AArrowDown strokeWidth={1} className="w-6! h-6!" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => setFontSize((prev) => Math.min(MAX_FONT_SIZE, prev! + FONT_SIZE_STEP))} className="grow border! border-sidebar-accent!">
                    <AArrowUp strokeWidth={1} className="w-6! h-6!" />
                  </Button>
                </ButtonGroup>
                <Slider value={[fontSize || 18]} onValueChange={async (indexes: number[]) => setFontSize(indexes[0])} max={MAX_FONT_SIZE} step={FONT_SIZE_STEP} className="mt-2" />
              </div>

              {/* Line Height */}
              <div className="flex flex-col gap-2">
                <div className="uppercase text-xs">line height</div>
                <ButtonGroup className="flex-wrap row w-full gap-2">
                  <Button size="icon" variant="outline" onClick={() => setLineHeight((prev) => Math.max(MIN_LINE_HEIGHT, prev! - LINE_HEIGHT_STEP))} className="grow border! border-sidebar-accent!">
                    <ListChevronsDownUp strokeWidth={1.5} className="w-5! h-5!" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => setLineHeight((prev) => Math.min(MAX_LINE_HEIGHT, prev! + LINE_HEIGHT_STEP))} className="grow border! border-sidebar-accent!">
                    <ListChevronsUpDown strokeWidth={1.5} className="w-5! h-5!" />
                  </Button>
                </ButtonGroup>
                <Slider value={[lineHeight || 2]} onValueChange={async (indexes: number[]) => setLineHeight(indexes[0])} max={MAX_LINE_HEIGHT} step={LINE_HEIGHT_STEP} className="mt-2" />
              </div>

              {/* Indent */}
              <div className="flex flex-col gap-2">
                <div className="uppercase text-xs">indent</div>
                <ButtonGroup className="flex-wrap row w-full gap-2">
                  <Button size="icon" variant="outline" onClick={() => setIndent((prev) => Math.max(0, prev! - INDENT_STEP))} className="grow border! border-sidebar-accent!">
                    <ListIndentDecrease strokeWidth={1.5} className="w-5! h-5!" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => setIndent((prev) => Math.min(MAX_INDENT, prev! + INDENT_STEP))} className="grow border! border-sidebar-accent!">
                    <ListIndentIncrease strokeWidth={1.5} className="w-5! h-5!" />
                  </Button>
                </ButtonGroup>
                <Slider value={[indent || 1]} onValueChange={async (indexes: number[]) => setIndent(indexes[0])} max={MAX_INDENT} step={INDENT_STEP} className="mt-2" />
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
            </>
          )}
          {index === 1 && (
            <>
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
                  value={[rate || 1]}
                  onValueChange={async (indexes: number[]) => {
                    const newRate = indexes[0];
                    setRate(newRate);
                    showToaster(renderRateToaster(newRate));
                    if (isPlaying) resume();
                  }}
                  max={MAX_RATE}
                  step={RATE_STEP}
                  className="mt-2"
                />
              </div>

              <div className="grow" />
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
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
