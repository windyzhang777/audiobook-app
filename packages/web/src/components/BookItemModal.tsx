import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { bookTitleWithAuthor, kebabToTitle, type Book } from '@audiobook/shared';
import { Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Action } from './BookItemContextMenu';

interface BookItemModalProps {
  book: Book;
  showModal: boolean;
  toggleCloseModal: () => void;
  handleBookUpdateWithCover?: (selected: Book, file: File | null) => Promise<void>;
  handleBookDelete?: (selected: Book) => Promise<void>;
  handleBookMarkProgress?: (selected: Book) => Promise<void>;
  action?: Action;
}

export const BookItemDtoModal = ({ book, showModal, toggleCloseModal, handleBookUpdateWithCover }: BookItemModalProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newBook, setNewBook] = useState<Book>(book);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);

  if (!newBook) return null;

  return (
    <Dialog
      open={showModal}
      onOpenChange={() => {
        toggleCloseModal();
        setNewBook(book);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-sm font-semibold">Book Info</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-1 pt-5 border-t">
          <div className="flex items-center gap-2">
            <Label htmlFor="title" className="w-16">
              Title
            </Label>
            <Input id="title" defaultValue={book.title} onChange={(e) => setNewBook((prev) => ({ ...prev, title: e.target.value }))} />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="author" className="w-16">
              Author
            </Label>
            <Input id="author" defaultValue={book?.author} onChange={(e) => setNewBook((prev) => ({ ...prev, author: e.target.value }))} />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="cover" className="w-14">
              Cover
            </Label>
            <Input
              id="cover"
              type="file"
              className="hidden"
              ref={fileInputRef}
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setUploadingFile(file);
                const previewUrl = URL.createObjectURL(file);
                setNewBook((prev) => ({ ...prev, coverPath: previewUrl }));
                e.target.value = '';
              }}
            />

            <div className="cursor-pointer overflow-hidden rounded-lg border border-muted-foreground/25 hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
              <img src={newBook?.coverPath} alt="Preview" className="w-auto h-16 object-cover" />
            </div>

            <div className="grow" />
            <Button variant="ghost" title="Remove Cover" onClick={() => setNewBook((prev) => ({ ...prev, coverPath: '' }))} className="w-5 h-5 text-black/50 hover:text-black transition-colors">
              <Trash2 />
            </Button>
          </div>
        </div>
        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button type="button">Close</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="submit" onClick={() => handleBookUpdateWithCover?.(newBook, uploadingFile)}>
              Ok
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const BookItemConfirmDelete = ({ book, showModal, toggleCloseModal, handleBookDelete }: BookItemModalProps) => {
  if (!book) return null;

  return (
    <Dialog open={showModal} onOpenChange={toggleCloseModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-sm font-semibold">Delete {bookTitleWithAuthor(book)}</DialogTitle>
        </DialogHeader>

        <DialogFooter className="sm:justify-end [&>button]:w-16">
          <DialogClose asChild>
            <Button type="button">Close</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="submit" onClick={() => handleBookDelete?.(book)}>
              Yes
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const BookItemConfirmMarkProgress = ({ book, showModal, toggleCloseModal, handleBookMarkProgress, action }: BookItemModalProps) => {
  if (!book) return null;

  return (
    <Dialog open={showModal} onOpenChange={toggleCloseModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-sm font-semibold">
            {kebabToTitle(action)} for {bookTitleWithAuthor(book)}
          </DialogTitle>
        </DialogHeader>

        <DialogFooter className="sm:justify-end [&>button]:w-16">
          <DialogClose asChild>
            <Button type="button">Close</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="submit" onClick={() => handleBookMarkProgress?.(book)}>
              Yes
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
