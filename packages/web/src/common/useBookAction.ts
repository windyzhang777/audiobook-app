import { type Book, type BookAction } from '@audiobook/shared';
import { useState } from 'react';

export function useBookAction() {
  const [pendingAction, setPendingAction] = useState<BookAction | null>(null);

  const openAction = (action: BookAction['type'], book: Book) => setPendingAction({ type: action, book });

  const closeAction = () => setPendingAction(null);

  return { pendingAction, closeAction, openAction };
}
