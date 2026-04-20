import { useCallback, useRef, useState } from 'react';
import useTimer from './useTimer';

export default function useScroll() {
  const { startTimer } = useTimer();
  const [scrollPos, setScrollPos] = useState({ isAtTop: true, isAtBottom: false });
  const listRef = useRef<HTMLDivElement>(null);

  const onScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    setScrollPos({
      isAtTop: scrollTop <= 5,
      isAtBottom: scrollTop + clientHeight >= scrollHeight - 1,
    });
  };

  const scrollToView = useCallback(
    (index: number | undefined) => {
      if (index === undefined || index < 0) return;

      const targetElement = listRef.current?.children[index] as HTMLElement;
      if (targetElement) {
        startTimer(() => targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }), 50);
      }
    },
    [startTimer],
  );

  const scrollToTop = () => listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  const scrollToBottom = () => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });

  return { listRef, isAtTop: scrollPos.isAtTop, isAtBottom: scrollPos.isAtBottom, onScroll, scrollToView, scrollToTop, scrollToBottom };
}
