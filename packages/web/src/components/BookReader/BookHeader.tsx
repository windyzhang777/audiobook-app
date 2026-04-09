import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { useBookContext, useCommonContext, useSearchContext } from '@/config/contexts';
import { FEATURES } from '@/config/features';
import { bookTitleWithAuthor } from '@audiobook/shared';
import { ArrowBigDown, ArrowBigUp, LibraryBig, ListEnd, ListStart, MapPin, PanelLeft, Pause, Play, Search, Settings, X } from 'lucide-react';
import { type SetStateAction } from 'react';

interface BookHeaderProps {
  setOpenPanelLeft: (value: SetStateAction<boolean>) => void;
  setOpenPanelRight: (value: SetStateAction<boolean>) => void;
}

export const BookHeader = ({ setOpenPanelLeft, setOpenPanelRight }: BookHeaderProps) => {
  const { book, currentLine, viewChapter, totalLines } = useBookContext();
  const { viewLine, isPlaying, handlePlayPause, readingMode, setReadingMode, jumpToIndex, userScroll, jumpToRead, navigateBack } = useCommonContext();
  const { searchInputRef, searchText, setSearchText, searchRes, currentMatch, prevMatch, nextMatch, openSearch, clearSearch } = useSearchContext();
  if (!book || currentLine === undefined) return null;

  return (
    <header className="fixed top-0 left-0 right-0">
      <nav id="controls" className="relative px-4 pt-0 pb-10 md:pt-4 md:pb-4 [&_button:not([name='clear search'])]:pt-2! md:[&_button]:pt-4!">
        {/* Left Panel Group */}
        <div id="panel-left" title="Bookmars & Chapters" className="flex items-center gap-4">
          {/* Left Panel */}
          <Button size="icon" variant="ghost" onClick={() => setOpenPanelLeft((prev) => !prev)}>
            <PanelLeft />
          </Button>

          <Separator orientation="vertical" />

          {/* Jump Buttons */}
          <div className="flex items-center">
            {/* Jump to Read */}
            <Button size="icon" variant="ghost" id="jump-to-read" title="Jump To Read" onClick={jumpToRead}>
              <MapPin />
            </Button>

            {/* Jump to Start */}
            <Button
              size="icon"
              variant="ghost"
              id="jump-to-start"
              title="Jump To Start"
              onClick={async () => {
                await jumpToIndex(0);
              }}
            >
              <ArrowBigUp size={16} />
            </Button>

            {/* Prev Chapter */}
            <Button
              size="icon"
              variant="ghost"
              id="prev-chapter"
              disabled={viewChapter?.chapterIndex === 0}
              onClick={async () => {
                if (!book || !viewChapter) return;
                if (isPlaying) userScroll();
                const targetChapterIndex = Math.max(0, viewLine > (viewChapter.startIndex ?? 0) ? viewChapter.chapterIndex : viewChapter.chapterIndex - 1);
                await jumpToIndex(book.chapters[targetChapterIndex].startIndex);
              }}
              title="Previous Chapter"
            >
              <ListStart />
            </Button>

            {/* Next Chapter */}
            <Button
              size="icon"
              variant="ghost"
              id="next-chapter"
              disabled={!book?.chapters || viewChapter?.chapterIndex === book.chapters.length - 1}
              onClick={async () => {
                if (!book || !viewChapter) return;
                if (isPlaying) userScroll();
                const targetChapterIndex = Math.min(viewChapter.chapterIndex + 1, book.chapters.length - 1);
                await jumpToIndex(book.chapters[targetChapterIndex].startIndex);
              }}
              title="Next Chapter"
            >
              <ListEnd />
            </Button>

            {/* Jump to End */}
            {FEATURES.ENABLE_SCROLL_TO_END && (
              <Button
                size="icon"
                variant="ghost"
                id="jump-to-end"
                title="Jump To End"
                onClick={async () => {
                  if (!totalLines) return;
                  await jumpToIndex(totalLines - 1);
                }}
              >
                <ArrowBigDown size={16} />
              </Button>
            )}
          </div>
        </div>

        {/* Back to Books */}
        <div className="absolute top-0 left-1/2 md:left-72 -translate-x-1/2 h-7.5 md:h-14 duration-200 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            id="back-to-books"
            title="Back to Books"
            onClick={() => navigateBack(false)}
            className="h-full pb-1! md:pb-3.5! rounded-t-none! bg-sidebar-accent flex items-end!"
          >
            <LibraryBig />
          </Button>
        </div>

        {/* Play/Pause */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/12 md:-translate-y-1/2 flex items-center w-[clamp(40px,80%,80%)] md:w-[clamp(40px,80%,20%)] lg:w-auto">
          <Button variant="ghost" id={isPlaying ? 'pause' : 'play'} onClick={handlePlayPause} title={isPlaying ? 'Pause' : 'Play'} className="w-full truncate justify-start">
            {isPlaying ? <Pause /> : <Play className="text-green-600" />}
            <span className="w-full truncate">{bookTitleWithAuthor(book)}</span>
          </Button>
        </div>

        {/* Right Panel Group */}
        <div id="panel-right" title="Font & Voice" className="flex items-center gap-4">
          {/* Search text */}
          <Button
            size="icon"
            variant="ghost"
            id="search"
            title="Search"
            onClick={openSearch}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openSearch();
              }
            }}
            className={`shrink-0 ${readingMode === 'search' ? 'text-gray-600' : 'text-inherit'}`}
          >
            <Search />
          </Button>
          {readingMode === 'search' && (
            <div className={`mt-0.5 h-6 md:mt-0 md:h-auto flex items-center no-wrap overflow-hidden rounded-lg duration-200 ${readingMode === 'search' ? 'bg-highlight' : 'bg-inherit'}`}>
              <Input
                autoFocus
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
                    setReadingMode('tts');
                  }
                }}
                className="w-auto min-w-[2ch] max-w-[10ch] border-none transition-all focus:ring-0 focus-visible:ring-0"
              />
              {searchText.length > 0 && (
                <Button
                  size="icon"
                  variant="ghost"
                  name="clear search"
                  title="Clear search"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSearch();
                    setReadingMode('tts');
                  }}
                >
                  <X size={14} />
                </Button>
              )}
              {searchRes.length > 0 && (
                <div className="flex items-center border border-l-black px-2 text-xs animate-in fade-in">
                  {currentMatch + 1}/{searchRes.length}
                </div>
              )}
            </div>
          )}

          <Separator orientation="vertical" />

          {/* Right Panel */}
          <Button size="icon" variant="ghost" onClick={() => setOpenPanelRight((prev) => !prev)}>
            <Settings />
          </Button>
        </div>
      </nav>

      {/* Progress Slider */}
      <Slider
        id="progress"
        value={[viewLine]}
        onValueChange={async (indexes: number[]) => {
          const viewIndex = indexes[0];
          await jumpToIndex(viewIndex);
        }}
        max={totalLines}
        step={1}
      />
    </header>
  );
};
