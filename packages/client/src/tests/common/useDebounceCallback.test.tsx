import { useDebounceCallback } from '@/common/useDebounceCallback';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('useDebounceCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should debounce the callback execution', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounceCallback(callback, 1000));

    act(() => {
      result.current.run('test');
    });

    // Should not be called yet
    expect(callback).not.toHaveBeenCalled();

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callback).toHaveBeenCalledWith('test');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should only call the callback once for multiple rapid calls', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounceCallback(callback, 1000));

    act(() => {
      result.current.run(1);
      result.current.run(2);
      result.current.run(3);
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(3); // Should use latest args
  });

  it('should execute immediately when flush is called', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounceCallback(callback, 5000));

    act(() => {
      result.current.run('instant');
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      result.current.flush();
    });

    expect(callback).toHaveBeenCalledWith('instant');
    expect(callback).toHaveBeenCalledTimes(1);

    // Ensure the original timeout doesn't fire again
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should update the callback reference without resetting the timer', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const { result, rerender } = renderHook(({ cb }) => useDebounceCallback(cb, 1000), { initialProps: { cb: callback1 } });

    act(() => {
      result.current.run('data');
    });

    // Rerender with a new function before timer finishes
    rerender({ cb: callback2 });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledWith('data');
  });
});
