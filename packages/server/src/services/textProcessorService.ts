import { localeByLang } from '@audiobook/shared';
import { EPub } from 'epub2';
import { franc } from 'franc';
import fs from 'fs';
import path from 'path';
import { uploadsDir } from '../index';

export class TextProcessorService {
  private uploadsDir = uploadsDir;
  private yield = () => new Promise((resolve) => setImmediate(resolve));

  private detectLanguage = (text: string): string => {
    const lang = franc(text, { minLength: 100 });
    return localeByLang[lang] || localeByLang.default; // default to English
  };

  private splitTextIntoLines = async (text: string, lang: string = localeByLang.default): Promise<string[]> => {
    try {
      const segmenter = new Intl.Segmenter(lang, { granularity: 'sentence' });
      const segments: string[] = [];

      const iterator = segmenter.segment(text);
      for (const { segment } of iterator) {
        if (!segment) continue;

        // Further split by newlines to respect paragraph breaks
        const subLines = segment.split('\n');
        for (const line of subLines) {
          const trimmed = line.trim();
          if (trimmed) segments.push(trimmed);
        }

        if (segments.length % 100 === 0) await this.yield();
      }

      return segments;
    } catch (error) {
      return this.fallbackSplitSentences(text);
    }
  };

  private fallbackSplitSentences = (text: string): string[] => {
    return text
      .split(/(?<=[.!?])\s+/)
      .flatMap((seg) => seg.split('\n'))
      .map((seg) => seg.trim())
      .filter(Boolean);
  };

  processBookText = async (text: string) => {
    const lang = this.detectLanguage(text);
    const lines = await this.splitTextIntoLines(text, lang);
    return { lang, lines };
  };

  extractBookData = async (filePath: string, fileType: string): Promise<{ text: string; coverPath?: string }> => {
    if (fileType === 'txt') {
      return { text: fs.readFileSync(filePath, 'utf-8') };
    }

    if (fileType === 'epub') {
      try {
        const epub = await EPub.createAsync(filePath);

        let coverPath: string | undefined;
        let coverId = epub.metadata.cover;

        // Fallback: Search manifest for common IDs or EPUB 3 properties
        if (!coverId) {
          const manifest = epub.manifest;
          coverId = Object.keys(manifest).find((id) => {
            const item = manifest[id];
            // Check for EPUB 3 property or common naming conventions
            return item.properties === 'cover-image' || id.toLowerCase().includes('cover') || item.href.toLowerCase().includes('cover');
          });
        }

        // Last Resort: Use the first image in the entire manifest
        if (!coverId) {
          coverId = Object.keys(epub.manifest).find((id) => epub.manifest[id]['media-type']?.startsWith('image/'));
        }

        if (coverId) {
          try {
            const [buffer, mimeType] = await epub.getImageAsync(coverId);
            const extension = mimeType.split('/')[1] || 'jpg';
            const fileExt = path.extname(filePath);
            const baseName = path.basename(filePath, fileExt);
            coverPath = `${baseName}.${extension}`;
            fs.writeFileSync(`${this.uploadsDir}/${coverPath}`, buffer);
          } catch (coverError) {
            console.error('Cover extraction failed, skipping:', coverError);
          }
        }

        const textContent: string[] = [];
        for (const chapter of epub.flow) {
          const html = await epub.getChapterRawAsync(chapter.id);

          // Strip HTML and clean whitespace
          const rawText = html
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (rawText) textContent.push(rawText);

          await this.yield();
        }

        return { text: textContent.join('\n\n'), coverPath };
      } catch (error) {
        throw new Error('Failed to parse EPUB: ', error || '');
      }
    }

    throw new Error(`File type ${fileType} not yet supported for text extraction.`);
  };
}
