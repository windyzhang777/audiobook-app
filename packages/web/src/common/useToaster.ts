import React, { useState } from 'react';
import useTimer from './useTimer';

export default function useToaster() {
  const [toaster, setToaster] = useState<React.ReactNode>(null);
  const { startTimer } = useTimer();

  const showToaster = (element: React.ReactNode) => {
    setToaster(element);
    startTimer(() => setToaster(null), 2000);
  };

  return { toaster, showToaster };
}
