import useTimer from '@/common/useTimer';
import { useBookContext, useCommonContext, useContentContext } from '@/config/contexts';
import { FEATURES } from '@/config/features';
import { cn } from '@/lib/utils';
import { Bookmark, Copy, Highlighter, Trash2 } from 'lucide-react';
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

  const { startTimer } = useTimer();
  const { chapters, toggleChapter, bookmarks, toggleBookmark, highlights, toggleHighlight, deleteLine } = useBookContext();
  const { userScroll } = useCommonContext();
  const { lines } = useContentContext();

  const clearSelection = useCallback(() => {
    setPosition(undefined);
  }, []);

  const handleSelection = useCallback(
    (e: MouseEvent) => {
      // If clicking inside the menu, do nothing
      if (menuRef.current?.contains(e.target as Node)) {
        return;
      }

      // If detail is 2 (double-click) or more, abort immediately
      if (e.detail > 1) {
        clearSelection();
        return;
      }

      const { clientX } = e;
      startTimer(() => {
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
        const MENU_HEIGHT = 120 + (FEATURES.ENABLE_CAHPTER_EDIT ? +20 : 0) + (FEATURES.ENABLE_LINE_EDIT ? +20 : 0); // Approximate height of your menu
        const MENU_WIDTH = 160;
        let x = clientX + 10;
        let y = rect.bottom + MENU_HEIGHT;

        // Bottom Boundary Check
        if (y + MENU_HEIGHT > window.innerHeight) y = rect.top - 10;
        // Right Boundary Check
        if (x + MENU_WIDTH > window.innerWidth) x = rect.left - MENU_WIDTH;
        // Top Boundary Check
        y = Math.max(10, y);

        setPosition({ x, y, indices: selectedLineIndices, texts: text.split('\n') });
        userScroll();
      }, 0);
    },
    [startTimer, userScroll, clearSelection],
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
        clearSelection();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (position && position.texts) {
          const textToCopy = position.texts.join('\n');
          navigator.clipboard.writeText(textToCopy);
          clearSelection();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [position, clearSelection]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // 1. Get the list element (using the ID you defined: "book-lines")
      const listElement = document.getElementById('book-lines');
      const target = e.target as Node;

      // 2. If the click is NOT in the list AND NOT in the menu, close it
      const clickedInsideList = listElement?.contains(target);
      const clickedInsideMenu = menuRef.current?.contains(target);

      if (!clickedInsideList && !clickedInsideMenu) {
        clearSelection();
      }
    };

    // Use mousedown so it fires before the selection potentially clears
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clearSelection]);

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
          navigator.clipboard.writeText(position.texts.join('\n'));
          clearSelection();
        }}
      >
        <Copy />
        Copy
      </Button>

      <Button
        variant="ghost"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (position.indices.length > 1) {
            clearSelection();
            return;
          }
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

      {FEATURES.ENABLE_CAHPTER_EDIT && (
        <Button
          variant="ghost"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (position.indices.length > 1) {
              clearSelection();
              return;
            }
            toggleChapter(position.indices[0], lines[position.indices[0]]);
            clearSelection();
          }}
        >
          <Bookmark />
          {chapters.find((c) => position.indices[0] === c.startIndex) ? 'Not a chapter' : 'Mark as chapter'}
        </Button>
      )}

      {FEATURES.ENABLE_LINE_EDIT && (
        <Button
          variant="ghost"
          onMouseDown={(e) => e.preventDefault()}
          onClick={async () => {
            if (position.indices.length > 1) {
              clearSelection();
              return;
            }
            await deleteLine(position.indices[0]);
            clearSelection();
          }}
        >
          <Trash2 />
          Delete line
        </Button>
      )}
    </div>
  );
};
