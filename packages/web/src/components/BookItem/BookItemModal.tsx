import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type Book } from '@audiobook/shared';
import { Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

interface BookItemModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
}

interface EditBookInfoProps extends BookItemModalProps {
  book: Book;
  onConfirm: (_id: string, updates: Partial<Book>, file: File | undefined) => Promise<void>;
}

export const EditBookInfo = ({ open, onClose, title, onConfirm, book }: EditBookInfoProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [updates, setUpdates] = useState<Partial<Book>>(book);
  const [uploadingFile, setUploadingFile] = useState<File>();

  if (!updates) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        onClose();
        setUpdates(book);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="px-8 leading-relaxed text-center font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-1 pt-5 border-t">
          <div className="flex items-center gap-2">
            <Label htmlFor="title" className="w-16">
              Title
            </Label>
            <Input id="title" defaultValue={updates.title} onChange={(e) => setUpdates((prev) => ({ ...prev, title: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="author" className="w-16">
              Author
            </Label>
            <Input id="author" defaultValue={updates?.author} onChange={(e) => setUpdates((prev) => ({ ...prev, author: e.target.value }))} />
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
                setUpdates((prev) => ({ ...prev, coverPath: previewUrl }));
                e.target.value = '';
              }}
            />

            <div className="cursor-pointer overflow-hidden rounded-lg border border-muted-foreground/25 hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
              <img src={updates.coverPath || undefined} alt="Preview" className="w-auto h-16 object-cover" />
            </div>

            <div className="grow" />
            <Button variant="ghost" title="Remove Cover" onClick={() => setUpdates((prev) => ({ ...prev, coverPath: '' }))} className="w-5 h-5 text-black/50 hover:text-black transition-colors">
              <Trash2 />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">Close</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="submit" onClick={() => onConfirm?.(book._id, updates, uploadingFile)}>
              Ok
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface ConfirmModalProps extends BookItemModalProps {
  onConfirm: () => Promise<void>;
}

export const ConfirmModal = ({ open, onClose, title, description, confirmText = 'Confirm', cancelText = 'Close', onConfirm }: ConfirmModalProps) => (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="px-8 leading-relaxed text-center font-semibold">{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">{cancelText}</Button>
        </DialogClose>
        <DialogClose asChild>
          <Button variant="default" onClick={onConfirm}>
            {confirmText}
          </Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
