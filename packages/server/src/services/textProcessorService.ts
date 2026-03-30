import { Book, BookContent, Chapter, CHAPTER_PREFIX, localeByLang } from '@audiobook/shared';
import { EPub } from 'epub2';
import { TocElement } from 'epub2/lib/epub/const';
import { franc } from 'franc';
import fs from 'fs';
import path from 'path';
import { uploadsDir } from '../index';

export interface ProcessedBook {
  lang: BookContent['lang'];
  lines: BookContent['lines'];
  chapters: Book['chapters'];
  coverPath?: Book['coverPath'];
}

interface EpubManifest extends TocElement {
  properties: string;
}

export class TextProcessorService {
  private uploadsDir = uploadsDir;
  private coverPath: string = '';

  detectLanguage(text: string): string {
    const lang = franc(text, { minLength: 100 });
    return localeByLang[lang] || localeByLang.default; // default to English
  }

  private async splitTextIntoLines(text: string, lang: string = localeByLang.default): Promise<string[]> {
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
      }

      return segments;
    } catch (error) {
      return this.fallbackSplitSentences(text);
    }
  }

  private fallbackSplitSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .flatMap((seg) => seg.split('\n'))
      .map((seg) => seg.trim())
      .filter(Boolean);
  }

  async processBookText(text: string) {
    const lang = this.detectLanguage(text);
    const lines = await this.splitTextIntoLines(text, lang);
    return { lang, lines };
  }

  async processBookData(bookId: string, title: string, filePath: string, fileType: string): Promise<ProcessedBook> {
    if (fileType === 'txt') {
      const fullText = fs.readFileSync(filePath, 'utf-8');
      const { lang, lines } = await this.processBookText(fullText);
      return { lang, lines, chapters: [{ title, source: '0', isLoaded: true, startIndex: 0 }] };
    }

    if (fileType === 'epub') {
      try {
        const epub = await EPub.createAsync(filePath);
        const chapters: Chapter[] = [];
        const allLines: string[] = [];
        let cumulativeLines = 0;
        const coverPath = await this.extractCover(epub, bookId);
        if (coverPath) this.coverPath = coverPath;

        for (const chapter of epub.flow) {
          const html = await epub.getChapterRawAsync(chapter.id);

          // Strip HTML and clean whitespace
          let cleanText = html
            .replace(/<\/p>/g, '\n\n')
            .replace(/<[^>]*>/g, ' ')
            .replace(/nrvhad\s*/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

          if (cleanText.length < 5 && !chapter.title) {
            console.log(`Skipping empty/meta chapter fragment: ${chapter.id}`);
            continue;
          }

          if (cleanText) {
            console.log(`chapter :`, chapter, cleanText.slice(0, 40));
            const rawTitle = chapter.title || '';
            let chapterTitle = rawTitle.replace(/[\.…\s]+$/, '').trim();
            const chapterLines: string[] = [];

            if (chapterTitle) {
              chapterLines.push(`${CHAPTER_PREFIX}${chapterTitle.toUpperCase()}`);

              let found = true;
              while (found) {
                const foundIndex = cleanText
                  .toLowerCase()
                  .slice(0, chapterTitle.length + 10)
                  .indexOf(chapterTitle.toLowerCase());

                if (foundIndex !== -1) {
                  cleanText = cleanText.substring(foundIndex + chapterTitle.length).trim();
                  cleanText = cleanText.replace(/^[…\s\.:·\-\(\)、：。（）]+/, '').trim();
                } else {
                  found = false;
                  console.log(`[Mismatch] Title: "${chapterTitle}" not found in start of text.`);
                }
              }
            }

            if (chapterTitle) {
              chapters.push({
                title: chapterTitle,
                source: cumulativeLines.toString(),
                isLoaded: true,
                startIndex: cumulativeLines,
              });
            }

            const { lines: bodyLines } = await this.processBookText(cleanText);
            chapterLines.push(...bodyLines);
            allLines.push(...chapterLines);
            cumulativeLines += chapterLines.length;
          }
        }

        const lang = this.detectLanguage(allLines.slice(0, 10).join(' '));

        return { lang, lines: allLines, chapters, coverPath };
      } catch (error) {
        if (this.coverPath) this.deleteFile(this.coverPath);
        throw new Error('Failed to parse EPUB: ', error || '');
      }
    }

    throw new Error(`File type ${fileType} not yet supported for text extraction.`);
  }

  private async extractCover(epub: EPub, bookId: string): Promise<string | undefined> {
    let coverId = epub.metadata.cover;

    // Fallback: Search manifest for common IDs or EPUB 3 properties
    if (!coverId) {
      const manifest = epub.manifest;
      coverId = Object.keys(manifest).find((id) => {
        const item = manifest[id] as EpubManifest;
        // Check for EPUB 3 property or common naming conventions
        return item.properties === 'cover-image' || id.toLowerCase().includes('cover') || item.href?.toLowerCase().includes('cover');
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
        const coverPath = `${bookId}.${extension}`;
        fs.writeFileSync(path.join(this.uploadsDir, coverPath), buffer);
        return coverPath;
      } catch (error) {
        console.error('Cover extraction failed, skipping:', error);
      }
    }
    return undefined;
  }

  // Since we are moving to MongoDB-only, we can eventually
  // remove this, but for now, we clean up the temp upload file.
  private deleteFile = async (rawPath: string | undefined) => {
    if (!rawPath) return;

    try {
      const fileName = path.basename(rawPath);
      const fullPath = path.join(this.uploadsDir, fileName);
      fs.unlinkSync(fullPath);
    } catch (error) {
      console.error(`Failed to delete file at ${rawPath}:`, error);
    }
  };
}
