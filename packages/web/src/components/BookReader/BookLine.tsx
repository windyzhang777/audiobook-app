import { useBookContext, useCommonContext, useSearchContext, useSettingContext } from '@/config/contexts';
import { cn } from '@/lib/utils';
import { wordHighlightStore, type WordHighlight } from '@/stores/wordHighlightStore';
import { CHAPTER_MARKER, DELETE_MARKER, escapeRegExp, IMAGE_MARKER, removeMarker } from '@audiobook/shared';
import React, { useCallback, useSyncExternalStore } from 'react';

interface BookLineProps extends React.HTMLAttributes<HTMLLIElement> {
  index: number;
  line: string;
}

export const BookLine = ({ index, line }: BookLineProps) => {
  const { currentLine, book, chapters, bookmarks, highlights } = useBookContext();
  const { readingMode, handleLineClick } = useCommonContext();
  const { searchText, searchRes, currentMatch } = useSearchContext();

  // Per-line subscription: only this line re-render when its highlight changes
  const subscribe = useCallback((cb: () => void) => wordHighlightStore.subscribeLine(index, cb), [index]);
  const getSnapshot = useCallback(() => wordHighlightStore.getActiveWordForLine(index), [index]);
  const activeWord: WordHighlight | null = useSyncExternalStore(subscribe, getSnapshot);

  const isBookmarked = bookmarks.some((b) => b.index === index);
  const highlightTexts = highlights.filter((h) => h.indices.includes(index)).flatMap((h) => h.texts[h.indices.indexOf(index)]);
  const isCurrentMatch = searchRes[currentMatch]?.index === index;
  const isChapter = line.startsWith(CHAPTER_MARKER) || !!chapters.find((c) => c.startIndex === index);
  const cleanLine = isChapter ? removeMarker(line) : line;
  const isImage = line.startsWith(IMAGE_MARKER);
  const isDeleted = line.startsWith(DELETE_MARKER);
  const isActiveLine = activeWord && activeWord.lineIndex === index && activeWord.charIndex >= 0;

  const { paragraphSpacing } = useSettingContext();

  const renderWordHighlight = (text: string, offset: number) => {
    if (!isActiveLine) return text;

    const { charIndex, charLength } = activeWord;
    const wordEnd = charIndex + charLength;
    const segEnd = offset + text.length;

    if (wordEnd <= offset || charIndex >= segEnd) {
      // No overlap
      return text;
    }

    const overlapStart = Math.max(charIndex, offset) - offset;
    const overlapEnd = Math.min(wordEnd, segEnd) - offset;
    const before = text.slice(0, overlapStart);
    const word = text.slice(overlapStart, overlapEnd);
    const after = text.slice(overlapEnd);

    return (
      <>
        {before}
        <mark className="rounded-md outline-none bg-primary">{word}</mark>
        {after}
      </>
    );
  };

  const renderLine = (text: string, highlight: string, isHightlight: boolean = false) => {
    if (!highlight?.trim()) return renderWordHighlight(text, 0);

    const regex = new RegExp(`(${escapeRegExp(highlight)})`, 'gi');
    const parts: { text: string; offset: number; isMatch: boolean }[] = [];

    let match;
    let offset = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > offset) {
        parts.push({ text: text.slice(offset, match.index), offset, isMatch: false });
      }
      parts.push({ text: match[0], offset: match.index, isMatch: true });
      offset = regex.lastIndex;
    }
    if (offset < text.length) {
      parts.push({ text: text.slice(offset), offset, isMatch: false });
    }

    return (
      <span>
        {parts.map((part, i) =>
          part.isMatch ? (
            <mark
              key={i}
              className={cn(
                'rounded-md outline-none',
                isCurrentMatch ? 'bg-primary' : isHightlight ? 'underline decoration-wavy decoration-primary underline-offset-4 bg-transparent' : 'bg-highlight',
              )}
              aria-current={isCurrentMatch ? 'true' : undefined}
            >
              {renderWordHighlight(part.text, part.offset)}
            </mark>
          ) : (
            <React.Fragment key={i}>{renderWordHighlight(part.text, part.offset)}</React.Fragment>
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
        index === currentLine ? 'bg-highlight font-medium' : 'hover:bg-sidebar-accent',
        isChapter ? 'font-semibold italic text-center uppercase tracking-widest' : '',
        isBookmarked ? 'border border-r-4 border-primary pr-2' : 'border-r-4 border-transparent',
      )}
    >
      {searchText && readingMode === 'search' ? renderLine(cleanLine, searchText) : renderLine(cleanLine, highlightTexts[0], true)}
    </li>
  );
};
