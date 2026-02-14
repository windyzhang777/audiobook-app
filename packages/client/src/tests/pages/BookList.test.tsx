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
    },
  },
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}));

// Mock window functions (confirm/alert)
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

    expect(screen.getByLabelText(/loading/i)).toBeDefined();

    const bookElement = await screen.findByText('Book One');
    expect(bookElement).toBeDefined();
    expect(api.books.getAll).toHaveBeenCalledTimes(1);
  });

  it('enters edit mode and shakes delete button when selection made', async () => {
    render(<BookList />, { wrapper: BrowserRouter });
    await waitFor(() => expect(screen.queryByText(/loading/i)).toBeNull());

    // Click Edit toggle
    const editBtn = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editBtn);

    // Select first book
    const bookItem = screen.getByText('Book One');
    fireEvent.click(bookItem);

    // Verify Delete button has the shake class
    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    expect(deleteBtn.className).toContain('shake-active');
  });

  it('calls delete API and refreshes list on handleDelete', async () => {
    vi.mocked(api.books.delete).mockResolvedValue();
    render(<BookList />, { wrapper: BrowserRouter });

    await screen.findByText('Book One');

    // Trigger selection and delete
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByText('Book One'));

    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteBtn);

    expect(mockConfirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(api.books.delete).toHaveBeenCalledWith('1');
      // Should reload books after delete
      expect(api.books.getAll).toHaveBeenCalledTimes(2);
    });
  });

  it('resets file input value after upload', async () => {
    const user = userEvent.setup();
    render(<BookList />, { wrapper: BrowserRouter });

    const input = (await screen.findByLabelText(/upload/i)) as HTMLInputElement;
    const file = new File(['hello'], 'hello.txt', { type: 'application/txt' });

    await user.upload(input, file);
    expect(input.value).toBe('');
  });
});
