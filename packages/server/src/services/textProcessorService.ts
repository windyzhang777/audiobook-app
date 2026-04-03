import { Book, BookContent, Chapter, CHAPTER_MARKER, fixEncodingTxt, IMAGE_MARKER, localeByLang } from '@audiobook/shared';
import { EPub } from 'epub2';
import { TocElement } from 'epub2/lib/epub/const';
import { franc } from 'franc';
import fs from 'fs';
import path from 'path';
import { extractText, getDocumentProxy } from 'unpdf';
import { uploadsDir } from '../index';

export interface ProcessedBook {
  lang: BookContent['lang'];
  lines: BookContent['lines'];
  chapters: Book['chapters'];
  coverPath?: Book['coverPath'];
  extractedImages?: Book['extractedImages'];
}

interface EpubManifest extends TocElement {
  properties: string;
}

export class TextProcessorService {
  private uploadsDir = uploadsDir;

  detectLanguage(text: string): string {
    const lang = franc(text, { minLength: 100 });
    return localeByLang[lang] || localeByLang.default; // default to English
  }

  private async splitTextIntoLines(text: string, lang: string = localeByLang.default): Promise<string[]> {
    const sanitizedText = text
      .replace(/&#13;/g, '\r')
      .replace(/&#10;/g, '\n')
      .replace(/&nbsp;|&#160;/g, ' ');

    try {
      const segmenter = new Intl.Segmenter(lang, { granularity: 'sentence' });
      const segments: string[] = [];

      const iterator = segmenter.segment(sanitizedText);
      for (const { segment } of iterator) {
        if (!segment) continue;

        // Further split by newlines to respect paragraph breaks
        const subLines = segment.split(/[\r\n]+/);
        for (const line of subLines) {
          const trimmed = line.trim();
          if (trimmed) {
            if (trimmed.startsWith(IMAGE_MARKER)) {
              segments.push(trimmed);
              continue;
            }
            segments.push(trimmed);
          }
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
      return this.processTxt(title, filePath);
    }

    if (fileType === 'epub') {
      return this.processEpub(bookId, filePath, fileType);
    }

    if (fileType === 'pdf') {
      return this.processPdf(bookId, title, fileType);
    }

    throw new Error(`File type ${fileType} not yet supported for text extraction.`);
  }

  private async processTxt(title: string, filePath: string) {
    const fullText = fixEncodingTxt(filePath);
    const { lang, lines } = await this.processBookText(fullText);
    return { lang, lines, chapters: [{ title, source: '0', isLoaded: true, startIndex: 0 }] };
  }

  private async processEpub(bookId: string, filePath: string, fileType: string) {
    let coverPath: string = '';
    let extractedImages: Record<string, string> = {};

    try {
      const epub = await EPub.createAsync(filePath);
      if (!epub) throw new Error('EPUB object is null or undefined');

      console.log(`epub :`, epub.flow, epub.manifest, epub.metadata);

      const toc = epub.flow;
      if (!toc || toc.length === 0) throw new Error('EPUB has no chapters or content');

      const chapters: Chapter[] = [];
      const allLines: string[] = [];
      let cumulativeLines = 0;
      extractedImages = await this.extractAllImages(epub, bookId);
      coverPath = await this.extractCover(epub, bookId);

      for (const chapter of toc) {
        // Identify non-story chapters by ID or HREF
        const isMetaFile = /cover|toc|titlepage|adv|insert/i.test(chapter.id) || /cover|toc/i.test(chapter.href) || chapter.id.includes('inline_toc');

        if (isMetaFile) {
          console.log(`⚠️ [Skip] Metadata file: ${chapter.id}`);
          continue;
        }

        try {
          let html = await epub.getChapterRawAsync(chapter.id);
          if (!html) {
            console.log(`⚠️ [Skip] Chapter ${chapter.id} has no HTML`);
            continue;
          }

          // INTERCEPT IMAGES: Replace <img> tags with a text marker
          html = html.replace(/<img[^>]*>/gi, (match: string) => {
            // Find the ID in the tag (e.g., id="x01.jpg")
            const idMatch = match.match(/id=["']([^"']+)["']/) || match.match(/src=["']([^"']+)["']/);
            if (idMatch) {
              const id = path.basename(idMatch[1]); // Get just the ID/Filename
              const localUrl = extractedImages[id] || Object.values(extractedImages).find((v) => v.includes(id));
              return localUrl ? `\n\n${IMAGE_MARKER}${localUrl}\n\n` : '';
            }
            return '';
          });

          // Strip HTML and clean whitespace
          let cleanText = html
            .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6)>/gi, '\n\n') // Replace all block-level closing tags with double newlines
            .replace(/<br\s*\/?>/gi, '\n') // Replace standalone line breaks with a single newline
            .replace(/<[^>]*>/g, ' ') // Strip all remaining tags
            .replace(/&nbsp;/g, '') // Strip HTML entities
            .replace(/nrvhad\s*/gi, '') // Strip common OCR artifacts
            .replace(/[ \t]+/g, ' ') // Collapse horizontal tabs/spaces
            .replace(/\n\s*\n/g, '\n\n') // Ensure no more than two newlines
            .trim();

          if (cleanText) {
            const rawTitle = chapter.title || '';
            let chapterTitle = rawTitle.replace(/[\.…\s]+$/, '').trim();
            const chapterLines: string[] = [];

            // Add chapter title marker
            if (chapterTitle) {
              chapterLines.push(`${CHAPTER_MARKER}${chapterTitle.toUpperCase()}`);

              // Remove title from text content
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
            } else {
              if (cleanText.length < 5) {
                console.log(`⚠️ [Skip] Empty chapter fragment [${chapter.id}]: ${cleanText}`);
                continue;
              }
              if (chapter.id.includes('xu')) chapterTitle = '序言';
            }

            // Track chapter start index
            if (chapterTitle) {
              chapters.push({
                title: chapterTitle,
                source: cumulativeLines.toString(),
                isLoaded: true,
                startIndex: cumulativeLines,
                href: chapter.href,
              });
            }

            // Process body text into sentences
            const { lines: bodyLines } = await this.processBookText(cleanText);
            chapterLines.push(...bodyLines);
            allLines.push(...chapterLines);

            cumulativeLines += chapterLines.length;
            console.log(`✅ Chapter "${chapterTitle.slice(0, 10)}" processed (${bodyLines.length} lines)`);
          }
        } catch (error) {
          console.error(`❌ Failed to process chapter ${chapter.id}:`, error);
          // Continue to next chapter instead of failing entirely
          continue;
        }
      }

      if (allLines.length === 0) {
        throw new Error('EPUB has no readable content after parsing');
      }

      const lang = this.detectLanguage(allLines.slice(0, 10).join(' '));
      console.log(`📖 EPUB parsed: ${chapters.length} chapters, ${allLines.length} lines`);

      return { lang, lines: allLines, chapters, coverPath, extractedImages };
    } catch (error) {
      if (coverPath) {
        await this.deleteFile(coverPath);
        coverPath = '';
      }

      const imagePaths = Object.values(extractedImages);
      if (imagePaths.length > 0) {
        console.log(`Cleaning up ${imagePaths.length} extracted images due to error...`);
        for (const imgPath of imagePaths) {
          await this.deleteFile(imgPath);
        }
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ [EPUB Parser Error] ${errorMsg}`, { fileType, bookId });
      throw new Error(`Failed to parse EPUB: ${errorMsg}`);
    }
  }

  private async processPdf(bookId: string, title: string, filePath: string) {
    try {
      const buffer = fs.readFileSync(filePath);
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });

      const { lang, lines } = await this.processBookText(text);
      return { lang, lines, chapters: [{ title, source: '0', isLoaded: true, startIndex: 0 }] };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ [PDF Parser Error] ${errorMsg}`, { bookId });
      throw new Error(`Failed to parse PDF: ${errorMsg}`);
    }
  }

  private async extractAllImages(epub: EPub, bookId: string): Promise<Record<string, string>> {
    const imageMap: Record<string, string> = {};
    const manifest = epub.manifest;

    for (const id in manifest) {
      const item = manifest[id];
      if (item['media-type']?.startsWith('image/')) {
        try {
          const [buffer, mimeType] = await epub.getImageAsync(id);
          const extension = mimeType.split('/')[1] || 'jpg';
          // Unique name to avoid collisions between different books
          const fileName = `img_${bookId}_${id}.${extension}`;
          fs.writeFileSync(path.join(this.uploadsDir, fileName), buffer);

          // Store the local URL path
          imageMap[id] = `/uploads/${fileName}`;
        } catch (err) {
          console.error(`❌ Failed to extract image ${id}:`, err);
        }
      }
    }
    return imageMap;
  }

  private async extractCover(epub: EPub, bookId: string): Promise<string> {
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
        console.error('❌ Cover extraction failed, skipping:', error);
      }
    }
    return '';
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
      console.error(`❌ Failed to delete file at ${rawPath}:`, error);
    }
  };
}
