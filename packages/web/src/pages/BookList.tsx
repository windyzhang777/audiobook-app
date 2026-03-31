import { useScrape } from '@/common/useScrape';
import { BookItem } from '@/components/BookItem';
import type { Action } from '@/components/BookItemContextMenu';
import { BookItemConfirmDelete, BookItemConfirmMarkProgress, BookItemDtoModal } from '@/components/BookItemModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrapeProgressCompact, UploadProgressDialog } from '@/components/UploadProgress';
import { api } from '@/services/api';
import { type Book } from '@audiobook/shared';
import { BookOpen, LinkIcon, Loader, Loader2, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export const BookList = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState<{ file: File } | null>(null);
  const [showFinished, setShowFinished] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book>();
  const [action, setAction] = useState<Action | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [updatedBooks, setUpdatedBooks] = useState<Record<string, number>>({});

  const booksFinished = books.filter((book) => book.lastCompleted);
  const booksToRead = books.filter((book) => !book.lastCompleted);

  const loadBooks = async () => {
    try {
      const books = await api.books.getAll();
      setBooks(books);
    } catch (error) {
      console.error('❌ Failed to load books: ', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile({ file });
    e.target.value = '';
  };

  const toggleShowModal = (book: Book, action: Action) => {
    setSelectedBook(book);
    setAction(action);
    setShowModal(true);
  };

  const toggleCloseModal = () => {
    setSelectedBook(undefined);
    setAction(null);
    setShowModal(false);
  };

  const handleBookUpdateWithCover = async (selected: Book, file: File | null) => {
    if (!selected || action !== 'rename') return;

    try {
      await api.books.updateWithCover(selected, file);
      loadBooks();
    } catch (error) {
      console.error('❌ Failed to update book with cover: ', selected, error);
    } finally {
      setAction(null);
    }
  };

  const handleBookDelete = async (selected: Book) => {
    if (!selected?._id || action !== 'delete') return;

    try {
      await api.books.delete(selected._id);
      loadBooks();
    } catch (error) {
      console.error('❌ Failed to delete book: ', selected, error);
    } finally {
      setAction(null);
    }
  };

  const handleBookMarkProgress = async (selected: Book) => {
    if (!selected?._id || !action) return;

    try {
      await api.books.update(selected._id, { ...selected, lastCompleted: action === 'mark-as-completed' ? new Date().toISOString() : '' });
      loadBooks();
    } catch (error) {
      console.error('❌ Failed to reset book progress: ', selected, error);
    } finally {
      setAction(null);
    }
  };

  const handleUpdateChapters = useCallback(async (_id: string) => {
    try {
      const updatedBook = await api.books.updateChapters(_id);
      setBooks((prev) => prev.map((b) => (b._id === _id ? updatedBook : b)));
      setUpdatedBooks((prev) => {
        const next = { ...prev };
        delete next[_id];
        return next;
      });
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, []);

  const checkAllUpdates = useCallback(async () => {
    try {
      const updatedChapterCountByBookId = await api.books.checkUpdates();
      setUpdatedBooks(updatedChapterCountByBookId);
    } catch (error) {
      console.error('❌ Failed to check for updates:', error);
    }
  }, []);

  const { scrapeUrl, setScrapeUrl, showUrlInput, toggleUrlInput, isScraping, scrapeProgress, error: scrapeError, handleScrape, handleStopScrape } = useScrape(loadBooks);

  useEffect(() => {
    loadBooks();
    checkAllUpdates();
  }, [uploadingFile, checkAllUpdates]);

  if (loading) {
    return (
      <div aria-label="loading" className="min-h-full flex justify-center items-center gap-2">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-full max-w-md md:max-w-2xl lg:max-w-4xl mx-auto pt-8 pb-30 px-6 flex flex-col">
      <header className="text-center mb-4">
        <h3 className="font-semibold">My Books</h3>
      </header>

      {/* Upload & Scrape Controls */}
      <div className="flex flex-col gap-3 mb-6 text-sm">
        <div className="flex gap-2">
          {/* File Upload */}
          <label className="flex-1 flex justify-center items-center gap-2 px-4 bg-primary text-primary-foreground hover:bg-primary/80 rounded-lg whitespace-nowrap cursor-pointer transition-colors shadow-sm">
            <Upload size={16} />
            <span className="font-medium">Upload a new book (txt, epub)</span>
            <input
              id="upload"
              aria-label="upload"
              type="file"
              accept=".txt,.epub"
              tabIndex={0}
              disabled={loading || isScraping}
              onChange={handleUpload}
              onClick={() => {
                if (showUrlInput) toggleUrlInput();
              }}
              className="hidden"
            />
          </label>

          {/* Toggle URL Input */}
          <Button type="button" variant="outline" onClick={toggleUrlInput} className={`flex-1 flex justify-center items-center gap-2 px-4 py-3 border-2 rounded-xl transition-all`}>
            <LinkIcon size={18} />
            <span className="font-medium">Import from URL</span>
          </Button>
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
              onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
            />
            <Button onClick={handleScrape} disabled={isScraping || !scrapeUrl} className="px-6 py-2 flex items-center gap-2">
              {isScraping ? <Loader2 size={16} className="animate-spin" /> : 'Scrape'}
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
      <div className="py-2 flex flex-wrap gap-2 justify-center sm:justify-start">
        {booksToRead.length === 0 && booksFinished.length > 0 && (
          <div className="text-center text-gray-500 col-span-full">
            <BookOpen className="mx-auto mb-4 opacity-50" />
            <p>Upload a new book!</p>
          </div>
        )}
        {booksToRead.length > 0 &&
          booksToRead
            .sort((a, b) => {
              if (!a.updatedAt) return 1;
              if (!b.updatedAt) return -1;
              return b.updatedAt.localeCompare(a.updatedAt);
            })
            .map((book) => (
              <BookItem
                canAction="mark-as-completed"
                key={book._id}
                book={book}
                selectedBook={selectedBook}
                setSelectedBook={setSelectedBook}
                newChaptersCount={updatedBooks[book._id]}
                handleUpdateChapters={handleUpdateChapters}
                toggleShowModal={toggleShowModal}
              />
            ))}
      </div>

      {/* Books Completed */}
      {booksFinished.length > 0 && (
        <>
          <div className="my-4 text-xs text-gray-400 text-center flex-1 flex justify-center items-end">
            <Button
              variant="ghost"
              aria-label="completed-books"
              title={`${showFinished ? 'Collapse' : 'Expand'} completed books`}
              onClick={() => setShowFinished((prev) => !prev)}
              className="hover:text-gray-600 transition-colors"
            >
              Completed ({booksFinished.length})
            </Button>
          </div>
          <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${showFinished ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="py-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                {booksFinished.length !== 0 &&
                  booksFinished
                    .sort((a, b) => {
                      if (!a.lastReadAt) return 1;
                      if (!b.lastReadAt) return -1;
                      return b.lastReadAt.localeCompare(a.lastReadAt);
                    })
                    .map((book) => (
                      <BookItem
                        canAction="reset-progress"
                        key={book._id}
                        book={book}
                        selectedBook={selectedBook}
                        setSelectedBook={setSelectedBook}
                        newChaptersCount={updatedBooks[book._id]}
                        handleUpdateChapters={handleUpdateChapters}
                        toggleShowModal={toggleShowModal}
                      />
                    ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Upload Progress Dialog */}
      {uploadingFile && <UploadProgressDialog file={uploadingFile.file} onComplete={() => setUploadingFile(null)} onCancel={() => setUploadingFile(null)} />}
      {scrapeProgress && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="flex flex-col gap-1 bg-white rounded-2xl p-6 shadow-xl w-full max-w-sm border border-gray-100">
            <div className="flex justify-between items-center gap-1 font-semibold">
              {scrapeError ? <span>{scrapeError}</span> : <span>{scrapeProgress.totalChunks > 0 ? scrapeProgress.message : 'Scraping Book Content...'}</span>}
              <Button variant="outline" onClick={handleStopScrape} className="text-xs font-bold uppercase tracking-tighter">
                <X size={20} />
              </Button>
            </div>

            {!scrapeError && <ScrapeProgressCompact progress={scrapeProgress} />}
          </div>
        </div>
      )}

      {selectedBook && action === 'rename' && <BookItemDtoModal book={selectedBook} showModal={showModal} toggleCloseModal={toggleCloseModal} handleBookUpdateWithCover={handleBookUpdateWithCover} />}
      {selectedBook && action === 'delete' && <BookItemConfirmDelete book={selectedBook} showModal={showModal} toggleCloseModal={toggleCloseModal} handleBookDelete={handleBookDelete} />}
      {selectedBook && (action === 'reset-progress' || action === 'mark-as-completed') && (
        <BookItemConfirmMarkProgress book={selectedBook} showModal={showModal} toggleCloseModal={toggleCloseModal} handleBookMarkProgress={handleBookMarkProgress} action={action} />
      )}
    </div>
  );
};
