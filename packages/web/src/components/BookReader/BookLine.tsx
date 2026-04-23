import { useBookContext, useCommonContext, useSearchContext, useSettingContext, useViewLineContext } from '@/config/contexts';
import { cn } from '@/lib/utils';
import { CHAPTER_MARKER, DELETE_MARKER, escapeRegExp, IMAGE_MARKER, removeMarker } from '@audiobook/shared';
import React from 'react';

interface BookLineProps extends React.HTMLAttributes<HTMLLIElement> {
  index: number;
  line: string;
}

export const BookLine = ({ index, line }: BookLineProps) => {
  const { currentLine, book, chapters, bookmarks, highlights } = useBookContext();
  const { readingMode, handleLineClick } = useCommonContext();
  const { viewLine } = useViewLineContext();
  const { searchText, searchRes, currentMatch } = useSearchContext();
  const isBookmarked = bookmarks.some((b) => b.index === index);
  const highlightTexts = highlights.filter((h) => h.indices.includes(index)).flatMap((h) => h.texts[h.indices.indexOf(index)]);
  const isCurrentMatch = searchRes[currentMatch]?.index === index;
  const isChapter = line.startsWith(CHAPTER_MARKER) || !!chapters.find((c) => c.startIndex === index);
  const cleanLine = isChapter ? removeMarker(line) : line;
  const isImage = line.startsWith(IMAGE_MARKER);
  const isDeleted = line.startsWith(DELETE_MARKER);

  const { paragraphSpacing } = useSettingContext();

  const getHighlightedText = (text: string, highlight: string, isHightlight: boolean = false) => {
    if (!highlight?.trim()) return text;
    const parts = text.split(new RegExp(`(${escapeRegExp(highlight)})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className={`rounded-md outline-none bg-highlight ${isCurrentMatch ? 'bg-highlight' : isHightlight ? 'bg-primary' : 'outline-none'}`}>
              {part}
            </mark>
          ) : (
            part
          ),
        )}
      </span>
    );
  };

  if (isDeleted) {
    return <div key={`deleted-${index}`} style={{ height: '1px', margin: 0, padding: 0 }} className="w-full opacity-0 pointer-events-none" aria-hidden="true" />;
  }
  if (book && isImage) {
    const imageUrl = line.substring(IMAGE_MARKER.length);
    return <img key={index} src={`${import.meta.env.VITE_API_URL}${imageUrl}`} alt={`${book.title}-image-${index}`} className="w-full h-auto rounded-lg my-6 shadow-sm" />;
  }

  return (
    <li
      key={`line-${index}`}
      id={`line-${index}`}
      tabIndex={index === currentLine ? 0 : -1}
      aria-current={index === currentLine ? 'location' : undefined}
      onDoubleClick={() => {
        handleLineClick(index);
      }}
      style={{ paddingTop: paragraphSpacing + 'ch', paddingBottom: paragraphSpacing + 'ch' }}
      className={cn(
        `group relative cursor-pointer my-1 px-2 transition-colors duration-200 ease-in-out rounded-lg`,
        index === currentLine ? 'bg-highlight font-medium' : index === viewLine ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent',
        isChapter ? 'font-semibold italic text-center uppercase tracking-widest' : '',
        isBookmarked ? 'border border-r-4 border-primary pr-2' : 'border-r-4 border-transparent',
      )}
    >
      {searchText && readingMode === 'search' ? getHighlightedText(cleanLine, searchText) : getHighlightedText(cleanLine, highlightTexts[0], true)}
    </li>
  );
};
