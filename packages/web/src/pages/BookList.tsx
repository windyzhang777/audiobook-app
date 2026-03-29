import { useScrape } from '@/common/useScrape';
import { ScrapeProgressCompact, UploadProgressDialog } from '@/components/UploadProgress';
import { api } from '@/services/api';
import { calculateProgress, formatLocaleDateString, type Book } from '@audiobook/shared';
import { BellRing, BookOpen, LinkIcon, Loader, Loader2, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const BookList = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState<{ file: File } | null>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [selectedBooks, setSelectedBooks] = useState<Book['_id'][]>([]);
  const [renamedBooks, setRenamedBooks] = useState<Book['_id'][]>([]);
  const [updatedBooks, setUpdatedBooks] = useState<Record<string, number>>({});

  const canAction = isEdit && selectedBooks.length > 0;
  const booksCompleted = books.filter((book) => book.lastCompleted);
  const booksToRead = books.filter((book) => !book.lastCompleted);

  const loadBooks = async () => {
    try {
      const books = await api.books.getAll();
      setBooks(books);
    } catch (error) {
      console.error('Failed to load books: ', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    closeEdit();

    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile({ file });
    e.target.value = '';
  };

  const handleDelete = async () => {
    if (!confirm('Delete selected books?')) return;

    setLoading(true);
    try {
      await Promise.all(selectedBooks.map((bookId) => api.books.delete(bookId)));
      await loadBooks();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete selected books');
      setLoading(false);
    } finally {
      closeEdit();
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset progress for selected books?')) return;

    setLoading(true);
    try {
      await Promise.all(selectedBooks.map((bookId) => api.books.update(bookId, { lastCompleted: '' })));
      await loadBooks();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to reset selected books');
      setLoading(false);
    } finally {
      closeEdit();
    }
  };

  const handleEditBooks = useCallback(() => {
    setSelectedBooks([]);
    setRenamedBooks([]);
    if (isEdit) {
      // Update books with changed titles
      const booksToUpdate = books.filter((book) => renamedBooks.includes(book._id));
      Promise.all(booksToUpdate.map((book) => api.books.update(book._id, { title: book.title })))
        .then(() => {
          loadBooks();
        })
        .catch((error) => {
          alert(error instanceof Error ? error.message : 'Failed to update book titles');
        })
        .finally(() => setIsEdit(false));
    } else {
      setIsEdit(true);
    }
  }, [isEdit, books, renamedBooks]);

  const closeEdit = useCallback(() => {
    setSelectedBooks([]);
    if (isEdit) {
      setIsEdit(false);
      loadBooks();
    }
  }, [isEdit]);

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
      console.error('Failed to check for updates:', error);
    }
  }, []);

  const { scrapeUrl, setScrapeUrl, showUrlInput, toggleUrlInput, isScraping, scrapeProgress, error: scrapeError, handleScrape, handleStopScrape } = useScrape(closeEdit, loadBooks);

  useEffect(() => {
    loadBooks();
    checkAllUpdates();
  }, [uploadingFile, checkAllUpdates]);

  // hijack the browser's default escape
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEdit) {
        e.preventDefault();
        closeEdit();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isEdit, closeEdit]);

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
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex gap-2">
          {/* File Upload */}
          <label className="flex-1 flex justify-center items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl cursor-pointer hover:bg-blue-700 transition-colors shadow-sm">
            <Upload size={16} />
            <span className="text-sm font-medium">Upload a new book (txt, epub)</span>
            <input
              aria-label="upload"
              type="file"
              accept=".txt,.epub"
              tabIndex={0}
              disabled={loading || isScraping}
              onChange={handleUpload}
              onClick={() => {
                closeEdit();
                if (showUrlInput) toggleUrlInput();
              }}
              className="hidden"
            />
          </label>

          {/* Toggle URL Input */}
          <button
            onClick={toggleUrlInput}
            className={`flex-1 flex justify-center items-center gap-2 px-4 py-3 border-2 rounded-xl transition-all ${
              showUrlInput ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <LinkIcon size={18} />
            <span className="text-sm font-medium">Import from URL</span>
          </button>
        </div>

        {/* URL Input Field (Collapsible) */}
        {showUrlInput && (
          <div className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <input
              autoFocus
              type="text"
              placeholder="https://www.xpxs.net/book/<BOOK-ID>"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              disabled={isScraping}
              onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
            />
            <button onClick={handleScrape} disabled={isScraping || !scrapeUrl} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-medium text-sm disabled:bg-gray-400 flex items-center gap-2">
              {isScraping ? <Loader2 size={16} className="animate-spin" /> : 'Scrape'}
            </button>
          </div>
        )}
      </div>

      {/* Edit Panel */}
      <div className="relative my-4 flex justify-end items-center text-xs text-gray-400">
        <button
          aria-label="Delete"
          title="Delete books"
          disabled={!canAction}
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === ' ' || e.key === 'Enter') {
              handleDelete();
            }
          }}
          className={`absolute top-1/2 left-1/3 transform -translate-x-1/3 -translate-y-1/2 ${canAction ? 'shake-active bg-red-100 text-red-600' : 'text-red-800! opacity-50 cursor-not-allowed'}`}
          style={{ visibility: isEdit ? 'visible' : 'hidden' }}
        >
          <Trash2 size={16} />
        </button>

        <button
          aria-label="Reset"
          title="Reset progress"
          disabled={!canAction}
          onClick={(e) => {
            e.stopPropagation();
            handleReset();
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === ' ' || e.key === 'Enter') {
              handleReset();
            }
          }}
          className={`absolute top-1/2 left-2/3 transform -translate-x-2/3 -translate-y-1/2 ${canAction ? 'shake-active bg-amber-100 text-amber-600' : 'text-amber-800! opacity-50 cursor-not-allowed'}`}
          style={{ visibility: isEdit ? 'visible' : 'hidden' }}
        >
          <RotateCcw size={16} />
        </button>
        <button aria-label={isEdit ? (selectedBooks.length > 0 ? 'Cancel' : 'Done') : 'Edit'} onClick={handleEditBooks} className="hover:text-gray-600 transition-colors">
          {isEdit ? (selectedBooks.length > 0 ? 'Cancel' : 'Done') : 'Edit'}
        </button>
      </div>

      {/* No Books */}
      {books.length === 0 && (
        <div className="text-center text-gray-500 col-span-full">
          <BookOpen className="mx-auto mb-4 opacity-50" />
          <p>No books yet. Upload your first book to get started!</p>
        </div>
      )}

      {/* Books To Read */}
      <div className="py-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-10">
        {booksToRead.length === 0 && booksCompleted.length > 0 && (
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
                key={book._id}
                book={book}
                isEdit={isEdit}
                selectedBooks={selectedBooks}
                setSelectedBooks={setSelectedBooks}
                closeEdit={closeEdit}
                setBooks={setBooks}
                setRenamedBooks={setRenamedBooks}
                handleEditBooks={handleEditBooks}
                newChaptersCount={updatedBooks[book._id]}
                handleUpdateChapters={handleUpdateChapters}
              />
            ))}
      </div>

      {/* Books Completed */}
      {booksCompleted.length > 0 && (
        <>
          <div className="my-4 text-xs text-gray-400 text-center flex-1 flex justify-center items-end">
            <button
              aria-label="completed-books"
              title={`${showCompleted ? 'Collapse' : 'Expand'} completed books`}
              onClick={() => {
                closeEdit();
                setShowCompleted((prev) => !prev);
              }}
              className="hover:text-gray-600 transition-colors"
            >
              Completed ({booksCompleted.length})
            </button>
          </div>
          <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${showCompleted ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="py-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-10">
                {booksCompleted.length !== 0 &&
                  booksCompleted
                    .sort((a, b) => {
                      if (!a.lastReadAt) return 1;
                      if (!b.lastReadAt) return -1;
                      return b.lastReadAt.localeCompare(a.lastReadAt);
                    })
                    .map((book) => (
                      <BookItem
                        key={book._id}
                        book={book}
                        isEdit={isEdit}
                        selectedBooks={selectedBooks}
                        setSelectedBooks={setSelectedBooks}
                        closeEdit={closeEdit}
                        setBooks={setBooks}
                        setRenamedBooks={setRenamedBooks}
                        handleEditBooks={handleEditBooks}
                        newChaptersCount={updatedBooks[book._id]}
                        handleUpdateChapters={handleUpdateChapters}
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
            <div className="flex justify-between items-center gap-1 text-blue-600 font-semibold">
              {scrapeError ? <span>{scrapeError}</span> : <span>{scrapeProgress.totalChunks > 0 ? scrapeProgress.message : 'Scraping Book Content...'}</span>}
              <button onClick={handleStopScrape} className="text-xs font-bold text-red-500 hover:text-red-700 uppercase tracking-tighter">
                <X size={20} />
              </button>
            </div>

            {!scrapeError && <ScrapeProgressCompact progress={scrapeProgress} />}
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes shaking {
            0% { transform: rotate(0deg); }
            25% { transform: rotate(-3deg); }
            50% { transform: rotate(0deg); }
            75% { transform: rotate(3deg); }
            100% { transform: rotate(0deg); }
          }
          .shake-active {
            animation: shaking 0.2s ease-in-out infinite;
          }
        `}
      </style>
    </div>
  );
};

