import { Button } from '@/components/ui/button';
import { useBookContext, useCommonContext, useSettingContext } from '@/config/contexts';
import { cn } from '@/lib/utils';
import { getChapter } from '@/utils';
import { calculateProgress } from '@audiobook/shared';
import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { RateContextMenu, VoiceContextMenu } from './BookControlContextMenu';

export const BookControl = () => {
  const { book, currentLine, totalLines, chapters } = useBookContext();
  const { isPlaying, handlePlayPause, prevLine, nextLine } = useCommonContext();
  const { rate, selectedVoice } = useSettingContext();

  const currentChapter = currentLine ? getChapter(currentLine, chapters) : undefined;

  if (!book || currentLine === undefined) return null;

  return (
    <div className={cn('fixed z-10 left-1/2 bottom-5 -translate-x-1/2 bg-background px-10 py-5 rounded-md shadow', 'flex flex-col gap-4 text-sm')}>
      <div className="text-black/50 text-xs flex justify-between items-center [&_span]:w-20">
        <span className="flex justify-start whitespace-nowrap">
          {currentLine} / {totalLines}
        </span>
        <Button variant="ghost" className="text-xs">
          {currentChapter?.title}
        </Button>
        <span className="flex justify-end">{calculateProgress(currentLine, totalLines)}%</span>
      </div>

      <div className="flex justify-center items-center gap-4 [&_button]:rounded-full! [&_button]:w-10! [&_button]:h-10! [&_span]:rounded-full! [&_span]:w-10! [&_span]:h-10!">
        <VoiceContextMenu title={selectedVoice.displayName} className="flex justify-start items-center bg-muted text-foreground truncate" />
        <Button size="icon" variant="ghost" id="jump-to-read" title="Previous Line" onClick={prevLine}>
          <RotateCcw />
        </Button>
        <Button variant="ghost" id={isPlaying ? 'pause' : 'play'} onClick={handlePlayPause} title={isPlaying ? 'Pause' : 'Play'} className="bg-primary">
          {isPlaying ? <Pause className="fill-background stroke-background" /> : <Play className="fill-background stroke-background" />}
        </Button>
        <Button size="icon" variant="ghost" id="jump-to-read" title="Previous Line" onClick={nextLine}>
          <RotateCw />
        </Button>
        <RateContextMenu title={`Speech rate: ${rate}x`} className="flex justify-center items-center bg-muted text-foreground text-sm" />
      </div>
    </div>
  );
};
