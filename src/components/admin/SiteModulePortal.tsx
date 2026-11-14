'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const subscribe = () => () => {};

/**
 * Renders website-editor dialogs at the end of <body>. Inside CALA the editors
 * live in a rounded `.site-module` card that clips its content, so a fixed
 * dialog would be cut. The wrapper keeps the `.site-module` scope (CALA's base
 * element styles stay off Tailwind) without the card's look.
 */
export function SiteModulePortal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(<div className="site-module site-module-portal">{children}</div>, document.body);
}
