import { VOICE_FALLBACK, type VoiceOption } from '@/common/useBookSettings';
import type { ReadingMode } from '@/pages/BookReader';
import type { Book, BookContent, BookMark, BookSetting, Chapter, HighLight, SearchMatch } from '@audiobook/shared';
import { createContext, useContext, type Dispatch, type RefObject, type SetStateAction } from 'react';

interface ICommonContext {
  viewLine: number;
  isPlaying: boolean;
  handlePlayPause: () => void;
  readingMode: ReadingMode;
  jumpToIndex: (index: number | undefined, shouldRead?: boolean) => Promise<void>;
  jumpToRead: () => void;
  ttsScroll: () => void;
  userScroll: () => void;
  // scrollToLine: (index: number, behavior?: 'auto' | 'smooth') => void;
  navigateBack: (replace?: boolean) => void;
  // flushUpdate: () => void;
  // loadMoreLines: (offset?: number, limit?: number) => Promise<void>;
  hydrateChapterByIndex: (chapterIndex: number) => Promise<Book | undefined>;
  handleLineClick: (index: number) => void;
}
const defaultCommonContext: ICommonContext = {
  viewLine: 0,
  isPlaying: false,
  handlePlayPause: () => {},
  readingMode: 'tts',
  jumpToIndex: () => Promise.resolve(),
  jumpToRead: () => {},
  ttsScroll: () => {},
  userScroll: () => {},
  // scrollToLine: () => {},
  navigateBack: () => {},
  // flushUpdate: () => {},
  // loadMoreLines: () => Promise.resolve(),
  hydrateChapterByIndex: () => Promise.resolve(undefined),
  handleLineClick: () => {},
};
export const CommonContext = createContext<ICommonContext>(defaultCommonContext);
export const useCommonContext = () => {
  const commonContext = useContext(CommonContext);
  if (!commonContext) {
    console.error('Common context is used out of scope');
    return defaultCommonContext;
  }
  return {
    viewLine: commonContext.viewLine,
    isPlaying: commonContext.isPlaying,
    handlePlayPause: commonContext.handlePlayPause,
    readingMode: commonContext.readingMode,
    jumpToIndex: commonContext.jumpToIndex,
    jumpToRead: commonContext.jumpToRead,
    ttsScroll: commonContext.userScroll,
    userScroll: commonContext.userScroll,
    // scrollToLine: commonContext.scrollToLine,
    navigateBack: commonContext.navigateBack,
    // flushUpdate: commonContext.flushUpdate,
    // loadMoreLines: commonContext.loadMoreLines,
    hydrateChapterByIndex: commonContext.hydrateChapterByIndex,
    handleLineClick: commonContext.handleLineClick,
  };
};

type IBookContext = Omit<
  Required<Book>,
  'userId' | 'title' | 'author' | 'source' | 'localPath' | 'coverPath' | 'extractedImages' | 'bookUrl' | 'fileType' | 'chapters' | 'createdAt' | 'lastReadAt' | 'updatedAt'
> & {
  viewChapter: (Chapter & { chapterIndex: number }) | undefined;
  book: Book | undefined;
  setBookmarks: Dispatch<SetStateAction<BookMark[]>>;
  toggleBookmark: (index: number, text: string) => void;
  setHighlights: Dispatch<SetStateAction<HighLight[]>>;
  toggleHighlight: (indices: number[], texts: string[]) => void;
  deleteLine: (index: number) => Promise<void>;
};
const defaultBookContext: IBookContext = {
  _id: '',
  currentLine: 0,
  totalLines: 0,
  lastCompleted: '',
  bookmarks: [],
  setBookmarks: () => {},
  toggleBookmark: () => {},
  highlights: [],
  setHighlights: () => {},
  toggleHighlight: () => {},
  viewChapter: undefined,
  book: undefined,
  deleteLine: () => Promise.resolve(),
};
export const BookContext = createContext<IBookContext>(defaultBookContext);
export const useBookContext = () => {
  const bookContext = useContext(BookContext);
  if (!bookContext) {
    console.error('Book context is used out of scope');
    return defaultBookContext;
  }
  return {
    _id: bookContext._id,
    currentLine: bookContext.currentLine,
    totalLines: bookContext.totalLines,
    lastCompleted: bookContext.lastCompleted,
    bookmarks: bookContext.bookmarks,
    setBookmarks: bookContext.setBookmarks,
    toggleBookmark: bookContext.toggleBookmark,
    highlights: bookContext.highlights,
    setHighlights: bookContext.setHighlights,
    toggleHighlight: bookContext.toggleHighlight,
    viewChapter: bookContext.viewChapter,
    book: bookContext.book,
    deleteLine: bookContext.deleteLine,
  };
};

