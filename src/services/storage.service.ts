import AsyncStorage from "@react-native-async-storage/async-storage";
import { Book } from "../models/Book";

const STORAGE_KEYS = {
  BOOKS: '@audiobooks:books',
  USER: '@audiobooks:user',
  SETTINGS: '@audiobooks:settings',
};

class StorageService {
  // ========================================
  // Book Management
  // ========================================
  async getBooks(): Promise<Book[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.BOOKS);

      // Merge with cloud books
      const localBooks: Book[] = data ? JSON.parse(data) : [];
      const cloudBooks = await this.fetchCloudBooks();
      return this.mergeBooks(localBooks, cloudBooks);
    } catch (error) {
      console.error('Error fetching books from storage', error);
      return [];
    }
  }

  async saveBooks(books: Book[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books));

      // Sync public books to cloud
      const publicBooks = books.filter(book => book.isPublic);
      await this.syncBooksToCloud(publicBooks);
    } catch (error) {
      console.error('Error saving books to storage', error);
      throw error;
    }
  }

  async getBook(id: string): Promise<Book | null> {
    const books = await this.getBooks();
    return books.find(book => book.id === id) || null;
  }

  async addBook(book: Book): Promise<void> {
    const books = await this.getBooks();
    books.push(book);
    await this.saveBooks(books);
  }

  async updateBook(updatedBook: Book): Promise<void> {
    const books = await this.getBooks();
    const index = books.findIndex(book => book.id === updatedBook.id);
    if (index !== -1) {
      books[index] = updatedBook;
      await this.saveBooks(books);
    }
  }

  async deleteBook(id: string): Promise<void> {
    const books = await this.getBooks();
    const filteredBooks = books.filter(book => book.id !== id);
    await this.saveBooks(filteredBooks);
  }

  async updateProgress(bookId: string, currentLine: number): Promise<void> {
    const book = await this.getBook(bookId);
    if (book) {
      book.currentLine = currentLine;
      book.lastRead = new Date().toISOString();
      await this.updateBook(book);
    }
  }

  // ========================================
  // Settings
  // ========================================
  async getSettings(): Promise<Record<string, string | number | boolean>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error fetching user settings from storage', error);
      return {};
    }
  }

  async saveSettings(settings: Record<string, string | number | boolean>): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving user settings to storage', error);
    }
  }

  // ========================================
  // TODO: Cloud Sync Methods (placeholders)
  // ========================================
  private async fetchCloudBooks(): Promise<Book[]> {
    // TODO: Implement cloud fetch logic
    return [];
  }

  private async syncBooksToCloud(books: Book[]): Promise<void> {
    // TODO: Implement cloud sync logic
  }

  private async mergeBooks(localBooks: Book[], cloudBooks: Book[]): Promise<Book[]> {
    // TODO: Implement merging logic, resolving conflicts based on updatedAt
    return [...localBooks, ...cloudBooks];
  }
}

export const storageService = new StorageService();