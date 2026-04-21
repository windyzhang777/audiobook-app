import { BindingLine, BookItemContextMenu, BookItemPlaceholder } from '@/components/BookItem';
import { Button } from '@/components/ui/button';
import { bookTitleWithAuthor, calculateProgress, formatLocaleDateString, type Book, type BookAction } from '@audiobook/shared';
import { BadgeCheck, BellRing, CircleChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BookItemProps {
  book: Book;
  isSelected: boolean;
  selectBook: () => void;
  hasNewChapters: boolean;
  updateChapters: () => Promise<Book | null>;
  canAction: BookAction['type'];
  openAction: (type: BookAction['type'], book: Book) => void;
}

export const BookItem = ({ book, isSelected, selectBook, hasNewChapters, updateChapters, canAction, openAction }: BookItemProps) => {
  const navigate = useNavigate();

  const progress = calculateProgress(book.currentLine, book.totalLines);

  return (
    <div
      role="button"
      tabIndex={0}
      key={`book-${book._id}`}
      aria-label={`Book ${book._id}`}
      onClick={selectBook}
      onDoubleClick={() => navigate(`/book/${book._id}`)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/book/${book._id}`);
        }
      }}
      title={bookTitleWithAuthor(book)}
      className={`relative aspect-3/5 w-40 rounded-md overflow-hidden pt-8 pb-10 px-2 ${isSelected ? 'bg-muted-foreground/10' : ''} transition-all cursor-pointer group`}
    >
      <div className="relative w-full h-full overflow-hidden">
        {book.coverPath ? (
          <>
            <img
              src={book.coverPath.startsWith('blob:') || book.coverPath.startsWith('data:') ? book.coverPath : `${import.meta.env.VITE_API_URL}${book.coverPath}`}
              alt={`${book.title} cover`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-100"
              onError={(e) => (e.currentTarget.src = '')}
            />
            <BindingLine />
          </>
        ) : (
          <BookItemPlaceholder title={book.title} author={book?.author} />
        )}
      </div>

      {book.source === 'web' && hasNewChapters ? (
        <Button
          size="icon"
          variant="ghost"
          aria-label="has-new-chapter"
          title="Has new chapters!"
          onClick={(e) => {
            e.stopPropagation();
            updateChapters();
          }}
          className="absolute top-9.5 left-3.5 h-7 w-7 rounded-full! shake-active bg-white text-amber-600"
        >
          <BellRing />
        </Button>
      ) : null}

      {/* Badge / Progress Indicator */}
      {book.lastCompleted ? (
        <span className="absolute bottom-3.5 left-2 w-[75%] text-[10px] text-muted-foreground flex items-center gap-1 text-left pointer-events-none">
          <BadgeCheck strokeWidth={1} className="w-3.5 h-3.5 fill-primary stroke-background" />
          <span>{formatLocaleDateString(new Date(book.lastReadAt || book.updatedAt))}</span>
        </span>
      ) : book.currentLine === 0 ? (
        <span className="absolute bottom-3 left-2 w-[75%] text-[10px] flex items-center gap-1 text-left pointer-events-none">
          <CircleChevronRight strokeWidth={1} className="w-4 h-4 fill-green-600 stroke-background" />
          <span className="w-full truncate justify-start">{book.title}</span>
        </span>
      ) : (
        <span className="absolute bottom-3.5 left-2 w-[75%] text-[10px] flex items-center gap-1 text-left pointer-events-none">
          <span
            className="flex items-center justify-center rounded-md border text-muted-foreground shrink-0 h-4 px-1 text-[8px] font-medium"
            style={{
              background: `linear-gradient(to right, var(--muted) ${progress}%, transparent ${progress}%)`,
            }}
          >
            {progress}%
          </span>
          <span className="w-full truncate justify-start">{book.title}</span>
        </span>
      )}

      {/* Ellipsis */}
      <BookItemContextMenu book={book} canAction={canAction} openAction={openAction} />
    </div>
  );
};
