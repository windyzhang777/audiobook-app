import { isValidImageType, MAX_UPLOAD_SIZE } from '@audiobook/shared';
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { BookController } from '../controllers/bookController';
import { uploadsDir } from '../index';

export const uploadImage = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const bookId = req.params.id;
      const fileExt = path.extname(file.originalname);
      cb(null, `${bookId}${fileExt.toLowerCase()}`);
    },
  }),
  fileFilter: (_req: any, file: Express.Multer.File, cb: (error: Error | null, acceptFile?: boolean) => void) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (isValidImageType(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type'));
    }
  },
  limits: { fileSize: MAX_UPLOAD_SIZE },
});

export const bookRoutes = (bookController: BookController) => {
  const router = Router();

  router.get('/check-updates', bookController.checkUpdates);
  router.get('/scrape', bookController.scrapeWithProgress);
  router.get('/', bookController.getAll);
  router.get('/:id', bookController.getById);
  router.get('/:id/audio/:lineIndex', bookController.getAudioForLine);
  router.get('/:id/content', bookController.getContent);
  router.get('/:id/search', bookController.search);
  router.get('/:id/setting', bookController.getSetting);
  router.post('/:id/refresh', bookController.updateChapters);
  router.post('/:id/hydrate/:index', bookController.hydrateChapter);
  router.post('/:id/rehydrate/:index', bookController.reHydrateFromChapter);
  router.post('/:id/content', bookController.restoreLine);
  router.put('/:id/upload', uploadImage.single('cover'), bookController.updateWithCover);
  router.patch('/:id', bookController.updateBook);
  router.patch('/:id/setting', bookController.updateSetting);
  router.delete('/:id', bookController.delete);
  router.delete('/:id/content', bookController.deleteLine);

  return router;
};
