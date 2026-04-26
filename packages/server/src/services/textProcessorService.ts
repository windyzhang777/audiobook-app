import { Book, BookContent, Chapter, CHAPTER_MARKER, fixEncodingTxt, IMAGE_MARKER, localeByLang } from '@audiobook/shared';
import { EPub } from 'epub2';
import { franc } from 'franc';
import fs from 'fs';
import path from 'path';
import { extractText, getDocumentProxy } from 'unpdf';
import { uploadsDir } from '../index';

export interface ProcessedBook {
  lang: BookContent['lang'];
  lines: BookContent['lines'];
  chapters: Book['chapters'];
  extractedImages?: Book['extractedImages'];
}

export class TextProcessorService {
  private uploadsDir = uploadsDir;

  detectLanguage(text: string): string {
    const start = text.length > 2000 ? 1000 : 0;
    const end = Math.min(text.length, start + 2000);
    const sample = text.slice(start, end);

    const cjkCount = (sample.match(/[\u4e00-\u9fa5]/g) || []).length;
    const latinCount = (sample.match(/[a-zA-Z]/g) || []).length;

    let detectionText = sample;

    if (cjkCount > 20 && cjkCount > latinCount * 0.1) {
      detectionText = sample.replace(/[a-zA-Z]/g, '');
    }

    const lang = franc(detectionText, { minLength: 20 });
    return localeByLang[lang] || localeByLang.default; // default to English
  }

  private async splitTextIntoParagraphs(text: string, lang: string = localeByLang.default): Promise<string[]> {
    try {
      const lines: string[] = [];
      const paragraphs = text.split(/\n{2,}/);

      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        // Preserve image markers as-is
        if (trimmed.startsWith(IMAGE_MARKER)) {
          lines.push(trimmed);
          continue;
        }
        lines.push(trimmed);
      }

      return lines;
    } catch (error) {
      return this.splitTextIntoLines(text, lang);
    }
  }

  private async splitTextIntoLines(text: string, lang: string = localeByLang.default): Promise<string[]> {
    try {
      const segmenter = new Intl.Segmenter(lang, { granularity: 'sentence' });
      const segments: string[] = [];

      const iterator = segmenter.segment(text);
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
    const lines = await this.splitTextIntoParagraphs(text, lang);
    return { lang, lines };
  }

  async processBookData(bookId: string, title: string, filePath: string, fileType: string): Promise<ProcessedBook> {
    switch (fileType) {
      case 'txt':
        return this.processTxt(title, filePath);
      case 'epub':
        return this.processEpub(bookId, filePath, fileType);
      case 'pdf':
        return this.processPdf(bookId, title, filePath);
      case 'mobi':
      // TODO: return this.processMobi(bookId, title, filePath);
    }

    throw new Error(`File type ${fileType} not yet supported for text extraction.`);
  }

  private async processTxt(title: string, filePath: string) {
    const fullText = fixEncodingTxt(filePath);
    const { lang, lines } = await this.processBookText(fullText);
    return { lang, lines, chapters: [{ title, source: '0', isLoaded: true, startIndex: 0 }] };
  }

  private async processEpub(bookId: string, filePath: string, fileType: string) {
    let extractedImages: Record<string, string> = {};

    try {
      const epub = await EPub.createAsync(filePath);
      if (!epub) throw new Error('EPUB object is null or undefined');

      // console.log(`📖 epub :`, epub.flow, epub.manifest, epub.metadata);

      const toc = epub.flow;
      if (!toc || toc.length === 0) throw new Error('EPUB has no chapters or content');

      const chapters: Chapter[] = [];
      const allLines: string[] = [];
      let cumulativeLines = 0;
      extractedImages = await this.extractAllImages(epub, bookId);

      for (const [index, chapter] of toc.entries()) {
        // Identify non-story chapters by ID or HREF
        const isMetaFile = /cover|toc|inline_toc|nav|metadata|titlepage|adv|insert/i.test(chapter.id + chapter.href) || chapter.properties?.includes('nav');
        const isCopyright = /copyright|legal|license/i.test(chapter.id + chapter.href + (chapter.title || ''));

        if (isMetaFile || isCopyright) {
          console.log(`⚠️ [Skip] TOC files: ${chapter.id} ${chapter.title}`);
          continue;
        }

        try {
          let html = await epub.getChapterRawAsync(chapter.id);
          if (!html) {
            console.log(`⚠️ [Skip] Chapter ${chapter.id} has no HTML`);
            continue;
          }

          const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
          let bodyContent = bodyMatch ? bodyMatch[1] : html;

          // INTERCEPT IMAGES: Replace <img> tags with a text marker
          bodyContent = bodyContent.replace(/<img[^>]*>/gi, (match: string) => {
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
          let cleanText = bodyContent
            .replace(/&#13;/g, '\n') // Convert CR entity
            .replace(/&#10;/g, '\n') // Convert LF entity
            // .replace(/nrvhad\s*/gi, '') // Strip common OCR artifacts
            .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6)>/gi, '\n\n') // Block element -> paragraph breaks
            .replace(/<br\s*\/?>/gi, ' ') // Line breaks -> single space
            .replace(/<[^>]*>/g, ' ') // Strip all remaining tags
            .replace(/&nbsp;/g, ' ') // HTML entities
            .replace(/&quot;/g, ' ') // HTML entities
            .replace(/&apos;/g, ' ') // HTML entities
            .replace(/&amp;/g, ' ') // HTML entities
            .replace(/&lt;/g, ' ') // HTML entities
            .replace(/&gt;/g, ' ') // HTML entities
            .replace(/[ \t]+/g, ' ') // Collapse horizontal tabs/spaces
            .replace(/\n[ \t]+/g, ' ') // Strip leading shitespace on lines
            .replace(/[ \t]+\n/g, ' ') // Strip trailing shitespace on lines
            .replace(/\n{3,}/g, '\n\n') // Max 2 newlines (paragraph separator)
            // .replace(/\n\s*\n/g, '\n\n') // Ensure no more than two newlines
            .trim();

          if (index < toc.length - 10) {
            // console.log(`cleanText :`, cleanText.slice(0, 500));
          }

          if (cleanText) {
            const rawTitle = chapter.title || '';
            let chapterTitle = rawTitle.replace(/[\.…\s:*＊·•.\-\(\)、：。．（）]+$/, '').trim();
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
                  cleanText = cleanText.replace(/^[\.…\s:*＊·•.\-\(\)、：。．（）]+/, '').trim();
                } else {
                  found = false;
                  // console.log(`[Mismatch] Title: "${chapterTitle}" not found in start of text.`);
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

      return { lang, lines: allLines, chapters, extractedImages };
    } catch (error) {
      const imagePaths = Object.values(extractedImages);
      if (imagePaths.length > 0) {
        console.log(`Cleaning up ${imagePaths.length} extracted images`);
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

  private deleteFile = async (rawPath: string | undefined) => {
    if (!rawPath) return;

    try {
      const fileName = path.basename(rawPath);
      const fullPath = path.join(this.uploadsDir, fileName);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (error) {
      console.error(`❌ Failed to delete file at ${rawPath}:`, error);
    }
  };
}
