import { api } from '@/services/api';
import { ALL_LINES, type BookMark } from '@audiobook/shared';

export function useSaveToLocal() {
  const saveBookmarksToLocal = (title: string | undefined, bookmarks: BookMark[]) => {
    if (!title || bookmarks.length === 0) return;

    const value = JSON.stringify({ title, bookmarks, savedAt: new Date().toISOString() });
    localStorage.setItem(title, value);
    alert(`Bookmarks for [${title}] saved!`);
  };

  const importBookmarksFromLocal = async (_id: string, title: string, bookmarks: BookMark[]): Promise<BookMark[] | undefined> => {
    if (!_id || !title) return;

    const { lines } = await api.books.getContent(_id, 0, ALL_LINES);
    if (!lines || lines.length === 0) return;

    const found = localStorage.getItem(title);
    if (!found) {
      alert(`Book ${title} not found!`);
      return;
    }

    try {
      const parsed = JSON.parse(found);
      const storedBookmarks: BookMark[] = parsed?.bookmarks || [];
      const repairedMap = new Map();
      bookmarks.forEach((bookmark) => repairedMap.set(bookmark.text, bookmark.index));

      if (!parsed || !storedBookmarks || !Array.isArray(storedBookmarks) || storedBookmarks.length === 0) return;

      storedBookmarks.forEach((stored: BookMark) => {
        let actualIndex = stored.index;
        const storedText = stored.text;
        const searchPhrase = storedText.endsWith('...') ? storedText.slice(0, -3) : storedText;
        const currentLineAtOldIndex = lines[actualIndex] || '';
        const isMatch = currentLineAtOldIndex.startsWith(searchPhrase);

        if (!isMatch) {
          console.warn(`Index mismatch for truncated text. Searching for: "${searchPhrase.slice(0, 20)}..."`);
          const newIndex = lines.findIndex((line: string) => line.startsWith(searchPhrase));

          if (newIndex !== -1) {
            actualIndex = newIndex;
          } else {
            console.error(`Could not find text in book: "${searchPhrase.slice(0, 20)}..."`);
            // Skip this bookmark if the text is completely gone
            return;
          }
        }

        repairedMap.set(storedText, actualIndex);
      });

      return Array.from(repairedMap.entries())
        .map(([text, index]) => ({ index, text }))
        .sort((a, b) => a.index - b.index);
    } catch (error) {
      console.error('❌ Failed to parse book from local:', error);
    }
  };

  return { saveBookmarksToLocal, importBookmarksFromLocal };
}
