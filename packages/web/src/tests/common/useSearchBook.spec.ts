import { useSearchBook } from '@/common/useSearchBook';
import { api } from '@/services/api';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({
  api: { books: { search: vi.fn() } },
}));

describe('useSearchBook', () => {
  const mockId = 'book-1';
  const jumpToIndex = vi.fn().mockResolvedValue(undefined);
  const forceControl = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers search after debounce when searchText changes', async () => {
    const mockIndices = [10, 20, 30];
    vi.mocked(api.books.search).mockResolvedValue({ indices: mockIndices, count: mockIndices.length });

    const { result } = renderHook(() => useSearchBook(mockId, 0, jumpToIndex, forceControl));

    act(() => result.current.setSearchText('chapter'));
    expect(api.books.search).not.toHaveBeenCalled(); // 800ms debounce

    await act(async () => vi.advanceTimersByTime(800));
    expect(api.books.search).toHaveBeenCalledWith(mockId, 'chapter');
    expect(result.current.searchRes).toEqual(mockIndices);
  });

  it('navigates to the nearest match (prev with forward fallback)', async () => {
    const mockIndices = [5, 15, 25]; // currentLine is 20
    vi.mocked(api.books.search).mockResolvedValue({ indices: mockIndices, count: mockIndices.length });

    const { result } = renderHook(() => useSearchBook(mockId, 20, jumpToIndex, forceControl));

    await act(async () => result.current.setSearchText('test'));
    await act(async () => vi.advanceTimersByTime(800));

    // Line 20 is between 15 and 25. Nearest prev is 15 (index 1 in searchRes).
    expect(result.current.currentMatch).toBe(1);
    expect(jumpToIndex).toHaveBeenCalledWith(15);
  });

  it('handles nextMatch and prevMatch correctly (looping)', async () => {
    const mockIndices = [10, 20];
    vi.mocked(api.books.search).mockResolvedValue({ indices: mockIndices, count: mockIndices.length });

    const { result } = renderHook(() => useSearchBook(mockId, 0, jumpToIndex, forceControl));

    await act(async () => result.current.setSearchText('query'));
    await act(async () => vi.advanceTimersByTime(800));

    // Start at index 0 (line 10)
    act(() => result.current.nextMatch());
    expect(result.current.currentMatch).toBe(1);

    // Loop back to index 0
    act(() => result.current.nextMatch());
    expect(result.current.currentMatch).toBe(0);

    // Loop backward to index 1
    act(() => result.current.prevMatch());
    expect(result.current.currentMatch).toBe(1);
  });

  it('hijacks Cmd+F/Ctrl+F to focus search input', async () => {
    renderHook(() => useSearchBook(mockId, 0, jumpToIndex, forceControl));

    const event = new KeyboardEvent('keydown', {
      key: 'f',
      metaKey: true, // Cmd on Mac
      cancelable: true,
    });

    act(() => window.dispatchEvent(event));
    expect(forceControl).toHaveBeenCalledWith(true, 'user');
    vi.advanceTimersByTime(100);
  });

  it('clears search on Escape key', async () => {
    const { result } = renderHook(() => useSearchBook(mockId, 0, jumpToIndex, forceControl));

    await act(() => result.current.setSearchText('searching...'));
    await act(async () => vi.advanceTimersByTime(800));
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(result.current.searchText).toBe('');
    expect(result.current.searchRes).toEqual([]);
  });
});
