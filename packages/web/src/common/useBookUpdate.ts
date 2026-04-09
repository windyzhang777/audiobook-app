import { useDebounceCallback } from '@/common/useDebounceCallback';
import { focusBody } from '@/utils';
import { FIVE_MINUTES } from '@audiobook/shared';
import { useEffect } from 'react';

export function useBookUpdate<T>(_id: string | undefined, updates: T, canUpdate: boolean, onUpdate: (id: string, data: T) => Promise<void>) {
  const { run: debounceUpdate, flush: flushUpdate } = useDebounceCallback(() => {
    if (_id) onUpdate(_id, updates);
  }, FIVE_MINUTES);

  useEffect(() => {
    if (_id && canUpdate) {
      debounceUpdate();
    }
  }, [_id, canUpdate, debounceUpdate]);

  useEffect(() => {
    const handlePageExit = () => {
      flushUpdate();
      focusBody();
    };

    document.addEventListener('visibilitychange', handlePageExit);
    window.addEventListener('beforeunload', handlePageExit);
    window.addEventListener('pagehide', handlePageExit);

    return () => {
      document.removeEventListener('visibilitychange', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
      window.removeEventListener('pagehide', handlePageExit);
      flushUpdate();
    };
  }, [flushUpdate]);

  return { flushUpdate };
}
