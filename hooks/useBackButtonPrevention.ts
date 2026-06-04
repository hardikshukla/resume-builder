import { useEffect, useState } from 'react';

/**
 * Intercepts the browser back button while the user has active work.
 *
 * Strategy:
 *  1. When `isActive` becomes true, push a "barrier" entry into the history stack.
 *  2. On `popstate` (user pressed back), the barrier is consumed → we catch it,
 *     re-push the barrier, and surface `showDialog = true`.
 *  3. `cancelLeave` → dismiss the dialog (user stays).
 *  4. `confirmLeave` → navigate back past the barrier so the browser actually leaves.
 *
 * This means page.tsx needs zero history/event logic.
 */
export function useBackButtonPrevention(isActive: boolean) {
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    // Push barrier so the FIRST back press pops this state, not the real page.
    window.history.pushState({ preventBack: true }, '');

    const handlePopState = () => {
      // Back was pressed — barrier was consumed.
      // Re-push it immediately so the user stays on the page.
      window.history.pushState({ preventBack: true }, '');
      setShowDialog(true);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isActive]);

  /** User chose to stay — dismiss the dialog. */
  const cancelLeave = () => {
    setShowDialog(false);
  };

  /**
   * User confirmed they want to leave.
   * Go back twice: once past our live barrier, once past the original barrier push.
   */
  const confirmLeave = () => {
    setShowDialog(false);
    // history.go(-2) skips both the re-pushed barrier and the original barrier
    // to reach the real previous page.
    window.history.go(-2);
  };

  return { showDialog, cancelLeave, confirmLeave };
}