type IContentContext = Omit<Required<BookContent>, 'bookId' | 'pagination'> & { hasMore: boolean };
const defaultContentContext: IContentContext = {
  lines: [],
  lang: 'en-US',
  hasMore: false,
};
export const ContentContext = createContext<IContentContext>(defaultContentContext);
export const useContentContext = () => {
  const contentContext = useContext(ContentContext);
  if (!contentContext) {
    console.error('Content context is used out of scope');
    return defaultContentContext;
  }
  return {
    lines: contentContext.lines,
    lang: contentContext.lang,
    hasMore: contentContext.hasMore,
  };
};

interface ISettingContext extends Omit<BookSetting, 'bookId' | 'audioPath' | 'pitch' | 'volume' | 'voice'> {
  setRate: Dispatch<SetStateAction<BookSetting['rate']>>;
  selectedVoice: VoiceOption;
  setVoice: Dispatch<SetStateAction<NonNullable<string>>>;
  setFontSize: Dispatch<SetStateAction<BookSetting['fontSize']>>;
  setLineHeight: Dispatch<SetStateAction<BookSetting['lineHeight']>>;
  setIndent: Dispatch<SetStateAction<BookSetting['indent']>>;
  setAlignment: Dispatch<SetStateAction<BookSetting['alignment']>>;
  availableVoices: VoiceOption[];
}
const defaultSettingContext: ISettingContext = {
  rate: 1,
  setRate: () => {},
  selectedVoice: VOICE_FALLBACK,
  setVoice: () => {},
  fontSize: 18,
  setFontSize: () => {},
  lineHeight: 1,
  setLineHeight: () => {},
  indent: 1,
  setIndent: () => {},
  alignment: 'left',
  setAlignment: () => {},
  availableVoices: [],
};
export const SettingContext = createContext<ISettingContext>(defaultSettingContext);
export const useSettingContext = () => {
  const settingContext = useContext(SettingContext);
  if (!settingContext) {
    console.error('Setting context is used out of scope');
    return defaultSettingContext;
  }
  return {
    rate: settingContext.rate,
    setRate: settingContext.setRate,
    selectedVoice: settingContext.selectedVoice,
    setVoice: settingContext.setVoice,
    fontSize: settingContext.fontSize,
    setFontSize: settingContext.setFontSize,
    lineHeight: settingContext.lineHeight,
    setLineHeight: settingContext.setLineHeight,
    indent: settingContext.indent,
    setIndent: settingContext.setIndent,
    alignment: settingContext.alignment,
    setAlignment: settingContext.setAlignment,
    availableVoices: settingContext.availableVoices,
  };
};

interface ISearchContext {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchText: string;
  setSearchText: Dispatch<SetStateAction<string>>;
  searchRes: SearchMatch[];
  currentMatch: number;
  clickMatch: (index: number) => Promise<void>;
  prevMatch: () => Promise<void>;
  nextMatch: () => Promise<void>;
  openSearch: () => void;
  closeSearch: () => void;
}
const defaultSearchContext: ISearchContext = {
  searchInputRef: { current: null },
  searchText: '',
  setSearchText: () => {},
  searchRes: [],
  currentMatch: 0,
  clickMatch: () => Promise.resolve(),
  prevMatch: () => Promise.resolve(),
  nextMatch: () => Promise.resolve(),
  openSearch: () => {},
  closeSearch: () => {},
};
export const SearchContext = createContext<ISearchContext>(defaultSearchContext);
export const useSearchContext = () => {
  const searchContext = useContext(SearchContext);
  if (!searchContext) {
    console.error('Search context is used out of scope');
    return defaultSearchContext;
  }
  return {
    searchInputRef: searchContext.searchInputRef,
    searchText: searchContext.searchText,
    setSearchText: searchContext.setSearchText,
    searchRes: searchContext.searchRes,
    currentMatch: searchContext.currentMatch,
    clickMatch: searchContext.clickMatch,
    prevMatch: searchContext.prevMatch,
    nextMatch: searchContext.nextMatch,
    openSearch: searchContext.openSearch,
    closeSearch: searchContext.closeSearch,
  };
};

interface ISpeechContext {
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}
const defaultSpeechContext: ISpeechContext = {
  isPlaying: false,
  play: () => {},
  pause: () => {},
  resume: () => {},
  stop: () => {},
};
export const SpeechContext = createContext<ISpeechContext>(defaultSpeechContext);
export const useSpeechContext = () => {
  const speechContext = useContext(SpeechContext);
  if (!speechContext) {
    console.error('Speech context is used out of scope');
    return defaultSpeechContext;
  }
  return {
    isPlaying: speechContext.isPlaying,
    play: speechContext.play,
    pause: speechContext.pause,
    resume: speechContext.resume,
    stop: speechContext.stop,
  };
};
