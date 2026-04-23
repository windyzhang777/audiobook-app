import { Button } from '@/components//ui/button';
import type { Chapter } from '@audiobook/shared';
import { AudioLines, Undo } from 'lucide-react';

export const renderDeleteToaster = (index: number, onClick: () => Promise<void>): React.ReactNode => (
  <Button onClick={onClick} className="bg-highlight text-xs">
    <Undo size={16} className="hidden md:block" />
    <span className="font-semibold whitespace-nowrap">UNDO delete line {index}</span>
  </Button>
);

export const renderRateToaster = (rate: number): React.ReactNode => (
  <>
    <AudioLines size={16} className="hidden md:block" />
    <span className="font-semibold whitespace-nowrap">{rate}x</span>
  </>
);

export const renderChapterToaster = (chapter: Chapter): React.ReactNode => {
  if (!chapter?.title) return <></>;

  return <span className="font-semibold whitespace-nowrap">{chapter.title}</span>;
};
