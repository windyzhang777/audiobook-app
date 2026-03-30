import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Book } from '@audiobook/shared';
import { CircleCheck, CircleMinus, Ellipsis, SquarePen } from 'lucide-react';

export type Action = 'rename' | 'delete' | 'reset-progress' | 'mark-as-completed';

interface BookItemContextMenuProps {
  book: Book;
  canAction: Action;
  toggleShowModal: (book: Book, action: Action) => void;
}

export const BookItemContextMenu = ({ book, toggleShowModal, canAction }: BookItemContextMenuProps) => {
  return (
    <Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open Menu"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
              }
            }}
            className="absolute bottom-3 right-1 w-5 h-5 hover:text-black"
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
            <DropdownMenuItem onSelect={() => toggleShowModal(book, canAction)}>
              <CircleCheck />
              Mark Progress...
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={() => toggleShowModal(book, 'rename')}>
                <SquarePen />
                Rename...
              </DropdownMenuItem>
            </DialogTrigger>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => toggleShowModal(book, 'delete')}>
              <CircleMinus />
              Remove...
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </Dialog>
  );
};
