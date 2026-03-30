import { api } from '@/services/api';
import type { UploadProgress } from '@audiobook/shared';
import { useEffect, useRef, useState } from 'react';

export interface ScrapeProgress extends UploadProgress {
  title?: string;
  message?: string;
}

export function useScrape(loadBooks: () => Promise<void>) {
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState<ScrapeProgress | null>(null);
  const [error, setError] = useState('');

  const stopScrapeRef = useRef<(() => void) | null>(null);

  const toggleUrlInput = () => {
    setShowUrlInput(!showUrlInput);
  };

  const handleScrape = async () => {
    if (!scrapeUrl.trim() || !scrapeUrl.startsWith('http')) return;

    setIsScraping(true);
    setShowUrlInput(false);
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
        loadBooks();
      },
      (errorMsg) => {
        // Error!
        // stopScrapeRef.current = null;
        setError(errorMsg);
        setIsScraping(false);
        // setScrapeProgress(null);
      },
    );

    stopScrapeRef.current = closeFn;
  };

  const handleStopScrape = () => {
    if (stopScrapeRef.current) {
      stopScrapeRef.current(); // Closes the EventSource
      stopScrapeRef.current = null;
      setIsScraping(false);
      setScrapeProgress(null);
      setError('');
      console.log('Scrape manually stopped by user');
    }
  };

  // hijack the browser's default escape
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleStopScrape();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return { scrapeUrl, setScrapeUrl, showUrlInput, toggleUrlInput, isScraping, scrapeProgress, error, handleScrape, handleStopScrape };
}
