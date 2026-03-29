import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import mongoose, { Schema } from 'mongoose';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadsDir } from '../index';

interface UploadSession {
  _id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  totalChunks: number;
  uploadedChunks: number[];
  tempDir: string;
  createdAt: Date;
  lastActivity: Date;
}

const UploadSessionSchema = new Schema<UploadSession>({
  _id: { type: String, required: true }, // uploadId
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  fileType: { type: String, required: true },
  totalChunks: { type: Number, required: true },
  uploadedChunks: [Number],
  tempDir: { type: String, required: true },
  lastActivity: { type: Date, default: Date.now, index: { expires: '24h' } }, // auto-cleanup
});
export const UploadSessionModel = mongoose.model('UploadSession', UploadSessionSchema);

export class UploadService {
  private uploadsDir = uploadsDir;

  constructor() {
    // Ensure temp directory exists
    this.ensureDirectories();
  }

  /**
   * Initialize a new upload session
   */
  initializeUpload = async (fileName: string, fileSize: number, fileType: string, totalChunks: number): Promise<string> => {
    const uploadId = uuidv4();
    const tempDir = path.join(this.uploadsDir, 'temp', uploadId);

    // Create temp directory for this upload
    await fs.mkdir(tempDir, { recursive: true });

    await UploadSessionModel.create({
      _id: uploadId,
      fileName,
      fileSize,
      fileType,
      totalChunks,
      uploadedChunks: [],
      tempDir,
      createdAt: new Date(),
      lastActivity: new Date(),
    });

    console.log(`Upload session initialized: ${uploadId} (${fileName}, ${totalChunks} chunks)`);
    return uploadId;
  };

  /**
   * Save a chunk to disk
   */
  saveChunk = async (uploadId: string, chunkIndex: number, chunkData: Buffer): Promise<void> => {
    const session = await UploadSessionModel.findById(uploadId);
    if (!session) {
      throw new Error('Upload session expired or not found');
    }

    // Validate chunk index
    if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      throw new Error(`Invalid chunk index: ${chunkIndex}`);
    }

    // Save chunk to temp directory
    const chunkPath = path.join(session.tempDir, `chunk-${String(chunkIndex).padStart(5, '0')}`);
    await fs.writeFile(chunkPath, chunkData);

    // Mark chunk as uploaded and update in Mongo
    const updatedSession = await UploadSessionModel.findByIdAndUpdate(
      uploadId,
      {
        $addToSet: { uploadedChunks: chunkIndex },
        $set: { lastActivity: new Date() },
      },
      { returnDocument: 'after', lean: true },
    );

    if (updatedSession) {
      console.log(`Chunk ${chunkIndex + 1}/${updatedSession.totalChunks} saved for upload ${uploadId} ` + `(${updatedSession.uploadedChunks.length}/${updatedSession.totalChunks} complete)`);
    }
  };

  /**
   * Merge all chunks and finalize the upload
   */
  finalizeUpload = async (uploadId: string, outputDir = uploadsDir): Promise<Record<string, string>> => {
    const session = await UploadSessionModel.findById(uploadId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    // Verify all chunks are uploaded
    if (session.uploadedChunks.length !== session.totalChunks) {
      const missing = [];
      for (let i = 0; i < session.totalChunks; i++) {
        if (!session.uploadedChunks.includes(i)) {
          missing.push(i);
        }
      }
      throw new Error(`Missing chunks: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);
    }

    const fileName = session.fileName;
    const filePath = path.join(outputDir, uploadId);

    console.log(`Merging ${session.totalChunks} chunks for ${uploadId}...`);

    // Merge chunks
    await this.mergeChunks(session.toObject(), filePath);

    // Cleanup
    await this.cleanupSession(uploadId);

    console.log(`Upload finalized: ${uploadId} -> ${filePath}`);

    return { filePath, fileName };
  };

  /**
   * Merge all chunks into a single file
   */
  private mergeChunks = async (session: UploadSession, outputPath: string): Promise<void> => {
    const writeStream = createWriteStream(outputPath);

    try {
      for (let i = 0; i < session.totalChunks; i++) {
        const chunkPath = path.join(session.tempDir, `chunk-${String(i).padStart(5, '0')}`);
        const chunkData = await fs.readFile(chunkPath);

        await new Promise<void>((resolve, reject) => {
          const canContinue = writeStream.write(chunkData);

          if (canContinue) resolve();
          else writeStream.once('drain', resolve); // Wait for 'drain' before reading next chunk
          writeStream.once('error', reject); // Catch stream-specific errors (e.g. Disk Full)
        });

        // Yield to event loop every few chunks
        if (i % 50 === 0) await new Promise(setImmediate);
      }

      // Wait for write to complete
      await new Promise<void>((resolve, reject) => {
        writeStream.end();
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    } catch (error) {
      writeStream.destroy();
      throw error;
    }
  };

  /**
   * Get upload session status
   */
  getStatus = async (uploadId: string) => {
    // : Promise<{ uploadedChunks: number[]; totalChunks: number; progress: number; fileName: string } | null{ uploadedChunks: number[]; totalChunks: number; progress: number; fileName: string } | null>
    const session = await UploadSessionModel.findById(uploadId).lean();
    if (!session) {
      return null;
    }

    return {
      uploadedChunks: Array.from(session.uploadedChunks),
      totalChunks: session.totalChunks,
      progress: (session.uploadedChunks.length / session.totalChunks) * 100,
      fileName: session.fileName,
    };
  };

  /**
   * Cancel an upload session
   */
  cancelUpload = async (uploadId: string): Promise<void> => {
    const session = await UploadSessionModel.findById(uploadId);

    if (session) {
      await this.cleanupSession(uploadId);
      console.log(`Upload cancelled: ${uploadId}`);
    }
  };

  /**
   * Clean up a specific upload session
   */
  private cleanupSession = async (uploadId: string): Promise<void> => {
    const session = await UploadSessionModel.findById(uploadId);

    if (!session) return;

    // Delete temp directory
    try {
      await fs.rm(session.tempDir, { recursive: true, force: true });
      const tempDir = path.join(this.uploadsDir, 'temp');
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to delete temp directory for ${uploadId}:`, error);
    }
    // Remove from sessions
    await UploadSessionModel.findByIdAndDelete(uploadId);
  };

  /**
   * Ensure required directories exist
   */
  private ensureDirectories = async (): Promise<void> => {
    await fs.mkdir(this.uploadsDir, { recursive: true });
  };
}
