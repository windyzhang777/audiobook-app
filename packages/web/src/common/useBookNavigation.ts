import { focusBody } from '@/utils';
import { PAGE_SIZE, type Book } from '@audiobook/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type LocationOptions, type VirtuosoHandle } from 'react-virtuoso';
import { useAnimationFrame } from './useAnimationFrame';
import useTimer from './useTimer';

export type ScrollMode = 'user' | 'search' | 'tts';

export default function useBookNavigation(isPlaying: boolean, currentLine: number, lines: string[], loadMoreLines: (offset?: number, limit?: number) => Promise<void>) {
  const [viewLine, setViewLine] = useState<Book['currentLine']>(0);
  const [isCurrentLineVisible, setIsCurrentLineVisible] = useState(false);

  const { startTimer } = useTimer();
  const { startAnimationFrame } = useAnimationFrame();

  const viewLineRef = useRef(viewLine);
  const isCurrentLineVisibleRef = useRef(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const isSearchJumpingRef = useRef(false);
  const shouldReadViewLineRef = useRef(false);
  const isUserScrollRef = useRef(false);

  const updateViewLine = useCallback((index: number) => {
    viewLineRef.current = index;
    setViewLine(index);
  }, []);

  const userScroll = useCallback(() => {
    console.log(`userScroll`);
    isUserScrollRef.current = true;
  }, []);

  const ttsScroll = useCallback(() => {
    console.log(`ttsScroll`);
    isUserScrollRef.current = false;
    setIsCurrentLineVisible(true);
    focusBody();
  }, []);

  const userJump = useCallback(() => {
    isSearchJumpingRef.current = true;
    startTimer(() => (isSearchJumpingRef.current = false), 300);
  }, [startTimer]);

  const scrollToLine = useCallback(
    (index: number, behavior: LocationOptions['behavior'] = 'auto') => {
      console.log(`scrollToLine :`, behavior);
      startTimer(() => virtuosoRef.current?.scrollToIndex({ index, align: 'start', behavior }), 200);
    },
    [startTimer],
  );

  const jumpToRead = (index: number) => {
    scrollToLine(index);
    if (viewLineRef.current !== index) updateViewLine(index);
    ttsScroll();
  };

  const jumpToIndex = async (index: number | undefined, shouldRead: boolean = false) => {
    if (index === undefined) return;

    if (index >= lines.length) {
      await loadMoreLines(0, index + PAGE_SIZE);
    }

    shouldReadViewLineRef.current = shouldRead;
    startAnimationFrame(() => scrollToLine(index));
    userJump();
    userScroll();

    if (viewLineRef.current !== index) updateViewLine(index);
  };

  const checkLineVisibility = useCallback((index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const target = scroller.querySelector(`[data-item-index="${index}"]`);
    if (!target) return false;

    const scrollerRect = scroller.getBoundingClientRect();
    const itemRect = target.getBoundingClientRect();
    const isVisible = itemRect.top >= scrollerRect.top && itemRect.bottom <= scrollerRect.bottom;
    return isVisible;
  }, []);

  const updateIsCurrentLineVisible = useCallback(() => {
    const isVisible = checkLineVisibility(currentLine);
    isCurrentLineVisibleRef.current = isVisible || false;
    if (isCurrentLineVisibleRef.current !== isCurrentLineVisible) {
      setIsCurrentLineVisible(isCurrentLineVisibleRef.current);
    }
    return isVisible;
  }, [checkLineVisibility, currentLine, isCurrentLineVisible]);

  // tts autoscroll
  useEffect(() => {
    const isVisible = updateIsCurrentLineVisible();
    if (isUserScrollRef.current || isVisible || !isPlaying) return;
    scrollToLine(currentLine, 'smooth');

    if (!isSearchJumpingRef.current && currentLine !== viewLineRef.current) {
      startTimer(() => updateViewLine(currentLine), 100);
    }
  }, [updateIsCurrentLineVisible, isPlaying, currentLine, scrollToLine, startTimer, updateViewLine]);

  // update line visibility on lines change
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateIsCurrentLineVisible();
      });
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [updateIsCurrentLineVisible]);

  return {
    viewLine,
    updateViewLine,
    viewLineRef,
    isCurrentLineVisible,
    virtuosoRef,
    scrollerRef,
    isSearchJumpingRef,
    shouldReadViewLineRef,
    userScroll,
    ttsScroll,
    scrollToLine,
    jumpToRead,
    jumpToIndex,
  };
}
