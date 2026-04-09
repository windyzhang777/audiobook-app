import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Book, BookAction } from '@audiobook/shared';
import { CircleCheck, CircleMinus, Ellipsis, SquarePen } from 'lucide-react';

interface BookItemContextMenuProps {
  book: Book;
  canAction: BookAction['type'];
  openAction: (type: BookAction['type'], book: Book) => void;
}

export const BookItemContextMenu = ({ book, canAction, openAction }: BookItemContextMenuProps) => {
  return (
    <Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Open Menu"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
              }
            }}
            className="absolute bottom-1 right-0 w-5 h-5"
          >
            <Ellipsis />
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
          className="w-full px-2"
        >
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => openAction(canAction, book)}>
              <CircleCheck />
              Mark Progress...
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={() => openAction('edit', book)}>
                <SquarePen />
                Rename...
              </DropdownMenuItem>
            </DialogTrigger>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => openAction('delete', book)}>
              <CircleMinus />
              Remove...
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </Dialog>
  );
};
