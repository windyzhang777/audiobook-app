import { useBookAction } from '@/common/useBookAction';
import { useBooks } from '@/common/useBooks';
import { useBookScrape } from '@/common/useBookScrape';
import { useBookUpload } from '@/common/useBookUpload';
import { useScrapeUpdates } from '@/common/useScrapeUpdates';
import { Button } from '@/components//ui/button';
import { BookItem, ConfirmModal, EditBookInfo } from '@/components/BookItem';
import { ScrapeBookModal } from '@/components/BookItem/BookItemModal';
import { useTheme } from '@/components/theme-provider';
import { ButtonGroup } from '@/components/ui/button-group';
import { ScrapeProgress, UploadProgress } from '@/components/UploadProgress';
import { FEATURES } from '@/config/features';
import { getBookActionLabel, type Book } from '@audiobook/shared';
import { BookOpen, CirclePlus, Cloudy, Loader, Moon, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const BookList = () => {
  const { t } = useTranslation();

  const [showFinished, setShowFinished] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // theme hook
  const { theme, setTheme } = useTheme();

  // data hook
  const { books, loading, loadBooks, updateBook, deleteBook } = useBooks();

  // action hook - action on book menu & modal
  const { pendingAction, closeAction, openAction } = useBookAction();

  // upload hook - upload local book
  const { uploadingFile, status, progress, error: errorUpload, startUpload, cancleUpload } = useBookUpload(() => loadBooks());

  // scrape hook - scrape web book
  const {
    scrapeUrl,
    setScrapeUrl,
    isScraping,
    scrapeProgress,
    error: errorScrape,
    startScrape,
    stopScrape,
  } = useBookScrape(
    () => closeAction(),
    () => loadBooks(),
  );

  // scrape web book chapter updates
  const { updatedBooks, updateChapters } = useScrapeUpdates(books);

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
        setSelectedBook(null);
      }
    };

    if (pendingAction) window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [pendingAction, closeAction]);

  if (loading) {
    return (
      <div aria-label="loading" className="min-h-full flex justify-center items-center gap-2">
        <Loader /> Loading books...
      </div>
    );
  }

  return (
    <div className="min-h-full max-w-md md:max-w-2xl lg:max-w-4xl mx-auto pt-8 pb-30 px-6 flex flex-col text-sm">
      {/* Theme Settings */}
      <header className="text-center mb-4 flex justify-between items-center ">
        <div className="grow" />
        <ButtonGroup>
          <Button size="icon" variant={theme === 'light' ? 'default' : 'outline'} onClick={() => setTheme('light')}>
            <Sun strokeWidth={1.5} className="w-5! h-5!" />
          </Button>
          <Button size="icon" variant={theme === 'dark' ? 'default' : 'outline'} onClick={() => setTheme('dark')}>
            <Moon strokeWidth={1.5} className="w-5! h-5!" />
          </Button>
        </ButtonGroup>
      </header>

      {/* File Upload & Scrape Controls */}
      <div className="flex justify-between items-center mb-4">
        {/* Header */}
        <h3 className="font-semibold pl-2.5">Books</h3>

        <div className="grow" />

        {/* Upload & Scrape */}
        <div className="flex flex-wrap gap-2 justify-center md:justify-start items-center">
          {/* Upload button */}
          <label
            htmlFor="file-upload"
            title="Upload a book from local (txt, pde, epub)"
            className="grow flex justify-center items-center gap-1 bg-transparent py-1.5 px-2.5 hover:bg-muted rounded-sm whitespace-nowrap cursor-pointer transition-colors"
          >
            <CirclePlus size={16} />
            <span className="hidden sm:inline font-medium">Upload</span>
            <input
              id="file-upload"
              aria-label="file-upload"
              type="file"
              accept=".txt,.epub,.pdf" // TODO: mobi
              tabIndex={0}
              disabled={loading || isScraping}
              onChange={startUpload}
              onClick={closeAction}
              className="sr-only"
            />
          </label>

          {/* Scrape button */}
          {FEATURES.ENABLE_BOOK_SCRAPE && (
            <Button variant="ghost" title="Scrape a book from web" onClick={() => openAction('scrape', books[0])}>
              <Cloudy />
              <span className="hidden sm:inline font-medium">Web</span>
            </Button>
          )}
        </div>
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
      {/* Web Book Modal */}
      {!!pendingAction && (
        <ScrapeBookModal
          open={pendingAction.type === 'scrape' && !isScraping}
          onClose={closeAction}
          title={getBookActionLabel(pendingAction.type, t, 'modalTitle')}
          scrapeUrl={scrapeUrl}
          setScrapeUrl={setScrapeUrl}
          onConfirm={startScrape}
        />
      )}

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
