import { useDebounceCallback } from '@/common/useDebounceCallback';
import { api } from '@/services/api';
import { focusBody } from '@/utils';
import { type SearchMatch } from '@audiobook/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useBookSearch(
  id: string | undefined,
  viewLine: number,
  jumpToIndex: (lineIndex: number | undefined, readIndex?: boolean) => Promise<void>,
  onOpenSearch: () => void,
  onCloseSearch: () => void,
) {
  const [searchText, setSearchText] = useState<string>('');
  const [searchRes, setSearchRes] = useState<SearchMatch[]>([]);
  const [currentMatch, setCurrentMatch] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleBookSearch = async () => {
    const cleanSearchText = searchText.trim();
    if (!id || !cleanSearchText) {
      setSearchRes([]);
      return;
    }

    try {
      const { matches } = await api.books.search(id, cleanSearchText);
      setSearchRes(matches);
      if (!matches || matches.length === 0) return;

      // Find match as "nearest prev with forward fallback"
      let nearestMatchIndex = matches.findLastIndex((match) => match.index <= viewLine);
      if (nearestMatchIndex === -1) nearestMatchIndex = matches.findIndex((match) => match.index >= viewLine);
      setCurrentMatch(nearestMatchIndex);
      // await jumpToIndex(indices[nearestMatchIndex]);
    } catch (error) {
      console.error('❌ Failed to search book:', error);
    }
  };

  const clickMatch = async (index: number) => {
    if (searchRes.length === 0) return;

    setCurrentMatch(index);
    await jumpToIndex(searchRes[index].index);
  };

  const prevMatch = async () => {
    if (searchRes.length === 0) return;

    // const prev = (currentMatch - 1 + searchRes.length) % searchRes.length;
    const prev = Math.max(0, currentMatch - 1);
    setCurrentMatch(prev);
    await jumpToIndex(searchRes[prev].index);
  };

  const nextMatch = async () => {
    if (searchRes.length === 0) return;

    // const next = (currentMatch + 1) % searchRes.length;
    const next = Math.min(currentMatch + 1, searchRes.length - 1);
    setCurrentMatch(next);
    await jumpToIndex(searchRes[next].index);
  };

  const openSearch = useCallback(() => {
    onOpenSearch();
    searchInputRef.current?.focus();
  }, [onOpenSearch]);

  const closeSearch = useCallback(() => {
    onCloseSearch();
    setTimeout(() => {
      searchInputRef.current?.blur();
    }, 100);
    focusBody();
  }, [onCloseSearch]);

  const clearSearch = useCallback(() => {
    if (!searchText && searchRes.length === 0) return;

    setSearchText('');
    setSearchRes([]);
    closeSearch();
  }, [searchText, searchRes.length, closeSearch]);

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

  return { searchInputRef, searchText, setSearchText, searchRes, currentMatch, clickMatch, prevMatch, nextMatch, openSearch, closeSearch };
}
