import { useCallback, useEffect, useRef } from 'react';

export function useAnimationFrame() {
  const afRef = useRef<number | null>(null);

  const stopAnimationFrame = useCallback(() => {
    if (afRef.current !== null) {
      cancelAnimationFrame(afRef.current as unknown as number);
      afRef.current = null;
    }
  }, []);

  const startAnimationFrame = useCallback(
    (callback: () => void) => {
      stopAnimationFrame();
      afRef.current = requestAnimationFrame(callback);
    },
    [stopAnimationFrame],
  );

  useEffect(() => () => stopAnimationFrame(), [stopAnimationFrame]);

  return { startAnimationFrame, stopAnimationFrame };
}
