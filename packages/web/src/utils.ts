import type { Chapter } from '@audiobook/shared';

export const getChapterStartIndex = (chapterIndex: number, chapters: Chapter[] | undefined) => {
  if (!chapters || chapters.length <= 1) return undefined;
  const chapter = chapters[chapterIndex];
  return chapter?.startIndex ?? undefined;
};

export const getChapterIndex = (lineIndex: number, chapters: Chapter[] | undefined) => {
  if (!chapters || chapters.length <= 1) return 0;

  for (let i = chapters.length - 1; i >= 0; i--) {
    const startIndex = chapters[i]?.startIndex;
    if (startIndex === undefined) continue;
    if (startIndex <= lineIndex) return i;
  }
  return 0;
};

export const getChapter = (lineIndex: number, chapters: Chapter[] | undefined) => {
  if (!chapters || chapters.length <= 1) return undefined;

  for (let i = chapters.length - 1; i >= 0; i--) {
    const startIndex = chapters[i]?.startIndex;
    if (startIndex === undefined) continue;
    if (startIndex <= lineIndex) return chapters[i];
  }
  return undefined;
};

export const focusBody = () => {
  const activeElement = document.activeElement;
  document.body.focus();
  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }
};
