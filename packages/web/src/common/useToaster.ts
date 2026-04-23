import React, { useState } from 'react';
import useTimer from './useTimer';

export default function useToaster(duration: number = 4000) {
  const [toaster, setToaster] = useState<React.ReactNode>(null);
  const { startTimer } = useTimer();

  const showToaster = (element: React.ReactNode) => {
    setToaster(element);
    startTimer(() => setToaster(null), duration);
  };

  return { toaster, showToaster, hideToaster: () => setToaster(null) };
}
