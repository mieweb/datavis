/**
 * EventBridge — Adapts the wcdatavis `mixinEventHandling` pub/sub pattern
 * to React-friendly patterns (callbacks and hooks).
 *
 * The core wcdatavis objects (Source, ComputedView, Prefs) use a custom
 * event system with `.on(event, callback, opts)` / `.off(event, who)` /
 * `.fire(event, ...args)`. This module bridges that to React's world.
 */

import { useEffect, useRef } from 'react';

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

/** Any wcdatavis object that has mixinEventHandling applied. */
export interface EventEmitter {
  on(event: string, callback: (...args: unknown[]) => void, opts?: { who?: unknown; limit?: number; info?: string }): void;
  off(event: string, who: unknown, opts?: Record<string, unknown>): void;
  fire(event: string, ...args: unknown[]): void;
}

// ───────────────────────────────────────────────────────────
// Hook: useDataVisEvent
// ───────────────────────────────────────────────────────────

/**
 * Subscribe to a single event on a wcdatavis EventEmitter.
 * Automatically unsubscribes on unmount or when deps change.
 *
 * @example
 * ```tsx
 * useDataVisEvent(view, 'workEnd', (info) => {
 *   setRowCount(info.numRows);
 * });
 * ```
 */
export function useDataVisEvent(
  emitter: EventEmitter | null | undefined,
  event: string,
  handler: (...args: unknown[]) => void,
): void {
  // Stable reference for the handler so we don't re-subscribe on every render.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // Unique identity for off()
  const whoRef = useRef<object>({});

  useEffect(() => {
    if (!emitter) return;

    const who = whoRef.current;
    const wrappedHandler = (...args: unknown[]) => handlerRef.current(...args);

    emitter.on(event, wrappedHandler, { who });

    return () => {
      emitter.off(event, who);
    };
  }, [emitter, event]);
}

// ───────────────────────────────────────────────────────────
// Hook: useDataVisEvents
// ───────────────────────────────────────────────────────────

/**
 * Subscribe to multiple events at once on the same emitter.
 *
 * @example
 * ```tsx
 * useDataVisEvents(view, {
 *   workBegin: () => setLoading(true),
 *   workEnd:   (info) => { setLoading(false); setData(view.data); },
 * });
 * ```
 */
export function useDataVisEvents(
  emitter: EventEmitter | null | undefined,
  handlers: Record<string, (...args: unknown[]) => void>,
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const whoRef = useRef<object>({});

  useEffect(() => {
    if (!emitter) return;

    const who = whoRef.current;
    const entries = Object.entries(handlersRef.current);

    for (const [event, handler] of entries) {
      emitter.on(event, handler, { who });
    }

    return () => {
      for (const [event] of entries) {
        emitter.off(event, who);
      }
    };
  }, [emitter]);
}

// ───────────────────────────────────────────────────────────
// Imperative EventBridge class
// ───────────────────────────────────────────────────────────

/**
 * Imperative bridge for cases where hooks aren't suitable
 * (e.g. non-React orchestration code).
 */
export class EventBridge {
  private subscriptions: Array<{
    emitter: EventEmitter;
    event: string;
    who: object;
  }> = [];



  /** Subscribe to an event. Returns an unsubscribe function. */
  subscribe(
    emitter: EventEmitter,
    event: string,
    handler: (...args: unknown[]) => void,
  ): () => void {
    const who = {};
    emitter.on(event, handler, { who });
    const sub = { emitter, event, who };
    this.subscriptions.push(sub);

    return () => {
      emitter.off(event, who);
      this.subscriptions = this.subscriptions.filter((s) => s !== sub);
    };
  }

  /** Unsubscribe from all events. Call in cleanup / componentWillUnmount. */
  destroy(): void {
    for (const { emitter, event, who } of this.subscriptions) {
      emitter.off(event, who);
    }
    this.subscriptions = [];
  }
}

// ───────────────────────────────────────────────────────────
// Hook: useEventBridge
// ───────────────────────────────────────────────────────────

/**
 * Creates an EventBridge that auto-destroys on unmount.
 */
export function useEventBridge(): EventBridge {
  const bridgeRef = useRef<EventBridge | null>(null);

  if (!bridgeRef.current) {
    bridgeRef.current = new EventBridge();
  }

  useEffect(() => {
    return () => {
      bridgeRef.current?.destroy();
    };
  }, []);

  return bridgeRef.current;
}
