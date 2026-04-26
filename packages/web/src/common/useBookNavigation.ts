import { focusBody } from '@/utils';
import { PAGE_SIZE, type Book } from '@audiobook/shared';
import { useCallback, useRef, useState } from 'react';
import { type LocationOptions, type VirtuosoHandle } from 'react-virtuoso';
import { useAnimationFrame } from './useAnimationFrame';
import useTimer from './useTimer';

export type ScrollMode = 'user' | 'search' | 'tts';

export default function useBookNavigation(lines: string[], loadMoreLines: (offset?: number, limit?: number) => Promise<void>) {
  const [viewLine, setViewLine] = useState<Book['currentLine']>(0);

  const { startTimer } = useTimer();
  const { startAnimationFrame } = useAnimationFrame();

  const viewLineRef = useRef(viewLine);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
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
    focusBody();
  }, []);

  const userJump = useCallback(() => {
    isSearchJumpingRef.current = true;
    startTimer(() => (isSearchJumpingRef.current = false), 300);
  }, [startTimer]);

  const scrollToLine = useCallback(
    (index: number, behavior: LocationOptions['behavior'] = 'auto') => {
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

  return {
    viewLine,
    updateViewLine,
    viewLineRef,
    virtuosoRef,
    isSearchJumpingRef,
    shouldReadViewLineRef,
    isUserScrollRef,
    userScroll,
    ttsScroll,
    scrollToLine,
    jumpToRead,
    jumpToIndex,
  };
}
