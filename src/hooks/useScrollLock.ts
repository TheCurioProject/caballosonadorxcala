import { useEffect } from 'react';

let lockCount = 0;
let restoreBody: (() => void) | undefined;

export const useScrollLock = (lock: boolean) => {
  useEffect(() => {
    if (!lock) return;

    if (lockCount === 0) {
      const body = document.body;
      const scrollY = window.scrollY;
      const previous = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow,
      };
      Object.assign(body.style, {
        position: 'fixed', top: `-${scrollY}px`, left: '0', right: '0', width: '100%', overflow: 'hidden',
      });
      restoreBody = () => {
        Object.assign(body.style, previous);
        window.scrollTo(0, scrollY);
      };
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        restoreBody?.();
        restoreBody = undefined;
      }
    };
  }, [lock]);
};
