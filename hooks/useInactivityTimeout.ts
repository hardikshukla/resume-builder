'use client';

import { useEffect, useRef } from 'react';

export function useInactivityTimeout(timeoutMinutes: number, onTimeout: () => void) {
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  // Use a ref to throttle the event listeners so we don't reset the timer
  // on every single mousemove pixel.
  const lastActivity = useRef<number>(Date.now());
  const throttleMs = 1000; // only reset if 1 second has passed since last activity

  // To avoid stale closures, keep a fresh ref to onTimeout
  const callbackRef = useRef(onTimeout);
  useEffect(() => {
    callbackRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    const resetTimer = () => {
      const now = Date.now();
      if (now - lastActivity.current < throttleMs) {
        return; // throttled
      }
      lastActivity.current = now;

      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }

      timeoutId.current = setTimeout(() => {
        callbackRef.current();
      }, timeoutMs);
    };

    // Initial set
    resetTimer();

    // Events to track
    const events = ['mousemove', 'keydown', 'scroll', 'click'];
    
    // Attach listeners
    events.forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      if (timeoutId.current) clearTimeout(timeoutId.current);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [timeoutMs]);
}
