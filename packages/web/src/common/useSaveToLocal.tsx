import type { BookMark } from '@audiobook/shared';

export function useSaveToLocal() {
  const saveBookmarksToLocal = (title: string | undefined, bookmarks: BookMark[]) => {
    if (!title || bookmarks.length === 0) return;

    const value = JSON.stringify({ title, bookmarks, savedAt: new Date().toISOString() });
    localStorage.setItem(title, value);
    alert(`Bookmarks for [${title}] saved!`);
  };

  const importBookmarksFromLocal = (title: string | undefined, bookmarks: BookMark[]): BookMark[] | undefined => {
    if (!title) return;

    const found = localStorage.getItem(title);
    if (!found) {
      alert(`Book ${title} not found!`);
      return;
    }

    try {
      const parsed = JSON.parse(found);
      if (!parsed || !parsed.bookmarks || !Array.isArray(parsed.bookmarks) || parsed.bookmarks.length === 0) return;

      const mergedMap = new Map();
      parsed.bookmarks.forEach((bookmark: BookMark) => mergedMap.set(bookmark.index, bookmark.text));
      bookmarks.forEach((bookmark) => mergedMap.set(bookmark.index, bookmark.text));
      return Array.from(mergedMap.entries())
        .map(([index, text]) => ({ index, text }))
        .sort((a, b) => a.index - b.index);
    } catch (error) {
      console.error('Failed to parse book from local:', error);
    }
  };

  return { saveBookmarksToLocal, importBookmarksFromLocal };
}
