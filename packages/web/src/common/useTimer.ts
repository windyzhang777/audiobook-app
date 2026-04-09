import { useCallback, useEffect, useRef } from 'react';

export default function useTimer() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (callback: () => void, delay: number = 0) => {
      stopTimer();
      timerRef.current = setTimeout(() => {
        callback();
      }, delay);
    },
    [stopTimer],
  );

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  return { timerRef, startTimer, stopTimer };
}
