import { useUpdateBook } from '@/common/useUpdateBook';
import { api } from '@/services/api';
import { FIVE_MINUTES } from '@audiobook/shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the API
vi.mock('@/services/api', () => ({
  api: {
    books: {
      update: vi.fn(),
    },
  },
}));

describe('useUpdateBook', () => {
  const mockId = 'book-123';
  const mockUpdatedData = { currentLine: 50 };
  const setBook = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call debounceUpdate when canUpdate is true', async () => {
    renderHook(() => useUpdateBook(mockId, mockUpdatedData, true, setBook));

    expect(api.books.update).not.toHaveBeenCalled(); // 5min debounce

    await act(async () => vi.advanceTimersByTime(FIVE_MINUTES));
    expect(api.books.update).toHaveBeenCalledWith(mockId, mockUpdatedData);
    expect(setBook).toHaveBeenCalled();
  });

  it('should not call update if canUpdate is false', () => {
    renderHook(() => useUpdateBook(mockId, mockUpdatedData, false, setBook));

    vi.advanceTimersByTime(FIVE_MINUTES);
    expect(api.books.update).not.toHaveBeenCalled();
  });

  it('should flush updates immediately when flushUpdate is called', async () => {
    const { result } = renderHook(() => useUpdateBook(mockId, mockUpdatedData, true, setBook));

    await act(async () => result.current.flushUpdate());
    expect(api.books.update).toHaveBeenCalledWith(mockId, mockUpdatedData);
  });

  it('should flush updates when window is reloaded (beforeunload)', async () => {
    renderHook(() => useUpdateBook(mockId, mockUpdatedData, true, setBook));

    // Simulate the browser closing/reloading
    await act(async () => window.dispatchEvent(new Event('beforeunload')));
    expect(api.books.update).toHaveBeenCalled();
  });

  it('should flush updates when tab becomes hidden (visibilitychange)', async () => {
    renderHook(() => useUpdateBook(mockId, mockUpdatedData, true, setBook));

    // Simulate switching apps on mobile
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(api.books.update).toHaveBeenCalled();
  });
});
