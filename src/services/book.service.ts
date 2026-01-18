import { Book, FileType } from "@models/Book";
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from "./storage.service";

class BookService {
  async pickAndAddBook(): Promise<Book | null> {
    try {
      // let user pick a file
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/pdf', 'application/epub+zip', 'application/x-mobipocket-ebook'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || !result.assets[0]) return null;

      // get file type
      const doc = result.assets[0];
      const fileType = this.getFileType(doc.name);

      // copy file to app's permanent storage
      const fileId = `${uuidv4()}_${doc.name.trim().replace(/\s+/g, '_')}`;
      const destPath = `${FileSystem.documentDirectory}/${fileId}`;
      await FileSystem.copyAsync({
        from: doc.uri,
        to: destPath,
      });

      // parse the file to get total lines
      const content = await this.readBookContent(destPath, fileType);
      const lines = this.parseLines(content);

      // create Book object
      const book: Book = {
        id: fileId,
        userId: 'default', // TODO: get user ID
        title: doc.name.replace(/\.[^/.]+$/, ''), // Remove extension,
        source: 'local',
        localPath: destPath,
        fileType,
        currentLine: 0,
        totalLines: lines.length,
        dateAdded: new Date().toISOString(),
        lastRead: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: {
          rate: 1.0,
          pitch: 1.0,
        },
      };

      // save to storage
      await storageService.addBook(book);

      return book;
    } catch (error) {
      console.error('Error picking or adding book', error);
      throw error;
    }
  }

  async getBookContent(book: Book): Promise<string[]> {
    try {
      const filePath = book.source === 'local' ? book.localPath! : await this.downloadCloudBook(book.cloudUrl!); // TODO: handle cloud URL
      const content = await this.readBookContent(filePath, book.fileType);
      return this.parseLines(content);
    } catch (error) {
      console.error('Error getting book content', error);
      throw error;
    }
  }

  async readBookContent(filePath: string, fileType: string): Promise<string> {
    // handle .txt files
    if (fileType === 'txt') {
      return await FileSystem.readAsStringAsync(filePath);
    }
    if (fileType === 'epub') {
      return await this.parseEPUB(filePath);
    }
    throw new Error(`File type ${fileType} not supported`);
  }

  private async parseEPUB(filePath: string): Promise<string> {
    try {
      const base64 = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.Base64 });
      // TODO: implement EPUB parsing logic
      return base64;
    } catch (error) {
      console.error('Error parsing EPUB', error);
      throw error;
    }
  }

  private parseLines(content: string): string[] {
    // check language and split accordingly
    if (/[^\u0000-\u007F]/.test(content)) {
      // contains non-ASCII characters, likely CJK
      return content.split(/\n+/).flatMap(line => line.split(/(?<=[。！？])/).map(sentence => sentence.trim())).filter(line => line.length > 0);
    }
    // default: split by sentences for English and others
    return content.split(/\n+/).flatMap(line => line.split(/(?<=[.!?])/).map(sentence => sentence.trim())).filter(line => line.length > 0);
  }

  private getFileType(filePath: string): FileType {
    const extension = filePath.split('.').pop()?.toLowerCase();
    if (extension === 'txt' || extension === 'pdf' || extension === 'epub' || extension === 'mobi') {
      return extension as FileType;
    }
    throw new Error(`Unsupported file type: ${extension}`);
  }

  async deleteBook(book: Book): Promise<void> {
    // delete from file system
    try {
      if (book.source === 'local' && book.localPath) {
        await FileSystem.deleteAsync(book.localPath, { idempotent: true });
      }
    } catch (error) {
      console.error('Error deleting book file', error);
    }

    // delete from storage
    await storageService.deleteBook(book.id);
  }

  private async downloadCloudBook(cloudUrl: string): Promise<string> {
    // TODO: download book from cloud storage
    // const localPath = `${FileSystem.cacheDirectory}/${uuidv4()}.tmp`;
    // await FileSystem.downloadAsync(cloudUrl, localPath);
    // return localPath;
    return ''; // placeholder
  }
}

export const bookService = new BookService();