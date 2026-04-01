export const FEATURES = {
  ENABLE_BOOK_SCRAPE: import.meta.env.VITE_BOOK_SCRAPE === 'true',
  ENABLE_BOOKMARK_EDIT: import.meta.env.VITE_BOOKMARK_EDIT === 'true',
  ENABLE_LINE_EDIT: import.meta.env.VITE_LINE_EDIT === 'true',
  ENABLE_SCROLL_TO_END: import.meta.env.VITE_SCROLL_TO_END === 'true',
};