interface BookItemProps {
  book: Book;
  isEdit: boolean;
  selectedBooks: Book['_id'][];
  setSelectedBooks: React.Dispatch<React.SetStateAction<Book['_id'][]>>;
  closeEdit: () => void;
  setBooks: React.Dispatch<React.SetStateAction<Book[]>>;
  setRenamedBooks: React.Dispatch<React.SetStateAction<Book['_id'][]>>;
  handleEditBooks: () => void;
  newChaptersCount: number;
  handleUpdateChapters: (id: string) => Promise<void>;
}

export const BookItem = ({ book, isEdit, selectedBooks, setSelectedBooks, closeEdit, setBooks, setRenamedBooks, handleEditBooks, newChaptersCount, handleUpdateChapters }: BookItemProps) => {
  const navigate = useNavigate();
  const progress = calculateProgress(book.currentLine, book.totalLines);

  return (
    <div
      role="button"
      tabIndex={0}
      key={`book-${book._id}`}
      aria-label={`Book ${book._id}`}
      onClick={() => {
        if (isEdit) {
          setSelectedBooks((prev) => {
            if (prev.includes(book._id)) {
              return prev.filter((id) => id !== book._id);
            } else {
              return [...prev, book._id];
            }
          });
        } else {
          closeEdit();
          navigate(`/book/${book._id}`);
        }
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();

          if (isEdit) {
            setSelectedBooks((prev) => {
              if (prev.includes(book._id)) {
                return prev.filter((id) => id !== book._id);
              } else {
                return [...prev, book._id];
              }
            });
          } else {
            navigate(`/book/${book._id}`);
          }
        }
      }}
      className="relative aspect-3/4 max-h-64 w-full rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
    >
      <div className="relative w-full h-full overflow-hidden">
        {book.coverPath ? (
          <img
            src={`${import.meta.env.VITE_API_URL}${book.coverPath}`}
            alt={`${book.title} cover`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.src = '/default-cover.png';
            }}
          />
        ) : (
          <BookPlaceholder title={book.title} />
        )}
      </div>

      <div className="absolute bottom-0 -tranlate-y-1/2 w-full flex flex-col justify-center items-center gap-2 bg-white/80 p-4 pb-6">
        {isEdit ? (
          <input
            type="text"
            name="title"
            defaultValue={book.title}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                closeEdit();
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                handleEditBooks();
              }
            }}
            onChange={(e) => {
              const newTitle = (e.target as HTMLInputElement).value.trim();
              if (newTitle === book.title) return;
              setRenamedBooks((prev) => [...prev, book._id]);
              setBooks((prev) => prev.map((b) => (b._id === book._id ? { ...b, title: newTitle } : b)));
            }}
            className="w-full text-xs text-center border border-gray-300 bg-white rounded-md px-3 py-2 focus:outline-none focus:ring focus:border-blue-300 transition"
          />
        ) : (
          <h3 title={book.title} className="font-medium w-full truncate">
            {book.title}
          </h3>
        )}

        {!isEdit ? (
          book.lastCompleted ? (
            <div className="text-xs">Last Read: {formatLocaleDateString(new Date(book.lastReadAt!))}</div>
          ) : book.currentLine === 0 ? (
            <div className={`${isEdit ? '' : 'shake-active'} bg-linear-to-r from-red-500 via-yellow-500 to-purple-500 bg-clip-text text-transparent text-xs font-extrabold`}>START READING!</div>
          ) : (
            <div className="text-xs">Progress: {progress}%</div>
          )
        ) : (
          <div className="text-xs">Progress: {progress}%</div>
        )}

        {book.source === 'web' && !isEdit && newChaptersCount ? (
          <button
            aria-label="has-new-chapter"
            title="Has new chapters!"
            onClick={(e) => {
              e.stopPropagation();
              handleUpdateChapters(book._id);
            }}
            className="absolute bottom-1 right-1 rounded-full! shake-active bg-white text-amber-600"
          >
            <BellRing size={16} />
          </button>
        ) : null}
      </div>
      {selectedBooks.includes(book._id) && <div className="select-mask absolute top-0 left-0 w-full h-full bg-gray-400/60" />}
    </div>
  );
};

interface BookPlaceholderProps {
  title: string;
}

const BookPlaceholder = ({ title }: BookPlaceholderProps) => (
  <div className="book-cover relative select-none w-full h-full font-[Open_Sans] bg-linear-to-b from-sky-950 to-gray-900 flex flex-col items-center pl-6 pr-5 py-8 text-center border-black/10 shadow-inner">
    <span className="text-sm uppercase font-semibold text-white/80 leading-relaxed line-clamp-4 border-t-2 border-b-2 py-2 border-amber-400">{title}</span>

    {/* Binding line */}
    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-white/30" />
  </div>
);
