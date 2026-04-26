import { api } from '@/services/api';
import type { ChunkedUploader } from '@/services/chunkedUploader';
import { type UploadProgress } from '@audiobook/shared';
import { useCallback, useRef, useState } from 'react';

export type UploadStatus = 'uploading' | 'completed' | 'error' | 'cancelled';

export function useBookUpload(onComplete?: () => void) {
  const [uploadingFile, setUploadingFile] = useState<File>();
  const [status, setStatus] = useState<UploadStatus>('uploading');
  const [progress, setProgress] = useState<UploadProgress>({
    uploadedBytes: 0,
    totalBytes: uploadingFile?.size || 0,
    percentage: 0,
    currentChunk: 0,
    totalChunks: 0,
    speed: 0,
    estimatedTimeRemaining: 0,
  });
  const [error, setError] = useState<string>('');

  const uploadStarted = useRef(false);
  const uploaderRef = useRef<ChunkedUploader | null>(null);

  const resetUpload = useCallback(() => {
    setUploadingFile(undefined);
    uploadStarted.current = false;
  }, []);

  const startUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || uploadStarted.current) return;

      uploadStarted.current = true;
      setUploadingFile(file);
      setStatus('uploading');

      try {
        const { book, uploader } = await api.upload.upload(file, {
          onProgress: (p) => {
            setProgress(p);
          },
          onError: (err) => {
            setStatus('error');
            setError(err.message);
          },
        });
        uploaderRef.current = uploader;
        await book;

        setStatus('completed');
        setTimeout(() => {
          onComplete?.();
          resetUpload();
        }, 1500);
      } catch (error) {
        setStatus('error');
        setError(error instanceof Error ? error.message : 'Upload failed');
      } finally {
        e.target.value = '';
      }
    },
    [onComplete, resetUpload],
  );

  const cancleUpload = useCallback(() => {
    if (uploaderRef.current) {
      uploaderRef.current.cancel();
    }
    setStatus('cancelled');
    resetUpload();
  }, [resetUpload]);

  return { uploadingFile, status, progress, error, startUpload, cancleUpload };
}
