import { useBookContext, useCommonContext, useContentContext } from '@/config/contexts';
import { cn } from '@/lib/utils';
import { Bookmark, Copy, Highlighter } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './button';

interface Position {
  x: number;
  y: number;
  indices: number[];
  texts: string[];
}

export const TextContextMenu = () => {
  const [position, setPosition] = useState<Position>();
  const menuRef = useRef<HTMLDivElement>(null);

  const { bookmarks, toggleBookmark, highlights, toggleHighlight } = useBookContext();
  const { userScroll, ttsScroll } = useCommonContext();
  const { lines } = useContentContext();

  const clearSelection = useCallback(() => {
    setPosition(undefined);
    ttsScroll();
  }, [ttsScroll]);

  const handleSelection = useCallback(
    (e: MouseEvent) => {
      // If detail is 2 (double-click) or more, abort immediately
      if (e.detail > 1) {
        clearSelection();
        return;
      }

      const selection = window.getSelection();
      const text = selection?.toString().trim();

      // Only trigger if there is actual text selected
      if (!selection || selection.isCollapsed || !text) {
        clearSelection();
        return;
      }

      const range = selection.getRangeAt(0);
      const startRow = range.startContainer.parentElement?.closest('[data-item-index]');
      const endRow = range.endContainer.parentElement?.closest('[data-item-index]');
      const rect = range.getBoundingClientRect();

      // If the selection has no width (e.g. just a click), hide menu
      if (!startRow || !endRow || rect.width === 0) {
        clearSelection();
        return;
      }

      const startIndex = parseInt(startRow.getAttribute('data-item-index') || '0');
      const endIndex = parseInt(endRow.getAttribute('data-item-index') || '0');

      // Find the range of line indices the user highlighted
      const selectedLineIndices = [];
      for (let i = startIndex; i <= endIndex; i++) {
        selectedLineIndices.push(i);
      }

      // added offset so cursor isn't covering the menu
      // setPosition({ x: rect.left + rect.width, y: rect.bottom + 100, index, text });
      setPosition({ x: e.clientX + 80, y: e.clientY + 100, indices: selectedLineIndices, texts: text.split('\n') });
      userScroll();
    },
    [userScroll, clearSelection],
  );

  // hijack mouseup globally
  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => handleSelection(e);

    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [handleSelection]);

  // hijack the browser's default escape
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && position) {
        e.preventDefault();
        setPosition(undefined);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [position]);

  if (!position) return null;

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-50 flex flex-col dark min-w-32 bg-popover/70 before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:backdrop-blur-2xl before:backdrop-saturate-150 text-popover-foreground shadow-md ring-1 ring-foreground/10 rounded-md p-1 animate-in fade-in zoom-in duration-100',
        'text-sm [&_button]:w-full [&_button]:flex [&_button]:justify-start [&_button]:items-center [&_button]:gap-2',
      )}
      style={{ top: position.y, left: position.x, transform: 'translate(-50%, -100%)' }}
    >
      <Button
        variant="ghost"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          toggleBookmark(position.indices[0], lines[position.indices[0]]);
          clearSelection();
        }}
      >
        <Bookmark />
        {bookmarks.find((b) => position.indices[0] === b.index) ? 'Remove bookmark' : 'Bookmark'}
      </Button>

      <Button
        variant="ghost"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          toggleHighlight(position.indices, position.texts);
          clearSelection();
        }}
      >
        <Highlighter />
        {highlights.find((h) => position.indices.every((i) => h.indices.includes(i))) ? 'Remove highlight' : 'Highlight'}
      </Button>

      <Button
        variant="ghost"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          navigator.clipboard.writeText(position.texts.join('\n'));
          clearSelection();
        }}
      >
        <Copy />
        Copy
      </Button>
    </div>
  );
};
