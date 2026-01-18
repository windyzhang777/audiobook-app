import { SpeechOptions } from "expo-speech";

export type BookSource = "local" | "cloud";
export type FileType = "txt" | "pdf" | "epub" | "mobi";

export interface UserSettings {
  theme: "light" | "dark";
}

export interface Book {
  id: string; // UUID
  userId: string; // TODO: future multi-user support
  title: string;
  author?: string;

  // File handling - support both local and cloud
  source: BookSource;
  localPath?: string; // Required if source is 'local'
  cloudUrl?: string; // Required if source is 'cloud'
  fileType: FileType; // file format

  // Reading progress
  currentLine: number;
  totalLines: number;

  // Metadata
  dateAdded: string; // ISO date string
  lastRead: string; // ISO date string
  updatedAt: string; // For sync conflict resolution
  syncedAt?: string; // Last successful sync to cloud

  // TODO: Future features
  isPublic?: boolean; // For sharing books
  sharedBy?: string; // User ID who shared the book
  coverImageUrl?: string; // URL to cover image

  // Settings per book
  settings?: SpeechOptions;
}
