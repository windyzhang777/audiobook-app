export const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB
export const UPLOAD_CHUNK_SIZE = 1 * 1024 * 1024; // 1MB

export const CHAPTER_SIZE = 5;
export const PAGE_SIZE = 50;
export const ALL_LINES = 999999;

export const MAX_BOOKMARK_TEXT = 20;

// settings
export const FONT_SIZE_DEFAULT = 18;
export const MAX_FONT_SIZE = 30;
export const FONT_SIZE_STEP = 1;

export const LINE_HEIGHT_DEFAULT = 2;
export const MIN_LINE_HEIGHT = 0.5;
export const MAX_LINE_HEIGHT = 4;
export const LINE_HEIGHT_STEP = 0.05;

export const INDENT_DEFAULT = 1;
export const MAX_INDENT = 20;
export const INDENT_STEP = 1;

export const RATE_DEFAULT = 1;
export const MIN_RATE = 0.25;
export const MAX_RATE = 5;
export const RATE_STEP = 0.25;

export const ALIGNMENT_DEFAULT = 'left';

// timeout
export const ONE_MINUTE = 60 * 1000;
export const TWO_MINUTES = 2 * 60 * 1000;
export const FIVE_MINUTES = 5 * 60 * 1000;
export const TEN_MINUTES = 10 * 60 * 1000;
export const ONE_HOUR = 60 * 60 * 1000;
export const ONE_DAY = 24 * 60 * 60 * 1000;

export const CHAPTER_MARKER = '~~~'; // Used to identify chapter titles in the lines array
export const IMAGE_MARKER = '[IMAGE_MARKER]';

/**
 * Maps franc 3-letter ISO 639-3 code (e.g., 'cmn', 'eng') to 2-letter BCP 47 codes + region (e.g., 'en-US', 'zh-CN')
 */
export const localeByLang: Record<string, string> = {
  cmn: 'zh-CN', // Mandarin -> Chinese (Simplified)
  eng: 'en-US', // English -> English (US)
  fra: 'fr-FR', // French -> French (France)
  default: 'en-US', // Fallback
};

/**
 * Maps 2-letter BCP 47 codes + region (e.g., 'en-US', 'zh-CN') to Google Cloud Voice name  (e.g., 'en-US-Neural2-F')
 * All selected are WaveNet/Neural2 (1M chars free/month).
 */
export const voiceByLocale: Record<string, string> = {
  'zh-CN': 'zh-CN-Wavenet-A',
  'en-US': 'en-US-Neural2-F',
  'fr-FR': 'fr-FR-Wavenet-C',
  'es-ES': 'es-ES-Neural2-C',
  default: 'en-US-Neural2-F', // Fallback
};
