import { BookReader } from '@/pages/BookReader';
import { api } from '@/services/api';
import { speechService } from '@/services/SpeechService';
import type { Book, BookContent } from '@audiobook/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock API and speechService
vi.mock('@/services/api', () => ({
  api: {
    books: {
      getById: vi.fn(),
      getContent: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock('@/services/SpeechService', () => ({
  speechService: {
    getNativeVoices: vi.fn().mockReturnValue([]),
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    onLineEnd: null,
    onIsPlayingChange: null,
    onLoadMoreLines: null,
    onBookCompleted: null,
  },
}));

interface VirtuosoMockProps {
  data: string[];
  itemContent: (index: number, line: string) => JSX.Element;
  components?: {
    Header?: () => JSX.Element | null;
    Footer?: () => JSX.Element | null;
    List?: (props: { children: ReactNode }) => JSX.Element | null;
  };
}
vi.mock('react-virtuoso', () => {
  return {
    Virtuoso: ({ data, itemContent, components }: VirtuosoMockProps) => {
      const Header = components?.Header || (() => null);
      const Footer = components?.Footer || (() => null);
      const List = components?.List || (({ children }: { children: ReactNode }) => <div>{children}</div>);

      return (
        <div data-testid="virtuoso-mock">
          <Header />
          <List>
            {data.map((line: string, index: number) => (
              <div key={index}>{itemContent(index, line)}</div>
            ))}
          </List>
          <Footer />
        </div>
      );
    },
  };
});

describe('<BookReader />', () => {
  const mockBook = {
    id: 'book-1',
    title: 'Test Book',
    currentLine: 2,
    settings: { fontSize: 18, rate: 1, voice: 'system-default' },
    lastCompleted: '',
    bookmarks: [],
    totalLines: 10,
  } as unknown as Book;

  const mockContent = {
    lines: ['Line 1', 'Line 2', 'Line 3', 'Line 4'],
    lang: 'eng',
    pagination: { total: 4, hasMore: false },
  } as BookContent;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.books.getById).mockResolvedValue(mockBook);
    vi.mocked(api.books.getContent).mockResolvedValue(mockContent);
    vi.mocked(api.books.update).mockResolvedValue({ ...mockBook, bookmarks: [{ index: 0, text: 'Line 1' }] });
  });

  it('renders loading state initially', () => {
    render(
      <MemoryRouter initialEntries={['/reader/book-1']}>
        <Routes>
          <Route path="/reader/:id" element={<BookReader />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/loading/i)).toBeVisible();
  });

  it('renders book content after loading', async () => {
    render(
      <MemoryRouter initialEntries={['/reader/book-1']}>
        <Routes>
          <Route path="/reader/:id" element={<BookReader />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Test Book')).toBeVisible();
    expect(screen.getByText('Line 1')).toBeVisible();
    expect(screen.getByText('Line 2')).toBeVisible();
  });

  it('shows error and go back button if book fails to load', async () => {
    vi.mocked(api.books.getById).mockRejectedValue(new Error('fail'));
    render(
      <MemoryRouter initialEntries={['/reader/book-1']}>
        <Routes>
          <Route path="/reader/:id" element={<BookReader />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/failed to load book/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /go back/i })).toBeVisible();
  });

  it('calls speechService.start when play button is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/reader/book-1']}>
        <Routes>
          <Route path="/reader/:id" element={<BookReader />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Test Book');
    const playBtn = screen.getByRole('button', { name: /play/i });
    fireEvent.click(playBtn);
    expect(speechService.start).toHaveBeenCalled();
  });

  it('calls speechService.pause when pause button is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/reader/book-1']}>
        <Routes>
          <Route path="/reader/:id" element={<BookReader />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Test Book');

    await vi.waitFor(() => {
      if (!speechService.onIsPlayingChange) throw new Error('Callback not assigned');
      speechService.onIsPlayingChange(true);
    });

    const pauseBtn = await screen.findByRole('button', { name: /pause/i });
    fireEvent.click(pauseBtn);
    expect(speechService.pause).toHaveBeenCalled();
  });

  it('highlights current line and allows double click to select', async () => {
    render(
      <MemoryRouter initialEntries={['/reader/book-1']}>
        <Routes>
          <Route path="/reader/:id" element={<BookReader />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Test Book');
    const line = screen.getByText('Line 3'); // currentLine is 2, so Line 3 should be highlighted
    expect(line).toHaveClass('bg-amber-100');
    fireEvent.doubleClick(line);
    expect(speechService.stop).toHaveBeenCalled();
  });

  it('toggles bookmark on context menu', async () => {
    render(
      <MemoryRouter initialEntries={['/reader/book-1']}>
        <Routes>
          <Route path="/reader/:id" element={<BookReader />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Test Book');
    expect(screen.getByText('Line 1')).toHaveClass('border-transparent');
    expect(screen.getByText('Line 2')).toHaveClass('border-transparent');

    const bookmarkBtn = await screen.findByRole('button', { name: 'Add bookmark for line 1' });
    expect(bookmarkBtn).toHaveClass('opacity-0');

    fireEvent.contextMenu(screen.getByText('Line 1'));
    expect(screen.getByText('Line 1')).toHaveClass('border-amber-400');
    expect(screen.getByText('Line 2')).toHaveClass('border-transparent');
  });
});
