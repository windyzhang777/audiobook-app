import { UploadProgressDialog } from '@/components/UploadProgress';
import { api } from '@/services/api';
import { type UploadProgress } from '@/services/ChunkedUploader';
import type { Book } from '@audiobook/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Typed mocks
vi.mock('@/services/api', () => ({
  api: {
    upload: {
      smartUpload: vi.fn(),
    },
  },
}));

vi.mock('@/services/ChunkedUploader', () => ({
  ChunkedUploader: {
    formatBytes: vi.fn((b: number) => `${b} bytes`),
    formatTime: vi.fn((s: number) => `${s}s`),
  },
}));

describe('<UploadProgressDialog />', () => {
  const mockFile = new File(['bits'], 'audiobook.m4b', { type: 'audio/mp4' });
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts upload and handles progress updates', async () => {
    // Capture the type-safe options from the smartUpload call
    type SmartUploadOptions = Parameters<typeof api.upload.smartUpload>[1];
    let capturedOptions: SmartUploadOptions | undefined;

    vi.mocked(api.upload.smartUpload).mockImplementation((_file, options) => {
      capturedOptions = options;
      return new Promise(() => {}); // Stay pending
    });

    render(<UploadProgressDialog file={mockFile} />);

    expect(screen.getByText(/Uploading.../i)).toBeInTheDocument();

    const mockUpdate: UploadProgress = {
      percentage: 45,
      uploadedBytes: 450,
      totalBytes: 1000,
      currentChunk: 2,
      totalChunks: 5,
      speed: 50,
      estimatedTimeRemaining: 11,
    };

    // Trigger progress update using the captured callback
    await act(async () => {
      capturedOptions?.onProgress?.(mockUpdate);
    });

    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText(/450 bytes \/ 1000 bytes/i)).toBeInTheDocument();
  });

  it('navigates to complete state on success', async () => {
    vi.mocked(api.upload.smartUpload).mockResolvedValue({ id: 'new-book-id' } as Book);

    render(<UploadProgressDialog file={mockFile} onComplete={mockOnComplete} />);

    // Allow the async smartUpload call to finish
    await act(async () => {
      await Promise.resolve();
    });

    // Wait for the "completed" status UI to render
    expect(screen.getByText(/Upload Complete!/i)).toBeInTheDocument();

    // Advance the 1500ms delay defined in useEffect
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(mockOnComplete).toHaveBeenCalledWith('new-book-id');
  });

  it('displays error message when upload fails', async () => {
    const errorMsg = 'Storage full';
    vi.mocked(api.upload.smartUpload).mockRejectedValue(new Error(errorMsg));

    render(<UploadProgressDialog file={mockFile} onCancel={mockOnCancel} />);

    // Allow the async smartUpload call to finish
    await act(async () => {
      await Promise.resolve();
    });

    const errorHeader = screen.getByText(/Upload Failed/i);
    expect(errorHeader).toBeInTheDocument();
    expect(screen.getByText(errorMsg)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('cancels upload when the cancel button is clicked', () => {
    // Keep upload pending
    vi.mocked(api.upload.smartUpload).mockReturnValue(new Promise(() => {}));

    render(<UploadProgressDialog file={mockFile} onCancel={mockOnCancel} />);

    const cancelBtn = screen.getByRole('button', { name: /cancel upload/i });
    fireEvent.click(cancelBtn);

    expect(screen.getByText(/Upload Cancelled/i)).toBeInTheDocument();
    expect(mockOnCancel).toHaveBeenCalled();
  });
});
