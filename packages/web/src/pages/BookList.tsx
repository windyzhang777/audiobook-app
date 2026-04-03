import { useBookAction } from '@/common/useBookAction';
import { useBooks } from '@/common/useBooks';
import { useBookScrape } from '@/common/useBookScrape';
import { useBookUpload } from '@/common/useBookUpload';
import { useScrapeUpdates } from '@/common/useScrapeUpdates';
import { BookItem, ConfirmModal, EditBookInfo } from '@/components/BookItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrapeProgress, UploadProgress } from '@/components/UploadProgress';
import { FEATURES } from '@/config/features';
import { getBookActionLabel, type Book } from '@audiobook/shared';
import { BookOpen, LinkIcon, Loader, Loader2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const BookList = () => {
  const { t } = useTranslation();

  const [showFinished, setShowFinished] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const { books, loading, loadBooks, updateBook, deleteBook } = useBooks(); // fetch data & CRUD
  const { pendingAction, closeAction, openAction } = useBookAction(); // action on book menu & modal
  const { uploadingFile, status, progress, error: errorUpload, startUpload, cancleUpload } = useBookUpload(() => loadBooks()); // upload local book
  const {
    scrapeUrl,
    setScrapeUrl,
    isScraping,
    scrapeProgress,
    error: errorScrape,
    startScrape,
    stopScrape,
  } = useBookScrape(
    () => setShowUrlInput(false),
    () => loadBooks(),
  ); // scrape web book
  const { updatedBooks, updateChapters } = useScrapeUpdates(books); // scrape web book chapter updates

  const booksCompleted = useMemo(
    () =>
      books
        .filter((book) => book.lastCompleted)
        .sort((a, b) => {
          if (!a.lastReadAt) return 1;
          if (!b.lastReadAt) return -1;
          return b.lastReadAt.localeCompare(a.lastReadAt);
        }),
    [books],
  );

  const booksToRead = useMemo(
    () =>
      books
        .filter((book) => !book.lastCompleted)
        .sort((a, b) => {
          if (!a.updatedAt) return 1;
          if (!b.updatedAt) return -1;
          return b.updatedAt.localeCompare(a.updatedAt);
        }),
    [books],
  );

  // hijack the browser's default escape
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAction();
        setShowUrlInput(false);
        setSelectedBook(null);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [closeAction]);

  if (loading) {
    return (
      <div aria-label="loading" className="min-h-full flex justify-center items-center gap-2">
        <Loader /> Loading books...
      </div>
    );
  }

  return (
    <div className="min-h-full max-w-md md:max-w-2xl lg:max-w-4xl mx-auto pt-8 pb-30 px-6 flex flex-col">
      {/* Header */}
      <header className="text-center mb-4">
        <h3 className="font-semibold">My Books</h3>
      </header>

      {/* File Upload & Scrape Controls */}
      <div className="flex flex-col gap-3 mb-6 text-sm">
        {/* Button group */}
        <div className="flex flex-wrap grow gap-2 justify-center md:justify-start">
          {/* Upload button */}
          <label
            htmlFor="file-upload"
            title="Upload a book from local (txt, epub)"
            className="grow flex justify-center items-center gap-2 px-4 py-1 bg-primary text-primary-foreground hover:bg-primary/80 rounded-sm whitespace-nowrap cursor-pointer transition-colors focus-visible:border-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Upload size={16} />
            <span className="hidden sm:inline font-medium">Upload a book from local (txt, epub)</span>
            <input
              id="file-upload"
              aria-label="file-upload"
              type="file"
              accept=".txt,.epub,.pdf" // TODO: mobi
              tabIndex={0}
              disabled={loading || isScraping}
              onChange={startUpload}
              onClick={() => {
                if (showUrlInput) setShowUrlInput(false);
              }}
              className="sr-only"
            />
          </label>

          {/* Scrape button */}
          {FEATURES.ENABLE_BOOK_SCRAPE && (
            <Button
              variant="secondary"
              title="Scrape a book from web"
              onClick={() => setShowUrlInput((prev) => !prev)}
              className="grow flex justify-center items-center gap-2 px-4 py-3 border-2 rounded-xl transition-all"
            >
              <LinkIcon size={18} />
              <span className="hidden sm:inline font-medium">Scrape a book from web</span>
            </Button>
          )}
        </div>

        {/* URL Input Field (Collapsible) */}
        {showUrlInput && (
          <div className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <Input
              autoFocus
              type="text"
              placeholder="https://www.xpxs.net/book/<BOOK-ID>"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              className="flex-1 px-4 py-2"
              disabled={isScraping}
              onKeyDown={(e) => e.key === 'Enter' && startScrape()}
            />
            <Button title="Start scraping" onClick={startScrape} disabled={isScraping || !scrapeUrl.trim()} className="px-6 py-2 flex items-center gap-2">
              {isScraping ? <Loader2 size={16} className="animate-spin" /> : <LinkIcon size={18} />}
              <span className="hidden sm:inline">Start scraping</span>
            </Button>
          </div>
        )}
      </div>

      {/* No Books */}
      {books.length === 0 && (
        <div className="text-center text-gray-500 col-span-full">
          <BookOpen className="mx-auto mb-4 opacity-50" />
          <p>No books yet. Upload your first book to get started!</p>
        </div>
      )}

      {/* Books To Read */}
      <div className="py-2 flex flex-wrap gap-2 justify-center md:justify-start">
        {booksToRead.length === 0 && booksCompleted.length > 0 && (
          <div className="text-center text-gray-500 col-span-full">
            <BookOpen className="mx-auto mb-4 opacity-50" />
            <p>Upload a new book!</p>
          </div>
        )}
        {booksToRead.map((book) => (
          <BookItem
            key={book._id}
            book={book}
            isSelected={selectedBook?._id === book._id}
            selectBook={() => setSelectedBook(book)}
            hasNewChapters={updatedBooks[book._id] > 0}
            updateChapters={() => updateChapters(book._id)}
            canAction="markCompleted"
            openAction={openAction}
          />
        ))}
      </div>

      {/* Books Completed */}
      {booksCompleted.length > 0 && (
        <>
          <div className="my-4 text-xs text-gray-400 text-center flex-1 flex justify-center items-end">
            <Button
              variant="ghost"
              aria-label="completed-books"
              title={`${showFinished ? 'Collapse' : 'Expand'} completed books`}
              onClick={() => setShowFinished((prev) => !prev)}
              className="hover:text-gray-600 transition-colors"
            >
              Completed ({booksCompleted.length})
            </Button>
          </div>
          <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${showFinished ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="py-2 flex flex-wrap gap-2 justify-center md:justify-start">
                {booksCompleted.map((book) => (
                  <BookItem
                    key={book._id}
                    book={book}
                    isSelected={selectedBook?._id === book._id}
                    selectBook={() => setSelectedBook(book)}
                    hasNewChapters={updatedBooks[book._id] > 0}
                    updateChapters={() => updateChapters(book._id)}
                    canAction="resetProgress"
                    openAction={openAction}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Upload Progress Modal */}
      {uploadingFile && <UploadProgress file={uploadingFile} status={status} progress={progress} error={errorUpload} cancleUpload={cancleUpload} />}

      {/* Scrape Progress Modal */}
      {scrapeProgress ? <ScrapeProgress progress={scrapeProgress} error={errorScrape} stopScrape={stopScrape} /> : null}

      {/* Book Item Modal */}
      {!!pendingAction && (
        <EditBookInfo open={pendingAction?.type === 'edit'} onClose={closeAction} title={getBookActionLabel(pendingAction.type, t, 'modalTitle')} onConfirm={updateBook} book={pendingAction.book} />
      )}
      {!!pendingAction && (
        <ConfirmModal
          open={pendingAction.type === 'delete'}
          onClose={closeAction}
          title={getBookActionLabel(pendingAction.type, t, 'modalTitle')}
          confirmText={getBookActionLabel(pendingAction.type, t, 'confirmText')}
          onConfirm={() => deleteBook(pendingAction.book._id)}
        />
      )}
      {!!pendingAction && (
        <ConfirmModal
          open={pendingAction.type === 'resetProgress' || pendingAction.type === 'markCompleted'}
          onClose={closeAction}
          title={getBookActionLabel(pendingAction.type, t, 'modalTitle')}
          onConfirm={() => updateBook(pendingAction.book._id, { lastCompleted: pendingAction?.type === 'markCompleted' ? new Date().toISOString() : '' })}
        />
      )}
    </div>
  );
};
