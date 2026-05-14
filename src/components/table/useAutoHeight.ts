import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

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

const SHADOW_CLASS = 'wcdv-thead-shadow';

/**
 * In viewport mode (not constrained), directly manipulates the thead DOM
 * on scroll for near-native sticky header performance.
 *
 * Uses `position: relative; top: Xpx` (not transform) so that descendant
 * pinned columns with `position: sticky; left: ...` still work correctly.
 * (CSS transforms create a new containing block, breaking child sticky.)
 *
 * Toggles the shadow class directly on the DOM element, bypassing React re-renders.
 */
export function useViewportSticky(
  scrollContainerRef: RefObject<HTMLElement | null>,
  isConstrained: boolean,
  enabled: boolean,
): { scrolledRef: React.RefObject<boolean> } {
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (isConstrained || !enabled) return;

    function onWindowScroll() {
      const container = scrollContainerRef.current;
      if (!container) return;
      const thead = container.querySelector('thead') as HTMLElement | null;
      if (!thead) return;

      const containerRect = container.getBoundingClientRect();
      const theadHeight = thead.offsetHeight;
      const offset = -containerRect.top;

      if (offset > 0 && containerRect.bottom > theadHeight) {
        thead.style.position = 'relative';
        thead.style.top = `${offset}px`;
        if (!scrolledRef.current) {
          scrolledRef.current = true;
          thead.classList.add(SHADOW_CLASS);
        }
      } else {
        if (thead.style.top) {
          thead.style.position = '';
          thead.style.top = '';
        }
        const shouldShow = offset > 0;
        if (scrolledRef.current !== shouldShow) {
          scrolledRef.current = shouldShow;
          thead.classList.toggle(SHADOW_CLASS, shouldShow);
        }
      }
    }

    window.addEventListener('scroll', onWindowScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onWindowScroll);
      // Clean up DOM mutations on unmount
      const thead = scrollContainerRef.current?.querySelector('thead') as HTMLElement | null;
      if (thead) {
        thead.style.position = '';
        thead.style.top = '';
        thead.classList.remove(SHADOW_CLASS);
      }
      scrolledRef.current = false;
    };
  }, [scrollContainerRef, isConstrained, enabled]);

  return { scrolledRef };
}
