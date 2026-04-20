import { Slider as SliderPrimitive } from 'radix-ui';
import * as React from 'react';

import { useBookContext, useCommonContext } from '@/config/contexts';
import { cn } from '@/lib/utils';
import { getChapter } from '@/utils';
import { calculateProgress } from '@audiobook/shared';
import { useState } from 'react';

function Slider({ id, className, defaultValue, value, min = 0, max = 100, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(() => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]), [value, defaultValue, min, max]);

  const { isPlaying, viewLine, jumpToRead } = useCommonContext();

  const [isVisible, setIsVisible] = useState(false);
  const { currentLine, chapters } = useBookContext();
  const [hoverPercentage, setHoverPercentage] = useState<number>();

  const hoverLine = hoverPercentage !== undefined ? Math.round((hoverPercentage * max) / 100) : undefined;
  const currentPercentage = currentLine !== undefined ? (currentLine / max) * 100 : undefined;
  const currentChapter = currentLine ? getChapter(currentLine, chapters) : undefined;
  const hoverChapter = hoverLine ? getChapter(hoverLine, chapters) : undefined;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setHoverPercentage(percentage);
  };

  React.useEffect(() => {
    if (hoverPercentage !== undefined) {
      setIsVisible(false);
    } else {
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [hoverPercentage]);

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverPercentage(undefined)}
      className={cn(
        'relative flex w-full touch-none items-center select-none group data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col cursor-pointer',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="relative grow overflow-hidden rounded-xs bg-muted data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1">
        <SliderPrimitive.Range data-slot="slider-range" className="absolute bg-primary select-none data-horizontal:h-full data-vertical:w-full" />
      </SliderPrimitive.Track>

      {/* Current Line */}
      {id === 'progress' && currentPercentage !== undefined && currentLine !== undefined && (
        <div className="absolute flex flex-col items-center cursor-pointer z-10" style={{ left: `${currentPercentage}%`, top: '50%', transform: 'translate(-50%, -50%)' }}>
          {/* View Thumb */}
          {currentLine !== viewLine && (
            <div id="jump-to-read" title="Jump To Read" onClick={jumpToRead} className="size-4 rounded-full border border-input bg-primary ring-ring/50 transition-[color,box-shadow] hover:ring-3" />
          )}
          {/* View Info */}
          <div
            className={`absolute bottom-full mb-2 bg-primary text-primary-foreground text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none opacity-0 ${hoverPercentage === undefined && isVisible && !isPlaying ? 'group-hover:opacity-100' : ''} duration-100 transition-opacity`}
          >
            <div>
              Progress: {currentLine} / {max} ({calculateProgress(currentLine, max)}%)
            </div>
            {currentChapter ? <div>{currentChapter.title}</div> : null}
          </div>
        </div>
      )}

      {/* Hover */}
      {id === 'progress' && hoverPercentage !== undefined && hoverLine !== undefined && currentLine !== undefined && Math.abs(hoverLine - currentLine) > 100 && (
        <div className="absolute flex flex-col items-center cursor-pointer z-10" style={{ left: `${hoverPercentage}%`, top: '50%', transform: 'translate(-50%, -50%)' }}>
          {/* Hover Thumb */}
          <div className="size-4 rounded-full border border-input bg-white ring-ring/50 transition-[color,box-shadow] hover:ring-3" />
          {/* Hover Info */}
          <div className="absolute bottom-full mb-2 bg-primary text-primary-foreground text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none">
            <div>
              Progress: {Math.round((hoverPercentage / 100) * max)} / {max} ({Math.round(hoverPercentage)}%)
            </div>
            {hoverChapter ? <div>{hoverChapter.title}</div> : null}
          </div>
        </div>
      )}

      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={`relative block size-4 shrink-0 rounded-full border border-input ${id === 'progress' && currentLine === viewLine ? 'bg-primary' : 'bg-white'} ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50`}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
