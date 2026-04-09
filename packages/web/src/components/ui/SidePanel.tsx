import { cn } from '@/lib/utils';
import { focusBody } from '@/utils';
import React, { useEffect } from 'react';

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  direction?: 'left' | 'right';
  className?: string;
}

export const SidePanel = ({ open, onClose, children, direction = 'right', ...props }: SidePanelProps) => {
  // hijack the browser's default escape
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === 'Escape') {
        focusBody();
      }
    };
    if (open) window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [open, onClose]);

  return (
    <div
      id={`side-panel-${direction}`}
      className={cn(
        props.className,
        'fixed z-0 top-18 bottom-0 w-80 bg-background border-muted py-4 flex h-auto flex-col text-sm text-popover-foreground text-left',
        'transition-transform duration-300 ease-in-out',
        'w-[clamp(40px,80%,180px)] md:w-[clamp(40px,1/6,180px)] sm:max-w-sm',
        direction === 'right' ? 'right-0 border-l rounded-l-xs' : 'left-0 border-r rounded-r-xs',
        !open && (direction === 'right' ? 'translate-x-full' : '-translate-x-full'),
      )}
    >
      {children}
    </div>
  );
};
