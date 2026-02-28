import { BookList } from '@/pages/BookList';
import { api } from '@/services/api';
import type { Book } from '@audiobook/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the API and Navigation
vi.mock('@/services/api', () => ({
  api: {
    books: {
      getAll: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}));

// Mock window functions (confirm/alert)
if (typeof window.confirm === 'undefined') {
  window.confirm = vi.fn();
}
if (typeof window.alert === 'undefined') {
  window.alert = vi.fn();
}
const mockAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});
const mockConfirm = vi.spyOn(window, 'confirm').mockImplementation(() => true);

describe('<BookList />', () => {
  const mockBooks = [
    { id: '1', title: 'Book One' },
    { id: '2', title: 'Book Two' },
  ] as Book[];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.books.getAll).mockResolvedValue(mockBooks);
  });

  it('renders books after loading', async () => {
    render(<BookList />, { wrapper: BrowserRouter });

    expect(screen.getByLabelText(/loading/i)).toBeVisible();

    const bookElement = await screen.findByText('Book One');
    expect(bookElement).toBeVisible();
    expect(api.books.getAll).toHaveBeenCalledTimes(1);
  });

  it('displays empty state message when no books exist', async () => {
    vi.mocked(api.books.getAll).mockResolvedValue([]);
    render(<BookList />, { wrapper: BrowserRouter });

    const emptyMsg = await screen.findByText(/No books yet/i);
    expect(emptyMsg).toBeDefined();
  });

  it('enters edit mode and shakes delete button when selection made', async () => {
    render(<BookList />, { wrapper: BrowserRouter });
    await waitFor(() => expect(screen.queryByText(/loading/i)).toBeNull());

    // Click Edit toggle
    const editBtn = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editBtn);
    const resetBtn = screen.getByRole('button', { name: /reset/i, hidden: true });
    const deleteBtn = screen.getByRole('button', { name: /delete/i, hidden: true });
    expect(screen.getByRole('button', { name: /Done/i })).toBeVisible();
    expect(resetBtn).toBeVisible();
    expect(deleteBtn).toBeVisible();

    // Select first book
    const bookItem = screen.getByLabelText('Book 1');
    fireEvent.click(bookItem);

    // Verify Reset + Delete button have the shake class
    expect(resetBtn.className).toContain('shake-active');
    expect(deleteBtn.className).toContain('shake-active');
  });

  it('calls reset API and refreshes list on handleReset', async () => {
    const mockUpdate = vi.mocked(api.books.update).mockResolvedValue({} as Book);

    const progressedBooks = [{ id: '1', title: 'Book One', currentLine: 50, totalLines: 100 }] as Book[];
    vi.mocked(api.books.getAll).mockResolvedValue(progressedBooks);

    render(<BookList />, { wrapper: BrowserRouter });

    await screen.findByText('Book One');
    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
    const bookItem = screen.getByLabelText('Book 1');
    fireEvent.click(bookItem);
    const resetBtn = screen.getByRole('button', { name: 'Reset', hidden: true });
    fireEvent.click(resetBtn);

    expect(mockConfirm).toHaveBeenCalledWith('Reset progress for selected books?');

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('1', {
        currentLine: 0,
        lastCompleted: '',
      });
      // Should reload books after reset
      expect(api.books.getAll).toHaveBeenCalled();
    });
  });

  it('calls delete API and refreshes list on handleDelete', async () => {
    vi.mocked(api.books.delete).mockResolvedValue();
    render(<BookList />, { wrapper: BrowserRouter });

    await screen.findByText('Book One');

    // Trigger selection and delete
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByLabelText('Book 1'));

    const deleteBtn = screen.getByRole('button', { name: /delete/i, hidden: true });
    fireEvent.click(deleteBtn);

    expect(mockConfirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(api.books.delete).toHaveBeenCalledWith('1');
      // Should reload books after delete
      expect(api.books.getAll).toHaveBeenCalledTimes(2);
    });
  });

  it('shows alert when delete API fails', async () => {
    vi.mocked(api.books.delete).mockRejectedValue(new Error('API Error'));

    render(<BookList />, { wrapper: BrowserRouter });
    await screen.findByText('Book One');

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByLabelText('Book 1'));
    fireEvent.click(screen.getByRole('button', { name: /delete/i, hidden: true }));

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('API Error');
    });
  });

  it('resets file input value after upload', async () => {
    const user = userEvent.setup();
    render(<BookList />, { wrapper: BrowserRouter });

    const input = (await screen.findByLabelText(/upload/i)) as HTMLInputElement;
    const file = new File(['hello'], 'hello.txt', { type: 'txt/plain' });

    await user.upload(input, file);
    expect(input.value).toBe('');
  });

  it('updates book titles when exiting edit mode', async () => {
    const mockUpdate = vi.mocked(api.books.update).mockResolvedValue({} as Book);
    render(<BookList />, { wrapper: BrowserRouter });
    await screen.findByText('Book One');

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const input = screen.getByDisplayValue('Book One');
    fireEvent.change(input, { target: { value: 'Updated Title' } });
    fireEvent.click(screen.getByRole('button', { name: /done/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('1', { title: 'Updated Title' });
      expect(api.books.getAll).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument();
    });
  });
});
