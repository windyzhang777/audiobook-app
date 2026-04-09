import { Button } from '@/components/ui/button';
import { useBookContext, useCommonContext, useSearchContext } from '@/config/contexts';
import { CHAPTER_MARKER, IMAGE_MARKER } from '@audiobook/shared';
import { Bookmark, X } from 'lucide-react';

interface BookLineProps {
  index: number;
  line: string;
}

export const BookLine = ({ index, line }: BookLineProps) => {
  const { currentLine, book, bookmarks, toggleBookmark, deleteLine } = useBookContext();
  const { viewLine, readingMode, handleLineClick } = useCommonContext();
  const { searchText, searchRes, currentMatch, clearSearch } = useSearchContext();

  const isBookmarked = bookmarks.some((b) => b.index === index);
  const isCurrentMatch = searchRes[currentMatch] === index;
  const isChapter = line.startsWith(CHAPTER_MARKER);
  const cleanLine = isChapter ? line.substring(CHAPTER_MARKER.length) : line;
  const isImage = line.startsWith(IMAGE_MARKER);

  const getHighlightedText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className={`rounded-md py-1 outline-none bg-highlight ${isCurrentMatch ? 'bg-amber-500 ' : 'outline-none'}`}>
              {part}
            </mark>
          ) : (
            part
          ),
        )}
      </span>
    );
  };

  if (book && isImage) {
    const imageUrl = line.substring(IMAGE_MARKER.length);
    return <img key={index} src={`${import.meta.env.VITE_API_URL}${imageUrl}`} alt={`${book.title}-image-${index}`} className="w-full h-auto rounded-lg my-6 shadow-sm" />;
  }

  return (
    <li
      key={`line-${index}`}
      id={`line-${index}`}
      role="button"
      tabIndex={index === currentLine ? 0 : -1}
      aria-current={index === currentLine ? 'location' : undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        toggleBookmark(index, cleanLine);
      }}
      onDoubleClick={() => {
        handleLineClick(index);
        clearSearch();
      }}
      className={`group relative cursor-pointer my-1 px-2 transition-colors duration-200 ease-in-out rounded-lg ${isChapter ? 'font-semibold italic text-center uppercase tracking-widest' : ''} ${index === currentLine ? 'bg-highlight font-medium' : index === viewLine ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent'} focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-opacity-50 ${isBookmarked ? 'border border-r-4 border-amber-400 pr-2' : 'border-r-4 border-transparent'}`}
    >
      {searchText ? getHighlightedText(cleanLine, searchText) : cleanLine}

      {readingMode === 'edit' ? (
        <Button
          variant="ghost"
          aria-label="Delete this line from the book"
          onClick={(e) => {
            e.stopPropagation();
            deleteLine(index);
          }}
          title="Delete this line from the book"
          className={`absolute -right-9 top-0 text-gray-400 hover:opacity-100 transition-opacity duration-150 ${isBookmarked ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}
        >
          <X size={16} fill="currentColor" />
        </Button>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          tabIndex={index === currentLine ? 0 : -1}
          aria-label={`${isBookmarked ? 'Remove' : 'Add'} bookmark for line ${index + 1}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleBookmark(index, cleanLine);
          }}
          title={isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
          className={`absolute -right-9 top-0 text-amber-400 hover:opacity-40 transition-opacity duration-150 hover:text-amber-400 hover:bg-transparent active:bg-transparent ${isBookmarked ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}
        >
          <Bookmark size={16} fill="currentColor" />
        </Button>
      )}
    </li>
  );
};
