/**
 * Type adapter — Bridges wcdatavis type formatting to React-safe output.
 *
 * Most wcdatavis type formatters return plain strings, except `json.format()`
 * which returns a DOM Element. This module provides React-friendly wrappers.
 */

import React from 'react';

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

export interface TypeDef {
  format(val: unknown, fmt?: Record<string, unknown>): string | Element;
  parse(str: string, ir: string, fmt?: string): unknown;
  decode(val: unknown, ir: string, fmt?: string): unknown;
  compare(a: unknown, b: unknown): number;
  natRep(val: unknown): unknown;
  matches(val: unknown): boolean;
  supports: { group: boolean };
}

export interface TypeRegistry {
  get(typeName: string): TypeDef | undefined;
  keys(): string[];
}

export interface FieldTypeInfo {
  type: string;
  format?: string | Record<string, unknown>;
  internalType?: string;
}

// ───────────────────────────────────────────────────────────
// Formatting helpers
// ───────────────────────────────────────────────────────────

/**
 * Format a cell value using the wcdatavis type registry, returning
 * a React-safe node (string or element with dangerouslySetInnerHTML
 * for DOM Elements).
 */
export function formatCellValue(
  registry: TypeRegistry,
  value: unknown,
  fieldTypeInfo: FieldTypeInfo,
  allowHtml = false,
): React.ReactNode {
  const typeDef = registry.get(fieldTypeInfo.type);
  if (!typeDef) {
    return String(value ?? '');
  }

  const fmt = typeof fieldTypeInfo.format === 'string'
    ? undefined
    : fieldTypeInfo.format;

  const formatted = typeDef.format(value, fmt);

  // JSON type returns a DOM Element — wrap it for React
  if (formatted instanceof Element) {
    return React.createElement('span', {
      ref: (node: HTMLElement | null) => {
        if (node && node.childNodes.length === 0) {
          node.appendChild(formatted);
        }
      },
    });
  }

  // When allowHtml is true and the formatted value contains HTML, use
  // dangerouslySetInnerHTML. Otherwise, return as plain text.
  if (allowHtml && typeof formatted === 'string' && /<[a-z][\s\S]*>/i.test(formatted)) {
    return React.createElement('span', {
      dangerouslySetInnerHTML: { __html: formatted },
    });
  }

  return formatted;
}

/**
 * Compare two values using the type's comparator.
 */
export function compareValues(
  registry: TypeRegistry,
  typeName: string,
  a: unknown,
  b: unknown,
): number {
  const typeDef = registry.get(typeName);
  if (!typeDef) return 0;
  return typeDef.compare(a, b);
}
