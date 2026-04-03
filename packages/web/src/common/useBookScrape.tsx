import { api } from '@/services/api';
import type { UploadProgress } from '@audiobook/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ScrapeProgress extends UploadProgress {
  title?: string;
  message?: string;
}

export function useBookScrape(
  onClose?: () => void,
  onComplete?: () => void,
  // setShowUrlInput: React.Dispatch<React.SetStateAction<boolean>>, loadBooks: () => Promise<void>
) {
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState<ScrapeProgress | null>(null);
  const [error, setError] = useState('');

  const stopScrapeRef = useRef<(() => void) | null>(null);

  const startScrape = useCallback(async () => {
    if (!scrapeUrl.trim() || !scrapeUrl.startsWith('http')) return;

    setIsScraping(true);
    setError('');
    onClose?.();

    setScrapeProgress({
      percentage: 0,
      uploadedBytes: 0,
      totalBytes: 0,
      currentChunk: 0,
      totalChunks: 0,
      speed: 0,
      estimatedTimeRemaining: 0,
    });

    const closeFn = api.books.scrape(
      scrapeUrl,
      (progress) => {
        setScrapeProgress(progress);
      },
      () => {
        // Success!
        stopScrapeRef.current = null;
        setIsScraping(false);
        setScrapeProgress(null);
        setScrapeUrl('');
        onComplete?.();
      },
      (errorMsg) => {
        // Error - keep progress visible
        setError(errorMsg);
        setIsScraping(false);
        // setScrapeProgress(null);
      },
    );

    stopScrapeRef.current = closeFn;
  }, [scrapeUrl, onClose, onComplete]);

  const stopScrape = useCallback(() => {
    if (!stopScrapeRef.current) return;

    stopScrapeRef.current(); // Closes the EventSource
    stopScrapeRef.current = null;
    setIsScraping(false);
    setScrapeProgress(null);
    setError('');
    console.log('⛔️ Scrape manually stopped by user');
  }, []);

  const resetScrapeError = useCallback(() => {
    setError('');
    setScrapeProgress(null);
  }, []);

  useEffect(() => {
    return () => {
      if (stopScrapeRef.current) stopScrapeRef.current();
    };
  }, []);

  // hijack the browser's default escape
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isScraping) {
        e.preventDefault();
        stopScrape();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isScraping, stopScrape]);

  return { scrapeUrl, setScrapeUrl, isScraping, scrapeProgress, error, startScrape, stopScrape, resetScrapeError };
}
