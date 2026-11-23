import { useEffect, useRef, useState } from 'react';

/**
 * Returns true for a moment after `value` grows — used to replay a CSS animation
 * (e.g. the cart counter "pops" when a product is added). Not on first render.
 */
export function useBump(value: number, durationMs = 400): boolean {
  const previous = useRef(value);
  const [bumped, setBumped] = useState(false);

  useEffect(() => {
    const grew = value > previous.current;
    previous.current = value;
    if (!grew) return;
    setBumped(false);
    // Next frame, so the class is re-applied even if the last bump is still running.
    const frame = requestAnimationFrame(() => setBumped(true));
    const timer = setTimeout(() => setBumped(false), durationMs);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [value, durationMs]);

  return bumped;
}
