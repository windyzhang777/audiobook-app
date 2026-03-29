import type { BookFileType } from './types';

// \p{L} matches any letter from any language
// \p{N} matches any kind of numeric character
export const hasAlphanumeric = /[\p{L}\p{N}]/u;

export const getFileTitle = (fileName: string) => {
  const parts = fileName.split('.');
  const fileType = parts.pop() || 'txt';
  const title = parts.join('_');
  return { title, fileType };
};

export const fixEncoding = (str: string): string => {
  try {
    // Handle URL encoding (%E6...)
    let decoded = str;
    if (str.includes('%')) {
      decoded = decodeURIComponent(str);
    }

    // Check if the string is "Mojibake" (Binary data read as Latin-1)
    // If it has characters like 'ç' or 'å', it needs a binary repair.
    const isMojibake = /[À-ÿ]/.test(decoded) && !/[\u4e00-\u9fa5]/.test(decoded);

    if (isMojibake) {
      // Re-interpret the string as UTF-8 bytes
      const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
      return new TextDecoder('utf-8').decode(bytes);
    }

    return decoded;
  } catch (error) {
    console.error('Encoding fix failed:', error);
    return str;
  }
};

export const isValidFileType = (fileType: string): boolean => {
  const validTypes: BookFileType[] = ['txt', 'epub', 'pdf', 'mobi'];
  return validTypes.some((type) => `.${type}`.includes(fileType.toLowerCase()));
};

export const sanitizeFileName = (fileName: string): string =>
  fileName
    .replace(/[^a-z0-9_\-\.]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/_\./g, '.')
    .replace(/^_+|_+$/g, '');

export const calculateProgress = (currentLine: number, totalLines: number): number => {
  if (totalLines === 0) return 0;
  return Math.round((currentLine / totalLines) * 100);
};

export const getNowISOString = () => {
  const now = new Date();
  return now.toISOString();
};

export const formatLocaleDateString = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

export const formatLocaleTimeString = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/**
 * Format bytes to human readable
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Helper: sleep function for retry delays
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Format time to human readable
 */
export const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
};
