import { EPub } from 'epub2';
import { TocElement } from 'epub2/lib/epub/const';
import fs from 'fs';
import { writeFile } from 'fs/promises';
import path from 'path';
import { getDocumentProxy, getMeta } from 'unpdf';
import { uploadsDir } from '../index';

interface EpubManifest extends TocElement {
  properties: string;
}

export class CoverService {
  private uploadsDir = uploadsDir;

  extractCover = async (bookId: string, filePath: string, fileType: string): Promise<string | undefined> => {
    try {
      switch (fileType) {
        case 'epub':
          return await this.extractEpubCover(bookId, filePath);
        case 'pdf':
          return await this.extractPdfCover(bookId, filePath);
        case 'mobi':
        // TODO: return await this.extractMobiCover(bookId, filePath);
      }
    } catch (error) {
      console.warn(`⚠️ Cover extraction failed for ${filePath}, skipping:`, error);
    }
  };

  private extractEpubCover = async (bookId: string, filePath: string): Promise<string | undefined> => {
    const epub = await EPub.createAsync(filePath);
    if (!epub) throw new Error('EPUB object is null or undefined');

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
        console.error('⚠️ Epub cover extraction failed, skipping:', error);
      }
    }
  };

  private extractPdfCover = async (bookId: string, filePath: string): Promise<string | undefined> => {
    try {
      const buffer = fs.readFileSync(filePath);
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { info, metadata } = await getMeta(pdf);
      console.log(`bookId, info, metadata :`, bookId, info, metadata);
      return info['cover'];
    } catch (error) {
      console.error('⚠️ PDF cover extraction failed, skipping:', error);
    }
  };

  /**
   * Download cover from URL (for web books)
   */
  downloadCover = async (bookId: string, coverUrl?: string): Promise<string | undefined> => {
    if (!coverUrl) return undefined;

    try {
      const response = await fetch(coverUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      const extension = coverUrl.split('.').pop()?.split('?')[0] || 'jpg';
      const fileName = `${bookId}.${extension}`;
      const filePath = path.join(this.uploadsDir, fileName);

      await writeFile(filePath, buffer);
      return fileName;
    } catch (error) {
      console.warn(`⚠️ Failed to download cover from ${coverUrl}:`, error);
    }
  };
}
