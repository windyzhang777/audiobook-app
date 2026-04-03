export const en = {
  book: {
    actions: {
      edit: {
        menuLabel: 'Rename...',
        modalTitle: 'Book Info',
      },
      delete: {
        menuLabel: 'Remove...',
        modalTitle: 'Delete Book',
        confirmText: 'Delete',
      },
      resetProgress: {
        menuLabel: '',
        modalTitle: 'Reset Reading Progress',
      },
      markCompleted: {
        menuLabel: 'Mark Progress...',
        modalTitle: 'Mark as Completed',
      },
    },
  },
} as const;

export type TranslationSchema = typeof en;
