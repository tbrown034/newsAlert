import { useState, useEffect } from 'react';

/**
 * Hook for displaying a live-updating clock.
 * Returns null during SSR/hydration to avoid hydration mismatch,
 * then updates to real time on the client.
 *
 * @param intervalMs - Update interval in milliseconds (default: 1000)
 * @returns Current Date or null during initial render
 */
export function useClock(intervalMs = 1000): Date | null {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return time;
}
