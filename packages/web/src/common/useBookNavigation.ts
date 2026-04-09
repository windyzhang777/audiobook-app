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

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const isSearchJumpingRef = useRef(false);
  const isViewLineVisibleRef = useRef(false);
  const shouldReadViewLineRef = useRef(false);

  const isUserScrollRef = useRef(true);
  const scrollMoodRef = useRef<ScrollMode>('tts');

  const userScroll = useCallback(() => {
    scrollMoodRef.current = 'user';
    isUserScrollRef.current = true;
  }, []);

  const ttsScroll = useCallback(() => {
    scrollMoodRef.current = 'tts';
    isUserScrollRef.current = false;
  }, []);

  const userJump = useCallback(() => {
    isSearchJumpingRef.current = true;
    startTimer(() => (isSearchJumpingRef.current = false), 300);
  }, [startTimer]);

  const scrollToLine = useCallback((index: number, behavior: LocationOptions['behavior'] = 'smooth') => {
    virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior, offset: 120 });
  }, []);

  const jumpToRead = (index: number) => {
    scrollToLine(index, 'auto');
    if (viewLine !== index) setViewLine(index);
    ttsScroll();
  };

  const jumpToIndex = async (index: number | undefined, shouldRead: boolean = false) => {
    if (index === undefined) return;

    if (index >= lines.length) {
      await loadMoreLines(0, index + PAGE_SIZE);
    }

    shouldReadViewLineRef.current = shouldRead;
    startAnimationFrame(() => scrollToLine(index, 'auto'));
    userJump();
    userScroll();

    if (viewLine !== index) setViewLine(index);
  };

  return {
    viewLine,
    setViewLine,
    virtuosoRef,
    isSearchJumpingRef,
    isViewLineVisibleRef,
    shouldReadViewLineRef,
    isUserScrollRef,
    scrollMoodRef,
    userScroll,
    ttsScroll,
    scrollToLine,
    jumpToRead,
    jumpToIndex,
  };
}
