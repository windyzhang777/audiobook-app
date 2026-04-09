import { useDebounceCallback } from '@/common/useDebounceCallback';
import { api } from '@/services/api';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useBookSearch(id: string | undefined, viewLine: number, jumpToIndex: (lineIndex: number | undefined, readIndex?: boolean) => Promise<void>, onOpenSearch: () => void) {
  const [searchText, setSearchText] = useState<string>('');
  const [searchRes, setSearchRes] = useState<number[]>([]);
  const [currentMatch, setCurrentMatch] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleBookSearch = async () => {
    const cleanSearchText = searchText.trim();
    if (!id || !cleanSearchText) {
      setSearchRes([]);
      return;
    }

    try {
      const { indices } = await api.books.search(id, cleanSearchText);
      setSearchRes(indices);
      if (!indices || indices.length === 0) return;

      // Find match as "nearest prev with forward fallback"
      let nearestMatchIndex = indices.findLastIndex((idx) => idx <= viewLine);
      if (nearestMatchIndex === -1) nearestMatchIndex = indices.findIndex((idx) => idx >= viewLine);
      setCurrentMatch(nearestMatchIndex);
      await jumpToIndex(indices[nearestMatchIndex]);
    } catch (error) {
      console.error('❌ Failed to search book:', error);
    }
  };

  const prevMatch = async () => {
    if (searchRes.length === 0) return;

    const prev = (currentMatch - 1 + searchRes.length) % searchRes.length;
    setCurrentMatch(prev);
    await jumpToIndex(searchRes[prev]);
  };

  const nextMatch = async () => {
    if (searchRes.length === 0) return;

    const next = (currentMatch + 1) % searchRes.length;
    setCurrentMatch(next);
    await jumpToIndex(searchRes[next]);
  };

  const openSearch = useCallback(() => {
    onOpenSearch();
    setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 100);
  }, [onOpenSearch]);

  const clearSearch = useCallback(() => {
    if (!searchText && searchRes.length === 0) return;

    setSearchText('');
    setSearchRes([]);
    setTimeout(() => {
      searchInputRef.current?.blur();
    }, 100);
  }, [searchText, searchRes.length]);

  const { run: debounceSearch } = useDebounceCallback(handleBookSearch, 800);

  useEffect(() => {
    debounceSearch();
  }, [searchText, debounceSearch]);

  // hijack the browser's default search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        openSearch();
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        clearSearch();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [clearSearch, openSearch]);

  return { searchInputRef, searchText, setSearchText, searchRes, currentMatch, prevMatch, nextMatch, openSearch, clearSearch };
}
