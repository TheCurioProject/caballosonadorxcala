import { useEffect, useRef } from 'react';

export const useScrollLock = (lock: boolean) => {
  const scrollOffset = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (lock) {
      // Save current scroll position
      scrollOffset.current = window.scrollY;

      // Apply styles to lock body and prevent bouncing
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollOffset.current}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      // Remove lock styles
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';

      // Restore scroll position
      window.scrollTo(0, scrollOffset.current);
    }

    // We do not cleanup the lock if `lock` changes to false in the effect, 
    // because the `else` block already handles restoration. 
    // We only need cleanup on unmount if it's currently locked.
    return () => {
      // We check document body style position instead of just `lock` 
      // to ensure we only clean up if we actually applied the lock and unmounted.
      // But a simple check works:
      if (lock && document.body.style.position === 'fixed') {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollOffset.current);
      }
    };
  }, [lock]);
};
