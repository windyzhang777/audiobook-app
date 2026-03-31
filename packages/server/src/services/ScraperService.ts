/// <reference lib="dom" />
import { Chapter } from '@/types';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import puppeteer, { Browser } from 'puppeteer';

export class ScraperService {
  private readonly baseUrl = 'https://www.xpxs.net';
  private browser: Browser | null = null;

  /**
   * STAGE 1: Discovery
   * Gets metadata and the full list of "Hollow" chapters.
   */
  discoverBook = async (bookUrl: string, onStatus?: (msg: string) => void): Promise<{ title: string; coverUrl?: string; chapters: Chapter[] }> => {
    onStatus?.('Fetching book metadata...');
    const { title, coverUrl } = await this.getBookMetadata(bookUrl);
    const chapters = await this.crawlChapterLinks(bookUrl, onStatus);
    return { title, coverUrl, chapters };
  };

  /**
   * STAGE 2: Hydration
   * Scrapes one chapter's worth of lines, including all sub-pages (_2, _3, etc.)
   */
  scrapeSingleChapter = async (url: string): Promise<{ lines: string[] }> => {
    const { lines, nextPath } = await this.scrapeRawPage(url);
    let combinedLines = [...lines];
    let currentNextPath = nextPath;

    // Handle multi-part chapters (_2.html)
    while (currentNextPath && currentNextPath.includes('_')) {
      const nextUrl = new URL(currentNextPath, this.baseUrl).href;
      const nextPart = await this.scrapeRawPage(nextUrl);
      combinedLines = [...combinedLines, ...nextPart.lines];
      currentNextPath = nextPart.nextPath;
    }

    return { lines: combinedLines };
  };

  private scrapeRawPage = async (url: string): Promise<{ lines: string[]; nextPath: string | null }> => {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'],
      });
    }

    const page = await this.browser.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for the AJAX to finish.
      await page.waitForFunction(
        () => {
          const container = document.querySelector('#booktxt');
          // Check if there are at least 3 paragraphs (real content vs placeholder)
          const pCount = container?.querySelectorAll('p').length || 0;
          const textLength = container?.textContent?.trim().length || 0;
          return pCount > 2 && textLength > 200;
        },
        { timeout: 15000 },
      );

      await new Promise((r) => setTimeout(r, 500)); // Half second "settle" time

      return await page.evaluate(() => {
        const container = document.querySelector('#booktxt');
        if (!container) return { lines: [], nextPath: null };

        // Get text from <p> tags
        const ps = Array.from(container.querySelectorAll('p'));
        const lines = ps.map((p) => p.textContent?.trim()).filter((t): t is string => !!t);

        const nextBtn = Array.from(document.querySelectorAll('.readpage a')).find((a) => a.textContent?.includes('下一页'));
        const nextPath = nextBtn?.getAttribute('href') || null;

        return { lines, nextPath };
      });
    } catch (error) {
      console.error(`❌ Error scraping ${url}:`, error);
      return { lines: [], nextPath: null };
    } finally {
      await page.close();
    }
  };

  /**
   * Crawls the index pages to gather all chapter links
   */
  private crawlChapterLinks = async (bookUrl: string, onStatus?: (msg: string) => void): Promise<Chapter[]> => {
    const indexUrl = bookUrl.replace('/book/', '/index/');
    onStatus?.('Crawling book chapters...');
    const { $ } = await this.fetchAndDecode(indexUrl);

    const indexPages = new Set<string>();
    $('#indexselect option').each((_, el) => {
      const val = $(el).attr('value');
      if (val) indexPages.add(new URL(val, this.baseUrl).href);
    });

    const chapters: Chapter[] = [];
    for (const [i, pageUrl] of Array.from(indexPages).entries()) {
      onStatus?.(`Gathering chapter: Batch ${i + 1} / ${indexPages.size})...`);
      const { $: $page } = await this.fetchAndDecode(pageUrl);

      $page('.chapterlist-index li a').each((_, el) => {
        const href = $page(el).attr('href');
        const chapterTitle = $page(el).text().trim();

        if (href) {
          chapters.push({
            title: chapterTitle || new URL(href, this.baseUrl).href,
            source: new URL(href, this.baseUrl).href,
            isLoaded: false,
          });
        }
      });
    }

    if (chapters.length === 0) throw new Error('No chapters found.');
    onStatus?.(`Found ${chapters.length} chapters.`);
    return chapters;
  };

  private getBookMetadata = async (url: string): Promise<{ title: string; coverUrl?: string }> => {
    const bookUrl = url.replace('/index/', '/book/');
    const { $ } = await this.fetchAndDecode(bookUrl);
    const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || `Book ${bookUrl.split('/').filter(Boolean).pop()}`;
    const coverUrl = $('meta[property="og:image"]').attr('content') || $('.cover img').attr('data-original') || $('.cover img').attr('src');

    return {
      title,
      coverUrl: coverUrl ? new URL(coverUrl, this.baseUrl).href : undefined,
    };
  };

  private fetchAndDecode = async (url: string): Promise<{ $: cheerio.CheerioAPI }> => {
    const resp = await fetch(url);
    const buffer = await resp.arrayBuffer();
    const contentType = resp.headers.get('content-type') || '';

    let encoding = contentType.toLowerCase().includes('utf-8') ? 'utf-8' : 'gbk';
    let html = iconv.decode(Buffer.from(buffer), encoding);

    if (encoding === 'gbk' && html.includes('charset=utf-8')) {
      html = iconv.decode(Buffer.from(buffer), 'utf-8');
    }

    return { $: cheerio.load(html) };
  };

  close = async () => {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  };
}
