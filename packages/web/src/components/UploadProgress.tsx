import type { ScrapeProgress } from '@/common/useBookScrape';
import { type UploadStatus } from '@/common/useBookUpload';
import { formatBytes, formatTime, type UploadProgress } from '@audiobook/shared';
import { AlertCircle, CircleCheck, X } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from './ui/button';

interface UploadProgressProps {
  file: File;
  status: UploadStatus;
  progress: UploadProgress | null;
  error: string;
  cancleUpload: () => void;
}

export function UploadProgress({ file, status, progress, error, cancleUpload }: UploadProgressProps) {
  // hijack the browser's default escape
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (status === 'completed' || status === 'error')) {
        e.preventDefault();
        cancleUpload();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [status, cancleUpload]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {status === 'uploading' && 'Uploading...'}
            {status === 'completed' && 'Upload Complete!'}
            {status === 'error' && 'Upload Failed'}
            {status === 'cancelled' && 'Upload Cancelled'}
          </h3>
          {status === 'completed' && (
            <Button variant="ghost" onClick={cancleUpload}>
              <X size={20} />
            </Button>
          )}
        </div>

        {/* File Info */}
        <div className="mb-4">
          <p className="text-sm text-gray-600 truncate">{file.name}</p>
          <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
        </div>

        {/* Progress Bar */}
        {status === 'uploading' && progress ? (
          <div className="space-y-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress.percentage}%` }} />
            </div>

            <div className="flex justify-between text-xs text-gray-600">
              <span>{Math.round(progress.percentage)}%</span>
              <span>
                {formatBytes(progress.uploadedBytes)} / {formatBytes(progress.totalBytes)}
              </span>
            </div>

            <div className="flex justify-between text-xs text-gray-500">
              <span>
                Chunk {progress.currentChunk} / {progress.totalChunks}
              </span>
              <span>{formatBytes(progress.speed)}/s</span>
            </div>

            {progress.estimatedTimeRemaining > 0 && <div className="text-xs text-gray-500 text-center">Estimated time remaining: {formatTime(progress.estimatedTimeRemaining)}</div>}
          </div>
        ) : null}

        {/* Success State */}
        {status === 'completed' && (
          <div className="flex flex-col items-center py-4">
            <CircleCheck fill="green" className="text-white mb-3" size={64} />
            <p className="text-gray-700">Book uploaded successfully!</p>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <Button variant="secondary" onClick={cancleUpload} className="float-right">
              Close
            </Button>
          </div>
        )}

        {/* Cancel Button */}
        {status === 'uploading' && (
          <Button variant="secondary" onClick={cancleUpload} className="mt-4 float-right">
            Cancel Upload
          </Button>
        )}
      </div>
    </div>
  );
}

// Compact version for inline use
export function UploadProgressCompact({ progress }: { progress: UploadProgress }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700 font-medium">{Math.round(progress.percentage)}%</span>
        <span className="text-gray-500 text-xs">{formatBytes(progress.speed)}/s</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${progress.percentage}%` }} />
      </div>

      <div className="flex justify-between text-xs text-gray-500">
        <span>
          {formatBytes(progress.uploadedBytes)} / {formatBytes(progress.totalBytes)}
        </span>
        {progress.estimatedTimeRemaining > 0 && <span>{formatTime(progress.estimatedTimeRemaining)} left</span>}
      </div>
    </div>
  );
}

interface ScrapeProgressProps {
  progress: ScrapeProgress;
  error: string;
  stopScrape: () => void;
}

export function ScrapeProgress({ progress, error, stopScrape }: ScrapeProgressProps) {
  const safePercentage = isNaN(progress.percentage) ? 0 : Math.round(progress.percentage);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Scraping Book Content...</h3>
          <Button variant="outline" onClick={stopScrape} className="text-xs font-bold uppercase tracking-tighter">
            <X size={20} />
          </Button>
        </div>

        {/* File Info */}
        {progress.totalChunks > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 truncate">{progress.message}</p>
            <p className="text-xs text-gray-500">First {progress.totalChunks} chapters</p>
          </div>
        )}

        {/* Progress Bar */}
        {progress ? (
          <div className="space-y-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${safePercentage}%` }} />
            </div>

            <div className="flex justify-between text-xs text-gray-500">
              <span>{progress.totalChunks > 0 ? `Scraping Chapter ${progress.currentChunk + 1}...` : 'Starting...'}</span>
            </div>

            {progress.estimatedTimeRemaining > 0 && <div className="text-xs text-gray-500 text-center">Estimated time remaining: {formatTime(progress.estimatedTimeRemaining)}</div>}
          </div>
        ) : null}

        {/* Error State */}
        {error && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <Button variant="secondary" onClick={stopScrape} className="float-right">
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
