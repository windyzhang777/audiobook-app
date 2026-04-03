import { TFunction } from 'i18next';
import { BookAction } from './types';

export const actionKeyByActionType: Record<BookAction['type'], string> = {
  select: 'book.actions.select',
  edit: 'book.actions.edit',
  delete: 'book.actions.delete',
  resetProgress: 'book.actions.resetProgress',
  markCompleted: 'book.actions.markCompleted',
};

type ActionField = 'menuLabel' | 'modalTitle' | 'confirmText';
type FieldKey = `${(typeof actionKeyByActionType)[keyof typeof actionKeyByActionType]}.${ActionField}`;

export const getBookActionLabel = (actionType: BookAction['type'], t: TFunction, field: ActionField): string => {
  const key = actionKeyByActionType[actionType];
  if (!key) {
    console.warn(`Missing translation key for action: ${actionType}`);
    return '';
  }

  const fieldKey: FieldKey = `${key}.${field}` as const;
  return t(fieldKey);
};
