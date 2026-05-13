import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Detects whether a scroll container is height-constrained by an ancestor.
 *
 * The element MUST start with `overflow: auto` so that `scrollHeight` vs
 * `clientHeight` gives an accurate reading. After detection:
 *
 * - Returns `true` (container mode): element stays scrollable, `<thead sticky>`
 *   sticks to the scroll container top.
 * - Returns `false` (viewport mode): caller removes `overflow-auto` from the
 *   element so no scroll ancestor captures sticky — allowing `position: sticky;
 *   top: 0` on `<thead>` to stick to the viewport as the page scrolls.
 *
 * Uses ResizeObserver to re-evaluate whenever sizes change.
 */
export function useIsConstrained(ref: RefObject<HTMLElement | null>): boolean {
  const [constrained, setConstrained] = useState(true); // start true to avoid flash

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    function check() {
      const element = ref.current;
      if (!element) return;
      // Constrained = element's content is taller than the space given to it
      setConstrained(element.scrollHeight > element.clientHeight + 1);
    }

    check();

    const ro = new ResizeObserver(check);
    ro.observe(el);

    return () => {
      ro.disconnect();
    };
  }, [ref]);

  return constrained;
}
