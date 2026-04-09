import { Book, BookContent, BookContentPaginated, BookSetting, Chapter, PAGE_SIZE } from '@audiobook/shared';
import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const BookSchema = new Schema<Book>(
  {
    _id: { type: String, default: () => uuidv4() },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, index: true },
    author: { type: String },
    source: { type: String, required: true }, // local | web
    localPath: String,
    coverPath: String,
    extractedImages: { type: Object, default: {} },
    bookUrl: String,
    fileType: String,

    currentLine: { type: Number, default: 0 },
    totalLines: { type: Number, required: true },

    createdAt: { type: String, required: true },
    lastReadAt: String,
    updatedAt: { type: String, required: true },
    lastCompleted: String,
    chapters: [{ title: String, source: String, isLoaded: Boolean, startIndex: Number, href: String }],
    bookmarks: [{ index: Number, text: String }],
  },
  { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

interface IBookContent extends BookContent {
  _id: string;
}
const BookContentSchema = new Schema<IBookContent>(
  {
    _id: { type: String, required: true },
    bookId: { type: String, required: true, index: true },
    lines: [{ type: String }],
    lang: { type: String, default: 'en-US' },
  },
  { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

interface IBookSetting extends BookSetting {
  _id: string;
}
const BookSettingSchema = new Schema<IBookSetting>(
  {
    _id: { type: String, required: true },
    bookId: { type: String, required: true, index: true },
    rate: Number,
    voice: String,
    fontSize: Number,
    lineHeight: Number,
    indent: Number,
    alignment: String,
    audioPath: String,
  },
  { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

const BookModel = mongoose.model<Book>('Book', BookSchema);
const BookContentModel = mongoose.model<IBookContent>('BookContent', BookContentSchema);
const BookSettingModel = mongoose.model<IBookSetting>('BookSetting', BookSettingSchema);

export class BookRepository {
  getAll = async (): Promise<Book[]> => {
    return await BookModel.find().lean();
  };

  getById = async (_id: string): Promise<Book | null> => {
    return await BookModel.findById(_id).lean();
  };

  getByTitle = async (title: string): Promise<Book | null> => {
    return await BookModel.findOne({ title }).lean();
  };

  addBook = async (book: Book) => {
    const newBook = new BookModel({ ...book, _id: book._id });
    await newBook.save();
  };

  updateBook = async (_id: string, updates: Partial<Book>): Promise<Book | null> => {
    return await BookModel.findByIdAndUpdate(_id, { $set: updates }, { returnDocument: 'after' }).lean();
  };

  delete = async (_id: string): Promise<boolean> => {
    const [_, bookDeleted] = await Promise.all([BookContentModel.findByIdAndDelete(_id).lean(), BookModel.findByIdAndDelete(_id).lean()]);
    return !!bookDeleted;
  };

  getContent = async (_id: string, offset: number = 0, limit: number = PAGE_SIZE): Promise<BookContentPaginated | null> => {
    const [book, doc] = await Promise.all([
      BookModel.findById(_id).select('chapters').lean(),
      BookContentModel.findById(_id, {
        bookId: 1,
        lang: 1,
        lines: { $slice: [offset, limit] },
      }).lean(),
    ]);

    if (!doc || !book) return null;

    const totalDoc = await BookContentModel.findById(_id).select('lines').lean();
    const total = totalDoc?.lines.length || 0;
    const hasUnloadedChapters = book.chapters.some((c) => !c.isLoaded);

    return {
      ...doc,
      bookId: doc.bookId,
      pagination: {
        total,
        offset,
        limit,
        hasMore: offset + limit < total || hasUnloadedChapters,
      },
    };
  };

  setContent = async (_id: string, content: BookContent) => {
    const { bookId, lines, lang } = content;
    await BookContentModel.findByIdAndUpdate(
      _id,
      {
        $set: { _id, bookId, lines, lang },
      },
      { upsert: true, returnDocument: 'after' },
    );
  };

  getSetting = async (_id: string): Promise<BookSetting | null> => {
    return await BookSettingModel.findById(_id).lean();
  };

  setSetting = async (_id: string, updates: Partial<BookSetting>) => {
    await BookSettingModel.findByIdAndUpdate(_id, { $set: updates }, { upsert: true, returnDocument: 'after' });
  };

  updateSetting = async (_id: string, updates: Partial<BookSetting>): Promise<BookSetting | null> => {
    return await BookSettingModel.findByIdAndUpdate(_id, { $set: updates }, { returnDocument: 'after' }).lean();
  };

  /**
   * Appends new lines to the book content
   */
  appendLines = async (_id: string, lines: string[], lang?: string): Promise<void> => {
    const update: mongoose.UpdateQuery<IBookContent> = {
      $push: { lines: { $each: lines } },
    };

    if (lang) {
      update.$set = { lang };
    }

    await BookContentModel.findByIdAndUpdate(_id, update);
  };

  appendChapters = async (_id: string, chapters: Chapter[]): Promise<void> => {
    await BookModel.updateOne(
      { _id },
      {
        $push: { chapters: { $each: chapters } },
        $set: { updatedAt: new Date().toISOString() },
      },
    );
  };

  /**
   * Mark a chapter as loaded
   */
  updateChapter = async (_id: string, chapterIndex: number, title?: string): Promise<void> => {
    const content = await BookContentModel.findById(_id).select('lines').lean();
    const currentTotalLines = content?.lines.length || 0;

    const update: mongoose.UpdateQuery<Book> = {
      $set: {
        [`chapters.${chapterIndex}.isLoaded`]: true,
        [`chapters.${chapterIndex}.startIndex`]: currentTotalLines,
      },
    };

    if (title && update.$set) {
      update.$set[`chapters.${chapterIndex}.title`] = title;
    }

    await BookModel.updateOne({ _id }, update);
  };

  truncateFromIndex = async (_id: string, chapterIndex: number): Promise<void> => {
    const book = await BookModel.findById(_id).select('chapters').lean();
    if (!book) throw new Error(`Book [${_id}] not found`);

    const targetChapter = book.chapters[chapterIndex];
    const startLine = targetChapter.startIndex;
    if (targetChapter.startIndex === undefined || !targetChapter.isLoaded) throw new Error(`Chapter ${targetChapter.title} not loaded yet`);

    // Truncate the Content (Remove ALL lines from startLine to the end)
    await BookContentModel.findByIdAndUpdate(_id, {
      $push: {
        lines: {
          $each: [],
          $slice: startLine, // Keeps only lines 0 to startLine-1
        },
      },
    });

    // Truncate the Chapters list
    // Keep chapters from 0 to chapterIndex, remove everything after.
    const remainingChapters = book.chapters.slice(0, chapterIndex + 1);
    remainingChapters[chapterIndex].isLoaded = false;

    await BookModel.findByIdAndUpdate(_id, {
      $set: {
        chapters: remainingChapters,
        totalLines: startLine,
        updatedAt: new Date().toISOString(),
      },
    });

    // Sync total lines count (it will now be equal to startLine)
    await this.syncTotalLines(_id);
  };

  /**
   * Update the total lines count in the metadata (Book) to match
   * the actual lines in the content (BookContent).
   */
  syncTotalLines = async (_id: string): Promise<number> => {
    const content = await BookContentModel.findById(_id).select('lines').lean();
    const total = content?.lines.length || 0;

    await BookModel.findByIdAndUpdate(_id, { $set: { totalLines: total } });
    return total;
  };
}
