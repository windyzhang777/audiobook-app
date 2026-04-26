import { Button } from '@/components//ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Dialog } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import { useContentContext, useSettingContext, useSpeechContext } from '@/config/contexts';
import { MAX_RATE, MIN_RATE, RATE_DEFAULT, RATE_STEP } from '@audiobook/shared';
import { Minus, Plus } from 'lucide-react';

interface BookControlContextMenuProps {
  title: string;
  className: string;
}
export const VoiceContextMenu = (props: BookControlContextMenuProps) => {
  const { lang } = useContentContext();
  const { setVoice, selectedVoice, availableVoices } = useSettingContext();
  const { isPlaying, resume } = useSpeechContext();

  return (
    <Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            {...props}
            size="icon"
            variant="ghost"
            aria-label="Open Menu"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
              }
            }}
          >
            {lang}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
            }
          }}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="w-full max-h-100 min-h-0 flex-1 p-6 no-scrollbar overflow-y-auto overflow-x-hidden"
        >
          <div className="flex flex-col gap-2">
            <div className="uppercase text-xs">voice</div>
            <ButtonGroup className="flex-wrap w-full gap-2">
              {availableVoices.map((option) => (
                <Button
                  key={option.id}
                  size="icon"
                  variant={selectedVoice.id === option.id ? 'default' : 'outline'}
                  onClick={() => {
                    setVoice(option.id);
                    if (isPlaying) resume();
                  }}
                  title={option.displayName}
                  className="px-2 w-30 border! border-sidebar-accent! truncate"
                >
                  <span className="w-full truncate">{option.displayName}</span>
                </Button>
              ))}
            </ButtonGroup>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </Dialog>
  );
};

export const RateContextMenu = (props: BookControlContextMenuProps) => {
  const { rate, setRate } = useSettingContext();
  const { isPlaying, resume } = useSpeechContext();

  return (
    <Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            {...props}
            size="icon"
            variant="ghost"
            aria-label="Open Menu"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
              }
            }}
          >
            {rate}x
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
            }
          }}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="w-full p-6"
        >
          <div className="flex flex-col gap-4 w-40">
            <ButtonGroup className="flex justify-between items-center gap-4 w-full">
              <Button
                size="icon"
                variant="secondary"
                disabled={rate! <= MIN_RATE}
                onClick={() => {
                  const newRate = Math.max(MIN_RATE, rate! - RATE_STEP);
                  setRate(newRate);
                  if (isPlaying) resume();
                }}
              >
                <Minus strokeWidth={1} className="w-6! h-6!" />
              </Button>
              <span className="font-semibold">{rate}x</span>
              <Button
                size="icon"
                variant="secondary"
                disabled={rate! >= MAX_RATE}
                onClick={() => {
                  const newRate = Math.min(MAX_RATE, rate! + RATE_STEP);
                  setRate(newRate);
                  if (isPlaying) resume();
                }}
              >
                <Plus strokeWidth={1} className="w-6! h-6!" />
              </Button>
            </ButtonGroup>

            <ButtonGroup className="flex justify-between items-center gap-2 w-full">
              <Button
                size="icon"
                variant="secondary"
                onClick={() => {
                  setRate(0.8);
                  if (isPlaying) resume();
                }}
                className="grow"
              >
                0.8x
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={() => {
                  setRate(1.0);
                  if (isPlaying) resume();
                }}
                className="grow"
              >
                1x
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={() => {
                  setRate(1.2);
                  if (isPlaying) resume();
                }}
                className="grow"
              >
                1.2x
              </Button>
            </ButtonGroup>
            <Slider
              value={[rate || RATE_DEFAULT]}
              onValueChange={async (indices: number[]) => {
                const newRate = indices[0];
                setRate(newRate);
                if (isPlaying) resume();
              }}
              min={MIN_RATE}
              max={MAX_RATE}
              step={RATE_STEP}
              className="mt-2"
            />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </Dialog>
  );
};
